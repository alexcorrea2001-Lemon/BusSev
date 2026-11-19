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

/* Estilo cartel (como los carteles de viaje de Sevilla): cielo azul, nubes crema, monumento en crema con
   detalles amarillos, y siluetas moradas de palmeras y naranjos delante. */
const CP = { cielo: '#5A8DB5', nube: '#F6EBD3', crema: '#F8EFDD', sombra: '#E8D9BC', ama: '#F2B21B', rojo: '#D7262B', mor: '#3E2551', azul: '#2F5F8E', agua: '#4C84B1', celeste: '#A8C8E2' };
const cielo = (u) => `<defs>${lg(u('c'), 0, 1, [[0, '#4F82AC'], [1, '#6B9CC4']])}${lg(u('v'), 1, 0, [[0, '#2a1838', 0.5], [0.5, '#2a1838', 0.18], [1, '#2a1838', 0]])}</defs><rect width="400" height="250" fill="url(#${u('c')})"/>`;
const veloCartel = (u) => `<rect width="400" height="250" fill="url(#${u('v')})"/>`;
const nube = (x, y, w) => `<path d="M${x} ${y} c${w * 0.18} -7 ${w * 0.3} -9 ${w * 0.45} -4 c${w * 0.12} -6 ${w * 0.32} -5 ${w * 0.4} 1 c${w * 0.08} 0 ${w * 0.13} 1 ${w * 0.15} 3z" fill="${CP.nube}"/>`;
// Palmera en silueta morada (tronco curvo y hojas como plumas)
const palmeraC = (x, y, h, s = 1) => {
  const top = [x + h * 0.06, y - h];
  const hoja = (a, L) => `<path transform="translate(${top[0]} ${top[1]}) rotate(${a})" d="M0 0 C${L * 0.35} ${-L * 0.16} ${L * 0.7} ${-L * 0.12} ${L} ${L * 0.12} C${L * 0.68} ${L * 0.02} ${L * 0.4} ${L * 0.06} 0 ${L * 0.06}Z"/>`;
  return `<g fill="${CP.mor}"><path d="M${x - 2 * s} ${y} Q${x + h * 0.1} ${y - h * 0.5} ${top[0] - 1.5 * s} ${top[1]} h${3 * s} Q${x + h * 0.14} ${y - h * 0.5} ${x + 2 * s} ${y}z"/>
    ${[-170, -140, -110, -75, -45, -15, 20, 160, 195].map((a, i) => hoja(a, h * (i % 2 ? 0.34 : 0.4))).join('')}</g>`;
};
// Naranjo: copa en nubes moradas con naranjas amarillas
const naranjo = (x, y, r, n = 6) => {
  const bolas = [[0, 0, 1], [-0.75, 0.25, 0.75], [0.75, 0.2, 0.8], [-0.35, -0.55, 0.7], [0.4, -0.5, 0.72]];
  let o = `<g fill="${CP.mor}">${bolas.map(([dx, dy, k]) => `<circle cx="${x + dx * r}" cy="${y + dy * r}" r="${r * k}"/>`).join('')}</g>`;
  for (let i = 0; i < n; i++) { const a = i * 2.4, d = r * (0.3 + (i % 3) * 0.25); const cx = x + Math.cos(a) * d, cy = y + Math.sin(a) * d * 0.7;
    o += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(r * 0.13).toFixed(1)}" fill="${CP.ama}"/><circle cx="${(cx + r * 0.2).toFixed(1)}" cy="${(cy + r * 0.04).toFixed(1)}" r="${(r * 0.12).toFixed(1)}" fill="${CP.ama}"/>
      <path d="M${(cx - r * 0.1).toFixed(1)} ${(cy - r * 0.16).toFixed(1)} q${r * 0.1} ${-r * 0.12} ${r * 0.24} ${-r * 0.06}" stroke="${CP.ama}" stroke-width="1.4" fill="none"/>`; }
  return o;
};
const ventanaC = (x, y, w, h, c = CP.ama, sombra = CP.mor) => `<path d="M${x} ${y + h} V${y + w / 2} a${w / 2} ${w / 2} 0 0 1 ${w} 0 V${y + h}z" fill="${c}"/><path d="M${x} ${y + h} V${y + w / 2} a${w / 2} ${w / 2} 0 0 1 ${w * 0.4} ${-w * 0.46} V${y + h}z" fill="${sombra}" opacity=".9"/>`;
const almenasC = (x0, x1, y, h, w, c) => { let o = ''; for (let x = x0; x + w <= x1 + 0.1; x += w + 1.6) o += `<path d="M${x} ${y} v${-h * 0.55} l${w / 2} ${-h * 0.45} l${w / 2} ${h * 0.45} v${h * 0.55}z" fill="${c}"/>`; return o; };

/* La Giralda: cartel con la torre en crema, la sebka en azul y naranjos delante */
const giralda = arte((u) => {
  const C = CP;
  const rombos = (x, y, w, h) => { let o = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${C.celeste}" opacity=".35"/>`; for (let k = -h; k < w + h; k += 6) o += `<path d="M${x + k} ${y} l${h} ${h} M${x + k + h} ${y} l${-h} ${h}" stroke="${C.azul}" stroke-width=".9" opacity=".7"/>`; return `<g clip-path="url(#${u('r')})">${o}</g>`; };
  return `${cielo(u)}<defs><clipPath id="${u('r')}"><rect x="291" y="150" width="15" height="100"/><rect x="322" y="150" width="15" height="100"/></clipPath></defs>
    ${nube(330, 40, 60)}${nube(214, 26, 44)}${nube(350, 92, 40)}
    <!-- cuerpo de la torre -->
    <rect x="286" y="118" width="56" height="140" fill="${C.crema}"/><rect x="286" y="118" width="7" height="140" fill="${C.sombra}"/>
    ${rombos(291, 150, 15, 100)}${rombos(322, 150, 15, 100)}
    <rect x="291" y="150" width="15" height="100" fill="none" stroke="${C.azul}" stroke-width="1.2"/><rect x="322" y="150" width="15" height="100" fill="none" stroke="${C.azul}" stroke-width="1.2"/>
    ${ventanaC(309, 160, 10, 26, C.mor, '#25142f')}${ventanaC(309, 204, 10, 26, C.mor, '#25142f')}
    <rect x="284" y="132" width="60" height="3" fill="${C.ama}"/>
    <g fill="${C.azul}">${Array.from({ length: 7 }, (_, k) => `<path d="M${290 + k * 7.6} 146 v-7 a2.8 2.8 0 0 1 5.6 0 v7z"/>`).join('')}</g>
    <rect x="282" y="114" width="64" height="5" fill="${C.crema}"/><rect x="282" y="112" width="64" height="2.5" fill="${C.ama}"/>
    <!-- campanario -->
    <rect x="292" y="76" width="44" height="37" fill="${C.crema}"/><rect x="292" y="76" width="6" height="37" fill="${C.sombra}"/>
    ${[298, 309.5, 321].map((x) => `<path d="M${x} 110 v-18 a4.5 4.5 0 0 1 9 0 v18z" fill="${C.mor}"/>`).join('')}
    <rect x="288" y="104" width="52" height="6" fill="${C.ama}"/><g fill="${C.crema}">${Array.from({ length: 9 }, (_, k) => `<rect x="${290 + k * 5.9}" y="105" width="2" height="5"/>`).join('')}</g>
    <path d="M286 104 v-10 l3 -6 l3 6 v10z M336 104 v-10 l3 -6 l3 6 v10z" fill="${C.ama}"/>
    <rect x="290" y="72" width="48" height="5" fill="${C.ama}"/>
    <!-- cuerpos de arriba -->
    <rect x="299" y="50" width="30" height="22" fill="${C.crema}"/>${[303, 312, 321].map((x) => `<path d="M${x} 70 v-10 a2.5 2.5 0 0 1 5 0 v10z" fill="${C.mor}"/>`).join('')}
    <path d="M297 52 v-6 l2 -4 l2 4 v6z M327 52 v-6 l2 -4 l2 4 v6z" fill="${C.ama}"/><rect x="296" y="48" width="36" height="3" fill="${C.ama}"/>
    <rect x="304" y="32" width="20" height="16" fill="${C.crema}"/>${[307.5, 315.5].map((x) => `<path d="M${x} 46 v-7 a2.5 2.5 0 0 1 5 0 v7z" fill="${C.mor}"/>`).join('')}
    <rect x="302" y="30" width="24" height="3" fill="${C.ama}"/>
    <path d="M307 30 q7 -14 14 0z" fill="${C.mor}"/><circle cx="314" cy="15" r="3" fill="${C.mor}"/>
    <!-- el Giraldillo -->
    <path d="M314 12 v-5 M314 2 l-2 4 h4z M314 6 l6 -3 v5z" stroke="${C.ama}" stroke-width="1.6" fill="${C.ama}"/>
    ${naranjo(380, 214, 30, 7)}${naranjo(268, 236, 18, 4)}${naranjo(350, 244, 22, 4)}
    ${veloCartel(u)}`;
});

