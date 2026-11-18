package es.bussev.app;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * «Avísame cuando tenga que bajarme».
 *
 * Mientras vas en el autobús, sigue tu posición con el GPS (también con la pantalla apagada: por eso va como
 * servicio con una notificación fija, como hacen los navegadores) y te avisa con vibración y sonido cuando
 * te acercas a tu parada: al pasar por la anterior o a unos 400 m. Se para solo al llegar, a las 3 horas,
 * o con el botón «Parar» de la notificación.
 */
public class BajadaService extends Service implements LocationListener {
    static final String ACCION_PARAR = "es.bussev.app.BAJADA_PARAR";
    static final String CANAL_VIAJE = "bussev_viaje";
    static final String CANAL_BAJAR = "bussev_bajar";
    static final int ID_FIJA = 7401, ID_BAJAR = 7402;
    static final float AVISO_M = 400f, LLEGADA_M = 70f, CERCA_PARADA_M = 120f;
    static final long MAX_MS = 3 * 3600_000L;

    private LocationManager lm;
    private final Handler h = new Handler(Looper.getMainLooper());
    private String linea = "", destino = "", codigoDestino = "";
    private double[][] pos = new double[0][];
    private String[] nombres = new String[0];
    private int actual = 0;            // última parada por la que ya ha pasado (posición en la lista)
    private boolean avisado = false, llegado = false;
    private long inicio = 0;

    static boolean activo(Context c) {
        return c.getSharedPreferences(LlegadaReceiver.PREFS, Context.MODE_PRIVATE).getString("bajada", null) != null;
    }
    static String estado(Context c) {
        return c.getSharedPreferences(LlegadaReceiver.PREFS, Context.MODE_PRIVATE).getString("bajada", null);
    }

