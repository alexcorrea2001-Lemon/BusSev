import assert from 'node:assert/strict'; import vm from 'node:vm'; import fs from 'node:fs';
import { arrancar } from './humo.mjs';
const TMP = process.env.PRUEBAS_TMP || (await import('node:os')).tmpdir();
process.on('uncaughtException', (e) => { console.log('EXCEPCIÓN', String(e.stack).split('\n').slice(0, 4).join(' | ')); process.exit(1); });
const a = await arrancar(); await a.espera(500);
const ev = (c) => new vm.Script(c).runInContext(a.dom.getInternalVMContext());
const txt = fs.readFileSync(`${TMP}/gtfs/calendar_data.js`, 'utf8'); const D = JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1));
const l = D.lineas.find((x) => x.numero === '29'); ev(`globalThis.L29 = ${JSON.stringify(l)}`);
const h = (y, m, d, hh, mm = 0, s = 1) => ev(`(() => { const r = horasHoy(L29, ${s}, new Date(${y}, ${m}, ${d}, ${hh}, ${mm})); return [r.ini, r.fin, r.tipo].join(' '); })()`);
assert.equal(h(2026, 10, 17, 10), '06:00 23:30 mar', 'martes');
assert.equal(h(2026, 10, 20, 22), '06:00 01:30 vie', 'viernes');
assert.equal(h(2026, 10, 21, 2), '06:00 01:30 vie', 'madrugada del sábado = viernes');
assert.equal(h(2026, 10, 21, 12), '06:30 00:15 sab', 'sábado');
assert.equal(h(2026, 10, 22, 12), '07:15 23:00 dom', 'domingo');
assert.equal(h(2026, 11, 8, 12), '07:15 23:00 dom', 'martes 8 de diciembre festivo = domingo');
assert.equal(h(2026, 10, 17, 10, 0, 2), '06:10 23:40 mar', 'vuelta');
// Datos antiguos (sin «horario»): lo de siempre
ev(`globalThis.VIEJA = { hora_inicio_ida: '06:01', hora_fin_ida: '23:01' }`);
assert.equal(ev(`(() => { const r = horasHoy(VIEJA, 1, new Date(2026, 10, 21, 12)); return r.ini + ' ' + r.fin; })()`), '06:01 23:01');
// Búho que solo circula viernes y sábado: el lunes «no circula»
ev(`globalThis.BUHO = { horario: { vie: [['00:30', '05:30'], null], sab: [['00:30', '05:30'], null] } }`);
assert.equal(ev(`horasHoy(BUHO, 1, new Date(2026, 10, 23, 12)).noHoy`), true);
assert.equal(ev(`horasHoy(BUHO, 1, new Date(2026, 10, 21, 1)).ini`), '00:30', 'madrugada del sábado: el del viernes');
// Pantalla de la línea con los datos reales (sin «horario» todavía): sigue funcionando
await a.ir('#linea-29', 1500); assert.match(a.$('#l-horario').textContent, /paradas/);
assert.equal(a.errores.length, 0, a.errores.join('\n'));
console.log('OK horas de hoy:', a.$('#l-horario').textContent);
a.cerrar(); process.exit(0);
