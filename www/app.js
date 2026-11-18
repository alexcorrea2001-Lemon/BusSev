/* BusSev — app Android para los autobuses de TUSSAM (Sevilla).
   Datos: backend.js (paradas incluidas + tiempos directos de TUSSAM).
   Mapa: MapLibre + OpenFreeMap (sin clave), recorridos por calle de recorridos.js. */
'use strict';

/* ================================================================== */
/* Almacenamiento y ajustes                                            */
/* ================================================================== */
const store = {
  get(k, d) { try { const v = localStorage.getItem('bussev.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('bussev.' + k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } },
};
const DEFAULTS = {
  theme: 'dark', color: 'rojo', refresh: 30, liveLines: true, mapStyle: 'oscuro',
  tematicaAuto: true, tematica: 'normal',
  voz: false, vozAuto: false, letraGrande: false, escalaTexto: 1.22, altoContraste: false, menosAnimaciones: false, vibrar: true, botonesGrandes: false,
  modoSencillo: false,
  revisarCada: 3, avisosTussam: 'mias', avisosResumen: true, avisosTarjetas: true, avisosParada: true, avisosLinea: true, saldoURL: '', tiemposServidor: false, fondo: '', vehiculosFiesta: false, avisarVersion: true,
};
const settings = { ...DEFAULTS, ...store.get('settings', {}) };
if (!['oscuro', 'claro', 'tema', 'satelite'].includes(settings.mapStyle)) settings.mapStyle = 'oscuro';
const saveSettings = () => store.set('settings', settings);

// [acento, acento suave, texto sobre acento] para tema claro y oscuro
const PALETTES = {
  rojo:    { label: 'Rojo',    light: ['#d41c2b', '#fce6e8', '#ffffff'], dark: ['#ff4f5b', '#3a1a1e', '#ffffff'] },
  azul:    { label: 'Azul',    light: ['#1f4fbf', '#e3eafb', '#ffffff'], dark: ['#7d9fff', '#1f2b4f', '#0b0f1a'] },
  verde:   { label: 'Verde',   light: ['#12805c', '#ddf3ea', '#ffffff'], dark: ['#3fcb97', '#14352a', '#06140f'] },
  morado:  { label: 'Morado',  light: ['#6a3fc4', '#eee7fb', '#ffffff'], dark: ['#b294ff', '#2a2148', '#130b26'] },
  naranja: { label: 'Naranja', light: ['#c75a00', '#fbebdc', '#ffffff'], dark: ['#ff9e4f', '#3a2614', '#1f1000'] },
  grafito: { label: 'Grafito', light: ['#2b3445', '#e6e9ef', '#ffffff'], dark: ['#d0d6e2', '#2a2f3a', '#111318'] },
  rosa:    { label: 'Rosa',    light: ['#c2185b', '#fbe4ee', '#ffffff'], dark: ['#ff79b0', '#3b1a2a', '#2a0716'] },
  turquesa:{ label: 'Turquesa',light: ['#00838f', '#dcf3f5', '#ffffff'], dark: ['#4dd0e1', '#123236', '#002a2f'] },
  // Pasteles (texto oscuro encima para que se lea bien)
  rosaP:   { label: 'Rosa pastel',     pastel: true, light: ['#f2a7c3', '#fdeef4', '#3d0f22'], dark: ['#f5b5cd', '#3a2430', '#2a0b18'] },
  menta:   { label: 'Menta',           pastel: true, light: ['#8fd8bf', '#e6f8f1', '#0d3a2c'], dark: ['#9de3ca', '#1d3a31', '#0b2a20'] },
  lavanda: { label: 'Lavanda',         pastel: true, light: ['#b9a6f0', '#f1edfd', '#24164d'], dark: ['#c6b6f6', '#2c2645', '#1a1036'] },
  celeste: { label: 'Celeste',         pastel: true, light: ['#8cc8f0', '#e8f4fc', '#0c2f48'], dark: ['#9fd3f5', '#1d3242', '#0a2233'] },
  melocoton:{ label: 'Melocotón',      pastel: true, light: ['#f7b98b', '#fef0e5', '#4a2209'], dark: ['#f9c6a0', '#3d2a1d', '#2e1606'] },
  limon:   { label: 'Limón',           pastel: true, light: ['#e8d566', '#fbf7dc', '#3a3200'], dark: ['#efe08a', '#3a3620', '#2a2400'] },
};
/* Colores de fondo (además del blanco y el negro de siempre) */
const FONDOS = {
  crema:   { label: 'Crema',        base: 'light', bg: '#f7f1e6', surface: '#fffaf1', s2: '#efe6d6', line: '#e4d8c3', muted: '#6d6457' },
  niebla:  { label: 'Gris azulado', base: 'light', bg: '#eef1f5', surface: '#fbfcfe', s2: '#e1e6ee', line: '#d5dce6', muted: '#5b6474' },
  salvia:  { label: 'Salvia',       base: 'light', bg: '#edf3ee', surface: '#fafdfb', s2: '#dfeae2', line: '#d0dfd4', muted: '#56665a' },
  rosado:  { label: 'Rosado',       base: 'light', bg: '#f8eef1', surface: '#fffafb', s2: '#f0e1e6', line: '#e8d3da', muted: '#6c5960' },
  noche:   { label: 'Azul noche',   base: 'dark',  bg: '#0d1422', surface: '#162033', s2: '#1f2b42', line: '#2a3853', muted: '#93a0b8' },
  pizarra: { label: 'Pizarra',      base: 'dark',  bg: '#1a1d21', surface: '#24282e', s2: '#2e333a', line: '#3a4048', muted: '#a0a7b1' },
  bosque:  { label: 'Bosque',       base: 'dark',  bg: '#0f1712', surface: '#18241c', s2: '#213027', line: '#2c3e33', muted: '#98ab9e' },
  vino:    { label: 'Vino',         base: 'dark',  bg: '#1a0f13', surface: '#26171d', s2: '#322028', line: '#432b35', muted: '#b79aa6' },
  cafe:    { label: 'Café',         base: 'dark',  bg: '#17120e', surface: '#231b15', s2: '#2e241c', line: '#3d3026', muted: '#b0a091' },
};
// Temáticas: colores de la app y autobús del mapa (dibujos del usuario en /img/buses)
const TEMATICAS = {
  normal:      { nombre: 'Normal', bus: 'normal' },
  navidad:     { nombre: 'Navidad', bus: 'navidad', light: ['#c8102e', '#fbe3e6', '#ffffff'], dark: ['#ff4d5e', '#3d1418', '#ffffff'] },
  semanasanta: { nombre: 'Semana Santa', bus: 'semanasanta', light: ['#5b2a86', '#efe6f7', '#ffffff'], dark: ['#c39be8', '#2a1a3d', '#140a20'] },
  feria:       { nombre: 'Feria de Abril', bus: 'feria', light: ['#0f8a3c', '#dff3e6', '#ffffff'], dark: ['#3ccf76', '#12301e', '#04140a'] },
  halloween:   { nombre: 'Halloween', bus: 'halloween', light: ['#e86a00', '#fdebd9', '#ffffff'], dark: ['#ff8a1f', '#3a220d', '#1a0d00'] },
};
/* Domingo de Resurrección (algoritmo de Meeus/Jones/Butcher) */
function pascua(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, mes - 1, dia);
}
/* Fechas de cada temática para un año (la Feria se calcula: del sábado 13 días después de Pascua al sábado siguiente) */
function fechasTematicas(y) {
  const p = pascua(y), dd = (n) => new Date(p.getFullYear(), p.getMonth(), p.getDate() + n);
  return {
    semanasanta: [dd(-9), dd(0)],
    feria: [dd(13), dd(20)],
    halloween: [new Date(y, 9, 25), new Date(y, 10, 1)],
    navidad: [new Date(y, 11, 1), new Date(y + 1, 0, 6)],
  };
}
function tematicaPorFecha(d = new Date()) {
  const hoy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  for (const y of [d.getFullYear() - 1, d.getFullYear()]) {
    for (const [k, [ini, fin]] of Object.entries(fechasTematicas(y))) if (hoy >= ini && hoy <= fin) return k;
  }
  return 'normal';
}
const tematicaActiva = () => (settings.modoSencillo ? 'normal' : pruebaDia ? 'navidad' : (settings.tematicaAuto ? tematicaPorFecha() : (TEMATICAS[settings.tematica] ? settings.tematica : 'normal')));
/* Días especiales dentro de la Navidad: el día de Navidad (Papá Noel), Nochevieja, Año Nuevo y Reyes.
   Cambian el saludo de Favoritas y la decoración (trineo, fuegos artificiales, camellos…). */
const DIAS_NAVIDAD = { '12-25': 'papanoel', '12-31': 'nochevieja', '01-01': 'anonuevo', '01-06': 'reyes' };
let pruebaDia = null;   // vista previa desde Ajustes: no se guarda (se quita al cerrar la app)
function diaEspecial(d = new Date()) {
  if (tematicaActiva() !== 'navidad') return null;
  if (pruebaDia) return pruebaDia;
  return DIAS_NAVIDAD[`${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`] || null;
}
/* Festivos de Sevilla (nacionales + Andalucía + Jueves y Viernes Santo). En festivo y domingo
   TUSSAM circula con horario reducido; se avisa en Favoritas. Pueden faltar los 2 locales que
   fija el Ayuntamiento cada año, que cambian. */
const FESTIVOS_FIJOS = ['01-01', '01-06', '02-28', '05-01', '08-15', '10-12', '11-01', '12-06', '12-08', '12-25'];
const claveDia = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function festivosDe(y) {
  const s = new Set(FESTIVOS_FIJOS.map((m) => `${y}-${m}`));
  const p = pascua(y), sem = (n) => claveDia(new Date(p.getFullYear(), p.getMonth(), p.getDate() + n));
  s.add(sem(-3)); s.add(sem(-2)); // Jueves y Viernes Santo
  return s;
}
function tipoDia(d = new Date()) {
  if (festivosDe(d.getFullYear()).has(claveDia(d))) return 'festivo';
  const wd = d.getDay();
  return wd === 0 ? 'domingo' : wd === 6 ? 'sabado' : 'laborable';
}
/* Primer y último autobús de HOY (laborable, sábado, o domingo/festivo), del horario oficial de un día normal.
   La madrugada cuenta como el día anterior (como hace TUSSAM: el búho de las 2:00 del sábado es del viernes). */
const DIAS_HORARIO = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];   // como getDay(): 0 = domingo
const NOMBRE_TIPO = { lun: '', mar: '', mie: '', jue: '', vie: '', lab: '', sab: 'Sábados', dom: 'Domingos y festivos' };
function tipoHorarioHoy(d = new Date()) {
  const dia = new Date(d.getTime() - 4 * 3600_000);
  return tipoDia(dia) === 'festivo' ? 'dom' : DIAS_HORARIO[dia.getDay()];
}
function horasHoy(l, sentido = 1, d = new Date()) {
  const t = tipoHorarioHoy(d), par = l?.horario?.[t]?.[sentido - 1];
  if (par) return { ini: par[0], fin: par[1], tipo: t };
  if (l?.horario && !l.horario[t] && Object.keys(l.horario).length) return { ini: null, fin: null, tipo: t, noHoy: true };
  const ini = sentido === 2 ? l?.hora_inicio_vuelta : l?.hora_inicio_ida, fin = sentido === 2 ? l?.hora_fin_vuelta : l?.hora_fin_ida;
  return { ini, fin, tipo: 'lab' };
}
/* Cómo decir el último autobús: si pasa de medianoche y casi enlaza con el primero del día siguiente, es que
   circula toda la noche (la 29 los viernes y sábados); si pasa de la 1 de la madrugada, se dice «de madrugada». */
function textoUltimo(h) {
  if (!h?.ini || !h?.fin) return null;
  const m = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const ini = m(h.ini), fin = m(h.fin);
  if (fin < ini && fin + 1440 - ini >= 1440 - 45) return { todaNoche: true, txt: 'circula toda la noche' };
  if (fin < ini && fin >= 60) return { txt: `último ${h.fin} (de madrugada)` };
  return { txt: `último ${h.fin}` };
}
/* ---------- Horario de cada parada (www/horarios.js) ----------
   El GTFS oficial dice a qué hora sale cada viaje de cabecera y cuánto tarda hasta cada parada: con eso se sabe
   a qué hora pasa por TU parada (no solo a qué hora sale de cabecera). El archivo se carga solo cuando hace falta. */
let _horP = null, _recIdx = null;
function cargarHorarios() {
  if (window.BUSSEV_HORARIOS) return Promise.resolve(window.BUSSEV_HORARIOS);
  if (_horP) return _horP;
  _horP = new Promise((ok) => {
    const sc = document.createElement('script');
    sc.src = 'horarios.js'; sc.async = true;
    setTimeout(() => ok(window.BUSSEV_HORARIOS || null), 6000);   // si tarda o no llega, se sigue sin él
    sc.onload = () => ok(window.BUSSEV_HORARIOS || null);
    sc.onerror = () => { _horP = null; ok(null); };   // versión sin horarios todavía: no pasa nada
    document.head.appendChild(sc);
  });
  return _horP;
}
/* Metro de Sevilla (www/metro.js): estaciones, recorrido y horario. Se carga solo cuando hace falta. */
let _metroP = null;
function cargarMetro() {
  if (window.BUSSEV_METRO) return Promise.resolve(window.BUSSEV_METRO);
  if (_metroP) return _metroP;
  _metroP = new Promise((ok) => {
    const sc = document.createElement('script');
    sc.src = 'metro.js'; sc.async = true;
    setTimeout(() => ok(window.BUSSEV_METRO || null), 6000);   // si tarda o no llega, se sigue sin él
    sc.onload = () => ok(window.BUSSEV_METRO || null);
    sc.onerror = () => { _metroP = null; ok(null); };
    document.head.appendChild(sc);
  });
  return _metroP;
}
const esMetro = (k) => /^M1(\||$)/.test(String(k || ''));
/* Horario de una línea|sentido (bus o metro) para un día: { e: {m, v}, g: grupo del día } */
function horarioDe(k, d = new Date()) {
  const H = esMetro(k) ? window.BUSSEV_METRO?.horarios : window.BUSSEV_HORARIOS;
  if (!H?.l?.[k]) return null;
  return { e: H.l[k], g: H.dias?.[tipoHorarioHoy(d)] };
}
/* Datos de una línea, también del metro */
const lineaInfo = (n) => lineaFor(n) || (String(n) === 'M1' ? window.BUSSEV_METRO?.linea : null) || null;
const estacionMetro = (c) => (window.BUSSEV_METRO?.estaciones || []).find((e) => e.codigo === c) || null;
const nombreLinea = (n) => (String(n) === 'M1' ? 'Metro (línea 1)' : `línea ${n}`);
/* Próximos trenes en una estación (según horario), en los dos sentidos */
function pasosMetro(codigo, d = new Date()) {
  const M = window.BUSSEV_METRO;
  if (!M) return [];
  const ahora = minutoServicio(d), out = [];
  for (const sen of [1, 2]) {
    const seq = M.recorridos.filter((r) => r[2] === sen).sort((a, b) => a[3] - b[3]).map((r) => r[0]);
    const o = seq.indexOf(codigo), h = horarioDe(`M1|${sen}`, d);
    if (o < 0 || o === seq.length - 1 || !h || h.g == null || h.e.m[o] == null) continue;
    const ult = h.e.m.length - 1;
    let s0 = 0; const mins = [];
    for (const x of h.e.v[h.g] || []) { const [dd, a, b] = Array.isArray(x) ? x : [x, 0, ult]; s0 += dd; if (o >= a && o < b) mins.push(s0 + h.e.m[o]); }
    const prox = mins.filter((m) => m >= ahora).slice(0, 3);
    out.push({ sentido: sen, destino: estacionMetro(seq[seq.length - 1])?.nombre || '', prox, ultimo: mins[mins.length - 1] });
  }
  return out;
}
/* codigo -> [[línea, sentido, posición]] y "línea|sentido" -> [códigos en orden] */
function indiceRecorridos() {
  if (_recIdx) return _recIdx;
  const porParada = new Map(), seqs = new Map();
  for (const [c, l, s, o] of window.BUSSEV_DATA?.recorridos || []) {
    const k = `${l}|${s}`;
    if (!seqs.has(k)) seqs.set(k, []);
    seqs.get(k)[o] = c;
    if (!porParada.has(c)) porParada.set(c, []);
    porParada.get(c).push([l, s, o]);
  }
  _recIdx = { porParada, seqs };
  return _recIdx;
}
/* Minutos del «día de servicio» (de 4:00 a 4:00): la 1:30 de la madrugada del sábado cuenta como viernes, 25:30 */
function minutoServicio(d = new Date()) {
  const m = d.getHours() * 60 + d.getMinutes();
  return d.getHours() < 4 ? m + 1440 : m;
}
const hhmmDe = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.round(m) % 60).padStart(2, '0')}`;
/* Horas a las que pasa cada línea por una parada en un día (según el horario oficial). null si no hay horarios. */
function pasosParada(codigo, d = new Date(), H = window.BUSSEV_HORARIOS) {
  if (!H?.l) return null;
  const g = H.dias?.[tipoHorarioHoy(d)];
  const { porParada, seqs } = indiceRecorridos();
  const out = [];
  for (const [lin, sen, o] of porParada.get(String(codigo)) || []) {
    const e = H.l[`${lin}|${sen}`], seq = seqs.get(`${lin}|${sen}`) || [];
    if (!e || g == null || e.m?.[o] == null) continue;
    const ultimoIdx = e.m.length - 1;
    if (o === ultimoIdx && seq[0] !== seq[ultimoIdx]) continue;   // última parada: ahí se baja, no se coge
    const mins = [];
    let s0 = 0;
    for (const x of e.v?.[g] || []) {
      const [dd, a, b] = Array.isArray(x) ? x : [x, 0, ultimoIdx];
      s0 += dd;
      if (o >= a && o < b || (o === b && b === ultimoIdx && o === 0)) mins.push(s0 + e.m[o]);
    }
    if (!mins.length) continue;
    mins.sort((a, b) => a - b);
    const fin = cache.paradaByCode?.get?.(seq[ultimoIdx]) || (window.BUSSEV_DATA?.paradas || []).find((p) => p.codigo === seq[ultimoIdx]);
    out.push({ linea: lin, sentido: Number(sen), destino: fin ? fin.nombre : '', mins });
  }
  return out.sort((a, b) => ordenLineas(a.linea, b.linea) || a.sentido - b.sentido);
}
/* Resumen de una línea en una parada a una hora: primero, último, siguiente y cada cuánto pasa ahora */
function resumenPasos(p, ahora) {
  const sig = p.mins.find((m) => m >= ahora - 1);
  const cerca = p.mins.filter((m) => m >= ahora - 45 && m <= ahora + 75);
  let cada = null;
  if (cerca.length >= 3) {
    const difs = cerca.slice(1).map((m, i) => m - cerca[i]).sort((a, b) => a - b);
    cada = difs[Math.floor(difs.length / 2)];
  }
  return { primero: p.mins[0], ultimo: p.mins[p.mins.length - 1], sig, cada, acabado: sig == null };
}
/* Próximos autobuses según el horario (para cuando TUSSAM no da tiempos): «29 a las 06:12» */
function proximosProgramados(codigo, d = new Date(), n = 3) {
  const pasos = pasosParada(codigo, d);
  if (!pasos) return null;
  const ahora = minutoServicio(d);
  let lista = pasos.map((p) => ({ ...p, m: p.mins.find((m) => m >= ahora) })).filter((p) => p.m != null);
  let manana = false;
  if (!lista.length) {
    // Ya no pasa nada hoy: los primeros de mañana
    const d2 = new Date(d.getTime() - 4 * 3600_000 + 24 * 3600_000); d2.setHours(6, 0, 0, 0);   // el día de servicio siguiente
    lista = (pasosParada(codigo, d2) || []).map((p) => ({ ...p, m: p.mins[0] })).filter((p) => p.m != null);
    manana = true;
  }
  return { manana, lista: lista.sort((a, b) => a.m - b.m).slice(0, n) };
}
function proximosProgramadosHTML(codigo, lineasElegidas = []) {
  const r = proximosProgramados(codigo);
  if (!r) return '';
  const sel = new Set(lineasElegidas.map((n) => lineaFor(n)?.numero || String(n)));
  const lista = sel.size ? r.lista.filter((p) => sel.has(p.linea)) : r.lista;
  if (!lista.length) return '';
  return `<div class="prog"><p class="small muted">Según el horario oficial, ${r.manana ? 'los primeros de la mañana' : 'los próximos'}:</p><ul>${lista.map((p) => {
    const l = lineaFor(p.linea);
    return `<li>${badge(etiquetaLinea(l?.numero || p.linea), l?.color)}<span>hacia ${esc(p.destino)}</span><b>${hhmmDe(p.m)}</b></li>`;
  }).join('')}</ul></div>`;
}
/* Sección «Horario en esta parada» */
function horarioParadaHTML(codigo, d = new Date()) {
  const pasos = pasosParada(codigo, d);
  if (!pasos || !pasos.length) return '';
  const ahora = minutoServicio(d);
  const nombreDia = { lun: 'lunes', mar: 'martes', mie: 'miércoles', jue: 'jueves', vie: 'viernes', sab: 'sábado', dom: 'domingo y festivo' }[tipoHorarioHoy(d)];
  const filas = pasos.map((p) => {
    const r = resumenPasos(p, ahora), l = lineaFor(p.linea);
    const ult = r.ultimo >= 1440 ? `${hhmmDe(r.ultimo)} (de madrugada)` : hhmmDe(r.ultimo);
    const estado = r.acabado ? '<span class="h-fin">Ya no pasa más hoy</span>'
      : r.sig - ahora > 60 ? `<span>Próximo a las ${hhmmDe(r.sig)}</span>`
        : r.cada ? `<span>Ahora pasa cada ${r.cada} min</span>` : `<span>Próximo a las ${hhmmDe(r.sig)}</span>`;
    return `<li>${badge(etiquetaLinea(l?.numero || p.linea), l?.color, { href: `#linea-${encodeURIComponent(l?.numero || p.linea)}` })}<div><b>hacia ${esc(p.destino)}</b><span>Primero ${hhmmDe(r.primero)} · último ${ult}</span>${estado}</div></li>`;
  }).join('');
  return `<details class="card p-horario"><summary><span>🕒 Horario en esta parada</span><small>hoy, ${nombreDia}</small></summary>
    <ul class="h-lista">${filas}</ul>
    <p class="small muted">Horas a las que pasa por aquí según el horario oficial (aproximadas: con tráfico puede variar unos minutos).</p></details>`;
}
function servicioHoyHTML() {
  const t = tipoDia();
  if (t === 'laborable') return '';
  const txt = t === 'festivo' ? 'Hoy es festivo: TUSSAM circula con horario de domingos y festivos (menos autobuses de lo normal).'
    : t === 'domingo' ? 'Hoy es domingo: horario reducido, pasan menos autobuses.'
      : 'Hoy es sábado: horario de sábado, distinto al de diario.';
  return `<div class="dia-aviso dia-${t}">📅 <span>${txt}</span></div>`;
}
/* Tarjetas con saldo bajo: se enseñan también en Favoritas (debajo de los avisos), no solo como notificación. */
function tarjetasBajasHTML() {
  try {
    if (typeof tarjeta === 'undefined' || !tarjeta.list) return '';
    const bajas = tarjeta.list().filter((c) => c.avisoSaldo?.on && c.ultimo && c.ultimo.saldo != null && c.ultimo.saldo < Number(c.avisoSaldo.importe));
    if (!bajas.length) return '';
    return `<div class="set-group sb-group"><h3>⚠️ Saldo bajo</h3>${bajas.map((c) => {
      const nombre = esc(c.name || `Tarjeta ${tarjeta.fmt(c.num)}`);
      return `<a class="row-flat sb-row" href="#tarjeta"><span class="sb-punto"></span><div style="flex:1;min-width:0"><b>${nombre}</b><p class="help">Le quedan ${fmtEuro(c.ultimo.saldo)} · recárgala pronto</p></div>${ICON.chev}</a>`;
    }).join('')}</div>`;
  } catch { return ''; }
}
/* Tarjetas que caducan pronto (o ya caducadas): se avisan también en Favoritas, como el saldo bajo. */
function tarjetasCaducanHTML() {
  try {
    if (typeof tarjeta === 'undefined' || !tarjeta.list) return '';
    const hoy = Date.now();
    const cad = tarjeta.list().filter((c) => {
      const a = c.avisoCaducidad, u = c.ultimo;
      if (!a?.on || !u?.caducaEl || u.sinCaducidad) return false;
      const dias = Math.max(...((a.dias && a.dias.length) ? a.dias : [15]));
      return u.caducaEl - hoy <= dias * 86400000;
    });
    if (!cad.length) return '';
    return `<div class="set-group sb-group"><h3>⚠️ Caducidad</h3>${cad.map((c) => {
      const nombre = esc(c.name || `Tarjeta ${tarjeta.fmt(c.num)}`);
      const d = Math.ceil((c.ultimo.caducaEl - hoy) / 86400000);
      const txt = d < 0 ? 'Ya caducada · renuévala' : d === 0 ? 'Caduca hoy · renuévala' : `Caduca en ${d} día${d === 1 ? '' : 's'} · renuévala`;
      return `<a class="row-flat sb-row" href="#tarjeta"><span class="sb-punto"></span><div style="flex:1;min-width:0"><b>${nombre}</b><p class="help">${txt}</p></div>${ICON.chev}</a>`;
    }).join('')}</div>`;
  } catch { return ''; }
}
/* Vehículos de fiesta (opcional en Ajustes): cada autobús elige uno al azar, siempre el mismo para ese autobús */
/* izq: dibujos que miran a la izquierda (se giran al revés que el autobús para que vayan de frente) */
const VEHICULOS_FIESTA = {
  normal: { n: 1, nombre: 'el «Butano», el autobús naranja de TUSSAM de toda la vida', clase: 'veh-butano' },
  semanasanta: { n: 8, nombre: 'pasos de Semana Santa', clase: 'veh-paso' },
  feria: { n: 8, nombre: 'coches de caballos', clase: 'veh-coche' },
  halloween: { n: 5, nombre: 'coches de miedo', clase: 'veh-carroza', izq: [3, 4, 5] },
  navidad: { n: 11, nombre: 'carrozas', clase: 'veh-carroza' },
};
const vehiculoFiesta = () => (settings.vehiculosFiesta ? VEHICULOS_FIESTA[tematicaActiva()] || null : null);
const hashTexto = (t) => { let h = 2166136261; for (const ch of String(t)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const numVehiculo = (v, clave) => (clave == null ? 0 : hashTexto(clave) % v.n) + 1;
const busImg = (clave) => {
  const tem = tematicaActiva();
  const v = vehiculoFiesta();
  if (v) return `/img/fiesta/${tem}-${numVehiculo(v, clave)}.webp`;
  return `/img/buses/${TEMATICAS[tem].bus}.webp`;
};
const busMiraIzq = (clave) => { const v = vehiculoFiesta(); return !!(v && v.izq && v.izq.includes(numVehiculo(v, clave))); };
// Iconito del autobús bueno (el de la leyenda del mapa), para usar en textos en vez del emoji 🚌
const busIco = () => `<img class="lg-busimg" src="${busImg()}" alt="autobús" style="height:1.05em;vertical-align:-2px">`;
// Colores para personalizar favoritas y tarjetas
const TAGS = ['#e5303c', '#f08c00', '#f2c400', '#2fb36d', '#1fa3c9', '#3d6bff', '#8a5cf6', '#e0479e', '#7a7f8a'];

const darkMQ = matchMedia('(prefers-color-scheme: dark)');
/* ¿Sin animaciones? Lo decide SOLO el interruptor «Reducir animaciones» de Ajustes (o el Modo sencillo).
   Antes también se apagaban solas, sin avisar, si el móvil tenía quitadas las animaciones del sistema (pasa
   con el ahorro de batería de algunas marcas o en Accesibilidad): en ese móvil la app salía «muerta» aunque el
   interruptor estuviera apagado, y no había forma de encenderlas. */
const quieto = () => !!settings.menosAnimaciones;
let resolvedTheme = 'dark';
function applyTheme() {
  resolvedTheme = settings.theme === 'auto' ? (darkMQ.matches ? 'dark' : 'light') : settings.theme;
  const F = FONDOS[settings.fondo];
  if (F) resolvedTheme = F.base;          // un fondo de color fija si es claro u oscuro
  const root = document.documentElement;
  root.dataset.theme = resolvedTheme;
  const props = { '--bg': F?.bg, '--surface': F?.surface, '--surface-2': F?.s2, '--line': F?.line, '--muted': F?.muted, '--top-bg': F && F.base === 'dark' ? F.surface : null };
  for (const [k, v] of Object.entries(props)) { if (v) root.style.setProperty(k, v); else root.style.removeProperty(k); }
  root.dataset.fondo = settings.fondo || '';
  const tem = tematicaActiva();
  root.dataset.tematica = tem;
  const dia = diaEspecial();
  if (dia) root.dataset.dia = dia; else delete root.dataset.dia;
  const fuente = TEMATICAS[tem][resolvedTheme] ? TEMATICAS[tem] : (PALETTES[settings.color] || PALETTES.rojo);
  const pal = fuente[resolvedTheme];
  root.style.setProperty('--accent', pal[0]);
  root.style.setProperty('--accent-soft', pal[1]);
  root.style.setProperty('--on-accent', pal[2]);
  root.classList.toggle('a-letra', !!settings.letraGrande);
  root.style.setProperty('--escala-texto', settings.escalaTexto || 1.22);
  root.classList.toggle('a-contraste', !!settings.altoContraste);
  root.classList.toggle('a-quieto', quieto());
  root.classList.toggle('a-botones', !!settings.botonesGrandes);
  root.classList.toggle('a-sencillo', !!settings.modoSencillo);
  const v = vehiculoFiesta();
  document.querySelectorAll('img.busmk-img').forEach((i) => {
    i.src = busImg(i.dataset.k);
    i.toggleAttribute('data-izq', busMiraIzq(i.dataset.k));
    const mk = i.closest('.busmk');
    if (mk) { mk.classList.remove('veh-paso', 'veh-coche', 'veh-carroza', 'veh-butano'); if (v) mk.classList.add(v.clase); }
  });
  document.querySelectorAll('img.lg-busimg').forEach((i) => { i.src = busImg(); });
  updateMapStyles();
  fiesta(tem, dia);
  // El saludo de Favoritas se cambia al momento (antes se quedaba el de la temática anterior hasta reabrir la app)
  const sf = document.getElementById('fav-fiesta'); if (sf) setHTML(sf, saludoFiestaHTML());
}
/* Barra de abajo: si con la letra del móvil muy grande los nombres de las pestañas no caben, solo iconos */
function ajustarPestanas() {
  const tb = document.querySelector('.tabbar'); if (!tb) return;
  const corta = () => [...tb.querySelectorAll('a span')].some((s) => s.scrollWidth > s.clientWidth + 1);
  tb.classList.remove('solo-iconos', 'apretada');
  if (!corta()) return;
  tb.classList.add('apretada');           // primero, letra un poco más pequeña
  if (corta()) { tb.classList.remove('apretada'); tb.classList.add('solo-iconos'); }   // y si ni así: solo iconos
}
addEventListener('resize', () => requestAnimationFrame(ajustarPestanas));
document.fonts?.ready?.then(ajustarPestanas);
setTimeout(ajustarPestanas, 300);
/* A medianoche (o al volver a la app otro día) puede tocar otra temática u otro día especial */
let firmaFiesta = '';
setInterval(() => { if (document.visibilityState === 'visible') revisarFiesta(); }, 60_000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') revisarFiesta(); });
function revisarFiesta() { const f = `${tematicaActiva()}|${diaEspecial() || ''}`; if (firmaFiesta && f !== firmaFiesta) applyTheme(); firmaFiesta = f; }
/* Decoración festiva: unos pocos elementos que caen o flotan (solo CSS, se paran en segundo plano
   y con «Reducir animaciones»). Nada de imágenes externas ni bucles en JavaScript. */
/* Dibujos propios (SVG) para cada fiesta. Escudos e insignias genéricos, no de ninguna hermandad concreta. */
const PIEZAS = {"escudo": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 40 40\"><path d=\"M14 5l3 3 3-4 3 4 3-3v4H14z\" fill=\"#e2b74a\"/><path d=\"M8 10h24v11q0 11-12 16Q8 32 8 21z\" fill=\"#6d1a2a\" stroke=\"#e2b74a\" stroke-width=\"2\"/><path d=\"M20 14v18M14 20h12\" stroke=\"#e2b74a\" stroke-width=\"3\" stroke-linecap=\"round\"/><circle cx=\"20\" cy=\"20\" r=\"2\" fill=\"#6d1a2a\" stroke=\"#e2b74a\"/></svg>", "capirote": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 40 40\"><path d=\"M20 1 29 25H11z\" fill=\"#4b1f6f\"/><path d=\"M11 25q9 4 18 0l4 14H7z\" fill=\"#4b1f6f\"/><path d=\"M11 25q9 4 18 0\" fill=\"none\" stroke=\"#3a1557\" stroke-width=\"1\"/><ellipse cx=\"17\" cy=\"19\" rx=\"1.5\" ry=\"1\" fill=\"#120818\"/><ellipse cx=\"23\" cy=\"19\" rx=\"1.5\" ry=\"1\" fill=\"#120818\"/><circle cx=\"20\" cy=\"32\" r=\"2.6\" fill=\"#e2b74a\"/><path d=\"M7 39h26\" stroke=\"#f4efe1\" stroke-width=\"1.5\"/></svg>", "cirial": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 40 40\"><path d=\"M19.2 14h1.6v25h-1.6z\" fill=\"#c99a2e\"/><circle cx=\"20\" cy=\"22\" r=\"1.6\" fill=\"#e2b74a\"/><circle cx=\"20\" cy=\"30\" r=\"1.6\" fill=\"#e2b74a\"/><path d=\"M13 13h14l-3 4h-8z\" fill=\"#e2b74a\"/><path d=\"M15 11h10v2H15z\" fill=\"#c99a2e\"/><path d=\"M18 5h4v6h-4z\" fill=\"#f6f1e2\"/><path d=\"M20 .5q3 2.6 0 4.5-3-1.9 0-4.5z\" fill=\"#ffb02e\"/></svg>", "candelabro": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 40 40\"><path d=\"M20 38V14M20 31 8 19M20 31l12-12M20 25l-7-10M20 25l7-10\" stroke=\"#e2b74a\" stroke-width=\"1.8\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M15 38h10\" stroke=\"#c99a2e\" stroke-width=\"3\"/><rect x=\"18.8\" y=\"8\" width=\"2.4\" height=\"6\" fill=\"#f6f1e2\"/><path d=\"M20 4.5q2 1.8 0 3.3-2-1.5 0-3.3z\" fill=\"#ffb02e\"/><rect x=\"6.8\" y=\"13\" width=\"2.4\" height=\"6\" fill=\"#f6f1e2\"/><path d=\"M8 9.5q2 1.8 0 3.3-2-1.5 0-3.3z\" fill=\"#ffb02e\"/><rect x=\"30.8\" y=\"13\" width=\"2.4\" height=\"6\" fill=\"#f6f1e2\"/><path d=\"M32 9.5q2 1.8 0 3.3-2-1.5 0-3.3z\" fill=\"#ffb02e\"/><rect x=\"11.8\" y=\"9\" width=\"2.4\" height=\"6\" fill=\"#f6f1e2\"/><path d=\"M13 5.5q2 1.8 0 3.3-2-1.5 0-3.3z\" fill=\"#ffb02e\"/><rect x=\"25.8\" y=\"9\" width=\"2.4\" height=\"6\" fill=\"#f6f1e2\"/><path d=\"M27 5.5q2 1.8 0 3.3-2-1.5 0-3.3z\" fill=\"#ffb02e\"/></svg>", "incensario": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 40 40\"><path d=\"M20 1v8M13 2l4 10M27 2l-4 10\" stroke=\"#c99a2e\" stroke-width=\"1.1\"/><circle cx=\"20\" cy=\"2\" r=\"1.6\" fill=\"#e2b74a\"/><path d=\"M12 14q8-6 16 0z\" fill=\"#e2b74a\"/><path d=\"M11 15h18q0 11-9 13-9-2-9-13z\" fill=\"#d9a93a\"/><path d=\"M14 18h12M15 22h10\" stroke=\"#a87b1e\" stroke-width=\"1\"/><path d=\"M17 28h6v3h-6zM13 33h14v2H13z\" fill=\"#c99a2e\"/><path d=\"M31 10q4-3 1-7M34 13q4-4 1-9\" stroke=\"#d8d2c4\" stroke-width=\"1.3\" fill=\"none\" opacity=\".8\"/></svg>", "naveta": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 40 40\"><path d=\"M4 18q16 13 32 0-16 4-32 0z\" fill=\"#e2b74a\"/><path d=\"M6 18q14 3 28 0\" stroke=\"#a87b1e\" fill=\"none\"/><path d=\"M8 15q12-5 24 0\" fill=\"#d9a93a\"/><circle cx=\"20\" cy=\"12\" r=\"1.8\" fill=\"#e2b74a\"/><path d=\"M18 26h4l2 7h-8z\" fill=\"#c99a2e\"/><path d=\"M13 34h14\" stroke=\"#c99a2e\" stroke-width=\"2.5\"/></svg>", "regalo": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 40 40\"><rect x=\"7\" y=\"17\" width=\"26\" height=\"20\" rx=\"2\" fill=\"#d42a3c\"/><rect x=\"5\" y=\"12\" width=\"30\" height=\"7\" rx=\"2\" fill=\"#ef4655\"/><rect x=\"18\" y=\"12\" width=\"4\" height=\"25\" fill=\"#f5c518\"/><path d=\"M20 12C14 3 7 9 20 12 33 9 26 3 20 12z\" fill=\"none\" stroke=\"#f5c518\" stroke-width=\"2.4\"/></svg>", "arbol": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 40 40\"><path d=\"M20 4l9 12h-4l8 10h-6l8 9H5l8-9H7l8-10h-4z\" fill=\"#1d7a3a\"/><rect x=\"17\" y=\"35\" width=\"6\" height=\"4\" fill=\"#7a4a1f\"/><circle cx=\"15\" cy=\"22\" r=\"1.8\" fill=\"#ff3b3b\"/><circle cx=\"25\" cy=\"29\" r=\"1.8\" fill=\"#ffd23b\"/><circle cx=\"23\" cy=\"17\" r=\"1.6\" fill=\"#3bb8ff\"/><circle cx=\"13\" cy=\"31\" r=\"1.6\" fill=\"#ffd23b\"/><path d=\"M20 0l1.4 2.9 3.2.4-2.3 2.2.6 3.1L20 7l-2.9 1.6.6-3.1-2.3-2.2 3.2-.4z\" fill=\"#f5c518\"/></svg>", "estrella": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 40 40\"><path d=\"M20 3l4.7 10.2 11.1 1.2-8.3 7.5 2.4 11L20 27.3 10.1 33l2.4-11-8.3-7.5 11.1-1.2z\" fill=\"#f5c518\"/></svg>", "copo": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 40 40\"><g stroke=\"#fff\" stroke-width=\"2.2\" stroke-linecap=\"round\" fill=\"none\"><path d=\"M20 3v34M5.3 11.5l29.4 17M5.3 28.5l29.4-17\"/><path d=\"M15 6l5 4 5-4M15 34l5-4 5 4M5 17l6 1-1-6M35 23l-6-1 1 6M5 23l6-1-1 6M35 17l-6 1 1-6\"/></g></svg>", "abanico": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 40 40\"><path d=\"M20 34 3 17a24 24 0 0 1 34 0z\" fill=\"#e5303c\"/><g stroke=\"#9c1420\" stroke-width=\".8\"><path d=\"M20 34 32.0 21.9\"/><path d=\"M20 34 29.4 19.8\"/><path d=\"M20 34 26.4 18.3\"/><path d=\"M20 34 23.3 17.3\"/><path d=\"M20 34 19.9 17.0\"/><path d=\"M20 34 16.6 17.3\"/><path d=\"M20 34 13.5 18.3\"/><path d=\"M20 34 10.5 19.9\"/><path d=\"M20 34 8.0 22.0\"/></g><g fill=\"#fff\"><circle cx=\"10\" cy=\"19\" r=\"1.6\"/><circle cx=\"16\" cy=\"14\" r=\"1.6\"/><circle cx=\"24\" cy=\"14\" r=\"1.6\"/><circle cx=\"30\" cy=\"19\" r=\"1.6\"/><circle cx=\"13\" cy=\"24\" r=\"1.6\"/><circle cx=\"20\" cy=\"19\" r=\"1.6\"/><circle cx=\"27\" cy=\"24\" r=\"1.6\"/></g><path d=\"M3 17a24 24 0 0 1 34 0\" fill=\"none\" stroke=\"#f7f3e8\" stroke-width=\"1.5\"/><rect x=\"18\" y=\"33\" width=\"4\" height=\"6\" rx=\"1\" fill=\"#6b3b1f\"/></svg>", "sombrero": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 40 40\"><ellipse cx=\"20\" cy=\"28\" rx=\"18\" ry=\"5\" fill=\"#1d1d1d\"/><path d=\"M11 27V16q0-4 9-4t9 4v11z\" fill=\"#262626\"/><rect x=\"11\" y=\"22\" width=\"18\" height=\"3\" fill=\"#7a1f2b\"/><ellipse cx=\"20\" cy=\"16\" rx=\"9\" ry=\"2.4\" fill=\"#333\"/></svg>", "castanuelas": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 40 40\"><path d=\"M14 8q8 0 8 12t-8 12q-8 0-8-12t8-12z\" fill=\"#8a4a1f\"/><path d=\"M26 10q8 0 8 12t-8 12q-6 0-7.5-6\" fill=\"#a85d28\"/><path d=\"M14 8q2-5 6-4 4-1 6 6\" stroke=\"#e5303c\" stroke-width=\"2\" fill=\"none\"/><circle cx=\"14\" cy=\"20\" r=\"2\" fill=\"#5e2f12\"/></svg>", "farolillo": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 40 40\"><path d=\"M20 0v5\" stroke=\"#5b4a2a\"/><rect x=\"15\" y=\"5\" width=\"10\" height=\"3\" rx=\"1\" fill=\"#2b2b2b\"/><ellipse cx=\"20\" cy=\"21\" rx=\"13\" ry=\"13\" fill=\"#0f8a3c\"/><path d=\"M20 8q-12 13 0 26M20 8q12 13 0 26M20 8q-6 13 0 26M20 8q6 13 0 26\" stroke=\"#0a6129\" fill=\"none\" stroke-width=\".9\"/><g fill=\"#fff\"><circle cx=\"13\" cy=\"17\" r=\"1.6\"/><circle cx=\"20\" cy=\"14\" r=\"1.6\"/><circle cx=\"27\" cy=\"17\" r=\"1.6\"/><circle cx=\"16\" cy=\"25\" r=\"1.6\"/><circle cx=\"24\" cy=\"25\" r=\"1.6\"/></g><rect x=\"16\" y=\"33\" width=\"8\" height=\"3\" rx=\"1\" fill=\"#2b2b2b\"/></svg>", "murcielago": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 40 40\"><path d=\"M20 17c-3-4-5-4-6-2-2-4-7-5-12-2 4 1 5 4 5 7 2-2 5-2 6 1 2-2 4-1 7 2 3-3 5-4 7-2 1-3 4-3 6-1 0-3 1-6 5-7-5-3-10-2-12 2-1-2-3-2-6 2z\" fill=\"#1b0d24\"/><path d=\"M17 13l1 3M23 13l-1 3\" stroke=\"#1b0d24\" stroke-width=\"2\"/><circle cx=\"18.6\" cy=\"17\" r=\".9\" fill=\"#ffb02e\"/><circle cx=\"21.4\" cy=\"17\" r=\".9\" fill=\"#ffb02e\"/></svg>", "calabaza": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 40 40\"><ellipse cx=\"20\" cy=\"24\" rx=\"16\" ry=\"12\" fill=\"#ff8a1f\"/><path d=\"M20 12q-9 12 0 24M20 12q9 12 0 24M20 12q-15 12 0 24M20 12q15 12 0 24\" stroke=\"#d9650a\" fill=\"none\" stroke-width=\"1.2\"/><path d=\"M19 13q0-6 4-9\" stroke=\"#3c7a2a\" stroke-width=\"3\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M11 20l5 3-5 2zM29 20l-5 3 5 2z\" fill=\"#3a1500\"/><path d=\"M11 28q9 7 18 0l-3 1-2-2-2 2-2-2-2 2-2-2-2 2z\" fill=\"#3a1500\"/></svg>", "fantasma": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 40 40\"><path d=\"M8 37V18Q8 5 20 5t12 13v19l-4-3-4 3-4-3-4 3-4-3z\" fill=\"#f4f1ff\"/><ellipse cx=\"16\" cy=\"18\" rx=\"2\" ry=\"3\" fill=\"#222\"/><ellipse cx=\"24\" cy=\"18\" rx=\"2\" ry=\"3\" fill=\"#222\"/><ellipse cx=\"20\" cy=\"26\" rx=\"2.4\" ry=\"2\" fill=\"#222\"/></svg>", "arana": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 40 40\"><path d=\"M20 0v14\" stroke=\"#ddd\" stroke-width=\".7\"/><g stroke=\"#111\" stroke-width=\"1.4\" fill=\"none\"><path d=\"M17 18l-7-4-3 5M17 21l-9 0-2 5M17 23l-7 4-1 6M23 18l7-4 3 5M23 21l9 0 2 5M23 23l7 4 1 6\"/></g><ellipse cx=\"20\" cy=\"21\" rx=\"5\" ry=\"6\" fill=\"#111\"/><circle cx=\"20\" cy=\"15\" r=\"3\" fill=\"#111\"/><circle cx=\"19\" cy=\"14.5\" r=\".7\" fill=\"#ff3b3b\"/><circle cx=\"21\" cy=\"14.5\" r=\".7\" fill=\"#ff3b3b\"/></svg>", "gorro": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 40 40\"><path d=\"M7 31C9 17 17 7 28 8c4 .4 6 4 4 8-2-2-4-2-5 0 0 6-1 11-1 15z\" fill=\"#d42a3c\"/><path d=\"M14 14c4-5 9-6 13-5\" stroke=\"#ef4655\" stroke-width=\"2\" fill=\"none\" stroke-linecap=\"round\"/><rect x=\"4\" y=\"28\" width=\"26\" height=\"8\" rx=\"4\" fill=\"#fff\"/><circle cx=\"33\" cy=\"17\" r=\"4.5\" fill=\"#fff\"/></svg>", "uvas": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 40 40\"><path d=\"M20 9V4M20 7c3-4 8-4 10-2-3 3-7 3-10 2z\" stroke=\"#3c7a2a\" stroke-width=\"2\" fill=\"#5aa63a\" stroke-linecap=\"round\"/><g fill=\"#8bc34a\" stroke=\"#4e7f21\" stroke-width=\"1\"><circle cx=\"13\" cy=\"13\" r=\"4.3\"/><circle cx=\"21.5\" cy=\"12\" r=\"4.3\"/><circle cx=\"29\" cy=\"14\" r=\"4.3\"/><circle cx=\"17\" cy=\"20\" r=\"4.3\"/><circle cx=\"25.5\" cy=\"20.5\" r=\"4.3\"/><circle cx=\"12\" cy=\"22\" r=\"4\"/><circle cx=\"21\" cy=\"27.5\" r=\"4.2\"/><circle cx=\"29\" cy=\"26\" r=\"3.8\"/><circle cx=\"16\" cy=\"30\" r=\"3.8\"/><circle cx=\"22\" cy=\"35\" r=\"3.6\"/></g><g fill=\"#fff\" opacity=\".55\"><circle cx=\"11.5\" cy=\"11.5\" r=\"1.2\"/><circle cx=\"20\" cy=\"10.5\" r=\"1.2\"/><circle cx=\"15.5\" cy=\"18.5\" r=\"1.2\"/><circle cx=\"24\" cy=\"19\" r=\"1.2\"/><circle cx=\"19.5\" cy=\"26\" r=\"1.2\"/></g></svg>", "copa": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 40 40\"><path d=\"M13 4h14l-1 11c-.5 5-3 8-6 8s-5.500-3-6-8z\" fill=\"#f5c518\" fill-opacity=\".35\" stroke=\"#f1e3b0\" stroke-width=\"1.8\" stroke-linejoin=\"round\"/><path d=\"M13.6 11h12.8l-.4 4c-.5 4.500-2.800 7-6 7s-5.500-2.500-6-7z\" fill=\"#f5c518\"/><path d=\"M20 23v11M14 36h12\" stroke=\"#f1e3b0\" stroke-width=\"2.2\" stroke-linecap=\"round\"/><g fill=\"#fff\"><circle cx=\"18\" cy=\"16\" r=\".9\"/><circle cx=\"21.5\" cy=\"13.5\" r=\".8\"/><circle cx=\"20\" cy=\"19\" r=\".7\"/></g><g stroke=\"#f5c518\" stroke-width=\"1.6\" stroke-linecap=\"round\"><path d=\"M30 6l3-2M31 10h4M29 2l1-1\"/></g></svg>", "reloj": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 40 40\"><circle cx=\"20\" cy=\"21\" r=\"15\" fill=\"#fff7e0\" stroke=\"#e2b74a\" stroke-width=\"3\"/><g stroke=\"#7a5a12\" stroke-width=\"1.6\" stroke-linecap=\"round\"><path d=\"M20 8.5v3M20 30.5v3M7.5 21h3M29.5 21h3\"/></g><path d=\"M20 21V11.5M20 21l-.8-6\" stroke=\"#1a1a1a\" stroke-width=\"2.4\" stroke-linecap=\"round\"/><circle cx=\"20\" cy=\"21\" r=\"1.8\" fill=\"#d42a3c\"/><path d=\"M14 5.500l-3-2.500M26 5.500l3-2.500\" stroke=\"#e2b74a\" stroke-width=\"2.4\" stroke-linecap=\"round\"/></svg>", "serpentina": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 40 40\"><path d=\"M1.4 3.6L1.4 5.1L6.2 5.8L6.6 4.4zM1.4 5.2L1.8 6.6L5.4 7.1L6.2 5.7zM1.8 6.7L2.5 8.1L4.5 8.3L5.5 7zM2.5 8.2L3.2 9.5L3.8 9.5L4.5 8.2zM9.1 14.5L10.5 15.2L10.5 13.2L9.1 13.9zM10.5 15.2L12 16L11.8 12.3L10.4 13.2zM12.1 15.9L13.6 16.4L13.2 11.6L11.8 12.3zM13.6 16.4L15 16.5L14.6 11.3L13.2 11.6zM15 16.5L16.4 16.2L16.1 11.4L14.7 11.3zM16.3 16.2L17.6 15.6L17.6 12L16.2 11.4zM17.5 15.6L18.8 14.9L18.9 12.9L17.7 12zM18.7 14.8L19.9 14.4L20 13.8L19 12.9zM22.8 21.1L22 22.4L23.9 22.7L23.4 21.2zM22 22.4L20.9 23.7L24.6 24.3L23.9 22.7zM20.9 23.7L20.2 25.1L24.9 25.8L24.6 24.3zM20.2 25.2L19.8 26.5L24.9 27.2L24.9 25.7zM19.8 26.7L19.9 28L24.7 28.4L25 27.1zM19.9 28.2L20.4 29.5L24.1 29.5L24.7 28.2zM20.4 29.7L21.4 30.7L23.4 30.5L24.1 29.2zM21.4 30.9L22.4 31.7L23 31.5L23.4 30.3zM30.7 34.4L32.2 35L32 33L30.6 33.8zM32.2 35L33.7 35.7L33.4 32.1L32 33zM33.7 35.7L35.1 36.2L34.9 31.4L33.5 32zM35 36.2L36.4 36.4L36.3 31.2L35 31.4z\" fill=\"#ffd23f\" stroke=\"#ffd23f\" stroke-width=\".3\" stroke-linejoin=\"round\"/><path d=\"M3.2 9.5L2.7 10.7L4.6 10.5L3.8 9.4zM2.7 10.9L2.2 12.1L5.7 11.1L4.6 10.3zM2.3 12.5L2.3 13.6L6.5 11.3L5.5 10.7zM2.6 14.1L3.1 14.9L6.9 11.3L6.1 10.8zM3.6 15.3L4.5 15.6L7.1 11.5L6.4 10.9zM5 15.8L6.2 15.7L7.4 12.2L6.6 11.3zM6.4 15.7L7.7 15.1L8.1 13.2L7.1 12.1zM7.8 15.1L9.1 14.5L9.2 13.9L8 13.1zM19.9 14.4L20.6 15.4L21.3 13.5L20.1 13.8zM20.4 15.3L20.8 16.5L22.7 13.4L21.5 13.6zM20.4 16.2L20.6 17.2L24.1 13.9L23.1 13.7zM20.3 16.7L20.5 17.7L25.1 15.2L24.5 14.4zM20.3 17.1L20.8 18.1L25.4 16.7L25.3 15.7zM20.7 17.7L21.4 18.8L25.1 18.3L25.5 17.1zM21.4 18.5L22.2 19.8L24.2 19.8L25.1 18.5zM22.2 19.7L22.8 21.1L23.4 21.2L24.2 19.9zM22.4 31.7L22.3 32.9L24 31.9L23 31.4zM22.4 33.1L22.4 34.3L25.1 31.8L23.9 31.7zM22.8 34.6L23.3 35.6L25.8 31.5L24.7 31.5zM23.7 35.8L24.6 36.4L26.4 31.5L25.4 31.3zM25.1 36.5L26.2 36.5L27.1 31.8L26 31.4zM26.5 36.5L27.8 36L28 32.4L26.8 31.7zM27.9 36L29.3 35.2L29.2 33.2L27.9 32.4zM29.3 35.2L30.7 34.4L30.6 33.8L29.2 33.2z\" fill=\"#d9a300\" stroke=\"#d9a300\" stroke-width=\".3\" stroke-linejoin=\"round\"/><path d=\"M20.1 2.8L20.1 3.7L23.7 4.1L23.9 3.2zM20.1 3.8L20.4 4.7L23.3 5L23.7 4.1zM20.4 4.8L20.8 5.7L22.7 5.8L23.3 4.9zM20.8 5.8L21.5 6.6L22.1 6.6L22.7 5.7zM21.5 6.6L21.6 7.4L22.2 7.3L22.1 6.5zM27.3 11.1L28.1 11.9L28.4 10L27.4 10.5zM28.1 11.9L29 12.5L29.4 9.6L28.4 10zM29 12.5L29.8 12.9L30.4 9.4L29.4 9.6zM29.8 12.9L30.6 13.2L31.3 9.5L30.4 9.4zM30.5 13.2L31.3 13.3L32.3 9.8L31.5 9.5zM31.1 13.2L32 13.2L33 10.5L32.4 9.9zM31.8 13.1L32.7 13L33.6 11.4L33.2 10.6zM32.5 12.9L33.5 12.9L33.9 12.4L33.7 11.5zM33.4 12.8L33.8 13.4L34.3 13L33.9 12.4zM34 20.7L33.3 21.5L35.2 21.6L34.6 20.7zM33.3 21.6L32.8 22.5L35.8 22.4L35.2 21.6zM32.9 22.6L32.6 23.4L36.2 22.9L35.7 22.2zM32.7 23.7L32.8 24.4L36.4 23.4L36.1 22.7z\" fill=\"#ff6f9b\" stroke=\"#ff6f9b\" stroke-width=\".3\" stroke-linejoin=\"round\"/><path d=\"M21.6 7.4L21.2 8.3L23 7.8L22.2 7.3zM21.3 8.5L21.1 9.3L23.7 8L23 7.6zM21.3 9.6L21.4 10.3L24.2 8.1L23.6 7.8zM21.7 10.6L22.1 11.1L24.6 8.2L24 7.8zM22.4 11.3L23.1 11.5L24.9 8.4L24.3 8zM23.3 11.7L24.2 11.6L25.2 8.9L24.6 8.3zM24.3 11.7L25.3 11.4L25.8 9.6L25.1 8.9zM25.3 11.4L26.3 11L26.5 10.3L25.7 9.6zM26.3 11L27.3 11.1L27.4 10.5L26.4 10.3zM33.8 13.3L33.5 14.2L35.2 13.4L34.4 13zM33.5 14L33.2 14.9L36 14.1L35.3 13.5zM33.2 14.7L32.9 15.5L36.5 15L36 14.3zM32.9 15.3L32.8 16.1L36.6 16L36.5 15.2zM32.8 16L32.9 16.9L36.5 17L36.6 16.2zM32.9 16.8L33.2 17.8L36.1 18L36.5 17.1zM33.2 17.7L33.6 18.7L35.4 18.9L36.1 18.1zM33.6 18.7L34.1 19.7L34.7 19.8L35.4 18.9zM34.1 19.7L34 20.7L34.6 20.7L34.7 19.8z\" fill=\"#c93a68\" stroke=\"#c93a68\" stroke-width=\".3\" stroke-linejoin=\"round\"/></svg>", "confeti": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 40 40\"><rect x=\"6\" y=\"8\" width=\"7\" height=\"4\" rx=\"1\" fill=\"#f5c518\" transform=\"rotate(-25 9 10)\"/><rect x=\"24\" y=\"5\" width=\"7\" height=\"4\" rx=\"1\" fill=\"#ef4655\" transform=\"rotate(30 27 7)\"/><circle cx=\"31\" cy=\"22\" r=\"2.6\" fill=\"#3dbbf0\"/><rect x=\"12\" y=\"24\" width=\"7\" height=\"4\" rx=\"1\" fill=\"#8a5cf6\" transform=\"rotate(55 15 26)\"/><circle cx=\"20\" cy=\"15\" r=\"2.2\" fill=\"#2fb36d\"/><rect x=\"22\" y=\"31\" width=\"7\" height=\"4\" rx=\"1\" fill=\"#f08c00\" transform=\"rotate(-40 25 33)\"/><circle cx=\"8\" cy=\"33\" r=\"2.2\" fill=\"#e0479e\"/></svg>", "fuego": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 40 40\"><g stroke-linecap=\"round\" stroke-width=\"2.2\"><g stroke=\"#ffd54a\"><path d=\"M20 15V5M20 25v10M15 20H5M25 20h10\"/></g><g stroke=\"#ff6f91\"><path d=\"M16.5 16.5l-7-7M23.5 23.5l7 7M23.5 16.5l7-7M16.5 23.5l-7 7\"/></g></g><g fill=\"#fff\"><circle cx=\"20\" cy=\"3.5\" r=\"1.6\"/><circle cx=\"20\" cy=\"36.5\" r=\"1.6\"/><circle cx=\"3.5\" cy=\"20\" r=\"1.6\"/><circle cx=\"36.5\" cy=\"20\" r=\"1.6\"/></g><g fill=\"#ffd54a\"><circle cx=\"8.3\" cy=\"8.3\" r=\"1.4\"/><circle cx=\"31.7\" cy=\"31.7\" r=\"1.4\"/><circle cx=\"31.7\" cy=\"8.3\" r=\"1.4\"/><circle cx=\"8.3\" cy=\"31.7\" r=\"1.4\"/></g><circle cx=\"20\" cy=\"20\" r=\"2.5\" fill=\"#fff\"/></svg>", "corona": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 40 40\"><path d=\"M5 14l7 7 8-12 8 12 7-7-3 18H8z\" fill=\"#f5c518\" stroke=\"#b8860b\" stroke-width=\"1.6\" stroke-linejoin=\"round\"/><rect x=\"8\" y=\"30\" width=\"24\" height=\"5\" rx=\"1.5\" fill=\"#e2a90c\" stroke=\"#b8860b\" stroke-width=\"1.4\"/><circle cx=\"20\" cy=\"24\" r=\"2.6\" fill=\"#d42a3c\"/><circle cx=\"13\" cy=\"26\" r=\"1.8\" fill=\"#2f7de0\"/><circle cx=\"27\" cy=\"26\" r=\"1.8\" fill=\"#2fb36d\"/><g fill=\"#f5c518\" stroke=\"#b8860b\" stroke-width=\"1.2\"><circle cx=\"5\" cy=\"13\" r=\"2.2\"/><circle cx=\"20\" cy=\"8\" r=\"2.4\"/><circle cx=\"35\" cy=\"13\" r=\"2.2\"/></g></svg>", "caramelo": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 40 40\"><path d=\"M11 20L3 13v14zM29 20l8-7v14z\" fill=\"#e0479e\"/><ellipse cx=\"20\" cy=\"20\" rx=\"10\" ry=\"8\" fill=\"#ff7ab8\"/><path d=\"M14 14l6 12M20 13l6 12\" stroke=\"#fff\" stroke-width=\"2.2\" opacity=\".8\"/></svg>", "trineo": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 240 72\"><path d=\"M24 33q26 6 52 0q26 8 52 13\" stroke=\"#e2b74a\" stroke-width=\"1.8\" fill=\"none\" stroke-linecap=\"round\"/><g transform=\"translate(0 0)\"><path d=\"M47 37l7-3\" stroke=\"#6b3b1f\" stroke-width=\"2.2\" stroke-linecap=\"round\"/><g stroke=\"#6b3b1f\" stroke-width=\"3.2\" stroke-linecap=\"round\"><path d=\"M41 46l6 12M45 46l7 10\"/><path d=\"M22 46l-7 11M26 46l-5 12\"/></g><ellipse cx=\"33\" cy=\"41\" rx=\"16\" ry=\"8\" fill=\"#8b5a2b\"/><ellipse cx=\"33\" cy=\"45\" rx=\"11\" ry=\"3.2\" fill=\"#c79a63\"/><path d=\"M20 38L13 24l7-3 7 14z\" fill=\"#8b5a2b\"/><path d=\"M17.5 31.5l8.5-3.5 1.6 3.6-8.6 3.6z\" fill=\"#c8102e\"/><circle cx=\"22.6\" cy=\"33.6\" r=\"1.7\" fill=\"#f5c518\"/><ellipse cx=\"14\" cy=\"21\" rx=\"7\" ry=\"5\" fill=\"#8b5a2b\"/><ellipse cx=\"7.5\" cy=\"23\" rx=\"4.5\" ry=\"3.2\" fill=\"#a06c38\"/><circle cx=\"3.5\" cy=\"23\" r=\"2.6\" fill=\"#ff2d2d\"/><circle cx=\"12.5\" cy=\"19.5\" r=\"1.1\" fill=\"#1a1a1a\"/><path d=\"M19 17l5-3-1 5z\" fill=\"#6b3b1f\"/><g stroke=\"#5a3418\" stroke-width=\"1.8\" stroke-linecap=\"round\" fill=\"none\"><path d=\"M15 16l-3-9M13 11l-5-3M12.5 9l1-5\"/><path d=\"M18 16l3-9M20 11l5-2M21 9l-1-5\"/></g></g><g transform=\"translate(54 0)\"><path d=\"M47 37l7-3\" stroke=\"#6b3b1f\" stroke-width=\"2.2\" stroke-linecap=\"round\"/><g stroke=\"#6b3b1f\" stroke-width=\"3.2\" stroke-linecap=\"round\"><path d=\"M41 46l6 12M45 46l7 10\"/><path d=\"M22 46l-7 11M26 46l-5 12\"/></g><ellipse cx=\"33\" cy=\"41\" rx=\"16\" ry=\"8\" fill=\"#8b5a2b\"/><ellipse cx=\"33\" cy=\"45\" rx=\"11\" ry=\"3.2\" fill=\"#c79a63\"/><path d=\"M20 38L13 24l7-3 7 14z\" fill=\"#8b5a2b\"/><path d=\"M17.5 31.5l8.5-3.5 1.6 3.6-8.6 3.6z\" fill=\"#c8102e\"/><circle cx=\"22.6\" cy=\"33.6\" r=\"1.7\" fill=\"#f5c518\"/><ellipse cx=\"14\" cy=\"21\" rx=\"7\" ry=\"5\" fill=\"#8b5a2b\"/><ellipse cx=\"7.5\" cy=\"23\" rx=\"4.5\" ry=\"3.2\" fill=\"#a06c38\"/><circle cx=\"3.5\" cy=\"23\" r=\"2.6\" fill=\"#3a2210\"/><circle cx=\"12.5\" cy=\"19.5\" r=\"1.1\" fill=\"#1a1a1a\"/><path d=\"M19 17l5-3-1 5z\" fill=\"#6b3b1f\"/><g stroke=\"#5a3418\" stroke-width=\"1.8\" stroke-linecap=\"round\" fill=\"none\"><path d=\"M15 16l-3-9M13 11l-5-3M12.5 9l1-5\"/><path d=\"M18 16l3-9M20 11l5-2M21 9l-1-5\"/></g></g><rect x=\"190\" y=\"14\" width=\"16\" height=\"16\" rx=\"2\" fill=\"#2fb36d\"/><path d=\"M198 14v16M190 22h16\" stroke=\"#f5c518\" stroke-width=\"2.2\"/><rect x=\"203\" y=\"20\" width=\"14\" height=\"12\" rx=\"2\" fill=\"#3d6bff\"/><path d=\"M210 20v12\" stroke=\"#ff6f91\" stroke-width=\"2\"/><ellipse cx=\"200\" cy=\"34\" rx=\"14\" ry=\"9\" fill=\"#8a6a3b\"/><path d=\"M164 46v-10q0-8 9-8t9 8v10z\" fill=\"#d42a3c\"/><path d=\"M166 35l-8-2\" stroke=\"#d42a3c\" stroke-width=\"5\" stroke-linecap=\"round\"/><path d=\"M157 33q-40-14-87-11\" stroke=\"#6b3b1f\" stroke-width=\"1.2\" fill=\"none\" stroke-linecap=\"round\"/><circle cx=\"157\" cy=\"33\" r=\"2.8\" fill=\"#1a1a1a\"/><circle cx=\"173\" cy=\"21\" r=\"7.5\" fill=\"#ffd7b5\"/><circle cx=\"168.6\" cy=\"22.6\" r=\"1.7\" fill=\"#ff9e9e\" opacity=\".7\"/><circle cx=\"177.4\" cy=\"22.6\" r=\"1.7\" fill=\"#ff9e9e\" opacity=\".7\"/><path d=\"M165.5 21q0 12.5 7.5 13.5q7.5-1 7.5-13.5q-3 5-7.5 5t-7.5-5z\" fill=\"#fff\"/><ellipse cx=\"170.8\" cy=\"25\" rx=\"2.7\" ry=\"1.5\" fill=\"#fff\"/><ellipse cx=\"175.2\" cy=\"25\" rx=\"2.7\" ry=\"1.5\" fill=\"#fff\"/><circle cx=\"173\" cy=\"23.2\" r=\"1.5\" fill=\"#f28b82\"/><circle cx=\"170.4\" cy=\"19.6\" r=\"1\" fill=\"#1a1a1a\"/><circle cx=\"175.6\" cy=\"19.6\" r=\"1\" fill=\"#1a1a1a\"/><path d=\"M165.5 15q1-10 11-9.5q8 .5 11 9.5z\" fill=\"#d42a3c\"/><circle cx=\"188\" cy=\"15\" r=\"3.2\" fill=\"#fff\"/><rect x=\"164\" y=\"13\" width=\"18\" height=\"4.5\" rx=\"2.2\" fill=\"#fff\"/><path d=\"M136 40q-12-1-10 8q2 6 10 4h76q8 0 8-8V30q0-6-6-6h-4v20H140z\" fill=\"#c8102e\"/><path d=\"M142 44h66\" stroke=\"#e2b74a\" stroke-width=\"1.6\"/><path d=\"M140 55v9M206 55v9\" stroke=\"#e2b74a\" stroke-width=\"2.6\"/><path d=\"M120 58q-6 0-6 5t7 5h100q8 0 10-8\" stroke=\"#e2b74a\" stroke-width=\"3\" fill=\"none\" stroke-linecap=\"round\"/></svg>", "camellos": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 240 78\"><g transform=\"translate(0 0)\"><path d=\"M11 42q-4 5-3 11\" stroke=\"#a87b45\" stroke-width=\"1.6\" fill=\"none\" stroke-linecap=\"round\"/><ellipse cx=\"8\" cy=\"54\" rx=\"1.6\" ry=\"2.4\" fill=\"#8a5f30\"/><g stroke=\"#b98a52\" stroke-width=\"3.6\" stroke-linecap=\"round\" fill=\"none\"><path d=\"M17 48l-1 12 2 13\"/><path d=\"M24 49l1 12-1 12\"/><path d=\"M48 49l1 12-2 12\"/><path d=\"M54 48l2 12-1 13\"/></g><g fill=\"#7a5328\"><ellipse cx=\"18\" cy=\"74\" rx=\"2.6\" ry=\"1.2\"/><ellipse cx=\"24\" cy=\"74\" rx=\"2.6\" ry=\"1.2\"/><ellipse cx=\"47\" cy=\"74\" rx=\"2.6\" ry=\"1.2\"/><ellipse cx=\"55\" cy=\"74\" rx=\"2.6\" ry=\"1.2\"/></g><path d=\"M10 43c0-7 6-10 12-10 3-11 19-12 22 0 7 0 14 4 14 11s-6 9-12 9H18c-5 0-8-4-8-10z\" fill=\"#d2a26a\"/><path d=\"M16 49q16 5 34 0\" stroke=\"#e6c08c\" stroke-width=\"3\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M52 39c7-2 9-9 10-17l7-1c0 10-3 21-13 26z\" fill=\"#d2a26a\"/><path d=\"M61 22c0-5 4-8 9-7l7 2c2.5 1 2.5 4.500 0 5.500l-7 2.500c-4 1.200-9 .500-9-3z\" fill=\"#d2a26a\"/><circle cx=\"68\" cy=\"18.5\" r=\"1.2\" fill=\"#2a1a0a\"/><path d=\"M66.5 16.8q1.5-1 3-.3\" stroke=\"#2a1a0a\" stroke-width=\".8\" fill=\"none\"/><path d=\"M64 15.5l-1.5-4 3.5 2.500z\" fill=\"#b98a52\"/><circle cx=\"76.5\" cy=\"19.5\" r=\".8\" fill=\"#5a3a18\"/><path d=\"M71 23.5q3 .8 6-.5\" stroke=\"#8a5f30\" stroke-width=\".9\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M20 34q14-11 28 0l-2 10H22z\" fill=\"#3d6bff\"/><path d=\"M22 44h24\" stroke=\"#f5c518\" stroke-width=\"2.2\" stroke-dasharray=\"1.6 1.6\"/><path d=\"M24 37q10-4 20 0\" stroke=\"#f5c518\" stroke-width=\"1.2\" fill=\"none\"/><path d=\"M27 37l2-13q5-3 10 0l2 13z\" fill=\"#c8102e\"/><path d=\"M34 24.5v12.5\" stroke=\"#f5c518\" stroke-width=\"1.2\"/><path d=\"M38 27q5 1 7 .5\" stroke=\"#c8102e\" stroke-width=\"3.6\" stroke-linecap=\"round\"/><rect x=\"43\" y=\"23\" width=\"6.500\" height=\"6\" rx=\"1\" fill=\"#f5c518\" stroke=\"#b8860b\" stroke-width=\".6\"/><path d=\"M46.2 23v6\" stroke=\"#d42a3c\" stroke-width=\"1\"/><circle cx=\"34\" cy=\"13.5\" r=\"6\" fill=\"#ffd7b5\"/><path d=\"M28.2 12q-.6-5.500 5.800-6.200q6.400.7 5.800 6.200q-1-2-1.800-2.500v3h-8v-3q-.8.5-1.800 2.500z\" fill=\"#f2f2f2\"/><circle cx=\"30.6\" cy=\"15.6\" r=\"1.4\" fill=\"#ff9e9e\" opacity=\".55\"/><circle cx=\"37.4\" cy=\"15.6\" r=\"1.4\" fill=\"#ff9e9e\" opacity=\".55\"/><path d=\"M28 15.5q0 11 6 12q6-1 6-12q-2.5 4-6 4t-6-4z\" fill=\"#ffffff\"/><circle cx=\"31.8\" cy=\"13\" r=\".95\" fill=\"#1a1a1a\"/><circle cx=\"36.2\" cy=\"13\" r=\".95\" fill=\"#1a1a1a\"/><path d=\"M32.4 17.4q1.6.9 3.2 0\" stroke=\"#5a2a1a\" stroke-width=\".7\" fill=\"none\" stroke-linecap=\"round\" opacity=\".6\"/><path d=\"M28.5 8.5l1.2-6 2.4 3 1.9-4.200 1.9 4.200 2.4-3 1.2 6z\" fill=\"#f5c518\" stroke=\"#b8860b\" stroke-width=\".6\" stroke-linejoin=\"round\"/><rect x=\"28.3\" y=\"7.6\" width=\"11.4\" height=\"2.4\" rx=\".8\" fill=\"#e2a90c\"/><circle cx=\"34\" cy=\"8.8\" r=\".9\" fill=\"#d42a3c\"/></g><g transform=\"translate(80 0)\"><path d=\"M11 42q-4 5-3 11\" stroke=\"#a87b45\" stroke-width=\"1.6\" fill=\"none\" stroke-linecap=\"round\"/><ellipse cx=\"8\" cy=\"54\" rx=\"1.6\" ry=\"2.4\" fill=\"#8a5f30\"/><g stroke=\"#b98a52\" stroke-width=\"3.6\" stroke-linecap=\"round\" fill=\"none\"><path d=\"M17 48l-1 12 2 13\"/><path d=\"M24 49l1 12-1 12\"/><path d=\"M48 49l1 12-2 12\"/><path d=\"M54 48l2 12-1 13\"/></g><g fill=\"#7a5328\"><ellipse cx=\"18\" cy=\"74\" rx=\"2.6\" ry=\"1.2\"/><ellipse cx=\"24\" cy=\"74\" rx=\"2.6\" ry=\"1.2\"/><ellipse cx=\"47\" cy=\"74\" rx=\"2.6\" ry=\"1.2\"/><ellipse cx=\"55\" cy=\"74\" rx=\"2.6\" ry=\"1.2\"/></g><path d=\"M10 43c0-7 6-10 12-10 3-11 19-12 22 0 7 0 14 4 14 11s-6 9-12 9H18c-5 0-8-4-8-10z\" fill=\"#d2a26a\"/><path d=\"M16 49q16 5 34 0\" stroke=\"#e6c08c\" stroke-width=\"3\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M52 39c7-2 9-9 10-17l7-1c0 10-3 21-13 26z\" fill=\"#d2a26a\"/><path d=\"M61 22c0-5 4-8 9-7l7 2c2.5 1 2.5 4.500 0 5.500l-7 2.500c-4 1.200-9 .500-9-3z\" fill=\"#d2a26a\"/><circle cx=\"68\" cy=\"18.5\" r=\"1.2\" fill=\"#2a1a0a\"/><path d=\"M66.5 16.8q1.5-1 3-.3\" stroke=\"#2a1a0a\" stroke-width=\".8\" fill=\"none\"/><path d=\"M64 15.5l-1.5-4 3.5 2.500z\" fill=\"#b98a52\"/><circle cx=\"76.5\" cy=\"19.5\" r=\".8\" fill=\"#5a3a18\"/><path d=\"M71 23.5q3 .8 6-.5\" stroke=\"#8a5f30\" stroke-width=\".9\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M20 34q14-11 28 0l-2 10H22z\" fill=\"#d42a3c\"/><path d=\"M22 44h24\" stroke=\"#f5c518\" stroke-width=\"2.2\" stroke-dasharray=\"1.6 1.6\"/><path d=\"M24 37q10-4 20 0\" stroke=\"#f5c518\" stroke-width=\"1.2\" fill=\"none\"/><path d=\"M27 37l2-13q5-3 10 0l2 13z\" fill=\"#2fb36d\"/><path d=\"M34 24.5v12.5\" stroke=\"#f5c518\" stroke-width=\"1.2\"/><path d=\"M38 27q5 1 7 .5\" stroke=\"#2fb36d\" stroke-width=\"3.6\" stroke-linecap=\"round\"/><path d=\"M43.500 29h6l-.8-4.500h-4.400z\" fill=\"#e2b74a\" stroke=\"#9a6a10\" stroke-width=\".6\"/><path d=\"M44.700 24.500q1.500-2.500 3.600 0\" fill=\"#e2b74a\" stroke=\"#9a6a10\" stroke-width=\".6\"/><path d=\"M46.500 21q1-1.500 0-3\" stroke=\"#ddd\" stroke-width=\".8\" fill=\"none\" stroke-linecap=\"round\"/><circle cx=\"34\" cy=\"13.5\" r=\"6\" fill=\"#f6c9a0\"/><path d=\"M28.2 12q-.6-5.500 5.800-6.200q6.400.7 5.800 6.200q-1-2-1.800-2.500v3h-8v-3q-.8.5-1.800 2.500z\" fill=\"#9a6a3a\"/><circle cx=\"30.6\" cy=\"15.6\" r=\"1.4\" fill=\"#ff9e9e\" opacity=\".55\"/><circle cx=\"37.4\" cy=\"15.6\" r=\"1.4\" fill=\"#ff9e9e\" opacity=\".55\"/><path d=\"M28.5 16q.5 6.5 5.5 7q5-.5 5.5-7q-2.5 3.2-5.5 3.2t-5.5-3.2z\" fill=\"#9a6a3a\"/><circle cx=\"31.8\" cy=\"13\" r=\".95\" fill=\"#1a1a1a\"/><circle cx=\"36.2\" cy=\"13\" r=\".95\" fill=\"#1a1a1a\"/><path d=\"M32.4 17.4q1.6.9 3.2 0\" stroke=\"#1a1a1a\" stroke-width=\".7\" fill=\"none\" stroke-linecap=\"round\" opacity=\".6\"/><path d=\"M28.5 8.5l1.2-6 2.4 3 1.9-4.200 1.9 4.200 2.4-3 1.2 6z\" fill=\"#f5c518\" stroke=\"#b8860b\" stroke-width=\".6\" stroke-linejoin=\"round\"/><rect x=\"28.3\" y=\"7.6\" width=\"11.4\" height=\"2.4\" rx=\".8\" fill=\"#e2a90c\"/><circle cx=\"34\" cy=\"8.8\" r=\".9\" fill=\"#d42a3c\"/></g><g transform=\"translate(160 0)\"><path d=\"M11 42q-4 5-3 11\" stroke=\"#a87b45\" stroke-width=\"1.6\" fill=\"none\" stroke-linecap=\"round\"/><ellipse cx=\"8\" cy=\"54\" rx=\"1.6\" ry=\"2.4\" fill=\"#8a5f30\"/><g stroke=\"#b98a52\" stroke-width=\"3.6\" stroke-linecap=\"round\" fill=\"none\"><path d=\"M17 48l-1 12 2 13\"/><path d=\"M24 49l1 12-1 12\"/><path d=\"M48 49l1 12-2 12\"/><path d=\"M54 48l2 12-1 13\"/></g><g fill=\"#7a5328\"><ellipse cx=\"18\" cy=\"74\" rx=\"2.6\" ry=\"1.2\"/><ellipse cx=\"24\" cy=\"74\" rx=\"2.6\" ry=\"1.2\"/><ellipse cx=\"47\" cy=\"74\" rx=\"2.6\" ry=\"1.2\"/><ellipse cx=\"55\" cy=\"74\" rx=\"2.6\" ry=\"1.2\"/></g><path d=\"M10 43c0-7 6-10 12-10 3-11 19-12 22 0 7 0 14 4 14 11s-6 9-12 9H18c-5 0-8-4-8-10z\" fill=\"#d2a26a\"/><path d=\"M16 49q16 5 34 0\" stroke=\"#e6c08c\" stroke-width=\"3\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M52 39c7-2 9-9 10-17l7-1c0 10-3 21-13 26z\" fill=\"#d2a26a\"/><path d=\"M61 22c0-5 4-8 9-7l7 2c2.5 1 2.5 4.500 0 5.500l-7 2.500c-4 1.200-9 .500-9-3z\" fill=\"#d2a26a\"/><circle cx=\"68\" cy=\"18.5\" r=\"1.2\" fill=\"#2a1a0a\"/><path d=\"M66.5 16.8q1.5-1 3-.3\" stroke=\"#2a1a0a\" stroke-width=\".8\" fill=\"none\"/><path d=\"M64 15.5l-1.5-4 3.5 2.500z\" fill=\"#b98a52\"/><circle cx=\"76.5\" cy=\"19.5\" r=\".8\" fill=\"#5a3a18\"/><path d=\"M71 23.5q3 .8 6-.5\" stroke=\"#8a5f30\" stroke-width=\".9\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M20 34q14-11 28 0l-2 10H22z\" fill=\"#f08c00\"/><path d=\"M22 44h24\" stroke=\"#f5c518\" stroke-width=\"2.2\" stroke-dasharray=\"1.6 1.6\"/><path d=\"M24 37q10-4 20 0\" stroke=\"#f5c518\" stroke-width=\"1.2\" fill=\"none\"/><path d=\"M27 37l2-13q5-3 10 0l2 13z\" fill=\"#7a2a8e\"/><path d=\"M34 24.5v12.5\" stroke=\"#f5c518\" stroke-width=\"1.2\"/><path d=\"M38 27q5 1 7 .5\" stroke=\"#7a2a8e\" stroke-width=\"3.6\" stroke-linecap=\"round\"/><path d=\"M44 28.500q-.500-4 2.700-4.500q3.200.500 2.700 4.500z\" fill=\"#b48ad8\" stroke=\"#6b3f8a\" stroke-width=\".6\"/><rect x=\"45.300\" y=\"22.300\" width=\"2.800\" height=\"2\" rx=\".5\" fill=\"#f5c518\"/><circle cx=\"34\" cy=\"13.5\" r=\"6\" fill=\"#7a4a2a\"/><path d=\"M28.2 12q-.6-5.500 5.800-6.200q6.400.7 5.800 6.200q-1-2-1.800-2.500v3h-8v-3q-.8.5-1.800 2.500z\" fill=\"#1a1a1a\"/><circle cx=\"30.6\" cy=\"15.6\" r=\"1.4\" fill=\"#ff9e9e\" opacity=\".55\"/><circle cx=\"37.4\" cy=\"15.6\" r=\"1.4\" fill=\"#ff9e9e\" opacity=\".55\"/><path d=\"M28.5 16q.5 6.5 5.5 7q5-.5 5.5-7q-2.5 3.2-5.5 3.2t-5.5-3.2z\" fill=\"#1a1a1a\"/><circle cx=\"31.8\" cy=\"13\" r=\".95\" fill=\"#1a1a1a\"/><circle cx=\"36.2\" cy=\"13\" r=\".95\" fill=\"#1a1a1a\"/><path d=\"M32.4 17.4q1.6.9 3.2 0\" stroke=\"#1a1a1a\" stroke-width=\".7\" fill=\"none\" stroke-linecap=\"round\" opacity=\".6\"/><path d=\"M28.5 8.5l1.2-6 2.4 3 1.9-4.200 1.9 4.200 2.4-3 1.2 6z\" fill=\"#f5c518\" stroke=\"#b8860b\" stroke-width=\".6\" stroke-linejoin=\"round\"/><rect x=\"28.3\" y=\"7.6\" width=\"11.4\" height=\"2.4\" rx=\".8\" fill=\"#e2a90c\"/><circle cx=\"34\" cy=\"8.8\" r=\".9\" fill=\"#d42a3c\"/></g></svg>"};
const FIESTA = {
  navidad: { cosas: ['copo', 'regalo', 'copo', 'arbol', 'estrella', 'copo'], modo: 'caer', giro: 360, saludo: '🎄 ¡Feliz Navidad!', sub: 'BusSev se viste de fiesta hasta Reyes.' },
  semanasanta: { cosas: ['escudo1', 'escudo2', 'escudo3', 'escudo4', 'escudo5'], img: 'escudos', modo: 'caer', giro: 20, saludo: '✝️ Semana Santa en Sevilla', sub: 'Muchas líneas cambian de recorrido: mira los avisos de TUSSAM.' },
  feria: { cosas: ['💃', 'abanico', 'sombrero', '💃', 'castanuelas', 'farolillo'], modo: 'mecer', giro: 30, saludo: '💃 ¡Feliz Feria de Abril!', sub: 'Las lanzaderas al Real salen en los avisos de TUSSAM.' },
  halloween: { cosas: ['murcielago', 'calabaza', 'fantasma', 'murcielago', 'arana', 'calabaza'], modo: 'volar', giro: 20, saludo: '🎃 ¡Feliz Halloween!', sub: 'Cuidado con los murciélagos de la parada…' },
};
/* Días especiales de Navidad. «cruza»: un dibujo grande que cruza la pantalla de vez en cuando (el trineo de
   Papá Noel, los camellos de los Reyes); «fuegos»: fuegos artificiales que estallan aquí y allá. */
const FIESTA_DIAS = {
  papanoel: { cosas: ['copo', 'regalo', 'gorro', 'copo', 'estrella', 'regalo'], modo: 'caer', giro: 360, cruza: 'trineo', haciaIzq: true,
    saludo: '🎅 ¡Feliz Navidad!', sub: 'Papá Noel ya ha pasado por Sevilla repartiendo regalos… en trineo, que el bus iba lleno.' },
  nochevieja: { cosas: ['uvas', 'copa', 'reloj', 'serpentina', 'uvas', 'confeti'], modo: 'caer', giro: 40, fuegos: true,
    saludo: '🍇 ¡Feliz Nochevieja!', sub: 'Ten preparadas las doce uvas. Y si sales esta noche, mira antes los avisos de TUSSAM.' },
  anonuevo: { cosas: ['confeti', 'serpentina', 'estrella', 'confeti', 'copa', 'fuego'], modo: 'caer', giro: 360, fuegos: true,
    saludo: () => `🎆 ¡Feliz Año Nuevo ${new Date().getMonth() === 0 ? new Date().getFullYear() : new Date().getFullYear() + 1}!`, sub: 'Que este año todos los autobuses lleguen a su hora.' },
  reyes: { cosas: ['corona', 'estrella', 'regalo', 'caramelo', 'corona', 'regalo'], modo: 'caer', giro: 30, cruza: 'camellos',
    saludo: '👑 ¡Felices Reyes!', sub: 'Sus Majestades de Oriente ya han dejado los regalos. ¡Que os hayan traído mucho y poco carbón!' },
};
function fiesta(tem, dia = null) {
  let capa = document.getElementById('fiesta');
  const f = (dia && FIESTA_DIAS[dia]) || FIESTA[tem];
  const clave = `${tem}|${dia || ''}`;
  const cielo = document.getElementById('fiesta-cielo');
  if (!f || quieto()) { capa?.remove(); cielo?.remove(); return; }
  if (capa?.dataset.t === clave) return;
  capa?.remove(); cielo?.remove();
  capa = document.createElement('div');
  capa.id = 'fiesta'; capa.className = `fiesta f-${f.modo}`; capa.dataset.t = clave; capa.setAttribute('aria-hidden', 'true');
  const n = 11;
  let h = '';
  for (let i = 0; i < n; i++) {
    const c = f.cosas[i % f.cosas.length];
    const x = Math.round((i + Math.random() * 0.8) * (100 / n));
    const dur = (11 + Math.random() * 9).toFixed(1), del = (-Math.random() * 20).toFixed(1), tam = Math.round(22 + Math.random() * 16);
    const dx = Math.round(Math.random() * 80 - 40), r = Math.round((Math.random() * 2 - 1) * f.giro);
    const dentro = f.img ? `<img class="fiesta-img" src="/img/${f.img}/${c}.webp" alt="" loading="lazy">` : (PIEZAS[c] || c);
    h += `<span style="left:${x}%;font-size:${Math.round(tam * 0.8)}px;width:${tam}px;height:${tam}px;animation-duration:${dur}s;animation-delay:${del}s;--dx:${dx}px;--r:${r}deg">${dentro}</span>`;
  }
  if (f.fuegos) for (let i = 0; i < 5; i++) {
    h += `<i class="f-fuego" style="left:${Math.round(8 + Math.random() * 78)}%;top:${Math.round(10 + Math.random() * 45)}%;animation-delay:${(i * 1.3 + Math.random()).toFixed(1)}s;--c:${['#ffd54a', '#ff6f91', '#7fe0ff', '#b7ff6a', '#ffffff'][i]}">${PIEZAS.fuego}</i>`;
  }
  capa.innerHTML = h;
  // Detrás del contenido: se ve en los huecos, no tapa los textos
  (document.querySelector('main') || document.body).prepend(capa);
  // El trineo de Papá Noel y los camellos de los Reyes cruzan por la barra de arriba, por DELANTE (para que se
  // vean bien) pero sin tapar nunca los tiempos ni las paradas; los toques pasan a través.
  const barra = document.querySelector('.topbar');
  if (f.cruza && barra) {
    const c = document.createElement('div');
    c.id = 'fiesta-cielo'; c.setAttribute('aria-hidden', 'true');
    c.innerHTML = `<div class="f-cruza${f.haciaIzq ? ' izq' : ''}">${PIEZAS[f.cruza]}</div>`;
    barra.append(c);
  }
}
function saludoFiestaHTML() {
  const tem = tematicaActiva();
  const dia = diaEspecial();
  const f = (dia && FIESTA_DIAS[dia]) || FIESTA[tem];
  if (!f) return '';
  if (dia) return `<div class="saludo-fiesta"><b>${typeof f.saludo === 'function' ? f.saludo() : f.saludo}</b><span>${f.sub}</span></div>`;
  const especial = tem === 'feria' || tem === 'semanasanta';
  return `<div class="saludo-fiesta"><b>${f.saludo}</b><span>${f.sub}</span>${especial ? `<a class="sf-btn" href="#avisos">${busIco()} Ver servicios especiales de ${tem === 'feria' ? 'Feria' : 'Semana Santa'}</a>` : ''}</div>`;
}
darkMQ.addEventListener?.('change', () => { if (settings.theme === 'auto') applyTheme(); });
const animMs = (ms) => (quieto() ? 0 : ms);
const vibrar = (ms) => { if (settings.vibrar) navigator.vibrate?.(ms); };
/* Cambia el contenido solo si ha cambiado (evita parpadeos y trabajo de más) */
function setHTML(el, html) { if (el && el.__h !== html) { el.innerHTML = html; el.__h = html; } }

const REFRESH_LINE_MIN = 30_000;
const SEVILLA = [37.3891, -5.9845];

/* ================================================================== */
/* Utilidades                                                          */
/* ================================================================== */
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
/* El azul marino de TUSSAM (líneas 10 a 52, entre otras) es tan oscuro que casi no se distingue del fondo
   oscuro ni en el mapa: en toda la app se pinta con un azul algo más claro. Todo color de línea pasa por aquí. */
const AZUL_LINEAS = '#1c38a8';
const safeColor = (c, d = '#d41c2b') => (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(String(c || '')) ? (/^#000d6f$/i.test(c) ? AZUL_LINEAS : c) : d);
function fmtDist(m) {
  if (m == null || Number.isNaN(m)) return '';
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  return `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}
const fmtClock = (d = new Date()) => d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const fmtEuro = (n) => `${n.toFixed(2).replace('.', ',')} €`;
function textOn(hex) {
  const h = safeColor(hex, '#000000').replace('#', '');
  const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? '#111111' : '#ffffff';
}
function haversine(a, b) {
  const R = 6371000, toR = Math.PI / 180;
  const dLat = (b[0] - a[0]) * toR, dLon = (b[1] - a[1]) * toR;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * toR) * Math.cos(b[0] * toR) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
}
const isNative = () => !!window.Capacitor?.isNativePlatform?.();
function openWeb(url) {
  // Por seguridad solo se abren páginas web cifradas (https): nunca otro tipo de enlace, venga de donde venga.
  try { if (new URL(String(url)).protocol !== 'https:') return; } catch { return; }
  // Dentro de la app (pestaña del navegador encima de BusSev); si no se puede, en el navegador.
  if (window.Capacitor?.isPluginAvailable?.('Browser')) {
    window.Capacitor.nativePromise('Browser', 'open', { url, toolbarColor: '#1c1d21' }).catch(() => { location.href = url; });
  } else location.href = url;
}

