package es.bussev.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ComponentName;
import android.content.ContentResolver;
import android.content.Context;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Icono de la app y sonido del aviso de llegada (Ajustes).
 *  - Icono: cada diseño es un «activity-alias» del AndroidManifest; se activa el elegido y se apagan los demás.
 *  - Sonido: Android fija el sonido de cada canal de notificaciones al crearlo, así que hay un canal por sonido.
 */
@CapacitorPlugin(name = "BusSevApariencia")
public class AparienciaPlugin extends Plugin {
    static final String[] ICONOS = {"Clasico", "Noche", "Azulejo", "Feria", "SemanaSanta", "Giralda", "Verde"};
    static final String[] SONIDOS = {"sistema", "campana", "bocina", "suave", "pitido", "vibrar"};

    private ComponentName alias(String n) { return new ComponentName(getContext().getPackageName(), "es.bussev.app.Icono" + n); }

    @PluginMethod
    public void getIcono(PluginCall call) {
        PackageManager pm = getContext().getPackageManager();
        String actual = "Clasico";
        for (String n : ICONOS) {
            int st = pm.getComponentEnabledSetting(alias(n));
            boolean on = st == PackageManager.COMPONENT_ENABLED_STATE_ENABLED || (st == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT && "Clasico".equals(n));
            if (on) { actual = n; break; }
        }
        JSObject r = new JSObject();
        r.put("icono", actual);
        call.resolve(r);
    }

    @PluginMethod
    public void setIcono(PluginCall call) {
        String elegido = call.getString("icono", "Clasico");
        boolean valido = false;
        for (String n : ICONOS) if (n.equals(elegido)) valido = true;
        if (!valido) { call.reject("Icono desconocido"); return; }
        PackageManager pm = getContext().getPackageManager();
        try {
            // Primero se enciende el nuevo y después se apagan los demás (así nunca se queda la app sin icono)
            pm.setComponentEnabledSetting(alias(elegido), PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP);
            for (String n : ICONOS) {
                if (!n.equals(elegido)) pm.setComponentEnabledSetting(alias(n), PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("No se ha podido cambiar el icono: " + e.getMessage());
        }
    }

    static int sonidoRes(Context c, String s) {
        return c.getResources().getIdentifier("aviso_" + s, "raw", c.getPackageName());
    }

    /** Canal de notificación para el sonido elegido (lo crea si no existe). Devuelve su id. */
    static String nombreSonido(String s) {
        switch (s) {
            case "campana": return "campanas";
            case "bocina": return "ding-dong";
            case "suave": return "marimba";
            case "pitido": return "estación";
            default: return s;
        }
    }
    static String canalPara(Context c, String sonido) {
        boolean valido = false;
        for (String s : SONIDOS) if (s.equals(sonido)) valido = true;
        if (!valido || "sistema".equals(sonido)) sonido = "sistema";
        // «_2»: los sonidos nuevos (repetidos 3 veces). Android no deja cambiar el sonido de un canal ya creado,
        // así que se crea uno nuevo y se borra el antiguo.
        String id = "sistema".equals(sonido) ? LlegadaReceiver.CANAL : LlegadaReceiver.CANAL + "_" + sonido + "_2";
        if (Build.VERSION.SDK_INT < 26) return id;
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null || nm.getNotificationChannel(id) != null) return id;
        if (!"sistema".equals(sonido)) try { nm.deleteNotificationChannel(LlegadaReceiver.CANAL + "_" + sonido); } catch (Exception ignored) { }
        NotificationChannel ch = new NotificationChannel(id, "Avisos de llegada" + ("sistema".equals(sonido) ? "" : " (" + nombreSonido(sonido) + ")"), NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("Te avisa cuando tu autobús está a punto de llegar.");
        ch.enableVibration(true);
        ch.setVibrationPattern(new long[]{0, 400, 200, 400});
        if ("vibrar".equals(sonido)) {
            ch.setSound(null, null);
        } else if (!"sistema".equals(sonido)) {
            int res = sonidoRes(c, sonido);
            if (res != 0) {
                Uri u = Uri.parse(ContentResolver.SCHEME_ANDROID_RESOURCE + "://" + c.getPackageName() + "/raw/aviso_" + sonido);
                ch.setSound(u, new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
            }
        }
        nm.createNotificationChannel(ch);
        return id;
    }

    /** «Como mi móvil»: los colores que Android 12+ saca de tu fondo de pantalla (Material You). Vacío en móviles anteriores. */
    /** Batería y datos, para que la app gaste menos cuando hace falta */
    @PluginMethod
    public void energia(PluginCall call) {
        Context c = getContext();
        JSObject r = new JSObject();
        r.put("ahorroSistema", Energia.ahorroSistema(c));
        r.put("bateria", Energia.bateria(c));
        r.put("cargando", Energia.cargando(c));
        r.put("datosRestringidos", Energia.datosRestringidos(c));
        r.put("medida", Energia.medida(c));
        r.put("bytes", (double) Energia.bytes(c));
        r.put("arranque", (double) (System.currentTimeMillis() - android.os.SystemClock.elapsedRealtime()));
        call.resolve(r);
    }

    @PluginMethod
    public void colorSistema(PluginCall call) {
        JSObject r = new JSObject();
        if (Build.VERSION.SDK_INT >= 31) {
            Context c = getContext();
            int[] ids = { android.R.color.system_accent1_100, android.R.color.system_accent1_200, android.R.color.system_accent1_600,
                    android.R.color.system_accent1_800, android.R.color.system_accent1_900 };
            String[] nombres = { "a100", "a200", "a600", "a800", "a900" };
            for (int i = 0; i < ids.length; i++) r.put(nombres[i], String.format("#%06X", 0xFFFFFF & c.getColor(ids[i])));
        }
        call.resolve(r);
    }

    @PluginMethod
    public void canalAviso(PluginCall call) {
        JSObject r = new JSObject();
        r.put("canal", canalPara(getContext(), call.getString("sonido", "sistema")));
        call.resolve(r);
    }

    /** Escuchar el sonido en Ajustes antes de elegirlo */
    @PluginMethod
    public void probarSonido(PluginCall call) {
        String s = call.getString("sonido", "");
        int res = sonidoRes(getContext(), s);
        if (res == 0) { call.resolve(); return; }
        try {
            MediaPlayer mp = MediaPlayer.create(getContext(), res);
            if (mp != null) {
                mp.setOnCompletionListener(new MediaPlayer.OnCompletionListener() { public void onCompletion(MediaPlayer p) { p.release(); } });
                mp.start();
            }
        } catch (Exception ignored) { }
        call.resolve();
    }
}
