// Acabados de la tarjeta: brillo holográfico (Holo, Cosmos, Rayado), purpurina, darle la vuelta, Personalizar y copia.
import assert from 'node:assert/strict';
import { arrancar } from './humo.mjs';

const u = { saldo: 12.45, titulo: 'Bonobús saldo', caducidad: '03/2029', caducaEl: Date.now() + 9e10, fecha: Date.now() };
const a = await arrancar({ ls: { 'bussev.settings': { avisarVersion: false }, 'bussev.cards': [
  { num: '001234567812', name: 'Roja', color: '#d41c2b', holo: 'rayado', holoFuerza: 70, ultimo: u },
  { num: '001234567813', name: 'Antigua', brillo: true, ultimo: u },
] } });
const ev = (c) => a.w.eval(c);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const $$ = (s) => [...a.w.document.querySelectorAll(s)];

// Las capas: el brillo de antes pasa a Holo; Rayado y Cosmos llevan además su dibujo; la intensidad va en la capa
await a.ir('#tarjeta', 700);
const [roja, antigua] = $$('.carrusel .tcard');
assert.ok(roja.querySelector('.tc-holo.h-rayado .patron .malla'), 'Rayado con su malla');
assert.equal(roja.querySelector('.tc-holo').style.getPropertyValue('--fuerza'), '0.70');
assert.ok(antigua.querySelector('.tc-holo.h-holo') && !antigua.querySelector('.patron'), 'el brillo viejo es ahora Holo (sin malla)');
assert.ok(!a.$('.tc-brillo'), 'ya no queda el brillo viejo');
// El brillo va por debajo de las letras y del marco
const hijos = [...roja.children].map((x) => x.className.baseVal ?? x.className);
assert.ok(hijos.findIndex((c) => /tc-holo/.test(c)) < hijos.findIndex((c) => /tc-top/.test(c)), 'debajo de las letras');
// La luz se mueve solo con variables de la capa (sin tocar la tarjeta)
ev(`luzHolo(document.querySelector('.carrusel .tcard'), 1, 0)`);
assert.match(roja.querySelector('.tc-holo').style.getPropertyValue('--gx'), /px$/);
// Purpurina: siempre igual para la misma tarjeta (según su número)
assert.equal(ev(`purpurinaHTML('001234567812')`), ev(`purpurinaHTML('001234567812')`));
assert.notEqual(ev(`purpurinaHTML('001234567812')`), ev(`purpurinaHTML('001234567899')`));
assert.equal((ev(`purpurinaHTML('1')`).match(/class="pp"/g) || []).length, 14);

// Darle la vuelta: en la tarjeta grande, tocar gira; por detrás saldo y caducidad
a.$('[data-open="001234567812"]').click();
await espera(700);
const caja = a.$('#t-flip'), giro = caja.firstElementChild;
assert.ok(caja.querySelector('.tc-reverso'), 'tiene reverso');
assert.match(caja.querySelector('.tc-reverso').textContent, /12,45/);
assert.match(caja.querySelector('.tc-reverso').textContent, /03\/2029/);
const toque = (x, y, x2 = x, y2 = y) => {
  caja.dispatchEvent(new a.w.MouseEvent('pointerdown', { bubbles: true, clientX: x, clientY: y }));
  if (x2 !== x || y2 !== y) caja.dispatchEvent(new a.w.MouseEvent('pointermove', { bubbles: true, clientX: x2, clientY: y2 }));
  caja.dispatchEvent(new a.w.MouseEvent('pointerup', { bubbles: true, clientX: x2, clientY: y2 }));
};
toque(100, 100);
assert.match(giro.style.transform, /rotateY\(180deg\)/, 'tocar le da la vuelta');
toque(100, 100);
assert.match(giro.style.transform, /rotateY\(0deg\)/, 'otro toque la vuelve a poner');
toque(100, 100, 160, 100);
assert.match(giro.style.transform, /rotateY\(0deg\)/, 'arrastrar no la gira');

// Personalizar: elegir Cosmos, subir la intensidad y poner purpurina
a.$('#t-edit').click();
await espera(400);
const m = a.$('.modal');
assert.equal(m.querySelectorAll('[data-hl]').length, 4, 'Ninguno, Holo, Cosmos y Rayado');
assert.ok(!m.querySelector('[data-opt="brillo"]'), 'ya no está el «Efecto brillo» de antes');
m.querySelector('[data-hl="cosmos"]').click();
assert.ok(a.$('#c-prev .tc-holo.h-cosmos'), 'la vista previa lo enseña');
const r = m.querySelector('#c-hf'); r.value = '80'; r.dispatchEvent(new a.w.Event('input', { bubbles: true }));
m.querySelector('[data-opt="purpurina"]').click();
assert.ok(a.$('#c-prev .tc-purp'));
m.querySelector('[data-hl=""]').click();
assert.ok(m.querySelector('#c-fuerza').hidden, 'sin brillo no hay intensidad');
m.querySelector('[data-hl="cosmos"]').click();
m.querySelector('#c-ok').click();
await espera(200);
const g = JSON.parse(a.w.localStorage.getItem('bussev.cards')).find((x) => x.num === '001234567812');
assert.equal(g.holo, 'cosmos'); assert.equal(g.holoFuerza, 80); assert.equal(g.purpurina, true);
assert.ok(!('brillo' in g));

// Copia de seguridad: la personalización de la tarjeta ya no se pierde al restaurar
const copia = JSON.parse(ev(`JSON.stringify(copia.crear())`));
const d = JSON.parse(ev(`JSON.stringify(copia.validar(${JSON.stringify(copia)}))`));
const c1 = d.cards.find((x) => x.num === '001234567812'), c2 = d.cards.find((x) => x.num === '001234567813');
assert.equal(c1.holo, 'cosmos'); assert.equal(c1.holoFuerza, 80); assert.equal(c1.purpurina, true);
assert.equal(c2.holo, 'holo', 'el brillo de antes también pasa');
const raro = JSON.parse(ev(`JSON.stringify(copia.validar({ app: 'BusSev', cards: [{ num: '001234567814', holo: '<script>', holoFuerza: 9999, marco: 'inventado', diseno: 'x' }] }))`)).cards[0];
assert.equal(raro.holo, ''); assert.equal(raro.holoFuerza, 90); assert.equal(raro.marco, ''); assert.equal(raro.diseno, '');
assert.equal(a.errores.length, 0, a.errores.join('\n').slice(0, 2000));
console.log('OK acabados: holo/cosmos/rayado, purpurina, darle la vuelta, Personalizar y copia');
a.cerrar(); process.exit(0);