/* Descargar la actualización: abre GitHub y, al volver a la app (tras bajar/instalar el APK),
   cierra esa pestaña del navegador para que no se quede abierta y vuelva a descargar al reabrirla. */
function descargarApp(url) {
  // La descarga por la API (repositorio privado) no se puede abrir en el navegador: se abre la página de versiones
  if (/^https:\/\/api\.github\.com\//.test(String(url))) url = actualizaciones.paginaVersiones() || url;
  openWeb(url);
  const onVis = () => {
    if (document.visibilityState !== 'visible') return;
    document.removeEventListener('visibilitychange', onVis);
    setTimeout(() => { try { window.Capacitor?.nativePromise?.('Browser', 'close', {}); } catch { /* */ } }, 300);
  };
  document.addEventListener('visibilitychange', onVis);
}

const ICON = {
  chev: '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  arriba: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  abajo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  mas: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="2.2"/><circle cx="12" cy="12" r="2.2"/><circle cx="12" cy="19" r="2.2"/></svg>',
  expand: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="10" r="2.3" fill="currentColor"/></svg>',
  bus: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="15" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4 11h16M8 21v-3M16 21v-3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="8" cy="14.5" r="1.1" fill="currentColor"/><circle cx="16" cy="14.5" r="1.1" fill="currentColor"/></svg>',
  off: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0M3 3l18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="19" r="1.3" fill="currentColor"/></svg>',
  nfc: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 7.5a6.5 6.5 0 0 1 0 9M9.8 5a10 10 0 0 1 0 14M13 2.8a13 13 0 0 1 0 18.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><rect x="15.5" y="6" width="6" height="12" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  actualizar: '<svg class="ico-upd" viewBox="0 0 24 24" aria-hidden="true"><path d="M19.8 13.4A8 8 0 0 1 5.6 16.8M4.2 10.6A8 8 0 0 1 18.4 7.2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M18.9 3v4.4h-4.4M5.1 21v-4.4h4.4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  route: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="6" r="2.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="18" r="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8.5 6H15a3.5 3.5 0 0 1 0 7H9a3.5 3.5 0 0 0 0 7h6.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  silla: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="4" r="2" fill="currentColor"/><path d="M10 6.5v4.5h4.5l2.5 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M14.8 15.5A5 5 0 1 1 9 11.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
};

/* ================================================================== */
/* Datos                                                               */
/* ================================================================== */
class ApiError extends Error { constructor(msg, status) { super(msg); this.status = status; } }
async function api(path, { timeout, prioridad, maxEdad } = {}) {
  // Las consultas de tiempos esperan su turno en la fila (ver backend.js): el límite es más largo
  timeout ??= /\/tiempos$/.test(path) ? 50000 : 12000;
  let t;
  try {
    return await Promise.race([
      window.BusSevBackend.get(path, { prioridad, maxEdad }),
      new Promise((_, rej) => { t = setTimeout(() => rej(Object.assign(new Error('timeout'), { name: 'AbortError' })), timeout + 3000); }),
    ]);
  } catch (e) {
    if (e.status === 429) throw new ApiError('TUSSAM va saturado ahora mismo. BusSev lo vuelve a intentar solo en unos segundos.', 429);
    if (e.status === 404) throw new ApiError('No se ha encontrado.', 404);
    if (e.status === 408) throw new ApiError('Hay muchas consultas en cola. Se actualizará en un momento.', 408);
    if (e.status === 499) throw new ApiError('Cancelado', 499);
    if (e.name === 'AbortError') throw new ApiError('La conexión está tardando demasiado. Comprueba tu cobertura.');
    throw new ApiError('No hay conexión con TUSSAM. Comprueba tu conexión a internet.');
  } finally { clearTimeout(t); }
}
const cache = { paradasP: null, paradaByCode: new Map(), lineasP: null, lineaByNum: new Map(), rutas: new Map(), shapes: new Map() };
function getParadas() {
  cache.paradasP ??= api('/paradas').then((list) => { for (const p of list) cache.paradaByCode.set(p.codigo, p); return list; })
    .catch((e) => { cache.paradasP = null; throw e; });
  return cache.paradasP;
}
function getLineas() {
  cache.lineasP ??= api('/lineas').then((list) => { for (const l of list) cache.lineaByNum.set(l.numero, l); return list; })
    .catch((e) => { cache.lineasP = null; throw e; });
  return cache.lineasP;
}
function lineaFor(label) {
  const s = String(label ?? '');
  return cache.lineaByNum.get(s) || cache.lineaByNum.get(s.padStart(2, '0')) || cache.lineaByNum.get(s.replace(/^0+(?=\w)/, '')) || null;
}
/* #52 Widget de inicio: la app guarda en el widget nativo las paradas favoritas (con su nombre), para elegir
   parada al añadirlo. Las credenciales de TUSSAM ya van cifradas dentro de Android. */
function actualizarWidget() {
  try {
    if (!window.Capacitor?.isPluginAvailable?.('BusSevWidget')) return;
    const favoritas = (favs.list() || []).map((f) => ({
      codigo: String(f.codigo),
      nombre: f.alias || cache.paradaByCode.get(String(f.codigo))?.nombre || ('Parada ' + f.codigo),
      lineas: Array.isArray(f.lineas) ? f.lineas.map(String) : [],
    }));
    window.Capacitor.nativePromise('BusSevWidget', 'setConfig', {
      favoritas,   // las credenciales ya no pasan por aquí: van cifradas en Android
    }).catch(() => { /* */ });
  } catch { /* */ }
}
function getRuta(numero) {
  if (!cache.rutas.has(numero)) {
    cache.rutas.set(numero, api(`/lineas/${encodeURIComponent(numero)}/paradas`).then((stops) => {
      const by = {};
      for (const p of stops) (by[p.sentido] ??= []).push(p);
      for (const k of Object.keys(by)) by[k].sort((a, b) => a.orden - b.orden);
      return by;
    }).catch((e) => { cache.rutas.delete(numero); throw e; }));
  }
  return cache.rutas.get(numero);
}
getParadas().catch(() => null);
getLineas().catch(() => null);

/* Recorrido por calles (si está calculado) o en recta entre paradas. */
function getShape(numero, sentido, stops) {
  const key = `${numero}|${sentido}`;
  if (cache.shapes.has(key)) return cache.shapes.get(key);
  let pts, idx;
  const r = window.BUSSEV_RECORRIDOS?.[key];
  const tieneTrazado = r && Array.isArray(r.d) && r.d.length >= 4;
  if (tieneTrazado) {
    // Siempre se usa la geometría real por calle si existe.
    pts = []; let la = 0, lo = 0;
    for (let i = 0; i + 1 < r.d.length; i += 2) { la += r.d[i]; lo += r.d[i + 1]; pts.push([la / 1e5, lo / 1e5]); }
    if (Array.isArray(r.s) && r.s.length === stops.length) {
      idx = r.s;   // las paradas cuadran con las guardadas: se usan tal cual
    } else {
      // El nº de paradas en vivo no coincide con el guardado: se recoloca cada parada sobre el trazado real
      // (antes, al no coincidir, se tiraba el trazado y se dibujaban líneas rectas).
      idx = []; let desde = 0;
      for (const p of stops) {
        let best = desde, bd = Infinity;
        for (let j = desde; j < pts.length; j++) { const dd = haversine([p.latitud, p.longitud], pts[j]); if (dd < bd) { bd = dd; best = j; } }
        idx.push(best); desde = best;
      }
    }
  } else {
    pts = stops.map((p) => [p.latitud, p.longitud]);
    idx = stops.map((_, i) => i);
  }
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + haversine(pts[i - 1], pts[i]));
  const shape = { pts, idx, cum, porCalle: tieneTrazado };
  cache.shapes.set(key, shape);
  return shape;
}

