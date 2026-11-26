/* BusSev — aviso de llegada, lectura en voz alta, cómo llegar y copia de seguridad. */
'use strict';

const plugin = (name) => !!window.Capacitor?.isPluginAvailable?.(name);
const native = (name, method, opts = {}) => window.Capacitor.nativePromise(name, method, opts);

/* ================================================================== */
/* Aviso de llegada (notificación local, sin servidores)               */
/* Se programa con el tiempo que da TUSSAM y se corrige cada vez que   */
/* la app vuelve a consultar esa parada.                               */
/* ================================================================== */
/* Selector de hora de BusSev: la hora grande en el centro, − y + de 5 en 5 minutos, y al tocar la hora se abre el
   reloj del móvil (el <input type="time"> va invisible encima). Con «dia», dice si es hoy o mañana. */
function horaPickerHTML(id, valor, { dia = false, paso = 5 } = {}) {
  return `<div class="hora-pick" data-hora-pick="${id}">
    <button type="button" class="hp-mas" data-hp="-${paso}" aria-label="${paso} minutos antes">−</button>
    <label class="hp-centro"><b class="hp-hora">${esc(valor)}</b>${dia ? '<small class="hp-dia"></small>' : ''}<input type="time" id="${id}" value="${esc(valor)}" aria-label="Hora"></label>
    <button type="button" class="hp-mas" data-hp="${paso}" aria-label="${paso} minutos después">+</button></div>`;
}
function horaPicker(raiz, id, alCambiar) {
  const box = raiz.querySelector(`[data-hora-pick="${id}"]`);
  if (!box) return;
  const inp = box.querySelector('input'), txt = box.querySelector('.hp-hora'), dia = box.querySelector('.hp-dia');
  const pintar = () => {
    txt.textContent = inp.value || '--:--';
    if (dia) {
      const [h, m] = String(inp.value).split(':').map(Number);
      const d = new Date(); d.setHours(h, m, 0, 0);
      dia.textContent = Number.isFinite(h) ? (d.getTime() < Date.now() - 5 * 60000 ? 'mañana' : 'hoy') : '';
    }
  };
  inp.addEventListener('change', () => { pintar(); alCambiar?.(inp.value); });
  inp.addEventListener('input', pintar);
  box.querySelectorAll('[data-hp]').forEach((b) => { b.onclick = () => {
    const [h, m] = String(inp.value || '08:00').split(':').map(Number);
    let t = ((h * 60 + m + Number(b.dataset.hp)) % 1440 + 1440) % 1440;
    t = Math.round(t / 5) * 5 % 1440;
    inp.value = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
    vibrar(8); pintar(); alCambiar?.(inp.value);
  }; });
  pintar();
}
window.horaPickerHTML = horaPickerHTML;
window.horaPicker = horaPicker;

const avisos = {
  list() { const now = Date.now(); return store.get('avisos', []).filter((a) => a.at > now - 60_000); },
  save(l) { store.set('avisos', l); },
  find(codigo, linea, destino) { return this.list().find((a) => a.codigo === codigo && a.linea === linea && a.destino === destino) || null; },
  /* Canal de alta importancia: así el aviso salta encima (heads-up), suena y vibra
     aunque el móvil esté en silencio de notificaciones normales. Es idempotente. */
  /* Canal del sonido elegido en Ajustes (lo crea Android; si es una versión vieja, el de siempre) */
  async idCanal() {
    const son = settings.sonidoAviso || 'sistema';
    if (plugin('BusSevApariencia')) { try { return (await native('BusSevApariencia', 'canalAviso', { sonido: son })).canal || 'bussev_llegada'; } catch { /* */ } }
    return 'bussev_llegada';
  },
  async canal() {
    if (this._canal || !plugin('LocalNotifications')) return;
    try {
      await native('LocalNotifications', 'createChannel', {
        id: 'bussev_llegada', name: 'Avisos de llegada',
        description: 'Te avisa cuando tu autobús está a punto de llegar.',
        importance: 5, visibility: 1, vibration: true, lights: true, lightColor: '#D41C2B',
      });
    } catch { /* algunos Android no lo soportan: se usará el canal por defecto */ }
    this._canal = true;
  },
  async permiso() {
    if (!plugin('LocalNotifications')) throw new Error('Los avisos solo funcionan en la app instalada.');
    let p = await native('LocalNotifications', 'checkPermissions').catch(() => ({}));
    if (p.display !== 'granted') p = await native('LocalNotifications', 'requestPermissions').catch(() => ({}));
    if (p.display !== 'granted') throw new Error('Activa las notificaciones de BusSev en los ajustes del móvil para recibir avisos.');
    await this.canal();
  },
  async programar(a) {
    const at = Math.max(Date.now() + 5000, Date.now() + (a.minutos - a.antes) * 60_000);
    const id = a.id || (Math.floor(Math.random() * 2_000_000_000) + 1);
    await this.canal();
    await native('LocalNotifications', 'cancel', { notifications: [{ id }] }).catch(() => null);
    // Versión nueva: Android vuelve a preguntar a TUSSAM en los últimos minutos y corrige el aviso aunque
    // la app esté cerrada. Si no está (versión vieja del APK), se programa la notificación de siempre.
    let vigilado = false;
    if (plugin('BusSevViaje')) {
      try {
        await native('BusSevViaje', 'vigilarLlegada', { id, codigo: a.codigo, parada: a.parada, linea: a.linea, destino: a.destino, antes: a.antes, at, sonido: settings.sonidoAviso || 'sistema', viaje: window.pasaporte?.auto?.datosAviso?.(a.codigo) });
        window.anio?.apuntar?.('aviso', { codigo: a.codigo, linea: a.linea });
        vigilado = true;
      } catch { /* se usa la notificación de siempre */ }
    }
    if (!vigilado) await native('LocalNotifications', 'schedule', { notifications: [{
      id, title: `Línea ${a.linea}: llega en ${a.antes} min`, body: `${a.parada} · hacia ${a.destino}`,
      schedule: { at: new Date(at).toISOString(), allowWhileIdle: true }, channelId: await this.idCanal(),
      smallIcon: 'ic_stat_bus', iconColor: '#D41C2B', autoCancel: true,
    }] });
    const l = this.list().filter((x) => x.id !== id);
    l.push({ id, codigo: a.codigo, parada: a.parada, linea: a.linea, destino: a.destino, antes: a.antes, at });
    this.save(l);
    return at;
  },
  async cancelar(id) {
    if (plugin('LocalNotifications')) await native('LocalNotifications', 'cancel', { notifications: [{ id }] }).catch(() => null);
    if (plugin('BusSevViaje')) await native('BusSevViaje', 'quitarLlegada', { id }).catch(() => null);
    this.save(this.list().filter((x) => x.id !== id));
  },
  /* Corrige la hora del aviso con los tiempos nuevos de la parada */
  actualizar(codigo, tiempos) {
    const mios = this.list().filter((a) => a.codigo === codigo);
    for (const a of mios) {
      const t = (tiempos || []).filter((x) => x.linea === a.linea && x.destino === a.destino).sort((x, y) => x.tiempo_minutos - y.tiempo_minutos)[0];
      if (!t) continue;
      // El aviso (en Android) usa este mismo dato: así marca los mismos minutos que la app y avisa a la vez
      if (t.segundos != null && plugin('BusSevViaje')) native('BusSevViaje', 'datoLlegada', { id: a.id, segundos: t.segundos }).catch(() => null);
      const nuevo = Date.now() + (t.tiempo_minutos - a.antes) * 60_000;
      if (Math.abs(nuevo - a.at) > 45_000 && nuevo > Date.now()) this.programar({ ...a, minutos: t.tiempo_minutos }).catch(() => null);
    }
  },
};
window.avisos = avisos; // lo usa app.js para marcar los avisos activos

/* «Quitar aviso» desde la notificación de Android: la app también lo borra de su lista */
async function sincronizarQuitados() {
  if (!plugin('BusSevViaje')) return;
  const r = await native('BusSevViaje', 'llegadasQuitadas').catch(() => null);
  const ids = new Set((r?.ids || []).map(Number));
  if (!ids.size) return;
  const antes = store.get('avisos', []);
  const quedan = antes.filter((a) => !ids.has(Number(a.id)));
  if (quedan.length === antes.length) return;
  avisos.save(quedan);
  if (['parada', 'favoritas', 'cerca'].includes(active?.name)) (active.rerender || active.refresh)?.();
}
window.addEventListener('bussevAvisoQuitado', () => { sincronizarQuitados(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sincronizarQuitados(); });
setTimeout(sincronizarQuitados, 1500);

/* Avisos que se repiten: «de lunes a viernes, desde las 7:40, avísame cuando al 27 le falten 5 min».
   Los lleva Android: cada día, a esa hora, crea un aviso de llegada normal y lo vigila con TUSSAM. */
const DIAS_CORTOS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const repetidos = {
  list: () => store.get('avisosRep', []),
  de(codigo, linea, destino) { return this.list().filter((r) => r.codigo === String(codigo) && r.linea === String(linea) && (!destino || r.destino === destino)); },
  texto(r) {
    const d = r.dias.map((x, i) => (x ? i : -1)).filter((i) => i >= 0);
    const dias = d.length === 7 ? 'Todos los días' : d.join() === '0,1,2,3,4' ? 'De lunes a viernes' : d.join() === '5,6' ? 'Fines de semana' : d.map((i) => DIAS_CORTOS[i]).join(' ');
    return `${dias} desde las ${String(Math.floor(r.hora / 60)).padStart(2, '0')}:${String(r.hora % 60).padStart(2, '0')} · cuando falten ${r.antes} min`;
  },
  async poner(r) {
    if (!plugin('BusSevViaje')) throw new Error('Los avisos que se repiten solo funcionan en la app instalada.');
    await avisos.permiso();
    const nuevo = { ...r, id: r.id || (Math.floor(Math.random() * 900_000_000) + 100_000_000), codigo: String(r.codigo), linea: String(r.linea), sonido: settings.sonidoAviso || 'sistema' };
    await native('BusSevViaje', 'repetirLlegada', { ...nuevo, viaje: window.pasaporte?.auto?.datosAviso?.(nuevo.codigo) });
    store.set('avisosRep', [...this.list().filter((x) => x.id !== nuevo.id), nuevo]);
    return nuevo;
  },
  async quitar(id) {
    if (plugin('BusSevViaje')) await native('BusSevViaje', 'quitarRepetido', { id }).catch(() => null);
    store.set('avisosRep', this.list().filter((x) => x.id !== id));
  },
  /* La ventana para crearlo */
  abrir({ codigo, parada, linea, destino, color }) {
    const ahora = new Date(); const m0 = Math.floor((ahora.getHours() * 60 + ahora.getMinutes()) / 5) * 5;
    const d = { dias: [true, true, true, true, true, false, false], hora: m0, antes: 5 };
    const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    openModal(`<h2>Repetir el aviso</h2>
      <div class="row-flat">${badge(linea, color)}<div><b>${esc(destino)}</b><p class="help">${esc(parada)}</p></div></div>
      <section class="pz-sec"><h3>Qué días</h3><div class="rep-dias">${DIAS_CORTOS.map((x, i) => `<button type="button" class="chip" data-dia="${i}" aria-pressed="${d.dias[i]}">${x}</button>`).join('')}</div></section>
      <section class="pz-sec"><h3>Desde qué hora</h3>${horaPickerHTML('rep-hora', hhmm(d.hora))}
        <p class="help" style="margin:0">A esa hora el móvil empieza a mirar a TUSSAM (aunque la app esté cerrada).</p></section>
      <section class="pz-sec"><h3>Avísame cuando falten</h3><div class="seg">${[2, 5, 10].map((n) => `<button type="button" data-rantes="${n}" aria-pressed="${n === d.antes}">${n} min</button>`).join('')}</div></section>
      <div class="actions"><button class="btn ghost" type="button" id="rep-x">Cancelar</button><button class="btn" type="button" id="rep-ok">Guardar</button></div>`, (m, close) => {
      horaPicker(m, 'rep-hora');
      m.querySelectorAll('[data-dia]').forEach((b) => { b.onclick = () => { const i = Number(b.dataset.dia); d.dias[i] = !d.dias[i]; b.setAttribute('aria-pressed', d.dias[i]); vibrar(8); }; });
      m.querySelectorAll('[data-rantes]').forEach((b) => { b.onclick = () => { d.antes = Number(b.dataset.rantes); m.querySelectorAll('[data-rantes]').forEach((x) => x.setAttribute('aria-pressed', x === b)); vibrar(8); }; });
      $('#rep-x', m).onclick = close;
      $('#rep-ok', m).onclick = async () => {
        const [h, mi] = String($('#rep-hora', m).value || hhmm(d.hora)).split(':').map(Number);
        if (!d.dias.some(Boolean)) { toast('Elige al menos un día'); return; }
        try {
          const r = await this.poner({ codigo, parada, linea, destino, antes: d.antes, hora: h * 60 + mi, dias: d.dias });
          close(); vibrar(12); toast(`Listo: ${this.texto(r).charAt(0).toLowerCase() + this.texto(r).slice(1)}`); active.rerender?.();
        } catch (e) { toast(e?.message || 'No se ha podido guardar'); }
      };
    });
  },
};
window.repetidos = repetidos;
/* Modo sensor: lo lleva Android (SensorService). Aquí se recuerda cuál está activo para enseñarlo
   (📳 en el autobús, aviso en la parada y botón «Parar»), y se comprueba con Android por si ya terminó. */
const sensorBus = {
  get() { const s = store.get('sensorActivo', null); return s && Date.now() - s.inicio < 41 * 60000 ? s : null; },
  es(codigo, linea, destino) { const s = this.get(); return !!s && s.codigo === String(codigo) && s.linea === String(linea) && (!s.destino || !destino || s.destino === destino); },
  async empezar(d) { await native('BusSevViaje', 'empezarSensor', d); window.anio?.apuntar?.('sensor', { codigo: d.codigo, linea: d.linea }); store.set('sensorActivo', { ...d, codigo: String(d.codigo), linea: String(d.linea), inicio: Date.now() }); },
  async parar() { store.set('sensorActivo', null); try { await native('BusSevViaje', 'pararSensor', {}); } catch { /* ya estaba parado */ } },
  async revisar() {
    if (!plugin('BusSevViaje') || !store.get('sensorActivo', null)) return;
    try { const r = await native('BusSevViaje', 'estadoSensor', {}); if (!r?.activo) { store.set('sensorActivo', null); active.rerender?.(); } } catch { /* sin Android */ }
  },
  bannerHTML(codigo) {
    const s = this.get();
    if (!s || s.codigo !== String(codigo)) return '';
    return `<div class="sensor-on"><span class="sensor-ico" aria-hidden="true">📳</span><div><b>Modo sensor activo</b><p>${esc(s.linea)}${s.destino ? ` → ${esc(s.destino)}` : ''} · vibrará cada minuto desde que falten 5</p></div><button class="btn ghost" type="button" data-sensor-parar>Parar</button></div>`;
  },
};
window.sensorBus = sensorBus;
document.addEventListener('click', async (e) => {
  if (!e.target.closest('[data-sensor-parar]')) return;
  await sensorBus.parar(); vibrar(10); toast('Modo sensor parado'); active.rerender?.();
});
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sensorBus.revisar(); });

