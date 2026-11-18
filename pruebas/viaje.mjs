// Horario de cada parada, «Cómo llegar» con horario y sitios, aviso de llegada nativo y «avísame al bajar».
import assert from 'node:assert/strict'; import vm from 'node:vm';
import { arrancar } from './humo.mjs';
process.on('uncaughtException', (e) => { console.log('EXCEPCIÓN', String(e.stack).split('\n').slice(0, 6).join(' | ')); process.exit(1); });

// TUSSAM simulado: la parada «vacía» no tiene autobuses; Photon devuelve un hospital
let paradaVacia = null, ghAuth;
const red = async (url, resp, o) => {
  if (/api\.github\.com/.test(url)) { ghAuth = o?.headers?.Authorization ?? null; return resp({ tag_name: 'v1.2.0', body: 'bussev-build:9', assets: [{ name: 'BusSev.apk', url: 'https://api.github.com/repos/yo/BusSev-app/releases/assets/123', browser_download_url: 'https://github.com/yo/BusSev-app/releases/download/v1.2.0/BusSev.apk' }] }); }
  if (/photon\.komoot\.io/.test(url)) return resp({ features: [
    { geometry: { coordinates: [-5.9805, 37.3610] }, properties: { name: 'Hospital Virgen del Rocío', street: 'Avenida Manuel Siurot', district: 'Bellavista', city: 'Sevilla' } },
    { geometry: { coordinates: [-3.70, 40.41] }, properties: { name: 'Hospital de Madrid', city: 'Madrid' } },   // fuera de Sevilla: se descarta
  ] });
  if (paradaVacia && new RegExp(`(paradas/${paradaVacia}/tiempos|tiemposParada/${paradaVacia}|/${paradaVacia})$`).test(url)) return resp({ descripcion: { texto: 'X' }, lineasCoincidentes: [] });
  return null;
};
// Android simulado: se apuntan las llamadas a los plugins nativos
const llamadas = [];
const capacitor = {
  isNativePlatform: () => true, getPlatform: () => 'android',
  isPluginAvailable: (p) => ['BusSevViaje', 'LocalNotifications', 'BusSevWidget'].includes(p),
  nativePromise: async (plugin, metodo, datos) => {
    llamadas.push([plugin, metodo, datos]);
    if (metodo === 'checkPermissions' || metodo === 'requestPermissions') return { display: 'granted' };
    if (metodo === 'estadoBajada') return { activo: true };
    return {};
  },
};
const a = await arrancar({ red, capacitor, ls: { 'bussev.settings': { avisarVersion: false } } });
const ev = (c) => new vm.Script(c).runInContext(a.dom.getInternalVMContext());
a.w.navigator.geolocation = { getCurrentPosition: (ok) => ok({ coords: { latitude: 37.38, longitude: -5.98 } }), watchPosition: () => 1, clearWatch: () => {} };
await a.espera(800);

// ---------- Horario inventado: todas las líneas, un viaje cada 15 min de 06:00 a 23:00, 2 min entre paradas ----------
ev(`(() => {
  const seqs = {};
  for (const [c, l, s, o] of BUSSEV_DATA.recorridos) (seqs[l + '|' + s] ??= [])[o] = c;
  const l = {};
  for (const [k, seq] of Object.entries(seqs)) {
    const v = [360]; for (let t = 375; t <= 1380; t += 15) v.push(15);
    l[k] = { m: seq.map((_, i) => i * 2), v: [v] };
  }
  window.BUSSEV_HORARIOS = { dias: { lun: 0, mar: 0, mie: 0, jue: 0, vie: 0, sab: 0, dom: 0 }, l };
})()`);
const seq29 = JSON.parse(ev(`JSON.stringify(BUSSEV_DATA.recorridos.filter((r) => r[1] === '29' && r[2] === 1).sort((x, y) => x[3] - y[3]).map((r) => r[0]))`));
assert.ok(seq29.length > 10, 'la 29 tiene recorrido');
const p3 = seq29[3];   // cuarta parada de la 29: pasa 6 minutos después de salir de cabecera

