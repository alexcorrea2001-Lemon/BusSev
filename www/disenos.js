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

/* Plaza de España: ladrillo, piedra y azulejo azul, con sus torres, el cuerpo central y el puente sobre el canal */
const plazaespana = arte((u) => {
  const L = '#D9875A', Ls = '#B8673F', P = '#F3E2C2', A = '#2E6DB4', Az = '#7FB2E5', Y = '#F2C14E', O = '#5B2A18';
  const torre = (x) => `<g>
    <rect x="${x - 15}" y="96" width="30" height="110" fill="${L}"/><rect x="${x - 15}" y="96" width="6" height="110" fill="${Ls}" opacity=".6"/>
    <rect x="${x - 18}" y="92" width="36" height="6" fill="${P}"/><rect x="${x - 18}" y="150" width="36" height="4" fill="${P}"/>
    <rect x="${x - 6}" y="104" width="12" height="18" rx="6" fill="${O}"/><rect x="${x - 6}" y="160" width="12" height="18" rx="6" fill="${O}"/>
    <rect x="${x - 10}" y="128" width="20" height="14" fill="${A}"/><circle cx="${x}" cy="135" r="4" fill="${Y}"/>
    <rect x="${x - 11}" y="66" width="22" height="27" fill="${L}"/><rect x="${x - 13}" y="62" width="26" height="5" fill="${P}"/>
    <path d="M${x - 7} 90 v-14 a3.5 3.5 0 0 1 7 0 v14z M${x} 90 v-14 a3.5 3.5 0 0 1 7 0 v14z" fill="${O}"/>
    <rect x="${x - 8}" y="46" width="16" height="17" fill="${L}"/><rect x="${x - 4}" y="50" width="8" height="10" rx="4" fill="${O}"/>
    <path d="M${x - 10} 47 Q${x} 22 ${x + 10} 47z" fill="${A}"/><path d="M${x - 5} 44 Q${x} 30 ${x + 5} 44" fill="none" stroke="${Az}" stroke-width="2"/>
    <circle cx="${x - 4}" cy="40" r="1.3" fill="${Y}"/><circle cx="${x + 3}" cy="36" r="1.3" fill="${Y}"/><circle cx="${x + 5}" cy="43" r="1.3" fill="${Y}"/>
    <path d="M${x} 27 V14 M${x - 3} 18 H${x + 3}" stroke="${O}" stroke-width="1.6"/><circle cx="${x}" cy="27" r="2.2" fill="${Y}"/></g>`;
  const arcos = (x0, n, paso, y, w, h, c) => Array.from({ length: n }, (_, k) => `<path d="M${x0 + k * paso} ${y + h} v${-h + w / 2} a${w / 2} ${w / 2} 0 0 1 ${w} 0 v${h - w / 2}z" fill="${c}"/>`).join('');
  return `<defs>${lg(u('c'), 0, 1, [[0, '#1f5a9e'], [0.6, '#5d9fd8'], [1, '#bfe0f5']])}${lg(u('w'), 0, 1, [[0, '#3b84c4'], [1, '#1d5b93']])}${velo(u, '#0b2747', 0.55)}</defs>
    <rect width="400" height="250" fill="url(#${u('c')})"/>
    <g fill="#fff" opacity=".45"><ellipse cx="300" cy="30" rx="26" ry="6"/><ellipse cx="322" cy="25" rx="16" ry="6"/></g>
    <!-- alas con su galería de arcos -->
    <rect x="186" y="150" width="214" height="56" fill="${L}"/><rect x="186" y="146" width="214" height="5" fill="${P}"/>
    ${arcos(190, 14, 15.5, 168, 10, 36, P)}${arcos(192, 14, 15.5, 172, 6, 32, O)}
    <rect x="186" y="160" width="214" height="3" fill="${A}"/>
    ${torre(204)}${torre(376)}
    <!-- cuerpo central -->
    <rect x="252" y="96" width="76" height="110" fill="${L}"/><rect x="252" y="96" width="76" height="5" fill="${P}"/>
    <path d="M262 96 L290 74 L318 96z" fill="${P}"/><path d="M270 94 L290 79 L310 94z" fill="${A}"/><circle cx="290" cy="89" r="3" fill="${Y}"/>
    <path d="M290 74 V62" stroke="${O}" stroke-width="1.6"/><circle cx="262" cy="94" r="2.5" fill="${A}"/><circle cx="318" cy="94" r="2.5" fill="${A}"/>
    <rect x="256" y="104" width="7" height="102" fill="${P}"/><rect x="317" y="104" width="7" height="102" fill="${P}"/>
    <rect x="258" y="114" width="3" height="80" fill="${A}"/><rect x="319" y="114" width="3" height="80" fill="${A}"/>
    ${[276, 304].map((x) => `<path d="M${x - 7} 113 h14 v8 c0 6 -7 9 -7 9 s-7 -3 -7 -9z" fill="${Y}"/><path d="M${x - 5} 115 h10 v6 c0 4.5 -5 7 -5 7 s-5 -2.5 -5 -7z" fill="#C23B2E"/><path d="M${x} 115 v13" stroke="${Y}" stroke-width="1.2"/>`).join('')}
    <path d="M272 206 V160 a18 18 0 0 1 36 0 V206z" fill="${P}"/><path d="M277 206 V161 a13 13 0 0 1 26 0 V206z" fill="${O}"/>
    <path d="M281 206 V175 h18 V206" fill="#7a3f22"/><path d="M286 206 v-26 M294 206 v-26" stroke="${P}" stroke-width="2"/>
    <!-- canal y puente de azulejo -->
    <rect x="186" y="206" width="214" height="20" fill="url(#${u('w')})"/>
    <path d="M186 206 H400" stroke="${P}" stroke-width="2.5"/>
    <path d="M244 226 Q290 186 336 226z" fill="${P}"/><path d="M262 226 Q290 202 318 226z" fill="#16466f"/>
    <path d="M240 210 Q290 168 340 210" fill="none" stroke="${A}" stroke-width="8"/><path d="M240 210 Q290 168 340 210" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="3 5"/>
    <path d="M238 214 Q290 172 342 214" fill="none" stroke="${P}" stroke-width="2"/>
    <circle cx="240" cy="210" r="4" fill="${P}"/><circle cx="340" cy="210" r="4" fill="${P}"/>
    <!-- suelo -->
    <rect x="244" y="226" width="156" height="24" fill="#E8D3AE"/><rect x="186" y="226" width="58" height="24" fill="#1d5b93"/><g stroke="#cdb48a" stroke-width="1">${Array.from({ length: 5 }, (_, k) => `<path d="M${262 + k * 32} 226 l-8 24"/>`).join('')}<path d="M244 236 H400"/></g>
    ${veloRect(u)}`;
});

