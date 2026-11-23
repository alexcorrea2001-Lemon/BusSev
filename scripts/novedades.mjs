// Compara los datos de TUSSAM que llevaba la app con los nuevos y apunta QUÉ ha cambiado (líneas, paradas,
// recorridos y horarios) en www/novedades.json. La app lo enseña al actualizar («Novedades») y GitHub lo pone
// en la descripción de la versión publicada.
//
//   node scripts/novedades.mjs <data.js de antes> <data.js nuevo> <www/novedades.json>
//       -> si hay cambios, escribe el archivo; si no, lo deja como estaba.
//   node scripts/novedades.mjs --recorridos <recorridos.js de antes> <recorridos.js nuevo> <www/data.js> <www/novedades.json>
//       -> añade «Recorridos que cambian en el mapa» (las líneas cuyo dibujo se mueve más de 40 m).
//   node scripts/novedades.mjs --publicar <www/novedades.json>
//       -> escribe en $GITHUB_ENV el texto (NOVEDADES_MD) y los datos (NOVEDADES_B64) para la publicación.
//
// Nunca hace fallar la compilación: ante cualquier problema, avisa y sale con 0.
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

const leer = (f) => { const c = { window: {} }; vm.runInNewContext(fs.readFileSync(f, 'utf8'), c); return c.window.BUSSEV_DATA; };
const orden = (a, b) => String(a).localeCompare(String(b), 'es', { numeric: true });
const metros = (a, b) => Math.hypot((a.latitud - b.latitud) * 110540, (a.longitud - b.longitud) * 111320 * Math.cos(37.39 * Math.PI / 180));
const junta = (xs, max = 8) => (xs.length > max ? [...xs.slice(0, max), `y ${xs.length - max} más`] : xs);

export function comparar(viejo, nuevo) {
  const grupos = [];
  const mete = (t, i) => { if (i.length) grupos.push({ t, i }); };
  const Lv = new Map(viejo.lineas.map((l) => [String(l.numero), l])), Ln = new Map(nuevo.lineas.map((l) => [String(l.numero), l]));
  const Pv = new Map(viejo.paradas.map((p) => [String(p.codigo), p])), Pn = new Map(nuevo.paradas.map((p) => [String(p.codigo), p]));
  const nombreP = (c) => { const p = Pn.get(String(c)) || Pv.get(String(c)); return p ? `${p.nombre} (${c})` : `parada ${c}`; };

  // Líneas
  mete('Líneas nuevas', [...Ln.keys()].filter((n) => !Lv.has(n)).sort(orden).map((n) => `${n} · ${Ln.get(n).nombre}`));
  mete('Líneas que desaparecen', [...Lv.keys()].filter((n) => !Ln.has(n)).sort(orden).map((n) => `${n} · ${Lv.get(n).nombre}`));
  mete('Líneas que cambian de nombre', [...Ln.keys()].filter((n) => Lv.has(n) && Lv.get(n).nombre !== Ln.get(n).nombre).sort(orden).map((n) => `${n}: ahora «${Ln.get(n).nombre}»`));

  // Recorridos: paradas por las que pasa cada línea en cada sentido
  const rec = (d) => { const m = new Map(); for (const [c, l, s, o] of d.recorridos) { const k = `${l}|${s}`; if (!m.has(k)) m.set(k, []); m.get(k).push([o, String(c)]); } for (const v of m.values()) v.sort((a, b) => a[0] - b[0]); return m; };
  const Rv = rec(viejo), Rn = rec(nuevo);
  const cambios = [];
  for (const n of [...Ln.keys()].filter((x) => Lv.has(x)).sort(orden)) {
    const de = (R) => [1, 2].map((s) => (R.get(`${n}|${s}`) || []).map((x) => x[1]));
    const [a1, a2] = de(Rv), [b1, b2] = de(Rn);
    if (a1.join() === b1.join() && a2.join() === b2.join()) continue;
    const antes = new Set([...a1, ...a2]), ahora = new Set([...b1, ...b2]);
    const mas = [...ahora].filter((c) => !antes.has(c)), menos = [...antes].filter((c) => !ahora.has(c));
    const partes = [];
    if (mas.length) partes.push(`ahora para en ${junta(mas.map(nombreP), 3).join(', ')}`);
    if (menos.length) partes.push(`deja de parar en ${junta(menos.map(nombreP), 3).join(', ')}`);
    if (!partes.length) partes.push('cambia el orden de las paradas');
    cambios.push(`${n}: ${partes.join('; ')}`);
  }
  mete('Líneas que cambian de recorrido', junta(cambios, 12));

  // Paradas
  const nuevasP = [...Pn.keys()].filter((c) => !Pv.has(c)).sort(orden), quitadasP = [...Pv.keys()].filter((c) => !Pn.has(c)).sort(orden);
  mete('Paradas nuevas', junta(nuevasP.map(nombreP)));
  mete('Paradas que se quitan', junta(quitadasP.map(nombreP)));
  const comunes = [...Pn.keys()].filter((c) => Pv.has(c)).sort(orden);
  mete('Paradas que cambian de nombre', junta(comunes.filter((c) => Pv.get(c).nombre !== Pn.get(c).nombre).map((c) => `${c}: «${Pv.get(c).nombre}» pasa a ser «${Pn.get(c).nombre}»`)));
  mete('Paradas que cambian de sitio', junta(comunes.filter((c) => metros(Pv.get(c), Pn.get(c)) > 40).map((c) => `${nombreP(c)}, unos ${Math.round(metros(Pv.get(c), Pn.get(c)) / 10) * 10} m`)));

  // Horarios (primer y último autobús). Solo si TUSSAM ha publicado datos nuevos: con los mismos datos, un cambio de
  // horas viene de cómo los calcula la app (p. ej. al corregir el cálculo), no de TUSSAM, y no se anuncia.
  const mismosDatos = String(viejo.generado) === String(nuevo.generado) && String(viejo.caduca) === String(nuevo.caduca);
  if (!mismosDatos) {
  const hor = (l) => [l.hora_inicio_ida, l.hora_fin_ida, l.hora_inicio_vuelta, l.hora_fin_vuelta].map((x) => x || '').join('|');
  mete('Líneas que cambian de horario', junta([...Ln.keys()].filter((n) => Lv.has(n) && hor(Lv.get(n)) !== hor(Ln.get(n))).sort(orden).map((n) => {
    const l = Ln.get(n); return `${n}: primer bus ${l.hora_inicio_ida || '—'}, último ${l.hora_fin_ida || '—'}`;
  }), 12));
  }

  return { id: String(nuevo.generado || ''), desde: String(viejo.generado || ''), fecha: new Date().toISOString().slice(0, 10), grupos };
}

