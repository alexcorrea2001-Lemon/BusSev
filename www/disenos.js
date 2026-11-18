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

/* La Giralda al atardecer */
const giralda = arte((u) => `<defs>${lg(u('c'), 0, 1, [[0, '#2b1b4f'], [0.45, '#b4436c'], [0.78, '#f28f3b'], [1, '#ffd17a']])}${rg(u('s'), 0.5, 0.5, 0.5, [[0, '#fff3c4'], [0.4, '#ffd27a', 0.9], [1, '#ffb347', 0]])}
  ${lg(u('t'), 1, 0, [[0, '#3a1d3f'], [0.5, '#4d2448'], [1, '#2a1430']])}${velo(u, '#1a0f2e', 0.45)}</defs>
  <rect width="400" height="250" fill="url(#${u('c')})"/>
  <circle cx="262" cy="176" r="74" fill="url(#${u('s')})"/><circle cx="262" cy="176" r="30" fill="#ffe7a8"/>
  ${estrellas([[40, 20], [90, 36, 0.8], [150, 14], [210, 30, 0.8], [372, 22], [330, 44, 0.7]])}
  <!-- tejados lejanos -->
  <path d="M0 214 h40 v-10 h26 v6 h30 v-14 h22 v10 h40 v-6 h36 v12 h30 v-8 h40 v10 h36 v-6 h28 v8 h72 V250 H0z" fill="#6e2f57" opacity=".55"/>
  <!-- catedral -->
  <g fill="#3a1d3f">
    <path d="M150 250 V198 l6 -14 l6 14 v-6 h20 v-10 l5 -12 l5 12 v10 h40 v-16 l6 -14 l6 14 v16 h30 V250z"/>
    <path d="M228 168 q20 -26 40 0z"/><rect x="246" y="150" width="4" height="10"/>
  </g>
  <!-- la torre -->
  <g fill="url(#${u('t')})">
    <rect x="296" y="96" width="50" height="160"/>
    <rect x="300" y="64" width="42" height="34"/><rect x="292" y="94" width="58" height="5"/>
    <rect x="306" y="40" width="30" height="26"/><rect x="298" y="62" width="46" height="4"/>
    <rect x="311" y="24" width="20" height="18"/><rect x="304" y="38" width="34" height="4"/>
    <path d="M311 24 q10 -18 20 0z"/><rect x="319.5" y="0" width="3" height="10"/>
  </g>
  <path d="M321 2 l9 5 l-9 3z" fill="#3a1d3f"/>
  <g fill="#ffcf7a" opacity=".8">
    <path d="M305 76 v-6 a3 3 0 0 1 6 0 v6z M318 76 v-6 a3 3 0 0 1 6 0 v6z M331 76 v-6 a3 3 0 0 1 6 0 v6z"/>
    <path d="M313 54 v-5 a2.5 2.5 0 0 1 5 0 v5z M324 54 v-5 a2.5 2.5 0 0 1 5 0 v5z"/>
  </g>
  <g fill="#ffcf7a" opacity=".45"><rect x="309" y="118" width="6" height="12" rx="3"/><rect x="327" y="118" width="6" height="12" rx="3"/><rect x="309" y="156" width="6" height="12" rx="3"/><rect x="327" y="156" width="6" height="12" rx="3"/><rect x="318" y="190" width="6" height="12" rx="3"/></g>
  <path d="M296 96 h50" stroke="#ffb35c" stroke-opacity=".5"/>
  ${palmera(372, 252, 70, '#2a1430')}${palmera(130, 252, 52, '#3a1d3f')}
  ${veloRect(u)}`);

