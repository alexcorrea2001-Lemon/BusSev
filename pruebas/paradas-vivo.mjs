// Paradas de TUSSAM en directo: si una línea va desviada (paradas provisionales), se ponen las de TUSSAM;
// si TUSSAM responde raro o no responde, no se rompe nada.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const R = process.argv[2] || '../';
const V = await import(R + 'scripts/paradas_tussam.mjs');
const { comparar } = await import(R + 'scripts/novedades.mjs');

const P = (codigo, lat) => ({ codigo, nombre: `Parada ${codigo}`, latitud: lat, longitud: -5.99, calle: '', numero: '', codigo_postal: '', municipio: 'Sevilla', direccion_completa: '' });
const base = () => ({
  generado: '2026-09-28', caduca: '2027-01-17', fuente: 'GTFS',
  paradas: ['1', '2', '3', '4', '5', '6', '7', '8'].map((c, i) => P(c, 37.38 + i * 0.001)),
  lineas: [{ numero: '01', nombre: 'Uno' }, { numero: '10', nombre: 'Diez' }],
  recorridos: [
    ['1', '01', 1, 0], ['2', '01', 1, 1], ['3', '01', 1, 2],
    ['3', '01', 2, 0], ['2', '01', 2, 1], ['1', '01', 2, 2],
    ['4', '10', 1, 0], ['5', '10', 1, 1], ['6', '10', 1, 2], ['7', '10', 1, 3],
    ['7', '10', 2, 0], ['6', '10', 2, 1], ['5', '10', 2, 2], ['4', '10', 2, 3],
  ],
});
const N = (codigo, lat = 37.4) => ({ codigo, nombre: `Nueva ${codigo}`, latitud: lat, longitud: -5.98 });
const nodos = (cs) => cs.map((c) => N(c));

// leerNodos: lo que manda TUSSAM
assert.deepEqual(V.leerNodos({ result: [
  { codigo: 77, posicion: { latitudE6: 37400000, longitudE6: -5980000 }, descripcion: { texto: '  Doctor  Leal ' } },
  { codigo: 77, posicion: { latitudE6: 37400000, longitudE6: -5980000 } },   // repetida
  { codigo: 'x', posicion: { latitudE6: 37400000, longitudE6: -5980000 } },  // código raro
  { codigo: 9, posicion: { latitudE6: 0, longitudE6: 0 } },                  // sin posición
] }), [{ codigo: '77', nombre: 'Doctor Leal', latitud: 37.4, longitud: -5.98 }]);

// Línea 10 desviada: en la ida deja la 6 y pasa por la 900 (nueva). «1» de TUSSAM es la «01» del GTFS.
{
  const D = base();
  const vivo = new Map([
    ['1', { 1: nodos(['1', '2', '3']), 2: nodos(['3', '2', '1']) }],
    ['10', { 1: nodos(['4', '5', '900', '7']), 2: nodos(['7', '6', '5', '4']) }],
  ]);
  const r = V.aplicarVivo(D, vivo);
  assert.deepEqual(r.cambios, ['10|1']);
  assert.deepEqual(r.nuevas, ['900']);
  const ida = V.recorridosDe(D).get('10|1');
  assert.deepEqual(ida, ['4', '5', '900', '7']);
  assert.deepEqual(V.recorridosDe(D).get('10|2'), ['7', '6', '5', '4'], 'la vuelta no se toca');
  assert.equal(D.paradas.find((p) => p.codigo === '900').nombre, 'Nueva 900');
  assert.ok(D.vivo?.h && D.vivo.k.join() === '10|1');
  // Las novedades lo cuentan y con otro id (aunque el GTFS sea el mismo)
  const nov = comparar(base(), D);
  assert.notEqual(nov.id, '2026-09-28');
  const texto = JSON.stringify(nov.grupos);
  assert.match(texto, /10: ahora para en Nueva 900 \(900\)/);
  assert.match(texto, /Paradas nuevas/);
  // Otra vez con lo mismo: no cambia nada (no hay compilaciones de más cada semana)
  const copia = JSON.stringify(D);
  V.aplicarVivo(D, vivo);
  assert.equal(JSON.stringify(D), copia);
  // Cuando el GTFS ya trae el desvío: TUSSAM y GTFS coinciden y desaparece la marca
  const G = JSON.parse(copia); delete G.vivo;
  assert.deepEqual(V.aplicarVivo(G, vivo).cambios, []);
  assert.equal(G.vivo, undefined);
}

