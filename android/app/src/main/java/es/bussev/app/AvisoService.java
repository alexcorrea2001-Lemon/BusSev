package es.bussev.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Aviso de llegada con la pantalla apagada: en los últimos minutos (desde 16 min antes de avisar) el aviso
 * va como servicio en primer plano, igual que el modo sensor. Así Android (y HyperOS) no lo duerme ni le
 * corta la red, pregunta a TUSSAM cada 20 s y la cuenta atrás puede salir en la isla dinámica.
 * Se para solo cuando ya no queda ningún aviso cerca.
 */
public class AvisoService extends Service {
    static final int ID_OCULTA = 7701;
    static final String CANAL_OCULTO = "bussev_aviso_oculto";
    static final long VENTANA = 16 * 60_000L;
    static final long MAX_MS = 45 * 60_000L;

    private final Handler h = new Handler(Looper.getMainLooper());
    private PowerManager.WakeLock wl;
    private int idActual = 0;          // id de la notificación que mantiene el servicio en primer plano
    private long inicio = 0;
    private volatile boolean terminado = false;
    static volatile boolean activo = false;

    /** Si está en marcha, que repase ya (p. ej. al pulsar «Quitar aviso»: que no se quede su cuenta atrás). */
    static void refrescar(Context c) {
        if (!activo) return;
        try { c.startService(new Intent(c, AvisoService.class)); } catch (Exception ignored) { }
    }

    /** Arranca el servicio si hay algún aviso en sus últimos minutos. Devuelve si lo ha intentado. */
    static boolean siHaceFalta(Context c) {
        if (primero(c) == null) return false;
        try {
            Intent i = new Intent(c, AvisoService.class);
            if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i); else c.startService(i);
            return true;
        } catch (Exception e) { return false; }   // Android no deja ahora: sigue con las alarmas de siempre
    }

    /** El aviso más próximo dentro de la ventana, o null. */
    static JSONObject primero(Context c) {
        JSONArray a = LlegadaReceiver.leer(c);
        long ahora = System.currentTimeMillis();
        JSONObject mejor = null;
        for (int i = 0; i < a.length(); i++) {
            JSONObject x = a.optJSONObject(i);
            if (x == null) continue;
            long at = x.optLong("at");
            if (at - ahora > VENTANA || ahora > at + 30 * 60_000L) continue;
            if (mejor == null || at < mejor.optLong("at")) mejor = x;
        }
        return mejor;
    }

    @Override public IBinder onBind(Intent i) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        activo = true;
        if (inicio == 0) inicio = System.currentTimeMillis();
        primerPlano();
        try {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            if (wl == null && pm != null) { wl = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "bussev:aviso"); wl.setReferenceCounted(false); }
            if (wl != null) wl.acquire(MAX_MS + 60_000L);
        } catch (Exception ignored) { }
        terminado = false;
        h.removeCallbacksAndMessages(null);
        h.post(vuelta);
        return START_STICKY;
    }

    private final Runnable vuelta = new Runnable() {
        public void run() {
            if (terminado) return;
            new Thread(new Runnable() {
                public void run() {
                    try { LlegadaReceiver.revisar(AvisoService.this); } catch (Exception ignored) { }
                    try { LlegadaReceiver.programar(AvisoService.this); } catch (Exception ignored) { }
                    h.post(new Runnable() { public void run() { despues(); } });
                }
            }).start();
        }
    };

    private void despues() {
        if (terminado) return;
        if (primero(this) == null || System.currentTimeMillis() - inicio > MAX_MS) { parar(); return; }
        primerPlano();
        h.removeCallbacks(vuelta);
        h.postDelayed(vuelta, 20_000L);
    }

    /* Mantiene el servicio en primer plano con la cuenta atrás del aviso más próximo (la misma notificación,
       no una más). Si esa cuenta la enseña el Pasaporte, con una notificación escondida. */
    private void primerPlano() {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        JSONObject x = primero(this);
        int id;
        Notification n;
        if (x != null && !ViajeAutoService.absorbe(this, x.optString("codigo"))) {
            long ahora = System.currentTimeMillis();
            long llega = x.optLong("llega", 0);
            if (llega < ahora) llega = x.optLong("at", ahora) + (long) x.optInt("antes", 5) * 60_000L;
            int min = (int) Math.max(0, Math.ceil((llega - ahora) / 60_000.0));
            id = LlegadaReceiver.idCuenta(x.optInt("id"));
            n = LlegadaReceiver.construirCuenta(this, x, min, llega);
        } else {
            id = ID_OCULTA;
            n = oculta();
        }
        if (n == null) return;
        try {
            if (Build.VERSION.SDK_INT >= 34) startForeground(id, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
            else startForeground(id, n);
        } catch (Exception e) { parar(); return; }
        if (idActual != 0 && idActual != id && nm != null) nm.cancel(idActual);   // la anterior ya no es la del servicio
        idActual = id;
    }

    private Notification oculta() {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm != null && nm.getNotificationChannel(CANAL_OCULTO) == null) {
            NotificationChannel s = new NotificationChannel(CANAL_OCULTO, "Aviso de llegada: vigilando", NotificationManager.IMPORTANCE_MIN);
            s.setDescription("Mientras el Pasaporte ya enseña tu aviso. Va escondida al final de las notificaciones.");
            s.setSound(null, null);
            s.enableVibration(false);
            s.setShowBadge(false);
            s.setLockscreenVisibility(Notification.VISIBILITY_SECRET);
            nm.createNotificationChannel(s);
        }
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CANAL_OCULTO) : new Notification.Builder(this);
        b.setSmallIcon(LlegadaReceiver.icono(this))
                .setContentTitle("Aviso de llegada")
                .setContentText("Vigilando tu autobús")
                .setOngoing(true).setShowWhen(false)
                .setCategory(Notification.CATEGORY_SERVICE);
        if (Build.VERSION.SDK_INT < 26) b.setPriority(Notification.PRIORITY_MIN);
        if (Build.VERSION.SDK_INT >= 21) b.setVisibility(Notification.VISIBILITY_SECRET);
        return b.build();
    }

    private void parar() {
        terminado = true;
        h.removeCallbacksAndMessages(null);
        try { if (wl != null && wl.isHeld()) wl.release(); } catch (Exception ignored) { }
        // Si el último aviso ya saltó, su cuenta atrás no debe quedarse puesta
        boolean sigue = false;
        JSONArray a = LlegadaReceiver.leer(this);
        for (int i = 0; i < a.length(); i++) { JSONObject x = a.optJSONObject(i); if (x != null && LlegadaReceiver.idCuenta(x.optInt("id")) == idActual) sigue = true; }
        if (Build.VERSION.SDK_INT >= 24) stopForeground(sigue ? STOP_FOREGROUND_DETACH : STOP_FOREGROUND_REMOVE); else stopForeground(!sigue);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        activo = false;
        terminado = true;
        h.removeCallbacksAndMessages(null);
        try { if (wl != null && wl.isHeld()) wl.release(); } catch (Exception ignored) { }
        super.onDestroy();
    }
}
