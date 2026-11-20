package es.bussev.app;

import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.ConnectivityManager;
import android.os.BatteryManager;
import android.os.Build;
import android.os.PowerManager;
import android.net.TrafficStats;

/**
 * Batería y datos: lo usan la app (por AparienciaPlugin.energia), el widget y los servicios con GPS
 * para gastar menos cuando el móvil está en ahorro de batería o le queda poca, o con el ahorro de datos puesto.
 */
public final class Energia {
    private Energia() { }

    /** Nivel de batería (0-100) o -1 si no se sabe */
    static int bateria(Context c) {
        try {
            Intent i = c.getApplicationContext().registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
            if (i == null) return -1;
            int nivel = i.getIntExtra(BatteryManager.EXTRA_LEVEL, -1), escala = i.getIntExtra(BatteryManager.EXTRA_SCALE, 100);
            return nivel < 0 || escala <= 0 ? -1 : Math.round(100f * nivel / escala);
        } catch (Exception e) { return -1; }
    }

    static boolean cargando(Context c) {
        try {
            Intent i = c.getApplicationContext().registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
            int st = i == null ? -1 : i.getIntExtra(BatteryManager.EXTRA_STATUS, -1);
            return st == BatteryManager.BATTERY_STATUS_CHARGING || st == BatteryManager.BATTERY_STATUS_FULL;
        } catch (Exception e) { return false; }
    }

    /** El móvil tiene puesto el ahorro de batería de Android */
    static boolean ahorroSistema(Context c) {
        try {
            PowerManager pm = (PowerManager) c.getSystemService(Context.POWER_SERVICE);
            return pm != null && pm.isPowerSaveMode();
        } catch (Exception e) { return false; }
    }

    /** Ahorro de batería de Android, o queda un 15 % o menos y no está cargando */
    static boolean ahorro(Context c) {
        if (ahorroSistema(c)) return true;
        int b = bateria(c);
        return b >= 0 && b <= 15 && !cargando(c);
    }

    /** La pantalla está encendida */
    static boolean pantalla(Context c) {
        try {
            PowerManager pm = (PowerManager) c.getSystemService(Context.POWER_SERVICE);
            return pm == null || pm.isInteractive();
        } catch (Exception e) { return true; }
    }

    /** Ahorro de datos de Android puesto para esta app */
    static boolean datosRestringidos(Context c) {
        try {
            ConnectivityManager cm = (ConnectivityManager) c.getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null || Build.VERSION.SDK_INT < 24) return false;
            return cm.getRestrictBackgroundStatus() == ConnectivityManager.RESTRICT_BACKGROUND_STATUS_ENABLED;
        } catch (Exception e) { return false; }
    }

    /** Conectado por datos móviles (o una red de pago), no por wifi */
    static boolean medida(Context c) {
        try {
            ConnectivityManager cm = (ConnectivityManager) c.getSystemService(Context.CONNECTIVITY_SERVICE);
            return cm != null && cm.isActiveNetworkMetered();
        } catch (Exception e) { return false; }
    }

    /** Bytes que ha movido la app (recibidos + enviados) desde que se encendió el móvil, o -1 */
    static long bytes(Context c) {
        try {
            int uid = c.getApplicationInfo().uid;
            long rx = TrafficStats.getUidRxBytes(uid), tx = TrafficStats.getUidTxBytes(uid);
            if (rx == TrafficStats.UNSUPPORTED || tx == TrafficStats.UNSUPPORTED) return -1;
            return rx + tx;
        } catch (Exception e) { return -1; }
    }

    /** Cada cuánto pedir el GPS en un viaje: el doble de espaciado en ahorro */
    static long gpsMs(Context c, long normal) { return ahorro(c) ? normal * 2 : normal; }
}
