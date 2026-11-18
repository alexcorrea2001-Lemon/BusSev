package es.bussev.app;

/**
 * Credenciales de la API de TUSSAM.
 *
 * Este archivo del repositorio va VACÍO a propósito. Al compilar, GitHub lo sustituye por uno generado
 * (scripts/generar_claves.mjs) con las credenciales del Secret TUSSAM_SECRETS_JS cifradas y repartidas,
 * para que no se puedan leer abriendo el APK. No escribas aquí las credenciales.
 */
final class Claves {
    private Claves() { }
    static boolean hay() { return false; }
    static String clientId() { return ""; }
    static String clientSecret() { return ""; }
    static String usuario() { return ""; }
    static String clave() { return ""; }
}