/* ================================================================== */
/* Favoritas (con nombre, color y líneas a mostrar)                    */
/* ================================================================== */
const favs = {
  list() { return store.get('favs', []); },
  get(c) { return this.list().find((f) => f.codigo === c) || null; },
  has(c) { return !!this.get(c); },
  add(p) { const l = this.list(); if (!l.some((f) => f.codigo === p.codigo)) l.push({ codigo: p.codigo, nombre: p.nombre }); store.set('favs', l); },
  remove(c) { store.set('favs', this.list().filter((f) => f.codigo !== c)); },
  update(c, patch) { store.set('favs', this.list().map((f) => (f.codigo === c ? { ...f, ...patch } : f))); },
  move(c, d) {
    const l = this.list(); const i = l.findIndex((f) => f.codigo === c); const j = i + d;
    if (i < 0 || j < 0 || j >= l.length) return;
    [l[i], l[j]] = [l[j], l[i]]; store.set('favs', l);
  },
};
function filtrarLineas(tiempos, fav) {
  if (!fav?.lineas?.length) return tiempos;
  const set = new Set(fav.lineas.map((n) => lineaFor(n)?.numero || n));
  return (tiempos || []).filter((t) => set.has(lineaFor(t.linea)?.numero || t.linea));
}

/* ================================================================== */
/* Piezas de interfaz                                                  */
/* ================================================================== */
/* ---------- Actualizaciones de la app (las publica GitHub en «Releases») ---------- */
/* Novedades de los datos de TUSSAM (líneas, paradas, recorridos y horarios que han cambiado). Las calcula
   GitHub al compilar (scripts/novedades.mjs) y llegan por dos sitios: dentro de la app (/novedades.json) y,
   escondidas, en la descripción de la versión publicada (para enseñarlas ANTES de actualizar). */
