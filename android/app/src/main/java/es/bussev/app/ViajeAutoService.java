package es.bussev.app;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.SystemClock;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Viajes automáticos del Pasaporte (y «¿Llego o no llego?»).
 *
 * La app lo arranca al abrir una parada estando en ella o yendo hacia ella (con la app abierta: basta el permiso
 * de ubicación «mientras se usa la app»). Dos fases:
 *  1. ESPERA: pregunta a TUSSAM cada 20 s por tu parada. La notificación (con chip en Android 16) enseña cuánto le
 *     falta a tu bus y, si vas andando, si llegas a tiempo. Si te alejas o no te subes, se apaga sola, sin decir nada.
 *  2. EN RUTA: si sales de la parada a velocidad de autobús por el recorrido de una de sus líneas, sigue el viaje.
 *     Al bajarte (vas despacio un buen rato) comprueba que de verdad era ese autobús y, si lo era, lo guarda firmado.
 * Los viajes que no cuadran no se apuntan (ibas en coche, en bici, andando…), salvo que la ubicación sea falsa.
 */
public class ViajeAutoService extends Service implements LocationListener {
    static final String ACCION_PARAR = "es.bussev.app.AUTO_PARAR";
    static final String ACCION_REFRESCAR = "es.bussev.app.AUTO_REFRESCAR";
    static final String CANAL = "bussev_auto";
    // Canal casi invisible (sin icono arriba ni en la pantalla de bloqueo) para cuando solo se cuenta el viaje.
    // Android obliga a tener una notificación mientras se usa la ubicación con la pantalla apagada.
    static final String CANAL_SILENCIO = "bussev_auto_silencio";
    static final String CANAL_16 = "bussev_auto16";
    static final int ID_FIJA = 7601;
    static final long ESPERA_MAX = 25 * 60_000L, RUTA_MAX = 150 * 60_000L;
    static final float LEJOS_M = 700f, EN_PARADA_M = 45f, SALIDA_M = 90f, CERCA_PARADA_M = 120f;

    static final class Cand {
        String linea, etq;
        String[] cods, noms;
        double[][] pos;
        int actual = 0, fixes = 0, dentro = 0;
        boolean fuera = false, completa = false;     // completa: ha llegado al final de su tramo
    }

    private LocationManager lm;
    private final Handler h = new Handler(Looper.getMainLooper());
    private String codigo = "", nombreParada = "", fija = "";
    private double[] parada = new double[]{0, 0};
    private final List<Cand> cands = new ArrayList<>();
    private final Map<String, Long> llegando = new HashMap<>();     // línea → último momento en que TUSSAM la dio a 0–1 min
    private final ArrayDeque<double[]> hist = new ArrayDeque<>();   // {tiempo, lat, lon} de los últimos minutos
    private long inicio = 0, salida = 0, ultimoEnParada = 0;
    private boolean enRuta = false, terminado = false, mock = false, registrado = false;
    private int saltos = 0, proxMin = -1, segMin = -1;
    private String proxLinea = "";
    private Location previa = null;
    private float distParada = -1, distInicial = -1, distMin = Float.MAX_VALUE;

    /* El reloj (en las pruebas se simula) */
    long reloj() { return System.currentTimeMillis(); }

    /* ---------- Notificación única con los avisos de llegada ----------
       Mientras esperas en la parada, si tienes un aviso de llegada en ella, esta notificación lo enseña
       (y la cuenta atrás del aviso se quita): una sola notificación en vez de dos. */
    /* Ya vas en el autobús: la alerta del aviso de esta parada (si sonó) ya no hace falta */
    private void quitarAlertaAviso() {
        try {
            JSONObject a = LlegadaReceiver.avisadoEn(this, codigo);
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (a != null && nm != null) nm.cancel(a.optInt("id"));
        } catch (Exception ignored) { }
    }

    /* Ubicación «todo el tiempo» (Android 10+): hace falta para seguir el viaje sin abrir la app */
    static boolean permisoSiempre(Context c) {
        if (!permiso(c)) return false;
        return Build.VERSION.SDK_INT < 29 || c.checkSelfPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    /* Empieza a seguir el viaje desde un aviso de llegada (sin abrir la app). Devuelve si lo ha intentado. */
    static boolean empezarDesdeAviso(Context c, JSONObject viaje) {
        try {
            if (viaje == null || !permisoSiempre(c) || estado(c) != null || BajadaService.activo(c)) return false;
            JSONObject v = new JSONObject(viaje.toString());
            v.put("fija", "");
            v.put("inicio", System.currentTimeMillis());
            v.put("desdeAviso", true);
            Intent i = new Intent(c, ViajeAutoService.class).putExtra("auto", v.toString());
            if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i); else c.startService(i);
            return true;
        } catch (Exception e) { return false; }   // Android no ha dejado empezarlo ahora: se reintenta más tarde
    }

