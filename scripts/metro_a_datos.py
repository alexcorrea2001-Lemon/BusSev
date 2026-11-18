"""Convierte el GTFS oficial del Metro de Sevilla en www/metro.js (estaciones, recorrido y horario).
Uso: python3 scripts/metro_a_datos.py <carpeta_gtfs_descomprimido> <metro.js nuevo>

El formato del horario es el mismo que www/horarios.js (minutos desde cabecera y salidas por tipo de día),
para que «Cómo llegar» trate el metro igual que un autobús. Si el GTFS usa frequencies.txt (trenes «cada X
minutos»), se convierten en salidas sueltas."""
import csv, collections, datetime, json, os, sys

G, OUT = sys.argv[1:3]
rd = lambda f: list(csv.DictReader(open(f'{G}/{f}', encoding='utf-8-sig'))) if os.path.exists(f'{G}/{f}') else []

def mins(t):
    h, m, *s = (int(x) for x in t.strip().split(':'))
    return h * 60 + m + (s[0] / 60 if s else 0)

routes = rd('routes.txt')
if not routes: sys.exit('Sin routes.txt')
stops = {s['stop_id']: s for s in rd('stops.txt')}
trips = {t['trip_id']: t for t in rd('trips.txt')}
st = collections.defaultdict(list)
for r in rd('stop_times.txt'):
    t = (r.get('departure_time') or r.get('arrival_time') or '').strip()
    st[r['trip_id']].append((int(r['stop_sequence']), r['stop_id'], mins(t) if t else None))

# Estación = la «parent_station» si la hay (los andenes de una misma estación cuentan como una)
def estacion(sid):
    s = stops.get(sid, {})
    p = (s.get('parent_station') or '').strip()
    return p if p and p in stops else sid

# Frecuencias: un viaje «plantilla» que se repite cada X segundos entre dos horas
freq = collections.defaultdict(list)
for f in rd('frequencies.txt'):
    try: freq[f['trip_id']].append((mins(f['start_time']), mins(f['end_time']), int(f['headway_secs']) / 60))
    except (KeyError, ValueError): pass

viajes = []   # (service_id, direction, [(estacion, minuto)])
for tid, l in st.items():
    tr = trips.get(tid)
    if not tr: continue
    l.sort()
    base = [(estacion(s), m) for _, s, m in l]
    # Horas que falten: se reparten entre las conocidas (el GTFS a veces solo pone algunas)
    conocidos = [i for i, (_, m) in enumerate(base) if m is not None]
    if len(conocidos) < 2: continue
    for a, b in zip(conocidos, conocidos[1:]):
        for k in range(a + 1, b):
            base[k] = (base[k][0], base[a][1] + (base[b][1] - base[a][1]) * (k - a) / (b - a))
    base = [x for x in base if x[1] is not None]
    d = (tr.get('direction_id') or '').strip()
    if tid in freq:
        t0 = base[0][1]
        for ini, fin, cada in freq[tid]:
            if cada <= 0: continue
            t = ini
            while t < fin + 0.01:
                viajes.append((tr['service_id'], d, [(s, m - t0 + t) for s, m in base]))
                t += cada
    else:
        viajes.append((tr['service_id'], d, base))
if not viajes: sys.exit('Sin viajes')

# Sentidos: por direction_id si lo trae; si no, por la estación de salida y la de llegada
def clave_sentido(d, ps): return d if d else f'{ps[0][0]}>{ps[-1][0]}'
pat = collections.defaultdict(collections.Counter)
for sv, d, ps in viajes: pat[clave_sentido(d, ps)][tuple(s for s, _ in ps)] += 1
principales = sorted(pat, key=lambda k: -sum(pat[k].values()))[:2]
canon = {k: list(pat[k].most_common(1)[0][0]) for k in principales}
# El sentido 1 es el más largo (el recorrido completo); el 2, el otro
principales.sort(key=lambda k: -len(canon[k]))
sentido = {k: i + 1 for i, k in enumerate(principales)}

# ---------- Tipo de día (como en gtfs_a_datos.py) ----------
DIAS = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom']
def fecha(t): return datetime.date(int(t[:4]), int(t[4:6]), int(t[6:8]))
def dias_normales():
    cal, exc = rd('calendar.txt'), rd('calendar_dates.txt')
    if not cal and not exc: return None
    activos = collections.defaultdict(set)
    sem = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    for c in cal:
        try: d, fin = fecha(c['start_date']), fecha(c['end_date'])
        except (KeyError, ValueError): continue
        while d <= fin:
            if c.get(sem[d.weekday()]) == '1': activos[d].add(c['service_id'])
            d += datetime.timedelta(days=1)
    for e in exc:
        try: d = fecha(e['date'])
        except (KeyError, ValueError): continue
        if e.get('exception_type') == '1': activos[d].add(e['service_id'])
        elif e.get('exception_type') == '2': activos[d].discard(e['service_id'])
    # Solo los días de ahora en adelante (unos meses): el horario que vale hoy
    hoy = datetime.date.today()
    por_tipo = {t: collections.Counter() for t in DIAS}
    for d, ss in activos.items():
        if not ss or d < hoy - datetime.timedelta(days=7) or d > hoy + datetime.timedelta(days=120): continue
        por_tipo[DIAS[d.weekday()]][frozenset(ss)] += 1
    if not any(por_tipo.values()):   # calendario viejo: todo el periodo
        for d, ss in activos.items():
            if ss: por_tipo[DIAS[d.weekday()]][frozenset(ss)] += 1
    return {t: set(c.most_common(1)[0][0]) for t, c in por_tipo.items() if c}