/* La Torre del Oro: cartel con la torre en crema, almenas amarillas, cúpula roja y palmeras */
const torreoro = arte((u) => {
  const C = CP;
  return `${cielo(u)}
    ${nube(222, 30, 54)}${nube(352, 22, 46)}${nube(358, 96, 40)}
    <!-- cuerpo bajo (dodecágono): caras con líneas finas -->
    <rect x="262" y="128" width="94" height="130" fill="${C.crema}"/><rect x="262" y="128" width="9" height="130" fill="${C.sombra}"/>
    <g stroke="${C.sombra}" stroke-width="1.2"><path d="M285 150 V250 M309 150 V250 M333 150 V250"/></g>
    <g fill="${C.celeste}">${[275, 297, 321, 343].flatMap((x) => [190, 214, 238].map((y) => `<rect x="${x}" y="${y}" width="1.6" height="8"/>`)).join('')}</g>
    ${ventanaC(273, 154, 6, 11)}${ventanaC(296, 154, 7, 11)}${ventanaC(319, 154, 7, 11)}${ventanaC(343, 154, 6, 11)}
    ${ventanaC(292, 210, 10, 20)}${ventanaC(320, 210, 10, 20)}
    <rect x="262" y="146" width="94" height="2.5" fill="${C.ama}"/>
    <rect x="258" y="126" width="102" height="6" fill="${C.crema}"/>
    <g fill="none" stroke="${C.sombra}" stroke-width="1">${Array.from({ length: 6 }, (_, k) => `<path d="M${266 + k * 15.5} 144 v-6 a5 5 0 0 1 10 0 v6"/>`).join('')}</g>
    ${almenasC(259, 359, 126, 16, 6.2, C.ama)}
    <!-- cuerpo alto -->
    <rect x="282" y="66" width="54" height="56" fill="${C.crema}"/><rect x="282" y="66" width="6" height="56" fill="${C.sombra}"/>
    <rect x="282" y="74" width="54" height="2" fill="${C.ama}"/><g fill="none" stroke="${C.sombra}" stroke-width="1"><path d="M300 76 V122 M318 76 V122"/></g>
    ${[288, 304, 320].map((x) => `<path d="M${x} 108 v-14 a5 5 0 0 1 10 0 v14z" fill="none" stroke="${C.sombra}" stroke-width="1.2"/><rect x="${x + 2.2}" y="96" width="2" height="11" fill="${C.azul}"/><rect x="${x + 5.8}" y="96" width="2" height="11" fill="${C.azul}"/>`).join('')}
    <rect x="282" y="112" width="54" height="2" fill="${C.ama}"/>
    ${almenasC(281, 337, 66, 11, 4.6, C.ama)}
    <!-- linterna, óculo y cúpula roja -->
    <rect x="298" y="34" width="22" height="24" fill="${C.crema}"/><circle cx="309" cy="46" r="6" fill="${C.crema}" stroke="${C.mor}" stroke-width="1.5"/><circle cx="309" cy="46" r="3.8" fill="${C.mor}"/>
    <rect x="296" y="32" width="26" height="3" fill="${C.mor}"/>
    <path d="M297 32 a12 11 0 0 1 24 0z" fill="${C.rojo}"/><path d="M303 26 a8 7 0 0 1 4 -4" stroke="#fff" stroke-opacity=".35" stroke-width="2" fill="none"/>
    <rect x="306" y="16" width="6" height="6" fill="${C.crema}" stroke="${C.mor}" stroke-width="1"/><path d="M309 16 V4" stroke="${C.mor}" stroke-width="1.4"/><path d="M306.5 16 l2.5 -3 l2.5 3z" fill="${C.mor}"/>
    ${palmeraC(250, 252, 96)}${palmeraC(242, 252, 62)}
    <!-- seto -->
    <g fill="${C.mor}"><circle cx="372" cy="236" r="22"/><circle cx="392" cy="218" r="20"/><circle cx="352" cy="250" r="16"/><path d="M380 200 q4 -8 10 -6 q-4 4 -10 6z M398 196 q2 -8 8 -8 q-2 5 -8 8z"/></g>
    ${veloCartel(u)}`;
});

