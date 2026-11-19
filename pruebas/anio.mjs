// «Tu año en BusSev»: qué se apunta (sin contar dos veces lo repetido), el cálculo del resumen,
// cuándo se anuncia, las historias y la copia de seguridad.
import assert from 'node:assert/strict';
import { arrancar } from './humo.mjs';

const a = await arrancar({ ls: { 'bussev.settings': { avisarVersion: false }, 'bussev.favs': [{ codigo: '2', alias: 'Casa' }] } });
const ev = (c) => a.w.eval(c);
const J = (c) => JSON.parse(ev(`JSON.stringify(${c})`));
const y = new Date().getFullYear();
const anioHoy = () => J(`(store.get('anio', {}) || {})['${y}']`);

// Favoritas: al pintarse la lista, cada favorita cuenta una vez al día
await a.ir('#favoritas', 600);
assert.equal(anioHoy().paradas['2'], 1, 'la favorita vista cuenta');
await a.ir('#mapa', 200); await a.ir('#favoritas', 400);
assert.equal(anioHoy().paradas['2'], 1, 'y no otra vez el mismo día');

// Abrir una parada cuenta, pero no dos veces seguidas
await a.ir('#parada-3', 500); await a.ir('#favoritas', 300); await a.ir('#parada-3', 500);
assert.equal(anioHoy().paradas['3'], 1, 'abrir la misma parada en 10 min cuenta una vez');
ev(`anio.apuntar('linea', { linea: '27' }); anio.apuntar('linea', { linea: '27' }); anio.apuntar('aviso', { codigo: '3', linea: '27' }); anio.apuntar('sensor', { codigo: '3', linea: 'C1' })`);
const h = anioHoy();
assert.equal(h.lineas['27'], 3, 'línea: 1 consulta + 2 por el aviso');
assert.equal(h.paradas['3'], 5, 'parada: 1 consulta + 2 del aviso + 2 del sensor');
assert.equal(h.avisos, 1); assert.equal(h.sensor, 1);
ev(`anio.saldo(10, 8.6); anio.saldo(8.6, 18.6); anio.saldo(null, 5)`);
assert.equal(anioHoy().gasto, 1.4, 'lo que baja el saldo es gasto');
assert.equal(anioHoy().recargas, 10, 'lo que sube es recarga');

// Resumen: los viajes verificados del Pasaporte suman y deciden la línea del año
const t0 = new Date(y, 0, 10, 8, 0).getTime();
const viajes = Array.from({ length: 6 }, (_, i) => ({ id: 'v' + i, linea: '05', desde: '7', hasta: '8', lat: 37.40, lon: -5.97, inicio: t0 + i * 864e5, fin: t0 + i * 864e5 + 6e5, paradas: 9, km: 5, verificado: true, firma: 'f'.repeat(64) }));
viajes.push({ ...viajes[0], id: 'malo', linea: 'C2', verificado: false });
ev(`pasaporte.registrar(${JSON.stringify(viajes)})`);
const d = J(`anio.datos(${y})`);
assert.equal(d.viajes, 6, 'solo los verificados');
assert.equal(d.km, 30);
assert.equal(d.topLineas[0].linea, '05', '6 viajes × 3 pesan más que las consultas de la 27');
assert.equal(d.topParadas.find((p) => p.codigo === '2')?.nombre, 'Casa', 'las favoritas salen con su nombre');
assert.ok(d.diasUsados >= 2 && d.horaPunta != null && d.perfil.nombre, 'días, hora punta y perfil');

// Cuándo se anuncia: del 1 de diciembre al 15 de enero (en enero, el año anterior)
assert.equal(ev(`anio.temporada(new Date(2026, 10, 30).getTime())`), false);
assert.equal(ev(`anio.temporada(new Date(2026, 11, 1).getTime())`), true);
assert.equal(ev(`anio.temporada(new Date(2027, 0, 15).getTime())`), true);
assert.equal(ev(`anio.temporada(new Date(2027, 0, 16).getTime())`), false);
assert.equal(ev(`anio.anioResumen(new Date(2027, 0, 5).getTime())`), 2026);

// Las historias: se abren, avanzan al tocar y terminan en la tarjeta para compartir
await a.ir('#pasaporte', 400);
assert.ok(a.$('a.wr-entrada[href="#tuano"]'), 'entrada desde el Pasaporte');
await a.ir('#tuano', 500);
const n = a.w.document.querySelectorAll('.wr-barras span').length;
assert.ok(n >= 6, `hay historias (${n})`);
assert.equal(a.$('.wr-s').dataset.id, 'portada');
const toque = (x) => { const wr = a.$('.wr'); const o = { bubbles: true, clientX: x, clientY: 400 }; wr.dispatchEvent(new a.w.MouseEvent('pointerdown', o)); wr.dispatchEvent(new a.w.MouseEvent('pointerup', o)); };
toque(380); assert.notEqual(a.$('.wr-s').dataset.id, 'portada', 'tocar a la derecha avanza');
toque(10); assert.equal(a.$('.wr-s').dataset.id, 'portada', 'tocar a la izquierda vuelve');
for (let i = 0; i < n; i++) toque(380);
assert.equal(a.$('.wr-s').dataset.id, 'resumen', 'termina en el resumen');
assert.ok(a.$('.wr-tarjeta svg') && a.$('[data-wr="compartir"]'), 'con la tarjeta y Compartir');
assert.match(a.$('.wr-tarjeta svg').textContent, /MI LÍNEA DEL AÑO/);
assert.ok(ev(`localStorage.getItem('bussev.anioVisto')`), 'se apunta que lo has visto');

// Copia de seguridad: se limpian claves y valores raros
const n2 = ev(`anio.restaurar({ '2019': { dias: { '01-02': 2, 'x<script>': 9 }, paradas: { '12': 4, 'mal': 3 }, lineas: { '27': 'mucho' }, horas: [1, -5], avisos: -3 }, 'hola': {} })`);
assert.equal(n2, 1);
const v19 = J(`store.get('anio')['2019']`);
assert.deepEqual(Object.keys(v19.dias), ['01-02']); assert.deepEqual(Object.keys(v19.paradas), ['12']);
assert.equal(v19.lineas['27'], 0); assert.equal(v19.horas[1], 0); assert.equal(v19.avisos, 0);
assert.equal(a.errores.length, 0, a.errores.join('\n').slice(0, 2000));
console.log('OK tu año: registro sin duplicados, resumen, temporada, historias y copia limpia');
a.cerrar(); process.exit(0);