const AV_IC = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const AV_ICONOS = {
  una: AV_IC('<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15Z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>'),
  sensor: AV_IC('<rect x="8" y="3" width="8" height="18" rx="2"/><path d="M11 17.5h2M4.5 8.5v7M2 10.5v3M19.5 8.5v7M22 10.5v3"/>'),
  subo: AV_IC('<rect x="5" y="3" width="14" height="13" rx="3"/><path d="M5 10h14M8 19.5v-3.5M16 19.5v-3.5M9 13h.01M15 13h.01"/><path d="M12 21.5v-2"/>'),
  repetir: AV_IC('<path d="M17 2.5l3 3-3 3"/><path d="M4 11.5v-1a5 5 0 0 1 5-5h11"/><path d="M7 21.5l-3-3 3-3"/><path d="M20 12.5v1a5 5 0 0 1-5 5H4"/>'),
};
function avisoModal({ codigo, parada, linea, destino, minutos, color }) {
  const ya = avisos.find(codigo, linea, destino);
  const opciones = [2, 3, 5, 10, 15].filter((n) => n < minutos).slice(0, 4);
  const conSensor = plugin('BusSevViaje') && minutos > 0;
  const sensorActivo = plugin('BusSevViaje') && sensorBus.es(codigo, linea, destino);
  // Tres formas de avisarte: eliges una y debajo sale lo suyo
  const modos = [
    ...(opciones.length ? [['una', 'Una vez', 'Una notificación a los minutos que elijas']] : []),
    ...(conSensor || sensorActivo ? [['sensor', 'Sensor', 'Vibra cada minuto desde que falten 5']] : []),
    ['subo', 'Me subo', 'Te aviso cuando tengas que bajar'],
  ];
  const modo0 = sensorActivo ? 'sensor' : modos[0][0];
  const minSel = ya && opciones.includes(ya.antes) ? ya.antes : opciones[0];
  const repes = plugin('BusSevViaje') ? repetidos.de(codigo, linea, destino) : [];
  openModal(`<div class="av2">
    <div class="av2-cab">${badge(linea, color)}<div class="av2-dest"><b>${esc(destino)}</b><span>${esc(parada)}</span></div>
      <div class="av2-min">${minutos <= 0 ? '<b class="av2-ya">Llegando</b>' : `<b>${minutos}<small>′</small></b><span>le falta${minutos === 1 ? '' : 'n'}</span>`}</div></div>
    ${ya ? `<div class="alert av2-alerta">${AV_ICONOS.una}<span>Tienes un aviso para cuando falten ${ya.antes} min (sobre las ${new Date(ya.at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}).</span></div>` : ''}
    <h3 class="av2-tit">¿Cómo quieres que te avise?</h3>
    <div class="av2-modos" role="radiogroup" aria-label="Forma de avisarte">${modos.map(([k, t, d]) => `<button type="button" class="av2-modo" role="radio" data-modo="${k}" aria-checked="${k === modo0}"><span class="av2-ic">${AV_ICONOS[k]}</span><b>${t}</b><small>${d}</small></button>`).join('')}</div>
    ${opciones.length ? `<section class="av2-panel" data-panel="una"${modo0 === 'una' ? '' : ' hidden'}>
      <h3 class="av2-tit">Cuando le falten</h3>
      <div class="av2-mins" role="radiogroup" aria-label="Minutos">${opciones.map((n) => `<button type="button" role="radio" data-min="${n}" aria-checked="${n === minSel}">${n}<small> min</small></button>`).join('')}</div>
      <p class="help">${plugin('BusSevViaje') ? 'Aunque cierres la app, en los últimos minutos el móvil vuelve a mirar a TUSSAM y corrige el aviso si el autobús se adelanta o se retrasa.' : 'El aviso se calcula con el tiempo de ahora y se corrige cada vez que abres la app.'}</p>
      ${plugin('BusSevViaje') ? `${repes.map((r) => `<div class="av2-fila rep-on">${AV_ICONOS.repetir}<span>${esc(repetidos.texto(r))}</span><button class="btn ghost sm" type="button" data-rep-del="${r.id}">Quitar</button></div>`).join('')}
        <button type="button" class="av2-fila av2-rep" id="av-rep">${AV_ICONOS.repetir}<span><b>Repetir cada día</b><small>A la misma hora, sin tener que ponerlo</small></span>${ICON.chev}</button>` : ''}
      <button class="btn block" type="button" id="av-poner">Avisarme a ${minSel} minutos</button></section>` : ''}
    ${conSensor || sensorActivo ? `<section class="av2-panel" data-panel="sensor"${modo0 === 'sensor' ? '' : ' hidden'}>
      ${sensorActivo ? `<div class="sensor-on"><span class="av2-ic">${AV_ICONOS.sensor}</span><div><b>Modo sensor activo</b><p>Vibrará cada minuto desde que falten 5</p></div><button class="btn ghost" type="button" id="av-sensor-parar">Parar</button></div>`
        : `<p class="help">Guárdate el móvil: vibra cada minuto desde que falten 5, y más fuerte cuanto más cerca esté. No hace falta mirar la pantalla.</p>
      <button class="btn block" type="button" id="av-sensor">Activar modo sensor</button>`}</section>` : ''}
    <section class="av2-panel" data-panel="subo"${modo0 === 'subo' ? '' : ' hidden'}>
      <p class="help">Cuando te subas, elige tu parada de bajada y te aviso un poco antes de llegar.</p>
      <button class="btn block" type="button" id="av-bajar">Me subo a este: avísame al bajar</button></section>
    <div class="actions">${ya ? '<button class="btn danger" type="button" id="av-del">Quitar aviso</button>' : ''}<button class="btn ghost" type="button" id="av-x">Cerrar</button></div></div>`,
  (m, close) => {
    $('#av-x', m).onclick = close;
    m.querySelectorAll('[data-modo]').forEach((b) => { b.onclick = () => {
      m.querySelectorAll('[data-modo]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      m.querySelectorAll('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== b.dataset.modo; });
      vibrar(8);
    }; });
    let antes = Number(m.querySelector('[data-min][aria-checked="true"]')?.dataset.min) || 0;
    m.querySelectorAll('[data-min]').forEach((b) => { b.onclick = () => {
      antes = Number(b.dataset.min);
      m.querySelectorAll('[data-min]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      const p = $('#av-poner', m); if (p) p.textContent = `Avisarme a ${antes} minutos`;
    }; });
    $('#av-poner', m)?.addEventListener('click', async () => {
      try {
        await avisos.permiso();
        if (ya) await avisos.cancelar(ya.id);
        const at = await avisos.programar({ codigo, parada, linea, destino, minutos, antes });
        close();
        toast(`Te aviso sobre las ${new Date(at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`);
        active.rerender?.();
      } catch (e) { toast(textoError(e)); }
    });
    $('#av-bajar', m).onclick = () => { close(); bajada.elegir(codigo, linea, destino); };
    $('#av-rep', m)?.addEventListener('click', () => { close(); repetidos.abrir({ codigo, parada, linea, destino, color }); });
    m.querySelectorAll('[data-rep-del]').forEach((b) => { b.onclick = async () => { await repetidos.quitar(Number(b.dataset.repDel)); close(); toast('Aviso que se repetía, quitado'); active.rerender?.(); }; });
    $('#av-sensor-parar', m)?.addEventListener('click', async () => { await sensorBus.parar(); close(); toast('Modo sensor parado'); active.rerender?.(); });
    $('#av-sensor', m)?.addEventListener('click', async () => {
      try {
        await avisos.permiso().catch(() => null);
        await sensorBus.empezar({ codigo, linea, destino, parada });
        close(); active.rerender?.();
        toast(minutos > 5 ? `Modo sensor activado: empezará a vibrar cuando al ${linea} le falten 5 minutos` : 'Modo sensor activado: ya puedes guardarte el móvil');
      } catch (e) { toast(e?.message || 'No se ha podido activar el modo sensor'); }
    });
    $('#av-del', m)?.addEventListener('click', async () => { await avisos.cancelar(ya.id); close(); toast('Aviso quitado'); active.rerender?.(); });
  });
}
document.addEventListener('click', (e) => {
  const r = e.target.closest('[data-av]');
  if (!r) return;
  e.preventDefault();
  const [codigo, linea, destino, minutos, color] = JSON.parse(r.dataset.av);
  const p = cache.paradaByCode.get(codigo);
  avisoModal({ codigo, parada: favs.get(codigo)?.alias || p?.nombre || `Parada ${codigo}`, linea, destino, minutos: Number(minutos), color });
});

/* ================================================================== */
/* «Avísame cuando tenga que bajarme»                                   */
/* Android sigue tu posición mientras vas en el autobús (también con   */
/* la pantalla apagada) y vibra al acercarte a tu parada.              */
/* ================================================================== */
const bajada = {
  web: null,   // en el navegador (sin APK): solo funciona con la app abierta
  actual() { return store.get('bajada', null); },
  /* Paradas desde donde subes hasta donde bajas, en orden */
  tramo(k, desde, hasta) {
    const seq = esTren(k)
      ? ((esMetro(k) ? window.BUSSEV_METRO : window.BUSSEV_CERCANIAS)?.recorridos || []).filter((r) => `${r[1]}|${r[2]}` === k).sort((a, b) => a[3] - b[3]).map((r) => r[0])
      : (indiceRecorridos().seqs.get(k) || []);
    const i = seq.indexOf(String(desde));
    const j = seq.indexOf(String(hasta), i + 1);
    if (i < 0 || j < 0) return null;
    return seq.slice(i, j + 1).map((c) => {
      const p = cache.paradaByCode.get(c) || estacionMetro(c) || (window.BUSSEV_DATA?.paradas || []).find((x) => x.codigo === c) || {};
      return { codigo: c, nombre: p.nombre || `Parada ${c}`, lat: p.latitud, lon: p.longitud };
    }).filter((p) => p.lat != null);
  },
  async empezar({ k, desde, hasta }) {
    const paradas = this.tramo(k, desde, hasta);
    if (!paradas || paradas.length < 2) { toast('No he podido preparar el aviso para esa parada.'); return false; }
    const linea = k.split('|')[0];
    const fin = paradas[paradas.length - 1];
    try { await getPosition(true); } catch (e) { toast(geoErrorText(e)); return false; }   // pide el permiso de ubicación
    if (plugin('BusSevViaje')) {
      try { await avisos.permiso(); } catch (e) { toast(e.message); }
      try { await window.pasaporte?.auto?.parar?.(); } catch { /* nada */ }
      try { await native('BusSevViaje', 'empezarBajada', { linea: lineaInfo(linea)?.etiqueta || etiquetaLinea(linea), paradas }); window.anio?.apuntar?.('bajada', { codigo: paradas[0]?.codigo, linea }); }
      catch (e) { toast(e?.message || 'No se ha podido empezar el aviso.'); return false; }
    } else this.empezarWeb(linea, paradas);
    store.set('bajada', { linea, k, destino: fin.nombre, codigo: fin.codigo, inicio: Date.now(), paradas, actual: 0 });
    toast(`Te aviso al llegar a ${fin.nombre}`);
    location.hash = 'viaje';   // pantalla con las paradas que quedan
    return true;
  },
  async parar() {
    if (plugin('BusSevViaje')) await native('BusSevViaje', 'pararBajada', {}).catch(() => null);
    if (this.web) { navigator.geolocation?.clearWatch?.(this.web); this.web = null; }
    store.set('bajada', null);
    active.rerender?.();
  },
  /* La app se abre: ¿sigue Android avisando? (pudo pararse solo al llegar) */
  async sincronizar() {
    if (!this.actual()) return;
    if (Date.now() - (this.actual().inicio || 0) > 3 * 3600_000) { store.set('bajada', null); return; }
    if (plugin('BusSevViaje')) {
      const r = await native('BusSevViaje', 'estadoBajada', {}).catch(() => null);
      if (r && !r.activo) { store.set('bajada', null); active.rerender?.(); }
    } else if (!this.web) store.set('bajada', null);
  },
  empezarWeb(linea, paradas) {
    if (!navigator.geolocation) return;
    if (this.web) navigator.geolocation.clearWatch(this.web);
    const fin = paradas[paradas.length - 1];
    let avisado = false;
    this.web = navigator.geolocation.watchPosition((p) => {
      const d = haversine([p.coords.latitude, p.coords.longitude], [fin.lat, fin.lon]);
      if (!avisado && d < 400) { avisado = true; navigator.vibrate?.([600, 250, 600, 250, 900]); toast(`Bájate en la próxima: ${fin.nombre}`); }
      if (d < 70) { toast(`Estás en tu parada: ${fin.nombre}`); this.parar(); }
    }, () => null, { enableHighAccuracy: true, maximumAge: 5000 });
  },
  /* Elegir dónde te bajas, desde un autobús de la parada (línea y hacia dónde va) */
  elegir(codigo, linea, destinoTxt = '') {
    const num = lineaFor(linea)?.numero || String(linea);
    const { porParada, seqs } = indiceRecorridos();
    const nombre = (c) => cache.paradaByCode.get(c)?.nombre || (window.BUSSEV_DATA?.paradas || []).find((x) => x.codigo === c)?.nombre || `Parada ${c}`;
    let grupos = (porParada.get(String(codigo)) || []).filter(([l]) => l === num).map(([l, sen, o]) => {
      const seq = seqs.get(`${l}|${sen}`) || [];
      return { k: `${l}|${sen}`, fin: nombre(seq[seq.length - 1]), resto: seq.slice(o + 1) };
    }).filter((g) => g.resto.length);
    if (!grupos.length) { toast('No tengo el recorrido de esta línea.'); return; }
    // El sentido que coincide con el destino del autobús va primero (y si coincide claro, solo ese)
    const nd = norm(destinoTxt);
    const coincide = (g) => nd && (norm(g.fin).includes(nd) || nd.includes(norm(g.fin)) || norm(g.fin).split(/\s+/).some((w) => w.length > 4 && nd.includes(w)));
    if (grupos.some(coincide)) grupos = grupos.filter(coincide);
    openModal(`<h2>¿Dónde te bajas?</h2>
      <p class="help">Línea ${esc(etiquetaLinea(num))}. Te aviso con vibración al pasar por la parada anterior, aunque tengas el móvil en el bolsillo.</p>
      ${grupos.map((g) => `${grupos.length > 1 ? `<h3 class="bj-tit">Hacia ${esc(g.fin)}</h3>` : ''}<div class="bj-lista">${g.resto.map((c, n) => `<button type="button" class="row-flat bj-op" data-k="${esc(g.k)}" data-c="${esc(c)}"><span class="stop-num">${esc(c)}</span><span class="bj-nom"><b>${esc(nombre(c))}</b><small>${n + 1} parada${n ? 's' : ''}</small></span></button>`).join('')}</div>`).join('')}
      <div class="actions"><button class="btn ghost" type="button" id="bj-x">Cancelar</button></div>`, (m, close) => {
      $('#bj-x', m).onclick = close;
      m.querySelectorAll('.bj-op').forEach((b) => { b.onclick = async () => { close(); await this.empezar({ k: b.dataset.k, desde: codigo, hasta: b.dataset.c }); }; });
    });
  },
};
window.bajada = bajada;
/* Aviso activo en Favoritas: a dónde vas y botón para parar */
function bajadaHTML() {
  const b = bajada.actual();
  if (!b) return '';
  return `<div class="dia-aviso bj-activo">🔔 <span>Te aviso al llegar a <b>${esc(b.destino)}</b> (${esc(nombreLinea(b.linea))}).</span>${b.paradas ? '<a class="btn ghost" href="#viaje">Ver viaje</a>' : ''}<button class="btn ghost" type="button" data-bj-parar>Parar</button></div>`;
}
window.bajadaHTML = bajadaHTML;

/* ---------- Pantalla «Viaje en curso»: las paradas que quedan se van marcando solas ---------- */
/* Minutos aproximados entre dos posiciones del recorrido (horario oficial; si no, 1,6 min por parada) */
function minutosEntre(k, i, j) {
  const e = horarioDe(k)?.e;
  if (e?.m && e.m[i] != null && e.m[j] != null) return Math.max(0, e.m[j] - e.m[i]);
  return Math.max(0, j - i) * 1.6;
}
/* ¿Por qué parada va? La más cercana de las que quedan (nunca hacia atrás), si está a menos de 150 m */
function avanceViaje(b, pos) {
  let mejor = b.actual || 0, dm = Infinity;
  for (let i = b.actual || 0; i < b.paradas.length; i++) {
    const d = haversine(pos, [b.paradas[i].lat, b.paradas[i].lon]);
    if (d < dm) { dm = d; mejor = i; }
  }
  return dm < 150 ? Math.max(b.actual || 0, mejor) : (b.actual || 0);
}
function textoCompartir(b) {
  const quedan = b.paradas.length - 1 - (b.actual || 0);
  const llega = new Date(Date.now() + minutosEntre(b.k, (b.actual || 0) + (b.inicioIdx || 0), b.paradas.length - 1 + (b.inicioIdx || 0)) * 60000);
  const h = llega.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  return quedan <= 0 ? `Ya he llegado a ${b.destino} 🚌` : `Voy en el autobús ${etiquetaLinea(b.linea)}. Me bajo en ${b.destino} sobre las ${h} (quedan ${quedan} parada${quedan > 1 ? 's' : ''}). — BusSev`;
}
async function compartirViaje(b) {
  const text = textoCompartir(b);
  try {
    if (plugin('Share')) { await native('Share', 'share', { text, dialogTitle: 'Compartir mi viaje' }); return; }
    if (navigator.share) { await navigator.share({ text }); return; }
  } catch { return; }   // cancelado
  openWeb(`https://wa.me/?text=${encodeURIComponent(text)}`);
}
views.viaje = (el) => {
  let watch = null, dead = false, tick = 0;
  const pintar = () => {
    const b = bajada.actual();
    if (!b?.paradas?.length) {
      el.innerHTML = backHead('<div class="grow"><h2>Viaje en curso</h2></div>') + emptyHTML(ICON.route, 'No vas en ningún autobús', 'Toca un autobús en una parada y elige «Me subo a este: avísame al bajar».');
      $('.back-btn', el).onclick = goBack;
      return;
    }
    const l = lineaFor(b.linea), act = b.actual || 0, ult = b.paradas.length - 1, quedan = ult - act;
    // Posición de la parada de subida en el recorrido completo (para el horario)
    if (b.inicioIdx == null && b.k) {
      const seq = indiceRecorridos().seqs.get(b.k) || [];
      b.inicioIdx = Math.max(0, seq.indexOf(b.paradas[0].codigo));
    }
    const min = Math.round(minutosEntre(b.k, act + (b.inicioIdx || 0), ult + (b.inicioIdx || 0)));
    const hora = new Date(Date.now() + min * 60000).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    setHTML(el, `<div class="stack">${backHead(`<div class="grow"><h2>Viaje en curso</h2><p>Te aviso con vibración al acercarte, aunque bloquees el móvil.</p></div>`)}
      <section class="card vj-top">
        <div class="row-flat">${badge(etiquetaLinea(l?.numero || b.linea), l?.color)}<div><b>Te bajas en ${esc(b.destino)}</b><p class="help">${quedan <= 0 ? 'Has llegado' : quedan === 1 ? '<b class="vj-ya">Bájate en la próxima</b>' : `Quedan <b>${quedan}</b> paradas`}${quedan > 0 ? ` · llegas sobre las <b>${hora}</b>` : ''}</p></div></div>
        <div class="btn-row"><button class="btn" type="button" id="vj-comp">📤 Compartir mi viaje</button><button class="btn ghost" type="button" data-bj-parar>Parar aviso</button></div>
      </section>
      <ol class="vj-lista">${b.paradas.map((p, i) => `<li class="${i < act ? 'pasada' : i === act ? 'aqui' : ''}${i === ult ? ' fin' : ''}"><i aria-hidden="true"></i><span><b>${esc(p.nombre)}</b><small>${esc(p.codigo)}${i === act && i < ult ? ' · estás aquí' : ''}${i === ult ? ' · te bajas aquí' : ''}</small></span></li>`).join('')}</ol>
      <p class="small muted">La hora es aproximada (horario oficial). Las paradas se marcan con tu ubicación.</p></div>`);
    $('.back-btn', el).onclick = goBack;
    $('#vj-comp', el).onclick = () => compartirViaje(b);
    store.set('bajada', b);
  };
  pintar();
  cargarHorarios().then(() => { if (!dead) pintar(); });
  if (navigator.geolocation) {
    watch = navigator.geolocation.watchPosition((p) => {
      const b = bajada.actual();
      if (!b?.paradas?.length || dead) return;
      const nuevo = avanceViaje(b, [p.coords.latitude, p.coords.longitude]);
      if (nuevo !== (b.actual || 0)) { b.actual = nuevo; store.set('bajada', b); pintar(); }
    }, () => null, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
  }
  tick = setInterval(pintar, 30000);   // la hora de llegada se va ajustando
  active.rerender = pintar;
  return { cleanup: () => { dead = true; clearInterval(tick); if (watch != null) navigator.geolocation?.clearWatch?.(watch); } };
};
document.addEventListener('click', (e) => {
  if (!e.target.closest('[data-bj-parar]')) return;
  e.preventDefault();
  bajada.parar().then(() => { toast('Aviso para bajarte quitado'); if (location.hash === '#viaje') goBack(); });
});

/* ================================================================== */
/* Leer en voz alta                                                    */
/* ================================================================== */
function textoParaVoz(nombre, tiempos) {
  const g = groupArrivals(tiempos);
  if (!g.length) return `${nombre}. Ahora mismo no hay autobuses previstos.`;
  return `${nombre}. ` + g.slice(0, 6).map((x) => {
    const m = x.buses[0].tiempo_minutos;
    const n = x.buses[1]?.tiempo_minutos;
    return `Línea ${String(x.linea).replace(/^0/, '')}, hacia ${x.destino}: ${m <= 0 ? 'llegando' : m === 1 ? 'un minuto' : m + ' minutos'}${n != null ? `; el siguiente, en ${n} minutos` : ''}.`;
  }).join(' ');
}
async function hablar(texto) {
  // 1) Plugin nativo (lo mejor en Android). Si falla —p. ej. el móvil no tiene instalada la voz
  //    en español—, no damos error: probamos con la voz del navegador.
  if (plugin('TextToSpeech')) {
    try {
      await native('TextToSpeech', 'stop').catch(() => null);
      await native('TextToSpeech', 'speak', { text: texto, lang: 'es-ES', rate: 1.0, pitch: 1.0, volume: 1.0, category: 'ambient' });
      return;
    } catch { /* seguimos con el navegador */ }
  }
  // 2) Voz del WebView. Elegimos una voz en español si la hay; si no, se usa la que haya.
  if (window.speechSynthesis) {
    try {
      speechSynthesis.cancel();
      let dicho = false;
      const decir = () => {
        if (dicho) return; dicho = true;
        const voz = (speechSynthesis.getVoices() || []).find((v) => /^es/i.test(v.lang || '')) || null;
        const u = new SpeechSynthesisUtterance(texto);
        u.lang = voz?.lang || 'es-ES';
        if (voz) u.voice = voz;
        u.onerror = (ev) => { if (ev.error && ev.error !== 'canceled' && ev.error !== 'interrupted') toast('No se ha podido leer en voz alta. Instala una voz en español en los ajustes del móvil (Accesibilidad → Texto a voz).'); };
        speechSynthesis.speak(u);
      };
      // getVoices() puede venir vacío la primera vez hasta que el motor carga las voces
      if ((speechSynthesis.getVoices() || []).length) decir();
      else { speechSynthesis.addEventListener('voiceschanged', decir, { once: true }); setTimeout(decir, 300); }
      return;
    } catch { /* cae al aviso final */ }
  }
  toast('Este móvil no permite leer en voz alta.');
}

/* ================================================================== */
/* Cómo llegar: autobús directo o con un transbordo                    */
/* ================================================================== */
const planner = (() => {
  let idx = null;
  function build() {
    const D = window.BUSSEV_DATA;
    // El metro y Cercanías entran como líneas más (M1, RC1…), con sus estaciones como paradas. Solo si los quieres usar.
    const M = settings.rutaMetro === true ? window.BUSSEV_METRO : null, C = settings.rutaRenfe === true ? window.BUSSEV_CERCANIAS : null;
    const todas = [...D.paradas, ...(M?.estaciones || []), ...(C?.estaciones || [])];
    const pos = new Map(todas.map((p) => [p.codigo, [p.latitud, p.longitud]]));
    const seqs = new Map();       // "linea|sentido" -> [codigos]
    for (const [cod, lin, s, orden] of [...D.recorridos, ...(M?.recorridos || []), ...(C?.recorridos || [])]) {
      const k = `${lin}|${s}`;
      if (!seqs.has(k)) seqs.set(k, []);
      seqs.get(k).push([orden, cod]);
    }
    const porParada = new Map();  // codigo -> [{k, i}]
    for (const [k, l] of seqs) {
      l.sort((a, b) => a[0] - b[0]);
      const cods = l.map((x) => x[1]);
      seqs.set(k, cods);
      cods.forEach((c, i) => { if (!porParada.has(c)) porParada.set(c, []); porParada.get(c).push({ k, i }); });
    }
    // paradas cercanas entre sí (para cambiar de autobús andando un poco)
    const cerca = new Map();
    const arr = todas;
    for (let a = 0; a < arr.length; a++) {
      const pa = [arr[a].latitud, arr[a].longitud];
      for (let b = a; b < arr.length; b++) {
        if (Math.abs(arr[b].latitud - pa[0]) > 0.003) continue;
        const d = haversine(pa, [arr[b].latitud, arr[b].longitud]);
        if (d <= 220) {
          (cerca.get(arr[a].codigo) || cerca.set(arr[a].codigo, []).get(arr[a].codigo)).push([arr[b].codigo, d]);
          if (a !== b) (cerca.get(arr[b].codigo) || cerca.set(arr[b].codigo, []).get(arr[b].codigo)).push([arr[a].codigo, d]);
        }
      }
    }
    idx = { pos, seqs, porParada, cerca, clave: claveIdx() };
    return idx;
  }
  const claveIdx = () => `${settings.rutaMetro === true && !!window.BUSSEV_METRO}|${settings.rutaRenfe === true && !!window.BUSSEV_CERCANIAS}`;
  const indice = () => (idx && idx.clave === claveIdx() ? idx : build());
  const ANDAR = 75;      // metros por minuto
  const PARADA = 1.6;    // minutos por parada, aproximado
  const CAMBIO = 6;      // penalización por transbordo (esperar al otro autobús)
  function paradasCerca(pt, radio = 450, max = 8) {
    const { pos } = indice();
    const todas = [...pos].map(([c, p]) => [c, haversine(pt, p)]).filter(([, d]) => d <= radio).sort((a, b) => a[1] - b[1]);
    // Las estaciones de metro cercanas siempre cuentan (si no, las muchas paradas de bus de alrededor las tapaban)
    const bus = todas.filter(([c]) => !estacionMetro(c)).slice(0, max), metro = todas.filter(([c]) => estacionMetro(c)).slice(0, 2);
    return [...bus, ...metro];
  }
  /* Primer viaje de una línea que pasa por la posición i a partir del minuto «desde» y llega a la j.
     undefined = esa línea no tiene horario (se calcula como antes); null = hoy ya no pasa ninguno. */
  const viajesCache = new Map();
  function pasoTras(H, g, k, i, j, desde, cuando) {
    const hd = horarioDe(k, cuando);
    const e = hd?.e;
    g = hd?.g;
    if (!e || g == null || e.m?.[i] == null || e.m?.[j] == null) return undefined;
    const ck = `${k}#${g}`;
    if (!viajesCache.has(ck)) {
      let s0 = 0; const ult = e.m.length - 1;
      viajesCache.set(ck, (e.v?.[g] || []).map((x) => { const [d, a, b] = Array.isArray(x) ? x : [x, 0, ult]; s0 += d; return [s0, a, b]; }));
    }
    for (const [s0, a, b] of viajesCache.get(ck)) {
      if (a <= i && b >= j && s0 + e.m[i] >= desde) return { sube: s0 + e.m[i], baja: s0 + e.m[j] };
    }
    return null;
  }
  function buscar(origen, destino, cuando = new Date()) {
    const I = indice();
    // Si no hay paradas a menos de 450 m (sitios apartados), se mira hasta 900 m
    const cerca2 = (pt) => { const l = paradasCerca(pt); return l.length ? l : paradasCerca(pt, 900, 8); };
    const O = cerca2(origen), Dd = new Map(cerca2(destino));
    const res = [];
    for (const [o, wo] of O) {
      for (const { k, i } of I.porParada.get(o) || []) {
        const seq = I.seqs.get(k);
        for (let j = i + 1; j < seq.length; j++) {
          if (Dd.has(seq[j])) res.push({ tramos: [{ k, desde: o, hasta: seq[j], n: j - i, i, j }], min: wo / ANDAR + (j - i) * PARADA + Dd.get(seq[j]) / ANDAR, andar: [wo, Dd.get(seq[j])] });
        }
        // con un transbordo
        for (let j = i + 1; j < seq.length; j++) {
          for (const [t, wt] of I.cerca.get(seq[j]) || []) {
            for (const { k: k2, i: i2 } of I.porParada.get(t) || []) {
              if (k2.split('|')[0] === k.split('|')[0]) continue;
              const s2 = I.seqs.get(k2);
              for (let j2 = i2 + 1; j2 < s2.length; j2++) {
                if (!Dd.has(s2[j2])) continue;
                const min = wo / ANDAR + (j - i) * PARADA + wt / ANDAR + CAMBIO + (j2 - i2) * PARADA + Dd.get(s2[j2]) / ANDAR;
                res.push({ tramos: [{ k, desde: o, hasta: seq[j], n: j - i, i, j }, { k: k2, desde: t, hasta: s2[j2], n: j2 - i2, i: i2, j: j2 }], min, andar: [wo, Dd.get(s2[j2])], cambio: wt });
                break;
              }
            }
          }
        }
      }
    }
    // Con el horario oficial: se cuenta la espera y se descartan las líneas que a esa hora no circulan
    const H = window.BUSSEV_HORARIOS;
    let sinServicio = 0;
    if (H?.l || window.BUSSEV_METRO) {
      const ahora = minutoServicio(cuando);
      const g = H?.dias?.[tipoHorarioHoy(cuando)];
      const conHora = [];
      for (const r of res) {
        let t = ahora + r.andar[0] / ANDAR, ok = true, sale = null;
        for (const [n, tr] of r.tramos.entries()) {
          if (n === 1) t += (r.cambio || 0) / ANDAR + 1;
          const p = pasoTras(H, g, tr.k, tr.i, tr.j, t, cuando);
          if (p === null) { ok = false; break; }
          if (p === undefined) { t += (n ? CAMBIO : 0) + tr.n * PARADA; continue; }   // línea sin horario: lo de antes
          if (n === 0) sale = p.sube;
          tr.sube = p.sube; tr.baja = p.baja; t = p.baja;
        }
        if (!ok) { sinServicio++; continue; }
        t += r.andar[1] / ANDAR;
        conHora.push({ ...r, min: t - ahora, sale, llega: t });
      }
      res.length = 0; res.push(...conHora);
    }
    // la mejor opción de cada combinación de líneas
    const best = new Map();
    for (const r of res) {
      const key = r.tramos.map((t) => t.k.split('|')[0]).join('>');
      if (!best.has(key) || best.get(key).min > r.min) best.set(key, r);
    }
    const out = [...best.values()].sort((a, b) => a.min - b.min);
    const directos = out.filter((r) => r.tramos.length === 1);
    const mejorDirecto = directos[0]?.min ?? Infinity;
    // los transbordos solo si ahorran tiempo de verdad o no hay directo
    const lista = [...directos.slice(0, 4), ...out.filter((r) => r.tramos.length === 2 && r.min < mejorDirecto - 5).slice(0, directos.length ? 2 : 5)].sort((a, b) => a.min - b.min);
    lista.sinServicio = sinServicio;
    return lista;
  }
  /* «Llegar antes de»: se prueba a salir cada vez antes y se queda, de cada combinación de líneas, la que más tarde
     sale y llega a tiempo (la primera, la que más tarde te deja salir de casa) */
  function llegarAntes(o, d, limite) {
    const tope = minutoServicio(limite), mejor = new Map();
    let sinServicio = 0;
    for (let atras = 15; atras <= 150; atras += 10) {
      const r = buscar(o, d, new Date(limite.getTime() - atras * 60000));
      sinServicio += r.sinServicio || 0;
      for (const op of r) {
        if (op.llega == null || op.llega > tope) continue;
        const k = op.tramos.map((t) => t.k.split('|')[0]).join('>');
        if (!mejor.has(k) || mejor.get(k).llega - mejor.get(k).min < op.llega - op.min) mejor.set(k, op);
      }
    }
    const lista = [...mejor.values()].sort((x, y) => (y.llega - y.min) - (x.llega - x.min)).slice(0, 6);
    lista.sinServicio = sinServicio;
    return lista;
  }
  return { buscar, paradasCerca, llegarAntes };
})();

/* Buscar calles, portales y sitios de Sevilla.
   - Direcciones con número («Avenida de las Ciencias 6»): CartoCiudad, el callejero oficial de España (IGN),
     que tiene TODOS los portales. OpenStreetMap muchas veces no tiene el número y te dejaba en mitad de la avenida.
   - Sitios (hospitales, estaciones, centros comerciales…): Photon (OpenStreetMap). Los dos gratis y sin clave. */
const LUGARES_BBOX = [-6.15, 37.28, -5.80, 37.50];   // Sevilla y alrededores
const dentroSevilla = ([lat, lon]) => lon >= LUGARES_BBOX[0] && lon <= LUGARES_BBOX[2] && lat >= LUGARES_BBOX[1] && lat <= LUGARES_BBOX[3];
const lugaresCache = new Map();
async function pedirJSON(url, ms = 6000) {
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, { signal: ctl.signal, credentials: 'omit' }); if (!r.ok) throw new Error(String(r.status)); return await r.json(); } finally { clearTimeout(to); }
}
const CC = 'https://www.cartociudad.es/geocoder/api/geocoder';
const titulo1 = (s) => String(s || '').toLocaleLowerCase('es').replace(/(^|[\s(/-])(\p{L})/gu, (m, a, b) => a + b.toLocaleUpperCase('es'))
  .replace(/(?<=\s)(De|Del|La|Las|Los|El|Y)(?=\s)/g, (w) => w.toLowerCase());
async function buscarCartoCiudad(q) {
  const conSevilla = /sevilla|dos hermanas|mairena|camas|tomares|san juan|bormujos|gelves|alcal[aá]/i.test(q) ? q : `${q}, Sevilla`;
  const j = await pedirJSON(`${CC}/candidates?q=${encodeURIComponent(conSevilla)}&limit=8&provincia_filter=Sevilla&no_process=municipio,provincia,carretera,ngbe`);
  return (Array.isArray(j) ? j : []).map((x) => {
    const tipo = String(x.type || '');
    // «CIENCIAS (DE LAS)» → «de las Ciencias», como se dice
    const dir = String(x.address || '').replace(/^(.*?)\s*\(((?:DE |DEL |)(?:LA|LAS|LOS|EL)?|DE|DEL)\)\s*$/i, (m, nom, art) => `${art.trim().toLowerCase()} ${titulo1(nom)}`.trim());
    const calle = `${x.tip_via ? titulo1(x.tip_via) + ' ' : ''}${dir === x.address ? titulo1(dir) : dir}`.trim();
    const portal = x.portalNumber ? ` ${x.portalNumber}${x.extension || ''}` : '';
    const pos = Number.isFinite(+x.lat) && Number.isFinite(+x.lng) && +x.lat ? [+x.lat, +x.lng] : null;
    return { nombre: `${calle}${portal}`, detalle: [x.postalCode, titulo1(x.muni)].filter(Boolean).join(' '), pos, cc: pos ? null : { id: x.id, type: tipo }, portal: tipo === 'portal', fuente: 'cc' };
  }).filter((x) => x.nombre && (!x.pos || dentroSevilla(x.pos)));
}
/* Calles sin coordenadas en la lista (CartoCiudad solo las da al elegirlas) */
async function posDeCartoCiudad(l) {
  if (l.pos || !l.cc) return l.pos;
  const j = await pedirJSON(`${CC}/find?id=${encodeURIComponent(l.cc.id)}&type=${encodeURIComponent(l.cc.type)}`);
  const pos = Number.isFinite(+j?.lat) && Number.isFinite(+j?.lng) ? [+j.lat, +j.lng] : null;
  return pos && dentroSevilla(pos) ? pos : null;
}
async function buscarPhoton(q) {
  const j = await pedirJSON(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=8&lat=37.389&lon=-5.984&bbox=${LUGARES_BBOX.join(',')}`);
  const out = [];
  for (const f of j?.features || []) {
    const pr = f.properties || {}, c = f.geometry?.coordinates;
    if (!Array.isArray(c) || c.length < 2) continue;
    const pos = [c[1], c[0]];
    if (!dentroSevilla(pos)) continue;
    const calle = [pr.street, pr.housenumber].filter(Boolean).join(' ');
    const nombre = pr.name || calle;
    if (!nombre) continue;
    const detalle = [pr.name && calle !== pr.name ? calle : '', pr.district || pr.locality || '', pr.city && pr.city !== 'Sevilla' ? pr.city : (pr.district || pr.locality ? '' : 'Sevilla')].filter(Boolean).join(', ');
    out.push({ nombre, detalle, pos, sitio: !!pr.name && !pr.housenumber, fuente: 'osm' });
  }
  return out;
}
async function buscarLugares(texto) {
  const q = String(texto || '').trim();
  if (q.length < 3) return [];
  const k = q.toLowerCase();
  if (lugaresCache.has(k)) return lugaresCache.get(k);
  const conNumero = /\d/.test(q.replace(/^\s*\d+\s*$/, ''));
  const [cc, osm] = await Promise.all([buscarCartoCiudad(q).catch(() => []), buscarPhoton(q).catch(() => [])]);
  // Con número de portal: primero los portales exactos. Sin número: primero los sitios con nombre (Santa Justa…)
  const lista = conNumero
    ? [...cc.filter((x) => x.portal), ...osm.filter((x) => x.sitio), ...cc.filter((x) => !x.portal), ...osm.filter((x) => !x.sitio)]
    : [...osm.filter((x) => x.sitio), ...cc, ...osm.filter((x) => !x.sitio)];
  const vistos = new Set(), out = [];
  for (const l of lista) {
    const clave = norm(l.nombre).replace(/\b(calle|avenida|avda|av|plaza|pza)\b\.?/g, '').replace(/\s+/g, ' ').trim();
    // Repetidos (el mismo sitio en las dos fuentes, o la misma calle) solo una vez
    if (vistos.has(clave) || out.some((o) => o.pos && l.pos && haversine(o.pos, l.pos) < 60)) continue;
    vistos.add(clave);
    out.push(l);
    if (out.length >= 5) break;
  }
  if (!cc.length && !osm.length) throw new Error('sin respuesta');
  lugaresCache.set(k, out);
  if (lugaresCache.size > 60) lugaresCache.delete(lugaresCache.keys().next().value);
  return out;
}
window.buscarLugares = buscarLugares;
/* Paradas con el mismo nombre (las de un lado y otro de la calle, o las 5 de Santa Justa) van juntas en UNA
   sugerencia: «Cómo llegar» ya mira todas las paradas de alrededor, así que da igual cuál se elija. */
function paradasAgrupadas(q, max) {
  const words = q.split(/\s+/);
  const encontradas = (window.BUSSEV_DATA.paradas).filter((p) => (/^\d+$/.test(q) ? p.codigo.startsWith(q) : words.every((w) => norm(`${p.nombre} ${p.direccion_completa || ''} ${favs.get(p.codigo)?.alias || ''}`).includes(w))));
  if (/^\d+$/.test(q)) return encontradas.slice(0, max).map((p) => ({ paradas: [p] }));
  const grupos = new Map();
  for (const p of encontradas) {
    const k = norm(p.nombre.replace(/\s*\(.*\)\s*$/, ''));
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(p);
  }
  return [...grupos.values()].slice(0, max).map((ps) => ({ paradas: ps }));
}
/* Sitios usados hace poco (salen al tocar el campo vacío): tu casa, el trabajo… sin volver a escribirlos */
const recientes = {
  list() { return store.get('rutaRecientes', []); },
  add(l) {
    if (!l || l.tipo === 'yo' || !l.pos) return;
    const x = { tipo: l.tipo, nombre: l.nombre, pos: l.pos, codigo: l.codigo || null };
    store.set('rutaRecientes', [x, ...this.list().filter((r) => r.nombre !== x.nombre)].slice(0, 6));
  },
};

views.ruta = (el) => {
  const st = { origen: null, destino: null, modo: 'ahora', hora: '' };   // origen/destino: { tipo:'yo'|'parada'|'lugar', nombre, pos, codigo }
  // «Cómo llegar aquí» desde el mapa o una parada: llega el destino ya puesto y se busca solo
  const pre = window.rutaPendiente; window.rutaPendiente = null;
  if (pre?.destino) st.destino = pre.destino;
  let fotonT = 0, fotonN = 0;
  const nombreParada = (p) => favs.get(p.codigo)?.alias ? `${favs.get(p.codigo).alias} (${p.nombre})` : p.nombre;
  const SV = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const MEDIOS = [
    ['bus', 'Bus', 'Siempre', SV('<path d="M6.5 3h11A2.5 2.5 0 0 1 20 5.5V17H4V5.5A2.5 2.5 0 0 1 6.5 3z"/><path d="M4 11h16M7.5 21v-4M16.5 21v-4"/>')],
    ['rutaMetro', 'Metro', 'Línea 1', SV('<path d="M5 19V6l7 8 7-8v13"/>')],
    ['rutaRenfe', 'Cercanías', 'C1 a C5', SV('<rect x="5" y="3" width="14" height="14" rx="3.5"/><path d="M5 10.5h14M9 21l2-4M15 21l-2-4"/>')],
    ['rutaBici', 'Sevici', 'Bici', SV('<circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16l3.5-7h6L18 16M9.5 9L12 16h-6M14 6h2.5"/>')],
  ];
  /* Hora por defecto: dentro de media hora, redondeada a 5 min */
  function horaPorDefecto() { const d = new Date(Date.now() + 30 * 60000); d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }
  /* La hora elegida como fecha: hoy, o mañana si ya ha pasado */
  function fechaElegida() {
    const [h, mi] = String(st.hora || $('#pl-hora', el)?.value || horaPorDefecto()).split(':').map(Number);
    const d = new Date(); d.setHours(h, mi, 0, 0);
    if (d.getTime() < Date.now() - 5 * 60000) d.setDate(d.getDate() + 1);
    return d;
  }
  /* Un «minuto de servicio» (el día empieza a las 4:00) a fecha de verdad */
  function fechaDeMinuto(ref, m) { const b = new Date(ref.getTime() - 4 * 3600000); b.setHours(0, 0, 0, 0); return new Date(b.getTime() + m * 60000); }
  function campo(id, label, val, ph) {
    return `<div class="field plan-field"><label for="${id}">${label}</label>
      <div class="plan-input"><input id="${id}" autocomplete="off" placeholder="${ph}" value="${esc(val?.nombre || '')}">${id === 'pl-o' ? `<button class="btn ghost" type="button" id="pl-yo" title="Usar mi ubicación">${ICON.pin}</button>` : ''}</div>
      <div class="sugs" id="${id}-s" hidden></div></div>`;
  }
  function render() {
    el.innerHTML = `<div class="stack">
      ${backHead('<div class="grow"><h2>Cómo llegar</h2><p>En autobús, metro, Cercanías o Sevici.</p></div>')}
      <div class="set-group">${campo('pl-o', 'Desde', st.origen, 'Mi ubicación, parada o calle')}
        <button class="swap" type="button" id="pl-swap" aria-label="Intercambiar origen y destino">⇅</button>
        ${campo('pl-d', 'Hasta', st.destino, 'Parada, calle, sitio o número de parada')}
        <div class="medios" role="group" aria-label="Qué quieres usar">
          <div class="medios-t">Combinar con</div>
          <div class="medios-g">${MEDIOS.map(([k, nom, sub, svg]) => `<button type="button" class="medio m-${k}" ${k === 'bus' ? 'disabled aria-pressed="true"' : `data-medio="${k}" aria-pressed="${settings[k] === true}"`}>
            <span class="medio-ic">${svg}</span><span class="medio-n">${nom}</span><span class="medio-s">${sub}</span><span class="medio-ok" aria-hidden="true"></span></button>`).join('')}</div></div>
        <div class="plan-cuando">
          <div class="seg" role="group" aria-label="Cuándo">${[['ahora', 'Salir ahora'], ['salir', 'Salir a las'], ['llegar', 'Llegar antes de']].map(([k, n]) => `<button type="button" data-modo="${k}" aria-pressed="${st.modo === k}">${n}</button>`).join('')}</div>
          <div id="pl-hora-box" ${st.modo === 'ahora' ? 'hidden' : ''}>${horaPickerHTML('pl-hora', st.hora || horaPorDefecto(), { dia: true })}</div></div>
        <button class="btn" type="button" id="pl-go">Buscar cómo ir</button></div>
      <div id="pl-res"></div></div>`;
    $('.back-btn', el).onclick = goBack;
    $('#pl-go', el).onclick = buscar;
    el.querySelectorAll('[data-medio]').forEach((b) => { b.onclick = () => {
      const k = b.dataset.medio; settings[k] = settings[k] !== true; saveSettings(); vibrar(10);
      b.setAttribute('aria-pressed', settings[k] === true);
      if ($('#pl-res', el)?.children.length) buscar();   // si ya había resultados, se recalculan
    }; });
    $('#pl-swap', el).onclick = () => { [st.origen, st.destino] = [st.destino, st.origen]; render(); };
    el.querySelectorAll('[data-modo]').forEach((b) => { b.onclick = () => {
      st.modo = b.dataset.modo; vibrar(10);
      el.querySelectorAll('[data-modo]').forEach((x) => x.setAttribute('aria-pressed', x === b));
      $('#pl-hora-box', el).hidden = st.modo === 'ahora';
    }; });
    horaPicker(el, 'pl-hora', (v) => { st.hora = v; });
    $('#pl-yo', el).onclick = async () => {
      try { const pos = await getPosition(); st.origen = { tipo: 'yo', nombre: 'Mi ubicación', pos }; $('#pl-o', el).value = 'Mi ubicación'; } catch (e) { toast(geoErrorText(e)); }
    };
    for (const [id, key] of [['pl-o', 'origen'], ['pl-d', 'destino']]) {
      const inp = $('#' + id, el), box = $(`#${id}-s`, el);
      const elegir = (v) => { st[key] = v; inp.value = v.nombre; box.hidden = true; };
      const pintarSugs = (q, lugares) => {
        const grupos = paradasAgrupadas(q, lugares?.length ? 3 : 6);
        const paradasHTML = grupos.map((g, n) => {
          const p = g.paradas[0];
          return g.paradas.length > 1
            ? `<button type="button" data-g="${n}"><span class="stop-num lugar-ico" aria-hidden="true">🚏</span><span><b>${esc(p.nombre.replace(/\s*\(.*\)\s*$/, ''))}</b><small>${g.paradas.length} paradas de autobús</small></span></button>`
            : `<button type="button" data-g="${n}"><span class="stop-num">${esc(p.codigo)}</span><span><b>${esc(nombreParada(p))}</b><small>${esc(p.direccion_completa || '')}</small></span></button>`;
        }).join('');
        const lug = (lugares || []).map((l, n) => `<button type="button" data-lg="${n}"><span class="stop-num lugar-ico" aria-hidden="true">${l.portal ? '🏠' : '📍'}</span><span><b>${esc(l.nombre)}</b><small>${esc(l.detalle)}</small></span></button>`).join('');
        // Los sitios y portales (lo que la gente suele buscar) van primero; las paradas después
        box.innerHTML = (lug + paradasHTML) || (lugares ? '<p class="help" style="padding:8px">No encuentro ese sitio. Prueba con el nombre de la calle y el número, o con el de una parada.</p>' : '<p class="help" style="padding:8px">Buscando…</p>');
        box.hidden = false;
        box.querySelectorAll('[data-g]').forEach((b) => { b.onclick = () => {
          const ps = grupos[Number(b.dataset.g)].paradas;
          if (ps.length === 1) { const p = ps[0]; elegir({ tipo: 'parada', nombre: nombreParada(p), pos: [p.latitud, p.longitud], codigo: p.codigo }); return; }
          const pos = [ps.reduce((a, p) => a + p.latitud, 0) / ps.length, ps.reduce((a, p) => a + p.longitud, 0) / ps.length];
          elegir({ tipo: 'lugar', nombre: ps[0].nombre.replace(/\s*\(.*\)\s*$/, ''), pos });
        }; });
        box.querySelectorAll('[data-lg]').forEach((b) => { b.onclick = async () => {
          const l = lugares[Number(b.dataset.lg)];
          let pos = l.pos;
          if (!pos) { b.querySelector('small').textContent = 'Buscando en el callejero…'; pos = await posDeCartoCiudad(l).catch(() => null); }
          if (!pos) { toast('No encuentro dónde está esa calle. Prueba con el número del portal.'); return; }
          elegir({ tipo: 'lugar', nombre: l.nombre, pos });
        }; });
      };
      const pintarRecientes = () => {
        const rs = recientes.list();
        if (inp.value.trim() || !rs.length) return;
        box.innerHTML = `<p class="help" style="padding:6px 8px 2px">Usados hace poco</p>${rs.map((r, n) => `<button type="button" data-rc="${n}"><span class="stop-num lugar-ico" aria-hidden="true">🕘</span><span><b>${esc(r.nombre)}</b></span></button>`).join('')}`;
        box.hidden = false;
        box.querySelectorAll('[data-rc]').forEach((b) => { b.onclick = () => elegir(rs[Number(b.dataset.rc)]); });
      };
      inp.onfocus = pintarRecientes;
      // Al salir del campo se cierra la lista (si no, tapaba el botón «Buscar autobuses»)
      inp.onblur = () => setTimeout(() => { if (document.activeElement !== inp && !box.contains(document.activeElement)) box.hidden = true; }, 250);
      inp.oninput = () => {
        const q = norm(inp.value); st[key] = null;
        if (!q) { pintarRecientes(); return; }
        if (q.length < 2) { box.hidden = true; return; }
        pintarSugs(q, /^\d+$/.test(q) ? [] : null);
        clearTimeout(fotonT);
        if (/^\d+$/.test(q) || q.length < 3) return;
        const n = ++fotonN;
        fotonT = setTimeout(() => buscarLugares(inp.value).then((l) => { if (n === fotonN && !box.hidden) pintarSugs(q, l); }).catch(() => { if (n === fotonN) pintarSugs(q, []); }), 350);
      };
    }
  }
  async function buscar() {
    const res = $('#pl-res', el);
    // Si has escrito algo pero no has tocado ninguna sugerencia, se coge la primera (la que mejor encaja)
    const primera = async (id) => {
      const txt = ($('#' + id, el)?.value || '').trim();
      if (txt.length < 3 || txt === 'Mi ubicación') return null;
      const lug = await buscarLugares(txt).catch(() => []);
      for (const l of lug) { const pos = l.pos || await posDeCartoCiudad(l).catch(() => null); if (pos) return { tipo: 'lugar', nombre: l.nombre, pos }; }
      const g = paradasAgrupadas(norm(txt), 1)[0];
      if (!g) return null;
      const ps = g.paradas;
      return { tipo: 'lugar', nombre: ps[0].nombre, pos: [ps.reduce((a, p) => a + p.latitud, 0) / ps.length, ps.reduce((a, p) => a + p.longitud, 0) / ps.length] };
    };
    for (const [id, key] of [['pl-o', 'origen'], ['pl-d', 'destino']]) {
      if (st[key]) continue;
      const v = await primera(id);
      if (v) { st[key] = v; $('#' + id, el).value = v.nombre; $(`#${id}-s`, el).hidden = true; }
    }
    if (!st.origen) { try { const pos = await getPosition(); st.origen = { tipo: 'yo', nombre: 'Mi ubicación', pos }; $('#pl-o', el).value = 'Mi ubicación'; } catch { toast('Elige desde dónde sales.'); return; } }
    if (!st.destino) { toast('No encuentro ese destino. Escribe el nombre de un sitio, una calle con número o una parada.'); return; }
    if (haversine(st.origen.pos, st.destino.pos) < 300) { res.innerHTML = '<div class="alert">Está muy cerca: mejor ir andando.</div>'; return; }
    recientes.add(st.origen); recientes.add(st.destino);
    res.innerHTML = '<div class="board-empty">Buscando…</div>';
    await Promise.all([getLineas().catch(() => null), cargarHorarios().catch(() => null),
      settings.rutaMetro === true ? cargarMetro().catch(() => null) : null, settings.rutaRenfe === true ? cargarCercanias().catch(() => null) : null,
      settings.rutaBici === true ? window.sevici?.cargar().catch(() => null) : null]);
    const conHorario = !!window.BUSSEV_HORARIOS;
    const cuando = st.modo === 'ahora' ? new Date() : fechaElegida();
    if (st.modo !== 'ahora' && !conHorario) { res.innerHTML = '<div class="alert warn">Para buscar a otra hora hace falta el horario oficial, y no se ha podido cargar. Prueba con «Salir ahora».</div>'; return; }
    const ops = st.modo === 'llegar' ? planner.llegarAntes(st.origen.pos, st.destino.pos, cuando) : planner.buscar(st.origen.pos, st.destino.pos, cuando);
    // En bici (Sevici): coges una bici cerca de donde sales y la dejas en una estación con hueco cerca del destino
    if (st.modo === 'ahora' && settings.rutaBici === true && window.sevici?.datos) {
      const a = window.sevici.cerca(st.origen.pos, { conBicis: true })[0], b = window.sevici.cerca(st.destino.pos, { conHuecos: true })[0];
      if (a && b && a.id !== b.id) {
        const pedalea = haversine([a.lat, a.lon], [b.lat, b.lon]) * 1.3;   // por calles, algo más que en línea recta
        const min = a.d / 75 + 1 + pedalea / 250 + b.d / 75;               // a pie 75 m/min; en bici unos 15 km/h
        const ahora = minutoServicio(new Date());
        const bici = { bici: true, a, b, pedalea, min, llega: ahora + min, andar: [a.d, b.d], tramos: [] };
        const i = ops.findIndex((o) => o.min > min);
        if (i < 0) ops.push(bici); else ops.splice(i, 0, bici);
      }
    }
    if (!ops.length) {
      res.innerHTML = st.modo === 'llegar'
        ? emptyHTML(ICON.route, 'No llegas a esa hora', 'No encuentro ningún autobús (ni metro) que te deje allí antes de esa hora saliendo en las 2 horas y media anteriores. Prueba con una hora más tarde.')
        : ops.sinServicio
        ? emptyHTML(ICON.route, 'A estas horas no hay autobús ni metro', 'Las líneas que te llevan ya no circulan hoy. De madrugada solo circulan los Búho (líneas A); prueba más tarde o desde otra parada.')
        : emptyHTML(ICON.route, 'No he encontrado autobuses', 'No hay una línea (de autobús o el metro) directa ni con un solo transbordo entre esos dos puntos. Prueba con una parada cercana.');
      return;
    }
    const pName = (c) => esc(cache.paradaByCode.get(c)?.nombre || (estacionMetro(c) ? `estación ${estacionMetro(c).nombre}` : `Parada ${c}`));
    const pCod = (c) => (estacionMetro(c) ? 'metro' : esc(c));
    const paradasTxt = (n, k) => (esTren(k) ? `${n} estacion${n > 1 ? 'es' : ''}` : `${n} parada${n > 1 ? 's' : ''}`);
    const hora = (m) => (m == null ? '' : hhmmDe(m));
    const proxTxt = (t) => (t.sube != null ? ` · según horario a las ${hora(t.sube)}` : '');
    const biciHTML = (o, n) => `<article class="card plan plan-bici${n >= 3 ? ' plan-extra' : ''}"${n >= 3 ? ' hidden' : ''}>
        ${n === 0 && ops.length > 1 ? '<span class="plan-mejor">⚡ La que antes te deja</span>' : ''}
        <div class="plan-top"><span class="badge" style="background:#d4001a;color:#fff">🚲 Sevici</span><span class="plan-min">${Math.round(o.min)} min</span></div>
        <p class="plan-horas">Si sales ahora, llegas sobre las <b>${hora(o.llega)}</b></p>
        <ol class="plan-steps">
          <li><span class="muted">Anda ${fmtDist(o.a.d)}</span> hasta la estación Sevici <b>${esc(o.a.nombre)}</b> · <span class="next">${o.a.bicis} bici${o.a.bicis > 1 ? 's' : ''} ahora</span></li>
          <li>Pedalea unos <b>${fmtDist(o.pedalea)}</b> (${Math.round(o.pedalea / 250)} min) hasta <b>${esc(o.b.nombre)}</b> · <span class="next">${o.b.huecos} hueco${o.b.huecos > 1 ? 's' : ''} libre${o.b.huecos > 1 ? 's' : ''}</span></li>
          <li><span class="muted">Anda ${fmtDist(o.b.d)}</span> hasta tu destino</li>
        </ol>
        <p class="small muted" style="margin:0;padding:0 14px 12px">Las bicis y los huecos cambian a cada momento: míralo justo antes de salir.</p></article>`;
    res.innerHTML = `<h2 class="section-title">Opciones</h2><div class="stack">${ops.map((o, n) => {
      if (o.bici) return biciHTML(o, n);
      const ls = o.tramos.map((t) => lineaInfo(t.k.split('|')[0]) || { numero: t.k.split('|')[0], color: '#555' });
      const avs = [...new Set(ls.map((l) => l.numero))].flatMap((num) => (window.avisosTussam?.avisosDeLinea?.(num) || []).map((a) => ({ ...a, num })));
      return `<article class="card plan${n >= 3 ? ' plan-extra' : ''}"${n >= 3 ? ' hidden' : ''}>
        ${n === 0 && ops.length > 1 ? `<span class="plan-mejor">${st.modo === 'llegar' ? '🕒 La que más tarde sale' : '⚡ La que antes te deja'}</span>` : ''}
        <div class="plan-top">${ls.map((l) => badge(l.metro ? 'Ⓜ L1' : l.tren ? `🚆 ${l.etiqueta}` : l.numero, l.color)).join('<span class="plan-arrow">›</span>')}<span class="plan-min">${Math.round(o.min)} min</span></div>
        ${o.llega != null ? `<p class="plan-horas">${o.sale != null ? `Sal sobre las <b>${hora(Math.max(o.llega - o.min, o.sale - Math.ceil(o.andar[0] / 75)))}</b> · ` : ''}llegas sobre las <b>${hora(o.llega)}</b></p>` : ''}
        ${avs.length ? `<div class="plan-aviso">${avs.slice(0, 2).map((a) => `<a href="#" data-aviso="${esc(a.id)}">⚠️ <span>${esc(window.avisosTussam?.titulo ? window.avisosTussam.titulo(a.titulo) : a.titulo)}</span></a>`).join('')}</div>` : ''}
        <ol class="plan-steps">
          <li><span class="muted">Anda ${fmtDist(o.andar[0])}</span> hasta <b>${pName(o.tramos[0].desde)}</b> <span class="muted">(${pCod(o.tramos[0].desde)})</span>${st.modo === 'ahora' ? ` · <span class="next" data-next="${n}-0">próximo…</span>` : ''}${proxTxt(o.tramos[0]) ? `<span class="muted" data-prog="${n}-0">${proxTxt(o.tramos[0])}</span>` : ''}</li>
          <li>${ls[0].metro ? 'Coge el <b>metro</b>' : ls[0].tren ? `Coge el <b>Cercanías ${esc(ls[0].etiqueta)}</b>` : `Sube a la <b>línea ${esc(ls[0].numero)}</b>`} y baja en <b>${pName(o.tramos[0].hasta)}</b> <span class="muted">(${paradasTxt(o.tramos[0].n, o.tramos[0].k)}${o.tramos[0].baja != null ? `, sobre las ${hora(o.tramos[0].baja)}` : ''})</span></li>
          ${o.tramos[1] ? `<li>${o.cambio > 10 ? `Anda ${fmtDist(o.cambio)} hasta <b>${pName(o.tramos[1].desde)}</b> y` : 'Allí'} coge ${ls[1].metro ? 'el <b>metro</b>' : ls[1].tren ? `el <b>Cercanías ${esc(ls[1].etiqueta)}</b>` : `la <b>línea ${esc(ls[1].numero)}</b>`}${st.modo === 'ahora' ? ` · <span class="next" data-next="${n}-1">próximo…</span>` : ''}${o.tramos[1].sube != null ? `<span class="muted"> · según horario a las ${hora(o.tramos[1].sube)}</span>` : ''}; baja en <b>${pName(o.tramos[1].hasta)}</b> <span class="muted">(${paradasTxt(o.tramos[1].n, o.tramos[1].k)})</span></li>` : ''}
          <li><span class="muted">Anda ${fmtDist(o.andar[1])}</span> hasta tu destino</li>
        </ol>
        <div class="btn-row" style="padding:0 14px 12px">${st.modo !== 'ahora' && o.sale != null ? `<button class="btn" type="button" data-salir="${n}">⏰ Avísame para salir</button>` : ''}${ls[0].metro || ls[0].tren ? '' : `<button class="btn ghost" type="button" data-ver="${esc(ls[0].numero)}">Ver la línea ${esc(ls[0].numero)} en el mapa</button>`}<button class="btn ghost" type="button" data-bajar="${n}">🔔 Avísame al bajar</button></div></article>`;
    }).join('')}${ops.length > 3 ? `<button class="btn ghost" type="button" id="pl-mas">Ver ${ops.length - 3} opción${ops.length - 3 > 1 ? 'es' : ''} más</button>` : ''}</div><p class="small muted" style="margin:8px 2px 0">${conHorario ? 'Tiempos aproximados según el horario oficial (autobús y metro), contando la espera. El «próximo» es el tiempo real de TUSSAM.' : 'Tiempos aproximados: no incluyen la espera salvo en los transbordos.'}</p>`;
    res.querySelectorAll('[data-ver]').forEach((b) => { b.onclick = () => chooseMapLine(b.dataset.ver); });
    const mas = $('#pl-mas', res);
    if (mas) mas.onclick = () => { res.querySelectorAll('.plan-extra').forEach((x) => { x.hidden = false; }); mas.remove(); };
    res.querySelectorAll('[data-bajar]').forEach((b) => { b.onclick = () => {
      // Con transbordo, primero te aviso donde cambias de autobús (luego lo puedes poner otra vez en el segundo)
      const t = ops[Number(b.dataset.bajar)].tramos[0];
      bajada.empezar({ k: t.k, desde: t.desde, hasta: t.hasta });
    }; });
    // «Avísame para salir»: una notificación 5 minutos antes de la hora de salir de casa
    res.querySelectorAll('[data-salir]').forEach((b) => { b.onclick = async () => {
      const o = ops[Number(b.dataset.salir)];
      const salgo = fechaDeMinuto(cuando, Math.max(o.llega - o.min, o.sale - Math.ceil(o.andar[0] / 75)));
      const cuandoAviso = new Date(salgo.getTime() - 5 * 60000);
      if (cuandoAviso.getTime() < Date.now() + 30000) { toast('Ya casi es la hora de salir: ¡sal ya!'); return; }
      try {
        await avisos.permiso();
        const l = lineaInfo(o.tramos[0].k.split('|')[0]);
        await native('LocalNotifications', 'schedule', { notifications: [{
          id: Math.floor(Math.random() * 1_000_000_000) + 1, title: `Sal en 5 min hacia ${cache.paradaByCode.get(o.tramos[0].desde)?.nombre || 'tu parada'}`,
          body: `Coge ${l?.metro ? 'el metro' : l?.tren ? 'el Cercanías' : `la línea ${l?.numero || ''}`} a las ${hora(o.tramos[0].sube ?? o.sale)} y llegas sobre las ${hora(o.llega)}.`,
          schedule: { at: cuandoAviso.toISOString(), allowWhileIdle: true }, channelId: await avisos.idCanal(), smallIcon: 'ic_stat_bus', iconColor: '#D41C2B', autoCancel: true,
          extra: { parada: o.tramos[0].desde },
        }] });
        vibrar(12);
        toast(`Te aviso a las ${cuandoAviso.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} para salir`);
      } catch (e) { toast(e?.message || 'No se ha podido poner el aviso'); }
    }; });
    // A otra hora, el tiempo real de ahora no sirve: se queda solo el horario
    if (st.modo !== 'ahora') return;
    // próximo autobús en cada parada de subida (tiempo real)
    ops.forEach((o, n) => o.tramos.forEach((t, ti) => {
      const num = t.k.split('|')[0];
      if (esTren(t.k)) {   // metro y Cercanías: sin tiempo real aquí, se usa su horario
        const span = res.querySelector(`[data-next="${n}-${ti}"]`);
        if (span) span.textContent = t.sube != null ? `tren a las ${hora(t.sube)}` : '';
        res.querySelector(`[data-prog="${n}-${ti}"]`)?.remove();
        return;
      }
      api(`/paradas/${encodeURIComponent(t.desde)}/tiempos`, { prioridad: 'baja' }).then((d) => {
        const b = (d.tiempos || []).filter((x) => lineaFor(x.linea)?.numero === num).sort((a, c) => a.tiempo_minutos - c.tiempo_minutos)[0];
        const span = res.querySelector(`[data-next="${n}-${ti}"]`);
        if (span) span.textContent = b ? (b.tiempo_minutos <= 0 ? 'llegando' : `próximo en ${b.tiempo_minutos} min`) : 'sin autobuses ahora';
        // Con el tiempo real ya no hace falta el del horario en la primera parada
        if (b && ti === 0) res.querySelector(`[data-prog="${n}-0"]`)?.remove();
      }).catch(() => { const span = res.querySelector(`[data-next="${n}-${ti}"]`); if (span) span.textContent = ''; });
    }));
  }
  render();
  if (st.destino && pre?.buscar) setTimeout(() => { if ($('#pl-res', el)) buscar(); }, 0);
  return {};
};

