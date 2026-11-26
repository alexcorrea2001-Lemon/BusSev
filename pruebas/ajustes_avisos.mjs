// Ajustes: dónde se ven los avisos de TUSSAM, y volver atrás deja cada pantalla donde estaba.
import assert from 'node:assert/strict'; import vm from 'node:vm';
import { arrancar } from './humo.mjs';
process.on('uncaughtException', (e) => { console.log('EXCEPCIÓN', String(e.stack).split('\n').slice(0, 5).join(' | ')); process.exit(1); });
const avisos = { at: Date.now(), lista: [
  { id: 'desvio-29', titulo: 'LÍNEAS 29 Y 52. DESVÍO POR OBRAS', seccion: 'avisos', lineas: ['29', '52'] },
  { id: 'parada-194', titulo: 'PARADA 194 TRASLADADA PROVISIONALMENTE', seccion: 'avisos', lineas: [] },
] };
const favs = [{ codigo: '194', lineas: [] }];

// 1) Con todo apagado no sale ningún aviso en Favoritas ni en la parada
{
  const a = await arrancar({ ls: { 'bussev.favs': favs, 'bussev.tussam.avisos': avisos,
    'bussev.settings': { avisarVersion: false, avisosResumen: false, avisosTarjetas: false, avisosParada: false, avisosLinea: false } } });
  await a.espera(1200);
  await a.ir('#favoritas', 900);
  assert.equal(a.$('#fav-cards .fav-aviso'), null, 'sin aviso en la tarjeta');
  assert.equal((a.$('#fav-avisos')?.innerHTML || '').trim(), '', 'sin botón de avisos en Favoritas');
  await a.ir('#parada-194', 1500);
  assert.equal(a.$('#p-avisos .av-banner'), null, 'sin aviso en la parada');
  assert.equal(a.errores.length, 0, a.errores.join('\n'));
  a.cerrar();
}

// 2) Por defecto sí salen, y los interruptores de Ajustes los apagan
{
  const a = await arrancar({ ls: { 'bussev.favs': favs, 'bussev.tussam.avisos': avisos, 'bussev.settings': { avisarVersion: false } } });
  await a.espera(1200);
  await a.ir('#favoritas', 900);
  assert.ok(a.$('#fav-cards .fav-aviso'), 'aviso en la tarjeta por defecto');
  assert.ok(a.$('#fav-avisos .av-boton'), 'botón de avisos por defecto');
  // Portada: seis categorías y un buscador que lleva al ajuste
  await a.ir('#ajustes', 600);
  assert.equal(a.w.document.querySelectorAll('#view-ajustes .aj-cats a.row').length, 6, 'seis categorías');
  const q = a.$('#aj-q'); q.value = 'vibracion'; q.dispatchEvent(new a.w.Event('input'));
  const hit = a.$('#aj-res [data-ir]');
  assert.ok(hit && hit.getAttribute('href') === '#ajustes-accesibilidad', 'el buscador encuentra «Vibración» en Accesibilidad');
  q.value = ''; q.dispatchEvent(new a.w.Event('input'));
  await a.ir('#ajustes-avisos', 600);
  for (const k of ['avisosResumen', 'avisosTarjetas', 'avisosParada', 'avisosLinea']) {
    const sw = a.$(`[data-sw="${k}"]`);
    assert.ok(sw && sw.checked, `interruptor ${k} encendido`);
    sw.checked = false; sw.dispatchEvent(new a.w.Event('change'));
  }
  const s = JSON.parse(a.w.localStorage.getItem('bussev.settings'));
  assert.equal(s.avisosTarjetas, false); assert.equal(s.avisosParada, false);
  await a.ir('#favoritas', 900);
  assert.equal(a.$('#fav-cards .fav-aviso'), null, 'apagado desde Ajustes');

  // 3) Volver atrás desde Avisos/Tarifas deja Ajustes donde estaba (jsdom no tiene diseño: se simula el scroll)
  const pos = new WeakMap();
  Object.defineProperty(a.w.HTMLElement.prototype, 'scrollTop', { configurable: true,
    get() { return this.hidden ? 0 : (pos.get(this) || 0); }, set(v) { pos.set(this, Math.max(0, v)); } });
  await a.ir('#ajustes-avisos', 500);
  const aj = a.$('#view-ajustes');
  assert.equal(aj.scrollTop, 0, 'Ajustes se abre arriba');
  aj.scrollTop = 900;
  await a.ir('#avisos', 500);
  assert.equal(a.$('#view-avisos').scrollTop, 0, 'Avisos se abre arriba');
  a.w.history.back(); await a.espera(50); await a.espera(600);
  assert.equal(a.w.location.hash, '#ajustes-avisos');
  assert.equal(aj.scrollTop, 900, 'al volver, Ajustes sigue donde estaba');
  aj.scrollTop = 1500;
  await a.ir('#tarifas', 500);
  a.w.history.back(); await a.espera(50); await a.espera(600);
  assert.equal(aj.scrollTop, 1500, 'también al volver de Tarifas');
  // Entrar de nuevo (no volver) empieza arriba
  await a.ir('#favoritas', 500); await a.ir('#ajustes', 400); await a.ir('#ajustes-avisos', 500);
  assert.equal(aj.scrollTop, 0, 'abrir Ajustes de nuevo empieza arriba');
  assert.equal(a.errores.length, 0, a.errores.join('\n'));
  a.cerrar();
}
console.log('OK avisos configurables y scroll al volver');
process.exit(0);