/* La Torre del Oro y el Guadalquivir, de noche */
const torreoro = arte((u) => `<defs>${lg(u('c'), 0, 1, [[0, '#0b1d3a'], [0.6, '#1f3f74'], [1, '#3f6aa3']])}${lg(u('t'), 1, 0, [[0, '#f4c35a'], [0.55, '#e6a93a'], [1, '#b97a1d']])}
  ${lg(u('r'), 0, 1, [[0, '#24467b'], [1, '#0a1a33']])}${rg(u('g'), 0.5, 0.5, 0.5, [[0, '#ffd577', 0.45], [1, '#ffd577', 0]])}${velo(u, '#06122a', 0.5)}</defs>
  <rect width="400" height="250" fill="url(#${u('c')})"/>
  ${estrellas([[30, 18], [70, 40, 0.8], [120, 12], [180, 30, 0.7], [230, 16], [380, 30], [260, 50, 0.7], [160, 60, 0.6]])}
  <circle cx="372" cy="46" r="13" fill="#fdf2c8"/><circle cx="378" cy="41" r="11" fill="#1f3f74"/>
  <!-- orilla de Triana -->
  <path d="M0 196 h30 v-14 h24 v8 h22 v-18 h18 v12 h28 v-6 h30 v14 h40 V206 H0z" fill="#0d2347"/>
  <g fill="#ffd577" opacity=".7"><rect x="36" y="188" width="3" height="4"/><rect x="58" y="194" width="3" height="4"/><rect x="98" y="184" width="3" height="4"/><rect x="132" y="192" width="3" height="4"/></g>
  <ellipse cx="312" cy="150" rx="90" ry="80" fill="url(#${u('g')})"/>
  <!-- la torre: tres cuerpos -->
  <g fill="url(#${u('t')})">
    <path d="M262 210 V126 h100 V210z"/>
    <path d="M258 126 v-12 h9 v6 h9 v-6 h9 v6 h9 v-6 h9 v6 h9 v-6 h9 v6 h9 v-6 h9 v6 h9 v-6 h9 v6 h9 v-6 h4 v12z"/>
    <path d="M284 114 V78 h56 V114z"/>
    <path d="M281 78 v-9 h8 v5 h8 v-5 h8 v5 h8 v-5 h8 v5 h8 v-5 h8 v5 h7 v9z"/>
    <path d="M298 69 V50 h28 V69z"/><path d="M294 50 q18 -30 36 0z"/><rect x="310.5" y="12" width="3" height="10"/>
  </g>
  <path d="M312 126 V210 M312 78 V114" stroke="#a0661a" stroke-opacity=".35" stroke-width="10"/>
  <g fill="#7a4a12" opacity=".75"><path d="M276 162 v-12 a5 5 0 0 1 10 0 v12z M338 162 v-12 a5 5 0 0 1 10 0 v12z M307 100 v-10 a5 5 0 0 1 10 0 v10z M307 188 v-14 a5 5 0 0 1 10 0 v14z"/></g>
  <!-- río con reflejos -->
  <rect y="206" width="400" height="44" fill="url(#${u('r')})"/>
  <g fill="#f4c35a" opacity=".55"><rect x="276" y="212" width="72" height="2.5" rx="1.2"/><rect x="284" y="219" width="56" height="2" rx="1"/><rect x="292" y="226" width="40" height="2" rx="1"/><rect x="300" y="233" width="24" height="1.6" rx=".8"/></g>
  <g fill="#fff" opacity=".18"><rect x="30" y="216" width="40" height="1.5"/><rect x="120" y="224" width="60" height="1.5"/><rect x="190" y="214" width="30" height="1.5"/><rect x="360" y="222" width="30" height="1.5"/></g>
  ${palmera(388, 208, 56, '#081831')}
  ${veloRect(u)}`);