/* Puente de Triana: cartel con el puente de hierro (arcos amarillos y sus anillos) y la capillita del Carmen */
const triana = arte((u) => {
  const C = CP, D0 = 134;                       // parte de abajo del tablero
  const arcoP = (x0, x1) => {
    const m = (x0 + x1) / 2, w = x1 - x0, top = 141, y0 = 182;
    const yA = (x) => y0 - (y0 - top) * (1 - ((x - m) / (w / 2)) ** 2);
    const curva = (dy) => Array.from({ length: 31 }, (_, k) => { const x = x0 + w * k / 30; return `${x.toFixed(1)} ${(yA(x) + dy).toFixed(1)}`; }).join(' L');
    let o = `<path d="M${curva(12)}" fill="none" stroke="${C.mor}" stroke-width="2.6"/><path d="M${curva(6)}" fill="none" stroke="${C.mor}" stroke-width="2.6"/>`
      + `<path d="M${curva(0)}" fill="none" stroke="${C.ama}" stroke-width="4.5"/>`;
    // anillos en el hueco entre el arco y el tablero (más grandes junto a los pilares)
    for (const t of [0.09, 0.2, 0.31, 0.69, 0.8, 0.91]) {
      const x = x0 + w * t, gap = yA(x) - D0 - 2.5, r = Math.min(gap / 2 - 1.2, 4.6);
      if (r >= 2) o += `<circle cx="${x.toFixed(1)}" cy="${(D0 + 1 + gap / 2).toFixed(1)}" r="${r.toFixed(1)}" fill="none" stroke="${C.ama}" stroke-width="1.8"/>`;
    }
    return o;
  };
  const pilar = (x) => `<rect x="${x - 7}" y="${D0}" width="14" height="62" fill="${C.crema}"/><rect x="${x - 7}" y="${D0}" width="3.5" height="62" fill="${C.sombra}"/>
    <rect x="${x - 9}" y="${D0 + 40}" width="18" height="4" fill="${C.ama}"/><path d="M${x - 10} 196 h20 v-4 a10 6 0 0 0 -20 0z" fill="${C.sombra}"/>`;
  const farola = (x) => `<path d="M${x} 116 V84" stroke="${C.mor}" stroke-width="2"/><path d="M${x - 8} 88 q8 -5 16 0" stroke="${C.mor}" stroke-width="1.6" fill="none"/>
    ${[x - 8, x, x + 8].map((fx, i) => `<path d="M${fx - 2.6} ${i === 1 ? 74 : 84} h5.2 l-1 -6 h-3.2z" fill="${C.mor}"/><rect x="${fx - 1.6}" y="${(i === 1 ? 74 : 84) - 5}" width="3.2" height="4" fill="${C.ama}"/>`).join('')}`;
  return `${cielo(u)}
    ${nube(300, 30, 56)}${nube(230, 56, 38)}${nube(362, 70, 32)}
    ${arcoP(250, 324)}${arcoP(326, 400)}
    <!-- tablero y barandilla -->
    <rect x="236" y="120" width="170" height="${D0 - 120}" fill="${C.crema}"/><rect x="236" y="116" width="170" height="5" fill="${C.ama}"/>
    <path d="M236 104 H406" stroke="${C.mor}" stroke-width="1.6"/>
    <g stroke="${C.mor}" stroke-width=".9" opacity=".9">${Array.from({ length: 42 }, (_, k) => `<path d="M${262 + k * 3.4} 104 v12"/>`).join('')}</g>
    ${farola(300)}${farola(372)}
    ${pilar(250)}${pilar(325)}${pilar(400)}
    <!-- capillita del Carmen, a la entrada del puente -->
    <rect x="236" y="92" width="28" height="42" fill="${C.crema}"/><rect x="236" y="92" width="6" height="42" fill="${C.sombra}"/>
    <rect x="233" y="88" width="34" height="5" fill="${C.ama}"/><rect x="233" y="114" width="34" height="3" fill="${C.ama}"/>
    <path d="M245 134 v-12 a5 5 0 0 1 10 0 v12z" fill="${C.mor}"/><circle cx="250" cy="102" r="4.2" fill="${C.crema}" stroke="${C.ama}" stroke-width="1.6"/>
    <rect x="241" y="74" width="18" height="15" fill="${C.crema}"/><path d="M237.5 76 a12.5 11 0 0 1 25 0z" fill="${C.rojo}"/><path d="M243 70 a8 7 0 0 1 4 -4" stroke="#fff" stroke-opacity=".35" stroke-width="2" fill="none"/>
    <rect x="247" y="58" width="6" height="8" fill="${C.crema}"/><path d="M245.5 59 a4.5 4 0 0 1 9 0z" fill="${C.rojo}"/><path d="M250 55 v-7 M247.6 51 h4.8" stroke="${C.mor}" stroke-width="1.3"/>
    <!-- río -->
    <rect x="236" y="196" width="170" height="54" fill="${C.agua}"/><rect x="236" y="196" width="170" height="3" fill="${C.azul}"/>
    <g fill="${C.celeste}" opacity=".7"><rect x="262" y="210" width="36" height="2.5" rx="1.2"/><rect x="320" y="220" width="52" height="2.5" rx="1.2"/><rect x="276" y="232" width="28" height="2.5" rx="1.2"/><rect x="350" y="240" width="40" height="2.5" rx="1.2"/></g>
    <g fill="${C.crema}" opacity=".35"><rect x="244" y="202" width="12" height="2"/><rect x="319" y="202" width="12" height="2"/></g>
    ${veloCartel(u)}`;
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

/* Plaza de España en estilo cartel: el edificio en semicírculo (las torres de los extremos, más cerca, son más grandes
   y la galería de arcos se hace más pequeña hacia el centro, que queda al fondo), el canal curvo y su puente de azulejo */
const plazaespana = arte((u) => {
  const C = CP, L = '#D9845A', Ls = '#B9673F';
  const cx = 308, R = 90;
  const prof = (x) => ((x - cx) / R) ** 2;            // 0 en el centro (al fondo), 1 en los extremos (delante)
  const base = (x) => 168 + 30 * prof(x), alto = (x) => 30 + 22 * prof(x);
  // ala curva: tejado y suelo como curvas, arcos cada vez más pequeños hacia el centro
  const pts = (f) => Array.from({ length: 41 }, (_, k) => { const x = cx - R + k * (2 * R / 40); return `${x.toFixed(1)} ${f(x).toFixed(1)}`; });
  const ala = `<path d="M${pts((x) => base(x) - alto(x)).join(' L')} L${pts(base).reverse().join(' L')}z" fill="${L}"/>`;
  const cornisa = `<path d="M${pts((x) => base(x) - alto(x)).join(' L')}" stroke="${C.crema}" stroke-width="3" fill="none"/><path d="M${pts((x) => base(x) - alto(x) * 0.48).join(' L')}" stroke="${C.azul}" stroke-width="2" fill="none"/>`;
  let arcos = '';
  for (let x = cx - R + 8; x <= cx + R - 6; ) {
    const k = prof(x), w = 4 + 6 * k, h = alto(x) * 0.42;
    if (Math.abs(x - cx) > 24) arcos += `<path d="M${x.toFixed(1)} ${base(x).toFixed(1)} v${(-h + w / 2).toFixed(1)} a${(w / 2).toFixed(1)} ${(w / 2).toFixed(1)} 0 0 1 ${w.toFixed(1)} 0 v${(h - w / 2).toFixed(1)}z" fill="${C.mor}"/>`
      + `<rect x="${(x + w * 0.2).toFixed(1)}" y="${(base(x) - alto(x) * 0.88).toFixed(1)}" width="${(w * 0.6).toFixed(1)}" height="${(alto(x) * 0.22).toFixed(1)}" fill="${C.crema}"/>`;
    x += w + 2 + 3 * k;
  }
  const torre = (x, s) => `<g transform="translate(${x} ${base(x)}) scale(${s})">
    <rect x="-13" y="-120" width="26" height="120" fill="${L}"/><rect x="-13" y="-120" width="5" height="120" fill="${Ls}"/>
    <rect x="-15" y="-74" width="30" height="4" fill="${C.crema}"/><rect x="-15" y="-122" width="30" height="5" fill="${C.crema}"/>
    ${ventanaC(-4, -110, 8, 14, C.mor, '#25142f')}${ventanaC(-4, -62, 8, 16, C.mor, '#25142f')}
    <rect x="-8" y="-92" width="16" height="12" fill="${C.azul}"/><circle cx="0" cy="-86" r="3.4" fill="${C.ama}"/>
    <rect x="-10" y="-146" width="20" height="25" fill="${L}"/>${ventanaC(-6, -142, 5, 12, C.mor, '#25142f')}${ventanaC(1, -142, 5, 12, C.mor, '#25142f')}
    <rect x="-12" y="-148" width="24" height="3" fill="${C.crema}"/>
    <rect x="-7" y="-164" width="14" height="17" fill="${C.crema}"/><path d="M-4 -150 v-8 a4 4 0 0 1 8 0 v8z" fill="${C.mor}"/>
    <path d="M-9 -164 h18 l-9 -18z" fill="${C.azul}"/><path d="M-5 -166 h10" stroke="${C.ama}" stroke-width="1.5"/><path d="M0 -182 v-8 M-3 -187 h6" stroke="${C.mor}" stroke-width="1.6"/>
    <path d="M-15 -122 v-8 l3 -5 l3 5 v8z M9 -122 v-8 l3 -5 l3 5 v8z" fill="${C.ama}"/></g>`;
  // cuerpo central (al fondo, más pequeño)
  const centro = `<rect x="280" y="112" width="40" height="56" fill="${L}"/><path d="M276 112 L300 94 L324 112z" fill="${C.crema}"/><path d="M283 110 L300 98 L317 110z" fill="${C.azul}"/><circle cx="300" cy="106" r="2.4" fill="${C.ama}"/>
    <path d="M300 94 v-8" stroke="${C.mor}" stroke-width="1.4"/><rect x="278" y="110" width="44" height="3" fill="${C.crema}"/>
    <rect x="282" y="116" width="4" height="52" fill="${C.crema}"/><rect x="314" y="116" width="4" height="52" fill="${C.crema}"/>
    <path d="M289 168 v-26 a11 11 0 0 1 22 0 v26z" fill="${C.crema}"/><path d="M292.5 168 v-25 a7.5 7.5 0 0 1 15 0 v25z" fill="${C.mor}"/>
    <path d="M290 126 h7 v5 c0 4 -3.5 6 -3.5 6 s-3.5 -2 -3.5 -6z M303 126 h7 v5 c0 4 -3.5 6 -3.5 6 s-3.5 -2 -3.5 -6z" fill="${C.ama}"/>`;
  // canal curvo delante del edificio y puente central de azulejo
  const canal = `<path d="M${pts((x) => base(x) + 6).join(' L')} L${pts((x) => base(x) + 18 + 6 * prof(x)).reverse().join(' L')}z" fill="${C.agua}"/>
    <path d="M${pts((x) => base(x) + 6).join(' L')}" stroke="${C.crema}" stroke-width="2.5" fill="none"/>`;
  const puente = `<path d="M276 196 Q300 168 324 196 v6 h-48z" fill="${C.crema}"/><path d="M284 202 Q300 184 316 202z" fill="${C.azul}"/>
    <path d="M272 186 Q300 160 328 186" stroke="${C.azul}" stroke-width="7" fill="none"/><path d="M272 186 Q300 160 328 186" stroke="#fff" stroke-width="2" stroke-dasharray="2.5 3.5" fill="none"/>
    <path d="M272 182 Q300 156 328 182" stroke="${C.ama}" stroke-width="1.6" fill="none"/><circle cx="272" cy="186" r="3.4" fill="${C.ama}"/><circle cx="328" cy="186" r="3.4" fill="${C.ama}"/>`;
  return `${cielo(u)}
    ${nube(236, 26, 50)}${nube(330, 40, 46)}
    ${ala}${arcos}${cornisa}<g transform="translate(${cx - 300} 0)">${centro}</g>
    ${canal}<g transform="translate(${cx - 300} 0)">${puente}</g>
    <path d="M${pts((x) => base(x) + 18 + 6 * prof(x)).join(' L')} L404 250 L${cx - R} 250z" fill="${C.agua}"/>
    <g fill="${C.celeste}" opacity=".6"><rect x="276" y="222" width="34" height="2.5" rx="1.2"/><rect x="330" y="232" width="44" height="2.5" rx="1.2"/><rect x="290" y="242" width="26" height="2.5" rx="1.2"/></g>
    ${torre(cx - R + 2, 0.92)}${torre(cx + R - 4, 0.92)}
    ${veloCartel(u)}`;
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
def('giralda', 'La Giralda', '#5A8DB5', giralda);
def('torreoro', 'Torre del Oro', '#5A8DB5', torreoro);
def('triana', 'Puente de Triana', '#5A8DB5', triana);
def('azulejo', 'Azulejo', '#123f8c', azulejo);
def('plazaespana', 'Plaza de España', '#5A8DB5', plazaespana);
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