// Sentidos al revés en TUSSAM: se cruzan solos
{
  const D = base();
  const r = V.aplicarVivo(D, new Map([['10', { 1: nodos(['7', '6', '5', '4']), 2: nodos(['4', '5', '6', '7']) }]]));
  assert.deepEqual(r.cambios, []);
}

// Respuesta que no se parece a la línea: no se usa
{
  const D = base(); const antes = JSON.stringify(D);
  const r = V.aplicarVivo(D, new Map([['10', { 1: nodos(['20', '21', '22', '4']), 2: [] }]]));
  assert.deepEqual(r.cambios, []); assert.equal(r.saltadas.length, 1);
  assert.equal(JSON.stringify(D), antes);
}

// Si TUSSAM no responde hoy, se conservan las paradas de TUSSAM de la otra vez
{
  const antes = base();
  V.aplicarVivo(antes, new Map([['10', { 1: nodos(['4', '5', '900', '7']), 2: nodos(['7', '6', '5', '4']) }]]));
  const hoy = base();   // el GTFS vuelve a traer lo de siempre
  assert.deepEqual(V.conservarAnteriores(hoy, antes), ['10|1']);
  assert.deepEqual(V.recorridosDe(hoy).get('10|1'), ['4', '5', '900', '7']);
  assert.equal(hoy.vivo.h, antes.vivo.h);
  // …pero no si el GTFS es otro (más nuevo)
  const otro = base(); otro.generado = '2027-01-18';
  assert.deepEqual(V.conservarAnteriores(otro, antes), []);
}

// Credenciales: se leen del Secret y, si falta algo, no se usa
assert.equal(V.leerCredenciales(''), null);
assert.equal(V.leerCredenciales('window.BUSSEV_TUSSAM = { clientId: "a" };'), null);
assert.equal(V.leerCredenciales('esto no es js {{'), null);
assert.equal(V.leerCredenciales('window.BUSSEV_TUSSAM={clientId:"a",clientSecret:"b",user:"c",pass:"d"};').user, 'c');

// pedirVivo con un TUSSAM de mentira (token, líneas y nodos; un 429 por medio)
{
  let pedidas = 0, enfado = true;
  const resp = (status, j) => ({ ok: status >= 200 && status < 300, status, json: async () => j });
  const falso = async (url, op) => {
    pedidas++;
    if (url.includes('openid-connect/token')) { assert.match(op.body, /grant_type=password/); return resp(200, { access_token: 'T' }); }
    assert.equal(op.headers.Authorization, 'Bearer T');
    if (url.includes('/lineas?')) return resp(200, { result: { lineasDisponibles: [{ linea: 110, labelLinea: '10' }] } });
    if (url.includes('/nodosLinea/110') && enfado) { enfado = false; return resp(429, {}); }
    const s = /sentido=(\d)/.exec(url)[1];
    return resp(200, (s === '1' ? [4, 5, 900, 7] : [7, 6, 5, 4]).map((c) => ({ codigo: c, posicion: { latitudE6: 37400000, longitudE6: -5980000 }, descripcion: { texto: `P${c}` } })));
  };
  const vivo = await V.pedirVivo({ clientId: 'a', clientSecret: 'b', user: 'c', pass: 'd' }, { fetchFn: falso, pausa: 1 });
  assert.deepEqual(vivo.get('10')[1].map((x) => x.codigo), ['4', '5', '900', '7']);
  assert.ok(pedidas >= 5);
}

// Escribir y volver a leer data.js
{
  const D = base(); V.aplicarVivo(D, new Map([['10', { 1: nodos(['4', '5', '900', '7']), 2: [] }]]));
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bsv-')), 'data.js');
  V.escribirDatos(f, D);
  assert.match(fs.readFileSync(f, 'utf8'), /^\/\* Paradas, líneas y recorridos de TUSSAM\. Fuente: GTFS oficial, válido del 2026-09-28 al 2027-01-17\./);
  assert.equal(JSON.stringify(V.leerDatos(f)), JSON.stringify(D));
}

console.log('Paradas de TUSSAM en directo: OK');
