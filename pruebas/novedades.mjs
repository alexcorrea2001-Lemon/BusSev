import fs from 'node:fs'; import vm from 'node:vm'; import assert from 'node:assert/strict'; import { execFileSync } from 'node:child_process';
const TMP = process.env.PRUEBAS_TMP || (await import('node:os')).tmpdir();
const R = process.argv[2];
const { comparar, aTexto } = await import(R + 'scripts/novedades.mjs');
const leer = (f) => { const c = { window: {} }; vm.runInNewContext(fs.readFileSync(f, 'utf8'), c); return c.window.BUSSEV_DATA; };
const viejo = leer(R + 'www/data.js');
// sin cambios -> nada
assert.equal(comparar(viejo, JSON.parse(JSON.stringify(viejo))).grupos.length, 0, 'sin cambios no hay novedades');
// cambios inventados
const n = JSON.parse(JSON.stringify(viejo)); n.generado = '2026-12-01';
n.lineas.push({ numero: '44', nombre: 'Línea Nueva - Prueba', color: '#f00', hora_inicio_ida: '06:00', hora_fin_ida: '23:00' });
n.lineas = n.lineas.filter((l) => l.numero !== 'C5');
n.recorridos = n.recorridos.filter((r) => r[1] !== 'C5');
n.paradas.push({ codigo: '9999', nombre: 'Parada Inventada', latitud: 37.39, longitud: -5.98 });
const p194 = n.paradas.find((p) => String(p.codigo) === '194'); p194.nombre = 'Nombre Cambiado'; p194.latitud += 0.001;
const quitada = n.recorridos.find((r) => r[1] === '29' && r[2] === 1 && r[3] === 5)[0];
n.recorridos = n.recorridos.filter((r) => !(r[1] === '29' && r[2] === 1 && r[3] === 5));
n.recorridos.push(['9999', '29', 2, 999]);
n.lineas.find((l) => l.numero === '52').hora_fin_ida = '00:15';
const nov = comparar(viejo, n);
const T = Object.fromEntries(nov.grupos.map((g) => [g.t, g.i]));
assert.deepEqual(T['Líneas nuevas'], ['44 · Línea Nueva - Prueba']);
assert.match(T['Líneas que desaparecen'][0], /^C5 · /);
assert.ok(T['Paradas nuevas'].includes('Parada Inventada (9999)'));
assert.match(T['Paradas que cambian de nombre'].join(), /194: .* pasa a ser «Nombre Cambiado»/);
assert.match(T['Paradas que cambian de sitio'].join(), /\(194\), unos 1\d0 m/);
const l29 = T['Líneas que cambian de recorrido'].find((x) => x.startsWith('29:'));
assert.match(l29, /ahora para en Parada Inventada \(9999\)/);
assert.match(T['Líneas que cambian de horario'].join(), /52: primer bus .* último 00:15/);
assert.equal(nov.id, '2026-12-01');
// por la línea de órdenes, como en GitHub
fs.writeFileSync(`${TMP}/nuevo_data.js`, 'window.BUSSEV_DATA = ' + JSON.stringify(n) + ';');
try { fs.unlinkSync(`${TMP}/nov.json`); } catch {}
execFileSync('node', [R + 'scripts/novedades.mjs', R + 'www/data.js', `${TMP}/nuevo_data.js`, `${TMP}/nov.json`]);
assert.equal(JSON.parse(fs.readFileSync(`${TMP}/nov.json`, 'utf8')).grupos.length, nov.grupos.length);
fs.writeFileSync(`${TMP}/genv.txt`, '');
execFileSync('node', [R + 'scripts/novedades.mjs', '--publicar', `${TMP}/nov.json`], { env: { ...process.env, GITHUB_ENV: `${TMP}/genv.txt` } });
const env = fs.readFileSync(`${TMP}/genv.txt`, 'utf8');
assert.match(env, /^NOVEDADES_MD<<FIN_NOVEDADES_BUSSEV\n### Cambios en los datos/); assert.match(env, /\nNOVEDADES_B64=[A-Za-z0-9+/=]+\n$/);
assert.equal(JSON.parse(Buffer.from(env.match(/NOVEDADES_B64=(.*)\n/)[1], 'base64').toString('utf8')).id, '2026-12-01');
// sin archivo: no rompe y deja las variables vacías
fs.writeFileSync(`${TMP}/genv.txt`, ''); execFileSync('node', [R + 'scripts/novedades.mjs', '--publicar', `${TMP}/no_existe.json`], { env: { ...process.env, GITHUB_ENV: `${TMP}/genv.txt` } });
assert.match(fs.readFileSync(`${TMP}/genv.txt`, 'utf8'), /NOVEDADES_B64=\n$/);
console.log('OK novedades\n' + aTexto(nov).replace(/\*\*/g, '').split('\n').slice(0, 14).join('\n'));
