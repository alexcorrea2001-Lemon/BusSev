// Colores «Como mi móvil» y Negro puro, esqueletos de carga, mapa de sellos (qué línea te lleva) y consejos.
import assert from 'node:assert/strict';
import { arrancar } from './humo.mjs';

const capacitor = {
  isNativePlatform: () => true,
  isPluginAvailable: (p) => ['BusSevApariencia'].includes(p),
  nativePromise: async (plugin, metodo) => {
    if (metodo === 'colorSistema') return { a100: '#E0E8FF', a200: '#B6C6FF', a600: '#3D5BC4', a800: '#1E3480', a900: '#0B1A4D' };
    return {};
  },
};
const a = await arrancar({ capacitor, ls: {
  'bussev.settings': { avisarVersion: false, contarViajes: false },
  'bussev.favs': [{ codigo: '2', nombre: 'Menéndez Pelayo' }],
} });
const ev = (c) => a.w.eval(c);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Colores ----------
assert.equal(ev(`FONDOS.negro.bg`), '#000000', 'fondo Negro puro');
await espera(900);
assert.equal(ev(`PALETTES.movil?.light[0]`), '#3D5BC4', 'color del sistema');
assert.equal(ev(`JSON.parse(localStorage.getItem('bussev.colorMovil') || 'null')?.dark?.[0]`), '#B6C6FF', 'se guarda para no parpadear');
await a.ir('#ajustes', 500);
const sw = a.$('.swatches .swatch');
assert.ok(sw.classList.contains('swatch-movil') && sw.dataset.color === 'movil', 'el primero es «Como mi móvil»');
assert.ok(a.$('[data-fondo="negro"]'), 'botón Negro puro');
sw.click(); await espera(200);
assert.equal(ev(`settings.color`), 'movil');
a.$('[data-fondo="negro"]').click(); await espera(200);
assert.equal(ev(`getComputedStyle(document.documentElement).getPropertyValue('--bg').trim().toLowerCase()`), '#000000');

// ---------- Esqueletos ----------
assert.ok(ev(`skeletons(2)`).includes('sk-fila') && ev(`skeletons(2)`).includes('aria-busy'), 'skeletons');
assert.equal((ev(`esqueletoTiempos(4)`).match(/sk-fila/g) || []).length, 4);

// ---------- Sin View Transitions el cambio de pantalla funciona igual ----------
ev(`delete document.startViewTransition`);
await a.ir('#parada-2', 400);
assert.ok(a.$('#view-parada') || a.$('.detail-head'), 'abre la parada');
await a.ir('#favoritas', 400);

// ---------- Mapa de sellos: qué línea te lleva ----------
ev(`window.BUSSEV_DATA = { paradas: [
  { codigo: '2', nombre: 'Origen', latitud: 37.38, longitud: -5.97 },
  { codigo: '10', nombre: 'Intermedia', latitud: 37.383, longitud: -5.975 },
  { codigo: '11', nombre: 'Junto al sitio', latitud: 37.386, longitud: -5.99 },
], recorridos: [['2','27',1,1],['10','27',1,2],['11','27',1,3],['2','C1',1,5],['11','C1',1,6]] }`);
const lugar = ev(`JSON.stringify(['prueba', 'Sitio de prueba', 37.3862, -5.9901, 150, 'giralda', '#000'])`);
const ls = ev(`JSON.stringify(pasaporte.lineasHacia('2', ${lugar}))`);
assert.deepEqual(JSON.parse(ls), [{ linea: 'C1', paradas: 1, hasta: '11', andando: 1 }, { linea: '27', paradas: 2, hasta: '11', andando: 1 }], 'directas, la más corta primero');
assert.deepEqual(JSON.parse(ev(`JSON.stringify(pasaporte.lineasHacia('999', ${lugar}))`)), []);
const id = ev(`pasaporte.LUGARES[0][0]`);
ev(`pasaporte.fichaLugar('${id}')`); await espera(150);
assert.ok(a.$('.modal #lf-ir'), 'ficha con «Cómo llegar»');
a.$('.modal #lf-ir').click(); await espera(400);
assert.equal(a.w.location.hash, '#ruta');

// ---------- Consejos ----------
await a.ir('#favoritas', 400);
let c = a.$('[data-consejo]');
assert.ok(c, 'sale un consejo');
const primero = c.dataset.consejo;
c.querySelector('button[data-consejo-ok]').click(); await espera(100);
assert.ok(!a.$('[data-consejo]'), 'Entendido lo quita');
await a.ir('#ajustes', 300); await a.ir('#favoritas', 400);
assert.ok(!a.$('[data-consejo]'), 'como mucho uno al día');
// Al día siguiente sale otro distinto
ev(`(() => { const s = JSON.parse(localStorage.getItem('bussev.consejos')); s.actual = { id: s.actual.id, dia: 'ayer', t: Date.now() - 86400000 }; localStorage.setItem('bussev.consejos', JSON.stringify(s)); })()`);
await a.ir('#ajustes', 300); await a.ir('#favoritas', 400);
c = a.$('[data-consejo]');
assert.ok(c && c.dataset.consejo !== primero, 'otro consejo al día siguiente');
c.querySelector('[data-consejo-no]').click(); await espera(100);
assert.equal(ev(`settings.consejos`), false, 'No más consejos');
ev(`localStorage.removeItem('bussev.consejos')`);
await a.ir('#ajustes', 300); await a.ir('#favoritas', 400);
assert.ok(!a.$('[data-consejo]'), 'apagados de verdad');

assert.deepEqual(a.errores.filter((e) => !/maplibre|cargarMapa|mapa/i.test(e)), [], 'sin errores');
console.log('tanda4: ok');
process.exit(0);
