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
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.os.Build;
import android.os.SystemClock;
import android.os.VibrationAttributes;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.view.View;
import android.widget.RemoteViews;

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
    static final String ACCION_REP = "es.bussev.app.LLEGADA_REPETIR";
    static final String CANAL = "bussev_llegada";
    static final String CANAL_CUENTA = "bussev_cuenta";
    static final String CANAL_CUENTA_16 = "bussev_cuenta16";
    static final String ACCION_QUITAR = "es.bussev.app.LLEGADA_QUITAR";
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
        for (int i = 0; i < a.length(); i++) {
            JSONObject x = a.optJSONObject(i);
            if (x == null) continue;
            if (x.optInt("id") != id) { b.put(x); continue; }
            // La app corrige la hora: la barra sigue desde donde empezó y no se repite el aviso ya dado
            try {
                for (String k : new String[]{"seg0", "min0", "llega", "avisado", "hasta", "segUlt"}) if (x.has(k)) nuevo.put(k, x.get(k));
                // Si Android ya está siguiendo el autobús, la app no le retrasa la siguiente consulta a TUSSAM
                // (antes, con la app abierta, cada refresco la mandaba a dentro de 1 min y el aviso iba por detrás)
                if (x.has("segUlt")) {
                    if (x.has("revisar")) nuevo.put("revisar", Math.min(nuevo.optLong("revisar"), x.optLong("revisar")));
                    if (x.has("at")) nuevo.put("at", x.optLong("at"));
                }
            } catch (Exception ignored) { }
        }
        b.put(nuevo);
        guardar(c, b);
        programar(c);
        try { AvisoService.siHaceFalta(c); } catch (Exception ignored) { }
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

    /* ---------- Avisos que se repiten ----------
       Cada regla: {id, codigo, parada, linea, destino, antes, hora (minutos desde las 0:00), dias [7 × bool, lunes primero], sonido}.
       A la hora de la regla se crea un aviso de llegada normal, que pregunta a TUSSAM y avisa cuando falten «antes» minutos. */
    static synchronized JSONArray reglas(Context c) {
        try { return new JSONArray(c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("repetidos", "[]")); }
        catch (Exception e) { return new JSONArray(); }
    }
    static synchronized void guardarReglas(Context c, JSONArray a) {
        c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("repetidos", a.toString()).apply();
        programarRepetidos(c);
    }
    static void ponerRegla(Context c, JSONObject r) {
        JSONArray a = reglas(c), b = new JSONArray();
        for (int i = 0; i < a.length(); i++) { JSONObject x = a.optJSONObject(i); if (x != null && x.optInt("id") != r.optInt("id")) b.put(x); }
        b.put(r);
        guardarReglas(c, b);
    }
    static void quitarRegla(Context c, int id) {
        JSONArray a = reglas(c), b = new JSONArray();
        for (int i = 0; i < a.length(); i++) { JSONObject x = a.optJSONObject(i); if (x != null && x.optInt("id") != id) b.put(x); }
        guardarReglas(c, b);
        quitar(c, id);          // y el aviso de hoy, si ya estaba en marcha
        quitarCuenta(c, id);
    }
    /* Próxima vez que toca una regla (en ms), o -1 */
    static long proxima(JSONObject r, long desde) {
        JSONArray d = r.optJSONArray("dias");
        int hora = r.optInt("hora", -1);
        if (d == null || hora < 0) return -1;
        java.util.Calendar k = java.util.Calendar.getInstance();
        k.setTimeInMillis(desde);
        k.set(java.util.Calendar.SECOND, 0); k.set(java.util.Calendar.MILLISECOND, 0);
        for (int n = 0; n < 8; n++) {
            java.util.Calendar x = (java.util.Calendar) k.clone();
            x.add(java.util.Calendar.DAY_OF_YEAR, n);
            x.set(java.util.Calendar.HOUR_OF_DAY, hora / 60); x.set(java.util.Calendar.MINUTE, hora % 60);
            int i = (x.get(java.util.Calendar.DAY_OF_WEEK) + 5) % 7;    // lunes = 0 … domingo = 6
            if (d.optBoolean(i, false) && x.getTimeInMillis() > desde) return x.getTimeInMillis();
        }
        return -1;
    }
    static PendingIntent piRep(Context c) {
        Intent i = new Intent(c, LlegadaReceiver.class).setAction(ACCION_REP);
        int f = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) f |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getBroadcast(c, 7310, i, f);
    }
    static void programarRepetidos(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        JSONArray a = reglas(c);
        long prox = Long.MAX_VALUE, ahora = System.currentTimeMillis();
        for (int i = 0; i < a.length(); i++) { JSONObject r = a.optJSONObject(i); if (r == null) continue; long t = proxima(r, ahora); if (t > 0) prox = Math.min(prox, t); }
        PendingIntent p = piRep(c);
        if (prox == Long.MAX_VALUE) { am.cancel(p); return; }
        try {
            if (Build.VERSION.SDK_INT >= 31 && !am.canScheduleExactAlarms()) am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, prox, p);
            else if (Build.VERSION.SDK_INT >= 23) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, prox, p);
            else am.setExact(AlarmManager.RTC_WAKEUP, prox, p);
        } catch (SecurityException e) {
            if (Build.VERSION.SDK_INT >= 23) am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, prox, p); else am.set(AlarmManager.RTC_WAKEUP, prox, p);
        }
    }
    /* Toca alguna regla: se crea su aviso de llegada de hoy (una vez por día) */
    static void dispararRepetidos(Context c) {
        JSONArray a = reglas(c);
        long ahora = System.currentTimeMillis();
        java.util.Calendar hoy = java.util.Calendar.getInstance();
        String clave = hoy.get(java.util.Calendar.YEAR) + "-" + hoy.get(java.util.Calendar.DAY_OF_YEAR);
        boolean cambio = false;
        for (int i = 0; i < a.length(); i++) {
            JSONObject r = a.optJSONObject(i);
            if (r == null || clave.equals(r.optString("hecho"))) continue;
            // ¿Le tocaba en los últimos 10 minutos? (la alarma puede llegar un poco tarde)
            long t = proxima(r, ahora - 10 * MIN);
            if (t < 0 || t > ahora + 30_000L) continue;
            try {
                JSONObject x = new JSONObject();
                x.put("id", r.optInt("id"));
                x.put("codigo", r.optString("codigo")); x.put("parada", r.optString("parada"));
                x.put("linea", r.optString("linea")); x.put("destino", r.optString("destino"));
                x.put("antes", r.optInt("antes", 5)); x.put("sonido", r.optString("sonido", "sistema"));
                x.put("at", ahora); x.put("revisar", ahora); x.put("rep", true); x.put("creado", ahora);
                if (r.has("viaje")) x.put("viaje", r.optJSONObject("viaje"));
                poner(c, x);
                r.put("hecho", clave);
                cambio = true;
            } catch (Exception ignored) { }
        }
        if (cambio) c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("repetidos", a.toString()).apply();
        programarRepetidos(c);
    }

    @Override
    public void onReceive(final Context context, Intent intent) {
        final Context c = context.getApplicationContext();
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) { programar(c); programarRepetidos(c); return; }
        if (ACCION_REP.equals(intent.getAction())) { dispararRepetidos(c); return; }
        if (ACCION_QUITAR.equals(intent.getAction())) { quitarDesdeNotificacion(c, intent.getIntExtra("id", 0)); return; }
        final PendingResult pr = goAsync();
        new Thread(new Runnable() {
            public void run() {
                try { revisar(c); } catch (Exception ignored) { }
                finally {
                    programar(c);
                    // En los últimos minutos, como el modo sensor: servicio en primer plano (pantalla apagada e isla)
                    try { AvisoService.siHaceFalta(c); } catch (Exception ignored) { }
                    pr.finish();
                }
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
    static synchronized void revisar(Context c) {
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
                Integer seg = null;
                try {
                    if (!tokenProbado) { tokenProbado = true; token = TussamTiempos.token(cred); }
                    if (token != null) seg = segundos(TussamTiempos.tiempos(x.optString("codigo"), token), x.optString("linea"), x.optString("destino"));
                } catch (Exception ignored) { /* sin red o TUSSAM no contesta */ }
                if (x.optBoolean("avisado", false)) {
                    // Ya avisado: la cuenta atrás (y la isla) siguen hasta que el autobús pasa
                    int ult = x.optInt("segUlt", -1);
                    if (seg != null && ult >= 0 && ult <= 90 && seg >= 240) { quitarCuenta(c, x.optInt("id")); continue; }   // pasó: sale el siguiente
                    if (seg != null) { x.put("llega", ahora + seg * 1000L); x.put("segUlt", seg); }
                    if (ahora > x.optLong("hasta", 0) || ahora > x.optLong("llega", ahora) + 2 * MIN) { quitarCuenta(c, x.optInt("id")); continue; }
                    if (ViajeAutoService.absorbe(c, x.optString("codigo"))) quitarCuenta(c, x.optInt("id"));
                    else mostrarCuenta(c, x, 0, x.optLong("llega", ahora));
                    x.put("at", ahora);
                    x.put("revisar", ahora + 20_000L);
                    quedan.put(x);
                    continue;
                }
                if (seg != null) {
                    // Minutos como los enseña la app (2:59 → «2 min»). Se avisa en cuanto la app pondría tus
                    // minutos: aviso a 2 min = en cuanto le falten menos de 3:00, no cuando ya va por 1 y pico.
                    int min = seg / 60;
                    if (min <= antes) {
                        avisar(c, x, min);
                        x.put("avisado", true);
                        x.put("llega", ahora + seg * 1000L);
                        x.put("segUlt", seg);
                        x.put("hasta", ahora + Math.min(15 * MIN, seg * 1000L + 3 * MIN));
                        x.put("at", ahora);
                        x.put("revisar", ahora + 20_000L);
                        if (!ViajeAutoService.absorbe(c, x.optString("codigo"))) mostrarCuenta(c, x, min, ahora + seg * 1000L);
                        quedan.put(x);
                        continue;
                    }
                    cuentaAtras(c, x, seg);
                    long nuevo = ahora + (seg - (antes * 60 + 59)) * 1000L;   // cuando pase a «tus minutos»
                    x.put("at", nuevo);
                    // TUSSAM da segundos: se avisa justo al llegar a tus minutos. En los últimos minutos
                    // se pregunta cada 20 s (el servicio en primer plano mantiene esto con la pantalla apagada).
                    int falta = seg - (antes * 60 + 59);
                    long paso = falta <= 2 * 60 ? 10_000L : falta <= 6 * 60 ? 15_000L : 40_000L;
                    x.put("revisar", Math.min(nuevo, ahora + paso));
                    quedan.put(x);
                } else if (x.optBoolean("rep", false)) {
                    // Aviso que se repite: sin datos no se avisa a ciegas; se reintenta durante 20 minutos
                    if (ahora - x.optLong("creado", ahora) > 20 * MIN) { quitarCuenta(c, x.optInt("id")); continue; }
                    x.put("revisar", ahora + 90_000L);
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
        // Si estás en la parada con el Pasaporte, su notificación enseña también este aviso (una sola, no dos)
        ViajeAutoService.refrescar(c);
    }

    /** Segundos que le faltan al autobús de esa línea y destino (si el destino no cuadra, el primero de la línea). */
    static Integer segundos(List<TussamTiempos.Llegada> l, String linea, String destino) {
        String nl = normLinea(linea), nd = normTexto(destino);
        Integer mejorDestino = null, mejorLinea = null;
        for (TussamTiempos.Llegada x : l) {
            if (!normLinea(x.linea).equals(nl)) continue;
            if (mejorLinea == null || x.segundos < mejorLinea) mejorLinea = x.segundos;
            String d = normTexto(x.destino);
            if (!nd.isEmpty() && (d.equals(nd) || d.contains(nd) || nd.contains(d)) && (mejorDestino == null || x.segundos < mejorDestino)) mejorDestino = x.segundos;
        }
        return mejorDestino != null ? mejorDestino : mejorLinea;
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
    static void cuentaAtras(Context c, JSONObject x, int seg) {
        long llega = System.currentTimeMillis() + seg * 1000L;
        int min = seg / 60;
        // Para la barra: a qué hora llega y desde cuánto se empezó a contar (también la notificación del Pasaporte)
        try {
            x.put("llega", llega);
            x.put("segUlt", seg);   // el último dato de TUSSAM: los minutos del título salen de aquí, como en la app
            if (x.optInt("seg0", -1) < seg) x.put("seg0", seg);
            if (x.optInt("min0", -1) < (seg + 59) / 60) x.put("min0", (seg + 59) / 60);
        } catch (Exception ignored) { }
        // Pasaporte sin abrir la app: cuando se empieza a contar, BusSev sigue el viaje solo en esa parada
        // (si diste la ubicación «todo el tiempo»). Si estás lejos, se para en un minuto y se reintenta luego.
        long probado = x.optLong("autoProbado", 0), ahoraMs = System.currentTimeMillis();
        if (x.has("viaje") && ahoraMs - probado > 4 * MIN && x.optInt("autoVeces", 0) < 4
                && ViajeAutoService.empezarDesdeAviso(c, x.optJSONObject("viaje"))) {
            try { x.put("autoProbado", ahoraMs); x.put("autoVeces", x.optInt("autoVeces", 0) + 1); } catch (Exception ignored) { }
        }
        if (ViajeAutoService.absorbe(c, x.optString("codigo"))) { quitarCuenta(c, x.optInt("id")); return; }
        mostrarCuenta(c, x, min, llega);
    }
    static void mostrarCuenta(Context c, JSONObject x, int min, long llega) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        Notification n = construirCuenta(c, x, min, llega);
        if (n != null) try { nm.notify(idCuenta(x.optInt("id")), n); } catch (SecurityException ignored) { }
    }
    /* La cuenta atrás del aviso (la usa también AvisoService como notificación del servicio en primer plano) */
    private static final java.util.Map<Integer, Integer> PROG = new java.util.HashMap<>();
    static int ultimoProg(int id) { Integer p = PROG.get(id); return p == null ? -1 : p; }
    static Notification construirCuenta(Context c, JSONObject x, int min, long llega) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return null;
        // Android 16: canal de importancia normal y en silencio, como el del modo sensor (el de importancia baja no sale en la isla)
        final String canalCuenta = Build.VERSION.SDK_INT >= 36 ? CANAL_CUENTA_16 : CANAL_CUENTA;
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(canalCuenta) == null) {
            NotificationChannel ch = new NotificationChannel(canalCuenta, "Cuenta atrás de tus avisos", Build.VERSION.SDK_INT >= 36 ? NotificationManager.IMPORTANCE_DEFAULT : NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Los minutos que le faltan al autobús de tu aviso de llegada, en la barra de arriba.");
            ch.setSound(null, null);
            ch.enableVibration(false);
            nm.createNotificationChannel(ch);
        }
        int id = x.optInt("id");
        String linea = x.optString("linea");
        // Lo que falta, desde la hora de llegada (se repinta cada 20 s): igual que los minutos de la app
        int seg = (int) Math.max(0, (llega - System.currentTimeMillis()) / 1000L);
        min = seg / 60;
        // Minutos del título: los del último dato de TUSSAM, igual que en la app (y el aviso salta a la vez)
        int segT = x.has("segUlt") ? Math.max(0, x.optInt("segUlt")) : seg;
        min = segT / 60;
        String titulo = "Línea " + linea + (segT < 60 ? " · está llegando" : " · " + min + " min");
        String p1 = x.optBoolean("avisado", false) ? "Avisado" : "Aviso a " + x.optInt("antes", 5) + " min";
        // La barra cubre al menos los últimos 10 min: si pones el aviso con el autobús ya cerca, también se mueve
        int seg0 = Math.max(Math.max(x.optInt("seg0", seg), 600), Math.max(seg, 1));
        int prog = Math.max(0, Math.min(100, Math.round(100f * (seg0 - seg) / seg0)));
        // TUSSAM corrige a saltos: la barra solo avanza (no da pasos atrás si el bus «retrocede» un poco)
        Integer antesProg = PROG.get(id);
        if (antesProg != null && antesProg > prog && antesProg - prog < 25) prog = antesProg;
        PROG.put(id, prog);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, canalCuenta) : new Notification.Builder(c);
        b.setSmallIcon(icono(c))
                .setContentTitle(titulo)
                .setContentText(x.optString("parada") + " · " + p1)
                .setOngoing(true).setOnlyAlertOnce(true)
                .setCategory(Notification.CATEGORY_PROGRESS)
                .setContentIntent(abrirParada(c, x.optString("codigo"), idCuenta(id)));
        b.addAction(0, "Quitar aviso", piQuitar(c, id));   // el modo sensor también lleva botón y sale en la isla
        if (Build.VERSION.SDK_INT >= 21) b.setColor(0xFFD41C2B);
        disenoAviso(c, b, titulo, x.optString("parada"), p1, x.optBoolean("avisado", false), null, 0, prog, llega, min);
        SensorService.promocionar(b, segT < 60 ? "Llega" : min + " min");
        return b.build();
    }

    /* Diseño del aviso (el mismo con o sin Pasaporte): línea y minutos con cuenta atrás, parada, etiquetas
       («Aviso a 2 min» / «Avisado» y «Estás en la parada»…) y la barra del autobús acercándose.
       p2Color: 0 verde, 1 ámbar, 2 rojo. */
    static void disenoAviso(Context c, Notification.Builder b, String titulo, String parada, String p1, boolean p1Ambar,
                            String p2, int p2Color, int prog, long llega, int falta) {
        long ahora = System.currentTimeMillis();
        // Android 16 (HyperOS 3…): notificación estándar con la barra de progreso nueva (autobús que avanza y tu
        // parada al final). Así puede salir en la isla dinámica / chip de arriba, cosa que una vista propia no deja.
        // Android 16 (HyperOS 3): exactamente como la cuenta atrás de antes (sin estilo ni barra), que es la que
        // sale en la isla dinámica de Xiaomi; con la barra de progreso nueva tampoco salía.
        // Aquí se copia lo que hace el modo sensor (que sí sale en la isla): título y texto normales, la parada como
        // subtexto y barra de progreso normal; sin cronómetro, sin estilo ni vista propia.
        if (Build.VERSION.SDK_INT >= 36) {
            b.setContentTitle(titulo);
            b.setContentText(p1 + (p2 != null ? " · " + p2 : ""));   // HyperOS no respeta colores en el texto
            b.setSubText(parada);
            b.setShowWhen(false);   // sin contador ni hora
            // El diseño nuevo en versión nativa (la vista propia no puede salir en la isla): barra roja con el
            // autobús avanzando y tu parada al final. Si el móvil no la tiene, la barra normal.
            if (!estiloProgreso(c, b, prog)) b.setProgress(100, Math.max(0, Math.min(100, prog)), false);
            return;
        }
        if (Build.VERSION.SDK_INT < 24) { b.setProgress(100, prog, false); return; }
        long base = SystemClock.elapsedRealtime() + Math.max(0, llega - ahora);
        RemoteViews corta = new RemoteViews(c.getPackageName(), R.layout.bussev_notif_aviso_corta);
        RemoteViews larga = new RemoteViews(c.getPackageName(), R.layout.bussev_notif_aviso);
        for (RemoteViews v : new RemoteViews[]{corta, larga}) {
            v.setTextViewText(R.id.n_titulo, titulo);
            if (falta >= 1) {
                v.setViewVisibility(R.id.n_crono, View.VISIBLE);
                v.setChronometer(R.id.n_crono, base, null, true);
                v.setChronometerCountDown(R.id.n_crono, true);
            } else v.setViewVisibility(R.id.n_crono, View.GONE);
        }
        corta.setTextViewText(R.id.n_resumen, p1 + (p2 != null ? " · " + p2 : ""));
        larga.setTextViewText(R.id.n_parada, parada);
        pastilla(larga, p1Ambar ? R.id.n_p1_ambar : R.id.n_p1_verde, p1, new int[]{R.id.n_p1_verde, R.id.n_p1_ambar});
        int[] p2ids = {R.id.n_p2_verde, R.id.n_p2_ambar, R.id.n_p2_rojo};
        pastilla(larga, p2 == null ? 0 : p2ids[Math.max(0, Math.min(2, p2Color))], p2 == null ? "" : p2, p2ids);
        larga.setProgressBar(R.id.n_barra, 100, prog, false);
        b.setStyle(new Notification.DecoratedCustomViewStyle());
        b.setCustomContentView(corta);
        b.setCustomBigContentView(larga);
    }
    /* Notification.ProgressStyle (Android 16). Se usa por reflexión porque la app compila con un SDK anterior. */
    static boolean estiloProgreso(Context c, Notification.Builder b, int prog) {
        try {
            Class<?> ps = Class.forName("android.app.Notification$ProgressStyle");
            Class<?> seg = Class.forName("android.app.Notification$ProgressStyle$Segment");
            Object st = ps.getConstructor().newInstance();
            int p = Math.max(0, Math.min(100, prog));
            // Lo recorrido en rojo y lo que falta en gris (antes todo era rojo y no se distinguía)
            if (p > 0) {
                Object s = seg.getConstructor(int.class).newInstance(p);
                seg.getMethod("setColor", int.class).invoke(s, 0xFFD41C2B);
                ps.getMethod("addProgressSegment", seg).invoke(st, s);
            }
            if (p < 100) {
                Object s = seg.getConstructor(int.class).newInstance(100 - p);
                seg.getMethod("setColor", int.class).invoke(s, 0xFF5A5A5A);
                ps.getMethod("addProgressSegment", seg).invoke(st, s);
            }
            ps.getMethod("setProgress", int.class).invoke(st, p);
            ps.getMethod("setStyledByProgress", boolean.class).invoke(st, false);
            ps.getMethod("setProgressTrackerIcon", android.graphics.drawable.Icon.class)
                    .invoke(st, android.graphics.drawable.Icon.createWithResource(c, R.drawable.n_bus));
            ps.getMethod("setProgressEndIcon", android.graphics.drawable.Icon.class)
                    .invoke(st, android.graphics.drawable.Icon.createWithResource(c, R.drawable.n_parada));
            b.setStyle((Notification.Style) st);
            return true;
        } catch (Throwable t) { return false; }
    }
    private static void pastilla(RemoteViews v, int visible, String texto, int[] todas) {
        for (int i : todas) v.setViewVisibility(i, i == visible ? View.VISIBLE : View.GONE);
        if (visible != 0) v.setTextViewText(visible, texto);
    }

    /* Con el móvil en silencio o en vibración, Android no vibra con las notificaciones normales:
       el aviso de llegada vibra igualmente (como una alarma). */
    static void vibrarFuerte(Context c) {
        try {
            AudioManager am = (AudioManager) c.getSystemService(Context.AUDIO_SERVICE);
            if (am != null && am.getRingerMode() == AudioManager.RINGER_MODE_NORMAL) return;   // ya vibra el canal
            long[] patron = {0, 500, 250, 500, 250, 900};
            if (Build.VERSION.SDK_INT >= 33) {
                VibratorManager vm = (VibratorManager) c.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                Vibrator v = vm != null ? vm.getDefaultVibrator() : null;
                if (v != null) v.vibrate(VibrationEffect.createWaveform(patron, -1), VibrationAttributes.createForUsage(VibrationAttributes.USAGE_ALARM));
            } else if (Build.VERSION.SDK_INT >= 26) {
                Vibrator v = (Vibrator) c.getSystemService(Context.VIBRATOR_SERVICE);
                if (v != null) v.vibrate(VibrationEffect.createWaveform(patron, -1),
                        new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
            } else {
                Vibrator v = (Vibrator) c.getSystemService(Context.VIBRATOR_SERVICE);
                if (v != null) v.vibrate(patron, -1);
            }
        } catch (Exception ignored) { }
    }

    /* «Me he subido»: abre BusSev en la parada y empieza a contar el viaje en esa línea */
    static PendingIntent piSubido(Context c, String codigo, String linea, int notif) { return piSubido(c, codigo, linea, notif, 0); }
    /* aviso ≠ 0: además se quita ese aviso (ya vas en el autobús, no tiene que sonar) */
    static PendingIntent piSubido(Context c, String codigo, String linea, int notif, int aviso) {
        Intent open = new Intent(c, MainActivity.class).putExtra("bussev_parada", codigo).putExtra("bussev_subido", linea)
                .putExtra("bussev_cancelar", notif).putExtra("bussev_aviso", aviso)
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
        // Se quita sola cuando el autobús ya ha pasado (no se queda puesta todo el viaje)
        if (Build.VERSION.SDK_INT >= 26) b.setTimeoutAfter((long) Math.max(0, min) * MIN + 4 * MIN);
        // Para el Pasaporte: Android apunta a qué hora llega ese bus a esa parada (lo usa «Me he subido»)
        ViajeAutoService.apuntarPrevisto(c, x.optString("codigo"), x.optString("linea"), System.currentTimeMillis() + (long) Math.max(0, min) * MIN);
        // La notificación única del Pasaporte (si estás en la parada) pasa a «Avisado» hasta que llega
        try {
            long ahora = System.currentTimeMillis();
            JSONObject av = new JSONObject().put("id", id).put("codigo", x.optString("codigo")).put("linea", x.optString("linea"))
                    .put("antes", x.optInt("antes", 5)).put("llega", ahora + (long) Math.max(0, min) * MIN)
                    .put("min0", Math.max(x.optInt("min0", min), Math.max(min, 1))).put("cuando", ahora);
            c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("avisado", av.toString()).apply();
        } catch (Exception ignored) { }
        try { nm.notify(id, b.build()); } catch (SecurityException ignored) { /* sin permiso de notificaciones */ }
        vibrarFuerte(c);
    }

    /* ---------- Notificación única con el Pasaporte ---------- */

    /** El aviso que se está contando en esa parada (el que llega antes), o null. */
    static JSONObject avisoEn(Context c, String codigo) {
        if (codigo == null || codigo.isEmpty()) return null;
        long ahora = System.currentTimeMillis();
        JSONArray a = leer(c);
        JSONObject mejor = null;
        for (int i = 0; i < a.length(); i++) {
            JSONObject x = a.optJSONObject(i);
            if (x == null || !codigo.equals(x.optString("codigo")) || !x.has("llega") || x.optBoolean("avisado", false)) continue;
            if (x.optLong("llega") < ahora - MIN) continue;
            if (mejor == null || x.optLong("llega") < mejor.optLong("llega")) mejor = x;
        }
        return mejor;
    }
    /** El aviso que ya ha sonado en esa parada (para «Avisado»), mientras el autobús no haya pasado. */
    static JSONObject avisadoEn(Context c, String codigo) {
        try {
            String s = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("avisado", null);
            if (s == null || codigo == null) return null;
            JSONObject o = new JSONObject(s);
            long ahora = System.currentTimeMillis();
            if (!codigo.equals(o.optString("codigo")) || ahora - o.optLong("cuando") > 15 * MIN || ahora > o.optLong("llega") + 3 * MIN) return null;
            return o;
        } catch (Exception e) { return null; }
    }
    /** Cuando el Pasaporte deja de enseñar el aviso (te subes, pulsas «Parar»…), vuelve la cuenta atrás de siempre. */
    static void reponerCuentas(Context c, String codigo) {
        long ahora = System.currentTimeMillis();
        JSONArray a = leer(c);
        for (int i = 0; i < a.length(); i++) {
            JSONObject x = a.optJSONObject(i);
            if (x == null || !x.has("llega") || (codigo != null && !codigo.equals(x.optString("codigo")))) continue;
            long llega = x.optLong("llega");
            if (llega <= ahora) continue;
            mostrarCuenta(c, x, (int) Math.ceil((llega - ahora) / (double) MIN), llega);
        }
    }
    /** «Quitar aviso» desde la notificación */
    static PendingIntent piQuitar(Context c, int id) {
        Intent i = new Intent(c, LlegadaReceiver.class).setAction(ACCION_QUITAR).putExtra("id", id);
        int f = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) f |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getBroadcast(c, 0x10000000 | (id & 0x0FFFFFFF), i, f);
    }
    static void quitarDesdeNotificacion(Context c, int id) {
        quitar(c, id);
        SharedPreferences sp = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        SharedPreferences.Editor ed = sp.edit();
        try {
            String s = sp.getString("avisado", null);
            if (s != null && new JSONObject(s).optInt("id") == id) ed.remove("avisado");
            // La app (al abrirla) también lo quita de su lista
            JSONArray q = new JSONArray(sp.getString("quitadosNotif", "[]"));
            q.put(id);
            ed.putString("quitadosNotif", q.toString());
        } catch (Exception ignored) { }
        ed.apply();
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) { nm.cancel(id); nm.cancel(idCuenta(id)); }
        AvisoService.refrescar(c);
        ViajePlugin.emitir("bussevAvisoQuitado", String.valueOf(id));
        ViajeAutoService.refrescar(c);
    }
    /** Los avisos quitados desde la notificación, para que la app los borre de su lista (y se olvidan). */
    static synchronized JSONArray recogerQuitados(Context c) {
        SharedPreferences sp = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        JSONArray q;
        try { q = new JSONArray(sp.getString("quitadosNotif", "[]")); } catch (Exception e) { q = new JSONArray(); }
        sp.edit().remove("quitadosNotif").apply();
        return q;
    }

    static int icono(Context c) {
        int r = c.getResources().getIdentifier("ic_stat_bus", "drawable", c.getPackageName());
        return r != 0 ? r : c.getApplicationInfo().icon;
    }
}