const novedades = {
  valida(n) { return n && typeof n === 'object' && Array.isArray(n.grupos) && n.grupos.length ? n : null; },
  deTexto(body) {
    try {
      const b64 = String(body || '').match(/bussev-novedades:([A-Za-z0-9+/=]+)/)?.[1];
      if (!b64) return null;
      const bin = atob(b64), bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return this.valida(JSON.parse(new TextDecoder('utf-8').decode(bytes)));
    } catch { return null; }
  },
  /* Solo las que aún no has visto */
  pendientes(n) { n = this.valida(n); return n && String(n.id) !== String(store.get('novedadesVistas', '')) ? n : null; },
  html(n) {
    return `<div class="nov">${n.grupos.slice(0, 12).map((g) => `<h4>${esc(g.t)}</h4><ul>${(g.i || []).slice(0, 14).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`).join('')}</div>`;
  },
  /* Al abrir la app recién actualizada: enseña una vez lo que ha cambiado en esta versión */
  async alArrancar() {
    const build = Number(window.BUSSEV_VERSION?.build) || 0;
    if (!build) return;
    const antes = store.get('buildVisto', 0);
    let n = null;
    try { const r = await fetch('/novedades.json', { cache: 'no-store' }); if (r.ok) n = this.valida(await r.json()); } catch { /* esta versión no trae novedades */ }
    if (!antes) {   // primera vez que se abre la app: no hay nada «nuevo» que contar
      store.set('buildVisto', build); if (n) store.set('novedadesVistas', String(n.id)); return;
    }
    if (antes === build) return;
    store.set('buildVisto', build);
    const pend = this.pendientes(n);
    if (!pend) return;
    store.set('novedadesVistas', String(pend.id));
    for (let i = 0; i < 20 && document.querySelector('.modal-bg'); i++) await new Promise((ok) => setTimeout(ok, 500));
    openModal(`<h2>🚌 Novedades de esta versión</h2>
      <p class="help">BusSev se ha actualizado con los datos nuevos de TUSSAM. Esto es lo que cambia:</p>
      <div class="nov-caja">${this.html(pend)}</div>
      <div class="actions"><button class="btn" type="button" id="nov-ok">Entendido</button></div>`, (m, close) => { $('#nov-ok', m).onclick = close; });
  },
};

/* Actualizar SIN salir de la app: descarga el APK dentro de BusSev (con su barra de progreso), abre el
   instalador de Android y, al volver a abrir la app, borra lo descargado. Si el móvil no lo permite (o es la
   versión web), se hace como antes: se abre la descarga en el navegador. */
const actualizador = {
  nativo(metodo, datos = {}) { return window.Capacitor.nativePromise('Actualizador', metodo, datos); },
  /* Borra descargas antiguas (se llama al abrir la app: ahí ya está instalada la versión nueva) */
  limpiar() { if (isNative()) { try { this.nativo('limpiar').catch(() => null); } catch { /* versión sin este componente */ } } },
};
async function instalarActualizacion(url) {
  if (!isNative()) { descargarApp(url); return; }
  let cerrado = false, cerrar = () => {};
  openModal(`<h2>Actualizando BusSev</h2>
    <p class="help" id="upd-txt">Descargando la versión nueva…</p>
    <div class="upd-barra" role="progressbar" aria-valuemin="0" aria-valuemax="100"><i id="upd-prog"></i></div>
    <div class="actions"><button class="btn ghost" type="button" id="upd-cancel">Cancelar</button><button class="btn" type="button" id="upd-inst" hidden>Instalar</button></div>`, (m, close) => {
    cerrar = () => { cerrado = true; close(); };
    $('#upd-cancel', m).onclick = () => { cerrar(); actualizador.limpiar(); };
  });
  const txt = (t) => { const e = document.getElementById('upd-txt'); if (e) e.textContent = t; };
  const barra = (pc) => { const e = document.getElementById('upd-prog'); if (e) { e.style.width = `${pc}%`; e.parentElement.setAttribute('aria-valuenow', String(Math.round(pc))); } };
  const instalar = async () => {
    const r = await actualizador.nativo('instalar');
    const b = document.getElementById('upd-inst');
    if (r && r.permiso === false) {
      txt('Android pide tu permiso: activa «Permitir de esta fuente» para BusSev, vuelve atrás y pulsa Instalar.');
      if (b) { b.hidden = false; b.onclick = () => instalar().catch((e) => txt(e.message || 'No se ha podido abrir el instalador.')); }
    } else {
      txt('Se ha abierto el instalador de Android. Pulsa «Actualizar» y, al terminar, abre BusSev: lo descargado se borra solo.');
      if (b) { b.hidden = false; b.textContent = 'Instalar otra vez'; b.onclick = () => instalar().catch(() => null); }
    }
  };
  try {
    await actualizador.nativo('descargar', { url, ...(/^https:\/\/api\.github\.com\//.test(url) ? { token: actualizaciones.token() } : {}) });
    for (;;) {
      await new Promise((ok) => setTimeout(ok, 350));
      if (cerrado || !document.getElementById('upd-prog')) { actualizador.limpiar(); return; }   // cancelado o ventana cerrada
      const e = await actualizador.nativo('estado');
      if (e.error) throw new Error(e.error);
      if (e.total > 0) { barra(Math.min(100, (e.bajado / e.total) * 100)); txt(`Descargando la versión nueva… ${Math.round((e.bajado / e.total) * 100)} % (${(e.bajado / 1048576).toFixed(1)} de ${(e.total / 1048576).toFixed(1)} MB)`); }
      else if (e.bajado > 0) txt(`Descargando la versión nueva… ${(e.bajado / 1048576).toFixed(1)} MB`);
      if (e.hecho) break;
    }
    barra(100);
    await instalar();
  } catch (e) {
    // Sin el componente de instalación (versión antigua) o si falla la descarga: como antes, por el navegador
    cerrar();
    toast(`${e?.message && !/not implemented|UNIMPLEMENTED|no implement/i.test(e.message) ? e.message + '. ' : ''}Se abre la descarga en el navegador.`);
    descargarApp(url);
  }
}

const actualizaciones = {
  version: () => window.BUSSEV_VERSION || { build: 0, fecha: '', repo: '' },
  token: () => (typeof window.BUSSEV_GH?.token === 'string' && /^[\w-]{20,255}$/.test(window.BUSSEV_GH.token) ? window.BUSSEV_GH.token : ''),
  paginaVersiones() { const r = this.version().repo; return r ? `https://github.com/${r}/releases/latest` : ''; },
  /* Solo se abren enlaces de GitHub (por seguridad) */
  enlaceSeguro(u) { try { const x = new URL(u); return x.protocol === 'https:' && /(^|\.)github\.com$|(^|\.)githubusercontent\.com$/.test(x.hostname) ? x.href : ''; } catch { return ''; } },
  /* «v1.1.2» → [1,1,2] */
  partes(t) { const m = String(t || '').match(/(\d+)\.(\d+)\.(\d+)/); return m ? m.slice(1).map(Number) : null; },
  comparar(a, b) { for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; },
  nombre() { const v = this.version(); return v.version ? `v${v.version}` : 'de prueba'; },
  async buscar() {
    const v = this.version();
    if (!/^[\w.-]+\/[\w.-]+$/.test(v.repo || '')) return { estado: 'sin-repo' };
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    try {
      // Repositorio privado: la app lleva un permiso de SOLO LECTURA de este repositorio (lo mete GitHub al compilar)
      const token = this.token();
      const r = await fetch(`https://api.github.com/repos/${v.repo}/releases/latest`, { headers: { Accept: 'application/vnd.github+json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, signal: ctrl.signal, credentials: 'omit' });
      if ([401, 403, 404].includes(r.status)) return { estado: 'privado' };   // repositorio privado: GitHub no deja mirarlo sin entrar
      if (!r.ok) throw new Error(`GitHub ha respondido con un error (${r.status}).`);
      const j = await r.json();
      const tag = String(j.tag_name || '');
      // Cada versión publicada lleva escondido su número de compilación: así se sabe si es más nueva
      // aunque tenga el mismo nombre (p. ej. la v1.1.2 recompilada con los horarios nuevos).
      const buildRemota = Number(String(j.body || '').match(/bussev-build:(\d+)/)?.[1]) || 0;
      const pr = this.partes(tag), pm = this.partes(v.version);
      let hay;
      if (buildRemota && v.build) hay = buildRemota > v.build;
      else if (pr && pm) hay = this.comparar(pr, pm) > 0;
      else hay = (Number(tag.replace(/\D/g, '')) || 0) > (v.build || 0);
      const mismoNombre = pr && pm && this.comparar(pr, pm) === 0;
      const asset = (j.assets || []).find((a) => /\.apk$/i.test(a.name || ''));
      // Privado: se descarga por la API (con el permiso); público: el enlace normal
      const apk = token && /^https:\/\/api\.github\.com\/repos\/[\w.-]+\/[\w.-]+\/releases\/assets\/\d+$/.test(asset?.url || '') ? asset.url : asset?.browser_download_url;
      const url = this.enlaceSeguro(apk || j.html_url || '') || this.paginaVersiones();
      store.set('ultimaRevisionVersion', Date.now());
      return { estado: hay ? 'nueva' : 'al-dia', nueva: pr ? `v${pr.join('.')}` : tag, mismoNombre, clave: `${tag}#${buildRemota}`, url, fecha: j.published_at || '', novedades: novedades.deTexto(j.body) };
    } finally { clearTimeout(t); }
  },
  /* Al abrir la app y cada vez que vuelves a ella: si hay versión nueva, te avisa.
     - Se consulta a GitHub como mucho cada 15 minutos, y solo cuenta si ha contestado (sin conexión, se
       reintenta la próxima vez). Buscar a mano en Ajustes ya no retrasa este aviso.
     - Si dices «Ahora no», te lo recuerda pasado medio día; si sale otra compilación más nueva, avisa enseguida. */
  async revisarSola() {
    if (!settings.avisarVersion || !this.version().build || this.mirando) return;
    if (document.querySelector('.modal-bg')) return;   // hay otra ventana abierta: no se pisa
    if (Date.now() - store.get('ultimaRevisionAuto', 0) < 15 * 60_000) return;
    this.mirando = true;
    let r = null;
    try { r = await this.buscar(); } catch { /* sin conexión: se reintenta al volver a la app */ } finally { this.mirando = false; }
    if (!r || !['nueva', 'al-dia'].includes(r.estado)) return;
    store.set('ultimaRevisionAuto', Date.now());
    const av = store.get('versionAvisada', null);
    const previa = av && typeof av === 'object' ? av : { clave: String(av || ''), t: 0 };
    if (r.estado === 'nueva' && !(previa.clave === r.clave && Date.now() - previa.t < 12 * 3600_000) && !document.querySelector('.modal-bg')) {
      store.set('versionAvisada', { clave: r.clave, t: Date.now() });
      // Pop-up de versión nueva (se puede desactivar aquí mismo o en Ajustes → «Avisarme si hay una versión nueva»)
      const nov = novedades.pendientes(r.novedades);
      openModal(`<h2>✨ Hay una versión nueva</h2>
        <p class="help">${r.mismoNombre ? 'Hay una actualización de BusSev disponible.' : `BusSev ${esc(r.nueva)} ya está disponible.`} Se instala encima de la que tienes, sin perder tus favoritas ni tus tarjetas.</p>
        ${nov ? `<div class="nov-caja"><b>Qué cambia en las líneas y paradas</b>${novedades.html(nov)}</div>` : ''}
        <div class="actions"><button class="btn ghost" type="button" id="upd-no">Ahora no</button>${r.url ? '<button class="btn" type="button" id="upd-ok">Descargar e instalar</button>' : '<a class="btn" href="#ajustes" id="upd-aj">Ver en Ajustes</a>'}</div>
        <button class="link-btn" type="button" id="upd-never" style="margin:6px auto 0;display:block">No volver a avisarme de versiones</button>`, (m, close) => {
        $('#upd-no', m).onclick = close;
        $('#upd-ok', m)?.addEventListener('click', () => { close(); instalarActualizacion(r.url); });
        $('#upd-aj', m)?.addEventListener('click', close);
        $('#upd-never', m).onclick = () => { settings.avisarVersion = false; saveSettings(); close(); toast('No te avisaré de versiones. Puedes reactivarlo en Ajustes.'); };
      });
    }
  },
};
setTimeout(() => actualizaciones.revisarSola(), 4000);
setTimeout(() => { actualizador.limpiar(); novedades.alArrancar().catch(() => null); }, 2500);
// Android suele dejar la app abierta en segundo plano: se mira también al volver a ella, no solo al arrancarla
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') setTimeout(() => actualizaciones.revisarSola(), 1500); });

/* Animación de carga: un autobús (o el vehículo de la fiesta) que avanza por una carretera */
function cargandoHTML(texto = 'Cargando…', sub = '') {
  return `<div class="cargando" role="status" aria-live="polite"><div class="cg-pista"><span class="cg-raya"></span><img class="cg-bus" src="${busImg()}" alt=""></div><p>${esc(texto)}</p>${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;
}
const cargandoMini = () => '<span class="cg-mini" aria-hidden="true"></span>';
/* «3» → «03» (solo números de una cifra); el resto igual: «34», «A6», «C1» */
function etiquetaLinea(n) { const v = String(n).replace(/^0+(?=\d)/, ''); return /^\d$/.test(v) ? '0' + v : v; }
/* Orden: primero las numéricas por número (03, 06, 34), luego las demás (A6, C1, EA…) */
function ordenLineas(a, b) {
  const x = String(a).replace(/^0+(?=\d)/, ''), y = String(b).replace(/^0+(?=\d)/, '');
  const nx = /^\d+$/.test(x), ny = /^\d+$/.test(y);
  if (nx && ny) return Number(x) - Number(y);
  if (nx !== ny) return nx ? -1 : 1;
  return x.localeCompare(y, 'es', { numeric: true });
}
function badge(label, color, { sm = false, href = null } = {}) {
  const c = safeColor(color || lineaFor(label)?.color, '#555555');
  const tag = href ? 'a' : 'span';
  return `<${tag} class="badge${sm ? ' sm' : ''}" ${href ? `href="${esc(href)}"` : ''} style="background:${c};color:${textOn(c)}" aria-label="Línea ${esc(label)}">${esc(label)}</${tag}>`;
}
function groupArrivals(tiempos) {
  const g = new Map();
  for (const t of tiempos || []) {
    const k = `${t.linea}|${t.destino}`;
    if (!g.has(k)) g.set(k, { linea: t.linea, color: t.color, destino: t.destino, sentido: t.sentido, buses: [] });
    g.get(k).buses.push(t);
  }
  const out = [...g.values()];
  for (const x of out) x.buses.sort((a, b) => a.tiempo_minutos - b.tiempo_minutos);
  return out.sort((a, b) => a.buses[0].tiempo_minutos - b.buses[0].tiempo_minutos);
}
const minutesHTML = (m) => (m <= 0 ? '<span class="t-now">Llegando</span>' : `<span class="t-main">${m}<small>min</small></span>`);
function boardHTML(tiempos, status, { limit = 99, filtrado = false, codigo = null, vacioExtra = '' } = {}) {
  const groups = groupArrivals(tiempos);
  if (!groups.length) {
    const msg = status && status !== 'ok'
      ? 'TUSSAM no está dando tiempos para esta parada ahora mismo. Vuelve a intentarlo en un momento.'
      : filtrado ? 'Ahora mismo no viene ninguna de las líneas que elegiste para esta parada.' : 'No hay autobuses previstos ahora mismo en esta parada.';
    return `<div class="board-empty">${msg}</div>${vacioExtra}`;
  }
  const rows = groups.slice(0, limit).map((g) => {
    const first = g.buses[0];
    const next = g.buses[1];
    // #8 Si el bus está pegado a la parada (p. ej. 10 m) pero TUSSAM da varios minutos, suele estar
    //    parado en cabecera; no mostramos la distancia para que no parezca un error ("a 10 m · 6 min").
    const distIncoherente = first.distancia_metros != null && first.distancia_metros < 50 && first.tiempo_minutos >= 3;
    const sub = (!first.distancia_metros || distIncoherente) ? '' : `a ${fmtDist(first.distancia_metros)}`;
    const label = `Línea ${g.linea} hacia ${g.destino}: ${first.tiempo_minutos <= 0 ? 'llegando' : first.tiempo_minutos + ' minutos'}${next ? `, el siguiente en ${next.tiempo_minutos} minutos` : ''}`;
    const av = codigo ? ` data-av="${esc(JSON.stringify([codigo, g.linea, g.destino, first.tiempo_minutos, safeColor(g.color, '#555555')]))}" role="button" tabindex="0"` : '';
    const bell = codigo && window.avisos?.find?.(codigo, g.linea, g.destino) ? '<span class="bell" title="Aviso activo">🔔</span>' : '';
    return `<li class="arr${codigo ? ' tappable' : ''}" aria-label="${esc(label)}${codigo ? '. Toca para crear un aviso de llegada' : ''}"${av}>
      ${badge(g.linea, g.color)}
      <div class="arr-dest"><b>${esc(g.destino || 'Sin destino')}</b>${sub ? `<span>${sub}</span>` : ''}</div>
      <div class="arr-times" aria-hidden="true">${bell}${minutesHTML(first.tiempo_minutos)}${next ? `<span class="t-next">${next.tiempo_minutos}′</span>` : ''}</div>
    </li>`;
  }).join('');
  const more = groups.length > limit ? `<div class="board-empty">y ${groups.length - limit} más…</div>` : '';
  return `<ul class="board">${rows}</ul>${more}`;
}
function freshnessPill(d) {
  if (d?.stale) {
    const when = d.cached_at ? new Date(d.cached_at) : null;
    const ok = when && !Number.isNaN(+when);
    const hoy = ok && when.toDateString() === new Date().toDateString();
    const hora = ok ? when.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '';
    const cuando = ok ? (hoy ? 'de las ' + hora : 'del ' + when.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) + ', ' + hora) : '';
    const prefijo = navigator.onLine === false ? 'Sin conexión' : 'Últimos datos';
    return `<span class="pill stale">${prefijo}${cuando ? ' · ' + cuando : ''}</span>`;
  }
  return '<span class="pill live">En directo</span>';
}
function stopCardHTML(p, { tiempos, status, distancia, limit = 4, fav = null }) {
  const sub = [distancia != null ? `🚶 ${Math.max(1, Math.round(distancia * 1.25 / 75))} min (${fmtDist(distancia)})` : '', p.direccion_completa || p.calle || ''].filter(Boolean).join(' · ');
  const color = fav?.color ? safeColor(fav.color) : null;
  const filtered = fav?.lineas?.length ? filtrarLineas(tiempos, fav) : tiempos;
  return `<article class="card${fav ? ' fav' : ''}" ${color ? `style="--fc:${color}"` : ''}>
    <a class="card-head" href="#parada-${esc(p.codigo)}">
      <span class="stop-num" aria-label="Parada número ${esc(p.codigo)}">${esc(p.codigo)}</span>
      <div class="card-title">${fav?.alias ? `<div class="fav-alias">${esc(fav.alias)}</div>` : ''}<h3>${esc(p.nombre)}</h3>${sub ? `<p>${esc(sub)}</p>` : ''}
        ${fav?.lineas?.length ? `<p>Solo líneas ${fav.lineas.map(esc).join(', ')}</p>` : ''}</div>
      ${ICON.chev}
    </a>
    ${fav && settings.avisosTarjetas !== false ? (window.avisosTussam?.favAvisoHTML?.(p.codigo, fav.lineas) || '') : ''}
    ${tiempos === undefined ? '<div class="board-empty">Cargando tiempos…</div>' : boardHTML(filtered, status, { limit, filtrado: !!fav?.lineas?.length, codigo: p.codigo })}
    ${fav ? `<div class="card-tools">${settings.voz ? `<button type="button" data-speak="${esc(p.codigo)}">🔊 Escuchar</button>` : ''}<button type="button" data-edit-fav="${esc(p.codigo)}">Personalizar</button></div>` : ''}
  </article>`;
}
const emptyHTML = (icon, title, text, actions = '') => `<div class="empty">${icon}<h2>${title}</h2><p>${text}</p>${actions}</div>`;
const skeletons = (n = 3) => `<div class="stack">${'<div class="skeleton"></div>'.repeat(n)}</div>`;
const errorHTML = (e, retryId) => emptyHTML(ICON.off, 'No se han podido cargar los datos', esc(e.message || 'Error desconocido.'), `<button class="btn" type="button" id="${retryId}">Reintentar</button>`);
const backHead = (inner = '') => `<div class="detail-head"><button class="back-btn" type="button" aria-label="Volver">${ICON.back}</button>${inner}</div>`;
const swatchesHTML = (cur, attr) => `<div class="swatches">${TAGS.map((c) => `<button class="swatch" type="button" ${attr}="${c}" aria-pressed="${cur === c}" aria-label="Color" style="background:${c};color:${textOn(c)}">${cur === c ? ICON.check : ''}</button>`).join('')}</div>`;

/* Últimos tiempos de cada parada (para leerlos en voz alta) */
const ultimosTiempos = new Map();
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-speak]');
  if (!b) return;
  e.preventDefault();
  const c = b.dataset.speak;
  const p = cache.paradaByCode.get(c);
  const f = favs.get(c);
  hablar(textoParaVoz(f?.alias || p?.nombre || `Parada ${c}`, filtrarLineas(ultimosTiempos.get(c) || [], f)));
});

/* Ventana desde abajo */
function openModal(html, mount) {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><button class="modal-grip" type="button" aria-label="Cerrar"><span class="sheet-grip"></span></button>${html}</div>`;
  const close = () => { bg.remove(); document.removeEventListener('keydown', onKey); };
  const modal = bg.firstElementChild;
  modal.querySelector('.modal-grip').onclick = close;
  /* Deslizar hacia abajo para cerrar (desde la barrita o con el contenido arriba del todo) */
  let y0 = null, dy = 0, t0 = 0, arrastrando = false;
  const scrollArriba = (el) => { for (let n = el; n && n !== bg; n = n.parentElement) if (n.scrollTop > 0) return false; return true; };
  modal.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1 || !scrollArriba(e.target)) { y0 = null; return; }
    y0 = e.touches[0].clientY; dy = 0; t0 = Date.now(); arrastrando = false;
  }, { passive: true });
  modal.addEventListener('touchmove', (e) => {
    if (y0 == null) return;
    dy = e.touches[0].clientY - y0;
    if (!arrastrando && dy > 8) { arrastrando = true; modal.style.transition = 'none'; }
    if (!arrastrando) { if (dy < -4) y0 = null; return; }
    e.preventDefault();
    modal.style.transform = `translateY(${Math.max(0, dy)}px)`;
    bg.style.backgroundColor = `rgb(0 0 0 / ${Math.max(0.1, 0.55 - dy / 800)})`;
  }, { passive: false });
  const soltar = () => {
    if (y0 == null || !arrastrando) { y0 = null; return; }
    const rapido = dy / Math.max(1, Date.now() - t0) > 0.6;
    y0 = null; arrastrando = false;
    modal.style.transition = 'transform .2s ease-out';
    if (dy > Math.min(140, modal.offsetHeight * 0.25) || (rapido && dy > 40)) {
      modal.style.transform = 'translateY(100%)'; bg.style.backgroundColor = 'transparent';
      setTimeout(close, settings.menosAnimaciones ? 0 : 180);
    } else { modal.style.transform = ''; bg.style.backgroundColor = ''; }
  };
  modal.addEventListener('touchend', soltar);
  modal.addEventListener('touchcancel', soltar);
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  bg.addEventListener('click', (e) => { if (e.target === bg) close(); });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(bg);
  mount?.(bg.firstElementChild, close);
  return close;
}

/* Estrella de favorita con animación */
function favButton(p, onChange) {
  const on = favs.has(p.codigo);
  return { html: `<button class="fav-btn" type="button" data-fav aria-pressed="${on}" aria-label="${on ? 'Quitar de favoritas' : 'Guardar en favoritas'}">${ICON.star}</button>`,
    bind(root) {
      const b = $('[data-fav]', root);
      if (!b) return;
      b.onclick = () => {
        const now = !favs.has(p.codigo);
        if (now) favs.add(p); else favs.remove(p.codigo);
        b.setAttribute('aria-pressed', now);
        b.setAttribute('aria-label', now ? 'Quitar de favoritas' : 'Guardar en favoritas');
        b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
        vibrar(now ? 25 : 10);
        toast(now ? 'Guardada en favoritas. Pulsa «Personalizar» para elegir nombre, color y líneas.' : 'Quitada de favoritas');
        onChange?.(now);
      };
    } };
}
async function editFavorite(codigo, onDone) {
  const fav = favs.get(codigo);
  if (!fav) return;
  await getLineas().catch(() => null);
  const lineas = await api(`/paradas/${encodeURIComponent(codigo)}/lineas`).catch(() => []);
  let elegidas = new Set(fav.lineas?.length ? fav.lineas : lineas);
  let color = fav.color || '';
  openModal(`<h2>Personalizar parada</h2>
    <p class="help">${esc(fav.nombre)} · parada ${esc(codigo)}</p>
    <div class="field"><label for="fv-alias">Nombre</label><input id="fv-alias" maxlength="30" placeholder="Por ejemplo: Casa, Trabajo, Facultad" value="${esc(fav.alias || '')}"></div>
    <div class="field"><label>Color</label>${swatchesHTML(color, 'data-fc')}</div>
    <div class="field"><label>Líneas que quieres ver</label>
      <p class="help">En Favoritas solo saldrán los tiempos de las líneas marcadas. Sirve para no ver autobuses que nunca coges en esta parada. Si las dejas todas marcadas, se ven todas.</p>
      <div class="line-picks">${[...lineas].sort(ordenLineas).map((n) => `<button class="line-pick" type="button" data-ln="${esc(n)}" aria-pressed="${elegidas.has(n)}">${badge(etiquetaLinea(lineaFor(n)?.numero || n), lineaFor(n)?.color)}</button>`).join('') || '<span class="help">Sin datos de líneas.</span>'}</div></div>
    ${favs.list().length > 1 ? `<div class="field"><label>Posición en Favoritas <span class="orden-pos" id="fv-pos"></span></label>
      <div class="orden-box"><ol class="orden-lista" id="fv-orden"></ol>
        <div class="orden-btns"><button class="btn ghost" type="button" data-mv="-1">${ICON.arriba}Subir</button><button class="btn ghost" type="button" data-mv="1">${ICON.abajo}Bajar</button></div></div></div>` : ''}
    <div class="actions"><button class="btn danger" type="button" id="fv-del">Quitar de favoritas</button><button class="btn" type="button" id="fv-ok">Guardar</button></div>`,
  (m, close) => {
    m.querySelectorAll('[data-fc]').forEach((b) => { b.onclick = () => {
      color = color === b.dataset.fc ? '' : b.dataset.fc;
      m.querySelectorAll('[data-fc]').forEach((x) => { const on = x.dataset.fc === color; x.setAttribute('aria-pressed', on); x.innerHTML = on ? ICON.check : ''; });
    }; });
    m.querySelectorAll('[data-ln]').forEach((b) => { b.onclick = () => {
      const n = b.dataset.ln; if (elegidas.has(n)) elegidas.delete(n); else elegidas.add(n);
      b.setAttribute('aria-pressed', elegidas.has(n));
    }; });
    /* Lista en miniatura: ves dónde queda la parada al subirla o bajarla */
    const pintarOrden = (animar) => {
      const box = $('#fv-orden', m);
      if (!box) return;
      const l = favs.list();
      const i = l.findIndex((f) => f.codigo === codigo);
      box.innerHTML = l.map((f, j) => `<li class="${f.codigo === codigo ? 'yo' + (animar ? ' movido' : '') : ''}"><span class="o-n">${j + 1}</span><span class="o-t">${esc(f.alias || f.nombre)}</span></li>`).join('');
      $('#fv-pos', m).textContent = `· ${i + 1} de ${l.length}`;
      const [sube, baja] = [m.querySelector('[data-mv="-1"]'), m.querySelector('[data-mv="1"]')];
      if (sube) sube.disabled = i <= 0;
      if (baja) baja.disabled = i >= l.length - 1;
      box.querySelector('.yo')?.scrollIntoView({ block: 'nearest', behavior: animar && !settings.menosAnimaciones ? 'smooth' : 'auto' });
    };
    pintarOrden(false);
    m.querySelectorAll('[data-mv]').forEach((b) => { b.onclick = () => { favs.move(codigo, Number(b.dataset.mv)); vibrar(15); pintarOrden(true); onDone?.(); }; });
    $('#fv-del', m).onclick = () => { favs.remove(codigo); close(); toast('Quitada de favoritas'); onDone?.(); };
    $('#fv-ok', m).onclick = () => {
      const sel = lineas.filter((n) => elegidas.has(n));
      favs.update(codigo, { alias: $('#fv-alias', m).value.trim().slice(0, 30), color, lineas: sel.length && sel.length < lineas.length ? sel : null });
      close(); toast('Cambios guardados'); onDone?.();
    };
  });
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-edit-fav]');
  if (b) { e.preventDefault(); editFavorite(b.dataset.editFav, () => active.rerender?.()); }
});

/* ================================================================== */
/* Ciclo de vida: no gastar batería en segundo plano                   */
/* ================================================================== */
let appVisible = document.visibilityState !== 'hidden';
const resumeHandlers = new Set();
// Al recuperar la conexión, se actualiza lo que estés viendo sin tocar nada
window.addEventListener('online', () => { if (appVisible) { toast('Conexión recuperada'); active?.rerender?.(); setTimeout(() => active?.refresh?.(), 400); } });
window.addEventListener('offline', () => { toast('Sin conexión: se muestran los últimos horarios guardados'); active?.rerender?.(); });
function setVisible(v) { const was = appVisible; appVisible = v; document.documentElement.classList.toggle('oculta', !v); if (v && !was) { repintar(); for (const fn of resumeHandlers) fn(); } }
/* Al volver de otra app, a veces Android no vuelve a pintar la pantalla (se queda gris hasta tocar algo).
   Se fuerza un repintado, se recolocan los mapas (y se rehacen si el móvil les quitó la gráfica)
   y se arreglan las ventanas que se abrieron mientras la app estaba en segundo plano. */
function repintar() {
  const h = document.documentElement;
  h.classList.add('repinta');
  void h.offsetHeight;
  requestAnimationFrame(() => requestAnimationFrame(() => h.classList.remove('repinta')));
  document.querySelectorAll('.modal-bg').forEach((bg) => {
    const m = bg.querySelector('.modal');
    if (!m) { bg.remove(); return; }
    m.style.animation = 'none'; m.style.transform = ''; m.style.opacity = ''; bg.style.backgroundColor = '';
  });
  for (const bm of liveMaps) {
    try {
      if (bm.perdido?.()) { bm.rehacer?.(); continue; }
      bm.m.resize(); bm.m.triggerRepaint();
    } catch { /* mapa ya cerrado */ }
  }
}
window.busSevVuelve = () => { if (!appVisible) setVisible(true); else repintar(); };
/* El widget (al tocarlo) abre directamente la parada elegida */
window.busSevAbrirParada = (c) => { c = String(c == null ? '' : c).replace(/[^0-9]/g, ''); if (c) location.hash = '#parada-' + c; };
document.addEventListener('visibilitychange', () => setVisible(document.visibilityState === 'visible'));
document.addEventListener('pause', () => setVisible(false));
document.addEventListener('resume', () => setVisible(true));
/* Ahorro de batería: si dejas la app abierta sin tocarla (en la mesa, con la pantalla encendida), los tiempos se
   piden cada vez más despacio. En cuanto tocas la pantalla se actualiza al momento y vuelve al ritmo normal.
     - tocada en los últimos 3 min: ritmo normal (el que elijas en Ajustes)
     - de 3 a 15 min sin tocarla:   como mucho cada 2 min
     - más de 15 min sin tocarla:   cada 5 min */
const REPOSO_MS = 3 * 60_000;
let ultimoToque = Date.now();
const despertarHandlers = new Set();
const enReposo = () => Date.now() - ultimoToque > REPOSO_MS;
const ritmoReposo = (ms) => { const q = Date.now() - ultimoToque; return q > 15 * 60_000 ? Math.max(ms, 5 * 60_000) : q > REPOSO_MS ? Math.max(ms, 2 * 60_000) : ms; };
for (const ev of ['pointerdown', 'keydown', 'wheel', 'touchstart']) {
  addEventListener(ev, () => {
    const dormida = enReposo();
    ultimoToque = Date.now();
    if (dormida && appVisible) for (const h of [...despertarHandlers]) h();
  }, { passive: true, capture: true });
}
function autoRefresh(fn, { min = 0 } = {}) {
  const ms = settings.refresh ? Math.max(settings.refresh * 1000, min) : 0;
  let ultima = Date.now();
  const correr = () => { ultima = Date.now(); fn(); };
  // Se mira cada pocos segundos si ya toca (así el ritmo cambia en cuanto dejas de tocar o vuelves a tocar)
  const id = ms ? setInterval(() => { if (appVisible && Date.now() - ultima >= ritmoReposo(ms) - 500) correr(); }, Math.min(ms, 5000)) : null;
  const onResume = () => correr();
  const onDespertar = () => { if (ms && Date.now() - ultima >= Math.min(ms, 15_000)) correr(); };
  resumeHandlers.add(onResume); despertarHandlers.add(onDespertar);
  return () => { if (id) clearInterval(id); resumeHandlers.delete(onResume); despertarHandlers.delete(onDespertar); };
}
const refreshNote = () => (settings.refresh ? `se actualiza cada ${settings.refresh === 60 ? 'minuto' : settings.refresh + ' s'}` : 'pulsa ⟳ para actualizar');

/* ================================================================== */
/* Ubicación                                                           */
/* ================================================================== */
function getPosition(precise = false) {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) { reject(Object.assign(new Error('Este móvil no permite obtener la ubicación.'), { code: 0 })); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => { store.set('geoOk', true); resolve([p.coords.latitude, p.coords.longitude]); },
      (err) => reject(err),
      { enableHighAccuracy: precise, timeout: 15000, maximumAge: 60000 },
    );
  });
}
function geoErrorText(err) {
  if (err?.code === 1) return 'No has dado permiso para usar tu ubicación. Puedes activarlo en Ajustes del móvil → Aplicaciones → BusSev → Permisos, o buscar la parada arriba.';
  if (err?.code === 3) return 'No hemos podido saber dónde estás a tiempo. Comprueba que la ubicación del móvil está activada o busca la parada arriba.';
  return err?.message || 'No hemos podido obtener tu ubicación. Busca la parada arriba.';
}