/* Triana: el puente de Isabel II y las casas de la calle Betis */
const triana = arte((u) => `<defs>${lg(u('c'), 0, 1, [[0, '#ff9a62'], [0.5, '#ffc785'], [1, '#ffe2b0']])}${lg(u('r'), 0, 1, [[0, '#3b7fa6'], [1, '#1d4a6b']])}${velo(u, '#4a1f0c', 0.45)}</defs>
  <rect width="400" height="250" fill="url(#${u('c')})"/>
  <circle cx="300" cy="70" r="26" fill="#fff4d6" opacity=".9"/>
  <!-- casas de colores de la calle Betis -->
  <g>
    <rect x="150" y="118" width="34" height="62" fill="#f2c14e"/><rect x="184" y="104" width="30" height="76" fill="#fbf4e4"/><rect x="214" y="124" width="28" height="56" fill="#d9603b"/>
    <rect x="242" y="110" width="36" height="70" fill="#f6e3b4"/><rect x="278" y="120" width="26" height="60" fill="#3f8f8a"/><rect x="304" y="100" width="34" height="80" fill="#f2c14e"/>
    <rect x="338" y="116" width="30" height="64" fill="#c94f4f"/><rect x="368" y="106" width="32" height="74" fill="#fbf4e4"/>
    <g fill="#7a4b2a" opacity=".55">
      ${[156, 166, 190, 200, 219, 229, 248, 262, 283, 310, 322, 344, 354, 374, 386].map((x, i) => `<rect x="${x}" y="${126 + (i % 3) * 3}" width="6" height="10" rx="1"/><rect x="${x}" y="${148 + (i % 2) * 2}" width="6" height="10" rx="1"/>`).join('')}
    </g>
    <path d="M150 118 h34 M184 104 h30 M214 124 h28 M242 110 h36 M278 120 h26 M304 100 h34 M338 116 h30 M368 106 h32" stroke="#8a4a26" stroke-width="3"/>
  </g>
  <!-- el puente: arcos de hierro con sus anillos (solo a la derecha, para no tapar el saldo) -->
  <rect y="182" width="400" height="68" fill="url(#${u('r')})"/>
  <g fill="#2a3b4f"><rect x="150" y="172" width="250" height="8"/>${[150, 232, 314, 396].map((x) => `<rect x="${x - 5}" y="178" width="10" height="40"/>`).join('')}</g>
  <g fill="none" stroke="#2a3b4f" stroke-width="3">
    ${[150, 232, 314].map((x) => `<path d="M${x + 4} 218 Q ${x + 41} 170 ${x + 78} 218"/>${[0.22, 0.36, 0.5, 0.64, 0.78].map((t) => `<circle cx="${x + 4 + 74 * t}" cy="${182 + Math.abs(t - 0.5) * 14}" r="${3 + (1 - Math.abs(t - 0.5) * 2) * 1.4}"/>`).join('')}`).join('')}
  </g>
  <path d="M150 164 h250 M150 172 h250" stroke="#2a3b4f" stroke-width="2"/>
  <g stroke="#2a3b4f" stroke-width="1.6">${Array.from({ length: 25 }, (_, i) => `<path d="M${154 + i * 10} 164 v8"/>`).join('')}</g>
  <g fill="#fff" opacity=".35"><rect x="40" y="222" width="50" height="2" rx="1"/><rect x="150" y="232" width="70" height="2" rx="1"/><rect x="270" y="220" width="40" height="2" rx="1"/><rect x="330" y="236" width="50" height="2" rx="1"/></g>
  ${veloRect(u)}`);

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