    static boolean absorbe(Context c, String codigo) {
        if (codigo == null || codigo.isEmpty()) return false;
        android.content.SharedPreferences sp = c.getSharedPreferences(LlegadaReceiver.PREFS, Context.MODE_PRIVATE);
        // Se renueva cada vez que se repinta (cada 20 s): si el servicio murió sin avisar, a los 2 min vuelve la cuenta atrás normal
        return codigo.equals(sp.getString("autoEspera", "")) && System.currentTimeMillis() - sp.getLong("autoEsperaT", 0) < 120_000L;
    }
    static void refrescar(Context c) {
        // Solo si el servicio está esperando en una parada ahora mismo (nunca lo arranca de nuevo)
        android.content.SharedPreferences sp = c.getSharedPreferences(LlegadaReceiver.PREFS, Context.MODE_PRIVATE);
        if (estado(c) == null || !absorbe(c, sp.getString("autoEspera", ""))) return;
        try { c.startService(new Intent(c, ViajeAutoService.class).setAction(ACCION_REFRESCAR)); } catch (Exception ignored) { }
    }
    /* Deja de enseñar los avisos aquí: vuelve su cuenta atrás de siempre */
    private void soltarAvisos() {
        if (!absorbe(this, codigo)) return;
        getSharedPreferences(LlegadaReceiver.PREFS, MODE_PRIVATE).edit().remove("autoEspera").apply();
        try { LlegadaReceiver.reponerCuentas(this, codigo); } catch (Exception ignored) { }
    }

    static String estado(Context c) {
        return c.getSharedPreferences(LlegadaReceiver.PREFS, Context.MODE_PRIVATE).getString("auto", null);
    }

