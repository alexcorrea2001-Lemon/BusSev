import assert from 'node:assert/strict'; import fs from 'node:fs'; import vm from 'node:vm';
import { arrancar } from './humo.mjs';
const R = process.argv[2];
process.on('uncaughtException', (e) => { console.log('EXCEPCIÓN', String(e.stack).split('\n').slice(0, 5).join(' | ')); process.exit(1); });
const favs = [{ codigo: '194', lineas: [] }];
const a = await arrancar({ ls: { 'bussev.favs': favs, 'bussev.settings': { tematicaAuto: false, tematica: 'semanasanta', avisarVersion: false } } });
const ev = (c) => new vm.Script(c).runInContext(a.dom.getInternalVMContext());
await a.espera(900);
const saludo = () => (a.$('#fav-fiesta')?.textContent || '').replace(/\s+/g, ' ').trim();
assert.match(saludo(), /Semana Santa en Sevilla/);
// 1) El caso de tus capturas: cambiar a Navidad en Ajustes y volver, sin cerrar la app
await a.ir('#ajustes-apariencia', 500);
a.$('[data-tem="navidad"]').click(); await a.espera(100);
assert.match(saludo(), /Feliz Navidad/, 'el saludo cambia al momento: ' + saludo());
await a.ir('#favoritas', 900);
assert.match(saludo(), /Feliz Navidad/, 'y sigue bien al volver: ' + saludo()); assert.ok(!/Semana Santa/.test(saludo()));
for (const t of ['halloween', 'feria', 'normal']) { await a.ir('#ajustes-apariencia', 400); a.$(`[data-tem="${t}"]`).click(); await a.ir('#favoritas', 700);
  const esp = { halloween: /Halloween/, feria: /Feria/, normal: /^$/ }[t]; assert.match(saludo(), esp, `${t}: ${saludo()}`); }
// 2) Días especiales por fecha (solo con la temática de Navidad)
await a.ir('#ajustes-apariencia', 400); a.$('[data-tem="navidad"]').click(); await a.espera(100);
const dia = (y, m, d) => ev(`diaEspecial(new Date(${y}, ${m}, ${d}, 12))`);
assert.deepEqual([dia(2026, 11, 24), dia(2026, 11, 25), dia(2026, 11, 31), dia(2027, 0, 1), dia(2027, 0, 5), dia(2027, 0, 6)], [null, 'papanoel', 'nochevieja', 'anonuevo', null, 'reyes']);
ev(`settings.tematicaAuto = true`);
assert.equal(ev(`tematicaPorFecha(new Date(2026, 11, 25))`), 'navidad'); assert.equal(ev(`tematicaPorFecha(new Date(2027, 0, 6))`), 'navidad');
ev(`settings.tematicaAuto = false; settings.tematica = 'feria'`); assert.equal(dia(2026, 11, 25), null, 'con otra temática no hay día especial');
ev(`settings.tematica = 'navidad'; applyTheme()`);
// 3) Vista previa desde Ajustes
await a.ir('#ajustes-apariencia', 400);
const chip = (k) => a.$(`[data-dia="${k}"]`);
chip('papanoel').click(); await a.espera(100);
assert.equal(a.w.document.documentElement.dataset.dia, 'papanoel'); assert.ok(a.$('.topbar #fiesta-cielo .f-cruza.izq svg') && !a.$('#fiesta .f-cruza'), 'trineo cruzando por la barra');
chip('nochevieja').click(); await a.espera(100);
assert.equal(a.w.document.querySelectorAll('#fiesta .f-fuego').length, 5, 'fuegos artificiales'); assert.ok(!a.$('#fiesta-cielo'), 'sin trineo en Nochevieja');
chip('reyes').click(); await a.espera(100); assert.ok(a.$('.topbar #fiesta-cielo .f-cruza:not(.izq)'), 'camellos');
chip('anonuevo').click(); await a.ir('#favoritas', 700); assert.match(saludo(), /Feliz Año Nuevo 2027/, saludo());
await a.ir('#ajustes-apariencia', 400); chip('').click(); await a.espera(100);
assert.equal(a.w.document.documentElement.dataset.dia, undefined); await a.ir('#favoritas', 700); assert.match(saludo(), /Feliz Navidad/);
// las piezas nuevas existen
for (const k of ['gorro', 'uvas', 'copa', 'reloj', 'serpentina', 'confeti', 'fuego', 'corona', 'caramelo', 'trineo', 'camellos']) assert.ok(ev(`!!PIEZAS[${JSON.stringify(k)}]`), k);
// 4) Vehículos de fiesta
ev(`settings.vehiculosFiesta = true`);
for (const [t, n] of [['normal', 1], ['halloween', 5], ['navidad', 11], ['feria', 8], ['semanasanta', 8]]) {
  ev(`settings.tematica = ${JSON.stringify(t)}; applyTheme()`);
  const vistos = new Set();
  for (let k = 0; k < 300; k++) { const src = ev(`busImg('bus${k}')`); vistos.add(src); assert.ok(fs.existsSync(R + 'www' + src), 'falta ' + src);
    const num = Number(src.match(/-(\d+)\.webp$/)[1]); assert.equal(ev(`busMiraIzq('bus${k}')`), (t === 'halloween' && num >= 3) || t === 'feria', `${src} orientación`); }   // los coches de caballos miran a la izquierda
  assert.equal(vistos.size, n, `${t}: ${vistos.size} dibujos distintos`);
}
ev(`settings.tematica = 'feria'; applyTheme()`); assert.match(ev(`cargandoHTML('x')`), /cg-bus[^>]*data-izq/, 'la animación de carga da la vuelta al coche de caballos');
ev(`settings.tematica = 'normal'; applyTheme()`); assert.equal(ev(`busImg('x')`), '/img/fiesta/normal-1.webp');
ev(`settings.vehiculosFiesta = false; applyTheme()`); assert.equal(ev(`busImg('x')`), '/img/buses/normal.webp');
await a.ir('#ajustes-apariencia', 400); assert.match(a.w.document.body.textContent, /coches de miedo en Halloween/); assert.match(a.w.document.body.textContent, /Butano/);
assert.equal(a.errores.length, 0, a.errores.join('\n').slice(0, 600));
console.log('OK temáticas, días especiales y vehículos');
a.cerrar(); process.exit(0);
