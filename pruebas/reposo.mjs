// Ahorro de batería: con un reloj simulado, cuenta las consultas a TUSSAM en la pantalla de una parada
import assert from 'node:assert/strict'; import fs from 'node:fs'; import vm from 'node:vm'; import { JSDOM } from 'jsdom';
const R = process.argv[2];
const src = fs.readFileSync(R + 'www/app.js', 'utf8');
const a = src.indexOf('const REPOSO_MS'), b = src.indexOf('const refreshNote');
const dom = new JSDOM('<body></body>', { url: 'https://localhost/' });
let ahora = 1_800_000_000_000; const timers = new Map(); let nid = 0;
const ctx = { window: dom.window, document: dom.window.document, settings: { refresh: 30 }, appVisible: true, resumeHandlers: new Set(),
  addEventListener: (t, f, o) => dom.window.addEventListener(t, f, o), Set, Math,
  Date: class extends Date { static now() { return ahora; } },
  setInterval: (f, ms) => { timers.set(++nid, { f, ms, t: ahora + ms }); return nid; }, clearInterval: (id) => timers.delete(id) };
vm.createContext(ctx);
vm.runInContext(src.slice(a, b) + '\nthis.autoRefresh = autoRefresh;', ctx);
let pedidas = 0; const parar = ctx.autoRefresh(() => pedidas++);
const avanzar = (seg) => { const fin = ahora + seg * 1000; for (;;) { let pr = null; for (const [id, x] of timers) if (x.t <= fin && (!pr || x.t < pr.x.t)) pr = { id, x }; if (!pr) break; ahora = pr.x.t; pr.x.t += pr.x.ms; pr.x.f(); } ahora = fin; };
const tocar = () => dom.window.dispatchEvent(new dom.window.Event('pointerdown'));
// Primeros 3 min tocando de vez en cuando: ritmo normal (cada 30 s) -> 6 consultas
for (let i = 0; i < 6; i++) { avanzar(30); if (i % 2) tocar(); }
assert.equal(pedidas, 6, 'ritmo normal: ' + pedidas);
// Sin tocar durante 1 hora: 3 min normales (6), hasta los 15 min cada 2 (6), y luego cada 5 min (9)
pedidas = 0; avanzar(3600);
assert.ok(pedidas >= 18 && pedidas <= 23, `en una hora sin tocar: ${pedidas} consultas (a ritmo normal serían 120)`);
// Al tocar: se actualiza al momento y vuelve al ritmo normal
// (se toca cuando los datos ya tienen más de 30 s: si se acaban de pedir, no hace falta repetir)
{ let antes = pedidas; avanzar(31); if (pedidas > antes) avanzar(31); }
pedidas = 0; tocar(); assert.equal(pedidas, 1, 'al tocar se actualiza al momento');
// tocar otra vez enseguida no repite la consulta
tocar(); assert.equal(pedidas, 1, 'no repite si ya está al día');
avanzar(70); assert.equal(pedidas, 3, 'y vuelve a cada 30 s (±5 s): ' + pedidas);
// Con «Al pulsar ⟳» no se refresca nunca solo
parar(); ctx.settings.refresh = 0; pedidas = 0; const p2 = ctx.autoRefresh(() => pedidas++); avanzar(3600); tocar(); assert.equal(pedidas, 0); p2();
console.log('OK ahorro de batería');
