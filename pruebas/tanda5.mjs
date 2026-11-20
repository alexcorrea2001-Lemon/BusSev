// Ahorro de batería y de datos (automático, siempre, nunca) y datos gastados al mes.
import assert from 'node:assert/strict';
import { arrancar } from './humo.mjs';

let est = { ahorroSistema: false, bateria: 80, cargando: false, datosRestringidos: false, medida: true, bytes: 5_000_000, arranque: 1_000_000 };
const capacitor = {
  isNativePlatform: () => true,
  isPluginAvailable: (p) => ['BusSevApariencia'].includes(p),
  nativePromise: async (plugin, metodo) => (metodo === 'energia' ? { ...est } : {}),
};
const a = await arrancar({ capacitor, ls: { 'bussev.settings': { avisarVersion: false, contarViajes: false, refresh: 30 } } });
const ev = (c) => a.w.eval(c);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const leer = async () => { await ev('energia.leer()'); };

await espera(1500);
assert.equal(ev('energia.bateria()'), false);
assert.equal(ev('ritmoReposo(30000)'), 30000, 'ritmo normal');
assert.ok(!a.w.document.documentElement.classList.contains('ahorro'));

// Ahorro de batería de Android
est.ahorroSistema = true; est.bytes = 7_500_000; await leer();
assert.equal(ev('energia.bateria()'), true);
assert.ok(a.w.document.documentElement.classList.contains('ahorro'), 'clase ahorro');
assert.equal(ev('ritmoReposo(30000)'), 60000, 'como mucho cada minuto');
assert.match(ev('refreshNote()'), /ahorro/);
assert.equal(ev('energia.motivo()'), 'el móvil está en ahorro de batería');
// «Nunca» manda
ev(`settings.ahorroBateria = 'nunca'`);
assert.equal(ev('energia.bateria()'), false);
ev(`settings.ahorroBateria = 'auto'`);
// Poca batería sin cargar
est.ahorroSistema = false; est.bateria = 12; await leer();
assert.equal(ev('energia.bateria()'), true);
assert.match(ev('energia.motivo()'), /12 %/);
est.cargando = true; await leer();
assert.equal(ev('energia.bateria()'), false, 'cargando no ahorra');
est.cargando = false; est.bateria = 70; await leer();

// Ahorro de datos
est.datosRestringidos = true; await leer();
assert.equal(ev('energia.datos()'), true);
assert.equal(ev('ritmoReposo(30000)'), 45000);
ev(`settings.ahorroDatos = 'nunca'`); assert.equal(ev('energia.datos()'), false); ev(`settings.ahorroDatos = 'auto'`);

// Datos del mes: primera lectura 0, luego lo que sube; reinicio del móvil; cambio de mes
const d = JSON.parse(ev(`localStorage.getItem('bussev.datosMes')`));
assert.equal(d.bytes, 2_500_000, 'suma lo de entre lecturas');
ev(`localStorage.setItem('bussev.datosMes', JSON.stringify({ mes: '2026-10', bytes: 40_000_000, previos: {}, ult: { arranque: 1_000_000, bytes: 9_000_000 } }))`);
const r = JSON.parse(ev(`JSON.stringify(energia.contar(1_200_000, 99_000_000, new Date(2026, 10, 2)))`));
assert.equal(r.mes, '2026-11'); assert.equal(r.previos['2026-10'], 40_000_000);
assert.equal(r.bytes, 1_200_000, 'tras reiniciar cuenta todo lo nuevo');
const r2 = JSON.parse(ev(`JSON.stringify(energia.contar(1_700_000, 99_030_000, new Date(2026, 10, 3)))`));
assert.equal(r2.bytes, 1_700_000);
assert.equal(ev('energia.mb(1_700_000)'), '1,7 MB');
assert.equal(ev('energia.mb(42_000_000)'), '42 MB');

// Ajustes
est.ahorroSistema = true; await leer();
await a.ir('#ajustes', 600);
const txt = a.$('.view:not([hidden])').textContent;
assert.ok(txt.includes('Ahorro de batería') && txt.includes('Ahorro de datos'));
assert.ok(txt.includes('Ahorrando ahora'), 'dice que está ahorrando');
assert.ok(a.$('.datos-mes') && /Este mes/.test(a.$('.datos-mes').textContent) && /mes pasado, 40 MB/.test(a.$('.datos-mes').textContent), 'datos del mes: ' + a.$('.datos-mes')?.textContent);
a.$('[data-set="ahorroBateria"][data-v="nunca"]').click(); await espera(200);
assert.equal(ev('settings.ahorroBateria'), 'nunca');
assert.ok(!a.w.document.documentElement.classList.contains('ahorro'), 'quita la clase al momento');

assert.deepEqual(a.errores.filter((e) => !/maplibre|mapa/i.test(e)), [], 'sin errores');
// Abrir la app directamente en el Pasaporte (desde la notificación de un sello) ya no falla
const b = await arrancar({ hash: '#pasaporte', ls: { 'bussev.settings': { avisarVersion: false, contarViajes: false } } });
await espera(800);
assert.ok(!b.$('#view-pasaporte').hidden && /Pasaporte/.test(b.$('#view-pasaporte').textContent), 'abre el Pasaporte');
assert.deepEqual(b.errores.filter((e) => !/maplibre|mapa/i.test(e)), [], 'sin errores al abrir en el Pasaporte');
console.log('tanda5: ok');
process.exit(0);