// pasosParada: la hora en la parada = salida + minutos desde cabecera
const pasos = JSON.parse(ev(`JSON.stringify(pasosParada('${p3}', new Date(2026, 10, 18, 10, 0)))`));
const p29 = pasos.find((p) => p.linea === '29' && p.sentido === 1);
assert.ok(p29, 'la 29 pasa por la parada');
assert.equal(p29.mins[0], 366, 'primero 06:06 (06:00 + 6 min)');
assert.equal(p29.mins.at(-1), 1386, 'último 23:06');
// La última parada de la línea no cuenta (ahí se baja la gente)
const ultima = seq29.at(-1);
const enUltima = JSON.parse(ev(`JSON.stringify(pasosParada('${ultima}', new Date(2026, 10, 18, 10, 0)))`)).filter((p) => p.linea === '29' && p.sentido === 1);
if (seq29[0] !== ultima) assert.equal(enUltima.length, 0, 'en la última parada no se ofrece la 29 de ese sentido');
// Resumen: a las 10:00 pasa cada 15 min, próximo 10:06
const res = JSON.parse(ev(`JSON.stringify(resumenPasos(pasosParada('${p3}', new Date(2026, 10, 18, 10, 0)).find((p) => p.linea === '29' && p.sentido === 1), 600))`));
assert.equal(res.cada, 15); assert.equal(res.sig, 606);
// De madrugada (01:30) ya no pasa: los primeros de mañana
const prox = JSON.parse(ev(`JSON.stringify(proximosProgramados('${p3}', new Date(2026, 10, 18, 1, 30), 50))`));
assert.equal(prox.manana, true, 'a la 1:30 ya no pasa: los primeros de la mañana');
assert.equal(prox.lista.find((x) => x.linea === '29' && x.sentido === 1)?.m, 366, 'los de esta misma mañana (06:06), no los de pasado mañana');
const prox2 = JSON.parse(ev(`JSON.stringify(proximosProgramados('${p3}', new Date(2026, 10, 18, 23, 50)))`));
assert.equal(prox2.manana, true, 'a las 23:50 ya no pasa nada: los de mañana');
assert.ok(prox2.lista.length >= 1);

// Pantalla de la parada: sección de horario y, sin autobuses, los próximos según horario
paradaVacia = p3;
await a.ir(`#parada-${p3}`, 1600);
const det = a.$('#p-horario details.p-horario');
assert.ok(det, 'sección «Horario en esta parada»');
assert.match(det.textContent, /Primero \d\d:\d\d · último \d\d:\d\d/);
assert.ok(a.$('#p-board .prog'), 'sin tiempos: próximos según el horario');
assert.match(a.$('#p-board').textContent, /Según el horario oficial/);
// Botón «Cómo llegar aquí»
assert.ok(a.$('#p-ruta'), 'botón Cómo llegar aquí en la parada');
paradaVacia = null;

// ---------- Cómo llegar: con horario cuenta la espera y dice a qué hora llegas ----------
const pos = (c) => JSON.parse(ev(`JSON.stringify((() => { const p = BUSSEV_DATA.paradas.find((x) => x.codigo === '${c}'); return [p.latitud, p.longitud]; })())`));
const o = pos(seq29[1]), d = pos(seq29[Math.min(seq29.length - 2, 14)]);
const ops = JSON.parse(ev(`JSON.stringify(planner.buscar(${JSON.stringify(o)}, ${JSON.stringify(d)}, new Date(2026, 10, 18, 10, 0)))`));
assert.ok(ops.length, 'hay opciones');
assert.ok(ops.every((x) => x.llega != null), 'todas con hora de llegada');
assert.ok(ops.some((x) => x.tramos[0].k.startsWith('29|')), 'la 29 está entre las opciones');
// A las 03:00 (sin Búho en este horario inventado) no circula nada
const noche = JSON.parse(ev(`(() => { const r = planner.buscar(${JSON.stringify(o)}, ${JSON.stringify(d)}, new Date(2026, 10, 18, 3, 0)); return JSON.stringify({ n: r.length, sin: r.sinServicio }); })()`));
assert.equal(noche.n, 0, 'de madrugada no propone líneas que no circulan'); assert.ok(noche.sin > 0);

// Buscar un sitio (Photon) y llegar desde el mapa / parada con el destino puesto
await a.ir('#ruta', 500);
const inp = a.$('#pl-d');
inp.value = 'hospital virgen'; inp.dispatchEvent(new a.w.Event('input'));
await a.espera(700);
const lugar = a.$('#pl-d-s [data-lg]');
assert.ok(lugar, 'sugiere el sitio');
assert.match(lugar.textContent, /Hospital Virgen del Rocío/);
assert.equal(a.w.document.querySelectorAll('#pl-d-s [data-lg]').length, 1, 'el de Madrid se descarta');
lugar.click();
assert.equal(inp.value, 'Hospital Virgen del Rocío');
ev(`irARuta({ tipo: 'parada', nombre: 'Prueba', pos: ${JSON.stringify(d)}, codigo: '${seq29[14]}' })`);
await a.espera(50);
await a.ir('#favoritas', 300); ev(`irARuta({ tipo: 'parada', nombre: 'Prueba', pos: ${JSON.stringify(d)}, codigo: '${seq29[14]}' })`);
await a.espera(900);
assert.equal(a.w.location.hash, '#ruta');
assert.equal(a.$('#pl-d').value, 'Prueba', 'destino ya puesto');
assert.ok(a.$('#pl-res .card.plan'), 'busca solo y encuentra opciones');
assert.ok(a.$('#pl-res [data-bajar]'), 'botón Avísame al bajar en cada opción');