/* Recorridos dibujados (www/recorridos.js): qué líneas cambian de calle en el mapa aunque paren en las mismas
   paradas (TUSSAM solo ha cambiado el trazado). Un cambio de menos de 40 m es un retoque del dibujo y no se cuenta. */
const leerRec = (f) => { const c = { window: {} }; vm.runInNewContext(fs.readFileSync(f, 'utf8'), c); return c.window.BUSSEV_RECORRIDOS || {}; };
const desplegar = (r) => { const pts = []; let la = 0, lo = 0; for (let i = 0; i + 1 < (r?.d?.length || 0); i += 2) { la += r.d[i]; lo += r.d[i + 1]; pts.push([la / 1e5, lo / 1e5]); } return pts; };
const kx = 111320 * Math.cos(37.39 * Math.PI / 180), ky = 110540;
const aSegmento = (p, a, b) => {
  const bx = (b[1] - a[1]) * kx, by = (b[0] - a[0]) * ky, px = (p[1] - a[1]) * kx, py = (p[0] - a[0]) * ky;
  const L2 = bx * bx + by * by, t = L2 ? Math.max(0, Math.min(1, (px * bx + py * by) / L2)) : 0;
  return Math.hypot(px - t * bx, py - t * by);
};
const aLinea = (p, pts) => { let m = Infinity; for (let i = 1; i < pts.length; i++) m = Math.min(m, aSegmento(p, pts[i - 1], pts[i])); return m; };
// El punto de «a» que más se aleja de «b» (y cuánto)
const masLejos = (a, b) => { let m = { d: 0, p: null }; const paso = Math.max(1, Math.floor(a.length / 400)); for (let i = 0; i < a.length; i += paso) { const d = aLinea(a[i], b); if (d > m.d) m = { d, p: a[i] }; } return m; };

