package es.bussev.app;

import android.Manifest;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

/**
 * Puente app -> Android para los avisos que tienen que funcionar con la app cerrada:
 *  - aviso de llegada que se corrige solo (LlegadaReceiver);
 *  - «avísame cuando tenga que bajarme» (BajadaService).
 */
@CapacitorPlugin(name = "BusSevViaje")
public class ViajePlugin extends Plugin {

    @PluginMethod
    public void vigilarLlegada(PluginCall call) {
        try {
            JSONObject x = new JSONObject();
            x.put("id", call.getData().optInt("id", 0));
            x.put("codigo", call.getString("codigo", ""));
            x.put("parada", call.getString("parada", ""));
            x.put("linea", call.getString("linea", ""));
            x.put("destino", call.getString("destino", ""));
            x.put("antes", call.getData().optInt("antes", 5));
            long at = call.getData().optLong("at", System.currentTimeMillis());
            x.put("at", at);
            x.put("revisar", Math.min(at, System.currentTimeMillis() + 60_000L));
            LlegadaReceiver.poner(getContext(), x);
            call.resolve();
        } catch (Exception e) { call.reject(e.getMessage()); }
    }

    @PluginMethod
    public void quitarLlegada(PluginCall call) {
        int id = call.getData().optInt("id", 0);
        LlegadaReceiver.quitar(getContext(), id);
        NotificationManager nm = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(id);
        call.resolve();
    }

    @PluginMethod
    public void empezarBajada(PluginCall call) {
        Context c = getContext();
        if (Build.VERSION.SDK_INT >= 23 && c.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED
                && c.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            call.reject("Hace falta el permiso de ubicación para saber por dónde vas.");
            return;
        }
        try {
            JSObject v = new JSObject();
            v.put("linea", call.getString("linea", ""));
            v.put("paradas", call.getArray("paradas"));
            v.put("inicio", System.currentTimeMillis());
            Intent i = new Intent(c, BajadaService.class).putExtra("viaje", v.toString());
            if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i); else c.startService(i);
            call.resolve();
        } catch (Exception e) { call.reject("No se ha podido empezar: " + e.getMessage()); }
    }

    @PluginMethod
    public void pararBajada(PluginCall call) {
        Context c = getContext();
        try { c.startService(new Intent(c, BajadaService.class).setAction(BajadaService.ACCION_PARAR)); }
        catch (Exception e) { c.getSharedPreferences(LlegadaReceiver.PREFS, Context.MODE_PRIVATE).edit().remove("bajada").apply(); }
        call.resolve();
    }

    @PluginMethod
    public void estadoBajada(PluginCall call) {
        JSObject r = new JSObject();
        String s = BajadaService.estado(getContext());
        r.put("activo", s != null);
        if (s != null) {
            try { r.put("viaje", new JSObject(s)); } catch (Exception ignored) { }
        }
        call.resolve(r);
    }
}