/* ================================================================== */
/* Mapas (MapLibre + OpenFreeMap, sin clave)                           */
/* ================================================================== */
if (window.maplibregl) window.maplibregl.setWorkerUrl('/vendor/maplibre/maplibre-gl-csp-worker.js');
// Satélite: fotos aéreas oficiales (PNOA, Instituto Geográfico Nacional) con los nombres de las calles encima.
// Cuenta como mapa oscuro para los bordes de las líneas y demás.
const mapIsDark = () => settings.mapStyle === 'oscuro' || settings.mapStyle === 'satelite' || (settings.mapStyle === 'tema' && resolvedTheme === 'dark');
const styleUrl = () => (settings.mapStyle === 'satelite' ? '/map/satelite.json' : mapIsDark() ? '/map/oscuro.json' : '/map/claro.json');
const creditoMapa = () => (settings.mapStyle === 'satelite' ? 'PNOA © Instituto Geográfico Nacional · © OpenStreetMap' : '© OpenStreetMap');
const liveMaps = new Set();
function updateMapStyles() { for (const bm of liveMaps) bm.setStyle(); }
const ll = ([lat, lon]) => [lon, lat];

/* Envoltorio pequeño sobre MapLibre: guarda nuestras capas y las vuelve a
   poner si cambia el estilo (claro/oscuro). */
function createMap(el, center, zoom) {
  if (!window.maplibregl) { el.innerHTML = '<div class="map-fallback">El mapa no está disponible en este dispositivo.</div>'; return null; }
  let m;
  try {
    m = new maplibregl.Map({
      container: el, style: styleUrl(), center: ll(center), zoom,
      attributionControl: false, dragRotate: true, pitchWithRotate: false, touchPitch: false, maxPitch: 0,
      fadeDuration: 0, renderWorldCopies: false, maxTileCacheSize: 120, refreshExpiredTiles: false,
      maxBounds: [[-6.35, 37.15], [-5.65, 37.6]], minZoom: 10,
    });
  } catch {
    el.innerHTML = '<div class="map-fallback">No se ha podido abrir el mapa (el móvil no admite WebGL).</div>';
    return null;
  }
  m.touchZoomRotate.enableRotation();   // girar el mapa con dos dedos
  m.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: false }), 'top-right');   // brújula: tócala para volver a poner el norte arriba
  el.insertAdjacentHTML('beforeend', `<span class="osm-credito${settings.mapStyle === 'satelite' ? ' sat' : ''}">${creditoMapa()}</span>`);
  const data = new Map();        // id -> geojson
  const installers = [];
  const bm = {
    m, style: styleUrl(),
    ready: new Promise((r) => m.once('style.load', r)),
    setStyle() {
      const u = styleUrl(); if (u !== bm.style) { bm.style = u; estiloListo = false; m.setStyle(u, { diff: false }); }
      const cr = el.querySelector('.osm-credito'); if (cr) { cr.textContent = creditoMapa(); cr.classList.toggle('sat', settings.mapStyle === 'satelite'); }
    },
    source(id, geojson) {
      data.set(id, geojson);
      const s = m.getSource(id);
      if (s) s.setData(geojson);
    },
    layer(def) { installers.push(def); install(def); },
    fit(points, opts = {}) {
      if (!points.length) return;
      const b = new maplibregl.LngLatBounds(ll(points[0]), ll(points[0]));
      for (const p of points) b.extend(ll(p));
      m.fitBounds(b, { padding: opts.padding ?? 40, maxZoom: opts.maxZoom ?? 16, duration: opts.anim ? animMs(400) : 0 });
    },
    remove() { liveMaps.delete(bm); m.remove(); },
  };
  // El estilo está listo para añadir capas aunque falten teselas o iconos (p. ej. sin cobertura).
  let estiloListo = false;
  function styleReady() { return estiloListo; }
  function install(def) {
    if (!styleReady()) return;
    if (!m.getSource(def.source)) m.addSource(def.source, { type: 'geojson', data: data.get(def.source) || { type: 'FeatureCollection', features: [] } });
    if (!m.getLayer(def.id)) m.addLayer(def);
  }
  m.on('style.load', () => { estiloListo = true; for (const d of installers) install(d); aplicarCapasMapa(bm); });
  m.on('error', () => { /* teselas que no cargan sin cobertura: no es un fallo de la app */ });
  /* Si Android le quita la gráfica al mapa (pasa al estar un rato en otra app), el mapa se queda gris:
     se avisa a la pantalla para que lo vuelva a crear. */
  let perdido = false;
  const lienzo = m.getCanvas();
  lienzo.addEventListener('webglcontextlost', (e) => { e.preventDefault(); perdido = true; }, false);
  lienzo.addEventListener('webglcontextrestored', () => { perdido = false; try { m.resize(); m.triggerRepaint(); } catch { /* */ } }, false);
  bm.perdido = () => { if (perdido) return true; try { return !!m.painter?.context?.gl?.isContextLost?.(); } catch { return false; } };
  bm.rehacer = () => { setTimeout(() => { if (bm.perdido()) window.dispatchEvent(new CustomEvent('bussev-mapa-perdido', { detail: bm })); }, 1200); };
  liveMaps.add(bm);
  return bm;
}
/* #64 Mostrar u ocultar capas del mapa (paradas, recorridos, nombres de calles). Por defecto todo visible. */
function aplicarCapasMapa(bm) {
  if (!bm?.m) return;
  const m = bm.m;
  const vis = (id, on) => { try { if (m.getLayer(id)) m.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none'); } catch { /* */ } };
  vis('bs-stops', settings.mapaParadas !== false);
  vis('bs-stops-hit', settings.mapaParadas !== false);
  for (const id of ['bs-route-casing', 'bs-route', 'bs-route-stops', 'bs-paths-casing', 'bs-paths']) vis(id, settings.mapaRecorridos !== false);
  for (const id of ['bs-metro-casing', 'bs-metro', 'bs-metro-st', 'bs-metro-hit']) vis(id, settings.mapaMetro !== false);
  // Nombres de calles y sitios = las capas de texto del mapa base
  try { for (const l of m.getStyle()?.layers || []) if (l.type === 'symbol') m.setLayoutProperty(l.id, 'visibility', settings.mapaCalles !== false ? 'visible' : 'none'); } catch { /* */ }
}
const fc = (features) => ({ type: 'FeatureCollection', features });
const pointF = (pos, props = {}) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: ll(pos) }, properties: props });
const lineF = (pts, props = {}) => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: pts.map(ll) }, properties: props });

