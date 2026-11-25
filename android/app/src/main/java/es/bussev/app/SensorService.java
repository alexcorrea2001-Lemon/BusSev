package es.bussev.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;

import org.json.JSONObject;

import java.util.List;

/**
 * Modo sensor: te guardas el móvil en el bolsillo y vibra según se acerca tu autobús, sin mirar la pantalla.
 *
 * No hace nada mientras el bus está lejos. Cuando le faltan 5 minutos empieza, con un aviso por minuto que
 * va subiendo: 5 min un toque suave · 4 min dos toques · 3 min tres toques · 2 min un toque largo ·
 * llegando una vibración muy fuerte (y se apaga solo).
 *
 * Pregunta a TUSSAM cada 20 s (cada 45 s si el bus aún está lejos). Va como servicio con una notificación
 * fija (con «Parar»), que en Android 16 sale también como chip en la barra de arriba con los minutos.
 * Se para solo al llegar el bus o a los 40 minutos.
 */
public class SensorService extends Service {
    static final String ACCION_PARAR = "es.bussev.app.SENSOR_PARAR";
    static final String CANAL = "bussev_sensor";
    static final int ID_FIJA = 7501;
    static final long MAX_MS = 40 * 60_000L;

    private final Handler h = new Handler(Looper.getMainLooper());
    private PowerManager.WakeLock wl;
    private String codigo = "", linea = "", destino = "", parada = "";
    private int ultimoNivel = 99;      // último aviso dado (5, 4, 3, 2, 0); 99 = ninguno
    private int minutos = -1, minMax = 5, minAnterior = -1;
    private long inicio = 0;
    private boolean terminado = false;

    static String estado(Context c) {
        return c.getSharedPreferences(LlegadaReceiver.PREFS, Context.MODE_PRIVATE).getString("sensor", null);
    }