NORMALES = dias_normales()
if NORMALES:
    _gr, DIA_GRUPO = [], {}
    for t in DIAS:
        if t not in NORMALES: continue
        ss = frozenset(NORMALES[t])
        if ss not in _gr: _gr.append(ss)
        DIA_GRUPO[t] = _gr.index(ss)
    GRUPOS = [set(x) for x in _gr]
else:
    DIA_GRUPO, GRUPOS = {t: 0 for t in DIAS}, [None]

def mediana(v):
    v = sorted(v); n = len(v)
    return None if not n else (v[n // 2] if n % 2 else (v[n // 2 - 1] + v[n // 2]) / 2)

def alinear(cn, ps):
    out, j = [], 0
    for c, t in ps:
        k = j
        while k < len(cn) and cn[k] != c: k += 1
        if k < len(cn): out.append((k, t)); j = k + 1
    return out

codigo = lambda sid: 'M' + ''.join(ch for ch in sid if ch.isalnum())[:12]
horarios, recorridos = {}, []
for k in principales:
    cn, sen = canon[k], sentido[k]
    for o, s in enumerate(cn): recorridos.append([codigo(s), 'M1', sen, o])
    al = [(sv, alinear(cn, ps)) for sv, d, ps in viajes if clave_sentido(d, ps) == k]
    al = [(sv, a) for sv, a in al if len(a) >= 2]
    off = [None] * len(cn)
    difs = collections.defaultdict(list)
    for sv, a in al:
        if a[0][0] == 0:
            for i, t in a: difs[i].append(t - a[0][1])
    for i, v in difs.items(): off[i] = mediana(v)
    if off[0] is None: off[0] = 0
    ult = 0
    for i in range(len(off)):
        if off[i] is not None: off[i] = max(ult, round(off[i])); ult = off[i]
    v_g = []
    for servs in GRUPOS:
        tr = []
        for sv, a in al:
            if servs is not None and sv not in servs: continue
            vs = [t - off[i] for i, t in a if off[i] is not None]
            if not vs: continue
            tr.append((round(mediana(vs)), a[0][0], a[-1][0]))
        tr.sort()
        enc, prev = [], 0
        for s0, de, ha in tr:
            dd = s0 - prev; prev = s0
            enc.append(dd if (de == 0 and ha == len(cn) - 1) else [dd, de, ha])
        v_g.append(enc)
    horarios[f'M1|{sen}'] = {'m': off, 'v': v_g}

usadas = {s for k in principales for s in canon[k]}
estaciones = []
for s in usadas:
    x = stops[s]
    estaciones.append({'codigo': codigo(s), 'nombre': ' '.join(x['stop_name'].split()), 'latitud': round(float(x['stop_lat']), 6), 'longitud': round(float(x['stop_lon']), 6)})
r = routes[0]
color = ('#' + r['route_color'].strip()) if (r.get('route_color') or '').strip() else '#2e9c3e'
feed = (rd('feed_info.txt') or [{}])[0]
fmt = lambda t: f'{t[:4]}-{t[4:6]}-{t[6:]}' if t and len(t) == 8 else ''
out = {'generado': fmt(feed.get('feed_start_date', '')), 'caduca': fmt(feed.get('feed_end_date', '')),
       'linea': {'numero': 'M1', 'nombre': 'Metro de Sevilla · ' + ' '.join((r.get('route_long_name') or r.get('route_short_name') or 'Línea 1').split()), 'color': color, 'metro': True},
       'estaciones': sorted(estaciones, key=lambda e: e['codigo']), 'recorridos': recorridos,
       'horarios': {'dias': DIA_GRUPO, 'l': horarios}}
if len(estaciones) < 5: sys.exit('Muy pocas estaciones: algo raro')
open(OUT, 'w', encoding='utf8').write('/* Metro de Sevilla (GTFS oficial, Punto de Acceso Nacional): estaciones, recorrido y horario. */\nwindow.BUSSEV_METRO=' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')
print(f"Metro: {len(estaciones)} estaciones, sentidos {[len(canon[k]) for k in principales]}, viajes por tipo de día {[len(x) for x in horarios['M1|1']['v']]}, tipos de día {DIA_GRUPO}, {os.path.getsize(OUT) // 1024} KB.")
