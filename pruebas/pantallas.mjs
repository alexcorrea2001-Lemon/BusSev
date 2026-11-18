// Prueba de humo: arranca la app en un navegador simulado y pasa por todas las pantallas sin que salte ningún error.
import assert from 'node:assert/strict';
import { arrancar } from './humo.mjs';
process.on('uncaughtException', (e) => { console.log('EXCEPCIÓN', String(e.stack).split('\n').slice(0, 5).join(' | ')); process.exit(1); });
const a = await arrancar({ ls: { 'bussev.favs': [{ codigo: '194', lineas: [] }] } }); await a.espera(600);
for (const h of ['#mapa', '#lineas', '#tarjeta', '#cerca', '#ajustes', '#avisos', '#tarifas', '#parada-194', '#linea-29', '#linea-C1', '#ruta', '#favoritas']) {
  await a.ir(h, 600);
  assert.ok((a.$('.view:not([hidden])')?.textContent || '').trim().length > 10, `la pantalla ${h} sale vacía`);
}
assert.equal(a.errores.length, 0, 'errores:\n' + a.errores.join('\n').slice(0, 1500));
console.log('OK pantallas (12 sin errores)');
a.cerrar(); process.exit(0);
