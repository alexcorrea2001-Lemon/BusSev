// Prueba del aviso de versión nueva (bloque «actualizaciones» de www/app.js con el entorno simulado)
import fs from 'node:fs'; import vm from 'node:vm'; import assert from 'node:assert/strict';
const src = fs.readFileSync(process.argv[2] + 'www/app.js', 'utf8');
const ini = src.indexOf('const novedades = {'), fin = src.indexOf('/* Animación de carga', ini);
const bloque = src.slice(ini, fin);
function entorno({ build = 164, remota = 165, falla = false } = {}) {
  const datos = {}; const e = { modales: 0, fetchs: 0, remota, falla, ahora: 1_800_000_000_000, vis: [] };
  const ctx = {
    window: { BUSSEV_VERSION: { version: '1.3.6', build, fecha: '2026-11-13', repo: 'a/b' } },
    settings: { avisarVersion: true }, saveSettings() {}, toast() {}, esc: (s) => String(s), openWeb() {}, energia: { datos: () => false, est: {} },
    store: { get: (k, d) => (k in datos ? datos[k] : d), set: (k, v) => { datos[k] = v; } },
    document: { querySelector: () => null, visibilityState: 'visible', addEventListener: (t, f) => { if (t === 'visibilitychange') e.vis.push(f); } },
    $: () => ({ addEventListener() {}, set onclick(v) {} }),
    openModal: () => { e.modales++; },
    setTimeout: (f) => { e.pend = f; }, clearTimeout() {}, AbortController, URL, Number, String, Math, console, atob, TextDecoder, Uint8Array, JSON, Array, isNative: () => false, descargarApp() {},
    Date: class extends Date { static now() { return e.ahora; } },
    fetch: async () => { e.fetchs++; if (e.falla) throw new Error('sin red'); return { ok: true, status: 200, json: async () => ({ tag_name: 'v1.3.6', body: `x <!-- bussev-build:${e.remota} -->`, assets: [{ name: 'BusSev.apk', browser_download_url: 'https://github.com/a/b/releases/download/v1.3.6/BusSev.apk' }] }) }; },
  };
  vm.runInNewContext(bloque + '\nthis.A = actualizaciones;', ctx);
  return { e, A: ctx.A, datos, ctx };
}
const H = 3600_000;
// 1) Has pulsado «Buscar actualización» hace 1 h y después sale una compilación nueva: al abrir la app debe avisar
{ const { e, A } = entorno({ remota: 164 }); await A.buscar(); e.ahora += H; e.remota = 165; await A.revisarSola(); assert.equal(e.modales, 1, 'debe avisar aunque se haya buscado a mano hace poco'); }
// 2) Sin conexión al abrir: no cuenta como revisada; al volver a la app con conexión, avisa
{ const { e, A } = entorno({ falla: true }); await A.revisarSola(); assert.equal(e.modales, 0); e.falla = false; e.ahora += 60_000; await A.revisarSola(); assert.equal(e.modales, 1, 'tras un fallo de red debe reintentar'); }
// 3) Avisada y «Ahora no»: no repite en la misma tarde, pero lo recuerda al día siguiente; y una compilación aún más nueva avisa enseguida
{ const { e, A } = entorno(); await A.revisarSola(); e.ahora += 2 * H; await A.revisarSola(); assert.equal(e.modales, 1, 'no repite a las 2 h');
  e.remota = 166; e.ahora += H; await A.revisarSola(); assert.equal(e.modales, 2, 'otra compilación más nueva: avisa');
  e.ahora += 13 * H; await A.revisarSola(); assert.equal(e.modales, 3, 'recordatorio pasado medio día'); }
// 4) Al día: no avisa y no machaca a GitHub (una consulta, no una por cada vez que vuelves a la app)
{ const { e, A } = entorno({ remota: 164 }); await A.revisarSola(); e.ahora += 60_000; await A.revisarSola(); assert.equal(e.modales, 0); assert.equal(e.fetchs, 1); }
// 5) Desactivado en Ajustes: nada
{ const { e, A, ctx } = entorno(); ctx.settings.avisarVersion = false; await A.revisarSola(); assert.equal(e.modales + e.fetchs, 0); }
// 6) Se mira también al VOLVER a la app (Android la deja abierta en segundo plano), no solo al arrancarla
{ const { e } = entorno(); assert.ok(e.vis.length >= 1, 'debe revisar al volver a la app'); }
console.log('OK aviso de versión');