/* ================================================================== */
/* Copia de seguridad                                                  */
/* ================================================================== */
const copia = {
  crear() {
    const fotos = {};
    for (const c of tarjeta.list()) { const f = tarjeta.foto(c.num); if (f) fotos[c.num] = f; }
    return { app: 'BusSev', version: 1, fecha: new Date().toISOString(), favs: favs.list(), cards: tarjeta.list(), settings, fotos, pasaporte: window.pasaporte?.copia?.() || [], anio: window.anio?.copia?.() || {} };
  },
  async exportar() {
    const json = JSON.stringify(this.crear());
    const name = `BusSev-copia-${new Date().toISOString().slice(0, 10)}.json`;
    if (plugin('Filesystem') && plugin('Share')) {
      const w = await native('Filesystem', 'writeFile', { path: name, data: json, directory: 'CACHE', encoding: 'utf8' });
      await native('Share', 'share', { title: 'Copia de BusSev', text: 'Copia de seguridad de BusSev', url: w.uri, dialogTitle: 'Guardar la copia en…' });
      return;
    }
    try { await navigator.clipboard.writeText(json); toast('Copia copiada al portapapeles'); } catch { toast('No se ha podido exportar en este dispositivo.'); }
  },
  /* Valida todo lo que llega: una copia manipulada no puede meter nada raro */
  validar(o) {
    if (!o || o.app !== 'BusSev' || typeof o !== 'object') throw new Error('Este archivo no es una copia de BusSev.');
    const hex = (c) => (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c : '');
    const txt = (s, n) => (typeof s === 'string' ? s.replace(/[\u0000-\u001f]/g, '').slice(0, n) : '');
    const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 1000 ? Math.round(v * 100) / 100 : '');
    const fv = (Array.isArray(o.favs) ? o.favs : []).filter((f) => /^\d{1,7}$/.test(f?.codigo)).slice(0, 60).map((f) => ({
      codigo: f.codigo, nombre: txt(f.nombre, 100), alias: txt(f.alias, 30), color: hex(f.color),
      lineas: Array.isArray(f.lineas) ? f.lineas.filter((l) => /^[A-Za-z0-9]{1,8}$/.test(l)).slice(0, 20) : null,
    }));
    const cards = (Array.isArray(o.cards) ? o.cards : []).filter((c) => /^\d{12}$/.test(c?.num)).slice(0, 10).map((c) => ({
      num: c.num, name: txt(c.name, 24), color: hex(c.color), tipo: tipoPorId(c.tipo) ? c.tipo : '', precio: num(c.precio), aviso: num(c.aviso),
      // Personalización (antes se perdía al restaurar): solo valores conocidos
      emoji: /^[a-z]{1,12}$/.test(c.emoji || '') ? c.emoji : '',
      diseno: window.DISENOS_TARJETA?.[c.diseno] ? c.diseno : '',
      marco: (window.MARCOS_TARJETA || []).some(([k]) => k && k === c.marco) ? c.marco : '',
      ocultarNum: c.ocultarNum === true,
      holo: ['holo', 'cosmos', 'rayado'].includes(c.holo) ? c.holo : c.brillo === true ? 'holo' : '',
      holoFuerza: Math.max(20, Math.min(90, Number(c.holoFuerza) || 48)),
      purpurina: c.purpurina === true,
      historial: (Array.isArray(c.historial) ? c.historial : []).filter((x) => Array.isArray(x) && Number.isFinite(x[0]) && x[0] > 1.5e12 && x[0] < Date.now() + 864e5 && Number.isFinite(x[1]) && x[1] >= 0 && x[1] < 1000).slice(-200).map((x) => [Math.round(x[0]), Math.round(x[1] * 100) / 100]),
    }));
    const s = {};
    const S = o.settings || {};
    if (['auto', 'light', 'dark'].includes(S.theme)) s.theme = S.theme;
    if (PALETTES[S.color]) s.color = S.color;
    if ([0, 30, 60].includes(S.refresh)) s.refresh = S.refresh;
    if (typeof S.liveLines === 'boolean') s.liveLines = S.liveLines;
    if (['oscuro', 'claro', 'tema'].includes(S.mapStyle)) s.mapStyle = S.mapStyle;
    const fotos = {};
    for (const [k, v] of Object.entries(o.fotos || {})) if (/^\d{12}$/.test(k) && typeof v === 'string' && v.length < 900_000 && /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(v)) fotos[k] = v;
    // Pasaporte: solo forma; quien decide si un viaje vale es Android, comprobando su firma (copia.aplicar)
    const pas = (Array.isArray(o.pasaporte) ? o.pasaporte : []).slice(0, 2000).filter((v) => v && typeof v.id === 'string' && typeof v.firma === 'string' && /^[0-9a-f]{64}$/.test(v.firma))
      .map((v) => ({ id: txt(v.id, 40), linea: txt(v.linea, 8), desde: txt(v.desde, 8), hasta: txt(v.hasta, 8), desdeNombre: txt(v.desdeNombre, 80), hastaNombre: txt(v.hastaNombre, 80),
        lat: Number(v.lat) || 0, lon: Number(v.lon) || 0, inicio: Number(v.inicio) || 0, fin: Number(v.fin) || 0, paradas: Number(v.paradas) || 0, km: Number(v.km) || 0, verificado: v.verificado === true, firma: v.firma }));
    return { favs: fv, cards, settings: s, fotos, pasaporte: pas, anio: o.anio && typeof o.anio === 'object' ? o.anio : null };
  },
  importar(file) {
    return new Promise((resolve, reject) => {
      if (!file || file.size > 8 * 1024 * 1024) { reject(new Error('El archivo es demasiado grande.')); return; }
      const r = new FileReader();
      r.onload = () => { try { resolve(this.validar(JSON.parse(String(r.result)))); } catch (e) { reject(e instanceof SyntaxError ? new Error('El archivo está dañado o no es una copia de BusSev.') : e); } };
      r.onerror = () => reject(new Error('No se ha podido leer el archivo.'));
      r.readAsText(file);
    });
  },
  aplicar(d) {
    store.set('favs', d.favs);
    store.set('cards', d.cards);
    for (const [k, v] of Object.entries(d.fotos)) tarjeta.setFoto(k, v);
    Object.assign(settings, d.settings); saveSettings(); applyTheme();
    if (d.anio) window.anio?.restaurar?.(d.anio);
    if (d.pasaporte?.length) window.pasaporte?.restaurar(d.pasaporte).then((n) => { if (n) toast(`Pasaporte recuperado: ${n} ${n === 1 ? 'viaje' : 'viajes'}`); });
  },
};

