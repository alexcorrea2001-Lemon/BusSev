/* BusSev — diseños de Sevilla para las tarjetas (dibujos propios, en SVG), marcos y pegatinas. */
'use strict';
(() => {

/* Cada diseño: nombre, fondo (degradado) y dibujo. Los dibujos van a la derecha y abajo para no tapar el texto. */
const S = (inner) => `<svg class="tc-arte" viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${inner}</svg>`;
// Luz pequeña (bombillas de la portada, cirios…)
const luz = (x, y, r = 2.2, c = '#ffe9a8') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`;
const farolillos = (y0, n, x0 = 150, x1 = 400) => {
  let s = `<path d="M${x0} ${y0} Q ${(x0 + x1) / 2} ${y0 + 26} ${x1} ${y0}" stroke="rgb(255 255 255 / .55)" stroke-width="1.2" fill="none"/>`;
  const cols = ['#e11d48', '#ffffff', '#16a34a', '#facc15'];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, x = x0 + (x1 - x0) * t, y = y0 + 26 * 4 * t * (1 - t) * 0.5 + 6;
    s += `<g transform="translate(${x} ${y})"><ellipse rx="7" ry="9.5" fill="${cols[i % 4]}"/><path d="M-7 0h14M-5 -6h10M-5 6h10" stroke="rgb(0 0 0 / .18)" stroke-width="1"/>${i % 4 === 1 ? '<circle cx="-2" cy="-3" r="1.4" fill="#e11d48"/><circle cx="3" cy="2" r="1.4" fill="#e11d48"/>' : ''}</g>`;
  }
  return s;
};

const DISENOS = {
  giralda: {
    nombre: 'La Giralda',
    fondo: 'linear-gradient(160deg, #f6a33a 0%, #d9481f 45%, #5b1a3a 100%)',
    svg: S(`<circle cx="250" cy="80" r="34" fill="rgb(255 236 170 / .35)"/>
      <g fill="rgb(45 12 26 / .62)">
        <rect x="298" y="104" width="52" height="150"/>
        <rect x="303" y="70" width="42" height="36"/><rect x="309" y="44" width="30" height="28"/>
        <rect x="314" y="26" width="20" height="20"/><path d="M314 26 Q324 8 334 26z"/>
        <rect x="322.5" y="2" width="3" height="10"/><path d="M324 0l8 6-8 3z"/>
        <rect x="160" y="196" width="140" height="58"/><path d="M160 196 l20 -18 h100 l20 18z"/>
        <path d="M80 254 v-70 M80 184 q-24 6 -36 22 M80 184 q24 2 38 18 M80 184 q-12 -16 -30 -18 M80 184 q14 -18 32 -16" stroke="rgb(45 12 26 / .62)" stroke-width="5" fill="none" stroke-linecap="round"/>
      </g>
      <g fill="rgb(255 225 160 / .55)"><rect x="318" y="120" width="5" height="12" rx="2.5"/><rect x="326" y="120" width="5" height="12" rx="2.5"/><rect x="318" y="150" width="5" height="12" rx="2.5"/><rect x="326" y="150" width="5" height="12" rx="2.5"/><rect x="318" y="80" width="4" height="10" rx="2"/><rect x="326" y="80" width="4" height="10" rx="2"/></g>`),
  },
  torreoro: {
    nombre: 'Torre del Oro',
    fondo: 'linear-gradient(170deg, #38bdf8 0%, #1d4ed8 55%, #172554 100%)',
    svg: S(`<g fill="rgb(250 204 21 / .5)">
        <path d="M262 236 V132 h104 V236z"/>
        <path d="M262 132 v-10 h10 v8 h10 v-8 h10 v8 h10 v-8 h10 v8 h10 v-8 h10 v8 h10 v-8 h10 v8 h10 v-8 h4 v10z"/>
        <path d="M284 122 V86 h60 V122z"/><path d="M284 86 v-8 h8 v6 h8 v-6 h8 v6 h8 v-6 h8 v6 h8 v-6 h8 v8z"/>
        <path d="M300 78 V56 h28 V78z"/><path d="M296 56 Q314 26 332 56z"/><rect x="312.5" y="22" width="3" height="10"/>
      </g>
      <g fill="rgb(15 23 42 / .35)"><rect x="296" y="160" width="8" height="16" rx="4"/><rect x="324" y="160" width="8" height="16" rx="4"/><rect x="310" y="96" width="8" height="14" rx="4"/></g>
      <path d="M0 236 Q 50 228 100 236 T 200 236 T 300 236 T 400 236 V250 H0z" fill="rgb(255 255 255 / .18)"/>
      <path d="M0 244 Q 50 238 100 244 T 200 244 T 300 244 T 400 244" stroke="rgb(255 255 255 / .25)" stroke-width="2" fill="none"/>`),
  },
  triana: {
    nombre: 'Puente de Triana',
    fondo: 'linear-gradient(180deg, #1e1b4b 0%, #4c1d95 55%, #0f172a 100%)',
    svg: S(`${[30, 70, 120, 330, 365].map((x, i) => luz(x, 20 + (i * 17) % 50, 1.3, '#fff')).join('')}
      <g fill="none" stroke="rgb(253 224 71 / .7)" stroke-width="4">
        <path d="M100 168 Q150 108 200 168"/><path d="M200 168 Q250 108 300 168"/><path d="M300 168 Q350 108 400 168"/>
      </g>
      <g fill="none" stroke="rgb(253 224 71 / .55)" stroke-width="2">${[118, 138, 160, 182, 218, 238, 260, 282, 318, 338, 360, 382].map((x) => `<circle cx="${x}" cy="152" r="7"/>`).join('')}</g>
      <rect x="96" y="166" width="304" height="8" fill="rgb(253 224 71 / .7)"/>
      <rect x="96" y="174" width="304" height="4" fill="rgb(0 0 0 / .3)"/>
      <g fill="rgb(253 224 71 / .55)"><rect x="352" y="128" width="20" height="38"/><path d="M350 128 h24 l-12 -14z"/><rect x="360.5" y="104" width="3" height="10"/></g>
      <g fill="rgb(253 224 71 / .18)"><path d="M100 186 Q150 236 200 186 Q250 236 300 186 Q350 236 400 186 V250 H100z"/></g>`),
  },
  azulejo: {
    nombre: 'Azulejo',
    fondo: 'linear-gradient(90deg, #12357a 0%, #12357a 40%, rgb(18 53 122 / .7) 60%, rgb(18 53 122 / .2) 100%), #f4ecd8 url(\'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2760%27 height=%2760%27 viewBox=%270 0 60 60%27%3E%3Crect width=%2760%27 height=%2760%27 fill=%27%23f4ecd8%27/%3E%3Cpath d=%27M30 4 L56 30 L30 56 L4 30z%27 fill=%27none%27 stroke=%27%231e4fa3%27 stroke-width=%274%27/%3E%3Ccircle cx=%2730%27 cy=%2730%27 r=%278%27 fill=%27%23f2b705%27/%3E%3Ccircle cx=%2730%27 cy=%2730%27 r=%273.5%27 fill=%27%231e4fa3%27/%3E%3Cpath d=%27M0 0h10L0 10zM60 0H50l10 10zM0 60h10L0 50zM60 60H50l10-10z%27 fill=%27%231e4fa3%27/%3E%3Cpath d=%27M30 14v-8M30 46v8M14 30h-8M46 30h8%27 stroke=%27%23d9480f%27 stroke-width=%273%27/%3E%3C/svg%3E\') 0 0 / 60px 60px',
    svg: '',
  },
  feriaportada: {
    nombre: 'Feria: portada',
    fondo: 'linear-gradient(180deg, #0b1d3a 0%, #13315c 55%, #0b6e2f 100%)',
    svg: S(`${farolillos(14, 9, 120, 400)}
      <g fill="none" stroke="rgb(255 233 168 / .85)" stroke-width="2.4">
        <path d="M232 238 V128 h12 V238"/><path d="M356 238 V128 h12 V238"/>
        <path d="M244 160 Q300 96 356 160"/><path d="M226 128 l12 -30 l12 30"/><path d="M350 128 l12 -30 l12 30"/>
        <path d="M262 122 h76 v-26 h-76z"/><path d="M276 96 l24 -40 l24 40"/><path d="M300 56 v-14"/>
        <path d="M244 210 h112"/>
      </g>
      <g>${[...Array(12)].map((_, i) => luz(244 + i * 10, 210, 1.8)).join('')}${[...Array(9)].map((_, i) => { const a = Math.PI * (i + 1) / 10; return luz(300 - 56 * Math.cos(a), 160 - 64 * Math.sin(a), 2); }).join('')}
        ${[...Array(10)].map((_, i) => luz(238, 136 + i * 10, 1.7) + luz(362, 136 + i * 10, 1.7)).join('')}${luz(300, 42, 3)}${luz(238, 98, 2.4)}${luz(362, 98, 2.4)}</g>`),
  },
  feriacaseta: {
    nombre: 'Feria: caseta',
    fondo: 'linear-gradient(180deg, #1b4332 0%, #2d6a4f 100%)',
    svg: S(`${farolillos(10, 8, 150, 400)}
      <g transform="translate(206 92)">
        <path d="M0 40 L97 0 L194 40z" fill="#f8fafc"/>
        ${[...Array(9)].map((_, i) => `<path d="M${i * 21.5} 40 L97 0 L${i * 21.5 + 10.75} 40z" fill="#16a34a"/>`).join('')}
        <rect x="0" y="40" width="194" height="118" fill="#f8fafc"/>
        ${[...Array(9)].map((_, i) => `<rect x="${i * 21.5 + 10.75}" y="40" width="10.75" height="118" fill="#16a34a"/>`).join('')}
        <path d="M0 40 ${[...Array(12)].map((_, i) => `q8.1 14 16.2 0`).join(' ')}" fill="#dc2626"/>
        <rect x="58" y="84" width="78" height="74" fill="rgb(20 20 20 / .55)"/>
        ${[...Array(5)].map((_, i) => luz(66 + i * 15, 92, 2.6, '#fde68a')).join('')}
      </g>`),
  },
  semanasantapalio: {
    nombre: 'Semana Santa: palio',
    fondo: 'linear-gradient(180deg, #1c0b2e 0%, #3d1b5b 60%, #120818 100%)',
    svg: S(`<g fill="rgb(243 210 122 / .75)">
        <path d="M210 70 h170 v10 c-6 8 -12 8 -18 0 c-6 8 -12 8 -18 0 c-6 8 -12 8 -18 0 c-6 8 -12 8 -18 0 c-6 8 -12 8 -18 0 c-6 8 -12 8 -18 0 c-6 8 -12 8 -18 0 c-6 8 -12 8 -18 0 c-6 8 -14 8 -26 0z"/>
        ${[214, 254, 294, 334, 372].map((x) => `<rect x="${x}" y="80" width="4" height="108"/>`).join('')}
        <rect x="200" y="188" width="190" height="24" rx="3"/>
        <path d="M200 212 h190 v30 h-190z" fill="rgb(76 29 149 / .9)"/>
        <path d="M200 212 ${[...Array(10)].map(() => 'q9.5 10 19 0').join(' ')}" fill="rgb(243 210 122 / .75)"/>
      </g>
      <g>${[...Array(4)].map((_, row) => [...Array(7 - row)].map((_, i) => { const x = 232 + row * 10 + i * 22, y = 178 - row * 12; return `<rect x="${x - 1.6}" y="${y}" width="3.2" height="${12 + row * 2}" fill="#fff7e0"/>${luz(x, y - 3, 3.2, 'rgb(255 214 120 / .9)')}`; }).join('')).join('')}</g>
      <path d="M282 150 q13 -26 26 0 v30 h-26z" fill="rgb(255 255 255 / .55)"/>
      <circle cx="295" cy="140" r="7" fill="rgb(255 240 210 / .7)"/>`),
  },
  semanasantanazarenos: {
    nombre: 'Semana Santa: nazarenos',
    fondo: 'linear-gradient(180deg, #2b0f45 0%, #4c1d6e 55%, #1a0b24 100%)',
    svg: S(`${[[200, 1], [250, 0.92], [298, 0.84], [342, 0.76], [382, 0.68]].map(([x, k]) => {
        const h = 150 * k, y = 238 - h;
        return `<g transform="translate(${x} ${y}) scale(${k})">
          <path d="M0 0 L-17 72 h34z" fill="rgb(255 255 255 / .9)"/>
          <circle cx="-5" cy="44" r="2.3" fill="#2b0f45"/><circle cx="5" cy="44" r="2.3" fill="#2b0f45"/>
          <path d="M-24 70 h48 l6 80 h-60z" fill="rgb(124 58 237 / .85)"/>
          <path d="M-6 74 h12 v76 h-12z" fill="rgb(255 255 255 / .2)"/>
          <rect x="22" y="40" width="5" height="70" rx="2" fill="#fff7e0"/>
          <path d="M24.5 28 c5 6 4 11 0 13 c-4 -2 -5 -7 0 -13z" fill="rgb(255 200 100 / .95)"/>
          <circle cx="24.5" cy="34" r="12" fill="rgb(255 200 100 / .18)"/></g>`;
      }).join('')}`),
  },
  plazaespana: {
    nombre: 'Plaza de España',
    fondo: 'linear-gradient(170deg, #fdba74 0%, #f472b6 50%, #7c3aed 100%)',
    svg: S(`<g fill="rgb(120 40 30 / .5)">
        <path d="M130 210 Q265 150 400 210 V226 H130z"/>
        <rect x="140" y="128" width="20" height="90"/><path d="M138 128 h24 l-12 -26z"/><rect x="148.5" y="92" width="3" height="10"/>
        <rect x="372" y="128" width="20" height="90"/><path d="M370 128 h24 l-12 -26z"/><rect x="380.5" y="92" width="3" height="10"/>
        <rect x="236" y="150" width="58" height="40"/><path d="M232 150 h66 l-8 -14 h-50z"/><path d="M256 136 q9 -16 18 0z"/>
      </g>
      <g fill="none" stroke="rgb(120 40 30 / .45)" stroke-width="1.6">${[...Array(10)].map((_, i) => { const x = 170 + i * 20; return `<path d="M${x} 214 q5 -9 10 0"/>`; }).join('')}</g>
      <path d="M130 232 Q265 200 400 232 V242 Q265 214 130 242z" fill="rgb(56 189 248 / .45)"/>
      <path d="M248 232 q17 -16 34 0" stroke="rgb(255 255 255 / .7)" stroke-width="3" fill="none"/>
      <g fill="rgb(255 255 255 / .35)">${[...Array(7)].map((_, i) => `<rect x="${250 + i * 5}" y="224" width="2" height="8"/>`).join('')}</g>`),
  },
  setas: {
    nombre: 'Las Setas',
    fondo: 'linear-gradient(170deg, #67e8f9 0%, #0ea5e9 45%, #1e40af 100%)',
    svg: S(`<defs><pattern id="rej" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0H0V10" fill="none" stroke="rgb(255 255 255 / .55)" stroke-width="1"/></pattern></defs>
      <g fill="rgb(255 244 214 / .55)">
        <path d="M150 112 C 180 84, 230 96, 252 110 C 276 86, 330 80, 356 104 C 376 92, 400 96, 410 104 L410 134 C 380 124, 360 138, 340 132 C 310 124, 290 140, 262 134 C 236 128, 210 142, 186 134 C 170 130, 156 132, 150 128 Z"/>
        <path d="M196 132 C 190 170, 214 196, 200 240 H236 C 228 200, 244 168, 236 134 Z"/>
        <path d="M296 136 C 288 176, 312 200, 300 240 H336 C 330 202, 344 170, 334 132 Z"/>
      </g>
      <g fill="url(#rej)">
        <path d="M150 112 C 180 84, 230 96, 252 110 C 276 86, 330 80, 356 104 C 376 92, 400 96, 410 104 L410 134 C 380 124, 360 138, 340 132 C 310 124, 290 140, 262 134 C 236 128, 210 142, 186 134 C 170 130, 156 132, 150 128 Z"/>
        <path d="M196 132 C 190 170, 214 196, 200 240 H236 C 228 200, 244 168, 236 134 Z"/>
        <path d="M296 136 C 288 176, 312 200, 300 240 H336 C 330 202, 344 170, 334 132 Z"/>
      </g>
      <rect x="120" y="238" width="300" height="12" fill="rgb(255 255 255 / .25)"/>`),
  },
};

/* Marcos de la tarjeta */
const MARCOS = [
  ['', 'Sin marco'], ['oro', 'Dorado'], ['plata', 'Plateado'], ['bronce', 'Bronce'], ['rosa', 'Oro rosa'],
  ['arcoiris', 'Arcoíris'], ['neon', 'Neón'], ['doble', 'Doble blanco'], ['azulejo', 'Azulejo'],
  ['lunares', 'Lunares'], ['cordon', 'Cordón morado'], ['madera', 'Madera'],
];

/* Pegatinas (hasta dos por tarjeta) */
const PG = (inner) => `<svg viewBox="0 0 64 64" aria-hidden="true">${inner}</svg>`;
const PEGATINAS = {
  abanico: { nombre: 'Abanico', svg: PG('<path d="M32 56 L6 26 A36 36 0 0 1 58 26 Z" fill="#dc2626"/><path d="M32 56 L6 26 M32 56 L14 16 M32 56 L24 11 M32 56 L32 10 M32 56 L40 11 M32 56 L50 16 M32 56 L58 26" stroke="#7f1d1d" stroke-width="2"/><circle cx="20" cy="24" r="3" fill="#fff"/><circle cx="32" cy="18" r="3" fill="#fff"/><circle cx="44" cy="24" r="3" fill="#fff"/><circle cx="32" cy="56" r="3.5" fill="#facc15"/>') },
  naranja: { nombre: 'Naranja', svg: PG('<circle cx="32" cy="36" r="22" fill="#f97316"/><circle cx="25" cy="30" r="5" fill="#fdba74" opacity=".7"/><path d="M32 14 c8 -10 20 -8 22 -4 c-8 6 -16 8 -22 4z" fill="#16a34a"/><path d="M32 14 v-6" stroke="#7c4a1e" stroke-width="3" stroke-linecap="round"/>') },
  flamenca: { nombre: 'Flamenca', svg: PG('<circle cx="32" cy="12" r="6" fill="#7c2d12"/><circle cx="37" cy="7" r="3.5" fill="#dc2626"/><path d="M28 18 h8 l2 14 h-12z" fill="#dc2626"/><path d="M26 30 C 14 40, 8 50, 6 58 C 20 54, 44 54, 58 58 C 56 50, 50 40, 38 30z" fill="#dc2626"/><path d="M10 52 q22 -6 44 0 M14 44 q18 -6 36 0" stroke="#fff" stroke-width="2.5" fill="none" stroke-dasharray="1 4" stroke-linecap="round"/><path d="M36 22 l14 -10" stroke="#7c2d12" stroke-width="3" stroke-linecap="round"/>') },
  peineta: { nombre: 'Peineta', svg: PG('<path d="M8 44 C 8 20, 56 20, 56 44 Z" fill="#1f2937"/><path d="M14 42 C 16 26, 48 26, 50 42" fill="none" stroke="#9ca3af" stroke-width="2" stroke-dasharray="3 3"/><path d="M14 44 v12 M22 44 v12 M30 44 v12 M38 44 v12 M46 44 v12" stroke="#1f2937" stroke-width="4" stroke-linecap="round"/><circle cx="32" cy="32" r="4" fill="#9ca3af"/>') },
  clavel: { nombre: 'Clavel', svg: PG('<path d="M32 34 v24" stroke="#16a34a" stroke-width="3"/><path d="M32 50 q-10 -4 -12 -12 q10 2 12 12z" fill="#16a34a"/><g fill="#dc2626"><circle cx="32" cy="22" r="10"/><circle cx="22" cy="20" r="7"/><circle cx="42" cy="20" r="7"/><circle cx="27" cy="12" r="7"/><circle cx="37" cy="12" r="7"/></g><path d="M22 20 l4 3 M42 20 l-4 3 M32 22 l0 4" stroke="#991b1b" stroke-width="2"/>') },
  farolillo: { nombre: 'Farolillo', svg: PG('<path d="M32 4 v8" stroke="#374151" stroke-width="2"/><ellipse cx="32" cy="34" rx="18" ry="22" fill="#fff"/><g fill="#dc2626"><circle cx="24" cy="26" r="3.5"/><circle cx="38" cy="22" r="3.5"/><circle cx="30" cy="38" r="3.5"/><circle cx="42" cy="40" r="3.5"/><circle cx="22" cy="44" r="3"/></g><path d="M14 34 h36 M17 22 h30 M17 46 h30" stroke="#d1d5db" stroke-width="1.5"/><rect x="26" y="10" width="12" height="4" rx="1" fill="#374151"/><rect x="26" y="55" width="12" height="4" rx="1" fill="#374151"/>') },
  capirote: { nombre: 'Capirote', svg: PG('<path d="M32 2 L16 44 h32z" fill="#4c1d95"/><circle cx="27" cy="32" r="2.2" fill="#fff"/><circle cx="37" cy="32" r="2.2" fill="#fff"/><path d="M12 42 h40 l4 20 h-48z" fill="#6d28d9"/><path d="M30 44 h4 v18 h-4z" fill="#facc15" opacity=".8"/>') },
  cirio: { nombre: 'Cirio', svg: PG('<rect x="26" y="20" width="12" height="40" rx="3" fill="#fff7e0"/><path d="M28 24 h8" stroke="#e5d6b0" stroke-width="2"/><path d="M32 4 c7 7 6 13 0 15 c-6 -2 -7 -8 0 -15z" fill="#f59e0b"/><path d="M32 9 c3 4 2 7 0 8 c-2 -1 -3 -4 0 -8z" fill="#fde68a"/><circle cx="32" cy="12" r="12" fill="#fbbf24" opacity=".2"/>') },
  giralda: { nombre: 'Giralda', svg: PG('<g fill="#b45309"><rect x="24" y="22" width="16" height="40"/><rect x="26" y="12" width="12" height="10"/><rect x="28" y="6" width="8" height="6"/><rect x="31" y="1" width="2" height="5"/></g><g fill="#fde68a"><rect x="29" y="28" width="2" height="5"/><rect x="33" y="28" width="2" height="5"/><rect x="29" y="40" width="2" height="5"/><rect x="33" y="40" width="2" height="5"/></g>') },
  guitarra: { nombre: 'Guitarra', svg: PG('<g transform="rotate(-35 32 32)"><rect x="29" y="2" width="6" height="30" fill="#78350f"/><rect x="27" y="0" width="10" height="6" rx="1" fill="#451a03"/><path d="M32 30 c-12 0 -14 8 -10 13 c-6 4 -6 16 10 16 c16 0 16 -12 10 -16 c4 -5 2 -13 -10 -13z" fill="#d97706"/><circle cx="32" cy="45" r="4" fill="#451a03"/></g>') },
  sol: { nombre: 'Sol', svg: PG('<g stroke="#f59e0b" stroke-width="4" stroke-linecap="round">' + [...Array(8)].map((_, i) => { const a = i * Math.PI / 4; return `<path d="M${32 + 18 * Math.cos(a)} ${32 + 18 * Math.sin(a)} L${32 + 27 * Math.cos(a)} ${32 + 27 * Math.sin(a)}"/>`; }).join('') + '</g><circle cx="32" cy="32" r="13" fill="#facc15"/><circle cx="27" cy="30" r="1.8" fill="#92400e"/><circle cx="37" cy="30" r="1.8" fill="#92400e"/><path d="M26 36 q6 5 12 0" stroke="#92400e" stroke-width="2" fill="none" stroke-linecap="round"/>') },
  corazon: { nombre: 'Corazón', svg: PG('<path d="M32 56 C 8 40, 4 22, 18 14 C 26 10, 32 18, 32 20 C 32 18, 38 10, 46 14 C 60 22, 56 40, 32 56Z" fill="#e11d48"/><path d="M20 22 q4 -4 8 0" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".6"/>') },
  estrella: { nombre: 'Estrella', svg: PG('<path d="M32 4 L39 23 L59 24 L43 36 L49 56 L32 44 L15 56 L21 36 L5 24 L25 23 Z" fill="#facc15" stroke="#ca8a04" stroke-width="2" stroke-linejoin="round"/>') },
  azahar: { nombre: 'Azahar', svg: PG('<g fill="#fff">' + [...Array(5)].map((_, i) => { const a = i * 2 * Math.PI / 5 - Math.PI / 2; return `<ellipse cx="${32 + 12 * Math.cos(a)}" cy="${32 + 12 * Math.sin(a)}" rx="8" ry="11" transform="rotate(${i * 72} ${32 + 12 * Math.cos(a)} ${32 + 12 * Math.sin(a)})"/>`; }).join('') + '</g><circle cx="32" cy="32" r="6" fill="#facc15"/><g fill="#ca8a04">' + [...Array(6)].map((_, i) => `<circle cx="${32 + 4 * Math.cos(i)}" cy="${32 + 4 * Math.sin(i)}" r="1.2"/>`).join('') + '</g>') },
  bus: { nombre: 'Autobús', svg: PG('<rect x="6" y="14" width="52" height="34" rx="7" fill="#dc2626"/><rect x="11" y="19" width="42" height="13" rx="3" fill="#bfdbfe"/><rect x="10" y="36" width="44" height="3" fill="#fff" opacity=".8"/><circle cx="18" cy="50" r="6" fill="#1f2937"/><circle cx="46" cy="50" r="6" fill="#1f2937"/><circle cx="18" cy="50" r="2.5" fill="#9ca3af"/><circle cx="46" cy="50" r="2.5" fill="#9ca3af"/>') },
};
window.DISENOS_TARJETA = DISENOS;
window.MARCOS_TARJETA = MARCOS;
window.PEGATINAS_TARJETA = PEGATINAS;
})();
