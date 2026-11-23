// Paradas de cada línea según la red de TUSSAM EN DIRECTO (la misma que enseña su web).
//
// El GTFS oficial (Punto de Acceso Nacional) solo se publica cada pocos meses. Cuando TUSSAM desvía una línea
// por obras y pone paradas provisionales, su web ya las tiene, pero el GTFS no. Este paso pregunta a TUSSAM las
// paradas de cada línea y sentido y, si no coinciden con las del GTFS, pone las de TUSSAM en www/data.js.
// Así el mapa, la lista de paradas y las «Novedades» van con la red de verdad.
//
//   node scripts/paradas_tussam.mjs <www/data.js> [<data.js de antes>]
//
// Las credenciales llegan SOLO por la variable de entorno TUSSAM_SECRETS_JS (el Secret del repositorio).
// Nunca se escriben ni se enseñan. Si falta algo o TUSSAM no responde bien, no se toca nada (y, si la
// semana pasada ya había paradas de TUSSAM puestas, se conservan). Nunca hace fallar la compilación.
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

const API = 'https://api.tussam.es';
const URL_TOKEN = 'https://auth.tussam.es/auth/realms/TUSSAM-SSO/protocol/openid-connect/token';
const CABECERA = (D) => `/* Paradas, líneas y recorridos de TUSSAM. Fuente: GTFS oficial, válido del ${D.generado} al ${D.caduca}.${D.vivo ? ' Paradas de algunas líneas al día con la red de TUSSAM.' : ''} */\n`;

export const leerDatos = (f) => { const c = { window: {} }; vm.runInNewContext(fs.readFileSync(f, 'utf8'), c); return c.window.BUSSEV_DATA; };
export const escribirDatos = (f, D) => fs.writeFileSync(f, `${CABECERA(D)}window.BUSSEV_DATA=${JSON.stringify(D)};\n`);

const enSevilla = (lat, lon) => lat > 37.1 && lat < 37.7 && lon > -6.3 && lon < -5.6;

/* Nodos de TUSSAM → [{codigo, nombre, latitud, longitud}] (solo los que se entienden). */
export function leerNodos(j) {
  const lista = Array.isArray(j) ? j : Array.isArray(j?.result) ? j.result : [];
  const out = [];
  for (const n of lista) {
    const codigo = String(n?.codigo ?? '');
    const latitud = (n?.posicion?.latitudE6 || 0) / 1e6, longitud = (n?.posicion?.longitudE6 || 0) / 1e6;
    if (!/^\d{1,7}$/.test(codigo) || !enSevilla(latitud, longitud)) continue;
    if (out.length && out[out.length - 1].codigo === codigo) continue;   // repetida seguida
    out.push({ codigo, nombre: String(n?.descripcion?.texto || `Parada ${codigo}`).replace(/\s+/g, ' ').trim().slice(0, 120), latitud, longitud });
  }
  return out;
}

// Cuánto se parecen dos listas de paradas EN ORDEN (subsecuencia común más larga / la más larga): 1 = iguales
const parecido = (a, b) => {
  if (!a.length || !b.length) return 0;
  let prev = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    const cur = [0];
    for (let j = 1; j <= b.length; j++) cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    prev = cur;
  }
  return prev[b.length] / Math.max(a.length, b.length);
};

/* Recorridos del GTFS por «línea|sentido» → [códigos en orden]. */
export function recorridosDe(D) {
  const m = new Map();
  for (const [c, l, s, o] of D.recorridos) { const k = `${l}|${s}`; if (!m.has(k)) m.set(k, []); m.get(k).push([o, String(c)]); }
  for (const [k, v] of m) m.set(k, v.sort((a, b) => a[0] - b[0]).map((x) => x[1]));
  return m;
}

/* Pone en D las paradas de TUSSAM. «vivo» = Map numeroLinea → {1: nodos, 2: nodos} (nodos de leerNodos).
   Devuelve {cambios: ['10|1', …], nuevas: [códigos], saltadas: [motivos]} y deja D.vivo al día. */
