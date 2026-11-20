// Avisos que se repiten, favoritas por cercanía, «Cómo llegar» a una hora y datos para widgets, atajos y botón rápido.
import assert from 'node:assert/strict';
import { arrancar } from './humo.mjs';

const llamadas = [];
let yo = {};
const capacitor = {
  isNativePlatform: () => true,
  isPluginAvailable: (p) => ['BusSevViaje', 'LocalNotifications', 'BusSevWidget'].includes(p),
  nativePromise: async (plugin, metodo, datos) => {
    llamadas.push([plugin, metodo, JSON.parse(JSON.stringify(datos || {}))]);
    if (metodo === 'checkPermissions' || metodo === 'requestPermissions') return { display: 'granted' };
    if (metodo === 'dondeEstoy') return yo;
    if (metodo === 'estadoBajada' || metodo === 'estadoViajeAuto' || metodo === 'estadoSensor') return { activo: false };
    if (metodo === 'viajesPendientes') return { viajes: [] };
    return {};
  },
};
const u = { saldo: 3.6, titulo: 'Bonobús saldo', fecha: Date.now() };
const a = await arrancar({ capacitor, ls: {
  'bussev.settings': { avisarVersion: false, contarViajes: false },
  'bussev.favs': [{ codigo: '2', nombre: 'Menéndez Pelayo' }, { codigo: '3', nombre: 'Otra' }, { codigo: '85', nombre: 'Lejana', alias: 'Trabajo' }],
  'bussev.cards': [{ num: '182387834043', name: 'Mía', color: '#1f4fa0', ultimo: u }],
} });
const ev = (c) => a.w.eval(c);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const de = (m) => llamadas.filter(([, x]) => x === m).map(([, , d]) => d);

// ---------- Avisos que se repiten ----------
ev(`avisoModal({ codigo: '2', parada: 'Menéndez Pelayo', linea: '27', destino: 'Plaza del Duque', minutos: 12, color: '#123456' })`);
await espera(100);
assert.ok(a.$('#av-rep'), 'botón «Repetir este aviso»');
a.$('#av-rep').click();
await espera(150);
const m = a.$('.modal');
assert.equal(m.querySelectorAll('[data-dia]').length, 7);
assert.equal(m.querySelectorAll('[data-dia][aria-pressed="true"]').length, 5, 'de lunes a viernes de serie');
m.querySelector('[data-dia="5"]').click();                 // y el sábado
m.querySelector('#rep-hora').value = '07:40';
m.querySelector('[data-rantes="10"]').click();
m.querySelector('#rep-ok').click();
await espera(150);
const r = de('repetirLlegada').at(-1);
assert.equal(r.hora, 460); assert.equal(r.antes, 10); assert.equal(r.codigo, '2'); assert.equal(r.linea, '27');
assert.deepEqual(r.dias, [true, true, true, true, true, true, false]);
assert.equal(ev(`repetidos.list().length`), 1);
assert.equal(ev(`repetidos.texto(repetidos.list()[0])`), 'L M X J V S desde las 07:40 · cuando falten 10 min');
assert.equal(ev(`repetidos.texto({ dias: [true, true, true, true, true, false, false], hora: 485, antes: 5 })`), 'De lunes a viernes desde las 08:05 · cuando falten 5 min');
// Sale en la ventana del aviso de esa línea y en Ajustes, y se puede quitar
ev(`avisoModal({ codigo: '2', parada: 'Menéndez Pelayo', linea: '27', destino: 'Plaza del Duque', minutos: 12, color: '#123456' })`);
await espera(100);
assert.ok(a.$('.rep-on') && a.$('[data-rep-del]'));
a.$('.modal #av-x').click();
await a.ir('#ajustes', 500);
assert.ok(a.$('[data-rep-quitar]'), 'lista en Ajustes');
a.$('[data-rep-quitar]').click();
await espera(150);
assert.ok(de('quitarRepetido').length === 1 && ev(`repetidos.list().length`) === 0, 'quitado');

// ---------- Favoritas por cercanía ----------
await a.ir('#favoritas', 600);

ev(`settings.favsCerca = true; saveSettings()`);
yo = { lat: 37.39, lon: -5.97 };      // lejos de 2 y 3, más cerca de alguna otra
const p85 = JSON.parse(ev(`JSON.stringify(BUSSEV_DATA.paradas.find((p) => p.codigo === '85'))`));
yo = { lat: p85.latitud, lon: p85.longitud };   // en la parada 85
ev(`cercaniaFavs.t = 0`);
await ev(`cercaniaFavs.actualizar()`);
assert.deepEqual(JSON.parse(ev(`JSON.stringify(cercaniaFavs.ordenar(favs.list()).list.map((f) => f.codigo))`))[0], '85', 'la que tienes al lado, la primera');
await a.ir('#mapa', 200); await a.ir('#favoritas', 600);
assert.match(a.$('.page-head p').textContent, /más cerca/);
// Sin posición (sin permiso): se queda tu orden y no se pregunta nada
yo = {}; ev(`cercaniaFavs.pos = null; cercaniaFavs.t = 0`);
await ev(`cercaniaFavs.actualizar()`);
assert.deepEqual(JSON.parse(ev(`JSON.stringify(cercaniaFavs.ordenar(favs.list()).list.map((f) => f.codigo))`)), ['2', '3', '85']);
assert.ok(!llamadas.some(([, x]) => x === 'requestPermissions' && false));
ev(`settings.favsCerca = false; saveSettings()`);

// ---------- Widgets, botón rápido y atajos: reciben favoritas y saldo ----------
llamadas.length = 0;
ev(`favs.update('3', { alias: 'Casa' })`);
await espera(600);
const cfg = de('setConfig').at(-1);
assert.ok(cfg, 'al cambiar una favorita se avisa a Android');
assert.equal(cfg.favoritas.find((f) => f.codigo === '3').nombre, 'Casa');
assert.equal(cfg.tarjetas[0].nombre, 'Mía'); assert.equal(cfg.tarjetas[0].saldo, '3,60 €'); assert.equal(cfg.tarjetas[0].color, '#1f4fa0');
llamadas.length = 0;
ev(`tarjeta.update('182387834043', { ultimo: { ...tarjeta.list()[0].ultimo, saldo: 1.25 } })`);
await espera(500);
assert.equal(de('setConfig').at(-1)?.tarjetas[0].saldo, '1,25 €', 'el widget de saldo se entera de la consulta nueva');

// ---------- Cómo llegar: salir a una hora / llegar antes de ----------
await a.ir('#ruta', 500);
assert.equal(a.w.document.querySelectorAll('[data-modo]').length, 3);
assert.ok(a.$('#pl-hora-box').hidden, 'con «Salir ahora» no hay hora');
a.$('[data-modo="llegar"]').click();
assert.ok(!a.$('#pl-hora-box').hidden && /^\d\d:\d\d$/.test(a.$('#pl-hora').value), 'con «Llegar antes de» sale la hora');
a.$('[data-hp="5"]').click();
assert.match(a.$('.hp-hora').textContent, /^\d\d:\d[05]$/, '+5 minutos');
assert.match(a.$('.hp-dia').textContent, /hoy|mañana/);
assert.equal(a.errores.length, 0, a.errores.join('\n').slice(0, 2000));
console.log('OK tanda 3: avisos que se repiten, favoritas por cercanía, widgets/atajos y Cómo llegar a una hora');
a.cerrar(); process.exit(0);
