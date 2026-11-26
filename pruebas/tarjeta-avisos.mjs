// Tanda «Tarjeta y avisos de TUSSAM»: historial del saldo y previsión, desvíos en el mapa,
// silencio de noche de los avisos y buscador con sitios, erratas y búsquedas recientes.
import assert from 'node:assert/strict';
import { arrancar } from './humo.mjs';

const DIA = 86400_000, ahora = Date.now();
const card = { num: '182387834043', name: 'Mía', color: '#1f4fa0', tipo: 'con-transbordo', ultimo: { saldo: 6.2, titulo: 'Bonobús saldo', fecha: ahora - DIA },
  historial: [[ahora - 20 * DIA, 15], [ahora - 15 * DIA, 11], [ahora - 10 * DIA, 7.4], [ahora - 9 * DIA, 17.4], [ahora - 4 * DIA, 12], [ahora - DIA, 6.2]] };
// Parada de la línea 29 (sentido 1) para el desvío
import fs from 'node:fs'; import vm from 'node:vm';
const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(process.argv[2] + 'www/data.js', 'utf8'), ctx);
const D = ctx.window.BUSSEV_DATA;
const ruta29 = D.recorridos.filter((r) => r[1] === '29' && r[2] === 1).sort((a, b) => a[3] - b[3]);
const [pa, pb] = [ruta29[4][0], ruta29[5][0]];
const det = { h1: 'Desvío', adjuntos: [], campos: [{ lab: 'Descripción', b: [
  { t: 'Por obras, la línea 29 se desvía por la Avenida de la Buhaira.' },
  { t: 'PARADAS ANULADAS:', b: true }, { t: `Parada ${pa}`, li: true }, { t: `Parada nº ${pb}`, li: true },
  { t: 'Se habilita una parada provisional en la parada 9876.' },
] }] };
let lugares = [];
const a = await arrancar({ capacitor: null, ls: {
  'bussev.settings': { avisarVersion: false, contarViajes: false, avisosLinea: true },
  'bussev.favs': [{ codigo: '2', nombre: 'Menéndez Pelayo', alias: 'Casa' }],
  'bussev.cards': [card],
  'bussev.tussam.avisos': { at: ahora, lista: [{ id: 'desvio-29', titulo: 'LÍNEA 29. DESVÍO POR OBRAS', seccion: 'avisos', lineas: ['29'] }] },
  'bussev.tussam.vistos': ['desvio-29'],
  'bussev.tussam.det.desvio-29': { at: ahora, d: det },
} });
const ev = (c) => a.w.eval(c);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
a.w.buscarLugares = async (q) => lugares;

// ---------- Historial del saldo ----------
const p = JSON.parse(ev(`JSON.stringify(saldoHist.previsionSaldo(${JSON.stringify(card.historial)}, ${ahora}))`));
assert.equal(Math.round(p.gasto * 100) / 100, 18.8, 'suma solo las bajadas');
assert.equal(Math.round(p.recargas), 10);
assert.ok(p.alDia > 0.9 && p.alDia < 1.1, 'gasto al día ≈ 1 €: ' + p.alDia);
assert.ok(p.quedan > 5 && p.quedan < 7, 'le quedan unos 6 días');
assert.equal(ev(`saldoHist.conPunto({ historial: [[1, 5]] }, 2e12, 5).length`), 1, 'mismo saldo: sin punto nuevo');
assert.equal(ev(`saldoHist.conPunto({ historial: [[1, 5]] }, 2e12, 4.1).length`), 2);
assert.equal(ev(`saldoHist.previsionSaldo([[${ahora - 3600_000}, 5]]).alDia`), null, 'con un punto no hay previsión');
const html = ev(`saldoHist.historialSaldoHTML(tarjeta.get('182387834043'))`);
assert.ok(html.includes('saldo-graf') && html.includes('sg-recarga') && /te quedas sin saldo hacia el/.test(html), 'gráfica, recarga y previsión');
assert.ok(/\+10 €/.test(html), 'marca la recarga');
// Al consultar se apunta
ev(`aplicarConsulta('182387834043', { ok: true, saldo: 5.1, fecha: Date.now(), tipo: 'con-transbordo', titulo: 'Bonobús saldo' })`);
assert.deepEqual(JSON.parse(ev(`JSON.stringify(tarjeta.get('182387834043').historial.at(-1)[1])`)), 5.1);