/* Feria: la portada iluminada de noche */
const feriaportada = arte((u) => {
  const c = '#ffe9a6';
  const torre = (x, y, w, h) => bombillas([[x, y + h], [x, y], [x + w / 2, y - w * 0.7], [x + w, y], [x + w, y + h]], 5.5, 1.5, c);
  return `<defs>${lg(u('c'), 0, 1, [[0, '#120a2e'], [0.6, '#3b1650'], [1, '#7a2550']])}${lg(u('a'), 0, 1, [[0, '#e7b04a'], [1, '#c7862c']])}
    ${rg(u('g'), 0.5, 0.55, 0.5, [[0, '#ffd27a', 0.55], [1, '#ffd27a', 0]])}${velo(u, '#0b0620', 0.45)}</defs>
    <rect width="400" height="250" fill="url(#${u('c')})"/>
    ${estrellas([[30, 20], [80, 44, 0.8], [140, 16], [200, 36, 0.7], [380, 18], [360, 60, 0.6]])}
    <ellipse cx="290" cy="130" rx="130" ry="110" fill="url(#${u('g')})"/>
    <g fill="#2a1240" opacity=".9">
      <path d="M200 206 V120 l12 -14 l12 14 V206z M356 206 V120 l12 -14 l12 14 V206z"/>
      <path d="M232 206 V96 l12 -16 l12 16 V206z M324 206 V96 l12 -16 l12 16 V206z"/>
      <path d="M262 206 V70 l28 -36 l28 36 V206z"/>
      <path d="M200 140 h180 v8 H200z"/>
    </g>
    <g>
      ${torre(200, 120, 24, 86)}${torre(356, 120, 24, 86)}${torre(232, 96, 24, 110)}${torre(324, 96, 24, 110)}${torre(262, 70, 56, 136)}
      ${bombillas([[200, 140], [380, 140]], 5.5, 1.5, c)}
      ${bombillas([[268, 206], [268, 170], [290, 150], [312, 170], [312, 206]], 5, 1.6, '#fff')}
      ${bombillas([[274, 112], [290, 96], [306, 112], [290, 128], [274, 112]], 4.5, 1.4, '#ffb3c7')}
      <circle cx="290" cy="112" r="5" fill="#ffd27a"/><path d="M290 34 v-12" stroke="${c}" stroke-width="1.4"/><circle cx="290" cy="20" r="2.6" fill="${c}"/>
    </g>
    <path d="M0 206 H400 V250 H0z" fill="url(#${u('a')})"/>
    <path d="M0 206 H400" stroke="#8a5a1c" stroke-width="2" opacity=".6"/>
    <g fill="#8a5a1c" opacity=".25">${Array.from({ length: 30 }, (_, i) => `<circle cx="${(i * 37) % 400}" cy="${214 + (i * 13) % 32}" r="1.2"/>`).join('')}</g>
    ${farolillos(150, 400, 0, 12, 7, 0.9)}
    ${veloRect(u)}`;
});

/* Feria: una caseta con sus volantes y farolillos */
const feriacaseta = arte((u) => {
  const rayas = Array.from({ length: 14 }, (_, i) => `<rect x="${176 + i * 16}" y="62" width="8" height="58" fill="#16a34a"/>`).join('');
  const volantes = Array.from({ length: 14 }, (_, i) => `<path d="M${176 + i * 16} 120 q8 14 16 0z" fill="${i % 2 ? '#16a34a' : '#fff'}"/>`).join('');
  return `<defs>${lg(u('c'), 0, 1, [[0, '#ffb1a6'], [0.6, '#ffd9b8'], [1, '#fff1d6']])}${lg(u('a'), 0, 1, [[0, '#ecbc5a'], [1, '#d39a35']])}${velo(u, '#5a1020', 0.4)}</defs>
    <rect width="400" height="250" fill="url(#${u('c')})"/>
    <!-- techo a dos aguas -->
    <path d="M168 64 L288 22 L408 64z" fill="#fff"/>
    ${Array.from({ length: 8 }, (_, i) => `<path d="M${288 - 120 + i * 30} 64 L288 22 L${288 - 120 + i * 30 + 15} 64z" fill="#16a34a"/>`).join('')}
    <path d="M168 64 L288 22 L408 64" fill="none" stroke="#0f6b31" stroke-width="2.5"/>
    <!-- lona a rayas y volantes -->
    <rect x="176" y="62" width="224" height="58" fill="#fff"/>${rayas}${volantes}
    <!-- fondo de la caseta -->
    <rect x="176" y="126" width="224" height="80" fill="#7a1028"/>
    <path d="M176 126 h224" stroke="#5a0b1d" stroke-width="3"/>
    ${farolillos(182, 398, 132, 6, 6, 0.85)}
    <!-- barandilla verde -->
    <g fill="#0f6b31"><rect x="176" y="184" width="224" height="5"/><rect x="176" y="204" width="224" height="4"/>${Array.from({ length: 15 }, (_, i) => `<rect x="${180 + i * 15}" y="188" width="3" height="16"/>`).join('')}</g>
    <path d="M0 206 H400 V250 H0z" fill="url(#${u('a')})"/>
    <g fill="#9b6a1e" opacity=".25">${Array.from({ length: 26 }, (_, i) => `<circle cx="${(i * 41) % 400}" cy="${214 + (i * 11) % 32}" r="1.2"/>`).join('')}</g>
    <!-- abanico -->
    <g transform="translate(110 226) rotate(-14)"><path d="M0 0 L-34 -30 A45 45 0 0 1 34 -30z" fill="#e11d48"/><g stroke="#8f0d2c" stroke-width="1.2">${[-30, -18, -6, 6, 18, 30].map((a) => `<path d="M0 0 L${44 * Math.sin(a * Math.PI / 180)} ${-44 * Math.cos(a * Math.PI / 180)}"/>`).join('')}</g>
      <circle cx="-14" cy="-28" r="3" fill="#fff"/><circle cx="0" cy="-36" r="3" fill="#fff"/><circle cx="14" cy="-28" r="3" fill="#fff"/><circle r="3" fill="#facc15"/></g>
    ${veloRect(u)}`;
});