/* Las Setas: boceto a tinta azul marino con aguada azul, sobre papel claro (la tarjeta lleva letras oscuras) */
const setas = arte((u) => {
  const T = '#1D3557', W = '#8FB4CF';
  const forma = 'M214 72 C 212 38, 296 18, 332 46 C 352 64, 388 72, 406 94 L 406 150 C 384 146, 362 140, 346 150 C 334 166, 306 170, 294 158 C 288 146, 282 122, 270 114 C 262 109, 252 111, 246 120 C 232 112, 214 102, 214 72 Z';
  const ret = [];
  for (let k = 0; k < 16; k++) { const y = 26 + k * 9; ret.push(`<path d="M200 ${y} Q300 ${y - 18 + k} 410 ${y + 6}"/>`); }
  for (let k = 0; k < 24; k++) { const x = 206 + k * 9; ret.push(`<path d="M${x} 10 Q${x + 10} 90 ${x - 4 + (k - 12) * 1.5} 175"/>`); }
  return `<defs>${lg(u('c'), 1, 1, [[0, '#FBF8F1'], [1, '#EDE6D6']])}${lg(u('v'), 1, 0, [[0, '#FBF8F1', 0.85], [0.5, '#FBF8F1', 0.4], [1, '#FBF8F1', 0]])}
    <clipPath id="${u('k')}"><path d="${forma}"/></clipPath></defs>
    <rect width="400" height="250" fill="url(#${u('c')})"/>
    <path d="M196 226 C 240 214, 300 236, 360 222 S 410 230 410 230 V250 H196z" fill="${W}" opacity=".25"/>
    <path d="M${'250 150 C 300 170, 360 160, 406 140 L406 150 C 384 146, 362 140, 346 150 C 334 166, 306 170, 294 158 C 288 146, 282 122, 270 114z'}" fill="${W}" opacity=".45"/>
    <g clip-path="url(#${u('k')})"><path d="${forma}" fill="${W}" opacity=".18"/>${trazo(T, 0.9, ret.join(''), 0.75)}</g>
    <!-- pilares -->
    <path d="M252 116 C 258 150, 256 180, 248 208 H284 C 278 180, 278 150, 282 128" fill="#FBF8F1"/>
    <path d="M340 152 C 344 170, 342 190, 336 208 H362 C 358 190, 358 168, 362 146" fill="#FBF8F1"/>
    ${trazo(T, 1, `<path d="M260 124 C 264 160, 262 186, 258 208 M268 120 C 270 160, 270 186, 268 208 M276 124 C 276 160, 276 186, 276 208 M348 154 V208 M354 150 V208"/>`, 0.7)}
    ${trazo(T, 1.8, `<path d="${forma}"/><path d="M252 116 C 258 150, 256 180, 248 208 M282 128 C 278 150, 278 180, 284 208 M340 152 C 344 170, 342 190, 336 208 M362 146 C 358 168, 358 190, 362 208"/><path d="M196 208 H406"/><path d="M290 208 v-14 h40 v14 M296 194 l14 -8 l14 8"/>`)}
    <!-- árboles -->
    <g fill="#6F9BBA" stroke="${T}" stroke-width="1.4"><path d="M200 188 c-10 0 -12 -12 -4 -15 c-2 -10 12 -14 16 -7 c6 -6 18 -2 16 7 c8 2 6 15 -4 15z"/><path d="M226 196 c-8 0 -9 -10 -3 -12 c-1 -8 10 -11 13 -5 c5 -5 15 -1 13 6 c6 2 5 11 -3 11z"/></g>
    ${trazo(T, 1.4, `<path d="M212 188 V208 M238 196 V208"/>`)}
    <ellipse cx="226" cy="210" rx="30" ry="3" fill="${W}" opacity=".6"/>
    <rect width="400" height="250" fill="url(#${u('v')})"/>`;
});

