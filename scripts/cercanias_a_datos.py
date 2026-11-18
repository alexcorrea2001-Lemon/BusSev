"""Convierte el GTFS oficial de Renfe Cercanías (todo España) en www/cercanias.js, solo con el núcleo de Sevilla.
Uso: python3 scripts/cercanias_a_datos.py <carpeta_gtfs_descomprimido> <cercanias.js nuevo>

Se quedan las líneas que paran dentro de Sevilla capital (C1, C2, C3, C4, C5…), con todas sus estaciones.
El horario va en el mismo formato que www/horarios.js y www/metro.js. Las claves llevan una «R» delante
(RC1, RC4…) para no confundirse con las circulares de TUSSAM (C1, C2…)."""
import csv, collections, datetime, json, os, sys

G, OUT = sys.argv[1:3]
def rd(f):
    # El GTFS de Renfe trae espacios de más en los campos («51003   », « C1»): se limpian todos
    p = f'{G}/{f}'
    if not os.path.exists(p): return
    for row in csv.DictReader(open(p, encoding='utf-8-sig')):
        yield {(k or '').strip(): (v.strip() if isinstance(v, str) else v) for k, v in row.items()}

def mins(t):
    h, m, *s = (int(x) for x in t.strip().split(':'))
    return h * 60 + m + (s[0] / 60 if s else 0)

# Sevilla capital: una línea entra si para en al menos una estación de aquí
CAPITAL = (37.33, 37.43, -6.03, -5.92)   # lat min, lat max, lon min, lon max
stops = {s['stop_id']: s for s in rd('stops.txt')}
def en_capital(sid):
    s = stops.get(sid)
    try: la, lo = float(s['stop_lat']), float(s['stop_lon'])
    except (TypeError, KeyError, ValueError): return False
    return CAPITAL[0] <= la <= CAPITAL[1] and CAPITAL[2] <= lo <= CAPITAL[3]
def estacion(sid):
    s = stops.get(sid, {})
    p = (s.get('parent_station') or '').strip()
    return p if p and p in stops else sid

routes = {r['route_id']: r for r in rd('routes.txt')}
trips = {t['trip_id']: t for t in rd('trips.txt') if t.get('route_id') in routes}

# Primera pasada por stop_times (es enorme): qué viajes pasan por Sevilla capital
de_sevilla = set()
for r in rd('stop_times.txt'):
    if r['trip_id'] in trips and r['trip_id'] not in de_sevilla and en_capital(r['stop_id']): de_sevilla.add(r['trip_id'])
lineas_sev = {trips[t]['route_id'] for t in de_sevilla}
nombre_linea = lambda rid: (routes[rid].get('route_short_name') or '').strip().upper()
# Por nombre (C1, C2…): Renfe a veces tiene varios route_id para la misma línea
por_nombre = collections.defaultdict(set)
for rid in lineas_sev:
    n = nombre_linea(rid)
    if n: por_nombre[n].add(rid)
validos = {t for t, tr in trips.items() if tr['route_id'] in lineas_sev}
st = collections.defaultdict(list)
for r in rd('stop_times.txt'):
    if r['trip_id'] not in validos: continue
    t = (r.get('departure_time') or r.get('arrival_time') or '').strip()
    st[r['trip_id']].append((int(r['stop_sequence']), r['stop_id'], mins(t) if t else None))

# ---------- Tipo de día ----------
DIAS = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom']
def fecha(t): return datetime.date(int(t[:4]), int(t[4:6]), int(t[6:8]))
servicios_usados = {trips[t]['service_id'] for t in validos}
def dias_normales():
    activos = collections.defaultdict(set)
    sem = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    for c in rd('calendar.txt'):
        if c['service_id'] not in servicios_usados: continue
        try: d, fin = fecha(c['start_date']), fecha(c['end_date'])
        except (KeyError, ValueError): continue
        while d <= fin:
            if c.get(sem[d.weekday()]) == '1': activos[d].add(c['service_id'])
            d += datetime.timedelta(days=1)
    for e in rd('calendar_dates.txt'):
        if e['service_id'] not in servicios_usados: continue
        try: d = fecha(e['date'])
        except (KeyError, ValueError): continue
        if e.get('exception_type') == '1': activos[d].add(e['service_id'])
        elif e.get('exception_type') == '2': activos[d].discard(e['service_id'])
    if not activos: return None
    hoy = datetime.date.today()
    por_tipo = {t: collections.Counter() for t in DIAS}
    for d, ss in activos.items():
        if ss and hoy - datetime.timedelta(days=7) <= d <= hoy + datetime.timedelta(days=120): por_tipo[DIAS[d.weekday()]][frozenset(ss)] += 1
    if not any(por_tipo.values()):
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
codigo = lambda sid: 'R' + ''.join(ch for ch in sid if ch.isalnum())[:12]