export function aplicarVivo(D, vivo, { maxParte = 0.4 } = {}) {
  const R = recorridosDe(D);
  const paradas = new Map(D.paradas.map((p) => [String(p.codigo), p]));
  const propuestas = new Map(), saltadas = [];
  // «01» en el GTFS puede ser «1» en TUSSAM
  const norm = (x) => String(x).toUpperCase().replace(/^0+(?=.)/, '');
  const porNorma = new Map([...vivo].map(([k, v]) => [norm(k), v]));
  for (const l of D.lineas) {
    const n = String(l.numero), v = vivo.get(n) || porNorma.get(norm(n));
    if (!v) continue;
    const g1 = R.get(`${n}|1`) || [], g2 = R.get(`${n}|2`) || [];
    const t1 = (v[1] || []).map((x) => x.codigo), t2 = (v[2] || []).map((x) => x.codigo);
    // ¿El sentido 1 de TUSSAM es el 1 del GTFS? Casi siempre; si encaja mucho mejor al revés, se cruzan.
    const directo = parecido(t1, g1) + parecido(t2, g2), cruzado = parecido(t1, g2) + parecido(t2, g1);
    const pares = cruzado > directo + 0.3 ? [[2, v[1]], [1, v[2]]] : [[1, v[1]], [2, v[2]]];
    for (const [s, nodos] of pares) {
      const g = R.get(`${n}|${s}`);
      if (!g || !nodos || nodos.length < 2) continue;       // sentido que la app no tiene o TUSSAM no da
      const t = nodos.map((x) => x.codigo);
      if (t.join() === g.join()) continue;
      if (parecido(t, g) < 0.5) { saltadas.push(`${n}|${s}: se parece poco al GTFS (${Math.round(parecido(t, g) * 100)} %)`); continue; }
      propuestas.set(`${n}|${s}`, nodos);
    }
  }
  const total = R.size;
  if (propuestas.size > Math.max(3, total * maxParte)) {
    return { cambios: [], nuevas: [], saltadas: [...saltadas, `demasiados cambios (${propuestas.size} de ${total}): no se usa nada`], abortado: true };
  }
  // Sustituye cada línea|sentido en su sitio (mismo orden en el archivo)
  const nuevas = [];
  const hechas = new Set();
  const out = [];
  for (const e of D.recorridos) {
    const k = `${e[1]}|${e[2]}`;
    if (!propuestas.has(k)) { out.push(e); continue; }
    if (hechas.has(k)) continue;
    hechas.add(k);
    propuestas.get(k).forEach((x, i) => out.push([x.codigo, e[1], e[2], i]));
  }
  D.recorridos = out;
  for (const nodos of propuestas.values()) for (const x of nodos) {
    if (paradas.has(x.codigo)) continue;
    const p = { codigo: x.codigo, nombre: x.nombre, latitud: x.latitud, longitud: x.longitud, calle: '', numero: '', codigo_postal: '', municipio: 'Sevilla', direccion_completa: '' };
    paradas.set(x.codigo, p); D.paradas.push(p); nuevas.push(x.codigo);
  }
  const cambios = [...propuestas.keys()].sort();
  // Las que ya llevaban paradas de TUSSAM de otra vez (si hoy no se ha bajado el GTFS) siguen marcadas
  const R2 = recorridosDe(D);
  marcar(D, [...new Set([...(D.vivo?.k || []), ...cambios])].filter((k) => R2.has(k)).sort());
  return { cambios, nuevas, saltadas };
}

/* D.vivo = {h, k}: qué línea|sentido llevan paradas de TUSSAM (y una huella, para el id de las Novedades). */
function marcar(D, claves) {
  if (!claves.length) { delete D.vivo; return; }
  const R = recorridosDe(D);
  const h = crypto.createHash('sha1').update(JSON.stringify(claves.map((k) => [k, R.get(k)]))).digest('hex').slice(0, 8);
  D.vivo = { h, k: claves };
}

/* Si hoy TUSSAM no responde, se conservan las paradas de TUSSAM que ya llevaba la app (si el GTFS es el mismo). */
export function conservarAnteriores(D, antes) {
  if (!antes?.vivo?.k?.length || String(antes.generado) !== String(D.generado)) return [];
  const Ra = recorridosDe(antes), Pa = new Map(antes.paradas.map((p) => [String(p.codigo), p]));
  const vivo = new Map();
  for (const k of antes.vivo.k) {
    const [n, s] = k.split('|');
    if (!Ra.has(k)) continue;
    if (!vivo.has(n)) vivo.set(n, {});
    vivo.get(n)[s] = Ra.get(k).map((c) => ({ codigo: c, ...(Pa.get(c) ? { nombre: Pa.get(c).nombre, latitud: Pa.get(c).latitud, longitud: Pa.get(c).longitud } : {}) }));
  }
  // Solo esas líneas|sentidos (aplicarVivo no toca lo que ya coincide)
  return aplicarVivo(D, vivo).cambios;
}

/* ---------- Preguntar a TUSSAM ---------- */
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const fh = (d = new Date()) => { const z = (x) => String(x).padStart(2, '0'); return `${z(d.getDate())}-${z(d.getMonth() + 1)}-${d.getFullYear()}T${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}`; };

