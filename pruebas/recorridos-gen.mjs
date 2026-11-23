// Generador de recorridos: la línea empieza y acaba en la 1ª y la última parada (sin la cola de cochera), sin
// cortar una vuelta que sí hace el autobús, y la parada cuenta por la más cercana de sus dos posiciones.
import assert from 'node:assert/strict';
process.env.BUSSEV_SOLO_FUNCIONES = '1';
const R = process.argv[2] || '../';
const { recortarExtremos, peorParada } = await import(R + 'scripts/recorridos.mjs');

// Línea recta hacia el este (cada 0,001° de longitud ≈ 88 m) con 300 m de cola tras la última parada
const linea = Array.from({ length: 12 }, (_, i) => [37.39, -5.99 + i * 0.001]);
const paradas = [[37.39, -5.99], [37.39, -5.985], [37.39001, -5.9815]];
const r = recortarExtremos(linea, paradas);
const m = (a, b) => Math.hypot((a[0] - b[0]) * 110540, (a[1] - b[1]) * 88300);
assert.ok(m(r.at(-1), paradas[2]) < 3, 'acaba en la última parada');
assert.ok(m(r[0], paradas[0]) < 3, 'empieza en la primera');
assert.ok(r.length < linea.length, 'quita la cola');

// Cabecera de 2 tramos antes de la 1ª parada
const r2 = recortarExtremos([[37.39, -5.992], [37.39, -5.991], ...linea], paradas);
assert.ok(m(r2[0], paradas[0]) < 3, 'quita la cabecera');

// Una vuelta junto a la cabecera que pasa por una parada: no se corta
const vuelta = [[37.39, -5.99], [37.391, -5.99], [37.391, -5.988], [37.39, -5.988], [37.39, -5.985], [37.39, -5.98]];
const conVuelta = [[37.39, -5.99], [37.391, -5.989], [37.39, -5.985], [37.39, -5.98]];
const r3 = recortarExtremos(vuelta, conVuelta);
assert.ok(peorParada(r3, conVuelta) < 5, 'la parada de la vuelta sigue sobre la línea');

// Línea muy corta o datos raros: se deja igual
assert.deepEqual(recortarExtremos([[1, 1], [2, 2]], paradas), [[1, 1], [2, 2]]);

// peorParada: cuenta la más cercana de las dos posiciones de cada parada
const recta = [[37.39, -5.99], [37.39, -5.98]];
assert.ok(peorParada(recta, [[37.391, -5.985]]) > 100, 'una sola posición, lejos');
assert.ok(peorParada(recta, [[37.391, -5.985]], [[37.39002, -5.985]]) < 5, 'la otra posición está sobre la línea');
console.log('recorridos-gen: ok');
