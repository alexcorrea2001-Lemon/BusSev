// Comprobaciones automáticas de BusSev. Se ejecutan en GitHub antes de compilar: si alguna falla, NO se publica
// el APK (así un fallo no llega al móvil). También se pueden lanzar a mano: node pruebas/ejecutar.mjs
// Necesitan jsdom (un navegador simulado): npm install --no-save jsdom
import { spawnSync } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..') + '/';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'bussev-pruebas-'));
const env = { ...process.env, PRUEBAS_TMP: TMP };
// El orden importa: horario_gtfs deja datos para horas, y novedades para app2.
const PRUEBAS = [
  ['Primer y último autobús (cálculo)', 'python3', ['-I', 'horario_gtfs.py']],
  ['Primer y último autobús (en la app)', 'node', ['horas.mjs']],
  ['Novedades al actualizar', 'node', ['novedades.mjs']],
  ['Líneas juntas en el mapa (carriles)', 'node', ['carriles.mjs']],
  ['Aviso de versión nueva', 'node', ['aviso_version.mjs']],
  ['Ahorro de batería', 'node', ['reposo.mjs']],
  ['Temáticas, días especiales y vehículos', 'node', ['tematicas.mjs']],
  ['Animaciones, parada e icono', 'node', ['app.mjs']],
  ['Nocturnos, satélite, novedades y actualizar', 'node', ['app2.mjs']],
  ['Avisos de TUSSAM en las paradas', 'node', ['avisos_parada.mjs']],
  ['Todas las pantallas sin errores', 'node', ['pantallas.mjs']],
];
let fallos = 0;
for (const [nombre, cmd, args] of PRUEBAS) {
  const t0 = Date.now();
  const r = spawnSync(cmd, [...args, RAIZ], { cwd: AQUI, env, encoding: 'utf8', timeout: 240_000 });
  const ok = r.status === 0;
  console.log(`${ok ? '✓' : '✗'} ${nombre} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  if (!ok) {
    fallos++;
    const salida = `${r.stdout || ''}\n${r.stderr || ''}${r.error ? '\n' + r.error.message : ''}`.trim().split('\n').slice(-25).join('\n');
    console.log(salida.replace(/^/gm, '    '));
  }
}
fs.rmSync(TMP, { recursive: true, force: true });
if (fallos) { console.log(`\n${fallos} comprobación(es) fallida(s): no se publica el APK. Pégale este trozo del log a quien te ayude con la app.`); process.exit(1); }
console.log('\nTodas las comprobaciones han ido bien.');
