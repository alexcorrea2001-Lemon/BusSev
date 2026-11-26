// Personalizar: favoritas (icono, estilos, grupos, compacta, ocultar dirección) y tarjetas (diseños, marcos,
// número tapado, orden), y el nuevo orden de la pantalla de la parada.
import assert from 'node:assert/strict'; import vm from 'node:vm';
import { arrancar } from './humo.mjs';
process.on('uncaughtException', (e) => { console.log('EXCEPCIÓN', String(e.stack).split('\n').slice(0, 6).join(' | ')); process.exit(1); });
const favs = [
  { codigo: '736', lineas: [], alias: 'Enfrente', emoji: '🏠', estilo: 'feria', grupo: '🏠 Casa' },
  { codigo: '983', lineas: [], alias: 'Debajo', grupo: '🏠 Casa', compacta: true },
  { codigo: '194', lineas: [], alias: 'Trabajo', ocultarDir: true, estilo: 'semanasanta' },
];
const a = await arrancar({ ls: { 'bussev.favs': favs, 'bussev.settings': { avisarVersion: false } } });
const ev = (c) => new vm.Script(c).runInContext(a.dom.getInternalVMContext());
await a.espera(1500);
await a.ir('#favoritas', 1200);
// Grupos: las sueltas primero y luego «🏠 Casa» con sus dos paradas
const hijos = [...a.$('#fav-cards').children].map((n) => (n.matches('.fav-grupo') ? 'G:' + n.textContent : n.querySelector('.stop-num')?.textContent));
assert.deepEqual(hijos, ['194', 'G:🏠 Casa', '736', '983'], hijos.join(','));
const c736 = [...a.w.document.querySelectorAll('#fav-cards article')].find((x) => x.querySelector('.stop-num').textContent === '736');
assert.ok(c736.classList.contains('est-feria'), 'estilo Feria');
assert.match(c736.querySelector('.fav-alias').textContent, /Enfrente/);
assert.ok(c736.querySelector('.fav-alias .ico-sitio svg'), 'el emoji antiguo 🏠 pasa a ser el icono dibujado de casa');
assert.equal(c736.querySelector('.card-tools'), null, 'sin fila vacía abajo: el lápiz va arriba');
assert.ok(c736.querySelector(':scope > .fav-edit'), 'lápiz en la esquina');
const c983 = [...a.w.document.querySelectorAll('#fav-cards article')].find((x) => x.querySelector('.stop-num').textContent === '983');
assert.ok(c983.classList.contains('compacta'), 'compacta');
assert.equal(c983.querySelector('.board'), null, 'la compacta no lleva la lista de tiempos');
const c194 = [...a.w.document.querySelectorAll('#fav-cards article')].find((x) => x.querySelector('.stop-num').textContent === '194');
assert.equal(c194.querySelector('.card-title p'), null, 'sin dirección');
// Personalizar desde la tarjeta (lápiz): cambiar icono, estilo y grupo
c194.querySelector('.fav-edit').click();
await a.espera(300);
const m = a.$('.modal');
assert.ok(m.querySelectorAll('[data-est]').length >= 11, 'once estilos o más');
assert.equal(m.scrollTop, 0, 'se abre arriba del todo');
assert.equal(m.querySelector('#fv-del'), null, 'sin botón de quitar de favoritas');
assert.ok(m.querySelector('#fv-prev .card.fav'), 'vista previa');
m.querySelector('[data-em="trabajo"]').click();
m.querySelector('[data-est="neon"]').click();
assert.ok(m.querySelector('#fv-prev .card.est-neon'), 'la vista previa cambia al momento');
m.querySelector('[data-tab="mostrar"]').click();
m.querySelector('[data-opt="animar"]').click();
m.querySelector('[data-tab="orden"]').click();
m.querySelector('#fv-grupo').value = '💼 Trabajo';
m.querySelector('#fv-ok').click();
await a.espera(300);
const f194 = JSON.parse(a.w.localStorage.getItem('bussev.favs')).find((f) => f.codigo === '194');
assert.equal(f194.emoji, 'trabajo'); assert.equal(f194.estilo, 'neon'); assert.equal(f194.grupo, '💼 Trabajo'); assert.equal(f194.animar, true);