    @Override public IBinder onBind(Intent i) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACCION_PARAR.equals(intent.getAction())) { parar(); return START_NOT_STICKY; }
        String datos = intent != null ? intent.getStringExtra("sensor") : null;
        if (datos == null) datos = estado(this);
        if (datos == null) { stopSelf(); return START_NOT_STICKY; }
        try {
            JSONObject v = new JSONObject(datos);
            codigo = v.optString("codigo"); linea = v.optString("linea"); destino = v.optString("destino"); parada = v.optString("parada");
            inicio = v.optLong("inicio", System.currentTimeMillis());
            getSharedPreferences(LlegadaReceiver.PREFS, MODE_PRIVATE).edit().putString("sensor", v.put("inicio", inicio).toString()).apply();
        } catch (Exception e) { stopSelf(); return START_NOT_STICKY; }
        if (codigo.isEmpty() || linea.isEmpty()) { parar(); return START_NOT_STICKY; }

        canal();
        Notification n = fija("Mirando dónde va…", null);
        if (Build.VERSION.SDK_INT >= 34) startForeground(ID_FIJA, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        else startForeground(ID_FIJA, n);
        try {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            if (wl == null && pm != null) { wl = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "bussev:sensor"); wl.setReferenceCounted(false); }
            if (wl != null) wl.acquire(MAX_MS + 60_000L);
        } catch (Exception ignored) { }
        terminado = false; ultimoNivel = 99; minAnterior = -1;
        vibrar(new long[]{0, 90, 120, 90}, new int[]{0, 140, 0, 140});     // confirmación: dos toquecitos («ya está activo»)
        h.removeCallbacksAndMessages(null);
        h.post(revisar);
        h.postDelayed(new Runnable() { public void run() { parar(); } }, Math.max(60_000L, MAX_MS - (System.currentTimeMillis() - inicio)));
        return START_REDELIVER_INTENT;
    }

    private final Runnable revisar = new Runnable() {
        public void run() {
            if (terminado) return;
            new Thread(new Runnable() {
                public void run() {
                    int m = -1;
                    try {
                        List<TussamTiempos.Llegada> l = TussamTiempos.tiempos(codigo, TussamTiempos.token(false));
                        TussamTiempos.Llegada mejor = null;
                        for (TussamTiempos.Llegada x : l) {
                            if (!mismaLinea(x.linea, linea)) continue;
                            if (!destino.isEmpty() && x.destino != null && !x.destino.trim().equalsIgnoreCase(destino.trim())) { if (mejor == null) mejor = x; continue; }
                            mejor = x; break;
                        }
                        if (mejor != null) m = mejor.minutos;
                    } catch (Exception ignored) { }
                    final int min = m;
                    h.post(new Runnable() { public void run() { nuevoTiempo(min); } });
                }
            }).start();
        }
    };

    static boolean mismaLinea(String a, String b) {
        if (a == null || b == null) return false;
        return a.replaceFirst("^0+(?=\\d)", "").equalsIgnoreCase(b.replaceFirst("^0+(?=\\d)", ""));
    }

    private void nuevoTiempo(int m) {
        if (terminado) return;
        if (m >= 0) {
            // El bus ya ha pasado (iba a 0–1 min y ahora sale el siguiente, mucho más lejos)
            if (minAnterior >= 0 && minAnterior <= 1 && m >= 4) { llegado(); return; }
            minAnterior = m; minutos = m;
            if (m <= 2) ViajeAutoService.apuntarPrevisto(this, codigo, linea, System.currentTimeMillis() + (long) m * 60_000L);
            if (m > minMax) minMax = m;
            int nivel = m <= 0 ? 0 : m <= 1 ? 0 : m;     // en el último minuto ya es «llegando»
            if (nivel <= 5 && nivel < ultimoNivel) {
                ultimoNivel = nivel;
                avisarNivel(nivel);
                if (nivel == 0) { llegado(); return; }
            }
            actualizar(m <= 1 ? "Llegando" : m + " min", m <= 1 ? "¡Llegando!" : m > 5 ? "Vibraré cuando falten 5 minutos" : "Vibra cada minuto hasta que llegue");
        } else {
            actualizar(minutos >= 0 ? minutos + " min" : "…", "Sin datos de TUSSAM ahora mismo; lo vuelvo a intentar");
        }
        h.removeCallbacks(revisar);
        h.postDelayed(revisar, minutos > 8 ? 45_000L : 20_000L);
    }

    /* Patrones: amplitudes de 1 a 255 (los móviles que no las distinguen vibran igual de fuerte) */
    private void avisarNivel(int n) {
        switch (n) {
            case 5: vibrar(new long[]{0, 120}, new int[]{0, 70}); break;                                  // un toque suave
            case 4: vibrar(new long[]{0, 120, 160, 120}, new int[]{0, 110, 0, 110}); break;                // dos toques
            case 3: vibrar(new long[]{0, 130, 140, 130, 140, 130}, new int[]{0, 150, 0, 150, 0, 150}); break; // tres toques
            case 2: vibrar(new long[]{0, 650}, new int[]{0, 200}); break;                                   // un toque largo
            default: vibrar(new long[]{0, 1400, 180, 900}, new int[]{0, 255, 0, 255}); break;              // muy fuerte
        }
    }

    private void llegado() {
        terminado = true;
        ViajeAutoService.apuntarPrevisto(this, codigo, linea, System.currentTimeMillis());
        actualizar("Llegando", "Tu autobús está llegando");
        h.removeCallbacksAndMessages(null);
        h.postDelayed(new Runnable() { public void run() { parar(); } }, 90_000L);
    }

    private void vibrar(long[] t, int[] a) {
        try {
            Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (v == null) return;
            // Como alarma: así vibra aunque el móvil esté en silencio o en «no molestar» (que es justo cuando hace falta)
            AudioAttributes aa = new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build();
            if (Build.VERSION.SDK_INT >= 26) v.vibrate(v.hasAmplitudeControl() ? VibrationEffect.createWaveform(t, a, -1) : VibrationEffect.createWaveform(t, -1), aa);
            else v.vibrate(t, -1, aa);
        } catch (Exception ignored) { }
    }

    private void canal() {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT < 26 || nm == null || nm.getNotificationChannel(CANAL) != null) return;
        NotificationChannel ch = new NotificationChannel(CANAL, "Modo sensor", NotificationManager.IMPORTANCE_DEFAULT);
        ch.setDescription("Notificación fija mientras el móvil vibra según se acerca tu autobús.");
        ch.setSound(null, null);
        ch.enableVibration(false);
        nm.createNotificationChannel(ch);
    }

    private PendingIntent piParar() {
        Intent i = new Intent(this, SensorService.class).setAction(ACCION_PARAR);
        int f = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) f |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getService(this, 7503, i, f);
    }

    private Notification fija(String corto, String texto) {
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CANAL) : new Notification.Builder(this);
        String titulo = "Línea " + linea + (minutos < 0 ? " · buscándolo…" : minutos <= 1 ? " · está llegando" : " · " + minutos + " min");
        b.setSmallIcon(LlegadaReceiver.icono(this))
                .setContentTitle(titulo)
                .setContentText(texto != null ? texto : parada)
                .setOngoing(true).setOnlyAlertOnce(true)
                .setCategory(Notification.CATEGORY_PROGRESS)
                .setContentIntent(LlegadaReceiver.abrirParada(this, codigo, ID_FIJA))
                .addAction(0, "Parar", piParar());
        if (Build.VERSION.SDK_INT >= 21) b.setColor(0xFFD41C2B);
        // El mismo diseño que el aviso de llegada: etiquetas y barra con el autobús acercándose a tu parada
        String p1 = minutos < 0 ? "📳 Modo sensor" : minutos <= 1 ? "📳 Llegando" : minutos > 5 ? "📳 Vibro a 5 min" : "📳 Vibro cada minuto";
        boolean sinDatos = texto != null && texto.startsWith("Sin datos");
        int max = Math.max(minMax, 1);
        int prog = minutos < 0 ? 0 : Math.max(0, Math.min(100, Math.round(100f * (max - minutos) / max)));
        long llega = System.currentTimeMillis() + (long) Math.max(0, minutos) * 60_000L;
        LlegadaReceiver.disenoAviso(this, b, titulo, parada, p1, false, sinDatos ? "Sin datos de TUSSAM" : null, 1, prog, llega,
                minutos < 0 ? 0 : minutos);
        promocionar(b, corto);
        return b.build();
    }
    /* Android 16: «Live Update» → chip en la barra de estado con el texto corto (los minutos) */
    static void promocionar(Notification.Builder b, String corto) {
        Bundle e = new Bundle();
        e.putBoolean("android.requestPromotedOngoing", true);
        e.putCharSequence("android.shortCriticalText", corto);
        b.addExtras(e);
    }
    private void actualizar(String corto, String texto) {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        try { if (nm != null) nm.notify(ID_FIJA, fija(corto, texto)); } catch (SecurityException ignored) { }
    }

    private void parar() {
        terminado = true;
        h.removeCallbacksAndMessages(null);
        try { if (wl != null && wl.isHeld()) wl.release(); } catch (Exception ignored) { }
        getSharedPreferences(LlegadaReceiver.PREFS, MODE_PRIVATE).edit().remove("sensor").apply();
        if (Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_REMOVE); else stopForeground(true);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        h.removeCallbacksAndMessages(null);
        try { if (wl != null && wl.isHeld()) wl.release(); } catch (Exception ignored) { }
        super.onDestroy();
    }
}
