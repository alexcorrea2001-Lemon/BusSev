package es.bussev.app;

import android.content.SharedPreferences;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.service.quicksettings.Tile;
import android.service.quicksettings.TileService;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.List;

/**
 * Botón de los ajustes rápidos (al bajar la cortina de notificaciones): el próximo autobús de tu primera favorita,
 * por ejemplo «27 · 4 min». Se actualiza al bajar la cortina y al tocarlo, sin abrir la app.
 */
public class ParadaTileService extends TileService {
    private final Handler h = new Handler(Looper.getMainLooper());
    private long ultima = 0;

    @Override
    public void onStartListening() {
        super.onStartListening();
        if (System.currentTimeMillis() - ultima > 15_000L) refrescar();
    }

    @Override
    public void onClick() {
        super.onClick();
        refrescar();
    }

    /* Primera favorita: {codigo, nombre, lineas} */
    private JSONObject principal() {
        try {
            JSONArray a = new JSONArray(BusSevWidgetProvider.prefs(this).getString("favs", "[]"));
            for (int i = 0; i < a.length(); i++) { JSONObject f = a.optJSONObject(i); if (f != null && !f.optString("codigo", "").isEmpty()) return f; }
        } catch (Exception ignored) { }
        return null;
    }

    private void pintar(String titulo, String sub, boolean activo) {
        Tile t = getQsTile();
        if (t == null) return;
        t.setLabel(titulo);
        if (Build.VERSION.SDK_INT >= 29) t.setSubtitle(sub);
        else if (sub != null && !sub.isEmpty()) t.setContentDescription(titulo + ", " + sub);
        t.setState(activo ? Tile.STATE_ACTIVE : Tile.STATE_INACTIVE);
        t.updateTile();
    }

    private void refrescar() {
        ultima = System.currentTimeMillis();
        final JSONObject f = principal();
        if (f == null) { pintar("BusSev", "Marca una favorita", false); return; }
        final String nombre = f.optString("nombre", "Parada " + f.optString("codigo"));
        pintar("…", nombre, true);
        new Thread(new Runnable() { public void run() {
            String titulo, sub = nombre;
            try {
                SharedPreferences p = BusSevWidgetProvider.prefs(ParadaTileService.this);
                String tok = TussamTiempos.token(p);
                if (tok == null) throw new Exception("sin token");
                JSONArray la = f.optJSONArray("lineas");
                List<TussamTiempos.Llegada> l = BusSevWidgetProvider.filtrar(TussamTiempos.tiempos(f.optString("codigo"), tok), la != null ? la.toString() : "[]");
                if (l == null || l.isEmpty()) titulo = "Sin buses ahora";
                else {
                    TussamTiempos.Llegada a = l.get(0);
                    titulo = a.linea + " · " + (a.minutos <= 0 ? "llegando" : a.minutos + " min");
                    if (l.size() > 1) { TussamTiempos.Llegada b = l.get(1); sub = nombre + " · luego " + b.linea + " " + (b.minutos <= 0 ? "ya" : b.minutos + "'"); }
                }
            } catch (Exception e) { titulo = "Sin conexión"; }
            final String t1 = titulo, s1 = sub;
            h.post(new Runnable() { public void run() { pintar(t1, s1, true); } });
        } }).start();
    }
}