/* ================================================================== */
/* Avisos de las tarjetas: saldo bajo y caducidad                      */
/* ================================================================== */
const idAviso = (txt) => { let h = 7; for (const ch of String(txt)) h = (h * 31 + ch.charCodeAt(0)) | 0; return (Math.abs(h) % 1_900_000_000) + 1000; };
avisos.permisoOk = async () => { try { await avisos.permiso(); return true; } catch (e) { toast(e.message); return false; } };
const DIAS_CAD = [30, 15, 7, 3, 1];
window.avisosTarjeta = {
  async comprobar(num) {
    const c = tarjeta.get(num);
    if (!c || !plugin('LocalNotifications')) return;
    const u = c.ultimo || {};
    const nombre = c.name || `tarjeta ${tarjeta.fmt(num)}`;
    // Saldo bajo: una notificación por cada saldo nuevo que quede por debajo
    if (c.avisoSaldo?.on && u.saldo != null && u.saldo < Number(c.avisoSaldo.importe)) {
      const marca = `${u.saldo}|${c.avisoSaldo.importe}`;
      if (c.notifSaldo !== marca) {
        await native('LocalNotifications', 'schedule', { notifications: [{ id: idAviso(num + 'saldo'), title: 'Saldo bajo', body: `A tu ${nombre} le quedan ${fmtEuro(u.saldo)}. Recárgala pronto.`, schedule: { at: new Date(Date.now() + 1500).toISOString(), allowWhileIdle: true }, smallIcon: 'ic_stat_bus', iconColor: '#D41C2B' }] }).catch(() => null);
        tarjeta.update(num, { notifSaldo: marca });
      }
    }
    // Caducidad: notificaciones programadas a las 10:00 de cada día elegido
    const ids = DIAS_CAD.map((d) => ({ id: idAviso(`${num}cad${d}`) }));
    await native('LocalNotifications', 'cancel', { notifications: ids }).catch(() => null);
    if (c.avisoCaducidad?.on && u.caducaEl && !u.sinCaducidad) {
      const lista = [];
      for (const d of c.avisoCaducidad.dias || []) {
        const f = new Date(u.caducaEl); f.setDate(f.getDate() - d); f.setHours(10, 0, 0, 0);
        if (f.getTime() > Date.now() + 60_000) lista.push({ id: idAviso(`${num}cad${d}`), title: 'Tu tarjeta caduca pronto', body: `Tu ${nombre} caduca ${d === 1 ? 'mañana' : `en ${d} días`} (${new Date(u.caducaEl).toLocaleDateString('es-ES')}).`, schedule: { at: f.toISOString(), allowWhileIdle: true }, smallIcon: 'ic_stat_bus', iconColor: '#D41C2B' });
      }
      if (lista.length) await native('LocalNotifications', 'schedule', { notifications: lista }).catch(() => null);
    }
  },
  async cancelarTodo(num) {
    if (!plugin('LocalNotifications')) return;
    await native('LocalNotifications', 'cancel', { notifications: [{ id: idAviso(num + 'saldo') }, ...DIAS_CAD.map((d) => ({ id: idAviso(`${num}cad${d}`) }))] }).catch(() => null);
  },
};

