import assert from 'node:assert/strict';
import { arrancar } from './humo.mjs';
const R = process.argv[2];
process.on('uncaughtException', (e) => { console.log('EXCEPCIÓN', String(e.stack).split('\n').slice(0, 5).join(' | ')); process.exitCode = 1; });
// 1) Animaciones: aunque el móvil tenga quitadas las del sistema, la app las hace (lo decide su interruptor)
{ const a = await arrancar({ reduce: true }); await a.espera(300);
  assert.equal(a.w.document.documentElement.classList.contains('a-quieto'), false, 'móvil con animaciones del sistema quitadas: la app SÍ anima');
  await a.ir('#lineas', 200); assert.ok(a.$('#view-lineas, .view:not([hidden])').classList.contains('entrando'), 'transición al cambiar de pantalla');
  a.cerrar(); }
{ const a = await arrancar({ reduce: false, ls: { 'bussev.settings': { menosAnimaciones: true } } }); await a.espera(300);
  const clave = Object.keys(a.w.localStorage).join(',');
  assert.equal(a.w.document.documentElement.classList.contains('a-quieto'), true, `con «Reducir animaciones» encendido no anima (claves: ${clave})`); a.cerrar(); }
// 2) Parada: los tiempos se piden ANTES de montar el mapa, y el mapa llega después con sus autobuses
{ const a = await arrancar({ lento: 150 }); await a.espera(400);
  const t0 = Date.now(); await a.ir('#parada-194', 60);
  assert.equal(a.mapas.length, 0, 'al entrar aún no se ha montado el mapa');
  await a.espera(1500);
  const board = a.$('#p-board').textContent;
  assert.match(board, /PRADO/, 'salen los tiempos'); assert.equal(a.mapas.length, 1, 'el mapa se monta después');
  const pet = a.peticiones.find((p) => /194/.test(p.url));
  assert.ok(pet && pet.t <= a.mapas[0].t, 'la consulta de tiempos sale antes que el mapa');
  assert.ok(a.mapas[0].fuentes['bs-paths']?.features?.length >= 1, `el mapa dibuja el camino de los autobuses (${JSON.stringify(Object.keys(a.mapas[0].fuentes))})`);
  // 3) Al volver a entrar enseguida, los tiempos salen al momento (sin «Cargando…»)
  await a.ir('#favoritas', 100); await a.ir('#parada-194', 40);
  assert.match(a.$('#p-board').textContent, /PRADO/, 'tiempos guardados al instante');
  await a.espera(1500); assert.equal(a.errores.length, 0, a.errores.join('\n').slice(0, 600));
  // 4) Botón de buscar actualización con icono dibujado
  await a.ir('#ajustes-datos', 300);
  const b = a.$('#s-ver'); assert.ok(b.querySelector('svg.ico-upd') && !/🔄/.test(b.textContent), 'icono nuevo');
  a.cerrar(); }
console.log('OK app (animaciones, parada, icono)');