/* Semana Santa: paso de palio con su candelería */
const semanasantapalio = arte((u) => {
  const velas = [];
  for (let f = 0; f < 4; f++) for (let i = 0; i < 9 - f; i++) {
    const x = 214 + f * 8 + i * 18, y = 168 - f * 12;
    velas.push(`<rect x="${x - 1.6}" y="${y}" width="3.2" height="${22 + f * 2}" fill="#fff7e0"/><circle cx="${x}" cy="${y - 3}" r="6" fill="url(#${u('l')})"/><path d="M${x} ${y - 8}c2.6 3 2.4 5 0 6.4-2.4-1.4-2.6-3.4 0-6.4z" fill="#ffd36b"/>`);
  }
  const borlas = Array.from({ length: 12 }, (_, i) => `<path d="M${206 + i * 16} 86 q8 14 16 0" fill="none" stroke="#e8c46a" stroke-width="1.4"/><path d="M${214 + i * 16} 94 v6" stroke="#e8c46a" stroke-width="1.6"/><circle cx="${214 + i * 16}" cy="101" r="1.8" fill="#e8c46a"/>`).join('');
  return `<defs>${lg(u('c'), 0, 1, [[0, '#0d0618'], [0.6, '#2a1140'], [1, '#43195e']])}${rg(u('l'), 0.5, 0.5, 0.5, [[0, '#ffd36b', 0.75], [1, '#ffd36b', 0]])}
    ${rg(u('g'), 0.5, 0.6, 0.5, [[0, '#ffbf5a', 0.4], [1, '#ffbf5a', 0]])}${lg(u('o'), 0, 1, [[0, '#f3d98b'], [1, '#b8862e']])}${velo(u, '#07030f', 0.5)}</defs>
    <rect width="400" height="250" fill="url(#${u('c')})"/>
    <ellipse cx="300" cy="150" rx="140" ry="110" fill="url(#${u('g')})"/>
    <!-- techo del palio y bambalinas -->
    <rect x="200" y="62" width="200" height="26" fill="#3d1458"/>
    <path d="M200 62 h200" stroke="url(#${u('o')})" stroke-width="4"/>
    <path d="M200 86 h200" stroke="url(#${u('o')})" stroke-width="2"/>
    <g fill="#e8c46a" opacity=".85">${Array.from({ length: 9 }, (_, i) => `<path d="M${214 + i * 22} 75 l4 -6 l4 6 l-4 6z"/>`).join('')}</g>
    ${borlas}
    <!-- varales -->
    <g fill="url(#${u('o')})"><rect x="206" y="88" width="4" height="124"/><rect x="236" y="88" width="3" height="124"/><rect x="362" y="88" width="3" height="124"/><rect x="390" y="88" width="4" height="124"/></g>
    <!-- candelería -->
    ${velas.join('')}
    <!-- respiraderos del paso -->
    <path d="M196 212 h204 v38 H196z" fill="#2a0d3d"/>
    <path d="M196 212 h204" stroke="url(#${u('o')})" stroke-width="5"/>
    <g fill="none" stroke="#e8c46a" stroke-width="1.4" opacity=".8">${Array.from({ length: 6 }, (_, i) => `<path d="M${206 + i * 32} 236 q14 -16 28 0"/><circle cx="${220 + i * 32}" cy="242" r="2"/>`).join('')}</g>
    ${estrellas([[40, 20, 0.8], [100, 40, 0.7], [160, 18, 0.8], [60, 70, 0.6]], '#f3e6c4')}
    ${veloRect(u)}`;
});