/* ================================================================== */
/* Revisar al abrir la app: saldo y caducidad de las tarjetas guardadas */
/* (como mucho con la frecuencia elegida, de una en una, sin molestar)  */
/* ================================================================== */
let revisando = false;
async function revisarAlAbrir() {
  if (revisando || !settings.revisarCada || !plugin('TussamWeb')) return;
  const cards = tarjeta.list();
  if (!cards.length) return;
  if (Date.now() - store.get('ultimaRevision', 0) < settings.revisarCada * 3600_000) return;
  revisando = true;
  store.set('ultimaRevision', Date.now());
  try {
    for (const c of cards) {
      if (!appVisible) break;
      try {
        const res = await tarjeta.consultar(c.num);
        if (res.ok) aplicarConsulta(c.num, res);
      } catch (e) {
        if (e.code === 'CLOUDFLARE') { store.set('cfPendiente', true); break; }
      }
    }
  } finally {
    revisando = false;
    if (active.name === 'tarjeta') active.refresh?.();
  }
}

/* ================================================================== */
/* Tarjeta acercada con la app cerrada o en otra pantalla              */
/* ================================================================== */
function abrirTarjetaPorNfc(uid) {
  try {
    window.__tarjetaPendiente = tarjeta.numeroDesdeUid(uid);
    vibrar(60);
    if (active.name === 'tarjeta') { route(); } else location.hash = 'tarjeta';
  } catch (e) { toast(e.message); }
}
window.addEventListener('bussevTarjeta', (e) => { if (e?.uid && active.name !== 'tarjeta') abrirTarjetaPorNfc(e.uid); });

