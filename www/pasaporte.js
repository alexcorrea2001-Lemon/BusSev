/* BusSev — Pasaporte de Sevilla: sellos de lugares y medallas por tus viajes en bus.
 *
 * Solo cuentan los viajes VERIFICADOS. Los verifica Android mientras usas «Me subo a este: avísame al bajar»
 * (BajadaService): que llegaba un autobús de esa línea a tu parada cuando saliste (según TUSSAM), que tu GPS
 * fue por el recorrido de la línea a velocidad de autobús, y que la ubicación no era falsa.
 * Todo se guarda en el móvil (localStorage 'pasaporte') y va en la copia de seguridad.
 */
'use strict';
(() => {

/* ---------- Lugares (sellos) ---------- */
// [id, nombre, lat, lon, radio en metros, pictograma, color de la tinta]
const LUGARES = [
  ['giralda', 'La Giralda', 37.38614, -5.99258, 220, 'torre', '#7a1d34'],
  ['torreoro', 'Torre del Oro', 37.38238, -5.99642, 200, 'torreoro', '#a0661a'],
  ['triana', 'Triana', 37.38556, -6.00268, 260, 'puente', '#1f4fa0'],
  ['plazaespana', 'Plaza de España', 37.37718, -5.98689, 260, 'plaza', '#1f4fa0'],
  ['setas', 'Las Setas', 37.39330, -5.99168, 220, 'setas', '#a0661a'],
  ['macarena', 'La Macarena', 37.40216, -5.98897, 240, 'basilica', '#2f7a4a'],
  ['alcazar', 'Real Alcázar', 37.38306, -5.99023, 160, 'palacio', '#7a1d34'],
  ['universidad', 'Fábrica de Tabacos', 37.38040, -5.99150, 160, 'libro', '#4b3b8f'],
  ['alameda', 'Alameda de Hércules', 37.39945, -5.99440, 230, 'columnas', '#2f7a4a'],
  ['santajusta', 'Estación de Santa Justa', 37.39180, -5.97570, 260, 'tren', '#1f4fa0'],
  ['sanbernardo', 'San Bernardo', 37.37780, -5.97990, 230, 'tren', '#4b3b8f'],
  ['prado', 'Prado de San Sebastián', 37.38000, -5.98660, 200, 'bus', '#7a1d34'],
  ['nervion', 'Estadio de Nervión', 37.38400, -5.97060, 260, 'estadio', '#b3262f'],
  ['heliopolis', 'Estadio de Heliópolis', 37.35650, -5.98170, 260, 'estadio', '#2f7a4a'],
  ['cartuja', 'La Cartuja', 37.40710, -6.00480, 400, 'globo', '#a0661a'],
  ['realferia', 'Real de la Feria', 37.37070, -6.00630, 350, 'farolillo', '#b3262f'],
  ['parquemarialuisa', 'Parque de María Luisa', 37.37460, -5.98920, 200, 'arbol', '#2f7a4a'],
  ['aeropuerto', 'Aeropuerto', 37.41800, -5.89310, 500, 'avion', '#1f4fa0'],
  ['plazaarmas', 'Plaza de Armas', 37.39160, -6.00330, 170, 'bus', '#a0661a'],
  ['torresevilla', 'Torre Sevilla', 37.39262, -6.00930, 250, 'rascacielos', '#1f4fa0'],
  ['estadiocartuja', 'Estadio de La Cartuja', 37.41400, -6.00500, 300, 'estadio', '#4b3b8f'],
  ['alamillo', 'Parque del Alamillo', 37.41790, -5.98950, 420, 'arpa', '#2f7a4a'],
  ['barqueta', 'Puente de la Barqueta', 37.40400, -5.99780, 220, 'arco', '#7a1d34'],
  ['remedios', 'Los Remedios', 37.37700, -6.00000, 280, 'naranjo', '#a0661a'],
  ['virgenrocio', 'Virgen del Rocío', 37.36120, -5.97970, 230, 'hospital', '#1f4fa0'],
  ['cerroaguila', 'Cerro del Águila', 37.37300, -5.96300, 300, 'casa', '#b3262f'],
  ['sanpablo', 'San Pablo', 37.39900, -5.96300, 350, 'casa', '#4b3b8f'],
  ['sevillaeste', 'Sevilla Este', 37.40300, -5.92300, 500, 'bloques', '#2f7a4a'],
  ['pinomontano', 'Pino Montano', 37.42600, -5.96400, 400, 'bloques', '#7a1d34'],
  ['bellavista', 'Bellavista', 37.32700, -5.96800, 400, 'casa', '#1f4fa0'],
];

/* ---------- Medallas ---------- */
// [id, nombre, cómo se consigue, pictograma, metal ('bronce'|'plata'|'oro'), regla]
const MEDALLAS = [
  ['primer', 'Primer viaje', 'Tu primer viaje verificado', 'bus', 'bronce', { viajes: 1 }],
  ['v10', 'Habitual', '10 viajes verificados', 'bus', 'bronce', { viajes: 10 }],
  ['v25', 'Asiduo', '25 viajes verificados', 'bus', 'bronce', { viajes: 25 }],
  ['v50', 'Sevillano de bus', '50 viajes verificados', 'bus', 'plata', { viajes: 50 }],
  ['v100', 'Leyenda de TUSSAM', '100 viajes verificados', 'trofeo', 'oro', { viajes: 100 }],
  ['v250', 'Inseparables', '250 viajes verificados', 'corazon', 'oro', { viajes: 250 }],
  ['km42', 'Maratón', '42 km en bus, sumando tus viajes', 'ruta', 'bronce', { km: 42 }],
  ['km100', 'Cien kilómetros', '100 km en bus, sumando tus viajes', 'ruta', 'plata', { km: 100 }],
  ['km530', 'Hasta Madrid', '530 km en bus: lo que hay de Sevilla a Madrid', 'ruta', 'oro', { km: 530 }],
  ['l5', 'Explorador', '5 líneas distintas', 'mapa', 'bronce', { lineas: 5 }],
  ['l10', 'Coleccionista de líneas', '10 líneas distintas', 'mapa', 'plata', { lineas: 10 }],
  ['l20', 'Conoce toda Sevilla', '20 líneas distintas', 'mapa', 'oro', { lineas: 20 }],
  ['l30', 'Enciclopedia TUSSAM', '30 líneas distintas', 'libro', 'oro', { lineas: 30 }],
  ['fiel', 'Fiel a tu línea', '20 viajes en la misma línea', 'corazon', 'plata', { fiel: 20 }],
  ['transbordo', 'Transbordista', 'Cambiar de línea en menos de 45 minutos', 'flechas', 'bronce', { transbordo: 45 }],
  ['idavuelta', 'Ida y vuelta', 'Ir y volver el mismo día entre las mismas paradas', 'idavuelta', 'bronce', { idavuelta: true }],
  ['buho', 'Búho', 'Un viaje de madrugada o en un nocturno', 'luna', 'plata', { buho: true }],
  ['madrugador', 'Madrugador', 'Un viaje antes de las 7 de la mañana', 'sol', 'bronce', { antesDe: 7 }],
  ['circular', 'Vuelta al centro', 'Un viaje en una circular (C1–C6)', 'vuelta', 'bronce', { circular: true }],
  ['medianoche', 'Cenicienta', 'Un viaje que empieza antes de las 12 de la noche y acaba después', 'medianoche', 'plata', { medianoche: true }],
  ['calor', 'Cuarenta grados', 'Un viaje en julio o agosto entre las 3 y las 6 de la tarde', 'termometro', 'bronce', { calor: true }],
  ['largo', 'Viaje largo', 'Un viaje de 12 paradas o más', 'reloj', 'plata', { paradas: 12 }],
  ['puntaapunta', 'De punta a punta', 'Un viaje de 25 paradas o más', 'reloj', 'oro', { paradas: 25 }],
  ['racha5', 'En racha', 'Viajes 5 días seguidos', 'fuego', 'plata', { racha: 5 }],
  ['racha10', 'Imparable', 'Viajes 10 días seguidos', 'fuego', 'oro', { racha: 10 }],
  ['finde', 'De finde', 'Viajes el sábado y el domingo del mismo fin de semana', 'calendario', 'bronce', { finde: true }],
  ['s5', 'Turista', '5 sellos de lugares', 'estrella', 'bronce', { sellos: 5 }],
  ['s12', 'Guía de Sevilla', '12 sellos de lugares', 'estrella', 'plata', { sellos: 12 }],
  ['s20', 'Cartógrafo', '20 sellos de lugares', 'mapa', 'oro', { sellos: 20 }],
  ['stodos', 'Sevilla entera', 'Todos los sellos del pasaporte', 'corona', 'oro', { sellos: LUGARES.length }],
  ['monumental', 'Ruta monumental', 'Sellos de la Giralda, Torre del Oro, Alcázar, Plaza de España y Las Setas', 'corona', 'plata', { grupo: ['giralda', 'torreoro', 'alcazar', 'plazaespana', 'setas'] }],
  ['derbi', 'De los dos', 'Sellos de los dos estadios: Nervión y Heliópolis', 'balon', 'plata', { grupo: ['nervion', 'heliopolis'] }],
  ['semanasanta', 'Cofrade', 'Un viaje en Semana Santa', 'capirote', 'oro', { temporada: 'semanasanta' }],
  ['feria', 'Al real en bus', 'Un viaje en semana de Feria', 'farolillo', 'oro', { temporada: 'feria' }],
  ['navidad', 'Luces de Navidad', 'Un viaje entre el 8 de diciembre y el 6 de enero', 'estrella', 'plata', { temporada: 'navidad' }],
  ['nochevieja', 'Uvas en bus', 'Un viaje el 31 de diciembre', 'uvas', 'oro', { dia: 1231 }],
  ['reyes', 'Noche de Reyes', 'Un viaje el 5 de enero, día de la Cabalgata', 'corona', 'plata', { dia: 105 }],
];

/* ---------- Pictogramas (trazo de 24×24, todos con el mismo estilo) ---------- */
const PICTO = {
  torre: '<path d="M10 22V9h4v13M9 9h6M10.5 9V6h3v3M11 6V4.5h2V6M12 4.5V2.5M8 22h8"/><path d="M11 12h2M11 15h2M11 18h2"/>',
  torreoro: '<path d="M7 22V12h10v10M6 12h12M8 12V9.5h1.2V11M11 12V9.5h2V12M14.8 11V9.5H16V12M9.5 9.5V6h5v3.5M9.5 6Q12 2.5 14.5 6M12 3.4V1.8"/><path d="M11 22v-3a1 1 0 0 1 2 0v3"/>',
  puente: '<path d="M2 10h20M2 13h20M4 13v7M20 13v7M12 13v7"/><path d="M4 19Q8 13.5 12 19M12 19Q16 13.5 20 19"/><circle cx="6.5" cy="15" r=".9"/><circle cx="9.5" cy="15" r=".9"/><circle cx="14.5" cy="15" r=".9"/><circle cx="17.5" cy="15" r=".9"/>',
  plaza: '<path d="M3 20V8h3v12M18 20V8h3v12M6 12h12v8H6M2 8h5M17 8h5M4.5 8V4.5M19.5 8V4.5"/><path d="M8 20v-3a1 1 0 0 1 2 0v3M11 20v-3a1 1 0 0 1 2 0v3M14 20v-3a1 1 0 0 1 2 0v3"/>',
  setas: '<path d="M3 11c0-4 5-6 9-5 3-3 9-2 9 3 0 2-2 3-4 3-1 2-1 4-1 9h-3c0-4-1-7-3-8-1 0-2 1-2 3v5H5c0-4 0-6-2-8z"/><path d="M7 8v3M10 6.5V11M13 6v4.5M16 5.5v6"/>',
  basilica: '<path d="M5 22V12l7-5 7 5v10M3 22h18M12 7V2.5M10.3 4h3.4"/><path d="M10 22v-4a2 2 0 0 1 4 0v4M8 14h1M15 14h1"/>',
  palacio: '<path d="M3 22V10h18v12M3 10V7h2v2h2V7h2v2h2V7h2v2h2V7h2v2h2V7h2v3"/><path d="M10 22v-5a2 2 0 0 1 4 0v5M6 14h2M16 14h2"/>',
  libro: '<path d="M12 6C10 4.5 7 4 4 4.5V19c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V4.5C17 4 14 4.5 12 6zM12 6v14.5"/>',
  columnas: '<path d="M5 21V7M9 21V7M15 21V7M19 21V7M3 7h18M3 21h18M4 4.5h16"/>',
  tren: '<rect x="5" y="3" width="14" height="14" rx="3.5"/><path d="M5 10.5h14M9 21l2-4M15 21l-2-4"/><circle cx="9" cy="13.8" r=".6"/><circle cx="15" cy="13.8" r=".6"/>',
  bus: '<path d="M6.5 3h11A2.5 2.5 0 0 1 20 5.5V17H4V5.5A2.5 2.5 0 0 1 6.5 3z"/><path d="M4 11h16M7.5 21v-4M16.5 21v-4"/><circle cx="8" cy="14" r=".7"/><circle cx="16" cy="14" r=".7"/>',
  estadio: '<ellipse cx="12" cy="9" rx="9" ry="4"/><path d="M3 9v6c0 2.2 4 4 9 4s9-1.8 9-4V9"/><path d="M8 12.6v5.9M16 12.6v5.9M12 13v6"/>',
  globo: '<circle cx="12" cy="10" r="7"/><path d="M5 10h14M12 3c2.5 2.5 2.5 11.5 0 14M12 3c-2.5 2.5-2.5 11.5 0 14M9 21h6M12 17v4"/>',
  farolillo: '<path d="M12 2.5v2M10 4.5h4l-.5 1.5h-3zM12 6c-5 0-6 3.5-6 7s1 7 6 7 6-3.5 6-7-1-7-6-7zM6.4 10h11.2M6.2 15.5h11.6M10.5 20h3v1.5h-3z"/>',
  arbol: '<path d="M12 21.5V15"/><path d="M12 3a4.8 4.8 0 0 0-4.6 6.2A4 4 0 0 0 8.5 16.5h7a4 4 0 0 0 1.1-7.3A4.8 4.8 0 0 0 12 3z"/>',
  avion: '<path d="M12 3c.9 0 1.5.8 1.5 1.8v4.7l7 4v2l-7-2.2v4.2l2 1.5V21L12 20l-3.5 1v-2l2-1.5v-4.2l-7 2.2v-2l7-4V4.8C10.5 3.8 11.1 3 12 3z"/>',
  trofeo: '<path d="M8 3h8v6a4 4 0 0 1-8 0zM8 5H5a3 3 0 0 0 3 4M16 5h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9.5 17h5v4h-5z"/>',
  mapa: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14"/>',
  luna: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/><path d="M16 4.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z"/>',
  sol: '<circle cx="12" cy="13" r="4"/><path d="M12 3v2.5M4.9 6l1.8 1.8M19.1 6l-1.8 1.8M2.5 13H5M19 13h2.5M3 20h18"/>',
  vuelta: '<path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v5h-5"/><circle cx="12" cy="12" r="2"/>',
  reloj: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M10 2.5h4M12 2.5V5"/>',
  fuego: '<path d="M12 21c-4 0-7-2.6-7-6.5 0-3.6 2.6-5.5 4-8.5 1 2 2 3 3 3 0-2 .5-4 2.5-6.5C15 6 19 9 19 14.5 19 18.4 16 21 12 21z"/><path d="M12 21c-1.8 0-3-1.2-3-3 0-2 1.5-3 3-5 1.5 2 3 3 3 5 0 1.8-1.2 3-3 3z"/>',
  calendario: '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4M7.5 14h3M13.5 14h3M7.5 17.5h3"/>',
  estrella: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8L3.5 9.7l5.9-.8z"/>',
  rascacielos: '<path d="M9 22V7.5Q9 3 12 2.5 15 3 15 7.5V22M6.5 22h11M9 9.5h6M9 13h6M9 16.5h6"/>',
  arpa: '<path d="M2 19h20M4.5 21L9.5 3M9 5l4 14M8.2 8L16 19M7.4 11L19 19M6.5 14l15 5"/>',
  arco: '<path d="M2 17h20M3.5 17Q12 2 20.5 17M8 17v-6.2M12 17V9.5M16 17v-6.2"/>',
  naranjo: '<path d="M12 21.5V15.5M9.5 21.5h5"/><circle cx="12" cy="9.5" r="6.2"/><circle cx="9.8" cy="8" r="1"/><circle cx="14.3" cy="9.6" r="1"/><circle cx="11.4" cy="12.4" r="1"/>',
  hospital: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M12 7.5v9M7.5 12h9"/>',
  casa: '<path d="M3 11.5L12 4l9 7.5M5.5 9.5V21h13V9.5"/><path d="M10 21v-5.5h4V21M7.8 12.5h2M14.2 12.5h2"/>',
  bloques: '<path d="M2 21h20M3.5 21V9h5.5v12M9 21V3.5h6.5V21M15.5 21v-9h5v9"/><path d="M5.3 12h2M5.3 15.5h2M11 6.5h2.5M11 10h2.5M11 13.5h2.5M17.3 15h1.5"/>',
  corazon: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>',
  ruta: '<circle cx="5" cy="18.5" r="2"/><circle cx="19" cy="5.5" r="2"/><path d="M7 18.5h7.5a3.25 3.25 0 0 0 0-6.5h-5a3.25 3.25 0 0 1 0-6.5H17"/>',
  flechas: '<path d="M4 8h15l-3.5-3.5M20 16H5l3.5 3.5"/>',
  idavuelta: '<path d="M5 9h12a3 3 0 0 1 0 6H7"/><path d="M8 6L5 9l3 3M10 18l-3-3 3-3"/>',
  medianoche: '<circle cx="12" cy="12.5" r="8.5"/><path d="M12 12.5V6.5M10.6 7.8L12 6.5l1.4 1.3"/><path d="M12 2v1.5"/>',
  termometro: '<path d="M10 14.2V5a2 2 0 0 1 4 0v9.2a4 4 0 1 1-4 0z"/><path d="M12 9v8M17 5.5h2.5M17 8.5h2.5M17 11.5h2.5"/>',
  balon: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8.2l3.2 2.3-1.2 3.8H10l-1.2-3.8zM12 3.5v4.7M15.2 10.5l4.4-1.5M14 14.3l2.6 3.8M10 14.3l-2.6 3.8M8.8 10.5L4.4 9"/>',
  corona: '<path d="M4 17.5L3 7.5l5 4 4-6.5 4 6.5 5-4-1 10z"/><path d="M4 21h16"/><circle cx="12" cy="13.5" r="1"/>',
  uvas: '<circle cx="9" cy="10.5" r="2.1"/><circle cx="13.2" cy="10.5" r="2.1"/><circle cx="11.1" cy="14.2" r="2.1"/><circle cx="15.3" cy="14.2" r="2.1"/><circle cx="13.2" cy="17.9" r="2.1"/><path d="M11 8.4C11 6 12 4 14.5 3"/><path d="M14 5.5c1.6-.8 3.4-.4 4.5.8"/>',
  capirote: '<path d="M12 2L7.5 13h9z"/><path d="M6.5 13h11l2 9h-15z"/><circle cx="10.6" cy="10" r=".6"/><circle cx="13.4" cy="10" r=".6"/><path d="M12 15.5v4M10.3 17h3.4"/>',
};
const pic = (k, color, w = 1.8) => `<g fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${PICTO[k] || PICTO.estrella}</g>`;

let uid = 0;
/* Sello de tinta: doble aro, el nombre alrededor y el pictograma en medio */
function selloSVG(id, { fecha = '', apagado = false, papel = false } = {}) {
  const l = LUGARES.find((x) => x[0] === id);
  if (!l) return '';
  const [, nombre, , , , p, tinta] = l;
  const c = apagado ? '#9aa0aa' : tinta, k = `ps${++uid}`;
  const txt = nombre.toUpperCase();
  return `<svg viewBox="0 0 120 120" class="ps-sello${apagado ? ' apagado' : ''}" aria-hidden="true"><defs><path id="${k}" d="M60 60 m-41 0 a41 41 0 1 1 82 0 a41 41 0 1 1 -82 0"/>
    <filter id="${k}f"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="${id.length}"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.15 1.5"/><feComposite in="SourceGraphic" operator="in"/></filter></defs>
    ${papel ? '<circle cx="60" cy="60" r="59.5" fill="#f6eedc"/>' : ''}<g filter="url(#${k}f)" opacity="${apagado ? 0.45 : 0.95}">
      <circle cx="60" cy="60" r="55" fill="none" stroke="${c}" stroke-width="4.6"/>
      <circle cx="60" cy="60" r="48.5" fill="none" stroke="${c}" stroke-width="2"/>
      <circle cx="60" cy="60" r="31" fill="none" stroke="${c}" stroke-width="1.6" stroke-dasharray="2 3"/>
      <text font-family="Barlow Condensed, Arial Narrow, sans-serif" font-weight="700" font-size="${txt.length > 18 ? 9 : 10.5}" letter-spacing="1.2" fill="${c}"><textPath href="#${k}" startOffset="25%" text-anchor="middle">${txt}</textPath></text>
      <text x="60" y="105" text-anchor="middle" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-weight="700" font-size="8" letter-spacing="1" fill="${c}">${fecha ? fecha.toUpperCase() : 'SEVILLA'}</text>
      <g transform="translate(42 40) scale(1.5)">${pic(p, c, 2.3)}</g>
      <path d="M14 60h6M100 60h6" stroke="${c}" stroke-width="2"/>
    </g></svg>`;
}

/* Medalla: cinta, disco metálico con el pictograma y un brillo */
const METAL = { bronce: ['#e3a46f', '#a86232', '#7a3f18'], plata: ['#f1f3f6', '#aeb6c2', '#6b7584'], oro: ['#ffe08a', '#d9a521', '#8f6510'] };
function medallaSVG(id, { apagado = false } = {}) {
  const m = MEDALLAS.find((x) => x[0] === id);
  if (!m) return '';
  const [, , , p, metal] = m;
  const [c1, c2, c3] = apagado ? ['#d7dae0', '#b3b8c2', '#8a909c'] : METAL[metal];
  const k = `pm${++uid}`;
  const cinta = apagado ? ['#b8bdc6', '#9aa0aa'] : metal === 'oro' ? ['#b3262f', '#7a1d34'] : metal === 'plata' ? ['#1f4fa0', '#163f86'] : ['#2f7a4a', '#1f5a35'];
  return `<svg viewBox="0 0 120 120" class="ps-medalla${apagado ? ' apagado' : ''}" aria-hidden="true"><defs>
      <linearGradient id="${k}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset=".55" stop-color="${c2}"/><stop offset="1" stop-color="${c3}"/></linearGradient></defs>
    <path d="M38 4h18l10 34H48z" fill="${cinta[0]}"/><path d="M82 4H64L54 38h18z" fill="${cinta[1]}"/>
    <circle cx="60" cy="72" r="40" fill="url(#${k})"/>
    <circle cx="60" cy="72" r="33" fill="none" stroke="${c3}" stroke-opacity=".55" stroke-width="2"/>
    <circle cx="60" cy="72" r="29.5" fill="${c2}" fill-opacity=".35"/>
    <g transform="translate(42 54) scale(1.5)">${pic(p, apagado ? '#ffffff' : c3, 2)}</g>
    <path d="M32 54a34 34 0 0 1 22-15" stroke="#fff" stroke-opacity=".55" stroke-width="3" stroke-linecap="round" fill="none"/>
  </svg>`;
}

/* ---------- Estado y reglas ---------- */
const hoyClave = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
function pascua(y) {   // domingo de Resurrección (algoritmo de Butcher)
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, mes - 1, dia);
}
function temporada(t) {
  const d = new Date(t), y = d.getFullYear(), P = pascua(y).getTime(), DIA = 86400000;
  const dd = new Date(y, d.getMonth(), d.getDate()).getTime();
  if (dd >= P - 7 * DIA && dd <= P) return 'semanasanta';
  if (dd >= P + 13 * DIA && dd <= P + 20 * DIA) return 'feria';           // sábado del alumbrado a domingo de fuegos (aprox.)
  const md = (d.getMonth() + 1) * 100 + d.getDate();
  if (md >= 1208 || md <= 106) return 'navidad';
  return '';
}
const distM = (a, b, c, d) => { const R = 6371000, r = Math.PI / 180, x = (d - b) * r * Math.cos(((a + c) / 2) * r), y = (c - a) * r; return Math.hypot(x, y) * R; };
const esCircular = (l) => /^C\d$/i.test(String(l || '').trim());
const esNocturna = (l) => /^A\d/i.test(String(l || '')) || !!(typeof lineaFor === 'function' && lineaFor(l)?.nocturna);

const pasaporte = {
  LUGARES, MEDALLAS, selloSVG, medallaSVG, temporada, pic,
  estado() { const s = store.get('pasaporte', null) || {}; return { viajes: s.viajes || [], logros: s.logros || {}, vistos: s.vistos || {} }; },
  guardar(s) { store.set('pasaporte', s); },
  /* Calcula todo lo conseguido con estos viajes (solo los verificados) */
  calcular(viajes) {
    const v = viajes.filter((x) => x.verificado);
    const out = {};
    const sello = (id, t) => { if (!out[`s:${id}`]) out[`s:${id}`] = t; };
    for (const x of v) for (const l of LUGARES) if (x.lat != null && distM(x.lat, x.lon, l[2], l[3]) <= l[4]) sello(l[0], x.fin);
    const lineas = new Map();
    for (const x of v) if (!lineas.has(x.linea)) lineas.set(x.linea, x.fin);
    const dias = [...new Set(v.map((x) => hoyClave(x.inicio)))].sort();
    const nSellos = Object.keys(out).length;
    for (const [id, , , , , r] of MEDALLAS) {
      let t = null;
      if (r.viajes) t = v.length >= r.viajes ? v[r.viajes - 1].fin : null;
      else if (r.lineas) t = lineas.size >= r.lineas ? [...lineas.values()][r.lineas - 1] : null;
      else if (r.buho) t = v.find((x) => new Date(x.inicio).getHours() < 6 || esNocturna(x.linea))?.fin ?? null;
      else if (r.antesDe) t = v.find((x) => { const h = new Date(x.inicio).getHours(); return h >= 5 && h < r.antesDe; })?.fin ?? null;
      else if (r.circular) t = v.find((x) => esCircular(x.linea))?.fin ?? null;
      else if (r.paradas) t = v.find((x) => (x.paradas || 0) >= r.paradas)?.fin ?? null;
      else if (r.temporada) t = v.find((x) => temporada(x.inicio) === r.temporada)?.fin ?? null;
      else if (r.sellos) t = nSellos >= r.sellos ? Object.values(out).sort((a, b) => a - b)[r.sellos - 1] : null;
      else if (r.km) { let k = 0; for (const x of v) { k += Number(x.km) || 0; if (k >= r.km) { t = x.fin; break; } } }
      else if (r.fiel) { const c = new Map(); for (const x of v) { const n = (c.get(x.linea) || 0) + 1; c.set(x.linea, n); if (n >= r.fiel) { t = x.fin; break; } } }
      else if (r.transbordo) { for (let i = 1; i < v.length; i++) { const a = v[i - 1], b = v[i], hueco = b.inicio - a.fin; if (b.linea !== a.linea && hueco >= 0 && hueco <= r.transbordo * 60000) { t = b.fin; break; } } }
      else if (r.idavuelta) t = v.find((b) => v.some((a) => a.fin <= b.inicio && hoyClave(a.inicio) === hoyClave(b.inicio) && a.desde && a.desde === b.hasta && a.hasta === b.desde))?.fin ?? null;
      else if (r.medianoche) t = v.find((x) => hoyClave(x.inicio) !== hoyClave(x.fin))?.fin ?? null;
      else if (r.calor) t = v.find((x) => { const d = new Date(x.inicio), h = d.getHours(); return (d.getMonth() === 6 || d.getMonth() === 7) && h >= 15 && h < 18; })?.fin ?? null;
      else if (r.dia) t = v.find((x) => { const d = new Date(x.inicio); return (d.getMonth() + 1) * 100 + d.getDate() === r.dia; })?.fin ?? null;
      else if (r.grupo) t = r.grupo.every((g) => out[`s:${g}`]) ? Math.max(...r.grupo.map((g) => out[`s:${g}`])) : null;
      else if (r.racha) {
        let racha = 1;
        for (let i = 1; i < dias.length && t == null; i++) {
          racha = (new Date(dias[i]) - new Date(dias[i - 1])) === 86400000 ? racha + 1 : 1;
          if (racha >= r.racha) t = v.filter((x) => hoyClave(x.inicio) === dias[i]).at(-1)?.fin ?? null;
        }
      } else if (r.finde) {
        for (const x of v) {
          const d = new Date(x.inicio);
          if (d.getDay() !== 0) continue;
          const sab = hoyClave(x.inicio - 86400000);
          if (v.some((y) => hoyClave(y.inicio) === sab)) { t = x.fin; break; }
        }
      }
      if (t != null) out[`m:${id}`] = t;
    }
    return out;
  },
  /* Añade viajes nuevos (de Android) y devuelve los logros nuevos */
  registrar(nuevos) {
    const s = this.estado();
    const ya = new Set(s.viajes.map((x) => x.id));
    for (const x of nuevos) if (x && !ya.has(x.id)) { s.viajes.push(x); ya.add(x.id); }
    s.viajes.sort((a, b) => a.inicio - b.inicio);
    const todo = this.calcular(s.viajes);
    const nuevosLogros = Object.keys(todo).filter((k) => !s.logros[k]);
    for (const k of nuevosLogros) s.logros[k] = todo[k];
    this.guardar(s);
    return nuevosLogros;
  },
  nombre(k) { const [t, id] = k.split(':'); return t === 's' ? LUGARES.find((x) => x[0] === id)?.[1] : MEDALLAS.find((x) => x[0] === id)?.[1]; },
  texto(k) { const [t, id] = k.split(':'); return t === 's' ? 'Sello de lugar' : MEDALLAS.find((x) => x[0] === id)?.[2]; },
  arte(k, op) { const [t, id] = k.split(':'); return t === 's' ? selloSVG(id, op) : medallaSVG(id, op); },
  /* Recoge los viajes que ha verificado Android y avisa de lo conseguido */
  async sincronizar({ silencioso = false } = {}) {
    if (!window.Capacitor?.isPluginAvailable?.('BusSevViaje')) return [];
    let r;
    try { r = await window.Capacitor.nativePromise('BusSevViaje', 'viajesPendientes', {}); } catch { return []; }
    const lista = (r?.viajes || []).map((x) => (typeof x === 'string' ? JSON.parse(x) : x));
    if (!lista.length) return [];
    const nuevos = this.registrar(lista);
    const verif = lista.filter((x) => x.verificado);
    for (const k of nuevos) {
      const [t, id] = k.split(':');
      // Notificación con el dibujo (aunque la app esté en segundo plano)
      try { await window.Capacitor.nativePromise('BusSevViaje', 'notificarLogro', { id: `${t}-${id}`, titulo: t === 's' ? `¡Nuevo sello: ${this.nombre(k)}!` : `¡Medalla conseguida: ${this.nombre(k)}!`, texto: this.texto(k) }); } catch { /* sin permiso */ }
    }
    if (!silencioso && document.visibilityState === 'visible' && nuevos.length) this.celebrar(nuevos);
    else if (!silencioso && verif.length && !nuevos.length && document.visibilityState === 'visible') toast(`Viaje verificado en el ${verif.at(-1).linea} ✅`);
    if (typeof active !== 'undefined') active.rerender?.();
    return nuevos;
  },
  /* Animación de sello «golpeando» la página */
  celebrar(ks) {
    const k = ks[0];
    vibrar([30, 60, 120]);
    openModal(`<div class="ps-celebra">${this.arte(k, { papel: true })}<h2>${k.startsWith('s:') ? '¡Nuevo sello!' : '¡Medalla conseguida!'}</h2><p class="ps-cel-n">${esc(this.nombre(k))}</p><p class="help">${esc(this.texto(k))}</p>${ks.length > 1 ? `<p class="help">Y ${ks.length - 1} más en tu pasaporte.</p>` : ''}</div>
      <div class="actions"><button class="btn ghost" type="button" id="ps-comp">Compartir</button><button class="btn" type="button" id="ps-ver">Ver pasaporte</button></div>`, (m, close) => {
      $('#ps-ver', m).onclick = () => { close(); location.hash = 'pasaporte'; };
      $('#ps-comp', m).onclick = () => this.compartir(k);
    });
  },
  async compartir(k) {
    const [t, id] = k.split(':');
    const nombre = this.nombre(k);
    const texto = t === 's' ? `He conseguido el sello «${nombre}» en mi Pasaporte de Sevilla de BusSev 🚌` : `He conseguido la medalla «${nombre}» en BusSev 🚌🏅`;
    try {
      const png = await fetch(`img/pasaporte/${t}-${id}.png`).then((r) => r.blob());
      const b64 = await new Promise((ok) => { const f = new FileReader(); f.onload = () => ok(String(f.result).split(',')[1]); f.readAsDataURL(png); });
      const w = await window.Capacitor.nativePromise('Filesystem', 'writeFile', { path: `logro-${t}-${id}.png`, data: b64, directory: 'CACHE' });
      await window.Capacitor.nativePromise('Share', 'share', { text: texto, files: [w.uri] });
    } catch {
      try { await navigator.share?.({ text: texto }); } catch { /* cancelado */ }
    }
  },
  /* Copia de seguridad: los viajes solo se aceptan si Android confirma su firma (no se pueden inventar) */
  copia() { return this.estado().viajes.filter((x) => x.verificado && x.firma).slice(-2000); },
  async restaurar(lista) {
    if (!Array.isArray(lista) || !lista.length || !window.Capacitor?.isPluginAvailable?.('BusSevViaje')) return 0;
    try {
      const r = await window.Capacitor.nativePromise('BusSevViaje', 'comprobarViajes', { viajes: lista });
      const ok = new Set(r?.validos || []);
      const buenos = lista.filter((x) => ok.has(x.id));
      if (buenos.length) this.registrar(buenos);
      return buenos.length;
    } catch { return 0; }
  },
  resumen() { const s = this.estado(); const ks = Object.keys(s.logros); return { sellos: ks.filter((k) => k.startsWith('s:')).length, medallas: ks.filter((k) => k.startsWith('m:')).length, viajes: s.viajes.filter((x) => x.verificado).length }; },
  /* Tarjeta de entrada (en la pestaña Tarjeta) */
  entradaHTML() {
    const r = this.resumen();
    return `<a class="ps-entrada" href="#pasaporte"><span class="ps-escudo">${pic('torre', '#e9c77b', 1.7).replace('<g ', '<svg viewBox="0 0 24 24"><g ').replace(/<\/g>$/, '</g></svg>')}</span>
      <span class="ps-ent-tx"><b>Pasaporte de Sevilla</b><small>${r.sellos} de ${LUGARES.length} sellos · ${r.medallas} medallas</small>
      <span class="ps-barra"><i style="width:${Math.round(100 * (r.sellos + r.medallas) / (LUGARES.length + MEDALLAS.length))}%"></i></span></span>${ICON.chev}</a>`;
  },
};
window.pasaporte = pasaporte;

/* ---------- Pantalla del pasaporte ---------- */
const fmtFecha = (t) => new Date(t).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '');
views.pasaporte = (el) => {
  const pintar = () => {
    const s = pasaporte.estado(), r = pasaporte.resumen();
    const total = LUGARES.length + MEDALLAS.length;
    const viajes = s.viajes.slice(-8).reverse();
    el.innerHTML = `<div class="stack view-anim">
      <div class="detail-head"><a class="back" href="#tarjeta" data-back aria-label="Volver">${ICON.back}</a><div><h1>Pasaporte de Sevilla</h1><p>Sellos y medallas por tus viajes en bus.</p></div></div>
      <section class="ps-portada"><span class="ps-escudo grande">${pic('torre', '#e9c77b', 1.6).replace('<g ', '<svg viewBox="0 0 24 24"><g ').replace(/<\/g>$/, '</g></svg>')}</span>
        <div><b>${r.sellos} de ${LUGARES.length} sellos · ${r.medallas} de ${MEDALLAS.length} medallas</b><small>${r.viajes} ${r.viajes === 1 ? 'viaje verificado' : 'viajes verificados'}</small>
        <span class="ps-barra"><i style="width:${Math.round(100 * (r.sellos + r.medallas) / total)}%"></i></span></div></section>
      ${window.anio?.entradaHTML?.() || ''}
      <div class="alert ps-como">Para que un viaje cuente, en la parada toca tu autobús y elige <b>«Me subo a este: avísame al bajar»</b>. El móvil comprueba que de verdad vas en ese bus (llegaba a tu parada, vas por su recorrido y a su velocidad) y, al bajarte, te da los sellos y medallas que ganes.</div>
      <h2 class="ps-h">Sellos de lugares</h2>
      <div class="ps-sellos">${LUGARES.map(([id, n]) => { const t = s.logros[`s:${id}`]; return `<button type="button" class="ps-item${t ? ' ok' : ''}" data-ps="s:${id}">${selloSVG(id, { apagado: !t, fecha: t ? fmtFecha(t) : '' })}<span>${esc(n)}</span><small>${t ? fmtFecha(t) : 'Sin sellar'}</small></button>`; }).join('')}</div>
      <h2 class="ps-h">Medallas</h2>
      <div class="ps-medallas">${MEDALLAS.map(([id, n, d]) => { const t = s.logros[`m:${id}`]; return `<button type="button" class="ps-med${t ? ' ok' : ''}" data-ps="m:${id}">${medallaSVG(id, { apagado: !t })}<span class="ps-med-tx"><b>${esc(n)}</b><small>${esc(d)}</small></span>${t ? `<small class="ps-fecha">${fmtFecha(t)}</small>` : ''}</button>`; }).join('')}</div>
      ${viajes.length ? `<h2 class="ps-h">Tus últimos viajes</h2><div class="list">${viajes.map((v) => `<div class="row-flat ps-viaje">${badge(v.linea, lineaFor(v.linea)?.color)}<div><b>${esc(v.desdeNombre || '')} → ${esc(v.hastaNombre || '')}</b><p class="help">${new Date(v.inicio).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${v.verificado ? '✅ Verificado' : `❌ No contó: ${esc(v.motivo || 'no se pudo comprobar')}`}</p></div></div>`).join('')}</div>` : ''}
    </div>`;
    el.querySelectorAll('[data-ps]').forEach((b) => { b.onclick = () => {
      const k = b.dataset.ps, t = pasaporte.estado().logros[k];
      openModal(`<div class="ps-celebra">${pasaporte.arte(k, { apagado: !t, papel: !!t, fecha: t ? fmtFecha(t) : "" })}<h2>${esc(pasaporte.nombre(k))}</h2><p class="help">${esc(pasaporte.texto(k))}</p>
        <p class="help">${t ? `Conseguido el ${new Date(t).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}` : k.startsWith('s:') ? 'Bájate cerca de este sitio en un viaje verificado para conseguirlo.' : 'Aún no lo tienes.'}</p></div>
        <div class="actions">${t ? '<button class="btn ghost" type="button" id="ps-comp">Compartir</button>' : ''}<button class="btn" type="button" id="ps-x">Cerrar</button></div>`, (m, close) => {
        $('#ps-x', m).onclick = close;
        $('#ps-comp', m)?.addEventListener('click', () => pasaporte.compartir(k));
      });
    }; });
  };
  pintar();
  pasaporte.sincronizar().then((n) => { if (n.length) pintar(); });
  el.__repintar = pintar;
};

/* Al abrir o volver a la app se recogen los viajes que ha verificado Android */
setTimeout(() => pasaporte.sincronizar(), 2500);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') setTimeout(() => pasaporte.sincronizar(), 600); });
window.addEventListener('bussevViaje', () => pasaporte.sincronizar());
})();