// ---------- Aviso de llegada: con la versión nueva de Android lo vigila el móvil (no la notificación fija) ----------
llamadas.length = 0;
await ev(`avisos.programar({ codigo: '${p3}', parada: 'Prueba', linea: '29', destino: 'TORREBLANCA', minutos: 12, antes: 5 })`);
assert.ok(llamadas.some(([p, m]) => p === 'BusSevViaje' && m === 'vigilarLlegada'), 'lo vigila Android');
assert.ok(!llamadas.some(([p, m]) => p === 'LocalNotifications' && m === 'schedule'), 'sin notificación duplicada');
const v = llamadas.find(([, m]) => m === 'vigilarLlegada')[2];
assert.equal(v.antes, 5); assert.ok(Math.abs(v.at - (Date.now() + 7 * 60000)) < 5000, 'a los 7 min (12 - 5)');
const idAviso = v.id;
await ev(`avisos.cancelar(${idAviso})`);
assert.ok(llamadas.some(([p, m, x]) => p === 'BusSevViaje' && m === 'quitarLlegada' && x.id === idAviso), 'quitar también en Android');

// ---------- Avísame al bajar ----------
const tramo = JSON.parse(ev(`JSON.stringify(bajada.tramo('29|1', '${seq29[2]}', '${seq29[6]}'))`));
assert.equal(tramo.length, 5); assert.equal(tramo[0].codigo, seq29[2]); assert.equal(tramo.at(-1).codigo, seq29[6]);
ev(`bajada.elegir('${seq29[2]}', '29', '')`);
await a.espera(50);
const ops2 = [...a.w.document.querySelectorAll('.modal .bj-op')];
assert.ok(ops2.length >= 3, 'lista de paradas donde bajarse');
llamadas.length = 0;
ops2.find((b) => b.dataset.c === seq29[6] && b.dataset.k === '29|1').click();
await a.espera(300);
const emp = llamadas.find(([p, m]) => p === 'BusSevViaje' && m === 'empezarBajada');
assert.ok(emp, 'empieza el aviso en Android');
assert.equal(emp[2].paradas.length, 5); assert.equal(emp[2].linea, '29');
await a.ir('#favoritas', 600);
assert.ok(a.$('#fav-bajada .bj-activo'), 'Favoritas enseña el aviso activo');
a.$('#fav-bajada [data-bj-parar]').click();
await a.espera(200);
assert.ok(llamadas.some(([p, m]) => p === 'BusSevViaje' && m === 'pararBajada'));
assert.equal(JSON.parse(a.w.localStorage.getItem('bussev.bajada')), null);

// ---------- Repositorio privado: la app busca y descarga las versiones con el permiso de solo lectura ----------
ev(`window.BUSSEV_VERSION = { build: 5, version: '1.0.0', repo: 'yo/BusSev-app' }; window.BUSSEV_GH = { token: 'github_pat_${'x'.repeat(40)}' };`);
const r = JSON.parse(await ev(`actualizaciones.buscar().then((x) => JSON.stringify(x))`));
assert.equal(ghAuth, 'Bearer github_pat_' + 'x'.repeat(40), 'manda el permiso a la API de GitHub');
assert.equal(r.estado, 'nueva');
assert.equal(r.url, 'https://api.github.com/repos/yo/BusSev-app/releases/assets/123', 'descarga por la API (privado)');
ev(`window.BUSSEV_GH = { token: 'mal token con espacios' }`);
const r2 = JSON.parse(await ev(`actualizaciones.buscar().then((x) => JSON.stringify(x))`));
assert.equal(ghAuth, null, 'un permiso raro no se manda'); assert.match(r2.url, /releases\/download/);
ev(`window.BUSSEV_GH = undefined`);

// Cerca: minutos andando
assert.match(ev(`stopCardHTML({ codigo: '1', nombre: 'X' }, { tiempos: [], status: 'ok', distancia: 300 })`), /🚶 5 min \(300 m\)/);

assert.equal(a.errores.length, 0, a.errores.join('\n').slice(0, 2000));
console.log('OK horario por parada, Cómo llegar, aviso nativo y avísame al bajar');
a.cerrar(); process.exit(0);