/* Farolillo de papel de feria (relleno, con sus lunares y sus aros) */
const FAROL = [['#E11D48', '#fff'], ['#F8F4EA', '#E11D48'], ['#16A34A', '#fff'], ['#FACC15', '#E11D48']];
const farol = (x, y, s, k) => { const [f, p] = FAROL[k % 4];
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s})"><path d="M0 -4 V0" stroke="#2a2420" stroke-width="1.2"/><rect x="-3" y="-1" width="6" height="3" rx="1" fill="#2a2420"/>
    <path d="M0 2c-10 0-12 7-12 12.5S-10 27 0 27s12-7 12-12.5S10 2 0 2z" fill="${f}"/>
    <path d="M-11.6 9.5h23.2M-12 14.5h24M-11.6 19.5h23.2" stroke="#000" stroke-opacity=".12" stroke-width="1"/>
    <circle cx="-5" cy="7" r="1.8" fill="${p}"/><circle cx="4.5" cy="12" r="1.8" fill="${p}"/><circle cx="-3.5" cy="18" r="1.8" fill="${p}"/><circle cx="5.5" cy="22" r="1.6" fill="${p}"/><circle cx="-7.5" cy="13" r="1.4" fill="${p}"/>
    <path d="M-7 4c3-1.5 11-1.5 14 0" stroke="#fff" stroke-opacity=".35" stroke-width="1.2" fill="none"/><rect x="-3.5" y="26.5" width="7" height="3" rx="1" fill="#2a2420"/></g>`; };
// Una cuerda con farolillos colgando (curva suave)
const cuerda = (x0, x1, y0, caida, n, s, k0) => { let o = `<path d="M${x0} ${y0} Q${(x0 + x1) / 2} ${y0 + caida * 2} ${x1} ${y0}" stroke="#1d1712" stroke-opacity=".7" stroke-width="1.1" fill="none"/>`;
  for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, x = x0 + (x1 - x0) * t, y = y0 + 4 * caida * t * (1 - t); o += farol(x, y + 4 * s, s, k0 + i); } return o; };

/* Feria: un cielo de farolillos (como el techo de farolillos del real), a la derecha */
const feriaportada = arte((u) => `${base(u, '#1b2a5a', '#0a1230', pat(u('p'), 24, 24, `<circle cx="6" cy="6" r="2.4" fill="#fff" fill-opacity=".05"/><circle cx="18" cy="18" r="2.4" fill="#fff" fill-opacity=".05"/>`) + velo(u, '#050a1f', 0.55))}
  ${halo(u, 310, 120, 170, '#ffcf80', 0.3)}
  ${cuerda(212, 412, 30, 10, 6, 0.95, 0)}
  ${cuerda(222, 418, 96, 12, 5, 1.1, 2)}
  ${cuerda(232, 424, 166, 12, 4, 1.3, 1)}
  ${veloRect(u)}`);

/* Feria: la lona a rayas de la caseta con su volante y farolillos, como un panel (igual que el azulejo) */
const feriacaseta = arte((u) => {
  const rayas = Array.from({ length: 15 }, (_, i) => `<rect x="${200 + i * 14}" y="0" width="7" height="250" fill="#15803D"/>`).join('');
  const volante = `<path d="M196 0 H400 V30 ${Array.from({ length: 13 }, (_, i) => `q-8 ${i % 2 ? 9 : 9} -15.7 0`).join(' ')} Z" fill="#0F6B31"/>`
    + `<path d="M196 30 ${Array.from({ length: 13 }, () => 'q7.85 9 15.7 0').join(' ')}" fill="none" stroke="#F8F4EA" stroke-width="2"/>`
    + `<path d="M196 8 H400" stroke="${ORO}" stroke-width="2"/><g fill="${ORO}">${Array.from({ length: 13 }, (_, i) => `<circle cx="${204 + i * 15.7}" cy="19" r="2.2"/>`).join('')}</g>`;
  return `<defs>${lg(u('c'), 1, 1, [[0, '#14603a'], [1, '#06281a']])}${pat(u('p'), 26, 26, `<circle cx="6.5" cy="6.5" r="3" fill="#fff" fill-opacity=".07"/><circle cx="19.5" cy="19.5" r="3" fill="#fff" fill-opacity=".07"/>`)}
    ${lg(u('o'), 1, 0, [[0, '#000', 0.35], [0.25, '#000', 0]])}${velo(u, '#03170e', 0.4)}</defs>
    <rect width="400" height="250" fill="url(#${u('c')})"/><rect width="400" height="250" fill="url(#${u('p')})"/>
    <rect x="196" width="204" height="250" fill="#F8F4EA"/>${rayas}
    <rect x="196" width="204" height="250" fill="url(#${u('o')})"/>
    ${volante}
    ${cuerda(196, 404, 54, 14, 5, 1.15, 0)}
    ${cuerda(196, 404, 132, 14, 5, 1.15, 2)}
    <path d="M196 0 V250" stroke="${ORO}" stroke-width="4"/><path d="M190 0 V250" stroke="#F8F4EA" stroke-width="2"/>
    ${veloRect(u)}`;
});

/* Semana Santa: el paso de palio de frente — bambalina de terciopelo morado bordada en oro, varales de plata,
   candelabros y jarras de plata sobre la canastilla, y el faldón morado */
const damasco = (u) => pat(u('p'), 30, 30, `<g fill="${ORO}" fill-opacity=".08"><path d="M15 5c2.4 3.4 2.4 5.6 0 8-2.4-2.4-2.4-4.6 0-8zM15 25c2.4-3.4 2.4-5.6 0-8-2.4 2.4-2.4 4.6 0 8zM5 15c3.4-2.4 5.6-2.4 8 0-2.4 2.4-4.6 2.4-8 0zM25 15c-3.4-2.4-5.6-2.4-8 0 2.4 2.4 4.6 2.4 8 0z"/><circle cx="15" cy="15" r="1.6"/></g>`);
const voluta = (x, y, s, c) => `<g transform="translate(${x} ${y}) scale(${s})" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round">
  <path d="M0 0 c-6 -8 -16 -4 -14 4 c1 5 8 6 9 1 c1 -3 -3 -4 -4 -2"/><path d="M0 0 c6 -8 16 -4 14 4 c-1 5 -8 6 -9 1 c-1 -3 3 -4 4 -2"/>
  <path d="M0 0 v-10 M-3 -7 c1 -3 5 -3 6 0"/><circle cx="0" cy="-12" r="2.2" fill="${c}"/><path d="M-14 4 c-4 4 -10 3 -12 0 M14 4 c4 4 10 3 12 0"/></g>`;
const semanasantapalio = arte((u) => {
  const PU = '#4A1B6B', OR = '#E3B655', PL = '#D9DDE4', PLs = '#9AA1AD';
  const xs = [204, 254, 302, 350, 398];
  const festones = Array.from({ length: 6 }, (_, k) => `<path d="M${200 + k * 34} 92 q17 18 34 0" fill="${PU}"/>`).join('');
  const flecos = Array.from({ length: 6 }, (_, k) => `<path d="M${200 + k * 34} 92 q17 18 34 0" fill="none" stroke="${OR}" stroke-width="2"/>${[6, 17, 28].map((d) => { const t = d / 34, y = 92 + 4 * 9 * t * (1 - t); return `<path d="M${200 + k * 34 + d} ${y.toFixed(1)} v7" stroke="${OR}" stroke-width="2.2"/><rect x="${200 + k * 34 + d - 2}" y="${(y + 6).toFixed(1)}" width="4" height="5" rx="1" fill="${OR}"/>`; }).join('')}`).join('');
  const candelabro = (x) => `<g><path d="M${x} 188 v-34" stroke="${PL}" stroke-width="3"/><path d="M${x - 14} 160 q14 10 28 0" fill="none" stroke="${PL}" stroke-width="2.4"/>
    <path d="M${x - 5} 188 h10 l-2 -5 h-6z" fill="${PL}"/><circle cx="${x}" cy="170" r="2.6" fill="${PL}"/>
    ${[-14, 0, 14].map((d) => `<circle cx="${x + d}" cy="${d ? 146 : 136}" r="9" fill="url(#${u('l')})"/><path d="M${x + d - 4} ${d ? 158 : 150} q0 -10 4 -12 q4 2 4 12z" fill="#fff" opacity=".55"/><path d="M${x + d} ${d ? 146 : 136}c2 2.4 1.8 4 0 5-1.8-1-2-2.6 0-5z" fill="#FFD36B"/>`).join('')}</g>`;
  const jarra = (x) => `<g><path d="M${x - 9} 188 h18 l-3 -4 c5 -4 6 -12 2 -16 h-16 c-4 4 -3 12 2 16z" fill="${PL}"/><path d="M${x - 10} 168 h20" stroke="${PLs}" stroke-width="2"/>
    ${[-8, -3, 3, 8, 0].map((d, k) => `<circle cx="${x + d}" cy="${160 - (k === 4 ? 8 : Math.abs(d) < 5 ? 4 : 0)}" r="4.2" fill="#fff"/><circle cx="${x + d}" cy="${160 - (k === 4 ? 8 : Math.abs(d) < 5 ? 4 : 0)}" r="1.4" fill="#f3d36b"/>`).join('')}</g>`;
  return `<defs>${lg(u('c'), 0, 1, [[0, '#14061f'], [1, '#2a0d3b']])}${damasco(u)}${rg(u('l'), 0.5, 0.5, 0.5, [[0, '#ffd36b', 0.6], [1, '#ffd36b', 0]])}
    ${lg(u('t'), 0, 1, [[0, '#5a2280'], [1, '#3d1258']])}${velo(u, '#0a0312', 0.55)}</defs>
    <rect width="400" height="250" fill="url(#${u('c')})"/><rect width="400" height="250" fill="url(#${u('p')})"/>
    ${halo(u, 320, 160, 130, '#ffc768', 0.18)}
    <g transform="translate(88 55) scale(.78)">
    <!-- varales de plata -->
    ${xs.map((x) => `<rect x="${x - 1.6}" y="40" width="3.2" height="150" fill="${PL}"/>${[118, 150].map((y) => `<ellipse cx="${x}" cy="${y}" rx="3.2" ry="4" fill="${PL}"/>`).join('')}<path d="M${x} 40 v-8" stroke="${PL}" stroke-width="2"/><circle cx="${x}" cy="30" r="2.6" fill="${PL}"/>`).join('')}
    <!-- crestería dorada -->
    ${voluta(246, 44, 0.8, OR)}${voluta(300, 42, 1.1, OR)}${voluta(354, 44, 0.8, OR)}
    <!-- bambalina -->
    <rect x="198" y="46" width="204" height="46" fill="url(#${u('t')})"/>${festones}
    <path d="M198 47 H402" stroke="${OR}" stroke-width="3"/><path d="M198 52 H402" stroke="${OR}" stroke-width="1" stroke-dasharray="2 3"/>
    ${[218, 252, 286, 320, 354, 388].map((x, k) => voluta(x, k % 2 ? 80 : 76, 0.62, OR)).join('')}
    <g fill="${OR}">${[235, 269, 303, 337, 371].map((x) => `<circle cx="${x}" cy="66" r="2.6"/><circle cx="${x}" cy="66" r="5.5" fill="none" stroke="${OR}" stroke-width="1.2"/>`).join('')}</g>
    ${flecos}
    ${xs.map((x) => `<path d="M${x} 92 v10" stroke="${OR}" stroke-width="2"/><path d="M${x - 3} 102 h6 l1 9 h-8z" fill="${OR}"/>`).join('')}
    <!-- jarras y candelabros -->
    ${jarra(228)}${candelabro(278)}${jarra(326)}${candelabro(372)}
    <!-- canastilla de plata calada -->
    <rect x="198" y="188" width="204" height="22" fill="${PL}"/><rect x="198" y="188" width="204" height="3" fill="#f1f3f6"/>
    <g fill="#3a3f4a">${Array.from({ length: 16 }, (_, k) => `<ellipse cx="${206 + k * 12.6}" cy="${199.5}" rx="3.6" ry="5"/>`).join('')}</g>
    <g fill="${PL}">${Array.from({ length: 16 }, (_, k) => `<circle cx="${206 + k * 12.6}" cy="199.5" r="1.5"/>`).join('')}</g>
    <path d="M198 210 ${Array.from({ length: 12 }, () => 'q8.5 6 17 0').join(' ')}" fill="${PL}"/>
    <!-- faldón -->
    <rect x="200" y="212" width="200" height="38" fill="${PU}"/>
    <rect x="204" y="212" width="12" height="38" fill="none" stroke="${OR}" stroke-width="1.6"/><rect x="384" y="212" width="12" height="38" fill="none" stroke="${OR}" stroke-width="1.6"/>
    <g fill="${OR}"><path d="M210 222 l3 4 l-3 4 l-3 -4z M210 236 l3 4 l-3 4 l-3 -4z M390 222 l3 4 l-3 4 l-3 -4z M390 236 l3 4 l-3 4 l-3 -4z"/></g>
    ${[240, 300, 360].map((x) => `<path d="M${x} 212 v6" stroke="${OR}" stroke-width="1.6"/><rect x="${x - 2.5}" y="217" width="5" height="6" rx="1" fill="${OR}"/>`).join('')}
    </g>
    ${veloRect(u)}`;
});

/* Semana Santa: una cofradía de nazarenos de túnica morada con sus cirios, por una calle estrecha de noche */
const semanasantanazarenos = arte((u) => {
  const naz = (x, y, s, o) => `<g transform="translate(${x} ${y}) scale(${s})" opacity="${o}">
    <path d="M0 -122 L-15 -66 H15 Z" fill="#5B2585"/><path d="M0 -122 L-15 -66 H-4 Z" fill="#4A1B6B"/>
    <path d="M-17 -66 H17 L13 -34 H-13 Z" fill="#5B2585"/><path d="M-13 -34 H13 L24 0 H-24 Z" fill="#4A1B6B"/><path d="M-13 -34 H0 L-6 0 H-24 Z" fill="#3B1258"/>
    <ellipse cx="-5" cy="-80" rx="2.4" ry="1.7" fill="#0b0412"/><ellipse cx="5" cy="-80" rx="2.4" ry="1.7" fill="#0b0412"/>
    <path d="M-5 -58 H5 M0 -63 V-46" stroke="#E3B655" stroke-width="2.2"/><circle cx="0" cy="-58" r="6.5" fill="none" stroke="#E3B655" stroke-width="1.4"/>
    <path d="M-14 -34 Q0 -30 14 -34" stroke="#E3B655" stroke-width="2.4" fill="none"/><path d="M10 -33 v16" stroke="#E3B655" stroke-width="1.8"/><circle cx="10" cy="-15" r="2" fill="#E3B655"/>
    <path d="M18 -40 h-6 v-8 h6z" fill="#e8d2b0"/>
    <rect x="18" y="-92" width="4" height="86" rx="1.5" fill="#FFF4D8"/><circle cx="20" cy="-98" r="13" fill="url(#${u('l')})"/><path d="M20 -105c3.2 3.8 2.8 6.6 0 8.2-2.8-1.6-3.2-4.4 0-8.2z" fill="#FFD36B"/></g>`;
  return `<defs>${lg(u('c'), 0, 1, [[0, '#0c0716'], [1, '#22142e']])}${rg(u('l'), 0.5, 0.5, 0.5, [[0, '#ffd36b', 0.7], [1, '#ffd36b', 0]])}
    ${lg(u('s'), 0, 1, [[0, '#3a2b26'], [1, '#1c1412']])}${velo(u, '#06030b', 0.55)}</defs>
    <rect width="400" height="250" fill="url(#${u('c')})"/>
    <!-- fachadas encaladas a los lados, con cierros de hierro -->
    <path d="M188 0 H236 L262 160 H188z" fill="#e9e1d4" opacity=".16"/><path d="M400 0 H362 L338 160 H400z" fill="#e9e1d4" opacity=".16"/>
    <g fill="none" stroke="#c9b8a0" stroke-opacity=".35" stroke-width="1.4"><rect x="196" y="40" width="22" height="34"/><path d="M196 56 h22 M203 40 v34 M211 40 v34"/><rect x="372" y="30" width="20" height="34"/><path d="M372 46 h20 M378 30 v34 M386 30 v34"/></g>
    <path d="M226 92 h12 v4 h-12z" fill="#2a2030"/><path d="M228 96 l-4 12 h18 l-4 -12z" fill="#ffcf7a" opacity=".9"/><circle cx="232" cy="106" r="26" fill="url(#${u('l')})"/>
    <!-- suelo empedrado -->
    <path d="M188 250 L262 160 H338 L400 250z" fill="url(#${u('s')})"/>
    <g stroke="#5a4740" stroke-opacity=".5" stroke-width="1">${[175, 190, 208, 230].map((y) => `<path d="M${262 - (y - 160) * 0.8} ${y} H${338 + (y - 160) * 0.7}"/>`).join('')}</g>
    ${naz(334, 168, 0.42, 0.55)}${naz(312, 176, 0.52, 0.7)}${naz(354, 190, 0.66, 0.82)}${naz(278, 202, 0.78, 0.9)}${naz(338, 238, 1, 1)}${naz(268, 248, 1.12, 1)}
    ${veloRect(u)}`;
});

const DISENOS = {};
const def = (k, nombre, fondo, fn, claro = false) => { DISENOS[k] = { nombre, fondo, claro, get svg() { return fn(); } }; };
def('giralda', 'La Giralda', '#5a1426', giralda);
def('torreoro', 'Torre del Oro', '#0c2748', torreoro);
def('triana', 'Puente de Triana', '#0d3d4a', triana);
def('azulejo', 'Azulejo', '#123f8c', azulejo);
def('plazaespana', 'Plaza de España', '#3b7fc4', plazaespana);
def('setas', 'Las Setas', '#F4EFE4', setas, true);
def('feriaportada', 'Farolillos', '#13204a', feriaportada);
def('feriacaseta', 'Caseta de Feria', '#14603a', feriacaseta);
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
