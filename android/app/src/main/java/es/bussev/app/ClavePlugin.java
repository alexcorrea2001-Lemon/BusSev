package es.bussev.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * La app pide aquí el permiso (token) para consultar a TUSSAM. Las credenciales nunca llegan a la parte
 * web: solo el token, que caduca a los pocos minutos.
 */
@CapacitorPlugin(name = "BusSevClave")
public class ClavePlugin extends Plugin {
    @PluginMethod
    public void token(final PluginCall call) {
        final boolean nuevo = call.getData().optBoolean("nuevo", false);
        new Thread(new Runnable() {
            public void run() {
                try {
                    String t = TussamTiempos.token(nuevo);
                    if (t == null) { call.reject("TUSSAM no ha dado permiso"); return; }
                    JSObject r = new JSObject();
                    r.put("access_token", t);
                    call.resolve(r);
                } catch (Exception e) {
                    call.reject(e.getMessage() == null ? "Sin conexión con TUSSAM" : e.getMessage());
                }
            }
        }, "bussev-token").start();
    }
}
