package es.bussev.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Build;
import android.os.Bundle;
import android.text.SpannableStringBuilder;
import android.text.style.ForegroundColorSpan;
import android.text.style.StyleSpan;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;

/**
 * Widget de inicio. Dos modos:
 *  - una parada favorita con sus próximos autobuses;
 *  - «Mis favoritas»: tus primeras paradas, cada una con sus dos próximos autobuses.
 * Se adapta al tamaño: más alto, más filas.
 */
public class BusSevWidgetProvider extends AppWidgetProvider {
    static final String PREFS = "bussev_widget";
    static final String ACTION_REFRESH = "es.bussev.app.WIDGET_REFRESH";

    static final int[] ROW_BOX = { R.id.w_row0, R.id.w_row1, R.id.w_row2 };
    static final int[] ROW_LINE = { R.id.w_line0, R.id.w_line1, R.id.w_line2 };
    static final int[] ROW_DEST = { R.id.w_dest0, R.id.w_dest1, R.id.w_dest2 };
    static final int[] ROW_MIN = { R.id.w_min0, R.id.w_min1, R.id.w_min2 };

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static int piFlags() {
        int f = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) f |= PendingIntent.FLAG_IMMUTABLE;
        return f;
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] ids) {
        // La actualización de cada media hora no gasta datos ni batería si nadie la ve (pantalla apagada) o
        // si el móvil está ahorrando: solo se avisa de que hay que tocar ⟳. Al tocar, o al abrir la app, sí se pide.
        boolean dormido = !Energia.pantalla(context) || Energia.ahorro(context) || Energia.datosRestringidos(context);
        for (int id : ids) {
            if (dormido && yaPintado(context, id)) marcarViejo(context, mgr, id);
            else actualizar(context, mgr, id);
        }
    }

    /** El widget ya enseñó tiempos alguna vez (si es nuevo, se piden siempre) */
    static boolean yaPintado(Context c, int id) { return prefs(c).getLong("pintado_" + id, 0) > 0; }

    /** Solo cambia la línea de abajo: los tiempos que se ven son de hace rato */
    static void marcarViejo(Context c, AppWidgetManager mgr, int id) {
        try {
            boolean varias = esVarias(prefs(c), id);
            RemoteViews v = new RemoteViews(c.getPackageName(), varias ? R.layout.bussev_widget_varias : R.layout.bussev_widget);
            long t = prefs(c).getLong("pintado_" + id, 0);
            String h = new java.text.SimpleDateFormat("HH:mm", java.util.Locale.getDefault()).format(new java.util.Date(t));
            v.setTextViewText(varias ? R.id.wv_updated : R.id.w_updated, "De las " + h + " · toca ⟳");
            mgr.partiallyUpdateAppWidget(id, v);
        } catch (Exception ignored) { }
    }

    /* Al cambiarlo de tamaño se vuelve a pintar con las filas que caben */
    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager mgr, int id, Bundle opts) {
        actualizar(context, mgr, id);
    }

    /** Cuántas filas caben según la altura del widget */
    static int filas(AppWidgetManager mgr, int id) {
        try {
            int h = mgr.getAppWidgetOptions(id).getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 110);
            return h < 100 ? 1 : h < 150 ? 2 : 3;
        } catch (Exception e) { return 3; }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (ACTION_REFRESH.equals(intent.getAction())) {
            int id = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
            if (id != AppWidgetManager.INVALID_APPWIDGET_ID) {
                actualizar(context, AppWidgetManager.getInstance(context), id);
            }
        }
    }

    static void actualizarTodos(Context context) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(context);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(context, BusSevWidgetProvider.class));
        for (int id : ids) actualizar(context, mgr, id);
    }

    /** Parada elegida para un widget: [codigo, nombre, lineasJson], o null si no hay. */
    static String[] leerStop(SharedPreferences p, int id) {
        String one = p.getString("stop_" + id, null);
        if (one == null) {
            // compat con la versión de varias paradas: se coge la primera
            String arr = p.getString("stops_" + id, null);
            if (arr != null) {
                try { JSONArray a = new JSONArray(arr); if (a.length() > 0) one = a.getJSONObject(0).toString(); } catch (Exception e) { /* */ }
            }
        }
        if (one == null) return null;
        try {
            JSONObject o = new JSONObject(one);
            String c = o.optString("codigo", "");
            if (c.isEmpty()) return null;
            JSONArray la = o.optJSONArray("lineas");
            return new String[]{ c, o.optString("nombre", "Parada " + c), la != null ? la.toString() : "[]" };
        } catch (Exception e) { return null; }
    }

    /** Solo las líneas que el usuario eligió en esa parada (si tiene filtro); si no, todas. */
    static List<TussamTiempos.Llegada> filtrar(List<TussamTiempos.Llegada> list, String lineasJson) {
        if (list == null) return null;
        try {
            JSONArray a = new JSONArray(lineasJson);
            if (a.length() == 0) return list;
            HashSet<String> set = new HashSet<>();
            for (int i = 0; i < a.length(); i++) set.add(norm(a.optString(i, "")));
            List<TussamTiempos.Llegada> out = new ArrayList<>();
            for (TussamTiempos.Llegada x : list) if (set.contains(norm(x.linea))) out.add(x);
            return out;
        } catch (Exception e) { return list; }
    }

    static String norm(String s) {
        if (s == null) return "";
        s = s.trim().toUpperCase(Locale.ROOT);
        s = s.replaceFirst("^0+(?=.)", "");
        return s;
    }

    static boolean esVarias(SharedPreferences p, int id) {
        try { return "varias".equals(new JSONObject(p.getString("stop_" + id, "{}")).optString("modo")); } catch (Exception e) { return false; }
    }

    static void actualizar(final Context context, final AppWidgetManager mgr, final int widgetId) {
        final SharedPreferences p = prefs(context);
        if (esVarias(p, widgetId)) { actualizarVarias(context, mgr, widgetId); return; }
        final String[] stop = leerStop(p, widgetId);
        final int maxFilas = filas(mgr, widgetId);

        Intent open = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (open == null) open = new Intent(context, MainActivity.class);
        if (stop != null) open.putExtra("bussev_parada", stop[0]);   // al tocar, abre esa parada
        final PendingIntent piOpen = PendingIntent.getActivity(context, widgetId, open, piFlags());
        Intent ref = new Intent(context, BusSevWidgetProvider.class)
                .setAction(ACTION_REFRESH)
                .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId);
        final PendingIntent piRef = PendingIntent.getBroadcast(context, widgetId, ref, piFlags());

        if (stop == null) {
            RemoteViews v = base(context, piOpen, piRef);
            v.setTextViewText(R.id.w_stop, "Elige una parada");
            v.setTextViewText(R.id.w_updated, "Toca para abrir BusSev");
            for (int r = 0; r < 3; r++) v.setViewVisibility(ROW_BOX[r], View.GONE);
            mgr.updateAppWidget(widgetId, v);
            return;
        }

        RemoteViews cargando = base(context, piOpen, piRef);
        cargando.setTextViewText(R.id.w_stop, stop[1]);
        cargando.setTextViewText(R.id.w_updated, "Actualizando…");
        mgr.updateAppWidget(widgetId, cargando);

        new Thread(new Runnable() {
            public void run() {
                RemoteViews v = base(context, piOpen, piRef);
                v.setTextViewText(R.id.w_stop, stop[1]);
                try {
                    String tok = TussamTiempos.token(p);
                    if (tok == null) throw new Exception("sin token");
                    List<TussamTiempos.Llegada> list = filtrar(TussamTiempos.tiempos(stop[0], tok), stop[2]);
                    if (list == null || list.isEmpty()) {
                        for (int r = 0; r < 3; r++) v.setViewVisibility(ROW_BOX[r], View.GONE);
                        v.setTextViewText(R.id.w_updated, "Sin autobuses ahora mismo");
                    } else {
                        int n = Math.min(maxFilas, list.size());
                        for (int r = 0; r < 3; r++) {
                            if (r >= n) { v.setViewVisibility(ROW_BOX[r], View.GONE); continue; }
                            TussamTiempos.Llegada a = list.get(r);
                            v.setViewVisibility(ROW_BOX[r], View.VISIBLE);
                            v.setTextViewText(ROW_LINE[r], a.linea);
                            v.setTextColor(ROW_LINE[r], visible(a.color));
                            v.setTextViewText(ROW_DEST[r], a.destino);
                            v.setTextViewText(ROW_MIN[r], a.minutos <= 0 ? "ya" : (a.minutos + " min"));
                        }
                        v.setTextViewText(R.id.w_updated, "Actualizado a las " + hora()); prefs(context).edit().putLong("pintado_" + widgetId, System.currentTimeMillis()).apply();
                    }
                } catch (Exception e) {
                    for (int r = 0; r < 3; r++) v.setViewVisibility(ROW_BOX[r], View.GONE);
                    v.setTextViewText(R.id.w_updated, "Sin conexión");
                }
                mgr.updateAppWidget(widgetId, v);
            }
        }).start();
    }

    /** Ajusta el color de la línea para que SIEMPRE se vea sobre el fondo oscuro del widget
        (los colores oscuros de TUSSAM, como el azul marino, se aclaran). */
    static int visible(String hex) {
        try {
            int c = Color.parseColor(hex);
            float[] hsv = new float[3];
            Color.colorToHSV(c, hsv);
            if (hsv[2] < 0.78f) hsv[2] = 0.88f;   // sube el brillo si es oscuro
            if (hsv[1] > 0.85f) hsv[1] = 0.85f;    // baja un pelín la saturación
            return Color.HSVToColor(hsv);
        } catch (Exception e) { return Color.WHITE; }
    }

    /* ---------- «Mis favoritas» ---------- */
    static final int[] V_BOX = { R.id.wv_box0, R.id.wv_box1, R.id.wv_box2 };
    static final int[] V_NOM = { R.id.wv_nom0, R.id.wv_nom1, R.id.wv_nom2 };
    static final int[] V_BUS = { R.id.wv_bus0, R.id.wv_bus1, R.id.wv_bus2 };

    static void actualizarVarias(final Context context, final AppWidgetManager mgr, final int widgetId) {
        final SharedPreferences p = prefs(context);
        final int maxFilas = filas(mgr, widgetId);
        final List<String[]> paradas = new ArrayList<>();
        try {
            JSONArray favs = new JSONArray(p.getString("favs", "[]"));
            for (int i = 0; i < favs.length() && paradas.size() < 3; i++) {
                JSONObject f = favs.optJSONObject(i);
                if (f == null || f.optString("codigo", "").isEmpty()) continue;
                JSONArray la = f.optJSONArray("lineas");
                paradas.add(new String[]{ f.optString("codigo"), f.optString("nombre", "Parada " + f.optString("codigo")), la != null ? la.toString() : "[]" });
            }
        } catch (Exception e) { /* sin favoritas */ }
        Intent open = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (open == null) open = new Intent(context, MainActivity.class);
        final PendingIntent piOpen = PendingIntent.getActivity(context, widgetId, open, piFlags());
        Intent ref = new Intent(context, BusSevWidgetProvider.class).setAction(ACTION_REFRESH).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId);
        final PendingIntent piRef = PendingIntent.getBroadcast(context, widgetId, ref, piFlags());
        final int n = Math.min(maxFilas, paradas.size());

        RemoteViews cargando = baseVarias(context, piOpen, piRef);
        for (int r = 0; r < 3; r++) {
            if (r >= n) { cargando.setViewVisibility(V_BOX[r], View.GONE); continue; }
            cargando.setViewVisibility(V_BOX[r], View.VISIBLE);
            cargando.setTextViewText(V_NOM[r], paradas.get(r)[1]);
            cargando.setTextViewText(V_BUS[r], "…");
            cargando.setOnClickPendingIntent(V_BOX[r], piParada(context, paradas.get(r)[0], widgetId * 10 + r));
        }
        cargando.setTextViewText(R.id.wv_updated, paradas.isEmpty() ? "Marca paradas como favoritas en BusSev" : "Actualizando…");
        mgr.updateAppWidget(widgetId, cargando);
        if (paradas.isEmpty()) return;

        new Thread(new Runnable() {
            public void run() {
                RemoteViews v = baseVarias(context, piOpen, piRef);
                String tok = null;
                try { tok = TussamTiempos.token(p); } catch (Exception ignored) { }
                boolean algunError = false;
                for (int r = 0; r < 3; r++) {
                    if (r >= n) { v.setViewVisibility(V_BOX[r], View.GONE); continue; }
                    String[] st = paradas.get(r);
                    v.setViewVisibility(V_BOX[r], View.VISIBLE);
                    v.setTextViewText(V_NOM[r], st[1]);
                    v.setOnClickPendingIntent(V_BOX[r], piParada(context, st[0], widgetId * 10 + r));
                    try {
                        if (tok == null) throw new Exception("sin token");
                        v.setTextViewText(V_BUS[r], resumen(filtrar(TussamTiempos.tiempos(st[0], tok), st[2])));
                    } catch (Exception e) { v.setTextViewText(V_BUS[r], "Sin conexión"); algunError = true; }
                }
                v.setTextViewText(R.id.wv_updated, algunError ? "Sin conexión" : "Actualizado a las " + hora()); if (!algunError) prefs(context).edit().putLong("pintado_" + widgetId, System.currentTimeMillis()).apply();
                mgr.updateAppWidget(widgetId, v);
            }
        }).start();
    }

    /* «27 3 min · C1 7 min»: el número de línea en su color y en negrita */
    static CharSequence resumen(List<TussamTiempos.Llegada> l) {
        if (l == null || l.isEmpty()) return "Sin autobuses ahora";
        SpannableStringBuilder sb = new SpannableStringBuilder();
        for (int i = 0; i < Math.min(2, l.size()); i++) {
            TussamTiempos.Llegada a = l.get(i);
            if (i > 0) sb.append("   ");
            int ini = sb.length();
            sb.append(a.linea);
            sb.setSpan(new ForegroundColorSpan(visible(a.color)), ini, sb.length(), 0);
            sb.setSpan(new StyleSpan(Typeface.BOLD), ini, sb.length(), 0);
            sb.append(" ").append(a.minutos <= 0 ? "ya" : a.minutos + " min");
        }
        return sb;
    }

    static PendingIntent piParada(Context c, String codigo, int req) {
        Intent i = new Intent(c, MainActivity.class).putExtra("bussev_parada", codigo)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(c, 0x30000000 | (req & 0x0FFFFFFF), i, piFlags());
    }

    static RemoteViews baseVarias(Context context, PendingIntent piOpen, PendingIntent piRef) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.bussev_widget_varias);
        v.setOnClickPendingIntent(R.id.wv_root, piOpen);
        v.setOnClickPendingIntent(R.id.wv_refresh, piRef);
        return v;
    }

    static RemoteViews base(Context context, PendingIntent piOpen, PendingIntent piRef) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.bussev_widget);
        v.setOnClickPendingIntent(R.id.w_root, piOpen);
        v.setOnClickPendingIntent(R.id.w_refresh, piRef);
        return v;
    }

    static String hora() {
        return new SimpleDateFormat("HH:mm", Locale.getDefault()).format(new Date());
    }

    @Override
    public void onDeleted(Context context, int[] ids) {
        SharedPreferences.Editor e = prefs(context).edit();
        for (int id : ids) { e.remove("stop_" + id); e.remove("stops_" + id); }
        e.apply();
    }
}