/* Semana Santa: fila de nazarenos con cirios por una calle estrecha */
const semanasantanazarenos = arte((u) => {
  const naz = (x, s, o) => `<g transform="translate(${x} 232) scale(${s})" opacity="${o}">
    <path d="M0 -112 L-13 -64 h26z" fill="#4b1d6b"/><path d="M-15 -66 h30 l6 66 h-42z" fill="#5b2482"/>
    <path d="M-13 -66 h26 l-3 26 h-20z" fill="#3f165b"/><ellipse cx="-4" cy="-76" rx="2" ry="1.4" fill="#0d0618"/><ellipse cx="4" cy="-76" rx="2" ry="1.4" fill="#0d0618"/>
    <path d="M-1.2 -60 h2.4 v4 h4 v2.4 h-4 v9 h-2.4 v-9 h-4 v-2.4 h4z" fill="#e8c46a"/>
    <rect x="13" y="-74" width="3.4" height="64" rx="1" fill="#fff4d8"/><circle cx="14.7" cy="-79" r="9" fill="url(#${u('l')})"/><path d="M14.7 -86c3 3.4 2.6 6 0 7.4-2.6-1.4-3-4 0-7.4z" fill="#ffd36b"/></g>`;
  return `<defs>${lg(u('c'), 0, 1, [[0, '#120822'], [1, '#2d1240']])}${rg(u('l'), 0.5, 0.5, 0.5, [[0, '#ffd36b', 0.7], [1, '#ffd36b', 0]])}${velo(u, '#07030f', 0.5)}</defs>
    <rect width="400" height="250" fill="url(#${u('c')})"/>
    <!-- calle: fachadas con balcones -->
    <path d="M170 0 h40 v250 h-40z M372 0 h28 v250 h-28z" fill="#241034"/>
    <g fill="#3a1a52">${[30, 90, 150].map((y) => `<rect x="178" y="${y}" width="24" height="34" rx="2"/><rect x="366" y="${y + 10}" width="26" height="34" rx="2"/>`).join('')}</g>
    <g stroke="#120822" stroke-width="1.4">${[64, 124, 184].map((y) => `<path d="M174 ${y} h32 M362 ${y + 10} h36"/>`).join('')}</g>
    <g fill="#ffcf7a" opacity=".55"><rect x="184" y="38" width="12" height="18" rx="2"/><rect x="372" y="108" width="14" height="18" rx="2"/></g>
    <!-- farola -->
    <path d="M206 70 h14 v4 h-14z" fill="#120822"/><path d="M214 74 l-6 10 h14 l-6 -10z" fill="#ffcf7a" opacity=".9"/><circle cx="215" cy="84" r="18" fill="url(#${u('l')})"/>
    ${naz(350, 0.8, 0.55)}${naz(318, 0.95, 0.72)}${naz(282, 1.1, 0.88)}${naz(238, 1.3, 1)}
    <path d="M0 232 H400 V250 H0z" fill="#1a0b28"/>
    <g fill="#ffd36b" opacity=".18">${[220, 262, 296, 326, 352].map((x) => `<ellipse cx="${x}" cy="240" rx="10" ry="2"/>`).join('')}</g>
    ${veloRect(u)}`;
});