    @Override public IBinder onBind(Intent i) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACCION_PARAR.equals(intent.getAction())) { parar(); return START_NOT_STICKY; }
        // Ha cambiado un aviso de llegada: se repinta la notificación (si ya se está esperando en la parada)
        if (intent != null && ACCION_REFRESCAR.equals(intent.getAction()) && !codigo.isEmpty() && !terminado) {
            if (!enRuta) { ultimaNotif = ""; actualizarEspera(); }
            return START_REDELIVER_INTENT;
        }
        String datos = intent != null ? intent.getStringExtra("auto") : null;
        if (datos == null) datos = estado(this);
        if (datos == null) { stopSelf(); return START_NOT_STICKY; }
        try {
            JSONObject v = new JSONObject(datos);
            codigo = v.optString("codigo"); nombreParada = v.optString("nombre"); fija = v.optString("fija", "");
            parada = new double[]{v.getDouble("lat"), v.getDouble("lon")};
            inicio = v.optLong("inicio", System.currentTimeMillis());
            cands.clear();
            JSONArray ls = v.getJSONArray("lineas");
            for (int i = 0; i < ls.length(); i++) {
                JSONObject l = ls.getJSONObject(i);
                JSONArray ps = l.getJSONArray("paradas");
                if (ps.length() < 3) continue;
                Cand c = new Cand();
                c.linea = l.optString("linea"); c.etq = l.optString("etq", c.linea);
                c.cods = new String[ps.length()]; c.noms = new String[ps.length()]; c.pos = new double[ps.length()][];
                for (int k = 0; k < ps.length(); k++) {
                    JSONObject p = ps.getJSONObject(k);
                    c.cods[k] = p.optString("codigo"); c.noms[k] = p.optString("nombre");
                    c.pos[k] = new double[]{p.getDouble("lat"), p.getDouble("lon")};
                }
                cands.add(c);
            }
            getSharedPreferences(LlegadaReceiver.PREFS, MODE_PRIVATE).edit().putString("auto", v.put("inicio", inicio).toString()).apply();
        } catch (Exception e) { stopSelf(); return START_NOT_STICKY; }
        if (cands.isEmpty()) { parar(); return START_NOT_STICKY; }
        enRuta = false; terminado = false; mock = false; registrado = false; saltos = 0; salida = 0; ultimoEnParada = 0;
        proxMin = -1; segMin = -1; proxLinea = ""; previa = null; distParada = -1; distInicial = -1; distMin = Float.MAX_VALUE; ultimaNotif = "";
        llegando.clear(); hist.clear();
        if (!fija.isEmpty()) sembrarPrevisto();

        canal();
        Notification n = fija("…", fija.isEmpty() ? "🚏 " + nombreParada : "Contando tu viaje en el " + fija);
        if (Build.VERSION.SDK_INT >= 29) startForeground(ID_FIJA, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
        else startForeground(ID_FIJA, n);
        if (!permiso(this)) { parar(); return START_NOT_STICKY; }
        lm = (LocationManager) getSystemService(LOCATION_SERVICE);
        try {
            lm.removeUpdates(this);
            if (lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, Energia.gpsMs(this, 4000), 0, this, Looper.getMainLooper());
            if (lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) lm.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, Energia.gpsMs(this, 8000), 0, this, Looper.getMainLooper());
        } catch (SecurityException e) { parar(); return START_NOT_STICKY; }
        h.removeCallbacksAndMessages(null);
        h.post(mirarTussam);
        h.postDelayed(vigilar, 30_000L);
        return START_REDELIVER_INTENT;
    }

    /* Cuando salta el aviso de llegada o el modo sensor, Android apunta qué bus y a qué hora llega a esa parada.
       Con «Me he subido», eso cuenta como «TUSSAM lo daba llegando» (aunque ya vayas dentro al pulsar). */
    static void apuntarPrevisto(Context c, String codigo, String linea, long llegada) {
        try {
            JSONObject o = new JSONObject().put("codigo", codigo).put("linea", linea).put("llegada", llegada).put("cuando", System.currentTimeMillis());
            c.getSharedPreferences(LlegadaReceiver.PREFS, Context.MODE_PRIVATE).edit().putString("previsto", o.toString()).apply();
        } catch (Exception ignored) { }
    }
    private void sembrarPrevisto() {
        try {
            String s = getSharedPreferences(LlegadaReceiver.PREFS, MODE_PRIVATE).getString("previsto", null);
            if (s == null) return;
            JSONObject o = new JSONObject(s);
            if (!codigo.equals(o.optString("codigo")) || !SensorService.mismaLinea(o.optString("linea"), fija)) return;
            if (System.currentTimeMillis() - o.optLong("cuando") > 20 * 60_000L) return;
            llegando.put(norm(fija), o.optLong("llegada"));
        } catch (Exception ignored) { }
    }

    static boolean permiso(Context c) {
        return Build.VERSION.SDK_INT < 23 || c.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                || c.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private static String norm(String l) { return LlegadaReceiver.normLinea(l); }
    private Cand cand(String linea) {
        for (Cand c : cands) if (SensorService.mismaLinea(c.linea, linea)) return c;
        return null;
    }

    /* Fase de espera: cada 20 s, qué autobuses vienen a tu parada (y cuáles están llegando ya) */
    private final Runnable mirarTussam = new Runnable() {
        public void run() {
            if (terminado || enRuta) return;
            new Thread(new Runnable() { public void run() {
                int p1 = -1, p2 = -1; String l1 = "";
                try {
                    long ahora = System.currentTimeMillis();
                    Map<String, List<Integer>> porLinea = new HashMap<>();
                    Map<String, String> etiqueta = new HashMap<>();
                    for (TussamTiempos.Llegada x : TussamTiempos.tiempos(codigo, TussamTiempos.token(false))) {
                        Cand c = cand(x.linea);
                        if (c == null) continue;
                        String k = norm(c.linea);
                        if (x.minutos <= 1) llegando.put(k, ahora);
                        if (!porLinea.containsKey(k)) porLinea.put(k, new ArrayList<Integer>());
                        porLinea.get(k).add(x.minutos);
                        etiqueta.put(k, c.etq);
                    }
                    // El primero que llega de cualquiera de sus líneas, y el siguiente de esa misma línea
                    for (Map.Entry<String, List<Integer>> e : porLinea.entrySet()) {
                        List<Integer> m = e.getValue();
                        java.util.Collections.sort(m);
                        if (p1 < 0 || m.get(0) < p1) { p1 = m.get(0); p2 = m.size() > 1 ? m.get(1) : -1; l1 = etiqueta.get(e.getKey()); }
                    }
                } catch (Exception ignored) { }
                final int a = p1, b = p2; final String l = l1;
                h.post(new Runnable() { public void run() {
                    if (a >= 0) { proxMin = a; segMin = b; proxLinea = l; }
                    if (!enRuta && !terminado) actualizarEspera();
                } });
            } }).start();
            h.postDelayed(this, 20_000L);
        }
    };

    /* Cada 30 s: ¿se acabó la espera? ¿te has bajado? (también si el GPS deja de dar posiciones) */
    private final Runnable vigilar = new Runnable() {
        public void run() { if (revisarTiempo()) h.postDelayed(this, 30_000L); }
    };
    /* Devuelve false si el viaje (o la espera) se ha acabado */
    boolean revisarTiempo() {
            if (terminado) return false;
            long ahora = reloj();
            if (!enRuta && ahora - inicio > ESPERA_MAX) {
                if (!fija.isEmpty()) noContado(null, "en 25 minutos el GPS no te vio salir de la parada en el autobús");
                parar(); return false;
            }
            if (!enRuta && fija.isEmpty() && distInicial >= 0) {
                // Solo mirabas (desde casa, por ejemplo): en 4 minutos no te has acercado a la parada
                if (ahora - inicio > 4 * 60_000L && distMin > 60 && distParada > distInicial - 40) { parar(); return false; }
                // Estuviste en la parada y te has ido andando sin subirte
                if (distMin <= 60 && distParada > 200) {
                    if (velocidadReciente(ahora) >= 3.5) noContado(null, "estuviste en la parada, pero el GPS no te vio irte por el recorrido de ninguna de sus líneas");
                    parar(); return false;
                }
            }
            if (enRuta && (ahora - salida > RUTA_MAX || bajado(ahora))) { terminar(); return false; }
            return true;
    }

    /* Te has bajado:
       - 3 minutos yendo despacio (andando o parado) y ya fuera del recorrido de la línea, o
       - 6 minutos sin avanzar aunque sigas junto al recorrido (un atasco largo no llega a tanto).
       Un atasco de 2–3 minutos encima del recorrido NO corta el viaje. */
    private boolean bajado(long ahora) {
        if (ahora - salida < 180_000L || hist.isEmpty()) return false;
        double[] ultimo = hist.peekLast();
        if (ahora - (long) ultimo[0] > 360_000L) return true;            // sin posiciones hace mucho
        if (despacio(ahora, 360_000L)) return true;
        if (!despacio(ahora, 180_000L)) return false;
        Cand c = mejorCand();
        return c == null || distAlRecorrido(c, ultimo[1], ultimo[2]) > 60;
    }
    /* Media de velocidad por debajo de 5 km/h en esa ventana de tiempo */
    private boolean despacio(long ahora, long ventana) {
        double[] ultimo = hist.peekLast(), antes = null;
        for (double[] x : hist) if (ahora - (long) x[0] <= ventana) { antes = x; break; }
        if (antes == null || ultimo[0] - antes[0] < ventana * 0.75) return false;
        float[] r = new float[1];
        Location.distanceBetween(antes[1], antes[2], ultimo[1], ultimo[2], r);
        return r[0] / ((ultimo[0] - antes[0]) / 1000.0) < 1.4;
    }

    private double velocidadReciente(long ahora) {
        double[] u = hist.peekLast(), a = null;
        if (u == null) return 0;
        for (double[] x : hist) if (ahora - (long) x[0] <= 30_000L) { a = x; break; }
        if (a == null || u[0] - a[0] < 8_000) return 0;
        float[] r = new float[1];
        Location.distanceBetween(a[1], a[2], u[1], u[2], r);
        return r[0] / ((u[0] - a[0]) / 1000.0);
    }

    @Override
    public void onLocationChanged(Location l) {
        if (l == null || terminado) return;
        if (Build.VERSION.SDK_INT >= 31 ? l.isMock() : (Build.VERSION.SDK_INT >= 18 && l.isFromMockProvider())) mock = true;
        if (l.hasAccuracy() && l.getAccuracy() > 150) return;
        long ahora = reloj();
        double la = l.getLatitude(), lo = l.getLongitude();
        hist.addLast(new double[]{ahora, la, lo});
        while (!hist.isEmpty() && ahora - (long) hist.peekFirst()[0] > 420_000L) hist.pollFirst();
        distParada = BajadaService.dist(parada, la, lo);
        if (distInicial < 0) distInicial = distParada;
        distMin = Math.min(distMin, distParada);
        if (distParada <= EN_PARADA_M) ultimoEnParada = ahora;

        if (!enRuta) {
            // ¿Ha salido el autobús contigo? Lejos de la parada, a velocidad de bus y por el recorrido de alguna línea.
            // (Con «Me he subido» puede que ya vayas dentro al pulsar: no hace falta haberte visto en la parada.)
            double vel = l.hasSpeed() ? Math.max(l.getSpeed(), velocidadReciente(ahora)) : velocidadReciente(ahora);
            if (distParada >= SALIDA_M && vel >= 3.5 && (ultimoEnParada > 0 || !fija.isEmpty())) {
                for (Cand c : cands) {
                    if (distAlRecorrido(c, la, lo) <= 120) {
                        enRuta = true;
                        soltarAvisos();
                        quitarAlertaAviso();
                        salida = ultimoEnParada > 0 ? Math.min(ultimoEnParada, ahora - 15_000L) : ahora - 60_000L;
                        previa = null;
                        break;
                    }
                }
            }
            if (!enRuta) {
                // Te alejas sin subirte (o nunca estuviste cerca): se acaba en silencio
                if (distParada > LEJOS_M && ahora - inicio > 60_000L) {
                    if (!fija.isEmpty() || (distMin <= 60 && vel >= 3.5)) {
                        Cand f = !fija.isEmpty() ? cand(fija) : null;
                        String ruta = f != null ? ", a " + Math.round(distAlRecorrido(f, la, lo)) + " m del recorrido" : "";
                        noContado(f, "te alejaste " + Math.round(distParada) + " m de la parada sin que el GPS te viera ir en el autobús ("
                                + Math.round(vel * 3.6) + " km/h" + ruta + (ultimoEnParada > 0 ? "" : ", nunca te situó en la parada") + ")");
                    }
                    parar(); return;
                }
                actualizarEspera();
                return;
            }
        }

        // En ruta: se comprueba cada línea posible con las posiciones buenas
        boolean buena = !l.hasAccuracy() || l.getAccuracy() <= 60;
        if (buena && previa != null) {
            double dt = (l.getTime() - previa.getTime()) / 1000.0;
            if (dt >= 3 && previa.distanceTo(l) / dt > 34) saltos++;
        }
        if (buena) previa = l;
        // Andando no se avanza de parada (al bajarte puedes ir por la misma calle)
        boolean enMarcha = velocidadReciente(ahora) >= 2.0 || (l.hasSpeed() && l.getSpeed() >= 2.0);
        int vivas = 0, siguen = 0;
        for (Cand c : cands) {
            if (c.fuera) continue;
            if (c.completa) { vivas++; continue; }
            if (buena) {
                c.fixes++;
                if (distAlRecorrido(c, la, lo) <= 170) c.dentro++;
                if (c.fixes >= 6 && c.dentro < c.fixes * 0.6) { c.fuera = true; continue; }
            }
            int mejor = c.actual; float dm = Float.MAX_VALUE;
            for (int i = c.actual; i < c.pos.length; i++) { float d = BajadaService.dist(c.pos[i], la, lo); if (d < dm) { dm = d; mejor = i; } }
            if (dm < CERCA_PARADA_M && enMarcha) c.actual = Math.max(c.actual, mejor);
            vivas++;
            if (c.actual >= c.pos.length - 1) c.completa = true; else siguen++;
        }
        if (vivas == 0) { noContado(null, "el GPS te situó fuera del recorrido de las líneas de esa parada"); parar(); return; }     // no vas por ninguna de sus líneas: no era un autobús de esta parada
        // Todas las líneas posibles han llegado al final de su tramo: el viaje se acaba ahí
        if (siguen == 0) { terminar(); return; }
        Cand b = mejorCand();
        if (b != null) actualizar(b.actual + (b.actual == 1 ? " parada" : " paradas"),
                "En el " + b.etq + " · " + b.actual + (b.actual == 1 ? " parada" : " paradas"),
                "Al bajarte te digo si cuenta para tu Pasaporte");
    }
    @Override public void onStatusChanged(String p, int s, Bundle b) { }
    @Override public void onProviderEnabled(String p) { }
    @Override public void onProviderDisabled(String p) { }

    private static double distAlRecorrido(Cand c, double la, double lo) {
        double d = Double.MAX_VALUE;
        int desde = Math.max(0, c.actual - 1);
        for (int i = desde; i + 1 < c.pos.length; i++) d = Math.min(d, BajadaService.distSegmento(c.pos[i], c.pos[i + 1], la, lo));
        return d;
    }

    /* La línea en la que vas: la que más ha avanzado; a igualdad, la que mejor cuadra y la que estaba llegando */
    private Cand mejorCand() {
        Cand b = null;
        for (Cand c : cands) {
            if (c.fuera) continue;
            if (b == null || c.actual > b.actual) { b = c; continue; }
            if (c.actual == b.actual) {
                double rc = c.fixes == 0 ? 0 : (double) c.dentro / c.fixes, rb = b.fixes == 0 ? 0 : (double) b.dentro / b.fixes;
                Long lc = llegando.get(norm(c.linea)), lb = llegando.get(norm(b.linea));
                if (rc > rb + 0.05 || (Math.abs(rc - rb) <= 0.05 && lc != null && (lb == null || Math.abs(salida - lc) < Math.abs(salida - lb)))) b = c;
            }
        }
        return b;
    }

    /* Fin del viaje: si cuadra, se guarda firmado y llega la notificación de «viaje verificado» */
    void terminar() {
        if (terminado) return;
        Cand c = mejorCand();
        try {
            if (c != null && c.actual >= 1) {
                long fin = reloj();
                double km = 0;
                for (int i = 0; i < c.actual; i++) km += BajadaService.dist(c.pos[i], c.pos[i + 1][0], c.pos[i + 1][1]) / 1000.0;
                double vel = km / Math.max(1e-6, (fin - salida) / 3600000.0);
                Long ll = llegando.get(norm(c.linea));
                boolean busLlegando = ll != null && ll >= salida - 5 * 60_000L && ll <= salida + 60_000L;
                String motivo = null, no = null;
                if (mock) motivo = "la ubicación del móvil era falsa";
                else if (saltos > 0 || vel > 60) motivo = "la posición dio saltos imposibles";
                // No parece un viaje en ese bus: no cuenta, pero se guarda con el motivo (se ve en «Tus últimos viajes»)
                else if (c.actual < 2) no = "solo te vio avanzar 1 parada (hacen falta 2)";
                else if (fin - salida < 90_000L) no = "el viaje duró menos de minuto y medio";
                else if (!busLlegando) no = "TUSSAM no daba ese autobús llegando a tu parada cuando saliste";
                else if (c.fixes < 4) no = "el GPS dio muy pocas posiciones (" + c.fixes + ")";
                else if (c.dentro < c.fixes * 0.7) no = "el GPS te situó fuera del recorrido (" + Math.round(100.0 * c.dentro / c.fixes) + " % de las veces dentro)";
                else if (vel < 4.5) no = "iba demasiado despacio (" + Math.round(vel * 10) / 10.0 + " km/h)";
                if (no != null) noContado(c, no);
                else guardarViaje(c, salida, fin, km, motivo);
            } else noContado(c, "el GPS no te vio pasar por ninguna parada del recorrido");
        } catch (Exception ignored) { }
        parar();
    }

    /* Guarda el viaje firmado y avisa («Viaje verificado en el 27…») */
    void guardarViaje(Cand c, long salida, long fin, double km, String motivo) {
        try {
            JSONObject v = new JSONObject();
            v.put("id", salida + "-" + c.linea);
            v.put("linea", c.etq);
            v.put("desde", c.cods[0]);
            v.put("desdeNombre", c.noms[0]);
            v.put("hasta", c.cods[c.actual]);
            v.put("hastaNombre", c.noms[c.actual]);
            v.put("lat", c.pos[c.actual][0]);
            v.put("lon", c.pos[c.actual][1]);
            v.put("inicio", salida);
            v.put("fin", fin);
            v.put("paradas", c.actual);
            v.put("km", Math.round(km * 100) / 100.0);
            v.put("verificado", motivo == null);
            if (motivo != null) v.put("motivo", motivo);
            v.put("auto", true);
            v.put("firma", Pasaporte.firma(v));
            Pasaporte.guardar(this, v);
            Pasaporte.avisarViaje(this, v);
        } catch (Exception ignored) { }
    }

    /* Viaje que no ha contado: se guarda igualmente, sin verificar y con el motivo, para que se vea
       en «Tus últimos viajes» (no da sellos ni medallas ni cuenta en nada). Sin notificación. */
    void noContado(Cand c, String motivo) {
        if (registrado) return;
        registrado = true;
        try {
            if (c == null && enRuta) c = mejorCand();
            if (c == null && !fija.isEmpty()) c = cand(fija);
            if (c == null && !cands.isEmpty()) c = cands.get(0);
            if (c == null) return;
            long fin = reloj(), ini = salida > 0 ? salida : inicio;
            int hasta = Math.max(0, Math.min(c.actual, c.cods.length - 1));
            JSONObject v = new JSONObject();
            v.put("id", ini + "-" + c.linea + "-no");
            v.put("linea", c.etq);
            v.put("desde", c.cods[0]);
            v.put("desdeNombre", c.noms[0]);
            v.put("hasta", c.cods[hasta]);
            v.put("hastaNombre", c.noms[hasta]);
            v.put("inicio", ini);
            v.put("fin", fin);
            v.put("paradas", hasta);
            v.put("verificado", false);
            v.put("motivo", motivo);
            v.put("auto", true);
            v.put("intento", true);
            Pasaporte.guardar(this, v);
        } catch (Exception ignored) { }
    }

    /* ---------- Notificación ---------- */
    private void canal() {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm != null && nm.getNotificationChannel(CANAL_SILENCIO) == null) {
            NotificationChannel s = new NotificationChannel(CANAL_SILENCIO, "Pasaporte: contando tu viaje", NotificationManager.IMPORTANCE_MIN);
            s.setDescription("Mientras BusSev mira si te subes al autobús para tu Pasaporte. Va escondida al final de las notificaciones.");
            s.setSound(null, null);
            s.enableVibration(false);
            s.setShowBadge(false);
            s.setLockscreenVisibility(Notification.VISIBILITY_SECRET);
            nm.createNotificationChannel(s);
        }
        // Android 16: la isla dinámica de Xiaomi solo recoge canales de importancia normal (como el del modo sensor)
        if (Build.VERSION.SDK_INT >= 36 && nm != null && nm.getNotificationChannel(CANAL_16) == null) {
            NotificationChannel c16 = new NotificationChannel(CANAL_16, "Tu autobús ahora", NotificationManager.IMPORTANCE_DEFAULT);
            c16.setDescription("Al abrir una parada: cuánto le falta a tu autobús, si llegas andando y tu viaje para el Pasaporte.");
            c16.setSound(null, null);
            c16.enableVibration(false);
            nm.createNotificationChannel(c16);
        }
        if (Build.VERSION.SDK_INT < 26 || nm == null || nm.getNotificationChannel(CANAL) != null) return;
        NotificationChannel ch = new NotificationChannel(CANAL, "Tu autobús ahora", NotificationManager.IMPORTANCE_LOW);
        ch.setDescription("Al abrir una parada: cuánto le falta a tu autobús, si llegas andando y tu viaje para el Pasaporte.");
        ch.setSound(null, null);
        ch.enableVibration(false);
        nm.createNotificationChannel(ch);
    }

    /* «¿Llego o no llego?»: andando a ~1 m/s en línea recta (las calles no son rectas), contra lo que le falta al bus */
    static String llego(float metros, int minBus, int minSiguiente) {
        if (metros < 0) return "";
        if (metros <= EN_PARADA_M) return "Estás en la parada";
        if (minBus < 0) return "A " + Math.round(metros / 10f) * 10 + " m de la parada";
        double andando = metros / 60.0, margen = minBus - andando;
        if (margen >= 1.5) return "🟢 Llegas andando con " + (int) Math.floor(margen) + " min de margen";
        if (margen >= 0) return "🟡 Aligera: llegas justo";
        return "🔴 Andando no llegas" + (minSiguiente > 0 ? " · el siguiente, en " + minSiguiente + " min" : "");
    }

    private void actualizarEspera() {
        if (fija.isEmpty()) {
            getSharedPreferences(LlegadaReceiver.PREFS, MODE_PRIVATE).edit().putString("autoEspera", codigo).putLong("autoEsperaT", System.currentTimeMillis()).apply();
            JSONObject av = LlegadaReceiver.avisoEn(this, codigo);
            boolean avisado = false;
            if (av == null) { av = LlegadaReceiver.avisadoEn(this, codigo); avisado = av != null; }
            if (av != null) { unificada(av, avisado); return; }
        }
        String corto = proxMin < 0 ? "…" : proxMin <= 1 ? "Llega" : proxMin + " min";
        String titulo = proxMin < 0 ? "🚏 " + nombreParada
                : "🚏 " + proxLinea + (proxMin <= 1 ? " · está llegando" : " · llega en " + proxMin + " min");
        String texto = llego(distParada, proxMin, segMin);
        actualizar(corto, titulo, texto.isEmpty() ? nombreParada : texto);
    }

    private PendingIntent piParar() {
        Intent i = new Intent(this, ViajeAutoService.class).setAction(ACCION_PARAR);
        int f = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) f |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getService(this, 7603, i, f);
    }

    private Notification fija(String corto, String titulo) { return construir(corto, titulo, nombreParada); }
    private Notification construir(String corto, String titulo, String texto) {
        // Solo contando el viaje (sin aviso de llegada en esta parada): escondida, sin icono arriba ni pantalla de bloqueo
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CANAL_SILENCIO) : new Notification.Builder(this);
        b.setSmallIcon(LlegadaReceiver.icono(this))
                .setContentTitle("Pasaporte de Sevilla")
                .setContentText("Contando tu viaje si te subes")
                .setOngoing(true).setOnlyAlertOnce(true).setShowWhen(false)
                .setCategory(Notification.CATEGORY_SERVICE)
                .setContentIntent(LlegadaReceiver.abrirParada(this, codigo, ID_FIJA))
                .addAction(0, "Parar", piParar());
        if (Build.VERSION.SDK_INT < 26) b.setPriority(Notification.PRIORITY_MIN);
        if (Build.VERSION.SDK_INT >= 21) { b.setColor(0xFF7A1D34); b.setVisibility(Notification.VISIBILITY_SECRET); }
        return b.build();
    }
    /* «Llegas andando…» para la segunda etiqueta: texto y color (0 verde, 1 ámbar, 2 rojo) */
    private Object[] andando(int falta) {
        if (distParada < 0) return null;
        if (distParada <= EN_PARADA_M) return new Object[]{"Estás en la parada", 0};
        double margen = falta - distParada / 60.0;
        if (margen >= 1.5) return new Object[]{"Llegas con " + (int) Math.floor(margen) + " min de margen", 0};
        if (margen >= 0) return new Object[]{"Llegas justo", 1};
        return new Object[]{"Andando no llegas", 2};
    }

    private void unificada(JSONObject av, boolean avisado) {
        long ahora = System.currentTimeMillis();
        long llega = av.optLong("llega", ahora);
        int falta = (int) Math.max(0, Math.ceil((llega - ahora) / 60_000.0));
        String linea = av.optString("linea");
        int id = av.optInt("id");
        String titulo = "Línea " + linea + (falta <= 1 ? " · está llegando" : " · " + falta + " min");
        String p1 = avisado ? "Avisado" : "Aviso a " + av.optInt("antes", 5) + " min";
        Object[] p2 = andando(falta);
        int min0 = Math.max(av.optInt("min0", falta), Math.max(falta, 1));
        int prog = Math.max(0, Math.min(100, Math.round(100f * (min0 - falta) / min0)));
        String corto = falta <= 1 ? "Llega" : falta + " min";
        String resumen = p1 + (p2 != null ? " · " + p2[0] : "");

        String k = "u|" + titulo + "|" + resumen + "|" + prog + "|" + (llega / 15_000L) + "|" + id;
        if (k.equals(ultimaNotif)) return;
        ultimaNotif = k;

        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (!avisado) nm.cancel(LlegadaReceiver.idCuenta(id));   // la cuenta atrás va aquí dentro

        boolean a16 = Build.VERSION.SDK_INT >= 36;   // Android 16: igual que el modo sensor, que sí sale en la isla
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, a16 ? CANAL_16 : CANAL) : new Notification.Builder(this);
        b.setSmallIcon(LlegadaReceiver.icono(this))
                .setContentTitle(titulo)
                .setContentText(resumen)
                .setOngoing(true).setOnlyAlertOnce(true)
                .setCategory(a16 ? Notification.CATEGORY_PROGRESS : Notification.CATEGORY_NAVIGATION)
                .setContentIntent(LlegadaReceiver.abrirParada(this, codigo, ID_FIJA))
                .addAction(0, "Quitar aviso", LlegadaReceiver.piQuitar(this, id))
                .addAction(0, "Parar", piParar());
        if (Build.VERSION.SDK_INT >= 21) b.setColor(0xFFD41C2B);
        LlegadaReceiver.disenoAviso(this, b, titulo, nombreParada, p1, avisado, p2 == null ? null : (String) p2[0],
                p2 == null ? 0 : (Integer) p2[1], prog, llega, falta);
        SensorService.promocionar(b, corto);
        try { nm.notify(ID_FIJA, b.build()); } catch (SecurityException ignored) { }
    }

    private String ultimaNotif = "";
    private void actualizar(String corto, String titulo, String texto) {
        String k = "silencio";   // siempre el mismo texto: no hace falta repintarla
        if (k.equals(ultimaNotif)) return;
        ultimaNotif = k;
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        try { if (nm != null) nm.notify(ID_FIJA, construir(corto, titulo, texto)); } catch (SecurityException ignored) { }
    }

    void parar() {
        terminado = true;
        soltarAvisos();
        try { if (lm != null) lm.removeUpdates(this); } catch (Exception ignored) { }
        h.removeCallbacksAndMessages(null);
        getSharedPreferences(LlegadaReceiver.PREFS, MODE_PRIVATE).edit().remove("auto").apply();
        if (Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_REMOVE); else stopForeground(true);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        try { if (lm != null) lm.removeUpdates(this); } catch (Exception ignored) { }
        h.removeCallbacksAndMessages(null);
        super.onDestroy();
    }

}
