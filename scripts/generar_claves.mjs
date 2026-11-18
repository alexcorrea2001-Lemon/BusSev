// Genera android/app/src/main/java/es/bussev/app/Claves.java con las credenciales de TUSSAM CIFRADAS.
// Las lee del Secret TUSSAM_SECRETS_JS (variable de entorno, con la forma de www/secrets.example.js).
// Nunca las escribe en texto normal ni las enseña en el registro de GitHub.
//
// Ojo: cualquier cosa que va dentro de una app se puede llegar a sacar con tiempo y conocimientos. Esto evita
// que se lean abriendo el APK o buscando texto (y que las encuentren los buscadores de claves de GitHub).
import fs from 'node:fs'; import vm from 'node:vm'; import crypto from 'node:crypto';

const src = process.env.TUSSAM_SECRETS_JS || '';
const ctx = { window: {} };
try { vm.runInNewContext(src, ctx, { timeout: 1000 }); } catch { console.error('El secreto TUSSAM_SECRETS_JS no tiene la forma esperada (mira www/secrets.example.js).'); process.exit(1); }
const c = ctx.window.BUSSEV_TUSSAM || {};
const campos = { clientId: c.clientId, clientSecret: c.clientSecret, usuario: c.user, clave: c.pass };
for (const [k, v] of Object.entries(campos)) {
  if (typeof v !== 'string' || !v) { console.error(`Falta «${k}» en el secreto TUSSAM_SECRETS_JS.`); process.exit(1); }
}

const nombre = () => '_' + crypto.randomBytes(5).toString('hex');
const lista = (a) => a.join(',');
const sal = crypto.randomInt(1, 250);
let decl = '', metodos = '';
for (const [k, v] of Object.entries(campos)) {
  const b = [...Buffer.from(v, 'utf8')];
  const L = b.length + crypto.randomInt(3, 12);
  const key = [...crypto.randomBytes(L)];
  const enc = b.map((x, i) => (x ^ key[(i * 7 + sal) % L] ^ ((i * 31 + sal) & 0xff)) & 0xff);
  // Los datos van partidos en dos trozos, el segundo al revés, y la llave en otro sitio
  const m = Math.floor(enc.length / 2);
  const [na, nb, nk] = [nombre(), nombre(), nombre()];
  decl += `    private static final int[] ${na} = {${lista(enc.slice(0, m))}};\n`;
  decl += `    private static final int[] ${nk} = {${lista(key)}};\n`;
  decl += `    private static final int[] ${nb} = {${lista(enc.slice(m).reverse())}};\n`;
  metodos += `    static String ${k}() { return d(${na}, ${nb}, ${nk}); }\n`;
}
const java = `package es.bussev.app;

/** Generado al compilar (scripts/generar_claves.mjs). No se sube al repositorio. */
final class Claves {
    private Claves() { }
${decl}
    private static String d(int[] a, int[] b, int[] k) {
        byte[] o = new byte[a.length + b.length];
        for (int i = 0; i < o.length; i++) {
            int x = i < a.length ? a[i] : b[b.length - 1 - (i - a.length)];
            o[i] = (byte) (x ^ k[(i * 7 + ${sal}) % k.length] ^ ((i * 31 + ${sal}) & 0xff));
        }
        return new String(o, java.nio.charset.StandardCharsets.UTF_8);
    }
    static boolean hay() { return true; }
${metodos}}
`;
const destino = process.argv[2] || 'android/app/src/main/java/es/bussev/app/Claves.java';
fs.writeFileSync(destino, java);
console.log('Credenciales de TUSSAM cifradas dentro de Android (no van en ningún archivo de texto del APK).');