/* Plaza de España: el edificio en semicírculo, las torres y el canal */
const plazaespana = arte((u) => `<defs>${lg(u('c'), 0, 1, [[0, '#5aa9e6'], [0.7, '#a9d6f5'], [1, '#e3f2fb']])}${lg(u('b'), 0, 1, [[0, '#d07a4f'], [1, '#a9573a']])}
  ${lg(u('w'), 0, 1, [[0, '#2f7fb8'], [1, '#1b5a8a']])}${velo(u, '#0e2c4a', 0.42)}</defs>
  <rect width="400" height="250" fill="url(#${u('c')})"/>
  <g fill="#fff" opacity=".7"><ellipse cx="90" cy="40" rx="30" ry="8"/><ellipse cx="116" cy="34" rx="20" ry="8"/><ellipse cx="250" cy="26" rx="26" ry="6"/></g>
  <!-- torres -->
  ${[178, 360].map((x) => `<g fill="url(#${u('b')})"><rect x="${x}" y="70" width="30" height="110"/><rect x="${x + 4}" y="46" width="22" height="26"/><rect x="${x + 8}" y="30" width="14" height="18"/>
    <path d="M${x + 8} 30 q7 -16 14 0z"/><rect x="${x + 14}" y="6" width="2" height="10"/></g>
    <g fill="#f7ead6"><rect x="${x - 2}" y="68" width="34" height="4"/><rect x="${x + 2}" y="44" width="26" height="3"/><rect x="${x + 6}" y="28" width="18" height="3"/></g>
    <g fill="#5a2a18" opacity=".55"><path d="M${x + 9} 64 v-10 a3 3 0 0 1 6 0 v10z M${x + 16} 64 v-10 a3 3 0 0 1 6 0 v10z"/><rect x="${x + 11}" y="90" width="8" height="12" rx="4"/><rect x="${x + 11}" y="120" width="8" height="12" rx="4"/></g>`).join('')}
  <!-- edificio con galería de arcos -->
  <path d="M208 100 h152 v80 H208z" fill="url(#${u('b')})"/>
  <path d="M206 100 h156" stroke="#f7ead6" stroke-width="4"/>
  <g fill="#f7ead6">${Array.from({ length: 9 }, (_, i) => `<path d="M${214 + i * 16.5} 140 v-14 a6 6 0 0 1 12 0 v14z"/>`).join('')}</g>
  <g fill="#7a3a22" opacity=".5">${Array.from({ length: 9 }, (_, i) => `<path d="M${216 + i * 16.5} 140 v-12 a4 4 0 0 1 8 0 v12z"/>`).join('')}</g>
  <g fill="#f7ead6">${Array.from({ length: 9 }, (_, i) => `<rect x="${216 + i * 16.5}" y="108" width="8" height="10" rx="1"/>`).join('')}</g>
  <path d="M208 146 h152" stroke="#f7ead6" stroke-width="2"/>
  <path d="M208 152 h152 v28 H208z" fill="#b96443"/>
  <g fill="#f7ead6">${Array.from({ length: 10 }, (_, i) => `<path d="M${210 + i * 15.5} 180 v-16 a6 6 0 0 1 12 0 v16z"/>`).join('')}</g>
  <!-- canal y puente de azulejos -->
  <rect y="186" width="400" height="64" fill="url(#${u('w')})"/>
  <path d="M0 186 h400" stroke="#f7ead6" stroke-width="3"/>
  <path d="M232 214 q52 -40 104 0 v8 h-104z" fill="#f7ead6"/>
  <path d="M244 222 q40 -28 80 0" fill="#1b5a8a"/>
  <g fill="#1d4f9c">${Array.from({ length: 12 }, (_, i) => `<rect x="${236 + i * 8.4}" y="${193 - Math.sin((i + 0.5) / 12 * Math.PI) * 13}" width="4" height="4"/>`).join('')}</g>
  <path d="M232 194 q52 -30 104 0" fill="none" stroke="#f7ead6" stroke-width="3"/>
  <g fill="#fff" opacity=".35"><rect x="30" y="206" width="60" height="2" rx="1"/><rect x="110" y="226" width="80" height="2" rx="1"/><rect x="340" y="232" width="50" height="2" rx="1"/></g>
  ${veloRect(u)}`);

