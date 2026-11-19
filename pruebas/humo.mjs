// Prueba de humo: arranca la app entera en un navegador simulado (jsdom), con TUSSAM y el mapa simulados.
import fs from 'node:fs'; import vm from 'node:vm'; import { JSDOM, VirtualConsole } from 'jsdom';
const R = process.argv[2] + 'www/';
export async function arrancar({ hash = '#favoritas', ls = {}, reduce = false, lento = 0, red = null, capacitor = null, version = null } = {}) {
  const errores = [], peticiones = [];
  const vc = new VirtualConsole(); vc.on('jsdomError', (e) => errores.push('jsdom: ' + (e.detail?.stack || e.message))); vc.on('error', (m) => errores.push('console.error: ' + m));
  const html = fs.readFileSync(R + 'index.html', 'utf8').replace(/<script[^>]*src=[^>]*><\/script>/g, '').replace(/<link[^>]*>/g, '');
  const dom = new JSDOM(html, { url: 'https://localhost/' + hash, runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc });
  const w = dom.window;
  for (const [k, v] of Object.entries(ls)) w.localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  w.matchMedia = (q) => ({ matches: /reduced-motion/.test(q) ? reduce : /dark/.test(q), media: q, addEventListener() {}, removeEventListener() {}, addListener() {} });
  w.scrollTo = () => {}; w.Element.prototype.scrollIntoView = () => {}; w.navigator.vibrate = () => true;
  w.IntersectionObserver = class { observe() {} disconnect() {} unobserve() {} }; w.ResizeObserver = class { observe() {} disconnect() {} };
  // Mapa simulado: acepta cualquier llamada; cuenta cuántos mapas se crean y cuándo
  const mapas = [];
  const cosa = (extra = {}) => new Proxy(function () {}, { get: (t, k) => (k in extra ? extra[k] : k === 'then' ? undefined : k === Symbol.toPrimitive ? () => 0 : cosa()), apply: () => cosa(), construct: () => cosa() });
  w.maplibregl = new Proxy({}, { get: (t, k) => {
    if (k === 'Map') return function (o) { const m = { t: Date.now(), capas: {}, fuentes: {} }; mapas.push(m);
      return cosa({ on: (ev, a, b) => { const cb = typeof a === 'function' ? a : b; if (ev === 'load' || ev === 'style.load') setTimeout(() => cb && cb({}), 5); return undefined; }, once: (ev, cb) => { setTimeout(() => cb && cb({}), 5); }, isStyleLoaded: () => true, loaded: () => true,
        getSource: (id) => m.fuentes[id] && { setData: (d) => { m.fuentes[id] = d; } }, addSource: (id, s) => { m.fuentes[id] = s.data; }, getLayer: (id) => m.capas[id], addLayer: (l) => { m.capas[l.id] = l; }, getZoom: () => 15, getContainer: () => o.container, getCanvas: () => w.document.createElement('canvas'), remove: () => { m.quitado = true; } }); };
    return function () { return cosa({ getElement: () => w.document.createElement('div') }); };
  } });
  const tiempos = (cod) => ({ descripcion: { texto: 'PARADA DE PRUEBA ' + cod }, lineasCoincidentes: [{ labelLinea: '29', color: '#000d6f', estimaciones: [{ segundos: 240, distancia: 900, vehiculo: 1, destino: { texto: 'PRADO' } }, { segundos: 900, distancia: 3200, vehiculo: 2, destino: { texto: 'PRADO' } }] }, { labelLinea: '52', color: '#000d6f', estimaciones: [{ segundos: 420, distancia: 1500, vehiculo: 3, destino: { texto: 'SAN BERNARDO' } }] }] });
  w.fetch = async (url, o = {}) => {
    url = String(url); peticiones.push({ url, t: Date.now() });
    const resp = (body, status = 200) => ({ ok: status < 400, status, headers: { get: () => null }, json: async () => body, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) });
    if (lento) await new Promise((r) => setTimeout(r, lento));
    if (red) { const x = await red(url, resp, o); if (x) return x; }
    if (/openid-connect\/token/.test(url)) return resp({ access_token: 'a', refresh_token: 'r', expires_in: 300 });
    let m; if ((m = url.match(/paradas\/(\d+)\/tiempos|tiemposParada\/(\d+)|\/(\d+)$/))) return resp(tiempos(m[1] || m[2] || m[3]));
    if (/api\.github\.com/.test(url)) return resp({ tag_name: 'v0', body: '', assets: [] });
    return resp('', 404);
  };
  if (capacitor) w.Capacitor = capacitor;
  w.BUSSEV_TUSSAM = { clientId: 'x', clientSecret: 'y', user: 'u', pass: 'p' };
  w.addEventListener('error', (e) => errores.push('error: ' + (e.error?.stack || e.message)));
  w.addEventListener('unhandledrejection', (e) => errores.push('promesa: ' + (e.reason?.stack || e.reason)));
  for (const f of ['version.js', 'data.js', 'recorridos.js', 'backend.js', 'app.js', 'disenos.js', 'tarjeta.js', 'avisos-tussam.js', 'tarifas.js', 'extras.js', 'pasaporte.js']) {
    try { new vm.Script(f === 'version.js' && version ? `window.BUSSEV_VERSION = ${JSON.stringify(version)};` : fs.readFileSync(R + f, 'utf8'), { filename: f }).runInContext(dom.getInternalVMContext()); } catch (e) { errores.push(`${f}: ${e.stack}`); }
  }
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  const ir = async (h, ms = 700) => { w.location.hash = h; w.dispatchEvent(new w.HashChangeEvent('hashchange')); await espera(ms); };
  return { w, dom, errores, peticiones, mapas, espera, ir, $: (s) => w.document.querySelector(s), cerrar: () => w.close() };
}
if (process.argv[3] === 'solo') {
  process.on('uncaughtException', (e) => { console.log('EXCEPCIÓN', String(e.stack).split('\n').slice(0, 6).join(' | ')); });
  const a = await arrancar(); await a.espera(600);
  for (const h of ['#mapa', '#lineas', '#tarjeta', '#cerca', '#ajustes', '#avisos', '#tarifas', '#parada-194', '#linea-29', '#ruta', '#favoritas']) { await a.ir(h, 500); console.log(h.padEnd(12), 'texto visible:', (a.$('.view:not([hidden])')?.textContent || '').replace(/\s+/g, ' ').slice(0, 70)); }
  console.log('ERRORES', a.errores.length); for (const e of a.errores.slice(0, 8)) console.log(' -', e.split('\n').slice(0, 3).join(' | ').slice(0, 400));
  console.log('peticiones', a.peticiones.length, 'mapas', a.mapas.length); a.cerrar(); process.exit(0);
}