lineas, recorridos, horarios, usadas = [], [], {}, set()
COLOR_DEF = {'C1': '#78B4E1', 'C2': '#00953B', 'C3': '#E30613', 'C4': '#8B2A8B', 'C5': '#003E7E'}
for nombre in sorted(por_nombre):
    rids = por_nombre[nombre]
    viajes = []
    for tid in validos:
        tr = trips[tid]
        if tr['route_id'] not in rids or tid not in st: continue
        l = sorted(st[tid])
        base = [(estacion(s), m) for _, s, m in l]
        con = [i for i, (_, m) in enumerate(base) if m is not None]
        if len(con) < 2: continue
        for a, b in zip(con, con[1:]):
            for k in range(a + 1, b):
                base[k] = (base[k][0], base[a][1] + (base[b][1] - base[a][1]) * (k - a) / (b - a))
        base = [x for x in base if x[1] is not None]
        viajes.append((tr['service_id'], (tr.get('direction_id') or '').strip(), base))
    if not viajes: continue
    clave = lambda d, ps: d if d else f'{ps[0][0]}>{ps[-1][0]}'
    pat = collections.defaultdict(collections.Counter)
    for sv, d, ps in viajes: pat[clave(d, ps)][tuple(s for s, _ in ps)] += 1
    principales = sorted(pat, key=lambda k: -sum(pat[k].values()))[:2]
    # El recorrido principal de cada sentido: el patrón más largo de los habituales (para que salgan todas las estaciones)
    canon = {}
    for k in principales:
        comunes = [p for p, n in pat[k].most_common(4)]
        canon[k] = list(max(comunes, key=len))
    principales.sort(key=lambda k: -len(canon[k]))
    sentido = {k: i + 1 for i, k in enumerate(principales)}
    num = 'R' + nombre
    for k in principales:
        cn, sen = canon[k], sentido[k]
        for o, s in enumerate(cn): recorridos.append([codigo(s), num, sen, o]); usadas.add(s)
        al = [(sv, alinear(cn, ps)) for sv, d, ps in viajes if clave(d, ps) == k]
        al = [(sv, a) for sv, a in al if len(a) >= 2]
        off = [None] * len(cn)
        difs = collections.defaultdict(list)
        for sv, a in al:
            if a[0][0] == 0:
                for i, t in a: difs[i].append(t - a[0][1])
        for i, v in difs.items(): off[i] = mediana(v)
        if off[0] is None: off[0] = 0
        # Estaciones que solo hacen los viajes cortos: se completan con ellos
        falta = collections.defaultdict(list)
        for sv, a in al:
            vs = [t - off[i] for i, t in a if off[i] is not None]
            if not vs: continue
            s0 = mediana(vs)
            for i, t in a:
                if off[i] is None: falta[i].append(t - s0)
        for i, v in falta.items(): off[i] = mediana(v)
        ult = 0
        for i in range(len(off)):
            if off[i] is not None: off[i] = max(ult, round(off[i])); ult = off[i]
        v_g = []
        for servs in GRUPOS:
            tr = []
            for sv, a in al:
                if servs is not None and sv not in servs: continue
                vs = [t - off[i] for i, t in a if off[i] is not None]
                if vs: tr.append((round(mediana(vs)), a[0][0], a[-1][0]))
            tr.sort()
            enc, prev = [], 0
            for s0, de, ha in tr:
                dd = s0 - prev; prev = s0
                enc.append(dd if (de == 0 and ha == len(cn) - 1) else [dd, de, ha])
            v_g.append(enc)
        horarios[f'{num}|{sen}'] = {'m': off, 'v': v_g}
    r0 = routes[sorted(rids)[0]]
    col = (r0.get('route_color') or '').strip()
    lineas.append({'numero': num, 'etiqueta': nombre, 'nombre': ' '.join((r0.get('route_long_name') or nombre).split()),
                   'color': ('#' + col) if col else COLOR_DEF.get(nombre, '#c2185b'), 'tren': True})

estaciones = []
for s in usadas:
    x = stops[s]
    estaciones.append({'codigo': codigo(s), 'nombre': ' '.join(x['stop_name'].split()), 'latitud': round(float(x['stop_lat']), 6), 'longitud': round(float(x['stop_lon']), 6)})
if len(lineas) < 2 or len(estaciones) < 5:
    en_sev = sum(1 for sid in stops if en_capital(sid))
    sys.exit(f'Datos raros: {len(lineas)} líneas, {len(estaciones)} estaciones (rutas {len(routes)}, viajes {len(trips)}, estaciones en Sevilla {en_sev}, viajes por Sevilla {len(de_sevilla)})')
out = {'lineas': lineas, 'estaciones': sorted(estaciones, key=lambda e: e['codigo']), 'recorridos': recorridos,
       'horarios': {'dias': DIA_GRUPO, 'l': horarios}}
open(OUT, 'w', encoding='utf8').write('/* Cercanías Renfe de Sevilla (GTFS oficial de Renfe): estaciones, recorridos y horario. */\nwindow.BUSSEV_CERCANIAS=' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')
print(f"Cercanías: líneas {[l['etiqueta'] for l in lineas]}, {len(estaciones)} estaciones, tipos de día {DIA_GRUPO}, {os.path.getsize(OUT) // 1024} KB.")