/* ================================================================== */
/* Arranque                                                            */
/* ================================================================== */
applyTheme();
// Al arrancar, se pregunta a Android qué icono tiene puesto la app (por si se cambió en otra versión)
if (isNative()) window.Capacitor?.nativePromise?.('BusSevApariencia', 'getIcono', {}).then((r) => { if (r?.icono && r.icono !== settings.iconoApp) { settings.iconoApp = r.icono; saveSettings(); applyTheme(); } }).catch(() => null);
route();
// Lo que no corre prisa se hace después de enseñar la app
setTimeout(async () => {
  if (plugin('TarjetaNfc')) {
    const r = await native('TarjetaNfc', 'pendiente').catch(() => null);
    if (r?.uid) abrirTarjetaPorNfc(r.uid);
  }
  for (const c of tarjeta.list()) window.avisosTarjeta.comprobar(c.num);
  revisarAlAbrir();
  window.avisosTussam.revisar().catch(() => null);
  bajada.sincronizar().catch(() => null);
}, 2500);
// Al volver a la app: si Android ya dejó de avisar (has llegado), se quita el aviso de Favoritas
document.addEventListener('visibilitychange', () => { if (!document.hidden) bajada.sincronizar().catch(() => null); });
resumeHandlers.add(() => setTimeout(revisarAlAbrir, 1500));
resumeHandlers.add(() => setTimeout(() => window.avisosTussam.revisar().catch(() => null), 4000));
// Cambia de temática sola si cambia el día con la app abierta
setInterval(() => { if (appVisible && document.documentElement.dataset.tematica !== tematicaActiva()) applyTheme(); }, 10 * 60_000);
