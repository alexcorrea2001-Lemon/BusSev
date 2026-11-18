import assert from 'node:assert/strict'; import fs from 'node:fs'; import vm from 'node:vm';
import { arrancar } from './humo.mjs';
const TMP = process.env.PRUEBAS_TMP || (await import('node:os')).tmpdir();
const R = process.argv[2];
process.on('uncaughtException', (e) => { console.log('EXCEPCIÓN', String(e.stack).split('\n').slice(0, 5).join(' | ')); process.exitCode = 1; setTimeout(() => process.exit(1), 200); });
const nov = JSON.parse(fs.readFileSync(`${TMP}/nov.json`, 'utf8'));
const cuerpo = (build, n) => `Texto.\nCompilación ${build}.\n<!-- bussev-build:${build} -->\n<!-- bussev-novedades:${n ? Buffer.from(JSON.stringify(n), 'utf8').toString('base64') : ''} -->`;
const V = { version: '1.3.6', build: 170, fecha: '2026-11-14', repo: 'alexcorrea2001-Lemon/BusSev-app' };
const APK = 'https://github.com/alexcorrea2001-Lemon/BusSev-app/releases/download/v1.3.6/BusSev.apk';
console.log("bloque 1"); // --- 1) Nocturnos desde las 23:50; azul más claro; opción satélite; icono de avisos
{ const a = await arrancar(); await a.espera(400);
  const ctx = a.dom.getInternalVMContext(); const ev = (c) => new vm.Script(c).runInContext(ctx);
  const hora = (h, m) => ev(`esHoraNoche(new Date(2026, 10, 14, ${h}, ${m}))`);
  assert.deepEqual([hora(22, 30), hora(23, 49), hora(23, 50), hora(0, 10), hora(5, 59), hora(6, 0), hora(12, 0)], [false, false, true, true, true, false, false], 'nocturnos de 23:50 a 6:00');
  assert.equal(ev(`safeColor('#000d6f')`), ev('AZUL_LINEAS')); assert.equal(ev(`safeColor('#000D6F')`), ev('AZUL_LINEAS')); assert.equal(ev(`safeColor('#f7a800')`), '#f7a800');
  for (const h of ['#lineas', '#parada-194', '#linea-29', '#favoritas']) { await a.ir(h, 900); assert.ok(!/000d6f/i.test(a.w.document.body.innerHTML), `queda azul marino en ${h}`); }
  await a.ir('#parada-194', 1600); const m = a.mapas.at(-1); const cols = new Set((m.fuentes['bs-paths']?.features || []).map((f) => f.properties.color));
  assert.ok(cols.size && ![...cols].some((c) => /000d6f/i.test(c)), 'el camino en el mapa usa el azul nuevo: ' + [...cols]);
  await a.ir('#ajustes', 400);
  const sat = a.w.document.querySelector('[data-k="mapStyle"][data-v="satelite"], [data-set="mapStyle"][data-v="satelite"]') || [...a.w.document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Satélite');
  assert.ok(sat, 'botón Satélite en Ajustes'); sat.click(); await a.espera(100);
  assert.equal(JSON.parse(a.w.localStorage.getItem('bussev.settings')).mapStyle, 'satelite'); assert.equal(ev('styleUrl()'), '/map/satelite.json'); assert.match(ev('creditoMapa()'), /Instituto Geográfico Nacional/);
  const st = JSON.parse(fs.readFileSync(R + 'www/map/satelite.json', 'utf8')); assert.equal(st.layers[1].type, 'raster'); assert.match(st.sources.pnoa.tiles[0], /^https:\/\/www\.ign\.es\/wmts\/pnoa-ma\?.*\{z\}.*\{y\}.*\{x\}/);
  assert.equal(a.errores.length, 0, a.errores.join('\n').slice(0, 500)); a.cerrar(); }
console.log("bloque 2"); // --- 2) Tras actualizar: «Novedades de esta versión» una sola vez (y nunca en una instalación nueva)
{ const red = (url, resp) => (/novedades\.json/.test(url) ? resp(nov) : null);
  const a = await arrancar({ version: V, red, ls: { 'bussev.buildVisto': 165, 'bussev.settings': { avisarVersion: false } } }); await a.espera(3300);
  const m = a.$('.modal'); assert.ok(m && /Novedades de esta versión/.test(m.textContent), 'sale el aviso de novedades tras actualizar');
  assert.match(m.textContent, /Líneas nuevas/); assert.match(m.textContent, /44 · Línea Nueva - Prueba/);
  assert.equal(JSON.parse(a.w.localStorage.getItem('bussev.buildVisto')), 170); a.cerrar();
  const b = await arrancar({ version: V, red, ls: { 'bussev.buildVisto': 170, 'bussev.novedadesVistas': nov.id, 'bussev.settings': { avisarVersion: false } } }); await b.espera(3300);
  assert.equal(b.$('.modal'), null, 'no se repite'); b.cerrar();
  const c = await arrancar({ version: V, red, ls: { 'bussev.settings': { avisarVersion: false } } }); await c.espera(3300);
  assert.equal(c.$('.modal'), null, 'instalación nueva: sin aviso'); assert.equal(c.w.localStorage.getItem('bussev.novedadesVistas'), JSON.stringify(nov.id)); c.cerrar(); }
console.log("bloque 3"); // --- 3) Aviso de versión nueva con los cambios, y descarga + instalación dentro de la app
{ const llamadas = []; let bajado = 0, permiso = false;
  const capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', nativePromise: async (plugin, metodo, datos) => {
    if (plugin !== 'Actualizador') throw new Error('not implemented'); llamadas.push(metodo + (datos?.url ? ':' + datos.url : ''));
    if (metodo === 'estado') { bajado = Math.min(8e6, bajado + 4e6); return { bajado, total: 8e6, hecho: bajado >= 8e6, activo: bajado < 8e6 }; }
    if (metodo === 'instalar') { const r = { permiso }; permiso = true; return r; }
    return {}; } };
  const red = (url, resp) => (/api\.github\.com/.test(url) ? resp({ tag_name: 'v1.3.6', body: cuerpo(171, nov), assets: [{ name: 'BusSev.apk', browser_download_url: APK }] }) : /novedades\.json/.test(url) ? resp('', 404) : null);
  const a = await arrancar({ version: V, red, capacitor, ls: { 'bussev.buildVisto': 170 } }); await a.espera(4800);
  let m = a.$('.modal'); assert.ok(m && /Hay una versión nueva/.test(m.textContent), 'aviso de versión nueva: ' + (m?.textContent || 'sin ventana') + a.errores.join('|'));
  assert.match(m.textContent, /Qué cambia en las líneas y paradas/); assert.match(m.textContent, /Paradas nuevas/);
  a.$('#upd-ok').click(); await a.espera(1400);
  m = a.$('.modal'); assert.match(m.textContent, /Actualizando BusSev/);
  assert.ok(llamadas.includes('descargar:' + APK), 'se descarga dentro de la app: ' + llamadas); assert.ok(llamadas.includes('instalar'));
  assert.match(a.$('#upd-txt').textContent, /Permitir de esta fuente/, 'pide el permiso la primera vez');
  assert.equal(a.$('#upd-prog').style.width, '100%');
  a.$('#upd-inst').click(); await a.espera(100);
  assert.match(a.$('#upd-txt').textContent, /Se ha abierto el instalador/);
  assert.ok(llamadas[0] === 'limpiar' || llamadas.includes('limpiar'), 'al abrir la app borra descargas antiguas');
  assert.equal(a.errores.length, 0, a.errores.join('\n').slice(0, 500)); a.cerrar(); }
console.log("bloque 4"); // --- 4) Móvil con una versión antigua sin el componente: se abre el navegador como antes
{ const abiertos = [];
  const capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', isPluginAvailable: (p) => p === 'Browser', nativePromise: async (plugin, metodo, datos) => { if (plugin === 'Browser' && metodo === 'open') { abiertos.push(datos.url); return {}; } throw new Error('"Actualizador" plugin is not implemented on android'); } };
  const a = await arrancar({ version: V, capacitor }); await a.espera(500);
  new vm.Script(`instalarActualizacion(${JSON.stringify(APK)})`).runInContext(a.dom.getInternalVMContext()); await a.espera(600);
  assert.deepEqual(abiertos, [APK], 'sin componente: descarga por el navegador'); a.cerrar(); }
console.log('OK app 2 (nocturnos, azul, satélite, novedades, actualización en la app)');
process.exit(0);