    @Override public IBinder onBind(Intent i) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACCION_PARAR.equals(intent.getAction())) { parar(); return START_NOT_STICKY; }
        String datos = intent != null ? intent.getStringExtra("viaje") : null;
        if (datos == null) datos = estado(this);     // el sistema lo ha vuelto a arrancar
        if (datos == null) { stopSelf(); return START_NOT_STICKY; }
        try {
            JSONObject v = new JSONObject(datos);
            linea = v.optString("linea");
            JSONArray ps = v.getJSONArray("paradas");
            pos = new double[ps.length()][];
            nombres = new String[ps.length()];
            for (int i = 0; i < ps.length(); i++) {
                JSONObject p = ps.getJSONObject(i);
                pos[i] = new double[]{p.getDouble("lat"), p.getDouble("lon")};
                nombres[i] = p.optString("nombre", "Parada " + p.optString("codigo"));
                if (i == ps.length() - 1) codigoDestino = p.optString("codigo");
            }
            destino = nombres.length > 0 ? nombres[nombres.length - 1] : "";
            inicio = v.optLong("inicio", System.currentTimeMillis());
            actual = 0; avisado = false; llegado = false;
            getSharedPreferences(LlegadaReceiver.PREFS, MODE_PRIVATE).edit().putString("bajada", v.put("inicio", inicio).toString()).apply();
        } catch (Exception e) { stopSelf(); return START_NOT_STICKY; }
        if (pos.length < 2) { parar(); return START_NOT_STICKY; }

        canales();
        Notification n = fija("Buscando tu posición…");
        if (Build.VERSION.SDK_INT >= 29) startForeground(ID_FIJA, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
        else startForeground(ID_FIJA, n);

        if (Build.VERSION.SDK_INT >= 23 && checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED
                && checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) { parar(); return START_NOT_STICKY; }
        lm = (LocationManager) getSystemService(LOCATION_SERVICE);
        try {
            lm.removeUpdates(this);
            if (lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 4000, 0, this, Looper.getMainLooper());
            if (lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) lm.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 8000, 0, this, Looper.getMainLooper());
        } catch (SecurityException e) { parar(); return START_NOT_STICKY; }
        h.removeCallbacksAndMessages(null);
        h.postDelayed(new Runnable() { public void run() { parar(); } }, Math.max(60_000L, MAX_MS - (System.currentTimeMillis() - inicio)));
        return START_REDELIVER_INTENT;
    }

    static float dist(double[] a, double lat, double lon) {
        float[] r = new float[1];
        Location.distanceBetween(a[0], a[1], lat, lon, r);
        return r[0];
    }

    @Override
    public void onLocationChanged(Location l) {
        if (l == null || llegado) return;
        if (l.hasAccuracy() && l.getAccuracy() > 150) return;    // posición muy mala: se espera a otra
        double la = l.getLatitude(), lo = l.getLongitude();
        int ultimo = pos.length - 1;
        // ¿Por qué parada va? La más cercana de las que quedan (nunca hacia atrás)
        int mejor = actual; float dm = Float.MAX_VALUE;
        for (int i = actual; i <= ultimo; i++) { float d = dist(pos[i], la, lo); if (d < dm) { dm = d; mejor = i; } }
        if (dm < CERCA_PARADA_M) actual = Math.max(actual, mejor);
        float dDest = dist(pos[ultimo], la, lo);
        int quedan = Math.max(0, ultimo - actual);
        if (dDest < LLEGADA_M || (actual == ultimo && dm < LLEGADA_M)) {
            llegado = true;
            if (!avisado) avisarBajar(true);
            actualizarFija("Has llegado a " + destino);
            h.postDelayed(new Runnable() { public void run() { parar(); } }, 60_000L);
            return;
        }
        if (!avisado && (dDest < AVISO_M || quedan <= 1 && actual >= 1)) { avisado = true; avisarBajar(false); }
        String d = dDest >= 1000 ? String.format(java.util.Locale.ROOT, "%.1f km", dDest / 1000f).replace('.', ',') : Math.round(dDest / 10f) * 10 + " m";
        actualizarFija(quedan <= 1 ? "Bájate en la próxima · a " + d : "Quedan " + quedan + " paradas · a " + d);
    }
    @Override public void onStatusChanged(String p, int s, Bundle b) { }
    @Override public void onProviderEnabled(String p) { }
    @Override public void onProviderDisabled(String p) { }

    private void canales() {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT < 26 || nm == null) return;
        if (nm.getNotificationChannel(CANAL_VIAJE) == null) {
            NotificationChannel ch = new NotificationChannel(CANAL_VIAJE, "Viaje en curso", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Notificación fija mientras te avisamos de tu parada.");
            nm.createNotificationChannel(ch);
        }
        if (nm.getNotificationChannel(CANAL_BAJAR) == null) {
            NotificationChannel ch = new NotificationChannel(CANAL_BAJAR, "Bájate en tu parada", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("Te avisa cuando te acercas a la parada donde te bajas.");
            ch.enableVibration(true);
            ch.setVibrationPattern(new long[]{0, 600, 250, 600, 250, 900});
            nm.createNotificationChannel(ch);
        }
    }

    private PendingIntent piParar() {
        Intent i = new Intent(this, BajadaService.class).setAction(ACCION_PARAR);
        int f = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) f |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getService(this, 7403, i, f);
    }

    private Notification fija(String texto) {
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CANAL_VIAJE) : new Notification.Builder(this);
        b.setSmallIcon(LlegadaReceiver.icono(this))
                .setContentTitle("Línea " + linea + " · te bajas en " + destino)
                .setContentText(texto)
                .setOngoing(true).setOnlyAlertOnce(true)
                .setContentIntent(LlegadaReceiver.abrirParada(this, codigoDestino, ID_FIJA))
                .addAction(0, "Parar", piParar());
        if (Build.VERSION.SDK_INT >= 21) b.setColor(0xFFD41C2B);
        return b.build();
    }
    private void actualizarFija(String texto) {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        try { if (nm != null) nm.notify(ID_FIJA, fija(texto)); } catch (SecurityException ignored) { }
    }

    private void avisarBajar(boolean yaEsta) {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm == null) return;
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CANAL_BAJAR) : new Notification.Builder(this);
        b.setSmallIcon(LlegadaReceiver.icono(this))
                .setContentTitle(yaEsta ? "Estás en tu parada: bájate" : "Bájate en la próxima parada")
                .setContentText(destino + " · línea " + linea)
                .setAutoCancel(true)
                .setCategory(Notification.CATEGORY_ALARM)
                .setContentIntent(LlegadaReceiver.abrirParada(this, codigoDestino, ID_BAJAR));
        if (Build.VERSION.SDK_INT < 26) { b.setPriority(Notification.PRIORITY_HIGH); b.setDefaults(Notification.DEFAULT_ALL); }
        if (Build.VERSION.SDK_INT >= 21) b.setColor(0xFFD41C2B);
        try { nm.notify(ID_BAJAR, b.build()); } catch (SecurityException ignored) { }
        // Vibración propia por si el canal está en silencio
        try {
            Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null) {
                long[] patron = {0, 600, 250, 600, 250, 900};
                if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createWaveform(patron, -1));
                else v.vibrate(patron, -1);
            }
        } catch (Exception ignored) { }
    }

    private void parar() {
        try { if (lm != null) lm.removeUpdates(this); } catch (Exception ignored) { }
        h.removeCallbacksAndMessages(null);
        getSharedPreferences(LlegadaReceiver.PREFS, MODE_PRIVATE).edit().remove("bajada").apply();
        if (Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_REMOVE); else stopForeground(true);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        try { if (lm != null) lm.removeUpdates(this); } catch (Exception ignored) { }
        h.removeCallbacksAndMessages(null);
        super.onDestroy();
    }
}
