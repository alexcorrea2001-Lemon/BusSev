package es.bussev.app;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.Normalizer;
import java.util.List;

/**
 * Aviso de llegada que se corrige solo con la app cerrada.
 *
 * Antes el aviso se programaba con el tiempo del momento y solo se corregía al abrir la app: con tráfico
 * podía saltar varios minutos antes o después. Ahora, en los últimos 15 minutos, el móvil vuelve a preguntar
 * a TUSSAM cada 1–2 minutos (con la misma consulta que usa el widget) y avisa cuando de verdad le falten
 * los minutos elegidos. Si TUSSAM no contesta, avisa a la hora calculada, como antes.
 */
public class LlegadaReceiver extends BroadcastReceiver {
    static final String PREFS = "bussev_viaje";
    static final String ACCION = "es.bussev.app.LLEGADA_REVISAR";
    static final String CANAL = "bussev_llegada";
    static final String CANAL_CUENTA = "bussev_cuenta";
    private static final long MIN = 60_000L;

    // ---------- Lista de avisos pendientes (guardada en el móvil) ----------
    static synchronized JSONArray leer(Context c) {
        try { return new JSONArray(c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("llegadas", "[]")); }
        catch (Exception e) { return new JSONArray(); }
    }
    static synchronized void guardar(Context c, JSONArray a) {
        c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("llegadas", a.toString()).apply();
    }
    static synchronized void poner(Context c, JSONObject nuevo) {
        JSONArray a = leer(c), b = new JSONArray();
        int id = nuevo.optInt("id");
        for (int i = 0; i < a.length(); i++) { JSONObject x = a.optJSONObject(i); if (x != null && x.optInt("id") != id) b.put(x); }
        b.put(nuevo);
        guardar(c, b);
        programar(c);
    }
    static synchronized void quitar(Context c, int id) {
        JSONArray a = leer(c), b = new JSONArray();
        for (int i = 0; i < a.length(); i++) { JSONObject x = a.optJSONObject(i); if (x != null && x.optInt("id") != id) b.put(x); }
        guardar(c, b);
        programar(c);
    }

