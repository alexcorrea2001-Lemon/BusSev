// Prueba de tramosConCarril (se extrae de www/app.js entre las marcas CARRILES-INI / CARRILES-FIN)
import fs from 'node:fs'; import vm from 'node:vm'; import assert from 'node:assert/strict';
const R = process.argv[2];
const src = fs.readFileSync(R + 'www/app.js', 'utf8');
const m = src.match(/\/\* CARRILES-INI \*\/([\s\S]*?)\/\* CARRILES-FIN \*\//);
assert.ok(m, 'no está el bloque CARRILES en app.js');
const ctx = {}; vm.runInNewContext(m[1] + '\nthis.f = tramosConCarril;', ctx);
const f = ctx.f;
const kx = 111320 * Math.cos(37.39 * Math.PI / 180), ky = 110540;
const P = (x, y) => [37.39 + y / ky, -5.98 + x / kx];           // metros -> lat/lon
const recta = (x0, y0, x1, y1, n = 20) => Array.from({ length: n + 1 }, (_, i) => P(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n));
const largo = (pts) => { let s = 0; for (let i = 1; i < pts.length; i++) s += Math.hypot((pts[i][1] - pts[i - 1][1]) * kx, (pts[i][0] - pts[i - 1][0]) * ky); return s; };
const porCarril = (ts, i) => { const o = {}; for (const t of ts.filter((t) => t.i === i)) o[t.carril] = (o[t.carril] || 0) + largo(t.pts); return o; };

// 1) Una sola línea: nunca se desplaza
let ts = f([{ linea: '29', path: recta(0, 0, 0, 1000) }, { linea: '29', path: recta(0, 400, 0, 1000) }]);
assert.ok(ts.every((t) => t.carril === 0), 'una sola línea debe ir centrada');

// 2) Dos líneas que SOLO comparten el último tramo (A viene del sur, B del oeste; comparten x=0, y 1000..2000)
const A = [...recta(0, 0, 0, 1000), ...recta(0, 1000, 0, 2000).slice(1)];
const B = [...recta(-1000, 1000, 0, 1000), ...recta(3, 1000, 3, 2000).slice(1)];   // 3 m al lado: mismo eje de calle
ts = f([{ linea: '29', path: A }, { linea: '52', path: B }]);
const a = porCarril(ts, 0), b = porCarril(ts, 1);
assert.ok(a[0] > 900 && a[0] < 1100, `A sola debe ir centrada ~1000 m (va ${JSON.stringify(a)})`);
assert.ok(b[0] > 900 && b[0] < 1100, `B sola debe ir centrada ~1000 m (va ${JSON.stringify(b)})`);
assert.ok(a[-0.5] > 900 && b[0.5] > 900, `en el tramo común van a los lados (${JSON.stringify(a)} ${JSON.stringify(b)})`);
// el trazado completo se conserva (no se pierde ni se inventa camino)
for (const [i, orig] of [[0, A], [1, B]]) { const tot = ts.filter((t) => t.i === i).reduce((s, t) => s + largo(t.pts), 0); assert.ok(Math.abs(tot - largo(orig)) < 5, 'se conserva la longitud'); }

// 3) Tres líneas juntas: -1, 0, +1; el orden no depende de qué bus llega antes
const t3 = (orden) => f(orden.map((l) => ({ linea: l, path: recta(0, 0, 0, 800) })));
const c1 = t3(['C1', '29', '52']), c2 = t3(['52', 'C1', '29']);
const car = (ts, orden, l) => ts.find((t) => t.i === orden.indexOf(l)).carril;
assert.deepEqual(['29', '52', 'C1'].map((l) => car(c1, ['C1', '29', '52'], l)).sort(), [-1, 0, 1]);
for (const l of ['29', '52', 'C1']) assert.equal(car(c1, ['C1', '29', '52'], l), car(c2, ['52', 'C1', '29'], l), 'carril estable');

// 4) Calles paralelas a 40 m o un cruce en perpendicular NO cuentan como "juntas"
ts = f([{ linea: '29', path: recta(0, 0, 0, 1000) }, { linea: '52', path: recta(40, 0, 40, 1000) }, { linea: 'C1', path: recta(-500, 500, 500, 500) }]);
assert.ok(ts.every((t) => t.carril === 0), 'paralelas lejanas o cruces: sin desplazar');

// 5) Muchas líneas juntas: se ven TODAS (cada una en su franja, más fina), sin que el conjunto se ensanche
{ const ls = ['3', 'C1', 'C2', '29', '52', '22', 'B4']; const r = f(ls.map((l) => ({ linea: l, path: recta(0, 0, 0, 800) })));
  const cs = r.map((t) => t.carril).sort((x, y) => x - y);
  assert.equal(new Set(cs).size, 7, 'cada línea en un carril distinto');
  assert.ok(Math.abs(cs[0]) <= 1.5 && Math.abs(cs[6]) <= 1.5, 'el conjunto no ocupa más que 4 líneas normales');
  const paso = (cs[1] - cs[0]) * 6, grosor = r[0].ancho * 5;
  assert.ok(r.every((t) => t.ancho === r[0].ancho) && grosor < paso && grosor >= 1.5, `las franjas no se pisan y se ven (paso ${paso}, grosor ${grosor})`);
  const cuatro = f(['1', '2', '3', '4'].map((l) => ({ linea: l, path: recta(0, 0, 0, 800) })));
  assert.ok(cuatro.every((t) => t.ancho === 1), 'hasta 4 líneas, grosor normal'); }
// 5b) Muchas líneas pero pocos colores (el caso de la captura: 4 azul oscuro + amarilla + verde + azul claro):
//     las del mismo color comparten franja y cada COLOR se ve a su grosor normal
{ const cs = { 22: '#001', 29: '#001', 52: '#001', A7: '#001', C1: '#0a0', C2: '#fa0', B4: '#8cf' };
  const r = f(Object.keys(cs).map((l) => ({ linea: l, color: cs[l], path: recta(0, 0, 0, 800) })));
  const porColor = {}; r.forEach((t, k) => { (porColor[Object.values(cs)[t.i]] ||= new Set()).add(t.carril); });
  assert.ok(Object.values(porColor).every((x) => x.size === 1), 'cada color en una sola franja');
  assert.equal(new Set(r.map((t) => t.carril)).size, 4, 'cuatro colores, cuatro franjas');
  assert.ok(r.every((t) => t.ancho === 1), 'a grosor normal'); }
// 6) Datos reales: 29 y 52 hacia una parada; nada de saltos de carril en tramos cortos
console.log('OK carriles');
