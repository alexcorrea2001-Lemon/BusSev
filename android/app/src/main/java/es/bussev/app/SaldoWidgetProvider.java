package es.bussev.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

/**
 * Widget de saldo: tu primera tarjeta TUSSAM con el saldo y los viajes que te quedan.
 * El saldo es el de la última vez que lo consultaste en BusSev (la consulta a TUSSAM la hace la app), y dice de cuándo es.
 * Al tocarlo se abre la pestaña Tarjeta.
 */
public class SaldoWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) pintar(context, mgr, id);
    }

    static void actualizarTodos(Context c) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(c);
        for (int id : mgr.getAppWidgetIds(new ComponentName(c, SaldoWidgetProvider.class))) pintar(c, mgr, id);
    }

    static void pintar(Context c, AppWidgetManager mgr, int id) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.bussev_saldo);
        Intent abrir = new Intent(c, MainActivity.class).putExtra("bussev_abrir", "tarjeta")
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        v.setOnClickPendingIntent(R.id.ws_root, PendingIntent.getActivity(c, 0x31000000 | (id & 0x0FFFFFF), abrir, BusSevWidgetProvider.piFlags()));
        JSONObject t = null;
        try {
            JSONArray a = new JSONArray(BusSevWidgetProvider.prefs(c).getString("tarjetas", "[]"));
            if (a.length() > 0) t = a.getJSONObject(0);
        } catch (Exception ignored) { }
        if (t == null) {
            v.setTextViewText(R.id.ws_nombre, "BusSev");
            v.setTextViewText(R.id.ws_saldo, "—");
            v.setTextViewText(R.id.ws_viajes, "Añade tu tarjeta en BusSev");
            v.setTextViewText(R.id.ws_fecha, "");
        } else {
            v.setTextViewText(R.id.ws_nombre, t.optString("nombre", "Mi tarjeta"));
            v.setTextViewText(R.id.ws_saldo, t.optString("saldo", "—"));
            int viajes = t.optInt("viajes", -1);
            v.setTextViewText(R.id.ws_viajes, viajes < 0 ? t.optString("tipo", "") : viajes == 1 ? "Te queda 1 viaje" : "Te quedan " + viajes + " viajes");
            v.setTextViewText(R.id.ws_fecha, cuando(t.optLong("fecha", 0)));
            try {
                int col = Color.parseColor(t.optString("color", "#D41C2B"));
                v.setInt(R.id.ws_franja, "setBackgroundColor", col);
            } catch (Exception ignored) { }
            if (viajes >= 0 && viajes <= 2) v.setTextColor(R.id.ws_viajes, Color.parseColor("#FFB74D"));
        }
        mgr.updateAppWidget(id, v);
    }

    /* «Consultado hoy a las 9:41», «ayer», «el 12 nov» */
    static String cuando(long t) {
        if (t <= 0) return "";
        Calendar hoy = Calendar.getInstance(), c = Calendar.getInstance();
        c.setTimeInMillis(t);
        boolean mismoDia = hoy.get(Calendar.YEAR) == c.get(Calendar.YEAR) && hoy.get(Calendar.DAY_OF_YEAR) == c.get(Calendar.DAY_OF_YEAR);
        hoy.add(Calendar.DAY_OF_YEAR, -1);
        boolean ayer = hoy.get(Calendar.YEAR) == c.get(Calendar.YEAR) && hoy.get(Calendar.DAY_OF_YEAR) == c.get(Calendar.DAY_OF_YEAR);
        String h = new SimpleDateFormat("HH:mm", Locale.getDefault()).format(new Date(t));
        if (mismoDia) return "Consultado hoy a las " + h;
        if (ayer) return "Consultado ayer a las " + h;
        return "Consultado el " + new SimpleDateFormat("d MMM", new Locale("es", "ES")).format(new Date(t));
    }
}