// Pantalla de la parada: 3 botones, tiempos antes que las líneas, emoji y nombre debajo del título
await a.ir('#parada-736', 1500);
assert.equal(a.w.document.querySelectorAll('#p-tools .p-bt').length, 3);
assert.match(a.$('.p-sub').textContent, /Enfrente/); assert.ok(a.$('.p-sub .ico-sitio'));
const orden = [...a.w.document.querySelectorAll('#p-board, #p-filtro')].map((e) => e.id);
assert.deepEqual(orden, ['p-filtro', 'p-board'], 'las líneas, debajo de los botones');
assert.ok(a.$('.p-sub #p-rec a.badge, .p-sub #p-rec a'), 'los números para ver el recorrido, junto al número de parada');
assert.equal(a.$('.p-info'), null, 'ya no sale «Líneas que paran aquí» aparte');

// Tarjetas
ev(`tarjeta.save({ num: '11111111111111', name: 'Mía' }); tarjeta.save({ num: '22222222222222', name: 'Mamá' }); tarjeta.save({ num: '33333333333333', name: 'Papá' });`);
const orden0 = JSON.parse(ev(`JSON.stringify(tarjeta.list().map((c) => c.name))`));
assert.deepEqual(orden0, ['Papá', 'Mamá', 'Mía']);
ev(`tarjeta.save({ ...tarjeta.get('22222222222222'), color: '#e5303c' })`);
assert.deepEqual(JSON.parse(ev(`JSON.stringify(tarjeta.list().map((c) => c.name))`)), ['Papá', 'Mamá', 'Mía'], 'guardar no la cambia de sitio');
ev(`tarjeta.move('11111111111111', 'primera')`);
assert.deepEqual(JSON.parse(ev(`JSON.stringify(tarjeta.list().map((c) => c.name))`)), ['Mía', 'Papá', 'Mamá'], 'ponerla la primera');
const html = ev(`tcardHTML('12345678901234', { name: 'Mía', emoji: 'corazon', diseno: 'semanasantapalio', marco: 'oro', ocultarNum: true, brillo: true }, null)`);
const d = a.w.document.createElement('div'); d.innerHTML = html;
const tc = d.firstElementChild;
assert.ok(tc.querySelector('.tc-marco.mk-oro') && tc.classList.contains('con-holo') && tc.querySelector('.tc-holo.h-holo') && tc.classList.contains('con-diseno'));
assert.ok(tc.querySelector('.tc-arte'), 'dibujo de Semana Santa');
assert.equal(tc.querySelector('.tc-num').textContent, '•••• •••• 1234', 'número tapado');
assert.match(tc.querySelector('.tc-brand').textContent, /Mía/); assert.ok(tc.querySelector('.tc-brand .ico-sitio svg'));
const dis = JSON.parse(ev(`JSON.stringify(Object.keys(DISENOS_TARJETA))`));
for (const k of ['giralda', 'torreoro', 'triana', 'azulejo', 'feriaportada', 'feriacaseta', 'semanasantapalio', 'semanasantanazarenos', 'plazaespana', 'setas']) assert.ok(dis.includes(k), k);
assert.ok(JSON.parse(ev(`MARCOS_TARJETA.length`)) >= 10, 'muchos marcos');
assert.equal(ev(`typeof PEGATINAS_TARJETA`), 'undefined', 'sin pegatinas');

// Sevici: nombres limpios; metro, Cercanías y bici apagados de serie
assert.equal(ev(`nombreSevici('_GLORIETA BIZCO AMATE')`), 'Glorieta Bizco Amate');
assert.equal(ev(`nombreSevici('123_AVENIDA DE LA BUHAIRA')`), 'Avenida de la Buhaira');
assert.equal(ev(`[settings.mapaMetro, settings.mapaRenfe, settings.mapaSevici, settings.rutaMetro, settings.rutaRenfe, settings.rutaBici].some((v) => v === true)`), false);
// Ajustes: sonido del aviso
await a.ir('#ajustes-avisos', 600);
assert.ok(a.$('[data-set="sonidoAviso"][data-v="campana"]'), 'elegir sonido');
assert.equal(a.errores.length, 0, a.errores.join('\n').slice(0, 2000));
console.log('OK personalizar favoritas, tarjetas y pantalla de parada');
a.cerrar(); process.exit(0);
