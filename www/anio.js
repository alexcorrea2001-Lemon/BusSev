/* BusSev — «Tu año en BusSev»: tu resumen del año en historias a pantalla completa, para ver y compartir.
 *
 * Desde esta versión la app apunta (solo en el móvil, en localStorage 'anio') qué paradas y líneas miras,
 * los avisos que pones, cuándo la usas y los saldos que consultas. Con eso y con los viajes verificados del
 * Pasaporte se monta el resumen. Se anuncia del 1 de diciembre al 15 de enero; el resto del año se puede ver
 * «hasta ahora» desde el Pasaporte. Nada sale del móvil salvo la imagen que tú decidas compartir.
 */
'use strict';
(() => {

const MIN = 60000, DIA = 86400000;
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const pad = (n) => String(n).padStart(2, '0');
const diaClave = (t) => { const d = new Date(t); return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const fmtN = (n) => Math.round(n).toLocaleString('es-ES');
const SHARE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>';
const D = () => window.BUSSEV_DATA || { paradas: [], lineas: [], recorridos: [] };

/* ---------- Registro de uso ---------- */
const vacio = () => ({ desde: Date.now(), dias: {}, horas: Array(24).fill(0), paradas: {}, lineas: {}, avisos: 0, sensor: 0, bajadas: 0, rutas: 0, tarjeta: 0, gasto: 0, recargas: 0, ult: {} });
function conAnio(fn, t = Date.now()) {
  const todo = store.get('anio', null) || {};
  const y = String(new Date(t).getFullYear());
  const a = todo[y] || (todo[y] = vacio());
  fn(a, t);
  // Solo se guardan los 3 últimos años
  for (const k of Object.keys(todo).sort().slice(0, -3)) delete todo[k];
  store.set('anio', todo);
}
// Una misma cosa repetida en poco tiempo (refrescar, volver atrás) cuenta una vez
const nuevo = (a, k, t, ventana) => { if (t - (a.ult[k] || 0) < ventana) return false; a.ult[k] = t; return true; };
const marcarDia = (a, t) => { const k = diaClave(t); a.dias[k] = (a.dias[k] || 0) + 1; a.horas[new Date(t).getHours()]++; };
const sumar = (obj, k, n) => { obj[k] = (obj[k] || 0) + n; };

const anio = {
  apuntar(tipo, d = {}) {
    try {
      conAnio((a, t) => {
        const c = d.codigo != null ? String(d.codigo) : '', l = d.linea != null ? String(d.linea) : '';
        if (tipo === 'parada' && c) { if (!nuevo(a, 'p' + c, t, 10 * MIN)) return; sumar(a.paradas, c, 1); }
        else if (tipo === 'linea' && l) { if (!nuevo(a, 'l' + l, t, 10 * MIN)) return; sumar(a.lineas, l, 1); }
        else if (tipo === 'ruta') { if (!nuevo(a, 'ruta', t, 10 * MIN)) return; a.rutas++; }
        else if (tipo === 'tarjeta') { if (!nuevo(a, 'tarjeta', t, 10 * MIN)) return; a.tarjeta++; }
        else if (tipo === 'aviso' || tipo === 'sensor' || tipo === 'bajada') {
          a[tipo === 'aviso' ? 'avisos' : tipo === 'sensor' ? 'sensor' : 'bajadas']++;
          if (c) sumar(a.paradas, c, 2);    // poner un aviso dice más que mirar
          if (l) sumar(a.lineas, l, 2);
        } else return;
        marcarDia(a, t);
      });
    } catch { /* nunca molesta */ }
  },
  /* Cada pantalla que se abre */
  vista(nombre, arg) {
    if (nombre === 'parada') this.apuntar('parada', { codigo: arg });
    else if (nombre === 'linea') this.apuntar('linea', { linea: arg });
    else if (nombre === 'ruta') this.apuntar('ruta');
  },
  /* Las favoritas que ves en la lista cuentan una vez al día cada una */
  favoritas(codigos) {
    try {
      conAnio((a, t) => {
        const hoy = diaClave(t);
        let alguna = false;
        for (const c of codigos) { const k = 'f' + c; if (a.ult[k] === hoy) continue; a.ult[k] = hoy; sumar(a.paradas, String(c), 1); alguna = true; }
        if (alguna || nuevo(a, 'fav', t, 30 * MIN)) marcarDia(a, t);
      });
    } catch { /* nada */ }
  },
  /* Saldo consultado: lo que baja es gasto, lo que sube es recarga */
  saldo(antes, ahora) {
    if (typeof antes !== 'number' || typeof ahora !== 'number' || !isFinite(antes) || !isFinite(ahora)) return;
    const cent = (x) => Math.round(x * 100) / 100;
    conAnio((a) => { if (ahora < antes) a.gasto = cent(a.gasto + antes - ahora); else if (ahora > antes) a.recargas = cent(a.recargas + ahora - antes); });
  },

  /* ---------- ¿Toca enseñarlo? ---------- */
  // Del 1 de diciembre al 15 de enero (en enero, el año que acaba de terminar)
  temporada(t = Date.now()) { const d = new Date(t); return d.getMonth() === 11 || (d.getMonth() === 0 && d.getDate() <= 15); },
  anioResumen(t = Date.now()) { const d = new Date(t); return d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear(); },

  /* ---------- Los datos del resumen ---------- */
  datos(y = this.anioResumen()) {
    const a = (store.get('anio', null) || {})[String(y)] || vacio();
    const ps = window.pasaporte?.estado?.() || { viajes: [], logros: {} };
    const enAnio = (t) => new Date(t).getFullYear() === y;
    const viajes = ps.viajes.filter((v) => v.verificado && enAnio(v.inicio));
    const nombreParada = (c) => favs.list().find((f) => String(f.codigo) === c)?.alias
      || D().paradas.find((p) => p.codigo === c)?.nombre || `Parada ${c}`;
    // Paradas y líneas: lo que miras + los viajes verificados (cada viaje pesa como 3 consultas)
    const paradas = { ...a.paradas }, lineas = { ...a.lineas };
    for (const v of viajes) { if (v.desde) sumar(paradas, String(v.desde), 3); sumar(lineas, String(v.linea), 3); }
    const top = (o) => Object.entries(o).sort((p, q) => q[1] - p[1]);
    const topParadas = top(paradas).slice(0, 3).map(([c, n]) => ({ codigo: c, nombre: nombreParada(c), n }));
    const topLineas = top(lineas).slice(0, 3).map(([l, n]) => {
      const info = typeof lineaFor === 'function' ? lineaFor(l) : null;
      const dl = D().lineas.find((x) => x.numero === l || x.numero === l.padStart(2, '0'));
      return { linea: info?.etiqueta || l, color: info?.color || dl?.color || '#d41c2b', nombre: dl?.nombre || info?.nombre || '', n };
    });
    const porMes = Array(12).fill(0);
    for (const [k, n] of Object.entries(a.dias)) porMes[Number(k.slice(0, 2)) - 1] += n;
    for (const v of viajes) porMes[new Date(v.inicio).getMonth()]++;
    const diasUsados = new Set([...Object.keys(a.dias), ...viajes.map((v) => diaClave(v.inicio))]).size;
    const horas = a.horas.slice();
    for (const v of viajes) horas[new Date(v.inicio).getHours()]++;
    const totalHoras = horas.reduce((s, n) => s + n, 0);
    const horaPunta = totalHoras ? horas.indexOf(Math.max(...horas)) : null;
    const franja = (de, a2) => horas.reduce((s, n, h) => s + ((de < a2 ? h >= de && h < a2 : h >= de || h < a2) ? n : 0), 0) / (totalHoras || 1);
    const km = viajes.reduce((s, v) => s + (Number(v.km) || 0), 0);
    const logros = Object.entries(ps.logros || {}).filter(([, t]) => enAnio(t)).sort((p, q) => p[1] - q[1]).map(([k]) => k);
    const d = {
      y, desde: a.desde, diasUsados, porMes, mesTop: porMes.some(Boolean) ? porMes.indexOf(Math.max(...porMes)) : null,
      topParadas, topLineas, horas, horaPunta, totalHoras,
      manana: franja(6, 12), tarde: franja(12, 20), noche: franja(20, 6), madrugada: franja(0, 6), temprano: franja(6, 9),
      viajes: viajes.length, km, lineasViaje: new Set(viajes.map((v) => v.linea)).size,
      largo: viajes.reduce((m, v) => (!m || (v.paradas || 0) > (m.paradas || 0) ? v : m), null),
      logros, sellos: logros.filter((k) => k.startsWith('s:')).length, medallas: logros.filter((k) => k.startsWith('m:')).length,
      avisos: a.avisos, sensor: a.sensor, bajadas: a.bajadas, rutas: a.rutas, tarjeta: a.tarjeta, gasto: a.gasto,
      lineasDistintas: Object.keys(lineas).length,
    };
    d.perfil = perfil(d);
    return d;
  },
};

/* ---------- Tu forma de moverte ---------- */
const PERFILES = {
  buho: ['Búho de Sevilla', 'Tus horas son las de la luna: los nocturnos no tienen secretos para ti.', 'luna', '#1d2f6b'],
  madrugador: ['Madrugador', 'Cuando Sevilla aún bosteza, tú ya sabes a qué hora pasa tu autobús.', 'sol', '#c98a1a'],
  explorador: ['Explorador', 'Ni una línea se te resiste. Sevilla, para ti, no tiene esquinas.', 'mapa', '#2f7a4a'],
  previsor: ['Previsor', 'Tú no corres detrás del autobús: el autobús te avisa a ti.', 'reloj', '#b3262f'],
  fiel: ['De costumbres fijas', 'Tu parada y tú: una relación más estable que muchas.', 'corazon', '#7a1d34'],
  viajero: ['Trotamundos urbano', 'Has subido a más autobuses que muchos conductores. Casi.', 'ruta', '#4b3b8f'],
  sevillano: ['Sevillano de toda la vida', 'Miras el bus, llegas a tu hora y a disfrutar de Sevilla.', 'torre', '#7a1d34'],
};
function perfil(d) {
  const totalP = d.topParadas.reduce((s, p) => s + p.n, 0);
  const puntos = {
    buho: d.totalHoras >= 10 ? (d.noche + d.madrugada) / 0.3 : 0,
    madrugador: d.totalHoras >= 10 ? d.temprano / 0.35 : 0,
    explorador: Math.max(d.lineasDistintas / 12, d.sellos / 5),
    previsor: (d.avisos + d.sensor + d.bajadas) / 12,
    fiel: totalP >= 15 && d.topParadas[0] ? (d.topParadas[0].n / totalP) / 0.6 : 0,
    viajero: d.viajes / 30,
  };
  const [id, p] = Object.entries(puntos).sort((x, y) => y[1] - x[1])[0];
  const k = p >= 1 ? id : 'sevillano';
  return { id: k, nombre: PERFILES[k][0], frase: PERFILES[k][1], picto: PERFILES[k][2], color: PERFILES[k][3] };
}

/* Una vuelta a la C1, para comparar kilómetros con algo sevillano */
let kmC1 = null;
function vueltaC1() {
  if (kmC1 != null) return kmC1;
  try {
    const pos = new Map(D().paradas.map((p) => [p.codigo, p]));
    const ruta = D().recorridos.filter((r) => r[1] === 'C1' && r[2] === 1).sort((a, b) => a[3] - b[3]).map((r) => pos.get(r[0])).filter(Boolean);
    let m = 0;
    for (let i = 1; i < ruta.length; i++) {
      const a = ruta[i - 1], b = ruta[i], r = Math.PI / 180;
      m += Math.hypot((b.longitud - a.longitud) * r * Math.cos(((a.latitud + b.latitud) / 2) * r), (b.latitud - a.latitud) * r) * 6371;
    }
    kmC1 = m > 3 ? m * 1.15 : 0;   // las calles no van en línea recta entre paradas
  } catch { kmC1 = 0; }
  return kmC1;
}

/* ---------- Dibujos ---------- */
const pic = (k, c, w) => window.pasaporte?.pic?.(k, c, w) || '';
const ico = (k, c, w) => `<svg viewBox="0 0 24 24" aria-hidden="true">${pic(k, c, w)}</svg>`;
const textoCorto = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
const partir = (s, n) => {   // en líneas de como mucho n letras
  const out = []; let l = '';
  for (const w of String(s).split(/\s+/)) { if ((l + ' ' + w).trim().length > n && l) { out.push(l); l = w; } else l = (l + ' ' + w).trim(); }
  if (l) out.push(l);
  return out;
};

/* La tarjeta del resumen: un SVG de 1080×1920 que se ve en la app y se comparte como imagen */
function tarjetaSVG(d) {
  const P = d.topParadas[0], L = d.topLineas[0], f = d.perfil;
  const CR = '#f6eedc', OR = '#e9b44c';
  const filas = [];
  let y = 690;
  const fila = (etq, cuerpo, alto) => { filas.push(`<text x="96" y="${y}" font-size="30" font-weight="800" letter-spacing="5" fill="${OR}">${esc(etq)}</text>${cuerpo(y)}`); y += alto; };
  if (P) {
    const ls = partir(textoCorto(P.nombre, 52), 26).slice(0, 2);
    fila('MI PARADA DEL AÑO', (y0) => ls.map((l, i) => `<text x="96" y="${y0 + 66 + i * 64}" font-size="58" font-weight="800" fill="${CR}">${esc(l)}</text>`).join(''), 120 + ls.length * 64);
  }
  if (L) {
    const nl = textoCorto(L.nombre || '', 30);
    fila('MI LÍNEA DEL AÑO', (y0) => `<rect x="96" y="${y0 + 22}" width="${Math.max(140, 60 + String(L.linea).length * 40)}" height="96" rx="22" fill="${L.color}"/><text x="${96 + Math.max(140, 60 + String(L.linea).length * 40) / 2}" y="${y0 + 92}" text-anchor="middle" font-size="62" font-weight="900" fill="#fff">${esc(L.linea)}</text>${nl ? `<text x="${96 + Math.max(140, 60 + String(L.linea).length * 40) + 30}" y="${y0 + 84}" font-size="36" font-weight="600" fill="${CR}" fill-opacity=".85">${esc(nl)}</text>` : ''}`, 190);
  }
  const cifras = [[fmtN(d.diasUsados), 'días con BusSev'], [fmtN(d.viajes), d.viajes === 1 ? 'viaje verificado' : 'viajes verificados'], [d.km >= 1 ? fmtN(d.km) : '0', 'km en bus']];
  if (d.logros.length) cifras[2] = [fmtN(d.logros.length), 'sellos y medallas'];
  filas.push(cifras.map(([n, t], i) => `<g transform="translate(${96 + i * 300} ${y})"><text y="70" font-size="84" font-weight="900" fill="${CR}">${n}</text><text y="118" font-size="28" font-weight="600" fill="${OR}">${esc(t)}</text></g>`).join(''));
  y += 200;
  filas.push(`<g transform="translate(96 ${y})"><rect width="888" height="230" rx="40" fill="#000" fill-opacity=".22" stroke="${OR}" stroke-opacity=".5" stroke-width="2"/>
    <circle cx="125" cy="115" r="78" fill="${OR}"/><g transform="translate(77 67) scale(4)">${pic(f.picto, '#3a1220', 1.7)}</g>
    <text x="240" y="92" font-size="28" font-weight="800" letter-spacing="5" fill="${OR}">SOY…</text>
    <text x="240" y="150" font-size="${f.nombre.length > 20 ? 46 : 56}" font-weight="900" fill="${CR}">${esc(f.nombre)}</text></g>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920" font-family="Roboto, 'Segoe UI', Arial, sans-serif">
    <defs><linearGradient id="wrg" x1="0" y1="0" x2=".4" y2="1"><stop offset="0" stop-color="#8e2340"/><stop offset=".55" stop-color="#5a1428"/><stop offset="1" stop-color="#2a0912"/></linearGradient>
    <pattern id="wra" width="120" height="120" patternUnits="userSpaceOnUse"><g fill="none" stroke="${OR}" stroke-opacity=".16" stroke-width="3"><rect x="2" y="2" width="116" height="116"/><path d="M60 12c13 17 13 31 0 48-13-17-13-31 0-48zM60 108c13-17 13-31 0-48-13 17-13 31 0 48zM12 60c17-13 31-13 48 0-17 13-31 13-48 0zM108 60c-17-13-31-13-48 0 17 13 31 13 48 0z"/></g></pattern></defs>
    <rect width="1080" height="1920" fill="url(#wrg)"/>
    <rect width="1080" height="250" fill="url(#wra)"/><rect y="250" width="1080" height="8" fill="${OR}"/>
    <circle cx="900" cy="470" r="230" fill="${OR}" fill-opacity=".1"/>
    <g transform="translate(830 330) scale(6)" opacity=".28">${pic('torre', OR, 1.4)}</g>
    <text x="96" y="400" font-size="40" font-weight="700" fill="${OR}" letter-spacing="3">MI AÑO EN BUSSEV</text>
    <text x="90" y="560" font-size="190" font-weight="900" fill="${CR}" letter-spacing="-6">${d.y}</text>
    ${filas.join('')}
    <rect x="96" y="1770" width="70" height="70" rx="18" fill="#d41c2b"/><g transform="translate(107 1781) scale(2)">${pic('bus', '#fff', 2)}</g>
    <text x="190" y="1818" font-size="34" font-weight="800" fill="${CR}">BusSev</text>
    <text x="984" y="1818" text-anchor="end" font-size="28" font-weight="600" fill="${CR}" fill-opacity=".7">Los autobuses de Sevilla</text>
  </svg>`;
}

async function compartirResumen(d) {
  const texto = `Mi ${d.y} en BusSev 🚌 Soy «${d.perfil.nombre}»${d.topLineas[0] ? ` y mi línea es la ${d.topLineas[0].linea}` : ''}.`;
  try {
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(tarjetaSVG(d));
    await img.decode();
    const cv = document.createElement('canvas'); cv.width = 1080; cv.height = 1920;
    cv.getContext('2d').drawImage(img, 0, 0, 1080, 1920);
    const b64 = cv.toDataURL('image/png').split(',')[1];
    const w = await window.Capacitor.nativePromise('Filesystem', 'writeFile', { path: `mi-${d.y}-en-bussev.png`, data: b64, directory: 'CACHE' });
    await window.Capacitor.nativePromise('Share', 'share', { text: texto, files: [w.uri] });
  } catch {
    try { await navigator.share?.({ text: texto }); } catch { /* cancelado */ }
  }
}

/* ---------- Las historias ---------- */
const bonito = (n, d = 0) => `<b class="wr-num" data-cuenta="${n}" data-dec="${d}">${d ? n.toLocaleString('es-ES', { maximumFractionDigits: d }) : fmtN(n)}</b>`;
const IN = (i) => `wr-in" style="--d:${i * 0.18 + 0.15}s`;
function historias(d) {
  const S = [];
  const tit = anio.temporada() ? `Tu ${d.y} en BusSev` : `Tu ${d.y} hasta ahora`;
  const empezo = new Date(d.desde);
  const parcial = empezo.getFullYear() === d.y && (empezo.getMonth() > 0 || empezo.getDate() > 7);
  S.push({ id: 'portada', fondo: 'wr-f-portada', html: `
    <div class="wr-portada-sol"></div><div class="wr-giralda">${ico('torre', '#e9b44c', 1.1)}</div>
    <p class="wr-k ${IN(0)}">BusSev presenta</p>
    <h1 class="wr-anio ${IN(1)}">${d.y}</h1>
    <h2 class="wr-t ${IN(2)}">${esc(tit)}</h2>
    <p class="wr-p ${IN(3)}">Tus paradas, tus líneas y tu forma de moverte por Sevilla.${parcial ? ` <small>(Contando desde el ${empezo.getDate()} de ${MESES[empezo.getMonth()]}.)</small>` : ''}</p>
    <p class="wr-pista ${IN(5)}">Toca para seguir →</p>` });
  if (d.diasUsados) {
    const max = Math.max(...d.porMes, 1);
    S.push({ id: 'dias', fondo: 'wr-f-azulejo', html: `
      <p class="wr-k ${IN(0)}">Este año abriste BusSev</p>
      <p class="wr-gigante ${IN(1)}">${bonito(d.diasUsados)}</p>
      <p class="wr-t ${IN(2)}">${d.diasUsados === 1 ? 'día' : 'días'}</p>
      <div class="wr-meses ${IN(3)}">${d.porMes.map((n, i) => `<span class="${i === d.mesTop ? 'top' : ''}" style="--h:${Math.max(4, (n / max) * 100)}%"><i></i><em>${MESES[i][0].toUpperCase()}</em></span>`).join('')}</div>
      ${d.mesTop != null ? `<p class="wr-p ${IN(4)}">Tu mes más busero: <b>${MESES[d.mesTop]}</b>.</p>` : ''}` });
  }
  if (d.topParadas[0]) {
    const [p1, ...resto] = d.topParadas;
    S.push({ id: 'parada', fondo: 'wr-f-albero', html: `
      <p class="wr-k ${IN(0)}">Tu parada del año</p>
      <div class="wr-poste ${IN(1)}">${ico('bus', '#3a2a1c', 1.8)}</div>
      <h2 class="wr-nombre ${IN(2)}">${esc(p1.nombre)}</h2>
      <p class="wr-p ${IN(3)}">La miraste o la usaste ${bonito(p1.n)} ${p1.n === 1 ? 'vez' : 'veces'}.</p>
      ${resto.length ? `<ol class="wr-lista ${IN(4)}" start="2">${resto.map((p) => `<li><span>${esc(p.nombre)}</span><b>${fmtN(p.n)}</b></li>`).join('')}</ol>` : ''}` });
  }
  if (d.topLineas[0]) {
    const [l1, ...resto] = d.topLineas;
    S.push({ id: 'linea', fondo: 'wr-f-linea', estilo: `--lc:${l1.color}`, html: `
      <p class="wr-k ${IN(0)}">Tu línea del año</p>
      <div class="wr-linea ${IN(1)}">${esc(l1.linea)}</div>
      ${l1.nombre ? `<h2 class="wr-t ${IN(2)}">${esc(l1.nombre)}</h2>` : ''}
      <p class="wr-p ${IN(3)}">Tu compañera de ${MESES[d.mesTop ?? new Date().getMonth()]} y de todo el año.</p>
      ${resto.length ? `<div class="wr-podio ${IN(4)}">${resto.map((l, i) => `<div><span style="background:${l.color}">${esc(l.linea)}</span><small>${i + 2}.ª</small></div>`).join('')}</div>` : ''}` });
  }
  if (d.totalHoras >= 5 && d.horaPunta != null) {
    const fr = d.noche + d.madrugada >= Math.max(d.manana, d.tarde) ? 'noche' : d.manana >= d.tarde ? 'manana' : 'tarde';
    const frase = { manana: 'Eres de mañanas: a primera hora ya sabes cuándo pasa.', tarde: 'Eres de tardes: tu Sevilla se mueve después de comer.', noche: 'Eres de noche: cuando otros duermen, tú miras el nocturno.' }[fr];
    const max = Math.max(...d.horas, 1);
    S.push({ id: 'hora', fondo: `wr-f-${fr}`, html: `
      <p class="wr-k ${IN(0)}">Tu hora punta</p>
      <p class="wr-gigante ${IN(1)}">${pad(d.horaPunta)}:00</p>
      <div class="wr-horas ${IN(2)}">${d.horas.map((n, h) => `<i class="${h === d.horaPunta ? 'top' : ''}" style="--h:${Math.max(3, (n / max) * 100)}%"></i>`).join('')}</div>
      <div class="wr-horas-eje ${IN(2)}"><span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>24h</span></div>
      <p class="wr-p ${IN(3)}">${frase}</p>` });
  }
  if (d.viajes) {
    const c1 = vueltaC1();
    S.push({ id: 'viajes', fondo: 'wr-f-verde', html: `
      <p class="wr-k ${IN(0)}">Viajes verificados</p>
      <p class="wr-gigante ${IN(1)}">${bonito(d.viajes)}</p>
      <p class="wr-t ${IN(2)}">${d.viajes === 1 ? 'viaje' : 'viajes'} en ${d.lineasViaje} ${d.lineasViaje === 1 ? 'línea' : 'líneas'}</p>
      ${d.km >= 1 ? `<div class="wr-cajas ${IN(3)}">
        <div><b>${bonito(d.km)}</b><span>km en autobús</span></div>
        ${c1 && d.km >= c1 / 2 ? `<div><b>${bonito(d.km / c1, 1)}</b><span>vueltas a la C1</span></div>` : ''}
        <div><b>${bonito(d.km * 0.1)}</b><span>kg de CO₂ que no echó un coche (aprox.)</span></div></div>` : ''}
      ${d.largo && d.largo.paradas >= 8 ? `<p class="wr-p ${IN(4)}">Tu viaje más largo: ${d.largo.paradas} paradas en la ${esc(d.largo.linea)}.</p>` : ''}` });
  }
  if (d.logros.length) {
    const sl = d.logros.filter((k) => k.startsWith('s:')).slice(-3).reverse(), md = d.logros.filter((k) => k.startsWith('m:')).reverse();
    const arte = [...sl, ...md].slice(0, 6).map((k, i) => `<div class="wr-sello" style="--d:${0.5 + i * 0.22}s">${window.pasaporte.arte(k, { papel: true })}</div>`).join('');
    S.push({ id: 'pasaporte', fondo: 'wr-f-papel', html: `
      <p class="wr-k ${IN(0)}">Tu Pasaporte de Sevilla</p>
      <div class="wr-sellos">${arte}</div>
      <p class="wr-t ${IN(3)}">${d.sellos} ${d.sellos === 1 ? 'sello' : 'sellos'} y ${d.medallas} ${d.medallas === 1 ? 'medalla' : 'medallas'}</p>
      <p class="wr-p ${IN(4)}">Lo último: <b>${esc(window.pasaporte.nombre(d.logros.at(-1)))}</b>.</p>` });
  }
  const totalAvisos = d.avisos + d.sensor + d.bajadas;
  if (totalAvisos) {
    S.push({ id: 'avisos', fondo: 'wr-f-rojo', html: `
      <p class="wr-k ${IN(0)}">Te avisamos</p>
      <p class="wr-gigante ${IN(1)}">${bonito(totalAvisos)}</p>
      <p class="wr-t ${IN(2)}">${totalAvisos === 1 ? 'vez' : 'veces'} para que no perdieras el autobús</p>
      <div class="wr-cajas ${IN(3)}">
        ${d.avisos ? `<div><b>${fmtN(d.avisos)}</b><span>avisos de llegada</span></div>` : ''}
        ${d.sensor ? `<div><b>${fmtN(d.sensor)}</b><span>en modo sensor 📳</span></div>` : ''}
        ${d.bajadas ? `<div><b>${fmtN(d.bajadas)}</b><span>«avísame al bajar»</span></div>` : ''}</div>` });
  }
  if (d.gasto >= 1) {
    S.push({ id: 'gasto', fondo: 'wr-f-morado', html: `
      <p class="wr-k ${IN(0)}">En tu bonobús</p>
      <p class="wr-gigante ${IN(1)}">${bonito(d.gasto)} €</p>
      <p class="wr-t ${IN(2)}">gastados en autobús, más o menos</p>
      <p class="wr-p ${IN(3)}">Contando lo que bajó el saldo entre las veces que lo miraste en BusSev (${fmtN(d.tarjeta)}).</p>` });
  }
  if (S.length <= 2) {
    S.push({ id: 'pronto', fondo: 'wr-f-azulejo', html: `
      <p class="wr-k ${IN(0)}">Esto acaba de empezar</p>
      <h2 class="wr-t ${IN(1)}">Todavía hay poco que contar</h2>
      <p class="wr-p ${IN(2)}">BusSev va apuntando en tu móvil las paradas y líneas que miras, tus avisos y tus viajes verificados. Cuanto más la uses, mejor saldrá tu resumen.</p>` });
  }
  const f = d.perfil;
  S.push({ id: 'perfil', fondo: 'wr-f-perfil', estilo: `--pc:${f.color}`, html: `
    <p class="wr-k ${IN(0)}">Tu forma de moverte</p>
    <div class="wr-medallon">${ico(f.picto, '#3a1220', 1.6)}</div>
    <h2 class="wr-nombre ${IN(2)}">${esc(f.nombre)}</h2>
    <p class="wr-p ${IN(3)}">${esc(f.frase)}</p>` });
  S.push({ id: 'resumen', fondo: 'wr-f-resumen', fin: true, html: `
    <div class="wr-tarjeta ${IN(0)}">${tarjetaSVG(d)}</div>
    <div class="wr-acciones ${IN(1)}">
      <button type="button" class="btn" data-wr="compartir">${SHARE}Compartir</button>
      <button type="button" class="btn ghost" data-wr="otra">Ver otra vez</button></div>` });
  return S;
}

const DURA = 6500;
views.tuano = (el) => {
  const d = anio.datos();
  const S = historias(d);
  const reducir = !!settings.menosAnimaciones;
  let i = 0, timer = null, inicio = 0, restante = DURA, pausa = false, dead = false;
  el.innerHTML = `<div class="wr" role="dialog" aria-label="Tu año en BusSev">
    <div class="wr-barras">${S.map(() => '<span><i></i></span>').join('')}</div>
    <button type="button" class="wr-cerrar" aria-label="Cerrar">${ICON.close}</button>
    <div class="wr-pag"></div></div>`;
  const pag = $('.wr-pag', el), barras = [...el.querySelectorAll('.wr-barras span')];
  const salir = () => { if (history.length > 1) history.back(); else location.hash = 'favoritas'; };
  $('.wr-cerrar', el).onclick = (e) => { e.stopPropagation(); salir(); };
  /* Los números y el año grandes se encogen si no caben (pantallas estrechas o letra del sistema grande) */
  function ajustar() {
    const nums = [...pag.querySelectorAll('[data-cuenta]')];
    const antes = nums.map((b) => b.textContent);
    for (const b of nums) {   // se mide con el número final (el más ancho)
      const fin = Number(b.dataset.cuenta), dec = Number(b.dataset.dec || 0);
      b.textContent = dec ? fin.toLocaleString('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : fmtN(fin);
    }
    for (const t of pag.querySelectorAll('.wr-anio, .wr-gigante, .wr-nombre')) {
      t.style.fontSize = '';
      const ancho = t.clientWidth;
      if (!ancho) continue;
      for (let k = 0; k < 4 && t.scrollWidth > ancho + 1; k++) {
        t.style.fontSize = `${Math.floor(parseFloat(getComputedStyle(t).fontSize) * (ancho / t.scrollWidth) * 0.98)}px`;
      }
    }
    nums.forEach((b, k) => { b.textContent = antes[k]; });
  }
  function contar() {
    for (const b of pag.querySelectorAll('[data-cuenta]')) {
      const fin = Number(b.dataset.cuenta), dec = Number(b.dataset.dec || 0);
      const fmt = (v) => (dec ? v.toLocaleString('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : fmtN(v));
      if (reducir || fin <= 0) { b.textContent = fmt(fin); continue; }
      const t0 = performance.now() + 350;
      const paso = (t) => { if (dead) return; const p = Math.min(1, Math.max(0, (t - t0) / 1100)); b.textContent = fmt(fin * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(paso); };
      b.textContent = fmt(0); requestAnimationFrame(paso);
    }
  }
  function ir(n) {
    if (n < 0) n = 0;
    if (n >= S.length) return;
    i = n;
    const s = S[i];
    pag.className = `wr-pag ${s.fondo}`;
    pag.setAttribute('style', s.estilo || '');
    pag.innerHTML = `<div class="wr-s" data-id="${s.id}">${s.html}</div>`;
    barras.forEach((b, k) => { b.className = k < i ? 'hecha' : k === i ? 'ahora' : ''; b.firstChild.style.animationDuration = `${DURA}ms`; });
    ajustar();
    contar();
    vibrar?.(8);
    clearTimeout(timer); restante = DURA; pausa = false; el.querySelector('.wr').classList.remove('pausa');
    if (!s.fin) { inicio = Date.now(); timer = setTimeout(() => ir(i + 1), DURA); } else barras[i].className = 'hecha';
    if (s.fin) {
      pag.querySelector('[data-wr="compartir"]').onclick = (e) => { e.stopPropagation(); compartirResumen(d); };
      pag.querySelector('[data-wr="otra"]').onclick = (e) => { e.stopPropagation(); ir(0); };
    }
  }
  // Tocar a la izquierda: atrás; a la derecha: siguiente; mantener pulsado: pausa
  let abajo = 0;
  const wr = el.querySelector('.wr');
  wr.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    abajo = Date.now();
    if (S[i].fin) return;
    clearTimeout(timer); restante -= Date.now() - inicio; pausa = true; wr.classList.add('pausa');
  });
  wr.addEventListener('pointerup', (e) => {
    if (e.target.closest('button') || !abajo) return;
    const largo = Date.now() - abajo > 280; abajo = 0;
    if (largo && pausa) { pausa = false; wr.classList.remove('pausa'); inicio = Date.now(); timer = setTimeout(() => ir(i + 1), Math.max(300, restante)); return; }
    const izq = e.clientX < (wr.clientWidth || window.innerWidth) * 0.3;
    ir(izq ? i - 1 : i + 1);
  });
  ir(0);
  return { cleanup() { dead = true; clearTimeout(timer); } };
};

/* ---------- Dónde se anuncia ---------- */
anio.bannerHTML = function bannerHTML() {
  if (!this.temporada()) return '';
  const y = this.anioResumen();
  const visto = store.get('anioVisto', null) === y;
  return `<a class="wr-banner${visto ? ' visto' : ''}" href="#tuano">
    <span class="wr-banner-n">${y}</span>
    <span class="wr-banner-tx"><b>${visto ? 'Vuelve a ver tu año' : '✨ Ya está aquí tu año'}</b><small>${visto ? 'Y compártelo cuando quieras' : 'Tus paradas, tus líneas y qué viajero eres'}</small></span>${ICON.chev}</a>`;
};
anio.entradaHTML = function entradaHTML() {
  const y = this.anioResumen();
  return `<a class="btn ghost block wr-entrada" href="#tuano">✨ ${this.temporada() ? `Tu ${y} en BusSev` : `Tu ${y} en BusSev, hasta ahora`}</a>`;
};
window.addEventListener('hashchange', () => { if (location.hash === '#tuano') store.set('anioVisto', anio.anioResumen()); });

/* Aviso el 1 de diciembre por la mañana (una vez al año, si las notificaciones están permitidas) */
async function programarAviso() {
  try {
    if (!window.Capacitor?.isPluginAvailable?.('LocalNotifications')) return;
    const ahora = new Date(), y = ahora.getFullYear();
    const cuando = new Date(y, 11, 1, 10, 30);
    if (ahora >= cuando || store.get('anioAviso', null) === y) return;
    const perm = await window.Capacitor.nativePromise('LocalNotifications', 'checkPermissions').catch(() => ({}));
    if (perm.display !== 'granted') return;
    await window.Capacitor.nativePromise('LocalNotifications', 'schedule', { notifications: [{
      id: 770000 + (y % 1000), title: `✨ Tu ${y} en BusSev ya está aquí`, body: 'Tus paradas, tus líneas y qué tipo de viajero eres. Ábrelo y compártelo.',
      extra: { abrir: 'tuano' }, schedule: { at: cuando.toISOString(), allowWhileIdle: true }, smallIcon: 'ic_stat_bus', iconColor: '#7A1D34',
    }] });
    store.set('anioAviso', y);
  } catch { /* sin aviso */ }
}
try {
  window.Capacitor?.Plugins?.LocalNotifications?.addListener?.('localNotificationActionPerformed', (e) => {
    if (e?.notification?.extra?.abrir === 'tuano') location.hash = 'tuano';
  });
} catch { /* nada */ }
setTimeout(programarAviso, 4000);
// Si Favoritas ya se pintó antes de cargar esto, se añade el aviso del resumen
try {
  const cab = document.querySelector('#view-favoritas .page-head');
  if (cab && !document.querySelector('.wr-banner')) { const h = anio.bannerHTML(); if (h) cab.insertAdjacentHTML('afterend', h); }
} catch { /* nada */ }

/* Copia de seguridad: los números del año (se limpian al restaurar; nunca se mezcla nada raro) */
anio.copia = () => store.get('anio', null) || {};
anio.restaurar = (o) => {
  if (!o || typeof o !== 'object') return 0;
  const num = (v, max = 1e7) => (typeof v === 'number' && isFinite(v) && v >= 0 ? Math.min(v, max) : 0);
  const mapa = (m, re) => { const out = {}; if (m && typeof m === 'object') for (const [k, v] of Object.entries(m).slice(0, 3000)) if (re.test(k)) out[k] = num(v); return out; };
  const todo = store.get('anio', null) || {};
  let n = 0;
  for (const [y, a] of Object.entries(o)) {
    if (!/^20\d\d$/.test(y) || !a || typeof a !== 'object') continue;
    const limpio = { ...vacio(), desde: num(a.desde, 4102444800000) || Date.now(), dias: mapa(a.dias, /^\d\d-\d\d$/), paradas: mapa(a.paradas, /^\d{1,7}$/), lineas: mapa(a.lineas, /^[A-Za-z0-9]{1,8}$/),
      horas: Array.from({ length: 24 }, (_, h) => num(Array.isArray(a.horas) ? a.horas[h] : 0)) };
    for (const k of ['avisos', 'sensor', 'bajadas', 'rutas', 'tarjeta', 'gasto', 'recargas']) limpio[k] = num(a[k]);
    // Si en este móvil ya hay datos de ese año, se queda el que tenga más días
    if (!todo[y] || Object.keys(limpio.dias).length > Object.keys(todo[y].dias || {}).length) { todo[y] = limpio; n++; }
  }
  store.set('anio', todo);
  return n;
};
anio.tarjetaSVG = tarjetaSVG;
anio.historias = historias;
window.anio = anio;
})();