export async function pedirVivo(cred, { fetchFn = fetch, pausa = 250 } = {}) {
  const r = await fetchFn(URL_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ grant_type: 'password', client_id: cred.clientId, client_secret: cred.clientSecret, username: cred.user, password: cred.pass }).toString(),
  });
  if (!r.ok) throw new Error(`TUSSAM no ha dado acceso (${r.status})`);
  const token = (await r.json())?.access_token;
  if (!token) throw new Error('TUSSAM no ha dado acceso');
  const pedir = async (ruta) => {
    for (let i = 0; i < 4; i++) {
      const res = await fetchFn(`${API}${ruta}`, { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } });
      if (res.status === 429 || res.status >= 500) { await espera(pausa * 10 * (i + 1)); continue; }
      if (!res.ok) return null;
      return res.json();
    }
    return null;
  };
  const jl = await pedir(`/INFOTUS/api/v2/lineas?fechaConcreta=${encodeURIComponent(fh())}`);
  const lineas = ((jl?.result ?? jl)?.lineasDisponibles || []).map((x) => ({ id: x.linea, numero: String(x.labelLinea || '') })).filter((x) => x.id && /^[A-Za-z0-9]{1,8}$/.test(x.numero));
  const vivo = new Map();
  for (const l of lineas) {
    const v = {};
    for (const s of [1, 2]) {
      await espera(pausa);
      const j = await pedir(`/INFOTUS/api/v2/nodosLinea/${encodeURIComponent(l.id)}?sentido=${s}&fecha=${encodeURIComponent(fh())}`);
      v[s] = leerNodos(j);
    }
    if (v[1].length || v[2].length) vivo.set(l.numero, v);
  }
  return vivo;
}

export function leerCredenciales(texto) {
  if (!texto) return null;
  try { const c = { window: {} }; vm.runInNewContext(texto, c, { timeout: 1000 }); const t = c.window.BUSSEV_TUSSAM; return t?.clientSecret && t?.user ? t : null; } catch { return null; }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const [, , fDatos, fAntes] = process.argv;
  let D, antes = null;
  try { D = leerDatos(fDatos); } catch (e) { console.log(`No se puede leer ${fDatos}: no se toca nada.`); process.exit(0); }
  try { if (fAntes && fs.existsSync(fAntes)) antes = leerDatos(fAntes); } catch { /* sin copia de antes */ }
  const original = JSON.stringify(D);
  const guardar = () => { if (JSON.stringify(D) !== original) { escribirDatos(fDatos, D); console.log(`${fDatos} actualizado.`); } else console.log('Sin cambios en los datos.'); };
  const plan_b = (motivo) => {
    console.log(`${motivo}`);
    const c = conservarAnteriores(D, antes);
    if (c.length) console.log(`Se conservan las paradas de TUSSAM de la otra vez en: ${c.join(', ')}`);
    guardar();
  };
  try {
    const cred = leerCredenciales(process.env.TUSSAM_SECRETS_JS);
    if (!cred) { plan_b('Sin credenciales de TUSSAM: no se consulta la red en directo.'); process.exit(0); }
    const vivo = await pedirVivo(cred);
    const norm = (x) => String(x).toUpperCase().replace(/^0+(?=.)/, '');
    const enVivo = new Set([...vivo.keys()].map(norm));
    const conocidas = D.lineas.filter((l) => enVivo.has(norm(l.numero))).length;
    if (conocidas < D.lineas.length * 0.5) { plan_b(`TUSSAM solo ha dado ${conocidas} de ${D.lineas.length} líneas: no se usa.`); process.exit(0); }
    const r = aplicarVivo(D, vivo);
    for (const s of r.saltadas) console.log(`  (no se usa ${s})`);
    if (r.abortado) { plan_b('Respuesta de TUSSAM rara.'); process.exit(0); }
    console.log(`TUSSAM en directo: ${conocidas} líneas. ${r.cambios.length ? `Paradas distintas del GTFS en: ${r.cambios.join(', ')}` : 'Todas coinciden con el GTFS.'}${r.nuevas.length ? ` · ${r.nuevas.length} paradas que el GTFS no tenía` : ''}`);
    guardar();
  } catch (e) {
    plan_b(`No se ha podido consultar TUSSAM (${String(e?.message || e).replace(/\s+/g, ' ').slice(0, 80)}${e?.cause?.code ? ` · ${String(e.cause.code).slice(0, 40)}` : ''}).`);
  }
}
