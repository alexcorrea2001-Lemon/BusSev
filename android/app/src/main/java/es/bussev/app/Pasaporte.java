package es.bussev.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * Pasaporte de Sevilla (parte de Android).
 *
 * - Guarda los viajes que comprueba BajadaService hasta que la app los recoge (viajesPendientes).
 * - Los firma (HMAC con una clave que solo tiene la app compilada), para que una copia de seguridad
 *   manipulada no pueda meter viajes inventados: al restaurar, la app pide comprobar las firmas.
 * - Avisa del resultado del viaje y de los sellos y medallas conseguidos, con su dibujo.
 * Las reglas de los logros están en www/pasaporte.js (una sola copia, probada en las pruebas).
 */
final class Pasaporte {
    static final String CANAL = "bussev_logros";
    private Pasaporte() { }

    private static byte[] clave() throws Exception {
        String base = "BusSev·pasaporte·" + Claves.clientSecret() + "·" + Claves.clientId() + "·sevilla";
        return MessageDigest.getInstance("SHA-256").digest(base.getBytes(StandardCharsets.UTF_8));
    }
    /* Texto que se firma: lo que cuenta para los logros */
    static String canon(JSONObject v) {
        return v.optString("id") + "|" + v.optString("linea") + "|" + v.optString("desde") + "|" + v.optString("hasta") + "|"
                + v.optLong("inicio") + "|" + v.optLong("fin") + "|" + Math.round(v.optDouble("lat", 0) * 1e5) + "|"
                + Math.round(v.optDouble("lon", 0) * 1e5) + "|" + v.optInt("paradas") + "|" + v.optBoolean("verificado");
    }
    static String firma(JSONObject v) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(clave(), "HmacSHA256"));
        byte[] r = mac.doFinal(canon(v).getBytes(StandardCharsets.UTF_8));
        StringBuilder sb = new StringBuilder();
        for (byte b : r) sb.append(String.format("%02x", b));
        return sb.toString();
    }
    static boolean firmaValida(JSONObject v) {
        try { return MessageDigest.isEqual(firma(v).getBytes(StandardCharsets.UTF_8), v.optString("firma").getBytes(StandardCharsets.UTF_8)); }
        catch (Exception e) { return false; }
    }

    static synchronized void guardar(Context c, JSONObject v) {
        SharedPreferences p = c.getSharedPreferences(LlegadaReceiver.PREFS, Context.MODE_PRIVATE);
        JSONArray a;
        try { a = new JSONArray(p.getString("viajesPendientes", "[]")); } catch (Exception e) { a = new JSONArray(); }
        a.put(v);
        while (a.length() > 60) a.remove(0);
        p.edit().putString("viajesPendientes", a.toString()).apply();
        ViajePlugin.emitir("bussevViaje", v.optString("id"));    // si la app está abierta (aunque sea de fondo), lo recoge al momento
    }
    static synchronized JSONArray sacarPendientes(Context c) {
        SharedPreferences p = c.getSharedPreferences(LlegadaReceiver.PREFS, Context.MODE_PRIVATE);
        JSONArray a;
        try { a = new JSONArray(p.getString("viajesPendientes", "[]")); } catch (Exception e) { a = new JSONArray(); }
        p.edit().remove("viajesPendientes").apply();
        return a;
    }

    private static void canal(Context c, NotificationManager nm) {
        if (Build.VERSION.SDK_INT < 26 || nm.getNotificationChannel(CANAL) != null) return;
        NotificationChannel ch = new NotificationChannel(CANAL, "Pasaporte de Sevilla", NotificationManager.IMPORTANCE_DEFAULT);
        ch.setDescription("Viajes verificados, sellos y medallas que consigues.");
        nm.createNotificationChannel(ch);
    }
    static PendingIntent abrirPasaporte(Context c, int req) {
        Intent open = new Intent(c, MainActivity.class).putExtra("bussev_abrir", "pasaporte")
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int f = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) f |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getActivity(c, req, open, f);
    }
    private static Bitmap dibujo(Context c, String id) {
        try (InputStream in = c.getAssets().open("public/img/pasaporte/" + id.replaceAll("[^a-z0-9-]", "") + ".png")) { return BitmapFactory.decodeStream(in); }
        catch (Exception e) { return null; }
    }
    static void notificar(Context c, int nid, String titulo, String texto, String dibujo) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        canal(c, nm);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, CANAL) : new Notification.Builder(c);
        b.setSmallIcon(LlegadaReceiver.icono(c)).setContentTitle(titulo).setContentText(texto).setAutoCancel(true)
                .setContentIntent(abrirPasaporte(c, nid));
        Bitmap bm = dibujo != null ? dibujo(c, dibujo) : null;
        if (bm != null) {
            b.setLargeIcon(bm);
            if (Build.VERSION.SDK_INT >= 16) b.setStyle(new Notification.BigPictureStyle().bigPicture(bm).setSummaryText(texto));
        }
        if (Build.VERSION.SDK_INT >= 21) b.setColor(0xFF7A1D34);
        try { nm.notify(nid, b.build()); } catch (SecurityException ignored) { }
    }
    static void avisarViaje(Context c, JSONObject v) {
        boolean ok = v.optBoolean("verificado");
        String tramo = v.optString("desdeNombre") + " → " + v.optString("hastaNombre");
        notificar(c, 7600 + (int) (v.optLong("fin") % 100),
                ok ? "✅ Viaje verificado en el " + v.optString("linea") : "Este viaje no ha contado para el pasaporte",
                ok ? tramo : v.optString("motivo", "no se pudo comprobar") + " · " + tramo, null);
    }
}