// ---------- Silencio de noche ----------
const fin = (h, m) => ev(`(() => { const f = avisosTussam.finSilencio(new Date(2026, 10, 20, ${h}, ${m})); return f ? f.getDate() + ' ' + f.getHours() + ':' + f.getMinutes() : null; })()`);
assert.equal(fin(23, 30), '21 8:0', 'de noche: a las 8 del día siguiente');
assert.equal(fin(3, 10), '20 8:0', 'de madrugada: a las 8 de hoy');
assert.equal(fin(12, 0), null, 'de día: al momento');
ev(`settings.silencioDesde = '14:00'; settings.silencioHasta = '16:30'`);
assert.equal(fin(15, 0), '20 16:30');
ev(`settings.avisosSilencio = false`); assert.equal(fin(23, 30), null, 'apagado');
ev(`settings.avisosSilencio = true; settings.silencioDesde = '23:00'; settings.silencioHasta = '08:00'`);
await a.ir('#ajustes-avisos', 500);
assert.ok(a.$('[data-hora-pick="sil-desde"]') && a.$('[data-hora-pick="sil-hasta"]'), 'horas en Ajustes');
a.$('[data-hora-pick="sil-hasta"] [data-hp="15"]').click(); await espera(50);
assert.equal(ev('settings.silencioHasta'), '08:15');

// ---------- Desvíos ----------
const dv = JSON.parse(ev(`JSON.stringify(avisosTussam.leerDesvio(${JSON.stringify(det)}))`));
assert.deepEqual(dv.anul.codigos.sort(), [String(Number(pa)), String(Number(pb))].sort(), 'paradas anuladas');
assert.deepEqual(dv.prov.codigos, ['9876'], 'provisional por número');
const d2 = JSON.parse(ev(`JSON.stringify(avisosTussam.leerDesvio({ campos: [{ lab: '', b: [{ t: 'La parada 194 queda anulada, habilitándose una provisional en la parada 200.' }] }] }))`));
assert.deepEqual(d2.anul.codigos, ['194']); assert.deepEqual(d2.prov.codigos, ['200']);
assert.equal(ev(`nombraParada('No se efectuará parada en Menéndez Pelayo (Puerta Carmona)', { nombre: 'Menéndez Pelayo (Puerta Carmona)' })`), true);
assert.equal(ev(`nombraParada('Por la Avenida de Menéndez Pelayo', { nombre: 'Menéndez Pelayo (Puerta Carmona)' })`), false, 'solo la calle no basta');
await a.ir('#linea-29', 1500);
const m = a.mapas.at(-1);
assert.equal(m.fuentes['bs-desvio-x']?.features?.length, 2, 'dos paradas tachadas en el mapa');
assert.ok(m.fuentes['bs-desvio']?.features?.length >= 1, 'tramo desviado dibujado');
assert.equal(a.w.document.querySelectorAll('.tl-anulada').length, 2, 'y en la lista');
assert.match(a.$('#l-desvio').textContent, /2 paradas sin servicio/);

// ---------- Buscador ----------
const q = a.$('#q');
const escribir = async (t, ms = 700) => { q.value = t; q.dispatchEvent(new a.w.Event('input')); await espera(ms); };
q.focus(); await escribir('giralda');
assert.ok([...a.w.document.querySelectorAll('.sitio-row')].some((x) => /Giralda/.test(x.textContent)), 'sitio conocido');
lugares = [{ nombre: 'Hospital Virgen del Rocío', detalle: 'Sevilla', pos: [37.3612, -5.9806], sitio: true }];
await escribir('hospital virgen', 900);
const fila = [...a.w.document.querySelectorAll('.sitio-row')].find((x) => /Rocío/.test(x.textContent));
assert.ok(fila, 'sitio de internet');
fila.click(); await espera(300);
assert.ok(a.$('.modal .sitio-parada') && a.$('.modal #si-ruta'), 'ficha: paradas cerca y Cómo llegar');
assert.equal(a.w.document.querySelectorAll('.modal .sitio-parada').length, 4);
a.$('.modal #si-ruta').click(); await espera(400);
assert.equal(a.w.location.hash, '#ruta');
// Por el alias de la favorita
q.focus(); await escribir('casa');
assert.ok(a.$('#view-buscar a[href="#parada-2"]'), 'encuentra la favorita por su nombre');
a.$('#view-buscar a[href="#parada-2"]').click(); await espera(300);
// Erratas
q.focus(); await escribir('macarnea');
assert.ok(a.w.document.querySelectorAll('#view-buscar a[href^="#parada-"]').length > 0, 'macarnea → Macarena');
assert.match(a.$('#view-buscar').textContent, /se le parece/);
// Recientes al tocar el campo vacío
await escribir('', 200); q.blur(); await espera(300);
q.focus(); q.dispatchEvent(new a.w.Event('focus')); await espera(200);
assert.ok(!a.$('#view-buscar').hidden && /Búsquedas recientes/.test(a.$('#view-buscar').textContent), 'recientes');
assert.ok(/Rocío/.test(a.$('#view-buscar').textContent) && a.$('#view-buscar a[href="#parada-2"]'), 'el sitio y la parada');
a.$('#rec-borrar').click(); await espera(100);
assert.equal(ev(`busqRecientes.list().length`), 0);

assert.deepEqual(a.errores.filter((e) => !/maplibre/i.test(e)), [], 'sin errores');
console.log('tarjeta-avisos: ok');
process.exit(0);