/* Todas las paradas como puntos rojos */
async function addStopDots(bm, onClick) {
  const list = await getParadas().catch(() => []);
  bm.source('bs-stops', fc(list.map((p) => pointF([p.latitud, p.longitud], { codigo: p.codigo }))));
  bm.layer({ id: 'bs-stops', type: 'circle', source: 'bs-stops', paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 1.6, 13, 2.6, 15, 4.2, 17, 6.5, 19, 8],
    'circle-color': '#e5303c', 'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 13, 0, 15, 1.2], 'circle-stroke-color': mapIsDark() ? '#1d1f23' : '#ffffff',
  } });
  // Capa de toque invisible, más ancha que el punto: se toca mucho mejor sin que el punto se vea más grande.
  bm.layer({ id: 'bs-stops-hit', type: 'circle', source: 'bs-stops', paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 9, 13, 11, 15, 13, 17, 16, 19, 18],
    'circle-color': '#000000', 'circle-opacity': 0,
  } });
  const tocar = (e) => {
    // Si justo ahí hay una estación de metro, manda la estación (si no, salían las dos ventanas a la vez)
    try { if (bm.m.getLayer('bs-metro-hit') && settings.mapaMetro !== false && bm.m.queryRenderedFeatures(e.point, { layers: ['bs-metro-hit'] }).length) return; } catch { /* */ }
    const c = e.features?.[0]?.properties?.codigo; const p = c && cache.paradaByCode.get(String(c)); if (p) onClick(p);
  };
  bm.m.on('click', 'bs-stops-hit', tocar);
  bm.m.on('mouseenter', 'bs-stops-hit', () => { bm.m.getCanvas().style.cursor = 'pointer'; });
  bm.m.on('mouseleave', 'bs-stops-hit', () => { bm.m.getCanvas().style.cursor = ''; });
}
/* Metro de Sevilla: la línea en su color y las estaciones (tocar una → próximos trenes) */
async function addMetroLayer(bm) {
  const M = await cargarMetro().catch(() => null);
  if (!M || !bm?.m) return;
  const seq = M.recorridos.filter((r) => r[2] === 1).sort((a, b) => a[3] - b[3]).map((r) => estacionMetro(r[0])).filter(Boolean);
  const color = safeColor(M.linea?.color, '#2e9c3e');
  bm.source('bs-metro', fc([lineF(seq.map((e) => [e.latitud, e.longitud]), { color })]));
  bm.source('bs-metro-st', fc(M.estaciones.map((e) => pointF([e.latitud, e.longitud], { codigo: e.codigo }))));
  bm.layer({ id: 'bs-metro-casing', type: 'line', source: 'bs-metro', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': mapIsDark() ? '#0b0c0f' : '#ffffff', 'line-opacity': 0.85, 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 4, 16, 9] } });
  bm.layer({ id: 'bs-metro', type: 'line', source: 'bs-metro', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': color, 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 2.2, 16, 5.5], 'line-dasharray': [2, 1.2] } });
  bm.layer({ id: 'bs-metro-st', type: 'circle', source: 'bs-metro-st', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 3, 15, 7, 18, 10], 'circle-color': '#ffffff', 'circle-stroke-color': color, 'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 11, 2, 15, 3.5] } });
  bm.layer({ id: 'bs-metro-hit', type: 'circle', source: 'bs-metro-st', paint: { 'circle-radius': 16, 'circle-color': '#000000', 'circle-opacity': 0 } });
  bm.m.on('click', 'bs-metro-hit', (e) => { const c = e.features?.[0]?.properties?.codigo; if (c) estacionModal(String(c)); });
  aplicarCapasMapa(bm);
}
function estacionModal(codigo) {
  const est = estacionMetro(codigo), M = window.BUSSEV_METRO;
  if (!est || !M) return;
  const filas = pasosMetro(codigo).map((p) => `<div class="row-flat"><div style="flex:1;min-width:0"><b>Hacia ${esc(p.destino)}</b><p class="help">${p.prox.length ? p.prox.map(hhmmDe).join(' · ') : 'Hoy ya no pasa más'}${p.ultimo != null && p.prox.length ? ` · último ${hhmmDe(p.ultimo)}` : ''}</p></div></div>`).join('');
  openModal(`<h2>Ⓜ ${esc(est.nombre)}</h2><p class="help">Metro de Sevilla · próximos trenes según el horario oficial.</p>${filas || '<p class="help">Sin horario para hoy.</p>'}
    <div class="actions">${settings.modoSencillo ? '' : '<button class="btn ghost" type="button" id="me-ruta">Cómo llegar aquí</button>'}<button class="btn" type="button" id="me-x">Cerrar</button></div>`, (m, close) => {
    $('#me-x', m).onclick = close;
    $('#me-ruta', m)?.addEventListener('click', () => { close(); irARuta({ tipo: 'lugar', nombre: `Metro ${est.nombre}`, pos: [est.latitud, est.longitud] }); });
  });
}
/* Capas para recorrido de línea y caminos de los buses */
function addRouteLayers(bm) {
  bm.layer({ id: 'bs-route-casing', type: 'line', source: 'bs-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#000000', 'line-opacity': 0.35, 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 5, 16, 10] } });
  bm.layer({ id: 'bs-route', type: 'line', source: 'bs-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 3, 16, 6.5] } });
  bm.layer({ id: 'bs-route-stops', type: 'circle', source: 'bs-route-stops', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 2.5, 16, 5.5], 'circle-color': '#ffffff', 'circle-stroke-color': ['get', 'color'], 'circle-stroke-width': 2.2 } });
  // Desplazamiento lateral (carril) que pone tramosConCarril SOLO donde varias líneas comparten calle: ahí se
  // dibujan pegadas una a otra, centradas sobre la calzada. Donde una línea va sola, carril 0 (encima de la calle).
  const offsetPaths = ['interpolate', ['linear'], ['zoom'], 12, ['*', ['coalesce', ['get', 'carril'], 0], 3], 16, ['*', ['coalesce', ['get', 'carril'], 0], 6]];
  // Grosor: el normal, o más fino (propiedad «ancho») donde se juntan muchas líneas, para que quepan todas.
  const anchoPaths = ['coalesce', ['get', 'ancho'], 1];
  // Borde oscuro debajo de cada camino: así dos líneas de color parecido (p. ej. dos azules) se separan.
  bm.layer({ id: 'bs-paths-casing', type: 'line', source: 'bs-paths', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': mapIsDark() ? '#0b0c0f' : '#ffffff', 'line-opacity': 0.9, 'line-width': ['interpolate', ['linear'], ['zoom'], 12, ['+', ['*', anchoPaths, 2.6], 1.8], 16, ['+', ['*', anchoPaths, 5], 2.5]], 'line-offset': offsetPaths } });
  bm.layer({ id: 'bs-paths', type: 'line', source: 'bs-paths', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': ['interpolate', ['linear'], ['zoom'], 12, ['*', anchoPaths, 2.6], 16, ['*', anchoPaths, 5]], 'line-opacity': 0.98, 'line-offset': offsetPaths } });
}
/* Marcadores HTML (autobuses y parada) */
function busEl(label, color, clave) {
  const c = safeColor(color, '#3d8bfd');
  const root = document.createElement('div');   // MapLibre coloca este elemento; no le damos posición propia
  const d = document.createElement('div');
  const v = vehiculoFiesta();
  d.className = 'busmk' + (v ? ' ' + v.clase : '');
  root.appendChild(d);
  const k = clave == null ? `${label}` : String(clave);
  d.innerHTML = `<span class="busmk-l" style="background:${c};border-color:${c};color:${textOn(c)}">${esc(label)}</span><img class="busmk-img" src="${busImg(k)}" data-k="${esc(k)}"${busMiraIzq(k) ? ' data-izq' : ''} alt="" draggable="false">`;
  return root;
}
function stopPinEl() {
  const d = document.createElement('div');
  d.innerHTML = '<svg class="stop-pin" viewBox="0 0 30 40" aria-hidden="true"><path d="M15 39S2 24.5 2 14.5a13 13 0 0 1 26 0C28 24.5 15 39 15 39Z" style="fill:var(--accent)" stroke="#fff" stroke-width="2"/><circle cx="15" cy="14.5" r="5" fill="#fff"/></svg>';
  return d;
}
function meEl() { const r = document.createElement('div'); const d = document.createElement('div'); d.className = 'me-pin'; r.appendChild(d); return r; }
function marker(bm, pos, el, popupHTML, anchor = 'bottom') {
  const mk = new maplibregl.Marker({ element: el, anchor }).setLngLat(ll(pos));
  if (popupHTML) mk.setPopup(new maplibregl.Popup({ offset: 28, maxWidth: '260px' }).setHTML(popupHTML));
  return mk.addTo(bm.m);
}
class MarkerSet {
  constructor(bm) { this.bm = bm; this.items = new Map(); this.timer = null; this.raf = 0; }
  clear() { for (const it of this.items.values()) it.mk.remove(); this.items.clear(); this.stopAnim(); }
  add(pos, el, html) { this.items.set(`f${Math.random()}`, { mk: marker(this.bm, pos, el, html) }); }
  /* Autobuses: actualiza los que ya están (sin crearlos de nuevo).
     La posición NUNCA va hacia atrás: si el dato nuevo de TUSSAM deja al bus algo por detrás
     de donde lo habíamos dibujado, se queda quieto hasta que el avance real lo alcanza.
     Solo si la diferencia es enorme (más de 1,5 km, otro bus o un dato raro) se recoloca. */
  sync(buses, label, color, { parcial = false } = {}) {
    const seen = new Set();
    const now = Date.now();
    for (const b of buses) {
      const lab = b.linea || label, col = b.color || color;
      const key = b.vehiculo != null ? `v${b.vehiculo}` : `${lab}|${b.seg}|${Math.round(b.dist / 250)}`;
      seen.add(key);
      let it = this.items.get(key);
      const nuevo = !it;
      if (nuevo) { it = { mk: marker(this.bm, b.pos, busEl(lab, col, key), busPopup(b, lab)) }; this.items.set(key, it); }
      else it.mk.getPopup()?.setHTML(busPopup(b, lab));
      if (!b.shape) { it.st = null; if (!nuevo) this.deslizar(it, b.pos); this.face(it, b.path?.[1], b.pos); continue; }
      const parada = b.shape.cum[b.shape.idx[b.k]];
      const real = Math.max(0, parada - distEf(b.shape, b.dist));   // metros recorridos desde el inicio de la línea
      // velocidad prudente (un poco por debajo de la que sale de TUSSAM) para no adelantarse a la realidad
      const v = 0.8 * Math.min(10, Math.max(1.4, b.dist / Math.max(45, (b.min || 0) * 60)));
      const mismo = it.st && it.st.shape === b.shape;
      // Si el dato nuevo lo deja algo por detrás, NO retrocede: se queda quieto hasta que el avance real lo alcanza.
      // Solo si la diferencia es enorme (más de 1,5 km: otro autobús o un dato erróneo) se recoloca, deslizándolo.
      if (!mismo || it.d == null || real < it.d - 1500) { if (it.d != null && mismo) it.largo = true; it.d = real; }
      it.st = { shape: b.shape, k: b.k, parada, base: real, t0: now, v };
      if (nuevo) { it.d = Math.max(it.d, real); this.colocar(it, false); }
      else this.colocar(it, true);
    }
    if (!parcial) for (const [k, it] of this.items) if (it.st !== undefined && !seen.has(k)) { it.mk.remove(); this.items.delete(k); }
    this.startAnim();
  }
  /* Calcula dónde dibujar el bus ahora (sin retroceder) y lo lleva allí */
  colocar(it, suave) {
    const st = it.st;
    if (!st) return;
    // Entre datos de TUSSAM se avanza a su velocidad, pero como mucho 60 s de camino (sin datos nuevos, se para)
    const estimado = settings.menosAnimaciones ? st.base : st.base + st.v * Math.min(60, (Date.now() - st.t0) / 1000);
    // lo calculado no pasa de la parada desde la que se midió, y lo ya dibujado nunca va hacia atrás
    it.d = Math.max(it.d ?? 0, Math.min(st.parada, estimado));
    const w = locateOnShape(st.shape, st.k, st.parada - it.d, true);
    if (w.fuera) return;
    if (suave && !settings.menosAnimaciones) { this.deslizar(it, w.pos, it.largo ? 1800 : 900); it.largo = false; } else it.mk.setLngLat(ll(w.pos));
    this.face(it, w.path[1], w.pos);
  }
  /* Desliza el marcador hasta el punto nuevo en menos de un segundo (en vez de saltar) */
  deslizar(it, pos, dur = 900) {
    const a = it.mk.getLngLat();
    it.anim = { de: [a.lat, a.lng], a: pos, t0: performance.now(), dur };
    if (!this.raf) this.raf = requestAnimationFrame((t) => this.paso(t));
  }
  paso(t) {
    this.raf = 0;
    let quedan = false;
    for (const it of this.items.values()) {
      const an = it.anim;
      if (!an) continue;
      const f = Math.min(1, (t - an.t0) / an.dur);
      const e = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;   // suave al empezar y al terminar
      it.mk.setLngLat(ll([an.de[0] + (an.a[0] - an.de[0]) * e, an.de[1] + (an.a[1] - an.de[1]) * e]));
      if (f < 1) quedan = true; else it.anim = null;
    }
    if (quedan) this.raf = requestAnimationFrame((x) => this.paso(x));
  }
  /* El dibujo mira hacia donde va el autobús */
  face(it, next, pos) {
    if (!next) return;
    const dx = next[1] - pos[1];
    if (Math.abs(dx) < 0.00003) return;
    it.mk.getElement().querySelector('.busmk')?.classList.toggle('izq', dx < 0);
  }
  tick() {
    const cont = this.bm.m.getContainer();
    if (!appVisible || !cont.isConnected || cont.offsetParent === null) return;   // no se ve: no gasta
    for (const it of this.items.values()) if (it.st) this.colocar(it, true);
  }
  /* Cada 4 segundos (no hace falta más: ahorra batería y se ve más tranquilo) */
  startAnim() { if (this.timer || settings.menosAnimaciones) return; this.timer = setInterval(() => this.tick(), 4000); }
  stopAnim() { clearInterval(this.timer); this.timer = null; if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; }
}

/* ================================================================== */
/* Dónde va cada autobús                                               */
/* TUSSAM no publica el GPS, pero sí cuántos metros le faltan a cada   */
/* bus para llegar a una parada. Recorriendo la línea hacia atrás por  */
/* las calles desde esa parada sabemos por dónde va.                   */
/* ================================================================== */
/* TUSSAM da la distancia por carretera. Si el recorrido está dibujado en línea recta entre paradas
   (cuando no se pudieron calcular las calles), la recta es más corta: se ajusta para no colocar mal
   (ni descartar) autobuses que de verdad están en la línea. */
const FACTOR_RECTA = 1.25;
const distEf = (shape, m) => Math.max(0, m || 0) / (shape?.porCalle ? 1 : FACTOR_RECTA);
function locateOnShape(shape, k, meters, efectivos = false) {
  const { pts, idx, cum } = shape;
  const end = idx[k];
  let target = cum[end] - (efectivos ? Math.max(0, meters || 0) : distEf(shape, meters));
  if (target < 0) {
    // un poco «antes del inicio»: está en la cabecera saliendo; mucho más: es de otro sentido o de otra vuelta
    if (-target <= Math.max(400, cum[end] * 0.5)) target = 0;
    else return { fuera: true, pos: pts[0], path: pts.slice(0, end + 1), seg: 0 };
  }
  let lo = 0, hi = end;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (cum[mid] <= target) lo = mid; else hi = mid - 1; }
  const i = lo;
  const segLen = (cum[i + 1] ?? cum[i]) - cum[i];
  const f = segLen > 0 ? (target - cum[i]) / segLen : 0;
  const a = pts[i], b = pts[Math.min(i + 1, pts.length - 1)];
  const pos = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  let seg = k;
  for (let j = 0; j <= k; j++) if (cum[idx[j]] >= target) { seg = j; break; }
  return { pos, path: [pos, ...pts.slice(i + 1, end + 1)], seg };
}
function sentidoDe(ruta, codigo, sentido) {
  if (sentido && ruta[sentido]) return sentido;
  return Object.keys(ruta).map(Number).find((k) => ruta[k].some((p) => p.codigo === codigo));
}
async function estimateBuses(codigo, tiempos) {
  await getLineas().catch(() => null);
  const out = []; const seen = new Set();
  for (const t of (tiempos || []).slice().sort((a, b) => a.tiempo_minutos - b.tiempo_minutos)) {
    if (t.distancia_metros == null) continue;
    const key = t.vehiculo != null ? `v${t.vehiculo}` : `${t.linea}|${t.destino}|${t.tiempo_minutos}`;
    if (seen.has(key)) continue;
    const linea = lineaFor(t.linea);
    if (!linea) continue;
    const ruta = await getRuta(linea.numero).catch(() => null);
    if (!ruta) continue;
    const s = sentidoDe(ruta, codigo, t.sentido);
    const stops = ruta[s];
    const k = stops ? stops.findIndex((p) => p.codigo === codigo) : -1;
    if (k < 0) continue;
    const shape = getShape(linea.numero, s, stops);
    const w = locateOnShape(shape, k, t.distancia_metros);
    if (w.fuera) continue;
    seen.add(key);
    out.push({ linea: t.linea, color: t.color || linea.color, destino: t.destino, min: t.tiempo_minutos, dist: t.distancia_metros, vehiculo: t.vehiculo, shape, k, ...w });
    if (out.length >= 8) break;
  }
  return out;
}
/* Autobuses de toda una línea con MUY pocas consultas.
   TUSSAM da, para cada parada, los 2 próximos autobuses de cada línea (y a cuántos metros vienen).
   Se empieza por la última parada: da los 2 autobuses más cercanos a ella. Luego se pregunta en la
   parada que queda justo por detrás del más lejano de esos dos, que da los 2 siguientes, y así
   hasta llegar al principio de la línea (o hasta que TUSSAM dé menos de 2: ya no hay más).
   Una línea con 6 autobuses se resuelve con 3-4 consultas, una detrás de otra, en vez de 10-15 a la vez. */
const porParadaTussam = 2;  // cuántos autobuses por línea da TUSSAM en cada parada
async function liveBusesLine(linea, sentido, stops, alAvanzar, cancelado = () => false) {
  if (!stops?.length) return { buses: [], ok: 0, total: 0 };
  const shape = getShape(linea.numero, sentido, stops);
  if (window.BusSevBackend.viaServidor) return lineaDeGolpe(linea, sentido, stops, shape, alAvanzar, cancelado);
  const best = new Map();
  const MAX_CONSULTAS = 8;
  let ok = 0, hechas = 0, limited = false, fallos = 0;
  let k = stops.length - 1;
  const consultadas = new Set();
  while (k >= 0 && hechas < MAX_CONSULTAS) {
    if (consultadas.has(k) || cancelado()) break;
    consultadas.add(k);
    hechas++;
    let d;
    try { d = await api(`/paradas/${encodeURIComponent(stops[k].codigo)}/tiempos`, { prioridad: 'baja', maxEdad: 25_000 }); } catch (e) {
      if (e.status === 429) { limited = true; break; }
      if (e.status === 408 || e.status === 499 || cancelado()) break;
      // parada sin datos: se prueba con la anterior (dos fallos seguidos: se para)
      if (++fallos >= 2) break;
      k -= 3; continue;
    }
    fallos = 0;
    if (cancelado()) break;
    if (d.upstream_status === 'unavailable') { k -= 3; continue; }
    ok++;
    const mias = (d.tiempos || []).filter((t) => lineaFor(t.linea)?.numero === linea.numero && (!t.sentido || t.sentido === sentido) && t.distancia_metros != null);
    let masLejos = null;
    for (const t of mias) {
      const w = locateOnShape(shape, k, t.distancia_metros);
      if (w.fuera) continue;
      const key = t.vehiculo != null ? `v${t.vehiculo}` : `${w.seg}-${Math.round(w.pos[0] * 2000)}-${Math.round(w.pos[1] * 2000)}`;
      const cur = best.get(key);
      if (!cur || t.distancia_metros < cur.dist) best.set(key, { ...w, shape, k, dist: t.distancia_metros, min: t.tiempo_minutos, vehiculo: t.vehiculo, destino: t.destino, hacia: stops[k].nombre });
      if (!masLejos || w.seg < masLejos.seg) masLejos = w;
    }
    alAvanzar?.([...best.values()]);
    // Menos autobuses de los que da TUSSAM por parada: no hay más por detrás
    if (mias.length < porParadaTussam || !masLejos) break;
    // Siguiente: la parada justo por detrás del autobús más lejano (siempre más atrás que la actual)
    k = Math.min(masLejos.seg - 1, k - 1);
  }
  return { buses: [...best.values()], ok, total: hechas, limited, porCalle: shape.porCalle };
}
/* Con tu servidor (como SeviBus): la línea entera en UNA sola consulta.
   Se pregunta por una de cada 3 paradas a la vez (el servidor lo hace por nosotros y guarda las respuestas),
   así cada autobús se mide desde la parada que tiene justo delante: posición más exacta y sin saltos. */
async function lineaDeGolpe(linea, sentido, stops, shape, alAvanzar, cancelado) {
  const paso = Math.max(3, Math.ceil(stops.length / 16));
  const ks = [];
  for (let i = stops.length - 1; i >= 0 && ks.length < 16; i -= paso) ks.push(i);
  const best = new Map();
  let ok = 0, limited = false;
  const res = await Promise.allSettled(ks.map((k) => api(`/paradas/${encodeURIComponent(stops[k].codigo)}/tiempos`, { prioridad: 'baja', maxEdad: 15_000 })));
  if (cancelado()) return { buses: [], ok: 0, total: ks.length, cancelado: true };
  res.forEach((r, n) => {
    if (r.status !== 'fulfilled') { if (r.reason?.status === 429) limited = true; return; }
    if (r.value.upstream_status === 'unavailable') return;
    ok++;
    const k = ks[n];
    for (const t of r.value.tiempos || []) {
      if (lineaFor(t.linea)?.numero !== linea.numero || (t.sentido && t.sentido !== sentido) || t.distancia_metros == null) continue;
      const w = locateOnShape(shape, k, t.distancia_metros);
      if (w.fuera) continue;
      const key = t.vehiculo != null ? `v${t.vehiculo}` : `${w.seg}-${Math.round(w.pos[0] * 2000)}-${Math.round(w.pos[1] * 2000)}`;
      const cur = best.get(key);
      // la medida más fiable es la de la parada más cercana (menos metros por delante)
      if (!cur || t.distancia_metros < cur.dist) best.set(key, { ...w, shape, k, dist: t.distancia_metros, min: t.tiempo_minutos, vehiculo: t.vehiculo, destino: t.destino, hacia: stops[k].nombre });
    }
  });
  alAvanzar?.([...best.values()]);
  return { buses: [...best.values()], ok, total: ks.length, limited, porCalle: shape.porCalle };
}
const busPopup = (b, label) => `<b>Línea ${esc(label)}</b> → ${esc(b.destino)}<br>${b.hacia ? `Llega a ${esc(b.hacia)} en ${b.min <= 0 ? 'nada' : b.min + ' min'}` : `${b.min <= 0 ? 'Llegando' : `Llega en ${b.min} min`} · a ${fmtDist(b.dist)}`}${b.vehiculo ? `<br><span class="muted">Autobús ${esc(b.vehiculo)}</span>` : ''}`;

/* Dibuja una línea completa con sus buses en directo sobre un mapa */
function lineController(bm, markers, { onStatus, onBuses } = {}) {
  let stopLive = null, seq = 0, cur = null;
  async function show(l, sentido) {
    const ruta = await getRuta(l.numero);
    const stops = ruta[sentido] || [];
    const lc = safeColor(l.color, '#555555');
    const shape = getShape(l.numero, sentido, stops);
    bm.source('bs-route', fc([lineF(shape.pts, { color: lc })]));
    // Los puntos de parada se colocan SOBRE la línea (el punto del trazado más cercano a cada parada), no en
    // la coordenada de la acera, para que se vean pegados al recorrido y no flotando a un lado.
    bm.source('bs-route-stops', fc(stops.map((p, i) => pointF(shape.pts[shape.idx[i]] || [p.latitud, p.longitud], { color: lc, codigo: p.codigo }))));
    bm.source('bs-paths', fc([]));
    markers.clear();
    bm.fit(shape.pts, { padding: { top: 120, bottom: 40, left: 30, right: 30 } });
    cur = { l, sentido, stops };
    parar();
    if (!settings.liveLines) { onStatus?.('Autobuses en directo desactivados (botón ' + busIco() + ' del mapa o Ajustes).', true); return; }
    live();
    stopLive = autoRefresh(live, { min: REFRESH_LINE_MIN });
  }
  async function live() {
    if (!cur) return;
    const my = ++seq; const { l, sentido, stops } = cur;
    onStatus?.(`${cargandoMini()} Buscando los autobuses de esta línea…`, true);
    spin(true);
    try {
      const r = await liveBusesLine(l, sentido, stops, (parcial) => {
        if (my !== seq) return;
        markers.sync(parcial.map((b) => ({ ...b, linea: l.numero, color: l.color })), l.numero, l.color, { parcial: true });
        onStatus?.(`${cargandoMini()} Buscando autobuses…${parcial.length ? ` ${parcial.length} encontrado${parcial.length === 1 ? '' : 's'}` : ''}`, true);
      }, () => my !== seq || !settings.liveLines);
      if (my !== seq) return;
      markers.sync(r.buses.map((b) => ({ ...b, linea: l.numero, color: l.color })), l.numero, l.color);
      onBuses?.(r.buses);
      onStatus?.(r.ok === 0
        ? (r.limited ? 'TUSSAM está limitando las consultas. Los autobuses aparecerán en un momento.' : 'No se ha podido saber dónde están los autobuses ahora.')
        : `${r.buses.length ? `${r.buses.length} ${r.buses.length === 1 ? 'autobús' : 'autobuses'} en este sentido` : 'Ahora mismo no hay autobuses en este sentido'} · ${fmtClock()}`);
    } finally { if (my === seq) spin(false); }
  }
  /* Dejar de consultar: se corta también la búsqueda que esté a medias y se para el ⟳ */
  function parar() { stopLive?.(); stopLive = null; seq++; spin(false); window.BusSevBackend.cancelarFondo?.(); }
  function clear() { parar(); cur = null; markers.clear(); bm.source('bs-route', fc([])); bm.source('bs-route-stops', fc([])); }
  return { show, live: () => { if (cur && settings.liveLines) return live(); }, clear, stop: parar, resume: () => { if (cur && !stopLive && settings.liveLines) { live(); stopLive = autoRefresh(live, { min: REFRESH_LINE_MIN }); } }, get current() { return cur; } };
}
/* CARRILES-INI */
/* Reparte en «carriles» los caminos de los buses que vienen a una parada, SOLO en los trozos de calle donde
   de verdad coinciden varias líneas (misma calle y mismo sentido). Donde una línea va sola, su camino va
   centrado, justo encima de la calle. Antes cada línea llevaba el mismo desplazamiento en todo su camino,
   también donde iba sola, y por eso se veía dibujada al lado de la carretera.
   caminos: [{ linea, color, path:[[lat,lon]…] }]  ->  [{ i, pts, carril }]  (i = posición en «caminos») */
function tramosConCarril(caminos) {
  const PASO = 10, CERCA = 16, CELDA = 20, MIN_TRAMO = 60, ANG = 40 * Math.PI / 180;
  // Orden fijo de las líneas (no según qué bus llega antes): así no cambian de lado al refrescar.
  const lineas = [...new Set(caminos.map((c) => String(c.linea)))].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
  if (lineas.length < 2) return caminos.map((c, i) => ({ i, pts: c.path, carril: 0, ancho: 1 }));
  const colorDe = lineas.map((l) => String(caminos.find((c) => String(c.linea) === l).color ?? l));
  const lat0 = caminos[0].path[0][0], kx = 111320 * Math.cos(lat0 * Math.PI / 180), ky = 110540;
  // Cada camino, en puntos cada ~10 m con su rumbo
  const denso = (path) => {
    const out = [];
    for (let i = 0; i + 1 < path.length; i++) {
      const a = path[i], b = path[i + 1];
      const dx = (b[1] - a[1]) * kx, dy = (b[0] - a[0]) * ky, len = Math.hypot(dx, dy);
      if (!(len > 0)) continue;
      const n = Math.max(1, Math.ceil(len / PASO)), ang = Math.atan2(dy, dx);
      for (let k = 0; k < n; k++) { const t = k / n; out.push({ ll: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], ang, paso: len / n }); }
      if (i + 2 === path.length) out.push({ ll: b, ang, paso: 0 });
    }
    for (const q of out) { q.x = q.ll[1] * kx; q.y = q.ll[0] * ky; }
    return out;
  };
  const D = caminos.map((c) => denso(c.path));
  // Rejilla con los puntos del camino más largo de cada línea (los demás buses de la línea van por dentro de él)
  const rej = new Map();
  lineas.forEach((l, li) => {
    let mejor = null;
    caminos.forEach((c, i) => { if (String(c.linea) === l && (!mejor || D[i].length > mejor.length)) mejor = D[i]; });
    for (const q of mejor || []) {
      const k = `${Math.floor(q.x / CELDA)},${Math.floor(q.y / CELDA)}`;
      let cel = rej.get(k); if (!cel) rej.set(k, cel = []);
      cel.push({ x: q.x, y: q.y, ang: q.ang, li });
    }
  });
  const juntas = (q, propia) => {   // máscara de líneas que pasan por aquí en el mismo sentido
    let mask = 1 << propia;
    const cx = Math.floor(q.x / CELDA), cy = Math.floor(q.y / CELDA);
    for (let ix = cx - 1; ix <= cx + 1; ix++) for (let iy = cy - 1; iy <= cy + 1; iy++) {
      const cel = rej.get(`${ix},${iy}`); if (!cel) continue;
      for (const o of cel) {
        if (mask & (1 << o.li)) continue;
        if (Math.hypot(o.x - q.x, o.y - q.y) > CERCA) continue;
        let d = Math.abs(o.ang - q.ang) % (2 * Math.PI); if (d > Math.PI) d = 2 * Math.PI - d;
        if (d <= ANG) mask |= 1 << o.li;
      }
    }
    return mask;
  };
  const salida = [];
  caminos.forEach((c, i) => {
    const pts = D[i];
    if (pts.length < 2) { salida.push({ i, pts: c.path, carril: 0, ancho: 1 }); return; }
    const li = lineas.indexOf(String(c.linea));
    const car = pts.map((q) => {
      const mask = juntas(q, li);
      let n = 0, pos = 0;
      for (let b = 0; b < lineas.length; b++) if (mask & (1 << b)) { if (b === li) pos = n; n++; }
      // Con más de 4 líneas juntas, las del MISMO color comparten franja (de todos modos no se distinguirían):
      // así cada color se ve bien ancho en vez de quedar tapado por varias líneas iguales.
      if (n > 4) {
        const vistos = [];
        for (let b = 0; b < lineas.length; b++) if (mask & (1 << b)) { if (!vistos.includes(colorDe[b])) vistos.push(colorDe[b]); }
        n = vistos.length; pos = vistos.indexOf(colorDe[li]);
      }
      // Hasta 4 líneas van una al lado de otra con su grosor normal. Con más, el conjunto no crece (se saldría
      // de la calzada): cada línea se hace más fina y se reparten el mismo hueco, así se ven TODAS como franjas
      // de su color en vez de taparse unas a otras.
      const paso = n > 4 ? 3 / (n - 1) : 1;                       // separación entre vecinas, en «carriles»
      const ancho = n > 4 ? Math.max(0.3, (paso * 6 - 0.6) / 5) : 1;   // grosor respecto al normal
      return Math.round((pos - (n - 1) / 2) * paso * 1000) / 1000 + '|' + Math.round(ancho * 100) / 100;
    });
    // Tramos seguidos con el mismo carril; los muy cortos (un cruce, un hueco) se funden con el de al lado
    let runs = [];
    for (let k = 0; k < pts.length; k++) {
      const u = runs[runs.length - 1];
      if (u && u.carril === car[k]) { u.fin = k; u.m += pts[k].paso; } else runs.push({ ini: k, fin: k, carril: car[k], m: pts[k].paso });
    }
    for (let cambio = true; cambio && runs.length > 1;) {
      cambio = false;
      for (let r = 0; r < runs.length; r++) {
        if (runs[r].m >= MIN_TRAMO) continue;
        const v = runs[r - 1] && runs[r + 1] ? (runs[r - 1].m >= runs[r + 1].m ? r - 1 : r + 1) : (runs[r - 1] ? r - 1 : r + 1);
        runs[v].ini = Math.min(runs[v].ini, runs[r].ini); runs[v].fin = Math.max(runs[v].fin, runs[r].fin); runs[v].m += runs[r].m;
        runs.splice(r, 1); cambio = true; break;
      }
      const f = [];
      for (const r of runs) { const u = f[f.length - 1]; if (u && u.carril === r.carril) { u.fin = r.fin; u.m += r.m; } else f.push(r); }
      runs = f;
    }
    runs.forEach((r, n) => {
      const hasta = n + 1 < runs.length ? r.fin + 1 : r.fin;   // comparte un punto con el tramo siguiente (sin huecos)
      const t = pts.slice(r.ini, hasta + 1).map((q) => q.ll);
      if (t.length > 1) { const [ca, an] = String(r.carril).split('|').map(Number); salida.push({ i, pts: t, carril: ca, ancho: an }); }
    });
  });
  return salida;
}
/* CARRILES-FIN */
/* Dibuja los buses que vienen a una parada y su camino */
function drawApproaching(bm, markers, buses) {
  const conPath = buses.filter((b) => b.path?.length > 1);
  // Cada camino va centrado sobre su calle; solo donde coinciden varias líneas se separan en paralelo.
  const tramos = tramosConCarril(conPath.map((b) => ({ linea: String(b.linea ?? b.color), color: safeColor(b.color, '#3d8bfd'), path: b.path })));
  bm.source('bs-paths', fc(tramos.map((t) => lineF(t.pts, { color: safeColor(conPath[t.i].color, '#3d8bfd'), carril: t.carril, ancho: t.ancho }))));
  markers.sync(buses);
}

/* ================================================================== */
/* Vistas                                                              */
/* ================================================================== */
const views = {};
const TABS = ['favoritas', 'mapa', 'lineas', 'tarjeta', 'cerca'];
let active = { name: null, cleanup: null, refresh: null, rerender: null };
let lastTab = 'favoritas';
let routeCount = 0;
const goBack = () => { if (routeCount > 1) history.back(); else location.hash = lastTab; };
const spin = (on) => $('#btn-refresh').classList.toggle('spinning', !!on);

/* Autobuses nocturnos (Búho): se enseñan en Favoritas desde las 23:50 (poco antes de que empiecen a salir)
   hasta las 6 de la mañana, con su última hora */
function esHoraNoche(d = new Date()) { const h = d.getHours(); return h < 6 || (h === 23 && d.getMinutes() >= 50); }
function lineasNocturnas() {
  return [...cache.lineaByNum.values()]
    .filter((l) => l.nocturna || /^A\d/.test(String(l.numero || '')))
    .sort((a, b) => String(a.numero).localeCompare(String(b.numero), 'es', { numeric: true }));
}
function nocturnasHTML() {
  if (!esHoraNoche()) return '';
  const ls = lineasNocturnas();
  if (!ls.length) return '';
  const rows = ls.map((l) => {
    const fin = horasHoy(l, 1).fin || horasHoy(l, 2).fin;
    return `<a class="row" href="#linea-${esc(l.numero)}">${badge(l.numero, l.color)}<div class="row-main"><b>${esc(l.nombre)}</b><span>${fin ? `Último bus sobre las ${esc(fin)}` : 'Autobús nocturno'}</span></div>${ICON.chev}</a>`;
  }).join('');
  return `<div class="set-group"><h3>🌙 Autobuses nocturnos</h3><div class="list">${rows}</div><p class="small muted" style="margin:.4rem 0 0">Las líneas Búho circulan de madrugada. Toca una para ver su recorrido y los tiempos.</p></div>`;
}

/* Sin conexión: aviso en Favoritas de que los horarios son orientativos, no en tiempo real */
function offlineHTML() {
  if (navigator.onLine !== false) return '';
  return `<div class="dia-aviso dia-offline">📴 <span>Sin conexión: estos <b>no son los tiempos reales</b>. Son los últimos guardados y pueden no ser exactos.</span></div>`;
}

/* ---------- Favoritas ---------- */
views.favoritas = (el) => {
  let stop = null, loading = false, results = null, dead = false;
  // Últimos tiempos guardados (< 10 min) para enseñarlos al instante al abrir, en vez de «Cargando…»
  const recientes = (codigo) => tiemposGuardados(codigo, 600000);
  function paint() {
    const list = favs.list();
    if (!list.length) {
      el.innerHTML = `<div class="page-head"><h1>Favoritas</h1></div><div id="fav-bajada">${window.bajadaHTML?.() || ''}</div>` + emptyHTML(ICON.star, 'Aún no tienes paradas favoritas', 'Abre una parada (desde el mapa, el buscador o Cerca) y pulsa la estrella. Luego podrás ponerle nombre, color y elegir qué líneas ver.', '<a class="btn" href="#mapa">Buscar en el mapa</a><a class="btn ghost" href="#avisos">Avisos de TUSSAM</a>');
      return false;
    }
    const avs = window.avisos ? avisos.list() : [];
    const cards = list.map((f) => {
        const p = cache.paradaByCode.get(f.codigo) || { codigo: f.codigo, nombre: f.nombre };
        const r = results?.get(f.codigo);
        if (r && r.status === 'fulfilled') return stopCardHTML(p, { tiempos: r.value.tiempos || [], status: r.value.upstream_status || 'ok', limit: 5, fav: f });
        // Sin respuesta fresca todavía (o falló): si hay tiempos guardados recientes, se enseñan ya
        const u = recientes(f.codigo);
        if (u) return stopCardHTML(p, { tiempos: u.tiempos || [], status: 'ok', limit: 5, fav: f });
        if (r && r.status === 'rejected') return stopCardHTML(p, { tiempos: [], status: 'error', fav: f });
        return stopCardHTML(p, { fav: f });
      }).join('');
    const marco = `${list.map((f) => f.codigo).join(',')}|${avs.map((a) => a.id + ':' + a.at).join(',')}`;
    if (el.__marco === marco && $('#fav-cards', el)) {
      setHTML($('#fav-cards', el), cards);
      const nb = $('#fav-noche', el); if (nb) setHTML(nb, nocturnasHTML());
      const fb = $('#fav-fiesta', el); if (fb) setHTML(fb, saludoFiestaHTML());
      const sb = $('#fav-saldo', el); if (sb) setHTML(sb, tarjetasBajasHTML());
      const cd = $('#fav-caduca', el); if (cd) setHTML(cd, tarjetasCaducanHTML());
      const ob = $('#fav-offline', el); if (ob) setHTML(ob, offlineHTML());
      $('#fav-upd', el).textContent = results ? `Actualizado a las ${fmtClock()} · ${refreshNote()}` : '';
      return true;
    }
    el.__marco = marco;
    el.innerHTML = `<div class="stack view-anim"><div class="page-head row-between"><div><h1>Favoritas</h1><p>Tus paradas con los tiempos en directo.</p></div><a class="btn ghost sm" href="#ruta">${ICON.route}Cómo llegar</a></div>
      <div id="fav-bajada">${window.bajadaHTML?.() || ''}</div>
      <div id="fav-offline">${offlineHTML()}</div>
      ${servicioHoyHTML()}
      ${avs.length ? `<div class="set-group"><h3>Avisos de llegada</h3>${avs.map((a) => `<div class="row-flat"><a class="av-ll-link" href="#parada-${esc(a.codigo)}">${badge(a.linea, lineaFor(a.linea)?.color, { sm: true })}<div style="flex:1;min-width:0"><b>${esc(a.parada)}</b><p class="help">Cuando falten ${a.antes} min · sobre las ${new Date(a.at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p></div></a><button class="back-btn" type="button" data-av-del="${a.id}" aria-label="Quitar aviso">${ICON.close}</button></div>`).join('')}</div>` : ''}
      <div id="fav-fiesta">${saludoFiestaHTML()}</div>
      <div id="fav-noche">${nocturnasHTML()}</div>
      <div id="fav-avisos"></div>
      <div id="fav-saldo">${tarjetasBajasHTML()}</div>
      <div id="fav-caduca">${tarjetasCaducanHTML()}</div>
      <div class="stack" id="fav-cards">${cards}</div>
      <p class="updated" id="fav-upd">${results ? `Actualizado a las ${fmtClock()} · ${refreshNote()}` : ''}</p>
      <p class="small muted" style="text-align:center;margin:0">Toca un autobús para que te avise cuando esté llegando.</p></div>`;
    $('#fav-cards', el).__h = cards;
    el.querySelectorAll('[data-av-del]').forEach((b) => { b.onclick = async () => { await avisos.cancelar(Number(b.dataset.avDel)); toast('Aviso quitado'); paint(); }; });
    pintarAvisos();
    return true;
  }
  async function load() {
    const list = favs.list();
    if (!list.length || loading) return;
    loading = true; spin(true);
    if (!results) results = new Map();
    try {
      getLineas().catch(() => null);   // en paralelo: no bloquea los tiempos
      // Cada parada se pinta en cuanto responde, sin esperar a las demás (antes se esperaba a todas)
      await Promise.all(list.map(async (f) => {
        try {
          const v = await api(`/paradas/${encodeURIComponent(f.codigo)}/tiempos`);
          results.set(f.codigo, { status: 'fulfilled', value: v });
          ultimosTiempos.set(f.codigo, v.tiempos || []); window.avisos?.actualizar(f.codigo, v.tiempos);
        } catch (e) {
          results.set(f.codigo, { status: 'rejected', reason: e });
        }
        if (!dead) paint();
      }));
      const vals = [...results.values()];
      const failed = vals.filter((r) => r.status === 'rejected');
      if (failed.length === vals.length && failed.length) { const u = $('#fav-upd', el); if (u) u.textContent = failed[0].reason.message; }
    } finally { loading = false; spin(false); }
  }
  function pintarAvisos() {
    if (settings.avisosResumen !== false) window.avisosTussam?.favoritasHTML().then((h) => setHTML($('#fav-avisos', el), h)).catch(() => null);
  }
  window.addEventListener('bussev-avisos', pintarAvisos);
  getParadas().then(() => { if (paint()) load(); actualizarWidget(); }).catch(() => { if (paint()) load(); });
  getLineas().then(() => { if (!dead) { const nb = $('#fav-noche', el); if (nb) setHTML(nb, nocturnasHTML()); } }).catch(() => null);
  stop = autoRefresh(load);
  active.rerender = () => { el.__marco = null; if (paint()) load(); };
  return { cleanup: () => { dead = true; stop?.(); window.removeEventListener('bussev-avisos', pintarAvisos); }, refresh: load };
};

/* ---------- Mapa: paradas, línea elegida y hoja inferior ---------- */
const mapState = { bm: null, me: null, sel: null, pin: null, markers: null, lineMarkers: null, line: null, stopTimer: null, reload: null, linea: null, sentido: 1 };
/* La hoja de la parada se pliega tocando la barrita o deslizando hacia abajo */
function bindSheetGestures(sheet) {
  const alto = () => sheet.offsetHeight || 400;
  const snaps = () => [0, Math.round(alto() * 0.42), alto() - 124];   // completo, mitad, pequeño
  let y = snaps()[1];
  const poner = (v, anim = true) => {
    const [, , peq] = snaps();
    y = Math.max(0, Math.min(peq, v));
    sheet.classList.toggle('dragging', !anim);
    sheet.style.transform = `translateY(${y}px)`;
    sheet.classList.toggle('collapsed', y >= peq - 4);
    mapState.sheetVisible = alto() - y;
    $('#sh-grip')?.setAttribute('aria-expanded', String(y < peq - 4));
  };
  mapState.sheetTo = (n) => poner(snaps()[n]);
  mapState.sheetCollapsed = () => y >= snaps()[2] - 4;
  poner(y, false);
  requestAnimationFrame(() => poner(snaps()[1]));
  $('#sh-grip').onclick = () => { const [, mid, peq] = snaps(); poner(y >= peq - 4 ? mid : y > 4 ? 0 : peq); };
  let y0 = null, ys = 0, t0 = 0;
  const down = (e) => { if (e.target.closest('button:not(#sh-grip),a')) return; y0 = e.clientY; ys = y; t0 = performance.now(); e.currentTarget.setPointerCapture?.(e.pointerId); };
  const move = (e) => { if (y0 == null) return; poner(ys + (e.clientY - y0), false); };
  const up = (e) => {
    if (y0 == null) return;
    const dy = e.clientY - y0, vel = dy / Math.max(1, performance.now() - t0);
    y0 = null;
    if (Math.abs(dy) < 6) return;   // ha sido un toque, no un arrastre
    const sn = snaps();
    // El destino se calcula desde la posición ACTUAL (y), no desde donde empezó el arrastre:
    // así, al bajar la hoja del todo, se queda abajo en vez de rebotar a la mitad.
    let destino;
    if (vel > 0.5) destino = sn.find((v) => v > y + 4) ?? sn[sn.length - 1];        // lanzada hacia abajo → siguiente tope por debajo (o el más bajo)
    else if (vel < -0.5) destino = [...sn].reverse().find((v) => v < y - 4) ?? sn[0]; // lanzada hacia arriba → siguiente tope por encima (o arriba del todo)
    else destino = sn.reduce((best, v) => (Math.abs(v - y) < Math.abs(best - y) ? v : best), sn[0]); // sin impulso → el tope más cercano
    poner(destino);
  };
  for (const zone of [$('#sh-grip'), $('#sh-head')]) {
    zone.addEventListener('pointerdown', down);
    zone.addEventListener('pointermove', move);
    zone.addEventListener('pointerup', up);
    zone.addEventListener('pointercancel', up);
  }
}
function closeSheet() {
  mapState.stopTimer?.(); mapState.stopTimer = null;
  mapState.sel = null;
  mapState.markers?.clear();
  mapState.bm?.source('bs-paths', fc([]));
  if (mapState.pin) { mapState.pin.remove(); mapState.pin = null; }
  $('#map-sheet').hidden = true;
  if (mapState.linea) mapState.line.resume();   // los buses de zona están desactivados: solo se ven al elegir línea
}
function selectStop(p) {
  const bm = mapState.bm;
  const sheet = $('#map-sheet');
  mapState.sel = p;
  mapState.stopTimer?.();
  if (mapState.linea) mapState.line.stop();
  mapState.zona?.ocultar();
  mapState.markers.clear();
  if (mapState.pin) mapState.pin.setLngLat(ll([p.latitud, p.longitud]));
  else mapState.pin = marker(bm, [p.latitud, p.longitud], stopPinEl(), null);
  const fb = favButton(p, () => {});
  sheet.hidden = false;
  sheet.classList.remove('collapsed');
  sheet.innerHTML = `<button class="sheet-grip-btn" type="button" id="sh-grip" aria-label="Plegar o desplegar"><span class="sheet-grip"></span></button>
    <div class="sheet-head" id="sh-head">
      <div style="flex:1;min-width:0"><h3>${esc(p.nombre)}</h3><p>Parada ${esc(p.codigo)}${p.direccion_completa ? ' · ' + esc(p.direccion_completa) : ''}</p></div>
      ${fb.html}
      <button class="back-btn" type="button" id="sh-close" aria-label="Cerrar">${ICON.close}</button>
    </div>
    <div class="chips-wrap" id="sh-lines" style="margin-top:6px"></div>
    <div id="sh-board"><div class="board-empty" style="border:0">Cargando tiempos…</div></div><p class="updated" id="sh-upd" style="text-align:left"></p>
    <div class="sheet-actions">${settings.voz ? `<button class="btn ghost" type="button" data-speak="${esc(p.codigo)}">🔊 Escuchar</button>` : ''}<a class="btn ghost" href="#parada-${esc(p.codigo)}">Ver parada</a></div>`;
  fb.bind(sheet);
  bindSheetGestures(sheet);
  $('#sh-close').onclick = closeSheet;
  api(`/paradas/${encodeURIComponent(p.codigo)}/lineas`).then((nums) => {
    if (mapState.sel !== p) return;
    $('#sh-lines').innerHTML = nums.map((n) => `<button type="button" class="line-pick" style="opacity:1" data-mapline="${esc(n)}">${badge(n, lineaFor(n)?.color, { sm: true })}</button>`).join('');
    $('#sh-lines').querySelectorAll('[data-mapline]').forEach((b) => { b.onclick = () => { closeSheet(); chooseMapLine(b.dataset.mapline); }; });
  }).catch(() => null);
  bm.m.easeTo({ center: ll([p.latitud, p.longitud]), zoom: Math.max(bm.m.getZoom(), 16), duration: animMs(350) });
  let first = true;
  async function load() {
    if (mapState.sel !== p) return;
    spin(true);
    try {
      const d = await api(`/paradas/${encodeURIComponent(p.codigo)}/tiempos`);
      if (mapState.sel !== p) return;
      await getLineas().catch(() => null);
      ultimosTiempos.set(p.codigo, d.tiempos || []); window.avisos?.actualizar(p.codigo, d.tiempos);
      setHTML($('#sh-board'), boardHTML(d.tiempos, d.upstream_status || 'ok', { limit: 6, codigo: p.codigo }));
      $('#sh-upd').textContent = `${d.upstream_status && d.upstream_status !== 'ok' ? 'TUSSAM no responde' : 'En directo'} · ${fmtClock()}`;
      const buses = await estimateBuses(p.codigo, d.tiempos);
      if (mapState.sel !== p) return;
      drawApproaching(bm, mapState.markers, buses);
      if (first && buses.length) {
        first = false;
        bm.fit([[p.latitud, p.longitud], ...buses.slice(0, 4).map((b) => b.pos)], { padding: { top: 90, left: 40, right: 40, bottom: (mapState.sheetVisible || sheet.offsetHeight * 0.58) + 30 }, anim: true });
      }
    } catch (e) {
      if (mapState.sel !== p) return;
      if (e.status === 429) {
        $('#sh-board').innerHTML = cargandoHTML('TUSSAM va saturado', 'Lo intentamos de nuevo en unos segundos…');
        setTimeout(() => { if (mapState.sel === p) load(); }, Math.max(4000, window.BusSevBackend.pausa + 500));
      } else $('#sh-board').innerHTML = `<div class="board-empty" style="border:0">${esc(e.message)}</div>`;
    } finally { spin(false); }
  }
  load();
  mapState.reload = load;
  mapState.stopTimer = autoRefresh(load);
}
function renderLineBar() {
  const bar = $('#map-linebar');
  if (!mapState.linea) {
    bar.innerHTML = `<button class="map-chip" type="button" id="ml-pick">${ICON.route}<span class="txt">Ver una línea</span></button><a class="map-chip" href="#ruta">${ICON.pin}<span class="txt">Cómo llegar</span></a>`;
    $('#ml-pick').onclick = pickLineModal;
    return;
  }
  const l = mapState.linea;
  getRuta(l.numero).then((ruta) => {
    const sentidos = Object.keys(ruta).map(Number).filter((s) => ruta[s]?.length).sort();
    const lastName = (s) => ruta[s]?.[ruta[s].length - 1]?.nombre || `Sentido ${s}`;
    const same = sentidos.length > 1 && new Set(sentidos.map(lastName)).size === 1;
    bar.innerHTML = `<div class="map-linecard">
      <div class="top">${badge(l.numero, l.color, { sm: true })}<b>${esc(l.nombre)}</b>
        <button class="x" type="button" id="ml-change" aria-label="Elegir otra línea">${ICON.route}</button>
        <button class="x" type="button" id="ml-close" aria-label="Quitar la línea del mapa">${ICON.close}</button></div>
      ${sentidos.length > 1 ? `<div class="seg">${sentidos.map((s) => `<button type="button" data-ms="${s}" aria-pressed="${s === mapState.sentido}" aria-label="${esc(same ? (s === 1 ? 'Ida' : 'Vuelta') : 'Hacia ' + lastName(s))}">${same ? `<span class="dst">${s === 1 ? 'Ida' : 'Vuelta'}</span>` : `<small>Hacia</small><span class="dst">${esc(lastName(s))}</span>`}</button>`).join('')}</div>` : ''}
      <div class="live" id="ml-live"></div></div>`;
    $('#ml-close').onclick = () => { mapState.line.clear(); mapState.linea = null; renderLineBar(); };
    $('#ml-change').onclick = pickLineModal;
    bar.querySelectorAll('[data-ms]').forEach((b) => { b.onclick = () => { mapState.sentido = Number(b.dataset.ms); renderLineBar(); mapState.line.show(l, mapState.sentido); }; });
  });
}
async function chooseMapLine(numero) {
  await getLineas().catch(() => null);
  const l = lineaFor(numero);
  if (!l) return;
  if (location.hash !== '#mapa') { mapState.pending = l.numero; location.hash = 'mapa'; return; }
  const ruta = await getRuta(l.numero);
  mapState.linea = l;
  mapState.zona?.ocultar();
  mapState.sentido = ruta[mapState.sentido]?.length ? mapState.sentido : Number(Object.keys(ruta)[0]);
  renderLineBar();
  mapState.line.show(l, mapState.sentido);
}
async function pickLineModal() {
  const lineas = await getLineas().catch(() => []);
  openModal(`<h2>¿Qué línea quieres ver?</h2><p class="help">Verás su recorrido y dónde están ahora sus autobuses.</p>
    <div class="line-grid">${lineas.map((l) => `<button class="line-pick" style="opacity:1" type="button" data-pl="${esc(l.numero)}" aria-label="Línea ${esc(l.numero)}: ${esc(l.nombre)}">${badge(l.numero, l.color)}</button>`).join('')}</div>`,
  (m, close) => { m.querySelectorAll('[data-pl]').forEach((b) => { b.onclick = () => { close(); closeSheet(); chooseMapLine(b.dataset.pl); }; }); });
}
let mapCompleto = false;
function mapaPantallaCompleta(on) {
  mapCompleto = on;
  document.documentElement.classList.toggle('mapa-tab-completo', on);
  document.documentElement.classList.toggle('con-mapa-completo', on);
  const b = $('#btn-mapfull');
  if (b) { b.innerHTML = on ? ICON.close : ICON.expand; b.setAttribute('aria-label', on ? 'Salir de pantalla completa' : 'Ver el mapa en pantalla completa'); }
  vibrar(10);
  setTimeout(() => mapState.bm?.m.resize(), 60);
}
function pintarBotonBuses() {
  const b = $('#btn-buses');
  if (!b) return;
  b.setAttribute('aria-pressed', String(!!settings.liveLines));
  b.setAttribute('aria-label', settings.liveLines ? 'Ocultar los autobuses en directo' : 'Ver los autobuses en directo');
}
/* Autobuses en directo en la zona del mapa que estás mirando (sin elegir línea).
   Para no saturar a TUSSAM se pregunta solo en 3-4 paradas repartidas por la pantalla
   (cada una da los próximos autobuses de todas sus líneas), y solo con el mapa cerca y a la vista. */
function zonaBuses(bm, markers, onStatus) {
  let seq = 0, parar = null, deb = 0, ultima = null;
  const ZOOM_MIN = 14.3, MAX_PARADAS = 4;
  // Desactivado a propósito: los autobuses en directo solo se muestran al ELEGIR una línea, no en toda la zona del mapa.
  const puede = () => false;
  function ocultar() { seq++; clearTimeout(deb); markers.clear(); onStatus(''); window.BusSevBackend.cancelarFondo?.(); }
  function elegir(lista, centro) {
    if (!lista.length) return [];
    const d = (a, b) => (a.latitud - b[0]) ** 2 + ((a.longitud - b[1]) * 0.8) ** 2;
    const out = [lista.reduce((m, p) => (d(p, centro) < d(m, centro) ? p : m))];
    const n = bm.m.getZoom() >= 16 ? 3 : MAX_PARADAS;
    while (out.length < n && out.length < lista.length) {
      let mejor = null, md = -1;
      for (const p of lista) { const x = Math.min(...out.map((q) => d(p, [q.latitud, q.longitud]))); if (x > md) { md = x; mejor = p; } }
      if (!mejor || md < 1e-6) break;
      out.push(mejor);
    }
    return out;
  }
  async function cargar(forzar = false) {
    if (!puede()) { if (!mapState.sel && !mapState.linea) ocultar(); return; }
    if (!appVisible) return;
    const c = bm.m.getCenter();
    if (bm.m.getZoom() < ZOOM_MIN) { seq++; markers.clear(); onStatus(busIco() + ' Acércate un poco para ver los autobuses', true); return; }
    // Si apenas has movido el mapa y es reciente, no se vuelve a preguntar
    if (!forzar && ultima && Date.now() - ultima.at < 20_000 && haversine([c.lat, c.lng], ultima.c) < 250) return;
    const my = ++seq;
    const b = bm.m.getBounds();
    const lista = (await getParadas().catch(() => [])).filter((p) => b.contains([p.longitud, p.latitud]));
    const elegidas = elegir(lista, [c.lat, c.lng]);
    if (!elegidas.length) { markers.clear(); onStatus('No hay paradas en esta zona'); return; }
    ultima = { at: Date.now(), c: [c.lat, c.lng] };
    if (!markers.items.size) onStatus(`${cargandoMini()} Buscando autobuses en esta zona…`, true);
    const vistos = new Map();
    let ok = 0, limitado = false;
    await Promise.all(elegidas.map((p) => api(`/paradas/${encodeURIComponent(p.codigo)}/tiempos`, { prioridad: 'baja', maxEdad: 25_000 })
      .then(async (d) => {
        ok++;
        const buses = await estimateBuses(p.codigo, d.tiempos);
        for (const x of buses) {
          const k = x.vehiculo != null ? `v${x.vehiculo}` : `${x.linea}|${Math.round(x.pos[0] * 3000)}|${Math.round(x.pos[1] * 3000)}`;
          const cur = vistos.get(k);
          if (!cur || x.dist < cur.dist) vistos.set(k, x);
        }
        if (my === seq && puede()) markers.sync([...vistos.values()], null, null, { parcial: true });
      }).catch((e) => { if (e.status === 429) limitado = true; })));
    if (my !== seq || !puede()) return;
    const todos = [...vistos.values()];
    if (ok) markers.sync(todos);
    onStatus(busIco() + ' ' + (ok === 0
      ? (limitado ? 'TUSSAM va saturado: los autobuses saldrán en un momento' : 'No se ha podido consultar a TUSSAM')
      : `${todos.length ? `${todos.length} ${todos.length === 1 ? 'autobús' : 'autobuses'} cerca` : 'Ningún autobús cerca ahora'} · ${fmtClock()}`), true);
  }
  bm.m.on('moveend', () => { clearTimeout(deb); if (puede()) deb = setTimeout(() => cargar(false), 1300); });
  return {
    cargar, ocultar,
    empezar() { parar?.(); parar = autoRefresh(() => cargar(true), { min: REFRESH_LINE_MIN }); cargar(true); },
    parar() { parar?.(); parar = null; clearTimeout(deb); seq++; window.BusSevBackend.cancelarFondo?.(); },
  };
}
/* «Cómo llegar» con el destino ya puesto (desde el mapa o desde una parada) */
function irARuta(destino) {
  window.rutaPendiente = { destino, buscar: true };
  location.hash = 'ruta';
}
/* Mantener pulsado el mapa (o clic derecho en el ordenador): devuelve [lat, lon] del punto */
function mantenerPulsado(bm, cb) {
  let t = 0, ini = null;
  const parar = () => { clearTimeout(t); t = 0; };
  bm.m.on('touchstart', (e) => {
    parar();
    if ((e.originalEvent?.touches?.length || 1) > 1) return;
    ini = e.point;
    const ll0 = e.lngLat;
    t = setTimeout(() => { t = 0; cb([ll0.lat, ll0.lng]); }, 650);
  });
  bm.m.on('touchmove', (e) => { if (t && ini && (Math.abs(e.point.x - ini.x) > 12 || Math.abs(e.point.y - ini.y) > 12)) parar(); });
  for (const ev of ['touchend', 'touchcancel', 'dragstart', 'zoomstart', 'movestart']) bm.m.on(ev, parar);
  bm.m.on('contextmenu', (e) => { parar(); cb([e.lngLat.lat, e.lngLat.lng]); });
}
views.mapa = (el) => {
  if (!mapState.bm) {
    const bm = mapState.bm = createMap($('#map-all', el), SEVILLA, 14);
    if (!bm) return {};
    mapState.markers = new MarkerSet(bm);
    mapState.lineMarkers = new MarkerSet(bm);
    addStopDots(bm, selectStop);
    addRouteLayers(bm);
    addMetroLayer(bm);
    mapState.line = lineController(bm, mapState.lineMarkers, { onStatus: (t, html) => { const n = $('#ml-live'); if (n) { if (html) n.innerHTML = t; else n.textContent = t; } } });
    $('#btn-locate', el).onclick = async () => {
      try {
        const pos = await getPosition(true);
        if (mapState.me) mapState.me.setLngLat(ll(pos)); else mapState.me = marker(bm, pos, meEl(), null, 'center');
        bm.m.easeTo({ center: ll(pos), zoom: 17, duration: animMs(450) });
      } catch (err) { toast(geoErrorText(err)); }
    };
    if (store.get('geoOk', false)) getPosition().then((pos) => { mapState.me = marker(bm, pos, meEl(), null, 'center'); bm.m.jumpTo({ center: ll(pos), zoom: 16 }); }).catch(() => null);
    mantenerPulsado(bm, (pos) => {
      if (settings.modoSencillo) return;
      vibrar(25);
      openModal(`<h2>Este punto del mapa</h2><p class="help">¿Quieres ver cómo llegar aquí en autobús?</p>
        <div class="actions"><button class="btn ghost" type="button" id="mp-x">Cancelar</button><button class="btn" type="button" id="mp-ruta">Cómo llegar aquí</button></div>`, (m, close) => {
        $('#mp-x', m).onclick = close;
        $('#mp-ruta', m).onclick = () => { close(); irARuta({ tipo: 'lugar', nombre: 'Punto elegido en el mapa', pos }); };
      });
    });
    mapState.zona = zonaBuses(bm, new MarkerSet(bm), (t, html) => { const n = $('#map-zona'); if (!n) return; n.hidden = !t; if (html) n.innerHTML = t; else n.textContent = t || ''; });
    renderLineBar();
  } else {
    if (mapState.sel) { mapState.reload?.(); mapState.stopTimer?.(); mapState.stopTimer = autoRefresh(() => mapState.reload?.()); } else if (mapState.linea) mapState.line.resume();
  }
  pintarBotonBuses();
  $('#btn-buses', el).onclick = () => {
    settings.liveLines = !settings.liveLines; saveSettings(); vibrar(12);
    pintarBotonBuses();
    toast(settings.liveLines ? (mapState.linea ? 'Autobuses en directo activados' : 'Activado · elige una línea para ver sus autobuses') : 'Autobuses en directo desactivados');
    if (settings.liveLines) { if (mapState.linea && !mapState.sel) { mapState.line.stop(); mapState.line.resume(); } }
    else { mapState.zona?.ocultar(); mapState.line?.stop(); mapState.lineMarkers?.clear(); spin(false); const n = $('#ml-live'); if (n) n.innerHTML = 'Autobuses en directo desactivados (botón ' + busIco() + ' del mapa).'; }
  };
  $('#btn-mapfull', el).onclick = () => mapaPantallaCompleta(!mapCompleto);
  if (mapState.pending) { const n = mapState.pending; mapState.pending = null; chooseMapLine(n); }
  requestAnimationFrame(() => mapState.bm?.m.resize());
  return {
    back: () => {
      if (mapState.sel) { if (!mapState.sheetCollapsed?.()) mapState.sheetTo?.(2); else closeSheet(); return true; }
      if (mapCompleto) { mapaPantallaCompleta(false); return true; }
      if (mapState.linea) { mapState.line.clear(); mapState.linea = null; renderLineBar(); return true; }
      return false;
    },
    cleanup: () => { mapState.stopTimer?.(); mapState.stopTimer = null; mapState.line?.stop(); mapState.zona?.parar(); if (mapCompleto) mapaPantallaCompleta(false); },
    refresh: () => {
      if (mapState.sel) return mapState.reload?.();
      if (!settings.liveLines) { toast('Los autobuses en directo están desactivados'); return; }
      return mapState.linea ? mapState.line?.live() : null;   // buses solo con una línea elegida
    },
  };
};

/* ---------- Líneas ---------- */
const FAMILIAS = [
  { id: 'todas', label: 'Todas', test: () => true },
  { id: 'urbanas', label: 'Urbanas', test: (l) => /^\d/.test(l.numero) },
  { id: 'circulares', label: 'Circulares', test: (l) => /^C\d/.test(l.numero) },
  { id: 'nocturnas', label: 'Nocturnas', test: (l) => l.nocturna || /^A\d/.test(l.numero) },
  { id: 'otras', label: 'Especiales y tranvía', test: (l) => !/^\d/.test(l.numero) && !/^C\d/.test(l.numero) && !/^A\d/.test(l.numero) },
];
views.lineas = (el) => {
  let fam = store.get('fam', 'todas');
  async function load() {
    el.innerHTML = skeletons(2);
    try {
      const lineas = await getLineas();
      const render = () => {
        const f = FAMILIAS.find((x) => x.id === fam) || FAMILIAS[0];
        const rows = lineas.filter(f.test).map((l) => `<a class="row" href="#linea-${esc(l.numero)}">${badge(l.numero, l.color)}
            <div class="row-main"><b>${esc(l.nombre)}</b><span>${(() => { const h = horasHoy(l); return h.ini && h.fin ? (textoUltimo(h).todaNoche ? `Hoy circula toda la noche` : `Primer y último bus${NOMBRE_TIPO[h.tipo] ? ` (${NOMBRE_TIPO[h.tipo].toLowerCase()})` : ''}: ${esc(h.ini)}–${esc(h.fin)}`) : h.noHoy ? `Hoy no circula` : 'Consulta el recorrido'; })()}</span></div>${ICON.chev}</a>`).join('');
        el.innerHTML = `<div class="stack"><div class="page-head"><h1>Líneas</h1><p>Recorrido, horario y autobuses en directo.</p></div>
          <div class="filters" role="group" aria-label="Tipo de línea">${FAMILIAS.map((x) => `<button class="chip" type="button" data-fam="${x.id}" aria-pressed="${x.id === fam}">${x.label}</button>`).join('')}</div>
          <div class="list">${rows || '<div class="board-empty">No hay líneas en este grupo.</div>'}</div>
          <p class="updated">${lineas.length} líneas de TUSSAM</p></div>`;
        el.querySelectorAll('[data-fam]').forEach((b) => { b.onclick = () => { fam = b.dataset.fam; store.set('fam', fam); render(); }; });
      };
      render();
    } catch (e) { el.innerHTML = errorHTML(e, 'retry-lin'); $('#retry-lin', el).onclick = load; }
  }
  load();
  return {};
};

/* ---------- Detalle de línea ---------- */
views.linea = (el, numero) => {
  let bm = null, dead = false, ctl = null, sentido = 1, avisoListener = null;
  el.innerHTML = backHead(`<div class="grow"><h2>Línea ${esc(numero)}</h2></div>`) + skeletons(2);
  $('.back-btn', el).onclick = goBack;
  async function init() {
    try {
      await getLineas();
      const l = lineaFor(numero);
      if (!l) throw new ApiError(`La línea ${numero} no existe.`, 404);
      const lc = safeColor(l.color, '#555555');
      const ruta = await getRuta(l.numero);
      if (dead) return;
      const sentidos = Object.keys(ruta).map(Number).filter((s) => ruta[s]?.length).sort();
      sentido = sentidos[0];
      const lastName = (s) => ruta[s]?.[ruta[s].length - 1]?.nombre || `Sentido ${s}`;
      const sameEnd = sentidos.length > 1 && new Set(sentidos.map(lastName)).size === 1;
      const segLabel = (s) => (sameEnd ? (s === 1 ? 'Ida' : 'Vuelta') : `Hacia ${lastName(s)}`);
      el.innerHTML = `<div class="stack">
        ${backHead(`<div class="grow" style="display:flex;gap:12px;align-items:flex-start"><div style="margin-top:6px">${badge(l.numero, lc)}</div><div style="min-width:0"><h2 style="margin-top:4px">${esc(l.nombre)}</h2><p id="l-horario"></p></div></div>`)}
        <div id="l-av-banner">${settings.avisosLinea !== false ? (window.avisosTussam?.bannerHTML([l.numero]) || '') : ''}</div>
        ${sentidos.length > 1 ? `<div class="seg" role="group" aria-label="Sentido">${sentidos.map((s) => `<button type="button" data-s="${s}" aria-pressed="${s === sentido}" aria-label="${esc(segLabel(s))}">${sameEnd ? `<span class="dst">${s === 1 ? 'Ida' : 'Vuelta'}</span>` : `<small>Hacia</small><span class="dst">${esc(lastName(s))}</span>`}</button>`).join('')}</div>` : ''}
        <div><div class="map-wrap"><div class="map-box" id="l-map"></div>
          <button class="map-buses-btn" type="button" id="l-buses" aria-pressed="${settings.liveLines}" aria-label="${settings.liveLines ? 'Ocultar los autobuses en directo' : 'Ver los autobuses en directo'}"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="15" rx="3" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M4 11h16M8 21v-3M16 21v-3" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><circle cx="8" cy="14.5" r="1.1" fill="currentColor"/><circle cx="16" cy="14.5" r="1.1" fill="currentColor"/><path class="tachon" d="M3 3l18 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button><a id="l-desvio" class="map-desvio" href="#avisos" hidden>⚠️ Posible desvío · ver aviso</a></div><p class="live-note" id="l-live"></p></div>
        <a class="btn ghost block" href="#mapa" id="l-open-map">${ICON.route}Ver en el mapa grande</a>
        <p class="live-note" style="margin:0"><img class="lg-busimg" src="${busImg()}" alt="" style="height:16px;vertical-align:-3px"> = parada a la que se acerca un autobús (y los minutos que le faltan) · Nº = número de la parada (el del poste)</p>
        <ol class="timeline" id="l-stops" style="--lc:${lc}"></ol>
      </div>`;
      $('.back-btn', el).onclick = goBack;
      $('#l-open-map', el).onclick = (e) => { e.preventDefault(); mapState.sentido = sentido; chooseMapLine(l.numero); };
      // #25 Botón para encender/apagar los autobuses en directo también en la pestaña Líneas
      $('#l-buses', el).onclick = () => {
        settings.liveLines = !settings.liveLines; saveSettings(); vibrar(12);
        const on = settings.liveLines, b = $('#l-buses', el);
        b.setAttribute('aria-pressed', String(on));
        b.setAttribute('aria-label', on ? 'Ocultar los autobuses en directo' : 'Ver los autobuses en directo');
        pintarBotonBuses();   // mantiene en sincronía el botón del mapa principal
        toast(on ? 'Autobuses en directo activados' : 'Autobuses en directo desactivados');
        if (ctl && bm) bm.ready.then(() => { if (!dead) ctl.show(l, sentido); }); else drawTimeline([]);
      };
      bm = createMap($('#l-map', el), SEVILLA, 12);
      /* Nombre en dos líneas: «Camino de los Descubrimientos» y debajo «Torre Sevilla» */
      const partirNombre = (n) => { const m = String(n).match(/^(.*?)\s*\(([^()]+)\)\s*$/); return m ? [m[1], m[2]] : [String(n), '']; };
      const lpp = new Map();   // parada -> líneas que paran (sin esta)
      let ultimosBuses = [];
      const cargarLpp = async () => {
        const stops = ruta[sentido] || [];
        await Promise.all(stops.filter((p) => !lpp.has(p.codigo)).map(async (p) => {
          const ls = await api(`/paradas/${encodeURIComponent(p.codigo)}/lineas`).catch(() => []);
          lpp.set(p.codigo, ls.map((n) => lineaFor(n)?.numero || String(n)).filter((n) => n !== l.numero).sort(ordenLineas));
        }));
        if (!dead) drawTimeline(ultimosBuses);
      };
      const drawTimeline = (buses = []) => {
        ultimosBuses = buses;
        const stops = ruta[sentido] || [];
        const bySeg = new Map();
        for (const b of buses) { if (!bySeg.has(b.seg)) bySeg.set(b.seg, []); bySeg.get(b.seg).push(b); }
        $('#l-stops', el).innerHTML = stops.map((p, i) => {
          const bs = bySeg.get(i) || [];
          const mins = bs.map((b) => b.min).sort((x, y) => x - y);
          const llega = !bs.length ? '' : mins[0] <= 0 ? 'llegando' : `${mins.filter((x) => x > 0).slice(0, 2).join(' · ')} min`;
          const [nom, sub] = partirNombre(p.nombre);
          const otras = lpp.get(p.codigo) || [];
          return `<li><a href="#parada-${esc(p.codigo)}"><span class="dot${bs.length ? ' bus' : ''}"></span><span class="tl-txt"><b>${esc(nom)}</b>${sub ? `<span class="tl-sub">${esc(sub)}</span>` : ''}${otras.length ? `<span class="tl-lineas">${otras.slice(0, 8).map((n) => badge(etiquetaLinea(n), lineaFor(n)?.color, { sm: true })).join('')}${otras.length > 8 ? `<span class="tl-mas">+${otras.length - 8}</span>` : ''}</span>` : ''}</span><span class="tl-der">${bs.length ? `<span class="bus-tag">${llega}</span>` : ''}<span class="num-tag">Nº ${esc(p.codigo)}</span></span></a></li>`;
        }).join('') || '<li class="board-empty">No hay paradas para este sentido.</li>';
      };
      if (bm) {
        addRouteLayers(bm);
        bm.m.on('click', 'bs-route-stops', (e) => { const c = e.features?.[0]?.properties?.codigo; if (c) location.hash = `parada-${c}`; });
        ctl = lineController(bm, new MarkerSet(bm), { onStatus: (t, html) => { const n = $('#l-live', el); if (n) { if (html) n.innerHTML = t; else n.textContent = t; } }, onBuses: drawTimeline });
      }
      const draw = () => {
        const stops = ruta[sentido] || [];
        const h = horasHoy(l, sentido);
        const pre = NOMBRE_TIPO[h.tipo] ? `${NOMBRE_TIPO[h.tipo]}: ` : '';
        $('#l-horario', el).textContent = h.ini && h.fin ? `${pre}primer bus ${h.ini} · ${textoUltimo(h).txt} · ${stops.length} paradas`.replace(/^p/, 'P')
          : h.noHoy ? `${NOMBRE_TIPO[h.tipo] || 'Hoy'}: no circula · ${stops.length} paradas` : `${stops.length} paradas`;
        drawTimeline(); cargarLpp();
        el.querySelectorAll('[data-s]').forEach((b) => b.setAttribute('aria-pressed', Number(b.dataset.s) === sentido));
        if (ctl) bm.ready.then(() => { if (!dead) ctl.show(l, sentido); });
      };
      el.querySelectorAll('[data-s]').forEach((b) => { b.onclick = () => { sentido = Number(b.dataset.s); draw(); }; });
      active.refresh = () => ctl?.live();
      draw();
      // #56 Desvíos: si esta línea tiene un aviso de TUSSAM, se marca en el mapa (recorrido discontinuo + pastilla)
      const pintarDesvio = () => {
        if (dead) return;
        const avs = window.avisosTussam?.avisosDeLinea?.(l.numero) || [];
        const banner = $('#l-av-banner', el); if (banner) setHTML(banner, settings.avisosLinea !== false ? (window.avisosTussam?.bannerHTML([l.numero]) || '') : '');
        const pill = $('#l-desvio', el);
        if (pill) { pill.hidden = !avs.length; if (avs.length) pill.onclick = (e) => { e.preventDefault(); window.avisosTussam?.abrir?.(avs[0].id); }; }
        if (bm && avs.length) bm.ready?.then(() => { if (!dead) { try { bm.m.setPaintProperty('bs-route', 'line-dasharray', [2, 1.5]); } catch { /* el estilo aún no está */ } } });
      };
      pintarDesvio();
      avisoListener = pintarDesvio;
      window.addEventListener('bussev-avisos', pintarDesvio);
      window.avisosTussam?.revisar?.().catch(() => null);   // asegura que los avisos estén cargados
    } catch (e) {
      if (dead) return;
      el.innerHTML = backHead() + errorHTML(e, 'retry-l');
      $('.back-btn', el).onclick = goBack;
      $('#retry-l', el).onclick = init;
    }
  }
  init();
  return { cleanup: () => { dead = true; if (avisoListener) window.removeEventListener('bussev-avisos', avisoListener); ctl?.clear(); bm?.remove(); } };
};

/* ---------- Detalle de parada ---------- */
/* Últimos tiempos que se vieron de una parada, si son de hace poco (o si no hay conexión): para enseñar
   algo al momento mientras llega la respuesta nueva de TUSSAM. */
function tiemposGuardados(codigo, maxMs) {
  const u = window.BusSevBackend?.ultimo?.(codigo);
  if (!u || !u.cached_at) return null;
  return (navigator.onLine === false || Date.now() - Date.parse(u.cached_at) < maxMs) ? u : null;
}
/* Líneas elegidas en una parada: si es favorita, las de la favorita (se comparten con Favoritas) */
const lineasParada = {
  get(c) { const f = favs.get(c); return f ? (f.lineas || []) : (store.get('paradaLineas', {})[c] || []); },
  set(c, l) {
    if (favs.has(c)) { favs.update(c, { lineas: l }); return; }
    const m = store.get('paradaLineas', {});
    if (l.length) m[c] = l; else delete m[c];
    const ks = Object.keys(m); if (ks.length > 150) delete m[ks[0]];
    store.set('paradaLineas', m);
  },
};
views.parada = (el, codigo) => {
  let stop = null, bm = null, markers = null, info = null, dead = false, first = true, ultimo = null, lineasAqui = [], completo = false, reintento = 0;
  /* Mapa a pantalla completa (el botón Atrás también lo cierra) */
  function pantallaCompleta(on) {
    const w = $('#p-mapwrap', el);
    if (!w) return;
    completo = on;
    w.classList.toggle('mapa-completo', on);
    document.documentElement.classList.toggle('con-mapa-completo', on);
    const b = $('#p-full', el);
    if (b) { b.innerHTML = on ? ICON.close : ICON.expand; b.setAttribute('aria-label', on ? 'Salir de pantalla completa' : 'Ver el mapa en pantalla completa'); }
    vibrar(10);
    setTimeout(() => bm?.m?.resize(), 60);
  }
  el.innerHTML = backHead(`<div class="grow"><h2>Parada ${esc(codigo)}</h2></div>`) + skeletons(2);
  $('.back-btn', el).onclick = goBack;
  function headHTML() {
    const fb = favButton(info, () => paintTools());
    // Accesibilidad de la parada (del GTFS oficial, si TUSSAM lo publica): 1 = accesible, 0 = no accesible.
    const acc = info.accesible === 1
      ? `<span class="pill pill-acc" title="Parada accesible para silla de ruedas">${ICON.silla}Accesible</span>`
      : info.accesible === 0
        ? `<span class="pill pill-acc-no" title="Parada sin acceso para silla de ruedas">${ICON.silla}No accesible</span>`
        : '';
    return { fb, html: backHead(`<div class="grow"><h2>${esc(info.nombre)}</h2><p><span class="stop-num" style="display:inline-grid;height:22px;min-width:0;font-size:15px;vertical-align:-3px">${esc(codigo)}</span> ${esc(info.direccion_completa || '')}</p>${acc}</div>${fb.html}`) };
  }
  function paintTools() {
    const box = $('#p-tools', el);
    if (!box) return;
    const f = favs.get(codigo);
    const ruta = !settings.modoSencillo && info?.latitud ? `<button class="btn ghost" type="button" id="p-ruta">${ICON.route}Cómo llegar aquí</button>` : '';
    box.innerHTML = f ? `<div class="fav-tools"><span class="pill" style="background:var(--accent-soft);color:var(--accent)">★ En favoritas${f.alias ? ': ' + esc(f.alias) : ''}</span><button class="btn ghost" type="button" data-edit-fav="${esc(codigo)}">${ICON.edit}Personalizar</button>${ruta}</div>` : (ruta ? `<div class="fav-tools">${ruta}</div>` : '');
    const br = $('#p-ruta', box);
    if (br) br.onclick = () => irARuta({ tipo: 'parada', nombre: info.nombre, pos: [info.latitud, info.longitud], codigo });
  }
  async function init() {
    try { await getParadas(); info = cache.paradaByCode.get(codigo) || await api(`/paradas/${encodeURIComponent(codigo)}`); } catch (e) {
      if (e.status === 404) { el.innerHTML = backHead() + emptyHTML(ICON.pin, `La parada ${esc(codigo)} no existe`, 'Comprueba el número que aparece en el poste de la parada.'); $('.back-btn', el).onclick = goBack; return; }
      info = { codigo, nombre: `Parada ${codigo}` };
    }
    if (dead) return;
    const h = headHTML();
    el.innerHTML = `<div class="stack">${h.html}<div id="p-tools"></div>
      <div id="p-avisos">${settings.avisosParada !== false ? (window.avisosTussam?.paradaBannerHTML?.(codigo) || '') : ''}</div>
      <section class="card p-info"><h3 class="p-info-tit">Líneas que paran aquí</h3><div class="chips-wrap" id="p-lineas"><span class="muted small">Cargando…</span></div></section>
      <div id="p-filtro" class="lfiltro" hidden></div>
      <article class="card" id="p-board"><div class="board-empty">Cargando tiempos…</div></article>
      <div id="p-horario"></div>
      <div><div class="map-wrap" id="p-mapwrap"><div class="map-box" id="p-map"></div>
          <button class="map-full-btn" type="button" id="p-full" aria-label="Ver el mapa en pantalla completa">${ICON.expand}</button></div>
        <div class="map-legend"><span><i class="lg-stop"></i>Esta parada</span><span><img class="lg-busimg" src="${busImg()}" alt="">Autobús que viene</span><span><i class="lg-path"></i>Camino que le queda</span></div>
        <p class="small muted" id="p-map-note" style="margin:6px 2px 0"></p></div>
    </div>`;
    $('.back-btn', el).onclick = goBack;
    h.fb.bind(el);
    paintTools();
    active.rerender = () => { paintTools(); load(true); };
    $('#p-full', el).onclick = () => pantallaCompleta(!completo);
    // El mapa es lo que más le cuesta al móvil y queda debajo de los tiempos: se monta DESPUÉS de pedirlos y
    // pintarlos (o al cabo de 1,2 s si TUSSAM tarda), para que los minutos salgan cuanto antes.
    const montarMapa = () => {
      if (dead || bm || !$('#p-map', el)) return;
      bm = createMap($('#p-map', el), [info.latitud, info.longitud], 16);
      if (!bm) return;
      markers = new MarkerSet(bm);
      addStopDots(bm, (p) => { if (p.codigo !== codigo) location.hash = `parada-${p.codigo}`; });
      addRouteLayers(bm);
      marker(bm, [info.latitud, info.longitud], stopPinEl(), `<b>${esc(info.nombre)}</b>`);
      if (ultimo) pintar(ultimo, true);   // los autobuses de los tiempos que ya se tienen
    };
    if (!(info.latitud && info.longitud)) $('#p-map', el).parentElement.hidden = true;
    // Horario oficial de esta parada (se carga aparte; si la versión aún no lo trae, no sale nada)
    cargarHorarios().then((H) => { if (dead || !H) return; pintarHorario(); if (ultimo) pintar(ultimo, true); });
    Promise.all([api(`/paradas/${encodeURIComponent(codigo)}/lineas`), getLineas().catch(() => null)]).then(([nums]) => {
      if (dead) return;
      nums = [...nums].sort(ordenLineas);
      $('#p-lineas', el).innerHTML = nums.length ? nums.map((n) => badge(etiquetaLinea(lineaFor(n)?.numero || n), lineaFor(n)?.color, { href: `#linea-${encodeURIComponent(n)}` })).join('') : '<span class="muted small">Sin datos de líneas.</span>';
      setHTML($('#p-avisos', el), settings.avisosParada !== false ? (window.avisosTussam?.paradaBannerHTML?.(codigo, nums) || '') : '');
      lineasAqui = nums.map((n) => lineaFor(n)?.numero || String(n));
      pintarFiltro();
    }).catch(() => { if (!dead) $('#p-lineas', el).innerHTML = '<span class="muted small">No se han podido cargar.</span>'; });
    // Si se acaban de ver los tiempos de esta parada (p. ej. vienes de Favoritas), se enseñan al momento
    // mientras llegan los nuevos, en vez de un «Cargando…».
    const previo = tiemposGuardados(codigo, 120000);
    if (previo) { previo.__at = new Date(previo.cached_at); ultimo = previo; pintarFiltro(); pintar(previo, true); }
    const cargado = load();
    if (info.latitud && info.longitud) Promise.race([cargado, new Promise((ok) => setTimeout(ok, 1200))]).then(montarMapa);
    await cargado;
    stop = autoRefresh(() => load(true));
  }
  function pintarHorario() {
    const box = $('#p-horario', el);
    if (!box || box.querySelector('details[open]')) return;   // si lo estás leyendo, no se toca
    setHTML(box, horarioParadaHTML(codigo));
  }
  /* Chips para elegir qué líneas ver en esta parada */
  function pintarFiltro() {
    const box = $('#p-filtro', el);
    if (!box) return;
    const enTiempos = (ultimo?.tiempos || []).map((t) => lineaFor(t.linea)?.numero || String(t.linea));
    const todas = [...new Set([...enTiempos, ...lineasAqui])].sort(ordenLineas);
    if (todas.length < 2) { box.hidden = true; return; }
    const sel = new Set(lineasParada.get(codigo).map((n) => lineaFor(n)?.numero || String(n)));
    const et = etiquetaLinea;
    setHTML(box, `<span class="lf-tit">Ver líneas</span><div class="lf-chips"><button type="button" class="chip" data-lf="" aria-pressed="${!sel.size}">Todas</button>${todas.map((n) => {
      const c = safeColor(lineaFor(n)?.color, '#555555');
      return `<button type="button" class="chip lchip" data-lf="${esc(n)}" aria-pressed="${sel.has(n)}" style="--lc:${c};--lt:${textOn(c)}"><i></i>${esc(et(n))}</button>`;
    }).join('')}</div>`);
    box.hidden = false;
    box.querySelectorAll('[data-lf]').forEach((b) => { b.onclick = () => {
      const n = b.dataset.lf;
      if (!n) sel.clear(); else if (sel.has(n)) sel.delete(n); else sel.add(n);
      if (sel.size === todas.length) sel.clear();
      lineasParada.set(codigo, [...sel]);
      vibrar(15);
      pintarFiltro(); paintTools();
      if (ultimo) pintar(ultimo, true);
    }; });
  }
  async function pintar(d, rapido = false) {
    const status = d.upstream_status || 'ok';
    const elegidas = lineasParada.get(codigo);
    const tiempos = elegidas.length ? filtrarLineas(d.tiempos, { lineas: elegidas }) : (d.tiempos || []);
    const vacioExtra = window.BUSSEV_HORARIOS ? proximosProgramadosHTML(codigo, elegidas) : '';
    setHTML($('#p-board', el), `${boardHTML(tiempos, status, { codigo, filtrado: elegidas.length > 0, vacioExtra })}
        <div class="meta-row" style="padding-top:10px;border-top:1px solid var(--line)">${status === 'ok' ? freshnessPill(d) : '<span class="pill stale">TUSSAM no responde</span>'}<span>Actualizado <span class="p-hora"></span></span>${settings.voz ? `<button class="link-btn" type="button" data-speak="${esc(codigo)}">🔊 Escuchar</button>` : ''}</div>
        <p class="small muted" style="margin:0;padding:0 14px 12px">Toca un autobús para que te avise cuando esté llegando.</p>`);
      const hora = $('#p-board .p-hora', el); if (hora) hora.textContent = fmtClock(d.__at);
      if (bm) {
        const buses = await estimateBuses(codigo, tiempos);
        if (dead) return;
        await bm.ready;
        drawApproaching(bm, markers, buses);
        if (first && buses.length) { first = false; bm.fit([[info.latitud, info.longitud], ...buses.slice(0, 4).map((b) => b.pos)], { padding: 50 }); }
        $('#p-map-note', el).textContent = buses.length
          ? 'Cada autobús aparece donde está ahora, calculado con la distancia que da TUSSAM. Toca uno para ver cuánto le falta.'
          : 'Cuando haya autobuses en camino, verás aquí por dónde vienen.';
      }
  }
  async function load(quiet = false) {
    if (dead || !info) return;
    spin(true);
    try {
      const d = await api(`/paradas/${encodeURIComponent(codigo)}/tiempos`);
      if (dead) return;
      await getLineas().catch(() => null);
      d.__at = new Date();
      ultimo = d;
      ultimosTiempos.set(codigo, d.tiempos || []); window.avisos?.actualizar(codigo, d.tiempos);
      if (!quiet && first && settings.voz && settings.vozAuto) hablar(textoParaVoz(favs.get(codigo)?.alias || info.nombre, filtrarLineas(d.tiempos, { lineas: lineasParada.get(codigo) })));
      pintarFiltro();
      if (window.BUSSEV_HORARIOS) pintarHorario();
      await pintar(d);
    } catch (e) {
      if (dead) return;
      // TUSSAM pide esperar: se reintenta solo en cuanto deje (sin que tengas que tocar nada)
      if (e.status === 429) { clearTimeout(reintento); reintento = setTimeout(() => { if (!dead) load(true); }, Math.max(4000, window.BusSevBackend.pausa + 500)); }
      if (!ultimo) $('#p-board', el).innerHTML = e.status === 429 ? cargandoHTML('TUSSAM va saturado', 'Lo intentamos de nuevo en unos segundos…') : `<div class="board-empty">${esc(e.message)}</div>`;
      else if (e.status !== 429) toast(e.message);
    } finally { spin(false); }
  }
  init();
  return {
    cleanup: () => { dead = true; clearTimeout(reintento); stop?.(); markers?.clear(); bm?.remove(); document.documentElement.classList.remove('con-mapa-completo'); },
    refresh: () => load(),
    back: () => { if (completo) { pantallaCompleta(false); return true; } return false; },
  };
};

/* ---------- Cerca ---------- */
views.cerca = (el) => {
  let pos = null, stop = null, loading = false, dead = false;
  /* ¿Está encendida la ubicación del móvil? Se pregunta al sistema: la respuesta es instantánea */
  const ubicacionActiva = async () => {
    if (!window.Capacitor?.isPluginAvailable?.('TarjetaNfc')) return true;
    try { return (await window.Capacitor.nativePromise('TarjetaNfc', 'ubicacion', {})).activada !== false; } catch { return true; }
  };
  const avisoGeoOff = () => `<div class="geo-off">${ICON.pin}<div><b>La ubicación del móvil está apagada</b><small>Enciéndela para ver las paradas que tienes cerca. En cuanto la actives, BusSev lo notará sola.</small></div><button class="btn sm" type="button" id="geo-on">Activar</button></div>`;
  const bindGeoOff = () => { $('#geo-on', el)?.addEventListener('click', () => window.Capacitor?.nativePromise('TarjetaNfc', 'ajustesUbicacion', {}).catch(() => toast('Abre los ajustes del móvil y enciende la ubicación.'))); };
  const intro = async () => {
    const on = await ubicacionActiva();
    if (dead) return;
    el.innerHTML = `<div class="stack">${on ? '' : avisoGeoOff()}${emptyHTML(ICON.pin, 'Paradas cerca de ti', 'Usa tu ubicación para ver las paradas más cercanas y cuánto le falta a cada autobús. Es opcional: también puedes buscar la parada arriba.', '<div class="btn-row" style="justify-content:center"><button class="btn" type="button" id="btn-geo">Usar mi ubicación</button><a class="btn ghost" href="#ruta">Cómo llegar</a></div>')}</div>`;
    $('#btn-geo', el).onclick = locate;
    bindGeoOff();
  };
  // Al volver de los ajustes del móvil, se comprueba otra vez sin tener que tocar nada
  const alVolver = async () => { if (dead || pos) return; if (await ubicacionActiva()) { if ($('#geo-on', el)) locate(); } };
  resumeHandlers.add(alVolver);
  async function locate() {
    if (!(await ubicacionActiva())) { if (!dead) { el.innerHTML = `<div class="stack">${avisoGeoOff()}${emptyHTML(ICON.pin, 'Paradas cerca de ti', 'Cuando enciendas la ubicación verás aquí las paradas más cercanas.', '<div class="btn-row" style="justify-content:center"><a class="btn ghost" href="#mapa">Ver el mapa</a><a class="btn ghost" href="#ruta">Cómo llegar</a></div>')}</div>`; bindGeoOff(); } return; }
    el.innerHTML = `<div class="stack view-anim">${cargandoHTML('Buscando paradas cerca de ti…', 'Un momento, localizando tu posición.')}</div>`;
    try { pos = await getPosition(); await load(); stop ??= autoRefresh(() => load(true)); } catch (err) {
      el.innerHTML = emptyHTML(ICON.pin, 'No sabemos dónde estás', esc(geoErrorText(err)), '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center"><button class="btn" type="button" id="btn-geo">Reintentar</button><a class="btn ghost" href="#mapa">Ver el mapa</a></div>');
      $('#btn-geo', el).onclick = locate;
    }
  }
  async function load(quiet = false) {
    if (!pos || loading) return;
    loading = true; spin(true);
    try {
      const [lat, lon] = pos;
      const d = await api(`/cercanas?lat=${lat.toFixed(6)}&lon=${lon.toFixed(6)}&radio=600&max_paradas=6`);
      if (!d.paradas?.length) { el.innerHTML = emptyHTML(ICON.pin, 'No hay paradas a menos de 600 m', 'Prueba a buscar una parada por su nombre o número, o mira el mapa.', '<a class="btn" href="#mapa">Ver el mapa</a>'); return; }
      el.innerHTML = `<div class="stack"><div class="page-head row-between"><div><h1>Cerca de ti</h1><p>Paradas a menos de 600 m.</p></div><a class="btn ghost sm" href="#ruta">${ICON.route}Cómo llegar</a></div>
        ${d.paradas.map((p) => stopCardHTML(p, { tiempos: p.tiempos || [], status: p.tiempos_status, distancia: p.distancia })).join('')}
        <p class="updated">Actualizado a las ${fmtClock()} · ${refreshNote()}</p></div>`;
    } catch (e) {
      if (!quiet) { el.innerHTML = errorHTML(e, 'retry-cerca'); $('#retry-cerca', el).onclick = () => load(); } else toast(e.message);
    } finally { loading = false; spin(false); }
  }
  if (store.get('geoOk', false)) locate(); else intro();
  return { cleanup: () => { dead = true; stop?.(); resumeHandlers.delete(alVolver); }, refresh: () => (pos ? load() : locate()) };
};

/* ---------- Ajustes ---------- */
views.ajustes = (el) => {
  const segBtns = (name, opts, cur) => `<div class="seg" role="group">${opts.map(([v, t]) => `<button type="button" data-set="${name}" data-v="${v}" aria-pressed="${String(cur) === String(v)}">${t}</button>`).join('')}</div>`;
  const sw = (id, on, titulo, texto) => `<div class="switch-row"><div><h3>${titulo}</h3>${texto ? `<p>${texto}</p>` : ''}</div><input class="switch" type="checkbox" data-sw="${id}" ${on ? 'checked' : ''} aria-label="${esc(titulo)}"></div>`;
  const fechaCorta = (d) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  function render() {
    const tem = tematicaActiva();
    const y = new Date().getFullYear();
    const F = fechasTematicas(y), F2 = fechasTematicas(y + 1);
    const prox = (k) => { const [i, f] = F[k][1] >= new Date() ? F[k] : F2[k]; return `${fechaCorta(i)} – ${fechaCorta(f)}`; };
    const dc = window.BusSevBackend?.caduca ? new Date(window.BusSevBackend.caduca + 'T12:00') : null;
    el.innerHTML = `<div class="stack view-anim">
      ${backHead('<div class="grow"><h2>Ajustes</h2></div>')}
      <h2 class="section-title">Apariencia</h2>
      <div class="set-group"><h3>Tema</h3>${segBtns('theme', [['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Oscuro']], settings.theme)}
        <p>Automático sigue el modo claro u oscuro de tu móvil. El oscuro gasta menos batería en pantallas OLED.</p></div>
      <div class="set-group">
        ${sw('tematicaAuto', settings.tematicaAuto, 'Temáticas en fechas festivas', `Cambia sola en Navidad, Semana Santa, Feria y Halloween, con sorpresas el día de Navidad, Nochevieja, Año Nuevo y Reyes. Ahora: <b>${esc(TEMATICAS[tem].nombre)}</b>.`)}
        <div class="tem-grid">${Object.entries(TEMATICAS).map(([k, t]) => `<button type="button" class="tem${tem === k ? ' on' : ''}" data-tem="${k}" aria-pressed="${!settings.tematicaAuto && settings.tematica === k}">
          <span class="tem-prev" data-t="${k}"><img src="/img/buses/${t.bus}.webp" alt="" loading="lazy"></span><b>${esc(t.nombre)}</b>
          <small>${k === 'normal' ? 'Resto del año' : prox(k)}</small></button>`).join('')}</div>
        <p>Toca una para ponerla a mano (se queda hasta que vuelvas a activar el cambio automático). Las fechas de la Feria se calculan a partir de la Semana Santa; si un año no coinciden, ponla a mano.</p>
        <div class="dia-prueba"><b>Ver los días especiales de Navidad</b><small>Solo para ver cómo quedan: vuelve a lo de siempre al cerrar la app.</small>
          <div class="chips">${[['papanoel', '🎅 Navidad'], ['nochevieja', '🍇 Nochevieja'], ['anonuevo', '🎆 Año Nuevo'], ['reyes', '👑 Reyes']].map(([k, t]) => `<button type="button" class="chip${pruebaDia === k ? ' on' : ''}" data-dia="${k}" aria-pressed="${pruebaDia === k}">${t}</button>`).join('')}${pruebaDia ? '<button type="button" class="chip" data-dia="">Quitar</button>' : ''}</div></div>
        ${sw('vehiculosFiesta', settings.vehiculosFiesta, 'Vehículos de fiesta en el mapa', `Cambia los autobuses del mapa según la temática: pasos en Semana Santa, coches de caballos en la Feria, coches de miedo en Halloween, carrozas en Navidad y, el resto del año, el «Butano», el autobús naranja de TUSSAM de toda la vida. Cada autobús lleva uno al azar.${VEHICULOS_FIESTA[tem] ? ` Ahora: <b>${esc(VEHICULOS_FIESTA[tem].nombre)}</b>.` : ''}`)}</div>
      <div class="set-group"><h3>Color de la app</h3>
        <div class="swatches">${Object.entries(PALETTES).map(([k, p]) => `<button class="swatch" type="button" data-color="${k}" aria-pressed="${settings.color === k}" aria-label="${p.label}" style="background:${p[resolvedTheme][0]};color:${p[resolvedTheme][2]}">${settings.color === k ? ICON.check : ''}</button>`).join('')}</div>
        ${tem !== 'normal' ? '<p>Mientras haya una temática puesta, la app usa sus colores. Con la temática Normal vuelve tu color.</p>' : '<p>Los pasteles llevan el texto oscuro encima para que se lea bien.</p>'}</div>
      <div class="set-group"><h3>Color de fondo</h3>
        <div class="fondos">
          <button type="button" class="fondo" data-fondo="" aria-pressed="${!settings.fondo}"><span style="background:${resolvedTheme === 'dark' ? '#111214' : '#f4f4f6'}"></span><small>Normal</small></button>
          ${Object.entries(FONDOS).map(([k, f]) => `<button type="button" class="fondo" data-fondo="${k}" aria-pressed="${settings.fondo === k}"><span style="background:${f.bg};border-color:${f.line}"><i style="background:${f.surface}"></i></span><small>${esc(f.label)}</small></button>`).join('')}
        </div>
        <p>Los cuatro primeros son claros y el resto oscuros: al elegir uno, el tema cambia solo a claro u oscuro.</p></div>
      <div class="set-group"><h3>Mapa</h3>${segBtns('mapStyle', [['oscuro', 'Oscuro'], ['claro', 'Claro'], ['tema', 'Como el tema'], ['satelite', 'Satélite']], settings.mapStyle)}
        <h3 style="margin-top:14px">Qué ver en el mapa</h3>
        ${sw('mapaParadas', settings.mapaParadas !== false, 'Paradas', 'Los puntos de las paradas.')}
        ${sw('mapaRecorridos', settings.mapaRecorridos !== false, 'Recorridos', 'La línea del autobús cuando eliges una.')}
        ${sw('mapaCalles', settings.mapaCalles !== false, 'Nombres de calles', 'Las etiquetas de calles y sitios del mapa.')}
        ${sw('mapaMetro', settings.mapaMetro !== false, 'Metro de Sevilla', 'La línea 1 y sus estaciones (toca una para ver los próximos trenes).')}
        <p class="help">Los autobuses en directo se encienden con el botón <img class="lg-busimg" src="${busImg()}" alt="autobús" style="height:18px;vertical-align:-4px"> del mapa.</p></div>

      <h2 class="section-title">Accesibilidad</h2>
      <div class="set-group">
        ${sw('voz', settings.voz, 'Leer en voz alta', 'Muestra el botón «Escuchar» en las paradas.')}
        ${settings.voz ? sw('vozAuto', settings.vozAuto, 'Leer al abrir una parada', 'Lee los tiempos nada más abrirla.') : ''}
        ${sw('modoSencillo', settings.modoSencillo, 'Modo sencillo', 'Todo más grande y sin adornos: pensado para quien quiere lo justo y claro.')}
        <div class="switch-row"><div><h3>Tamaño del texto</h3><p>Agranda la letra de toda la app.</p></div></div>
        ${segBtns('escalaTexto', [[1, 'Normal'], [1.22, 'Grande'], [1.35, 'Más'], [1.5, 'Máximo']], settings.letraGrande ? settings.escalaTexto : 1)}
        ${sw('botonesGrandes', settings.botonesGrandes, 'Botones más grandes', 'Más fáciles de tocar.')}
        ${sw('altoContraste', settings.altoContraste, 'Alto contraste', 'Textos y bordes más marcados.')}
        ${sw('menosAnimaciones', settings.menosAnimaciones, 'Reducir animaciones', 'Sin movimientos ni transiciones; también ahorra batería.')}
        ${sw('vibrar', settings.vibrar, 'Vibración', 'Al guardar favoritas y al leer la tarjeta.')}
      </div>

      <h2 class="section-title">Tiempos y avisos</h2>
      <div class="set-group"><h3>Actualizar los tiempos</h3>${segBtns('refresh', [[30, 'Cada 30 s'], [60, 'Cada minuto'], [0, 'Al pulsar ⟳']], settings.refresh)}
        <p>Cuanto menos a menudo, menos batería y datos. Con la app en segundo plano nunca se actualiza, y si la dejas abierta sin tocarla va más despacio (cada 2 min, y pasado un cuarto de hora cada 5): en cuanto la tocas, se actualiza al momento.</p></div>
      <div class="set-group">${sw('liveLines', settings.liveLines, 'Autobuses en directo en el mapa', 'Muestra dónde va cada autobús (en las líneas y en la zona del mapa que miras). También se activa con el botón ' + busIco() + ' del mapa.')}</div>
      <div class="set-group"><h3>Revisar al abrir la app</h3>${segBtns('revisarCada', [[0, 'Nunca'], [1, 'Cada hora'], [3, 'Cada 3 h'], [6, 'Cada 6 h']], settings.revisarCada)}
        <p>Comprueba el saldo y la caducidad de tus tarjetas guardadas al abrir la app, como mucho con esta frecuencia, y te avisa si el saldo está bajo.</p></div>
      <div class="set-group"><h3>Avisos de TUSSAM (desvíos, obras, horarios especiales)</h3>${segBtns('avisosTussam', [['mias', 'De mis líneas'], ['todas', 'Todos'], ['no', 'No avisar']], settings.avisosTussam)}
        <p>Notificaciones: al abrir la app (como mucho una vez por hora) mira la web de TUSSAM y te avisa si hay un aviso nuevo. «Mis líneas» son las que paran en tus favoritas.</p>
        <h3 style="margin-top:14px">Dónde ver los avisos en la app</h3>
        ${sw('avisosResumen', settings.avisosResumen !== false, 'Botón en Favoritas', 'El botón «Ver avisos de TUSSAM» arriba de tus favoritas.')}
        ${sw('avisosTarjetas', settings.avisosTarjetas !== false, 'En cada parada favorita', 'Una línea con el aviso dentro de la tarjeta de la parada a la que afecta.')}
        ${sw('avisosParada', settings.avisosParada !== false, 'Al abrir una parada', 'El aviso arriba del todo si afecta a esa parada.')}
        ${sw('avisosLinea', settings.avisosLinea !== false, 'Al abrir una línea', 'El aviso arriba del recorrido de la línea.')}
        <a class="btn ghost" href="#avisos">Ver los avisos</a></div>
      <div class="set-group"><h3>Tarifas y títulos de viaje</h3><p>Los precios actuales de TUSSAM, leídos de su web (se actualizan solos).</p><a class="btn ghost" href="#tarifas">Ver las tarifas</a></div>

      <h2 class="section-title">Tus datos</h2>
      <div class="set-group"><h3>Tu servidor: saldo y tiempos (avanzado)</h3>
        <p>Si has montado tu propio servidor (carpeta <i>servidor-saldo</i>), pega aquí su dirección y BusSev te enseñará el saldo de la tarjeta. Déjalo vacío para no usarlo.</p>
        <div class="field"><input id="s-saldo-url" class="mini-input" style="width:100%" inputmode="url" autocomplete="off" placeholder="https://tu-servidor.deno.dev" value="${esc(settings.saldoURL || '')}"></div>
        <div class="btn-row"><button class="btn ghost" type="button" id="s-saldo-save">Guardar</button>${settings.saldoURL ? '<button class="btn ghost" type="button" id="s-saldo-test">Probar</button>' : ''}</div>${settings.saldoURL ? sw('tiemposServidor', settings.tiemposServidor === true, 'Pedir también los tiempos a mi servidor', 'Normalmente NO funciona: TUSSAM bloquea a los servidores de internet con Cloudflare. Actívalo solo si tu servidor está en un sitio que TUSSAM deja pasar (pulsa «Probar»).') : ''}</div>
      <div class="set-group"><h3>Copia de seguridad</h3>
        <p>Guarda tus favoritas, tarjetas y ajustes en un archivo para no perderlos si cambias de móvil.</p>
        <div class="btn-row"><button class="btn ghost" type="button" id="s-exp">Guardar copia</button><label class="btn ghost" for="s-imp" style="cursor:pointer">Recuperar copia</label></div>
        <input type="file" id="s-imp" accept="application/json,.json" hidden></div>
      <h2 class="section-title">Actualizaciones</h2>
      <div class="set-group">
        <div class="ver-fila"><div><h3>BusSev ${esc(actualizaciones.nombre())}</h3>
          <p>${actualizaciones.version().fecha ? `Compilada el ${new Date(actualizaciones.version().fecha + 'T12:00').toLocaleDateString('es-ES')}. ` : ''}Paradas y recorridos oficiales de TUSSAM${dc ? `, válidos hasta el <b>${dc.toLocaleDateString('es-ES')}</b>` : ''}.</p></div></div>
        <div id="s-ver-res"></div>
        <button class="btn block btn-upd" type="button" id="s-ver">${ICON.actualizar}<span>Buscar actualización</span></button>
        <p>Cada versión nueva lleva ya los horarios y recorridos oficiales más recientes (GitHub los descarga solo del Punto de Acceso Nacional de Transportes, y el día 1 de cada mes revisa si TUSSAM ha publicado otros). Se instala encima, sin perder nada.</p>
        ${sw('avisarVersion', settings.avisarVersion, 'Avisarme si hay una versión nueva', 'Lo mira al abrir la app y cada vez que vuelves a ella.')}
      </div>
      <div class="set-group"><h3>Privacidad y seguridad</h3>
        <p>BusSev solo se conecta con TUSSAM (tiempos, saldo y avisos), con OpenFreeMap (mapa) y, si lo configuras, con tu propio servidor del saldo. No tiene anuncios ni seguimiento. Tus favoritas y tarjetas se guardan solo en este móvil.</p>
        <p>Permisos: internet, ubicación (opcional), NFC (solo con la pestaña Tarjeta abierta) y notificaciones (solo si activas algún aviso).</p></div>
      <div class="set-group"><h3>Datos de líneas y paradas</h3><p>Datos oficiales de TUSSAM ${dc ? `válidos hasta el ${dc.toLocaleDateString('es-ES')}` : ''}. ${window.BusSevBackend?.caducados?.() ? 'Ya han caducado: la app pide los recorridos a TUSSAM en directo.' : 'Cuando caduquen, la app pedirá los recorridos a TUSSAM en directo.'} Recorridos por calle: ${Object.keys(window.BUSSEV_RECORRIDOS || {}).length ? 'sí' : 'en línea recta'}. Mapas: © OpenStreetMap, OpenFreeMap, OpenMapTiles.</p>
        <p>BusSev es una app personal, sin relación con TUSSAM.</p></div>
    </div>`;
    $('.back-btn', el).onclick = goBack;
    el.querySelectorAll('[data-set]').forEach((b) => { b.onclick = () => {
      const k = b.dataset.set; settings[k] = ['refresh', 'revisarCada', 'escalaTexto'].includes(k) ? Number(b.dataset.v) : b.dataset.v;
      if (k === 'theme' && FONDOS[settings.fondo] && (b.dataset.v === 'auto' || FONDOS[settings.fondo].base !== b.dataset.v)) settings.fondo = '';
      if (k === 'escalaTexto') settings.letraGrande = Number(b.dataset.v) > 1;
      saveSettings();
      if (k === 'theme' || k === 'mapStyle' || k === 'escalaTexto') applyTheme();
      if (k === 'escalaTexto') requestAnimationFrame(ajustarPestanas);
      if (k === 'avisosTussam' && b.dataset.v !== 'no' && isNative()) window.avisos?.permisoOk?.();
      render();
    }; });
    el.querySelectorAll('[data-sw]').forEach((b) => { b.onchange = () => {
      settings[b.dataset.sw] = b.checked;
      // Modo sencillo enciende «Reducir animaciones»; al quitarlo, se apaga.
      if (b.dataset.sw === 'modoSencillo') settings.menosAnimaciones = b.checked;
      saveSettings(); applyTheme(); render(); aplicarCapasMapa(mapState.bm);
    }; });
    el.querySelectorAll('[data-tem]').forEach((b) => { b.onclick = () => { pruebaDia = null; settings.tematicaAuto = false; settings.tematica = b.dataset.tem; saveSettings(); applyTheme(); render(); }; });
    el.querySelectorAll('[data-dia]').forEach((b) => { b.onclick = () => { pruebaDia = b.dataset.dia || null; applyTheme(); render(); }; });
    el.querySelectorAll('[data-color]').forEach((b) => { b.onclick = () => { settings.color = b.dataset.color; saveSettings(); applyTheme(); render(); }; });
    el.querySelectorAll('[data-fondo]').forEach((b) => { b.onclick = () => {
      settings.fondo = b.dataset.fondo;
      if (FONDOS[settings.fondo]) settings.theme = FONDOS[settings.fondo].base;
      saveSettings(); applyTheme(); render();
    }; });
    $('#s-ver', el).onclick = async () => {
      const box = $('#s-ver-res', el), b = $('#s-ver', el);
      b.disabled = true; b.classList.add('buscando');
      box.innerHTML = cargandoHTML('Buscando versiones nuevas…');
      try {
        const r = await actualizaciones.buscar();
        if (r.estado === 'nueva') {
          box.innerHTML = `<div class="ver-res nueva"><b>✨ ${r.mismoNombre ? `Hay una actualización de la ${esc(r.nueva)}` : `Hay una versión nueva: la ${esc(r.nueva)}`}</b><span>Se descarga e instala desde aquí mismo, encima de esta, sin perder nada.</span>${novedades.pendientes(r.novedades) ? `<div class="nov-caja"><b>Qué cambia en las líneas y paradas</b>${novedades.html(r.novedades)}</div>` : ''}<button class="btn" type="button" id="s-ver-bajar">Descargar e instalar</button></div>`;
          $('#s-ver-bajar', el).onclick = () => instalarActualizacion(r.url);
        } else if (r.estado === 'al-dia') {
          box.innerHTML = '<div class="ver-res"><b>✅ Tienes la última versión</b></div>';
        } else {
          const pag = actualizaciones.paginaVersiones();
          box.innerHTML = `<div class="ver-res"><b>Tu repositorio de GitHub es privado</b><span>La app no puede mirarlo sola. Ábrelo y entra con tu cuenta: si el número de la última versión es mayor que el tuyo, descarga <b>BusSev.apk</b>.</span>${pag ? '<button class="btn ghost" type="button" id="s-ver-gh">Abrir las versiones en GitHub</button>' : ''}</div>`;
          $('#s-ver-gh', el)?.addEventListener('click', () => openWeb(pag));
        }
      } catch (e) {
        box.innerHTML = `<div class="ver-res"><b>No se ha podido comprobar</b><span>${esc(e.name === 'AbortError' ? 'GitHub está tardando demasiado.' : (e.message || 'Revisa la conexión.'))}</span></div>`;
      } finally { b.disabled = false; b.classList.remove('buscando'); }
    };
    $('#s-saldo-save', el).onclick = () => {
      const v = $('#s-saldo-url', el).value.trim().replace(/\/+$/, '');
      if (v && !/^https:\/\/[^\s/]+\.[^\s/]+/.test(v)) { toast('Pon una dirección que empiece por https://'); return; }
      settings.saldoURL = v; saveSettings(); toast(v ? 'Servidor del saldo guardado' : 'Servidor del saldo quitado'); render();
    };
    $('#s-saldo-test', el)?.addEventListener('click', async () => {
      toast('Probando el servidor…');
      try {
        const base = String(settings.saldoURL || '').replace(/\/+$/, '');
        const r = await fetch(`${base}/tiempos?p=2,3`, { headers: { Accept: 'application/json' } });
        if (r.status === 404 || r.status === 400) {
          const r2 = await fetch(`${base}/`, { headers: { Accept: 'text/html' } });
          toast(r2.ok ? 'Tu servidor responde, pero es la versión antigua: pon el código nuevo (mira su LEEME) para que dé los tiempos.' : `Responde con error ${r2.status}`);
        } else {
          const j = await r.json().catch(() => null);
          toast(j?.version >= 2 ? (Object.values(j.paradas || {}).some((x) => x?.ok) ? 'Tu servidor responde y además da los tiempos ✅' : 'Tu servidor responde ✅ (el saldo va), pero TUSSAM no le deja pedir los tiempos') : `Responde con error ${r.status}`);
        }
      } catch { toast('No se ha podido conectar con tu servidor'); }
    });
    $('#s-exp', el).onclick = () => copia.exportar().catch(() => toast('No se ha podido guardar la copia.'));
    $('#s-imp', el).onchange = async (e) => {
      try {
        const d = await copia.importar(e.target.files?.[0]);
        openModal(`<h2>Recuperar copia</h2><p class="help">Contiene ${d.favs.length} paradas favoritas y ${d.cards.length} tarjetas. Sustituirá lo que tienes ahora en BusSev.</p>
          <div class="actions"><button class="btn ghost" type="button" id="imp-no">Cancelar</button><button class="btn" type="button" id="imp-ok">Recuperar</button></div>`, (m, close) => {
          $('#imp-no', m).onclick = close;
          $('#imp-ok', m).onclick = () => { copia.aplicar(d); close(); toast('Copia recuperada'); render(); };
        });
      } catch (err) { toast(err.message); }
      e.target.value = '';
    };
  }
  render();
  return {};
};

/* ---------- Búsqueda ---------- */
const searchEl = $('#q');
const searchView = $('#view-buscar');
let searchSeq = 0;
/* Texto de cada parada ya preparado para buscar (sin tildes, en minúsculas). Se prepara una sola vez por
   parada: antes se rehacía para las más de mil paradas con cada letra que escribías. */
const textosBusqueda = new WeakMap();
function textoBusqueda(p) {
  let h = textosBusqueda.get(p);
  if (h === undefined) { h = norm(`${p.nombre} ${p.direccion_completa || ''} ${p.calle || ''}`); textosBusqueda.set(p, h); }
  return h;
}
async function runSearch() {
  const q = searchEl.value.trim();
  $('#q-clear').hidden = !q;
  if (!q) { searchView.hidden = true; document.querySelectorAll('.view').forEach((v) => { if (v.dataset.active === '1') v.hidden = false; }); return; }
  document.querySelectorAll('.view').forEach((v) => { v.hidden = v !== searchView; });
  const seq = ++searchSeq;
  try {
    const [paradas, lineas] = await Promise.all([getParadas(), getLineas()]);
    if (seq !== searchSeq) return;
    const nq = norm(q);
    const isNum = /^\d+$/.test(q);
    let stops;
    if (isNum) stops = paradas.filter((p) => p.codigo.startsWith(q)).sort((a, b) => (a.codigo === q ? -1 : b.codigo === q ? 1 : a.codigo.length - b.codigo.length || a.codigo.localeCompare(b.codigo)));
    else { const words = nq.split(/\s+/); stops = paradas.filter((p) => { const h = textoBusqueda(p); return words.every((w) => h.includes(w)); }); }
    const lines = lineas.filter((l) => norm(l.numero) === nq || norm(l.numero).startsWith(nq) || (!isNum && norm(l.nombre).includes(nq)));
    const linesHTML = lines.slice(0, 8).map((l) => `<a class="row" href="#linea-${esc(l.numero)}">${badge(l.numero, l.color)}<div class="row-main"><b>${esc(l.nombre)}</b><span>Línea</span></div>${ICON.chev}</a>`).join('');
    const stopsHTML = stops.slice(0, 40).map((p) => { const f = favs.get(p.codigo); return `<a class="row" href="#parada-${esc(p.codigo)}"><span class="stop-num">${esc(p.codigo)}</span><div class="row-main"><b>${f ? '★ ' : ''}${esc(f?.alias || p.nombre)}</b><span>${esc(f?.alias ? p.nombre : (p.direccion_completa || ''))}</span></div>${ICON.chev}</a>`; }).join('');
    searchView.innerHTML = (!lines.length && !stops.length)
      ? emptyHTML(ICON.bus, 'Sin resultados', `No hay paradas ni líneas que coincidan con «${esc(q)}». Prueba con el número del poste de la parada o con el nombre de la calle.`)
      : `<div class="stack">${lines.length ? `<h2 class="section-title">Líneas</h2><div class="list">${linesHTML}</div>` : ''}${stops.length ? `<h2 class="section-title">Paradas${stops.length > 40 ? ` (40 de ${stops.length})` : ''}</h2><div class="list">${stopsHTML}</div>` : ''}</div>`;
  } catch (e) {
    if (seq === searchSeq) { searchView.innerHTML = errorHTML(e, 'retry-q'); $('#retry-q').onclick = runSearch; }
  }
}
let searchDebounce;
searchEl.addEventListener('input', () => { clearTimeout(searchDebounce); searchDebounce = setTimeout(runSearch, 120); });
searchEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') searchEl.blur(); if (e.key === 'Escape') clearSearch(); });
$('#q-clear').onclick = () => { clearSearch(); searchEl.focus(); };
function clearSearch() { searchEl.value = ''; runSearch(); }
searchView.addEventListener('click', (e) => { if (e.target.closest('a[href^="#"]')) { searchEl.value = ''; $('#q-clear').hidden = true; searchView.hidden = true; } });

/* ================================================================== */
/* Router                                                              */
/* ================================================================== */
function show(name, arg) {
  active.cleanup?.();
  const el = $(`#view-${name}`);
  document.querySelectorAll('.view').forEach((v) => { v.hidden = true; v.dataset.active = ''; });
  if (TABS.includes(name)) {
    lastTab = name;
    document.querySelectorAll('.view-detail').forEach((v) => { v.innerHTML = ''; });
  }
  el.hidden = false; el.dataset.active = '1';
  document.body.dataset.view = name;   // para ocultar el buscador en Ajustes (y lo que haga falta por pantalla)
  // Al volver atrás se deja la pantalla donde estaba (p. ej. Ajustes tras mirar Avisos o Tarifas); si no, arriba.
  const yVuelta = volviendo ? (posScroll.get(location.hash || '#favoritas') || 0) : 0;
  if (name !== 'mapa') el.scrollTop = 0;
  document.querySelectorAll('.tabbar a').forEach((a) => { if (a.dataset.tab === lastTab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  active = { name, cleanup: null, refresh: null, rerender: null, back: null };
  const r = views[name](el, arg) || {};
  active.cleanup = r.cleanup; active.refresh = active.refresh || r.refresh; active.back = r.back || null;
  if (!settings.menosAnimaciones) { el.classList.remove('entrando'); void el.offsetWidth; el.classList.add('entrando'); }
  if (name !== 'mapa' && yVuelta > 0) {
    // Algunas pantallas terminan de pintarse un poco después (favoritas, parada): se reintenta un momento.
    let tocado = false;   // si la persona ya está moviendo la pantalla, no se le corrige
    ['touchstart', 'wheel'].forEach((t) => el.addEventListener(t, () => { tocado = true; }, { once: true, passive: true }));
    const poner = () => { if (!tocado && el.dataset.active === '1' && el.scrollTop < yVuelta - 2) el.scrollTop = yVuelta; };
    poner(); requestAnimationFrame(poner); setTimeout(poner, 150); setTimeout(poner, 500);
  }
}
/* Posición de scroll de cada pantalla, para recuperarla al volver atrás */
const posScroll = new Map();
let volviendo = false;
/* ---------- Botón Atrás de Android ---------- */
const navStack = [];
let ultimoAtras = 0;
window.busSevBack = () => {
  const modal = document.querySelector('.modal-bg');
  if (modal) { modal.remove(); return true; }
  const ov = document.querySelector('.scan-overlay');
  if (ov) { ov.querySelector('button')?.click(); ov.remove(); return true; }
  if (searchEl.value) { clearSearch(); return true; }
  if (active.back?.()) return true;
  if (navStack.length > 1) { history.back(); return true; }
  if (active.name !== 'favoritas') { location.hash = 'favoritas'; return true; }
  if (Date.now() - ultimoAtras < 2000) return false;
  ultimoAtras = Date.now();
  toast('Pulsa otra vez Atrás para salir');
  return true;
};
function route() {
  routeCount++;
  const hh = location.hash || '#favoritas';
  const saliendo = navStack[navStack.length - 1], vistaAct = document.querySelector('.view[data-active="1"]');
  if (saliendo && vistaAct && saliendo !== hh) posScroll.set(saliendo, vistaAct.scrollTop);
  volviendo = navStack.length > 1 && navStack[navStack.length - 2] === hh;
  if (volviendo) posScroll.delete(saliendo);   // la pantalla de la que se sale ya no se recuerda
  if (navStack.length > 1 && navStack[navStack.length - 2] === hh) navStack.pop();
  else if (navStack[navStack.length - 1] !== hh) navStack.push(hh);
  if (navStack.length > 30) navStack.splice(0, navStack.length - 30);
  document.querySelector('.modal-bg')?.remove();
  window.BusSevBackend?.cancelarFondo?.();   // lo que se buscaba en la pantalla anterior ya no hace falta
  if (searchEl.value) { searchEl.value = ''; $('#q-clear').hidden = true; }
  const h = decodeURIComponent(location.hash.slice(1));
  // Modo sencillo: no hay Mapa, Cerca ni «Cómo llegar»; se redirige a Favoritas.
  if (settings.modoSencillo && (h === 'mapa' || h === 'cerca' || h === 'ruta')) { history.replaceState(null, '', '#favoritas'); return show('favoritas'); }
  let m;
  if ((m = h.match(/^parada-(\d{1,7})$/))) return show('parada', m[1]);
  if ((m = h.match(/^linea-([A-Za-z0-9]{1,8})$/))) return show('linea', m[1]);
  if (h === 'ajustes') return show('ajustes');
  if (h === 'ruta') return show('ruta');
  if (h === 'avisos') return show('avisos');
  if (h === 'viaje') return show('viaje');
  if (h === 'tarifas') return show('tarifas');
  if (TABS.includes(h)) return show(h);
  history.replaceState(null, '', '#favoritas');
  return show('favoritas');
}
$('#btn-refresh').onclick = () => { if (active.refresh) active.refresh(); else toast('Esta pantalla ya está al día'); };
document.querySelectorAll('.tabbar a').forEach((a) => {
  a.addEventListener('click', (e) => { if (location.hash === `#${a.dataset.tab}`) { e.preventDefault(); clearSearch(); route(); } });
});
window.addEventListener('hashchange', route);
window.BusSevBackend?.precalentar?.();   // calienta el token OAuth nada más arrancar, para abrir más rápido
/* El móvil le quitó la gráfica a un mapa y no se la ha devuelto: se vuelve a crear la pantalla */
window.addEventListener('bussev-mapa-perdido', (e) => {
  const bm = e.detail;
  if (bm === mapState.bm) {
    const linea = mapState.linea;
    try { mapState.stopTimer?.(); mapState.zona?.parar(); mapState.line?.stop(); } catch { /* */ }
    try { bm.remove(); } catch { /* */ }
    const cont = $('#map-all'); if (cont) cont.innerHTML = '';
    const sh = $('#map-sheet'); if (sh) sh.hidden = true;
    Object.assign(mapState, { bm: null, me: null, sel: null, pin: null, markers: null, lineMarkers: null, line: null, stopTimer: null, reload: null, linea: null, zona: null, pending: linea ? linea.numero : null });
  } else { try { bm.remove(); } catch { /* */ } }
  route();
});

