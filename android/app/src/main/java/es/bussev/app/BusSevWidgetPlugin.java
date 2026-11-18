package es.bussev.app;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.JSArray;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Puente app -> widget. La app guarda aquí la lista de paradas favoritas (para elegir parada al añadirlo).
 * Las credenciales de TUSSAM no pasan por aquí: van cifradas en Claves.
 */
@CapacitorPlugin(name = "BusSevWidget")
public class BusSevWidgetPlugin extends Plugin {

    @PluginMethod
    public void setConfig(PluginCall call) {
        Context ctx = getContext();
        SharedPreferences.Editor e = ctx
                .getSharedPreferences(BusSevWidgetProvider.PREFS, Context.MODE_PRIVATE)
                .edit();
        // Las credenciales ya no pasan por aquí (van cifradas en Claves): se borran las que guardaban versiones antiguas
        e.remove("clientId"); e.remove("clientSecret"); e.remove("user"); e.remove("pass");
        JSArray favs = call.getArray("favoritas");
        if (favs != null) e.putString("favs", favs.toString());
        e.apply();
        BusSevWidgetProvider.actualizarTodos(ctx);
        call.resolve();
    }
}
