/* BusSev — diseños de Sevilla para las tarjetas (ilustraciones propias en SVG, estilo cartel) y marcos. */
'use strict';
(() => {

/* Los dibujos van a la derecha y abajo, para que el nombre, el saldo y el número se lean bien a la izquierda.
   Cada vez que se pinta un dibujo, sus degradados llevan un id distinto (si no, al haber varias tarjetas en
   pantalla o una escondida, el navegador puede coger el degradado de otra y salir en blanco). */
let n = 0;
const arte = (fn) => () => { const id = `ds${++n}`; return `<svg class="tc-arte" viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${fn((k) => `${id}${k}`)}</svg>`; };
const lg = (id, x2, y2, stops) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</linearGradient>`;
const rg = (id, cx, cy, r, stops) => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</radialGradient>`;
// Velo oscuro a la izquierda: el texto siempre se lee, sea cual sea el dibujo
const velo = (u, c = '#000', a = 0.38) => `${lg(u('v'), 1, 0, [[0, c, a], [0.55, c, a * 0.35], [1, c, 0]])}`;
const veloRect = (u) => `<rect width="400" height="250" fill="url(#${u('v')})"/>`;
const estrellas = (pts, c = '#fff') => pts.map(([x, y, r = 1]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity="${0.5 + (x % 5) / 10}"/>`).join('');
// Bombillas repartidas a lo largo de un camino de puntos (para la portada)
function bombillas(pts, paso, r, c) {
  let s = '';
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    const L = Math.hypot(x1 - x0, y1 - y0), k = Math.max(1, Math.round(L / paso));
    for (let j = 0; j < k; j++) { const t = j / k; s += `<circle cx="${(x0 + (x1 - x0) * t).toFixed(1)}" cy="${(y0 + (y1 - y0) * t).toFixed(1)}" r="${r}" fill="${c}"/>`; }
  }
  return s;
}
// Guirnalda de farolillos de feria
function farolillos(x0, x1, y0, caida, num, escala = 1) {
  const cols = [['#fff', '#e11d48'], ['#e11d48', '#fff'], ['#16a34a', '#fff'], ['#facc15', '#e11d48']];
  let s = `<path d="M${x0} ${y0} Q ${(x0 + x1) / 2} ${y0 + caida * 2} ${x1} ${y0}" stroke="#1f1b16" stroke-opacity=".55" stroke-width="1" fill="none"/>`;
  for (let i = 0; i < num; i++) {
    const t = (i + 0.5) / num, x = x0 + (x1 - x0) * t, y = y0 + caida * 4 * t * (1 - t) * 0.5 * 2 / 2 + caida * 2 * t * (1 - t);
    const [f, p] = cols[i % 4];
    s += `<g transform="translate(${x.toFixed(1)} ${(y + 2).toFixed(1)}) scale(${escala})"><rect x="-1.6" y="-1" width="3.2" height="3" fill="#2a2420"/>
      <path d="M0 2c-8 0-9.5 6-9.5 10.5S-8 23 0 23s9.5-6 9.5-10.5S8 2 0 2z" fill="${f}"/>
      <path d="M-9.4 9.5h18.8M-9.4 15.5h18.8" stroke="#000" stroke-opacity=".12" stroke-width="1"/>
      <circle cx="-3.5" cy="7" r="1.5" fill="${p}"/><circle cx="3.5" cy="12.5" r="1.5" fill="${p}"/><circle cx="-2.5" cy="18" r="1.5" fill="${p}"/>
      <rect x="-2" y="22.5" width="4" height="2.5" fill="#2a2420"/></g>`;
  }
  return s;
}
// Palmera
const palmera = (x, y, h, c) => `<g fill="none" stroke="${c}" stroke-linecap="round"><path d="M${x} ${y} q${h * 0.08} ${-h * 0.5} ${-h * 0.04} ${-h}" stroke-width="${h * 0.06}"/>
  <g stroke-width="${h * 0.05}"><path d="M${x - h * 0.04} ${y - h} q${-h * 0.3} ${-h * 0.12} ${-h * 0.5} ${h * 0.12}"/><path d="M${x - h * 0.04} ${y - h} q${h * 0.3} ${-h * 0.14} ${h * 0.5} ${h * 0.1}"/>
  <path d="M${x - h * 0.04} ${y - h} q${-h * 0.2} ${-h * 0.3} ${-h * 0.42} ${-h * 0.18}"/><path d="M${x - h * 0.04} ${y - h} q${h * 0.22} ${-h * 0.3} ${h * 0.42} ${-h * 0.2}"/><path d="M${x - h * 0.04} ${y - h} q${h * 0.02} ${-h * 0.3} ${h * 0.05} ${-h * 0.36}"/></g></g>`;

/* Estilo «tarjeta de lujo»: fondo con un dibujo ornamental muy suave y el monumento en trazo fino (dorado o crema),
   con un halo de luz detrás. Todos comparten el mismo estilo, como el azulejo. */
const ORO = '#E9C77B', CREMA = '#F5E9D0';
const pat = (id, w, h, inner) => `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${w}" height="${h}">${inner}</pattern>`;
const trazo = (c, w, inner, op = 1) => `<g fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" opacity="${op}">${inner}</g>`;
const arco = (x, y, w, h) => `<path d="M${x} ${y + h} V${y + w / 2} A${w / 2} ${w / 2} 0 0 1 ${x + w} ${y + w / 2} V${y + h}"/>`;
const halo = (u, cx, cy, r, c = ORO, a = 0.22) => `${rg(u('h'), 0.5, 0.5, 0.5, [[0, c, a], [1, c, 0]])}<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${u('h')})"/>`;
const base = (u, c1, c2, patron) => `<defs>${lg(u('c'), 1, 1, [[0, c1], [1, c2]])}${patron}</defs><rect width="400" height="250" fill="url(#${u('c')})"/><rect width="400" height="250" fill="url(#${u('p')})"/>`;
const almenas = (x0, x1, y, h, w) => { let d = `M${x0} ${y}`; for (let x = x0; x + w <= x1 + 0.1; x += 2 * w) d += ` v${-h} h${w} v${h} h${Math.min(w, x1 - x - w)}`; return `<path d="${d}"/>`; };
const lineas = (y0, n, x0, x1, paso, op) => Array.from({ length: n }, (_, i) => { const m = (x1 - x0) * (1 - i / (n + 1)) / 2, c = (x0 + x1) / 2; return `<path d="M${c - m} ${y0 + i * paso} H${c + m}" opacity="${op * (1 - i / n)}"/>`; }).join('');

/* La Giralda: la torre en oro sobre granate, con la sebka (los rombos de la torre) de fondo */
const giralda = arte((u) => `${base(u, '#7c1f36', '#2e0815', pat(u('p'), 18, 18, `<path d="M0 9L9 0L18 9L9 18Z" fill="none" stroke="${ORO}" stroke-opacity=".08" stroke-width="1"/>`) + pat(u('s'), 8, 8, `<path d="M0 4L4 0L8 4L4 8Z" fill="none" stroke="${ORO}" stroke-opacity=".55" stroke-width=".8"/>`) + velo(u, '#1a0510', 0.45))}
  ${halo(u, 315, 130, 150)}
    <rect x="298" y="150" width="34" height="86" fill="url(#${u('s')})"/>
  ${trazo(ORO, 2.2, `<path d="M290 250 V104 H340 V250"/><path d="M284 104 H346 M284 98 H346"/>
    <rect x="298" y="150" width="34" height="86"/>${arco(301, 116, 10, 24)}${arco(319, 116, 10, 24)}
    <path d="M294 98 V66 H336 V98"/>${arco(299, 72, 9, 22)}${arco(310.5, 72, 9, 22)}${arco(322, 72, 9, 22)}<path d="M290 66 H340"/>
    <path d="M300 66 V44 H330 V66"/>${arco(311, 49, 8, 13)}<path d="M296 44 H334"/>
    <path d="M305 44 V30 H325 V44"/><path d="M305 30 Q315 12 325 30"/><path d="M315 16 V4"/><path d="M315 5 l9 2.5 l-9 3"/>`)}
  <circle cx="315" cy="13" r="2.4" fill="${ORO}"/><circle cx="315" cy="8.5" r="1.8" fill="${ORO}"/>
  ${veloRect(u)}`);

/* La Torre del Oro: trazo dorado sobre azul noche, con el río y sus reflejos */
const torreoro = arte((u) => `${base(u, '#123764', '#06162c', pat(u('p'), 28, 14, `<path d="M0 7 q7 -6 14 0 t14 0" fill="none" stroke="${CREMA}" stroke-opacity=".06"/>`) + velo(u, '#040e1f', 0.5))}
  ${halo(u, 310, 140, 140)}
  ${estrellas([[150, 30, 0.9], [210, 18, 0.7], [250, 48, 0.8], [380, 26, 0.9], [360, 70, 0.6]], CREMA)}
  ${trazo(ORO, 2.2, `<path d="M266 214 V128 H354 V214"/>${almenas(262, 358, 128, 9, 8)}
    <g opacity=".45"><path d="M288 128 V214 M310 128 V214 M332 128 V214"/></g>
    ${arco(272, 156, 9, 16)}${arco(339, 156, 9, 16)}${arco(304, 176, 12, 38)}
    <path d="M286 119 V92 H334 V119"/>${almenas(283, 337, 92, 7, 6)}<g opacity=".45"><path d="M302 92 V119 M318 92 V119"/></g>${arco(305, 98, 10, 16)}
    <path d="M299 85 V68 H321 V85"/><path d="M296 68 Q310 40 324 68"/><path d="M310 46 V34"/>`)}
  <circle cx="310" cy="32" r="2.2" fill="${ORO}"/>
  ${trazo(ORO, 1.8, `<path d="M214 214 H400"/>${lineas(222, 4, 262, 358, 7, 0.6)}`)}
  ${trazo(CREMA, 1.2, `<path d="M230 240 h40 M370 236 h24"/>`, 0.25)}
  ${veloRect(u)}`);

/* Triana: la capillita del Carmen y el puente con sus anillos, en crema sobre verde azulado */
const triana = arte((u) => {
  let puente = '';
  for (const x of [242, 294, 346]) {
    puente += `<path d="M${x} 206 Q${x + 26} 180 ${x + 52} 206"/>`;
    for (const t of [0.2, 0.4, 0.6, 0.8]) {
      const cx = x + 52 * t, yArco = 206 - 52 * t * (1 - t);
      const r = Math.min(5.2, Math.max(2, (yArco - 168) / 2 - 1.5));
      puente += `<circle cx="${cx.toFixed(1)}" cy="${(168 + (yArco - 168) / 2).toFixed(1)}" r="${r.toFixed(1)}"/>`;
    }
  }
  return `${base(u, '#145566', '#062630', pat(u('p'), 16, 16, `<circle cx="8" cy="8" r="1.2" fill="${CREMA}" fill-opacity=".09"/>`) + velo(u, '#03161c', 0.5))}
    ${halo(u, 300, 150, 150, '#ffd9a0', 0.16)}
    ${trazo(ORO, 1.8, `<circle cx="352" cy="64" r="15"/>`, 0.8)}
    ${trazo(CREMA, 2.2, `<path d="M208 214 V160 H238 V214"/>${arco(217, 182, 12, 32)}<path d="M212 160 V140 H234 V160"/><path d="M212 140 Q223 118 234 140"/><path d="M223 122 V110 M218.5 115 H227.5"/>
      <path d="M238 152 H400 M238 160 H400 M238 168 H400"/>${Array.from({ length: 20 }, (_, i) => `<path d="M${244 + i * 8} 152 V160"/>`).join('')}
      <path d="M242 168 V214 M294 168 V214 M346 168 V214 M398 168 V214"/>${puente}`)}
    ${trazo(CREMA, 1.8, `<path d="M214 214 H400"/>${lineas(222, 4, 240, 400, 7, 0.5)}`)}
    ${veloRect(u)}`;
});

/* Azulejo sevillano: panel de loza con cenefa */
const tesela = (x, y, s, u) => `<g transform="translate(${x} ${y})"><use href="#${u('a')}" width="${s}" height="${s}"/></g>`;
const azulejo = arte((u) => {
  let celdas = '';
  for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) celdas += tesela(196 + c * 44, -8 + r * 44, 44, u);
  return `<defs>${lg(u('c'), 1, 1, [[0, '#123f8c'], [1, '#0a2559']])}${velo(u, '#081b45', 0.35)}
    <symbol id="${u('a')}" viewBox="0 0 44 44">
      <rect width="44" height="44" fill="#f7f0de"/>
      <path d="M22 4c5 6 5 10 0 14-5-4-5-8 0-14zM22 40c5-6 5-10 0-14-5 4-5 8 0 14zM4 22c6-5 10-5 14 0-4 5-8 5-14 0zM40 22c-6-5-10-5-14 0 4 5 8 5 14 0z" fill="#1d4f9c"/>
      <circle cx="22" cy="22" r="4.6" fill="#e8a317"/><circle cx="22" cy="22" r="2" fill="#1d4f9c"/>
      <path d="M0 0h9a9 9 0 0 1-9 9zM44 0h-9a9 9 0 0 0 9 9zM0 44h9a9 9 0 0 0-9-9zM44 44h-9a9 9 0 0 1 9-9z" fill="#1d4f9c"/>
      <path d="M0 0l6 6M44 0l-6 6M0 44l6-6M44 44l-6-6" stroke="#e8a317" stroke-width="1.6"/>
      <path d="M12 12l4 4M32 12l-4 4M12 32l4-4M32 32l-4-4" stroke="#2f8f5b" stroke-width="2.2" stroke-linecap="round"/>
      <rect width="44" height="44" fill="none" stroke="#d8ccb0" stroke-width=".8"/>
    </symbol></defs>
    <rect width="400" height="250" fill="url(#${u('c')})"/>
    <g>${celdas}</g>
    <path d="M196 0 V250" stroke="#e8a317" stroke-width="4"/><path d="M190 0 V250" stroke="#f7f0de" stroke-width="2"/>
    <g fill="#f7f0de" opacity=".14">${Array.from({ length: 9 }, (_, i) => `<path d="M${18 + (i % 3) * 58} ${22 + Math.floor(i / 3) * 78}l10 10-10 10-10-10z"/>`).join('')}</g>
    ${veloRect(u)}`;
});

/* Plaza de España: en crema y oro sobre azul cobalto (los colores del azulejo) */
const plazaespana = arte((u) => {
  const torre = (x) => `<path d="M${x - 12} 200 V92 H${x + 12} V200"/><path d="M${x - 15} 92 H${x + 15}"/><path d="M${x - 9} 92 V70 H${x + 9} V92"/><path d="M${x - 11} 70 H${x + 11}"/>
    <path d="M${x - 6} 70 V56 H${x + 6} V70"/><path d="M${x - 6} 56 Q${x} 40 ${x + 6} 56"/><path d="M${x} 44 V32"/>${arco(x - 7, 104, 5, 14)}${arco(x + 2, 104, 5, 14)}${arco(x - 3, 140, 6, 18)}${arco(x - 3.5, 76, 7, 12)}`;
  return `${base(u, '#1f55a8', '#0b2459', pat(u('p'), 22, 22, `<path d="M11 4c2 3 2 5 0 7-2-2-2-4 0-7zM11 18c2-3 2-5 0-7-2 2-2 4 0 7zM4 11c3-2 5-2 7 0-2 2-4 2-7 0zM18 11c-3-2-5-2-7 0 2 2 4 2 7 0z" fill="${CREMA}" fill-opacity=".07"/>`) + velo(u, '#061633', 0.5))}
    ${halo(u, 300, 130, 150, CREMA, 0.14)}
    ${trazo(CREMA, 2, `${torre(226)}${torre(374)}<path d="M238 122 H362"/><path d="M290 122 L300 110 L310 122"/>
      ${Array.from({ length: 8 }, (_, i) => arco(244 + i * 14.5, 132, 9, 18)).join('')}<path d="M238 156 H362"/>
      ${Array.from({ length: 7 }, (_, i) => arco(243 + i * 17, 166, 12, 34)).join('')}<path d="M206 200 H394"/>`)}
    ${trazo(ORO, 2, `<path d="M214 214 H400"/><path d="M262 214 Q300 196 338 214"/><path d="M258 207 Q300 187 342 207"/>
      ${Array.from({ length: 9 }, (_, i) => { const t = (i + 1) / 10, x = 258 + 84 * t, y = 207 - 80 * t * (1 - t); return `<path d="M${x.toFixed(1)} ${y.toFixed(1)} v5"/>`; }).join('')}`)}
    ${trazo(CREMA, 1.4, lineas(224, 3, 230, 370, 8, 0.4))}
    ${veloRect(u)}`;
});

/* Las Setas: la retícula de madera en trazo cálido sobre gris carbón */
const setas = arte((u) => {
  const forma = 'M186 120 C 186 60, 260 46, 300 62 C 330 36, 400 40, 404 92 C 404 124, 380 130, 360 128 C 352 150, 344 160, 344 210 h-26 C 318 170, 314 140, 300 128 C 290 132, 274 134, 262 132 C 252 150, 248 170, 248 210 h-24 C 224 170, 222 146, 214 134 C 196 132, 186 128, 186 120z';
  const ret = [];
  for (let x = 190; x <= 404; x += 10) ret.push(`<path d="M${x} 30 V214"/>`);
  for (let y = 40; y <= 214; y += 10) ret.push(`<path d="M180 ${y} H404"/>`);
  return `${base(u, '#2b2836', '#0f0e15', pat(u('p'), 12, 12, `<path d="M0 0H12V12" fill="none" stroke="${CREMA}" stroke-opacity=".035"/>`) + velo(u, '#08070c', 0.5)
    + `<clipPath id="${u('k')}"><path d="${forma}"/></clipPath>`)}
    ${halo(u, 300, 120, 150, '#f2b56b', 0.2)}
    <g clip-path="url(#${u('k')})">${trazo('#F2C38B', 1.1, ret.join(''), 0.75)}</g>
    ${trazo('#F2C38B', 2.4, `<path d="${forma}"/><path d="M214 214 H400"/>`)}
    ${trazo(CREMA, 1.2, `<path d="M260 234 h60 M340 226 h50"/>`, 0.2)}
    ${veloRect(u)}`;
});

/* Feria: la portada hecha de bombillas, sobre noche con lunares muy suaves */
const feriaportada = arte((u) => {
  const c = '#FFE3A1';
  const torre = (x, y, w, h) => bombillas([[x, y + h], [x, y], [x + w / 2, y - w * 0.75], [x + w, y], [x + w, y + h]], 6, 1.5, c);
  return `${base(u, '#22124d', '#0a0620', pat(u('p'), 24, 24, `<circle cx="6" cy="6" r="2.4" fill="#fff" fill-opacity=".05"/><circle cx="18" cy="18" r="2.4" fill="#fff" fill-opacity=".05"/>`) + velo(u, '#06031a', 0.5))}
    ${halo(u, 300, 130, 150, '#ffd27a', 0.3)}
    ${torre(214, 122, 22, 88)}${torre(364, 122, 22, 88)}${torre(244, 96, 24, 114)}${torre(332, 96, 24, 114)}${torre(274, 68, 52, 142)}
    ${bombillas([[214, 146], [386, 146]], 6, 1.5, c)}${bombillas([[214, 210], [386, 210]], 6, 1.5, c)}
    ${bombillas([[282, 210], [282, 174], [300, 156], [318, 174], [318, 210]], 5.5, 1.6, '#fff')}
    ${bombillas([[284, 112], [300, 96], [316, 112], [300, 128], [284, 112]], 5, 1.4, '#ffb3c7')}
    <circle cx="300" cy="112" r="4.5" fill="${ORO}"/>
    ${trazo(ORO, 1.6, `<path d="M300 29 V16"/>`)}<circle cx="300" cy="14" r="2.6" fill="${c}"/>
    ${trazo(ORO, 1.8, `<path d="M214 218 H400"/>${lineas(226, 3, 214, 386, 7, 0.45)}`)}
    ${veloRect(u)}`;
});

/* Feria: la caseta en trazo blanco sobre rojo flamenco con lunares */
const feriacaseta = arte((u) => {
  const fols = Array.from({ length: 6 }, (_, i) => { const x = 236 + i * 28, y = 122 + Math.sin((i + 0.5) / 6 * Math.PI) * 10;
    return `<path d="M${x} ${y - 6} c-7 0 -8 5 -8 9 s1 9 8 9 s8 -5 8 -9 s-1 -9 -8 -9z"/><path d="M${x - 8} ${y + 3} h16"/>`; }).join('');
  return `${base(u, '#cf1733', '#7a0a1e', pat(u('p'), 26, 26, `<circle cx="6.5" cy="6.5" r="3.6" fill="#fff" fill-opacity=".13"/><circle cx="19.5" cy="19.5" r="3.6" fill="#fff" fill-opacity=".13"/>`) + velo(u, '#3d0410', 0.45))}
    ${halo(u, 300, 130, 140, '#ffe1b0', 0.18)}
    ${trazo('#fff', 2.2, `<path d="M206 94 L300 52 L394 94 Z"/>${[-3, -2, -1, 0, 1, 2, 3].map((k) => `<path d="M300 52 L${300 + k * 27} 94"/>`).join('')}
      <path d="M206 94 ${Array.from({ length: 12 }, () => 'q7.8 12 15.7 0').join(' ')}"/>
      <path d="M216 100 V208 M384 100 V208"/><path d="M228 116 Q300 132 372 116"/>${fols}
      <path d="M216 180 H384 M216 196 H384"/>${Array.from({ length: 14 }, (_, i) => `<path d="M${226 + i * 12} 180 V196"/>`).join('')}`)}
    ${trazo(ORO, 1.6, `<path d="M300 52 V40"/><path d="M296 42 l4 -8 l4 8"/>`)}
    ${trazo('#fff', 1.8, `<path d="M214 210 H400"/>`, 0.7)}
    ${veloRect(u)}`;
});

/* Semana Santa: el palio en oro sobre terciopelo morado, con la candelería encendida */
const damasco = (u) => pat(u('p'), 30, 30, `<g fill="${ORO}" fill-opacity=".08"><path d="M15 5c2.4 3.4 2.4 5.6 0 8-2.4-2.4-2.4-4.6 0-8zM15 25c2.4-3.4 2.4-5.6 0-8-2.4 2.4-2.4 4.6 0 8zM5 15c3.4-2.4 5.6-2.4 8 0-2.4 2.4-4.6 2.4-8 0zM25 15c-3.4-2.4-5.6-2.4-8 0 2.4 2.4 4.6 2.4 8 0z"/><circle cx="15" cy="15" r="1.6"/></g>`);
const llama = (u, x, y, s = 1) => `<circle cx="${x}" cy="${y}" r="${7 * s}" fill="url(#${u('l')})"/><path d="M${x} ${y - 5 * s}c${2.6 * s} ${3 * s} ${2.4 * s} ${5 * s} 0 ${6.4 * s}c${-2.4 * s} ${-1.4 * s} ${-2.6 * s} ${-3.4 * s} 0 ${-6.4 * s}z" fill="#FFD36B"/>`;
const semanasantapalio = arte((u) => {
  let velas = '';
  for (let f = 0; f < 3; f++) for (let i = 0; i < 8 - f; i++) {
    const x = 236 + f * 9 + i * 18, y = 166 - f * 13, h = 26 + f * 4;
    velas += `<rect x="${x - 1.4}" y="${y}" width="2.8" height="${h}" rx="1" fill="${CREMA}"/>${llama(u, x, y - 4, 0.9)}`;
  }
  return `${base(u, '#4f1d72', '#1b062b', damasco(u) + rg(u('l'), 0.5, 0.5, 0.5, [[0, '#ffd36b', 0.6], [1, '#ffd36b', 0]]) + velo(u, '#0d0316', 0.5))}
    ${halo(u, 305, 150, 150, '#ffc768', 0.22)}
    ${trazo(ORO, 2.2, `<rect x="212" y="62" width="180" height="22" rx="2"/><path d="M220 73 H384" stroke-dasharray="2 6"/>
      <path d="M212 84 ${Array.from({ length: 12 }, () => 'q7.5 11 15 0').join(' ')}"/>
      <path d="M218 90 V196 M242 90 V196 M362 90 V196 M386 90 V196"/>
      <path d="M212 196 H400 V224 H212 Z"/>${Array.from({ length: 6 }, (_, i) => arco(219 + i * 30, 202, 19, 16)).join('')}`)}
    <g fill="${ORO}">${Array.from({ length: 12 }, (_, i) => `<circle cx="${219.5 + i * 15}" cy="94" r="1.8"/>`).join('')}</g>
    ${velas}
    ${trazo(ORO, 1.6, `<path d="M214 232 H400"/>`, 0.5)}
    ${veloRect(u)}`;
});

/* Semana Santa: nazarenos con sus cirios, en trazo dorado */
const semanasantanazarenos = arte((u) => {
  const naz = (x, s, o) => `<g transform="translate(${x} 222) scale(${s})" opacity="${o}">
    ${trazo(ORO, 2 / s, `<path d="M0 -118 L-14 -66 H14 Z"/><path d="M-16 -66 H16 L22 0 H-22 Z"/><path d="M-14 -66 H14 L11 -38 H-11 Z"/><path d="M0 -60 V-44 M-5 -54 H5"/><path d="M17 -78 V-6"/>`)}
    <ellipse cx="-4.5" cy="-80" rx="2" ry="1.4" fill="${ORO}"/><ellipse cx="4.5" cy="-80" rx="2" ry="1.4" fill="${ORO}"/>${llama(u, 17, -84, 1.1)}</g>`;
  return `${base(u, '#2a0f3e', '#0a0412', damasco(u) + rg(u('l'), 0.5, 0.5, 0.5, [[0, '#ffd36b', 0.65], [1, '#ffd36b', 0]]) + velo(u, '#050208', 0.5))}
    ${halo(u, 300, 140, 150, '#ffc768', 0.16)}
    ${trazo(ORO, 1.4, `<path d="M214 222 L300 150 L400 222"/><path d="M200 70 V222 M392 60 V222"/><path d="M200 70 h-8 M392 60 h8"/>`, 0.3)}
    ${naz(352, 0.7, 0.55)}${naz(322, 0.85, 0.72)}${naz(286, 1.02, 0.88)}${naz(242, 1.22, 1)}
    ${trazo(ORO, 1.8, `<path d="M214 224 H400"/>`, 0.6)}
    ${veloRect(u)}`;
});

const DISENOS = {};
const def = (k, nombre, fondo, fn) => { DISENOS[k] = { nombre, fondo, get svg() { return fn(); } }; };
def('giralda', 'La Giralda', '#5a1426', giralda);
def('torreoro', 'Torre del Oro', '#0c2748', torreoro);
def('triana', 'Puente de Triana', '#0d3d4a', triana);
def('azulejo', 'Azulejo', '#123f8c', azulejo);
def('plazaespana', 'Plaza de España', '#15397f', plazaespana);
def('setas', 'Las Setas', '#1d1b26', setas);
def('feriaportada', 'Portada de Feria', '#160c36', feriaportada);
def('feriacaseta', 'Caseta de Feria', '#a5112a', feriacaseta);
def('semanasantapalio', 'Paso de palio', '#35114f', semanasantapalio);
def('semanasantanazarenos', 'Nazarenos', '#1a0828', semanasantanazarenos);

/* Marcos de la tarjeta (se dibujan encima, siguiendo las esquinas redondeadas) */
const MARCOS = [
  ['', 'Sin marco'], ['oro', 'Dorado'], ['plata', 'Plateado'], ['bronce', 'Bronce'], ['rosa', 'Oro rosa'],
  ['arcoiris', 'Arcoíris'], ['neon', 'Neón'], ['doble', 'Doble blanco'], ['azulejo', 'Azulejo'],
  ['lunares', 'Lunares'], ['cordon', 'Cordón morado'], ['madera', 'Madera'],
];

window.DISENOS_TARJETA = DISENOS;
window.MARCOS_TARJETA = MARCOS;
})();
