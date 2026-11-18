// Avisos de TUSSAM en las paradas: en la tarjeta de cada favorita y arriba en la pantalla de la parada.
import assert from 'node:assert/strict'; import vm from 'node:vm';
import { arrancar } from './humo.mjs';
process.on('uncaughtException', (e) => { console.log('EXCEPCIÓN', String(e.stack).split('\n').slice(0, 5).join(' | ')); process.exit(1); });
const avisos = { at: Date.now(), lista: [
  { id: 'desvio-29', titulo: 'LÍNEAS 29 Y 52. DESVÍO POR OBRAS EN AVENIDA DE LA BUHAIRA', seccion: 'avisos', lineas: ['29', '52'] },
  { id: 'parada-194', titulo: 'PARADA 194 TRASLADADA PROVISIONALMENTE', seccion: 'avisos', lineas: [] },
  { id: 'linea-1', titulo: 'LÍNEA 1. CAMBIO DE HORARIO', seccion: 'horarios', lineas: ['01'] },
] };
const favs = [{ codigo: '194', lineas: [] }, { codigo: '736', lineas: ['22'] }];
const a = await arrancar({ ls: { 'bussev.favs': favs, 'bussev.tussam.avisos': avisos, 'bussev.settings': { avisarVersion: false } } });
await a.espera(1200);
const ev = (c) => new vm.Script(c).runInContext(a.dom.getInternalVMContext());
// Paradas que nombra un título
assert.equal(ev(`JSON.stringify(avisosTussam.paradasDe('PARADAS 194, 200 Y 312 SUPRIMIDAS'))`), JSON.stringify(['194', '200', '312']));
assert.equal(ev(`JSON.stringify(avisosTussam.paradasDe('Parada nº 05 trasladada'))`), JSON.stringify(['5']));
assert.equal(ev(`JSON.stringify(avisosTussam.paradasDe('LÍNEA 2. PARADA PROVISIONAL EN TORNEO'))`), JSON.stringify([]));
assert.equal(ev(`JSON.stringify(avisosTussam.paradasDe('PARADA 12 Y LÍNEA 13'))`), JSON.stringify(['12']));
// Favoritas: la 194 tiene dos avisos (el que la nombra va primero, en rojo) -> lleva a la parada
await a.ir('#favoritas', 900);
const cards = [...a.w.document.querySelectorAll('#fav-cards article')];
const fa194 = cards[0].querySelector('.fav-aviso');
assert.ok(fa194, 'aviso en la tarjeta de la 194');
assert.ok(fa194.classList.contains('aqui'), 'marcado como «afecta a esta parada»');
assert.match(fa194.textContent, /Afecta a esta parada: Parada 194 trasladada provisionalmente · y 1 más/);
assert.equal(fa194.getAttribute('href'), '#parada-194');
// 736 solo con la línea 22: el aviso de la 29 no le toca
assert.equal(cards[1].querySelector('.fav-aviso'), null, 'la 736 (solo línea 22) sin avisos');
// Pantalla de la parada: el aviso arriba, antes que «Líneas que paran aquí»
await a.ir('#parada-194', 1500);
const ban = a.$('#p-avisos .av-banner');
assert.ok(ban && ban.classList.contains('aqui'), 'banner arriba en rojo');
const orden = [...a.w.document.querySelectorAll('#p-avisos, .p-info')].map((e) => e.id || e.className);
assert.deepEqual(orden, ['p-avisos', 'card p-info'], 'el aviso va antes que las líneas');
assert.equal(ban.querySelectorAll('.av-row').length, 2);
assert.match(ban.querySelector('.av-row').textContent, /Afecta a esta parada/);
// Tocar el aviso de la tarjeta (cuando solo hay uno) lo abre
ev(`localStorage.setItem('bussev.favs', JSON.stringify([{ codigo: '194', lineas: ['29'] }]))`);
assert.equal(a.errores.length, 0, a.errores.join('\n'));
console.log('OK avisos en las paradas');
a.cerrar(); process.exit(0);