/* Las Setas (Metropol Parasol) al anochecer */
const setas = arte((u) => {
  // Retícula de madera recortada con forma de seta
  const ret = [];
  for (let x = 190; x <= 400; x += 11) ret.push(`<path d="M${x} 30 V210"/>`);
  for (let y = 40; y <= 210; y += 11) ret.push(`<path d="M180 ${y} H400"/>`);
  return `<defs>${lg(u('c'), 0, 1, [[0, '#1c2b4a'], [0.55, '#e0607e'], [1, '#ffc58a']])}${velo(u, '#10162b', 0.45)}
    <clipPath id="${u('k')}"><path d="M186 120 C 186 60, 260 46, 300 62 C 330 36, 400 40, 404 92 C 404 124, 380 130, 360 128 C 352 150, 344 160, 344 210 h-26 C 318 170, 314 140, 300 128 C 290 132, 274 134, 262 132 C 252 150, 248 170, 248 210 h-24 C 224 170, 222 146, 214 134 C 196 132, 186 128, 186 120z"/></clipPath></defs>
    <rect width="400" height="250" fill="url(#${u('c')})"/>
    <circle cx="120" cy="190" r="34" fill="#ffd9a0" opacity=".6"/>
    <path d="M0 206 h70 v-20 h20 v12 h36 v-24 h30 v20 h30 V250 H0z" fill="#2b2140" opacity=".75"/>
    <g clip-path="url(#${u('k')})">
      <rect x="180" y="30" width="224" height="190" fill="#f2d7a6"/>
      <g stroke="#b9895a" stroke-width="2.4">${ret.join('')}</g>
      <rect x="180" y="30" width="224" height="190" fill="#ffb27a" opacity=".18"/>
    </g>
    <path d="M186 120 C 186 60, 260 46, 300 62 C 330 36, 400 40, 404 92" fill="none" stroke="#fff3dc" stroke-width="2" opacity=".7"/>
    <g fill="#ffe7b8" opacity=".9">${[200, 222, 244, 266, 288, 310, 332, 354, 376].map((x) => `<circle cx="${x}" cy="${116 + Math.sin(x / 30) * 5}" r="1.6"/>`).join('')}</g>
    <path d="M150 210 H400 V250 H150z" fill="#2b2140"/>
    <path d="M150 210 H400" stroke="#ffd9a0" stroke-opacity=".5"/>
    <g fill="#ffd9a0" opacity=".5">${[176, 206, 270, 300, 372].map((x) => `<rect x="${x}" y="220" width="10" height="6" rx="1"/>`).join('')}</g>
    ${veloRect(u)}`;
});

const DISENOS = {};
const def = (k, nombre, fondo, fn) => { DISENOS[k] = { nombre, fondo, get svg() { return fn(); } }; };
def('giralda', 'La Giralda', '#b4436c', giralda);
def('torreoro', 'Torre del Oro', '#1f3f74', torreoro);
def('triana', 'Puente de Triana', '#ffc785', triana);
def('azulejo', 'Azulejo', '#123f8c', azulejo);
def('plazaespana', 'Plaza de España', '#5aa9e6', plazaespana);
def('setas', 'Las Setas', '#e0607e', setas);
def('feriaportada', 'Portada de Feria', '#3b1650', feriaportada);
def('feriacaseta', 'Caseta de Feria', '#ffd9b8', feriacaseta);
def('semanasantapalio', 'Paso de palio', '#2a1140', semanasantapalio);
def('semanasantanazarenos', 'Nazarenos', '#2d1240', semanasantanazarenos);

/* Marcos de la tarjeta (se dibujan encima, siguiendo las esquinas redondeadas) */
const MARCOS = [
  ['', 'Sin marco'], ['oro', 'Dorado'], ['plata', 'Plateado'], ['bronce', 'Bronce'], ['rosa', 'Oro rosa'],
  ['arcoiris', 'Arcoíris'], ['neon', 'Neón'], ['doble', 'Doble blanco'], ['azulejo', 'Azulejo'],
  ['lunares', 'Lunares'], ['cordon', 'Cordón morado'], ['madera', 'Madera'],
];

window.DISENOS_TARJETA = DISENOS;
window.MARCOS_TARJETA = MARCOS;
})();
