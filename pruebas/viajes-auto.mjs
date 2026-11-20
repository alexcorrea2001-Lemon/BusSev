// Viajes automáticos del Pasaporte: qué se le pasa a Android, cuándo empieza (y cuándo no), «Me he subido» y el ajuste.
import assert from 'node:assert/strict';
import { arrancar } from './humo.mjs';

const llamadas = [];
let yo = {}, bajada = false, autoActivo = false;
const capacitor = {
  isNativePlatform: () => true,
  isPluginAvailable: (p) => ['BusSevViaje', 'LocalNotifications'].includes(p),
  nativePromise: async (plugin, metodo, datos) => {
    llamadas.push([metodo, datos]);
    if (metodo === 'dondeEstoy') return yo;
    if (metodo === 'estadoBajada') return { activo: bajada };
    if (metodo === 'estadoViajeAuto') return { activo: autoActivo };
    if (metodo === 'estadoSensor') return { activo: false };
    if (metodo === 'viajesPendientes') return { viajes: [] };
    return {};
  },
};
const a = await arrancar({ capacitor, ls: { 'bussev.settings': { avisarVersion: false } } });
const ev = (c) => a.w.eval(c);
const J = (c) => JSON.parse(ev(`JSON.stringify(${c})`));
const empezadas = () => llamadas.filter(([m]) => m === 'empezarViajeAuto').map(([, d]) => JSON.parse(JSON.stringify(d)));
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// Las líneas que salen de la parada 2 (Menéndez Pelayo), cada una con sus paradas siguientes
const c = J(`pasaporte.auto.candidatas('2')`);
assert.deepEqual(c.map((x) => x.linea).sort(), ['01', '21', 'A1', 'A3', 'A8', 'C3']);
const l01 = c.find((x) => x.linea === '01');
assert.equal(l01.paradas[0].codigo, '2', 'empieza en tu parada');
assert.ok(l01.paradas.length >= 10 && typeof l01.paradas[3].lat === 'number', 'con coordenadas');
assert.equal(l01.etq, '1');
assert.deepEqual(J(`pasaporte.auto.candidatas('2', '1')`).map((x) => x.linea), ['01'], 'solo la línea pedida (sin ceros)');

// Lejos de la parada (2 km): no empieza nada
yo = { lat: 37.40, lon: -5.97 };
assert.equal(await ev(`pasaporte.auto.quizas(['2'], { forzar: true })`), false);
// Sin permiso o sin posición: tampoco (y nunca pregunta)
yo = {};
assert.equal(await ev(`pasaporte.auto.quizas(['2'], { forzar: true })`), false);
assert.equal(empezadas().length, 0);
// Cerca (a ~100 m de la parada 2): empieza con sus líneas
yo = { lat: 37.3893, lon: -5.9852 };
assert.equal(await ev(`pasaporte.auto.quizas(['2', '3'], { forzar: true })`), true);
let e = empezadas().at(-1);
assert.equal(e.codigo, '2'); assert.equal(e.fija, ''); assert.ok(e.lineas.length >= 2);
// Ya hay uno en marcha o vas con «avísame al bajar»: no se repite
autoActivo = true;
assert.equal(await ev(`pasaporte.auto.quizas(['2'], { forzar: true })`), false);
autoActivo = false; bajada = true;
assert.equal(await ev(`pasaporte.auto.quizas(['2'], { forzar: true })`), false);
bajada = false;
// Como mucho una vez por minuto
assert.equal(await ev(`pasaporte.auto.quizas(['2'])`), false, 'acaba de mirarse');

// Al abrir una parada estando cerca, empieza solo
ev(`pasaporte.auto.ultimo = 0`);
const antes = empezadas().length;
await a.ir('#parada-2', 1300);
assert.equal(empezadas().length, antes + 1, 'abrir la parada lo arranca');

// «Me he subido» (desde el aviso de llegada): abre la parada y cuenta el viaje en esa línea
ev(`busSevSubido('2', '01')`);
await espera(900);
e = empezadas().at(-1);
assert.equal(e.fija, '1'); assert.deepEqual(e.lineas.map((x) => x.linea), ['01']);
assert.match(a.w.location.hash, /parada-2/);

// Apagado en Ajustes: no empieza, y al apagarlo se para el que haya
await a.ir('#ajustes', 500);
const sw = a.$('[data-sw="contarViajes"]');
assert.ok(sw && sw.checked, 'el ajuste existe y viene encendido');
sw.checked = false; sw.dispatchEvent(new a.w.Event('change', { bubbles: true }));
await espera(100);
assert.ok(llamadas.some(([m]) => m === 'pararViajeAuto'), 'al apagarlo se para');
const n = empezadas().length;
assert.equal(await ev(`pasaporte.auto.quizas(['2'], { forzar: true })`), false);
assert.equal(empezadas().length, n);
// Y el Pasaporte lo explica
await a.ir('#pasaporte', 500);
assert.match(a.$('.ps-como').textContent, /Contar mis viajes/);
ev(`settings.contarViajes = true; saveSettings()`);
await a.ir('#tarjeta', 200); await a.ir('#pasaporte', 500);
assert.match(a.$('.ps-como').textContent, /cuentan solos/);
assert.equal(a.errores.length, 0, a.errores.join('\n').slice(0, 2000));
console.log('OK viajes automáticos: candidatas, cerca/lejos, sin repetir, al abrir parada, «Me he subido» y ajuste');
a.cerrar(); process.exit(0);
