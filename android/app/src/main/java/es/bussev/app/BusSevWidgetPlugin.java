package es.bussev.app;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ShortcutInfo;
import android.content.pm.ShortcutManager;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.Icon;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

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
        JSArray tarjetas = call.getArray("tarjetas");
        if (tarjetas != null) e.putString("tarjetas", tarjetas.toString());
        e.apply();
        BusSevWidgetProvider.actualizarTodos(ctx);
        if (tarjetas != null) SaldoWidgetProvider.actualizarTodos(ctx);
        if (favs != null) atajos(ctx, favs);
        call.resolve();
    }

    /* Accesos directos al mantener pulsado el icono: tus 4 primeras favoritas (solo se rehacen si cambian) */
    static void atajos(Context c, JSONArray favs) {
        if (Build.VERSION.SDK_INT < 25) return;
        try {
            SharedPreferences p = c.getSharedPreferences(BusSevWidgetProvider.PREFS, Context.MODE_PRIVATE);
            StringBuilder huella = new StringBuilder();
            for (int i = 0; i < Math.min(4, favs.length()); i++) { JSONObject f = favs.optJSONObject(i); if (f != null) huella.append(f.optString("codigo")).append('=').append(f.optString("nombre")).append(';'); }
            if (huella.toString().equals(p.getString("atajos", null))) return;
            ShortcutManager sm = c.getSystemService(ShortcutManager.class);
            if (sm == null) return;
            Icon ic = iconoAtajo(c);
            List<ShortcutInfo> l = new ArrayList<>();
            for (int i = 0; i < favs.length() && l.size() < 4; i++) {
                JSONObject f = favs.optJSONObject(i);
                if (f == null || f.optString("codigo", "").isEmpty()) continue;
                String cod = f.optString("codigo"), nom = f.optString("nombre", "Parada " + cod);
                Intent it = new Intent(Intent.ACTION_VIEW).setClass(c, MainActivity.class).putExtra("bussev_parada", cod)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                l.add(new ShortcutInfo.Builder(c, "parada_" + cod)
                        .setShortLabel(corto(nom, 24)).setLongLabel(corto(nom + " · " + cod, 40))
                        .setIcon(ic).setIntent(it).setRank(l.size()).build());
            }
            sm.setDynamicShortcuts(l);
            p.edit().putString("atajos", huella.toString()).apply();
        } catch (Exception ignored) { /* el lanzador no admite atajos o hay límite: no pasa nada */ }
    }
    static String corto(String s, int n) { return s.length() <= n ? s : s.substring(0, n - 1) + "…"; }
    /* Icono: el autobús blanco de BusSev sobre el rojo, en formato adaptable */
    static Icon iconoAtajo(Context c) {
        int px = (int) (108 * c.getResources().getDisplayMetrics().density);
        Bitmap b = Bitmap.createBitmap(px, px, Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(b);
        cv.drawColor(0xFFD41C2B);
        Drawable d = c.getDrawable(R.drawable.ic_stat_bus);
        if (d != null) {
            int m = px * 32 / 108;
            d.setBounds(m, m, px - m, px - m);
            d.setTint(Color.WHITE);
            d.draw(cv);
        }
        return Build.VERSION.SDK_INT >= 26 ? Icon.createWithAdaptiveBitmap(b) : Icon.createWithBitmap(b);
    }
}
