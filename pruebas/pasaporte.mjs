// Pasaporte de Sevilla: reglas de sellos y medallas, solo viajes verificados, pantalla, entrada en Tarjeta,
// recogida de los viajes de Android con aviso de logros, y copia de seguridad (solo viajes con firma buena).
import assert from 'node:assert/strict';
import { arrancar } from './humo.mjs';

const llamadas = [];
let pendientes = [];
const capacitor = {
  isNativePlatform: () => true,
  isPluginAvailable: (p) => ['BusSevViaje', 'LocalNotifications', 'Share', 'Filesystem'].includes(p),
  nativePromise: async (plugin, metodo, datos) => {
    llamadas.push([plugin, metodo, datos]);
    if (metodo === 'viajesPendientes') { const v = pendientes; pendientes = []; return { viajes: v.map((x) => JSON.stringify(x)) }; }
    if (metodo === 'comprobarViajes') return { validos: datos.viajes.filter((x) => x.firma === 'f'.repeat(64)).map((x) => x.id) };
    if (metodo === 'estadoBajada' || metodo === 'estadoSensor') return { activo: false };
    return {};
  },
};
const a = await arrancar({ capacitor, ls: { 'bussev.settings': { avisarVersion: false } } });
const ev = (c) => a.w.eval(c);
const $$ = (s) => [...a.w.document.querySelectorAll(s)];

// Un viaje verificado que termina junto a la Giralda, de madrugada (Búho), en una circular
const t0 = new Date(2026, 10, 14, 3, 10).getTime();     // sábado 14 nov, 3:10
const giralda = { lat: 37.3862, lon: -5.9925 };
const viaje = (i, extra) => ({ id: `v${i}`, linea: '27', desde: '1', hasta: '2', desdeNombre: 'A', hastaNombre: 'B', lat: 37.40, lon: -5.97, inicio: t0 + i * 86400000, fin: t0 + i * 86400000 + 900000, paradas: 6, km: 3, verificado: true, firma: 'f'.repeat(64), ...extra });
const lista = [viaje(0, { ...giralda, linea: 'C1' }), viaje(1, {}), viaje(2, { verificado: false, motivo: 'x', linea: '05' })];
let nuevos = JSON.parse(ev(`JSON.stringify(pasaporte.registrar(${JSON.stringify(lista)}))`));
for (const k of ['s:giralda', 'm:primer', 'm:buho', 'm:circular', 'm:finde']) assert.ok(nuevos.includes(k), `consigue ${k}`);
assert.ok(!nuevos.includes('m:l5'), 'aún no 5 líneas');
assert.ok(!nuevos.includes('m:largo'), 'el no verificado de 6 paradas no cuenta, y ninguno llega a 12');
// Los no verificados no cuentan: 5 líneas distintas, pero dos sin verificar
const mas = ['01', '02', '03'].map((l, i) => viaje(10 + i, { linea: l })).concat([viaje(20, { linea: '06', verificado: false }), viaje(21, { linea: '13', paradas: 14 })]);
nuevos = JSON.parse(ev(`JSON.stringify(pasaporte.registrar(${JSON.stringify(mas)}))`));
assert.ok(nuevos.includes('m:largo'), 'viaje de 14 paradas');
assert.ok(nuevos.includes('m:l5'), 'C1, 27, 01, 02, 03, 13 → 5 o más líneas verificadas');
assert.equal(JSON.parse(ev(`JSON.stringify(pasaporte.registrar(${JSON.stringify(mas)}))`)).length, 0, 'repetir no da logros otra vez');
// Temporadas
assert.equal(ev(`pasaporte.temporada(new Date(2027, 2, 25).getTime())`), 'semanasanta', 'Jueves Santo 2027 (25 de marzo)');
assert.equal(ev(`pasaporte.temporada(new Date(2026, 11, 24).getTime())`), 'navidad');
assert.equal(ev(`pasaporte.temporada(new Date(2026, 6, 10).getTime())`), '');

// Pantalla y entrada desde Tarjeta
await a.ir('#tarjeta', 500);
assert.ok(a.$('a.ps-entrada[href="#pasaporte"]'), 'entrada en la pestaña Tarjeta');
await a.ir('#pasaporte', 600);
assert.equal($$('.ps-sellos .ps-item').length, 18, 'todos los sellos');
assert.equal($$('.ps-medallas .ps-med').length, 18, 'todas las medallas');
assert.ok(a.$('.ps-med.ok'), 'medallas conseguidas marcadas');
assert.match(a.$('.ps-portada').textContent, /1 de 18 sellos/);
assert.match(a.$('#view-pasaporte').textContent, /No contó/, 'los no verificados salen con el motivo');

// Android entrega un viaje nuevo → notificación con el dibujo del logro
pendientes = [viaje(30, { lat: 37.38238, lon: -5.99642, linea: '40' })];   // Torre del Oro
llamadas.length = 0;
nuevos = JSON.parse(JSON.stringify(await ev(`pasaporte.sincronizar({ silencioso: true })`)));
assert.ok(nuevos.includes('s:torreoro'));
const n = llamadas.find(([p, m, d]) => p === 'BusSevViaje' && m === 'notificarLogro' && d.id === 's-torreoro');
assert.ok(n, 'notificación del sello'); assert.match(n[2].titulo, /Nuevo sello: Torre del Oro/);

// Copia de seguridad: solo vuelven los viajes con firma buena
const copia = JSON.parse(ev(`JSON.stringify(copia.crear())`));
assert.ok(copia.pasaporte.length >= 5 && copia.pasaporte.every((v) => v.verificado), 'la copia lleva los viajes verificados');
const falsos = [...copia.pasaporte, { ...viaje(99, { lat: 37.39330, lon: -5.99168 }), firma: '0'.repeat(64) }];   // Setas, firma mala
a.w.localStorage.removeItem('bussev.pasaporte');
const d = JSON.parse(ev(`JSON.stringify(copia.validar(${JSON.stringify({ ...copia, pasaporte: falsos })}))`));
const recuperados = await ev(`pasaporte.restaurar(${JSON.stringify(d.pasaporte)})`);
assert.equal(recuperados, copia.pasaporte.length, 'el viaje con firma falsa no entra');
assert.ok(!JSON.parse(ev(`JSON.stringify(pasaporte.estado().logros)`))['s:setas'], 'ni da su sello');
assert.ok(JSON.parse(ev(`JSON.stringify(pasaporte.estado().logros)`))['s:giralda'], 'los buenos sí');
console.log('OK pasaporte: reglas, solo verificados, pantalla, notificación de logros y copia con firma');
a.cerrar(); process.exit(0);
