package es.bussev.app;

import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

/**
 * Consulta los tiempos de una parada a la API de TUSSAM (la misma que usa la app:
 * OAuth password + /INFOTUS/api/v2/tiempos). Se usa desde el widget, en segundo plano.
 * Las credenciales las escribe la app en SharedPreferences (no viajan en el repo).
 */
class TussamTiempos {
    static final String URL_TOKEN = "https://auth.tussam.es/auth/realms/TUSSAM-SSO/protocol/openid-connect/token";
    static final String API_TIEMPOS = "https://api.tussam.es/INFOTUS/api/v2/tiempos/";

    static class Llegada {
        final String linea;
        final String destino;
        final int minutos;
        final int segundos;   // lo que da TUSSAM, sin redondear (para avisar y contar a tiempo)
        final String color;
        Llegada(String linea, String destino, int segundos, String color) {
            this.linea = linea; this.destino = destino; this.segundos = segundos; this.minutos = segundos / 60; this.color = color;
        }
    }

    static String leer(InputStream in) throws Exception {
        BufferedReader br = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8));
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = br.readLine()) != null) sb.append(line);
        br.close();
        return sb.toString();
    }

    // Token en memoria (TUSSAM los da para 5 minutos): se reutiliza mientras valga
    private static String tokenGuardado = null;
    private static long tokenHasta = 0;

    /** Compatibilidad: antes las credenciales venían de la app; ahora van cifradas dentro de Android (Claves). */
    static String token(SharedPreferences p) throws Exception { return token(false); }

    /** Pide un token a TUSSAM con las credenciales cifradas de Claves (nunca salen de aquí). */
    static synchronized String token(boolean nuevo) throws Exception {
        if (!nuevo && tokenGuardado != null && System.currentTimeMillis() < tokenHasta) return tokenGuardado;
        if (!Claves.hay()) throw new Exception("Faltan las credenciales de TUSSAM en esta compilación");
        String body = "grant_type=password"
                + "&client_id=" + enc(Claves.clientId())
                + "&client_secret=" + enc(Claves.clientSecret())
                + "&username=" + enc(Claves.usuario())
                + "&password=" + enc(Claves.clave());
        HttpURLConnection c = (HttpURLConnection) new URL(URL_TOKEN).openConnection();
        try {
            c.setRequestMethod("POST");
            c.setDoOutput(true);
            c.setConnectTimeout(12000);
            c.setReadTimeout(12000);
            c.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
            c.setRequestProperty("Accept", "application/json");
            OutputStream os = c.getOutputStream();
            os.write(body.getBytes(StandardCharsets.UTF_8));
            os.close();
            if (c.getResponseCode() != 200) { tokenGuardado = null; throw new Exception("token " + c.getResponseCode()); }
            JSONObject j = new JSONObject(leer(c.getInputStream()));
            String t = j.optString("access_token", "");
            if (t.isEmpty()) { tokenGuardado = null; return null; }
            tokenGuardado = t;
            tokenHasta = System.currentTimeMillis() + Math.max(30, j.optInt("expires_in", 300) - 40) * 1000L;
            return t;
        } finally {
            c.disconnect();
        }
    }

    /* TUSSAM a veces cambia lo que pide para los tiempos (25-11-2026: «400» a la petición de siempre):
       se prueban las formas conocidas y se recuerda la que funciona (igual que la parte web). */
    private static int formaTiempos = 0;
    private static String urlTiempos(int forma, String codigo) {
        java.text.SimpleDateFormat f = new java.text.SimpleDateFormat("dd-MM-yyyy'T'HH:mm:ss", java.util.Locale.ROOT);
        String ahora = enc(f.format(new java.util.Date()));
        switch (forma) {
            case 1: return API_TIEMPOS + enc(codigo) + "?fecha=" + ahora;
            case 2: return API_TIEMPOS + enc(codigo) + "?fechaConcreta=" + ahora;
            case 3: return "https://api.tussam.es/INFOTUS/api/v3/tiempos/" + enc(codigo);
            default: return API_TIEMPOS + enc(codigo);
        }
    }
    /* TUSSAM exige la cabecera «deviceid» (25-11-2026), como la app oficial: «A<versión> - <UUID>».
       Aquí no hay contexto a mano, así que el UUID sale siempre igual de las credenciales de esta compilación. */
    private static String deviceId() {
        return "A5.0.6 - " + java.util.UUID.nameUUIDFromBytes(("bussev|" + Claves.usuario()).getBytes(StandardCharsets.UTF_8));
    }
    private static HttpURLConnection abrirTiempos(String url, String token) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setRequestMethod("GET");
        c.setConnectTimeout(12000);
        c.setReadTimeout(12000);
        c.setRequestProperty("Accept", "application/json");
        c.setRequestProperty("Authorization", "Bearer " + token);
        c.setRequestProperty("deviceid", deviceId());
        return c;
    }

    static List<Llegada> tiempos(String codigo, String token) throws Exception {
        HttpURLConnection c = abrirTiempos(urlTiempos(formaTiempos, codigo), token);
        int cod = c.getResponseCode();
        if (cod == 400 || cod == 404) {
            for (int i = 0; i < 4; i++) {
                if (i == formaTiempos) continue;
                HttpURLConnection c2 = abrirTiempos(urlTiempos(i, codigo), token);
                if (c2.getResponseCode() == 200) { c.disconnect(); c = c2; cod = 200; formaTiempos = i; break; }
                c2.disconnect();
            }
        }
        List<Llegada> out = new ArrayList<>();
        try {
            if (cod != 200) throw new Exception("tiempos " + cod);
            JSONObject r = new JSONObject(leer(c.getInputStream()));
            if (r.has("result") && r.opt("result") instanceof JSONObject) r = r.getJSONObject("result");
            JSONArray lineas = r.optJSONArray("lineasCoincidentes");
            if (lineas != null) {
                for (int i = 0; i < lineas.length(); i++) {
                    JSONObject l = lineas.optJSONObject(i);
                    if (l == null) continue;
                    String label = l.optString("labelLinea", "");
                    String color = l.optString("color", "");
                    JSONArray est = l.optJSONArray("estimaciones");
                    if (est == null) continue;
                    for (int k = 0; k < est.length(); k++) {
                        JSONObject e = est.optJSONObject(k);
                        if (e == null || e.isNull("segundos")) continue;
                        int seg = e.optInt("segundos", -1);
                        // -1800 = "más de 30 min"; otros negativos = sin dato
                        if (seg < 0 && seg != -1800) continue;
                        int realSeg = seg == -1800 ? 31 * 60 : seg;
                        String destino = "";
                        JSONObject d = e.optJSONObject("destino");
                        if (d != null) destino = d.optString("texto", "");
                        out.add(new Llegada(label, destino, realSeg, color));
                    }
                }
            }
            Collections.sort(out, new Comparator<Llegada>() {
                public int compare(Llegada a, Llegada b) { return a.minutos - b.minutos; }
            });
            return out;
        } finally {
            c.disconnect();
        }
    }

    static String enc(String s) {
        try { return URLEncoder.encode(s == null ? "" : s, "UTF-8"); } catch (Exception e) { return ""; }
    }
}