export function compararRecorridos(Rv, Rn, datos, umbral = 40) {
  const P = new Map((datos?.paradas || []).map((p) => [String(p.codigo), p]));
  const L = new Map((datos?.lineas || []).map((l) => [String(l.numero), l]));
  const paradasDe = (k) => { const [l, s] = k.split('|'); return (datos?.recorridos || []).filter((r) => String(r[1]) === l && String(r[2]) === s).sort((a, b) => a[3] - b[3]).map((r) => P.get(String(r[0]))).filter(Boolean); };
  const cerca = (pt, ps) => { let m = null; for (const p of ps) { const d = Math.hypot((p.latitud - pt[0]) * ky, (p.longitud - pt[1]) * kx); if (!m || d < m.d) m = { d, p }; } return m?.p; };
  const items = [];
  for (const k of Object.keys(Rn).sort(orden)) {
    if (!Rv[k] || JSON.stringify(Rv[k].d) === JSON.stringify(Rn[k].d)) continue;
    const a = desplegar(Rv[k]), b = desplegar(Rn[k]);
    if (a.length < 2 || b.length < 2) continue;
    const x = masLejos(b, a), y = masLejos(a, b), peor = x.d >= y.d ? x : y;
    if (peor.d < umbral) continue;
    const ps = paradasDe(k), hacia = ps.at(-1)?.nombre || L.get(k.split('|')[0])?.nombre || '';
    const junto = peor.p ? cerca(peor.p, ps) : null;
    items.push({ k, texto: `${k.split('|')[0]}${hacia ? ` hacia ${hacia}` : ''}${junto ? `: cambia de calle cerca de ${junto.nombre}` : ''} (hasta ${Math.round(peor.d / 10) * 10} m)` });
  }
  // Las líneas nuevas en el mapa (sin dibujo antes) ya salen en «Líneas nuevas»: aquí solo las que cambian.
  return items.map((i) => i.texto);
}

export const aTexto = (nov) => (nov.grupos || []).map((g) => `**${g.t}**\n${g.i.map((x) => `- ${x}`).join('\n')}`).join('\n\n');

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  try {
    if (process.argv[2] === '--recorridos') {
      const [, , , fViejo, fNuevo, fDatos, fSalida] = process.argv;
      if (!fs.existsSync(fViejo)) { console.log('No había recorridos antes: nada que comparar.'); process.exit(0); }
      const cambios = compararRecorridos(leerRec(fViejo), leerRec(fNuevo), leer(fDatos));
      if (!cambios.length) { console.log('Los recorridos dibujados no cambian (o solo en retoques de menos de 40 m).'); process.exit(0); }
      const hoy = new Date().toISOString().slice(0, 10);
      let nov = null;
      try { nov = JSON.parse(fs.readFileSync(fSalida, 'utf8')); } catch { /* no hay novedades de datos */ }
      // Si ya hay novedades de HOY (las de los datos de esta misma revisión), se añaden; si son de otra semana, se empieza de cero.
      if (!nov || nov.fecha !== hoy || !Array.isArray(nov.grupos)) nov = { id: `${leer(fDatos).generado || ''}`, desde: '', fecha: hoy, grupos: [] };
      nov.grupos = nov.grupos.filter((g) => g.t !== 'Recorridos que cambian en el mapa');
      nov.grupos.push({ t: 'Recorridos que cambian en el mapa', i: junta(cambios, 12) });
      // Otro id para que la app lo enseñe aunque los datos de paradas sean los mismos de la otra vez
      nov.id = `${String(nov.id).split('+r')[0]}+r${crypto.createHash('sha1').update(cambios.join('|')).digest('hex').slice(0, 8)}`;
      fs.writeFileSync(fSalida, JSON.stringify(nov, null, 1) + '\n');
      console.log(`Recorridos que cambian en el mapa (${cambios.length}):`); for (const c of cambios) console.log(`- ${c}`);
    } else if (process.argv[2] === '--publicar') {
      let md = '', b64 = '';
      try {
        const nov = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
        if (nov.grupos?.length) { md = `### Cambios en los datos de TUSSAM (${nov.fecha})\n\n${aTexto(nov)}`; b64 = Buffer.from(JSON.stringify(nov), 'utf8').toString('base64'); }
      } catch { /* aún no hay novedades apuntadas */ }
      const salida = `NOVEDADES_MD<<FIN_NOVEDADES_BUSSEV\n${md}\nFIN_NOVEDADES_BUSSEV\nNOVEDADES_B64=${b64}\n`;
      if (process.env.GITHUB_ENV) fs.appendFileSync(process.env.GITHUB_ENV, salida); else process.stdout.write(salida);
      console.log(md ? 'Novedades de datos añadidas a la publicación.' : 'Sin novedades de datos que publicar.');
    } else {
      const [, , fViejo, fNuevo, fSalida] = process.argv;
      const nov = comparar(leer(fViejo), leer(fNuevo));
      if (nov.grupos.length) {
        fs.writeFileSync(fSalida, JSON.stringify(nov, null, 1) + '\n');
        console.log(`Novedades de datos apuntadas en ${fSalida}:`); console.log(aTexto(nov).replace(/\*\*/g, ''));
      } else console.log('Los datos nuevos no cambian ni líneas, ni paradas, ni recorridos, ni horarios.');
    }
  } catch (e) { console.log(`No se han podido calcular las novedades (${e.message}). No pasa nada.`); }
}