    // ---------- Despertador: la próxima revisión de todos los avisos ----------
    static PendingIntent pi(Context c) {
        Intent i = new Intent(c, LlegadaReceiver.class).setAction(ACCION);
        int f = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) f |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getBroadcast(c, 7301, i, f);
    }
    static void programar(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        JSONArray a = leer(c);
        long prox = Long.MAX_VALUE, ahora = System.currentTimeMillis();
        boolean cerca = false;   // algún aviso a punto de saltar (menos de 5 min)
        for (int i = 0; i < a.length(); i++) {
            JSONObject x = a.optJSONObject(i);
            if (x == null) continue;
            prox = Math.min(prox, x.optLong("revisar", x.optLong("at")));
            if (x.optLong("at") - ahora < 5 * MIN) cerca = true;
        }
        PendingIntent p = pi(c);
        if (prox == Long.MAX_VALUE) { am.cancel(p); return; }
        long cuando = Math.max(ahora + 5_000L, prox);
        try {
            if (Build.VERSION.SDK_INT >= 31 && !am.canScheduleExactAlarms()) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cuando, p);
            } else if (cerca && Build.VERSION.SDK_INT >= 21) {
                // En los últimos minutos, como un despertador: el móvil no lo retrasa aunque esté en reposo
                // (con el modo normal, Android puede juntar las alarmas y avisar tarde).
                Intent abrir = new Intent(c, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                PendingIntent ver = PendingIntent.getActivity(c, 7302, abrir, PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
                am.setAlarmClock(new AlarmManager.AlarmClockInfo(cuando, ver), p);
            } else if (Build.VERSION.SDK_INT >= 23) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cuando, p);
            } else {
                am.setExact(AlarmManager.RTC_WAKEUP, cuando, p);
            }
        } catch (SecurityException e) {
            if (Build.VERSION.SDK_INT >= 23) am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cuando, p);
            else am.set(AlarmManager.RTC_WAKEUP, cuando, p);
        }
    }

    @Override
    public void onReceive(final Context context, Intent intent) {
        final Context c = context.getApplicationContext();
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) { programar(c); return; }
        final PendingResult pr = goAsync();
        new Thread(new Runnable() {
            public void run() {
                try { revisar(c); } catch (Exception ignored) { }
                finally { programar(c); pr.finish(); }
            }
        }).start();
    }

    static String normLinea(String s) {
        String t = s == null ? "" : s.trim().toUpperCase();
        return t.replaceFirst("^0+(?=\\w)", "");
    }
    static String normTexto(String s) {
        String t = Normalizer.normalize(s == null ? "" : s, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return t.toUpperCase().replaceAll("[^A-Z0-9]+", " ").trim();
    }

    /** Revisa todos los avisos: los que toca, pregunta a TUSSAM; avisa o reprograma. */
    static void revisar(Context c) {
        long ahora = System.currentTimeMillis();
        JSONArray a = leer(c), quedan = new JSONArray();
        SharedPreferences cred = c.getSharedPreferences(BusSevWidgetProvider.PREFS, Context.MODE_PRIVATE);
        String token = null;
        boolean tokenProbado = false;
        for (int i = 0; i < a.length(); i++) {
            JSONObject x = a.optJSONObject(i);
            if (x == null) continue;
            try {
                long at = x.optLong("at"), revisar = x.optLong("revisar", at);
                int antes = x.optInt("antes", 5);
                // Caducado (el autobús hace rato que pasó): se olvida
                if (ahora > at + 30 * MIN) { quitarCuenta(c, x.optInt("id")); continue; }
                if (revisar > ahora + 8_000L) { quedan.put(x); continue; }
                // Lejos todavía: se mira de nuevo cuando falten 15 minutos para avisar
                if (at - ahora > 16 * MIN) { x.put("revisar", at - 15 * MIN); quedan.put(x); continue; }
                Integer min = null;
                try {
                    if (!tokenProbado) { tokenProbado = true; token = TussamTiempos.token(cred); }
                    if (token != null) min = minutos(TussamTiempos.tiempos(x.optString("codigo"), token), x.optString("linea"), x.optString("destino"));
                } catch (Exception ignored) { /* sin red o TUSSAM no contesta */ }
                if (min != null) {
                    if (min <= antes) { quitarCuenta(c, x.optInt("id")); avisar(c, x, min); continue; }
                    cuentaAtras(c, x, min);
                    long nuevo = ahora + (long) (min - antes) * MIN;
                    x.put("at", nuevo);
                    // Cuanto más cerca, más a menudo (y nunca más tarde de la hora de avisar).
                    // TUSSAM da minutos enteros: «3 min» puede ser 3:59 o 3:00, así que cuando le falta
                    // 1 minuto para tu aviso se pregunta cada 20 s, para avisar justo al pasar a tus minutos.
                    int falta = min - antes;
                    long paso = falta <= 1 ? 20_000L : falta <= 3 ? 40_000L : falta <= 6 ? MIN : 2 * MIN;
                    x.put("revisar", Math.min(nuevo, ahora + paso));
                    quedan.put(x);
                } else if (ahora >= at - 20_000L) {
                    // Sin dato del autobús (o sin red) y ya es la hora calculada: se avisa como antes
                    quitarCuenta(c, x.optInt("id"));
                    avisar(c, x, antes);
                } else {
                    x.put("revisar", Math.min(at, ahora + 90_000L));
                    quedan.put(x);
                }
            } catch (Exception e) {
                quedan.put(x);
            }
        }
        guardar(c, quedan);
    }

    /** Minutos que le faltan al autobús de esa línea y destino (si el destino no cuadra, el primero de la línea). */
    static Integer minutos(List<TussamTiempos.Llegada> l, String linea, String destino) {
        String nl = normLinea(linea), nd = normTexto(destino);
        Integer mejorDestino = null, mejorLinea = null;
        for (TussamTiempos.Llegada x : l) {
            if (!normLinea(x.linea).equals(nl)) continue;
            if (mejorLinea == null || x.minutos < mejorLinea) mejorLinea = x.minutos;
            String d = normTexto(x.destino);
            if (!nd.isEmpty() && (d.equals(nd) || d.contains(nd) || nd.contains(d)) && (mejorDestino == null || x.minutos < mejorDestino)) mejorDestino = x.minutos;
        }
        return mejorDestino != null ? mejorDestino : mejorLinea;
    }

    static void canal(Context c, NotificationManager nm) {
        if (Build.VERSION.SDK_INT < 26 || nm.getNotificationChannel(CANAL) != null) return;
        NotificationChannel ch = new NotificationChannel(CANAL, "Avisos de llegada", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("Te avisa cuando tu autobús está a punto de llegar.");
        ch.enableVibration(true);
        nm.createNotificationChannel(ch);
    }

    /* ---------- Cuenta atrás en la barra (Android 16: chip) mientras se acerca tu autobús ---------- */
    static int idCuenta(int id) { return 0x40000000 | (id & 0x0FFFFFFF); }
    static void quitarCuenta(Context c, int id) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(idCuenta(id));
    }
    static void cuentaAtras(Context c, JSONObject x, int min) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CANAL_CUENTA) == null) {
            NotificationChannel ch = new NotificationChannel(CANAL_CUENTA, "Cuenta atrás de tus avisos", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Los minutos que le faltan al autobús de tu aviso de llegada, en la barra de arriba.");
            ch.setSound(null, null);
            ch.enableVibration(false);
            nm.createNotificationChannel(ch);
        }
        int id = x.optInt("id");
        long llega = System.currentTimeMillis() + (long) min * MIN;
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, CANAL_CUENTA) : new Notification.Builder(c);
        b.setSmallIcon(icono(c))
                .setContentTitle("Línea " + x.optString("linea") + " · llega en " + min + " min")
                .setContentText(x.optString("parada") + " · te aviso cuando falten " + x.optInt("antes", 5) + " min")
                .setOngoing(true).setOnlyAlertOnce(true)
                .setCategory(Notification.CATEGORY_PROGRESS)
                .setWhen(llega).setShowWhen(true)
                .setContentIntent(abrirParada(c, x.optString("codigo"), idCuenta(id)));
        if (Build.VERSION.SDK_INT >= 24) { b.setUsesChronometer(true); b.setChronometerCountDown(true); }
        if (Build.VERSION.SDK_INT >= 21) b.setColor(0xFFD41C2B);
        SensorService.promocionar(b, min + " min");
        try { nm.notify(idCuenta(id), b.build()); } catch (SecurityException ignored) { }
    }

    /* «Me he subido»: abre BusSev en la parada y empieza a contar el viaje en esa línea */
    static PendingIntent piSubido(Context c, String codigo, String linea, int notif) {
        Intent open = new Intent(c, MainActivity.class).putExtra("bussev_parada", codigo).putExtra("bussev_subido", linea)
                .putExtra("bussev_cancelar", notif)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int f = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) f |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getActivity(c, 0x20000000 | (notif & 0x0FFFFFFF), open, f);
    }

    static PendingIntent abrirParada(Context c, String codigo, int req) {
        Intent open = new Intent(c, MainActivity.class).putExtra("bussev_parada", codigo)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int f = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) f |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getActivity(c, req, open, f);
    }

    static void avisar(Context c, JSONObject x, int min) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        canal(c, nm);
        String idCanal = AparienciaPlugin.canalPara(c, x.optString("sonido", "sistema"));   // el sonido que elegiste en Ajustes
        int id = x.optInt("id");
        String titulo = min <= 0 ? "Línea " + x.optString("linea") + ": está llegando"
                : "Línea " + x.optString("linea") + ": llega en " + min + " min";
        String texto = x.optString("parada") + " · hacia " + x.optString("destino");
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, idCanal) : new Notification.Builder(c);
        b.setSmallIcon(icono(c)).setContentTitle(titulo).setContentText(texto).setAutoCancel(true)
                .setContentIntent(abrirParada(c, x.optString("codigo"), id))
                .setCategory(Notification.CATEGORY_ALARM);
        if (Build.VERSION.SDK_INT < 26) { b.setPriority(Notification.PRIORITY_HIGH); b.setDefaults(Notification.DEFAULT_ALL); }
        if (Build.VERSION.SDK_INT >= 21) b.setColor(0xFFD41C2B);
        b.addAction(0, "Me he subido", piSubido(c, x.optString("codigo"), x.optString("linea"), id));
        // Para el Pasaporte: Android apunta a qué hora llega ese bus a esa parada (lo usa «Me he subido»)
        ViajeAutoService.apuntarPrevisto(c, x.optString("codigo"), x.optString("linea"), System.currentTimeMillis() + (long) Math.max(0, min) * MIN);
        try { nm.notify(id, b.build()); } catch (SecurityException ignored) { /* sin permiso de notificaciones */ }
    }

    static int icono(Context c) {
        int r = c.getResources().getIdentifier("ic_stat_bus", "drawable", c.getPackageName());
        return r != 0 ? r : c.getApplicationInfo().icon;
    }
}
