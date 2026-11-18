"""Convierte el GTFS oficial de TUSSAM en www/data.js (paradas, líneas y recorridos).
Uso: python3 scripts/gtfs_a_datos.py <carpeta_gtfs_descomprimido> <data.js actual> <data.js nuevo>
Conserva direcciones y colores de la copia anterior cuando existen.

Además, si el GTFS trae shapes.txt (la geometría REAL del recorrido que publica TUSSAM),
guarda esa geometría por línea|sentido en <data.js nuevo>.shapes.json, para que recorridos.mjs
la use en vez de calcular la ruta con OSRM (que es de coche y no coincide con el bus)."""
import csv, collections, json, sys, os
G, OLD, OUT = sys.argv[1:4]
rd = lambda f: list(csv.DictReader(open(f'{G}/{f}', encoding='utf-8-sig')))
txt = open(OLD, encoding='utf8').read()
old = json.loads(txt[txt.index('{'):txt.rindex('}') + 1])
oldP = {p['codigo']: p for p in old['paradas']}
oldL = {l['numero']: l for l in old['lineas']}
oldR = collections.defaultdict(list)
for c, l, s, o in old['recorridos']: oldR[(l, s)].append(c)

feed = rd('feed_info.txt')[0]
routes = {r['route_id']: r for r in rd('routes.txt')}
stops = {r['stop_id']: r for r in rd('stops.txt')}
trips = {r['trip_id']: r for r in rd('trips.txt')}
seq = collections.defaultdict(list)
for r in rd('stop_times.txt'):
    seq[r['trip_id']].append((int(r['stop_sequence']), r['stop_id'], r['departure_time']))

# Geometría real del recorrido (shapes.txt). Si el GTFS no lo trae, se queda vacío y se usa OSRM.
shapes_pts = {}
sp = f'{G}/shapes.txt'
if os.path.exists(sp):
    tmp = collections.defaultdict(list)
    for r in rd('shapes.txt'):
        try:
            tmp[r['shape_id']].append((int(r['shape_pt_sequence']), float(r['shape_pt_lat']), float(r['shape_pt_lon'])))
        except (KeyError, ValueError):
            pass
    for sid, pts in tmp.items():
        pts.sort()
        shapes_pts[sid] = [[round(la, 6), round(lo, 6)] for _, la, lo in pts]

pat = collections.defaultdict(collections.Counter)
horas = collections.defaultdict(list)
salidas = collections.defaultdict(list)   # (línea, dirección) -> [(service_id, hora de salida del primer punto)]
# Para cada línea|dirección y patrón de paradas, qué shape_id usan los viajes (el más repetido manda)
pat_shapes = collections.defaultdict(lambda: collections.defaultdict(collections.Counter))
viajes = collections.defaultdict(list)    # (línea, dirección) -> [(service_id, [(parada, hora), …])]  (horario de cada parada)
for t, l in seq.items():
    tr = trips.get(t)
    if not tr: continue
    lin = routes[tr['route_id']]['route_short_name'].strip()
    l.sort()
    patt = tuple(x[1] for x in l)
    pat[(lin, tr['direction_id'])][patt] += 1
    horas[(lin, tr['direction_id'])].append(l[0][2])
    salidas[(lin, tr['direction_id'])].append((tr['service_id'], l[0][2]))
    viajes[(lin, tr['direction_id'])].append((tr['service_id'], [(x[1], x[2]) for x in l]))
    sid = tr.get('shape_id')
    if sid: pat_shapes[(lin, tr['direction_id'])][patt][sid] += 1

# ---------- Primer y último autobús de un día NORMAL de cada tipo ----------
# Antes se cogía el más temprano y el más tardío de TODO el periodo, mezclando laborables, sábados, festivos y días
# especiales (Feria, Nochevieja… con servicio toda la noche): por eso la 29 salía «primer bus 05:18 · último 05:00».
# Ahora, con el calendario oficial (calendar.txt / calendar_dates.txt), se busca qué servicios circulan un día
# normal de cada día de la semana: de todos los lunes del periodo, el conjunto de servicios que más se repite (los
# días raros, como un festivo o la Feria, se quedan fuera solos); igual con martes, miércoles… Va día a día (no
# «laborables» juntos) porque los Búhos y algunas líneas tienen horario distinto el viernes.
import datetime
DIAS = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom']
def fecha(t): return datetime.date(int(t[:4]), int(t[4:6]), int(t[6:8]))
def dias_normales():
    cal = rd('calendar.txt') if os.path.exists(f'{G}/calendar.txt') else []
    exc = rd('calendar_dates.txt') if os.path.exists(f'{G}/calendar_dates.txt') else []
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
    try: ini, fin = fecha(feed['feed_start_date']), fecha(feed['feed_end_date'])
    except (KeyError, ValueError): ini, fin = None, None
    por_tipo = {t: collections.Counter() for t in DIAS}
    for d, ss in activos.items():
        if not ss or (ini and (d < ini or d > fin)): continue
        por_tipo[DIAS[d.weekday()]][frozenset(ss)] += 1
    return {t: set(c.most_common(1)[0][0]) for t, c in por_tipo.items() if c}
NORMALES = dias_normales()

def hhmm(t):
    h, m, *_ = (int(x) for x in t.split(':'))
    return f'{h % 24:02d}:{m:02d}'
def mins(t):
    h, m, *_ = (int(x) for x in t.split(':')); return h * 60 + m

# ---------- Horario de cada parada (www/horarios.js) ----------
# Para no guardar cientos de miles de horas, por cada línea|sentido se guarda:
#   - cuántos minutos tarda el autobús desde la cabecera hasta cada parada del recorrido (lo normal: la mediana);
#   - a qué hora sale cada viaje de la cabecera, por tipo de día (lun…dom agrupados si tienen los mismos servicios).
# La hora en una parada = salida + minutos hasta esa parada. Los viajes que no hacen el recorrido entero se guardan
# como [salida, desde, hasta] (posiciones en el recorrido).
def _mins_o_none(t):
    try: return mins(t) if t and t.strip() else None
    except ValueError: return None
def _mediana(v):
    v = sorted(v); n = len(v)
    return None if not n else (v[n // 2] if n % 2 else (v[n // 2 - 1] + v[n // 2]) / 2)
def _alinear(canon, paradas):
    # Empareja las paradas del viaje con el recorrido principal en orden (los circulares repiten parada)
    out, j = [], 0
    for c, t in paradas:
        k = j
        while k < len(canon) and canon[k] != c: k += 1
        if k < len(canon):
            out.append((k, _mins_o_none(t))); j = k + 1
    # TUSSAM solo pone la hora en algunas paradas («puntos de control»): las de en medio se reparten entre
    # la anterior y la siguiente que sí la tienen (si no, esas paradas se quedaban sin horario)
    con = [i for i, (_, t) in enumerate(out) if t is not None]
    for a, b in zip(con, con[1:]):
        ka, kb, ta, tb = out[a][0], out[b][0], out[a][1], out[b][1]
        for i in range(a + 1, b):
            out[i] = (out[i][0], ta + (tb - ta) * (out[i][0] - ka) / max(1, kb - ka))
    return [(k, t) for k, t in out if t is not None]
def horario_paradas(canon, vs, grupos):
    al = [(sv, _alinear(canon, ps)) for sv, ps in vs]
    al = [(sv, a) for sv, a in al if len(a) >= 2]
    if not al: return None
    off = [None] * len(canon)
    difs = collections.defaultdict(list)
    for sv, a in al:
        if a[0][0] == 0:
            for k, t in a: difs[k].append(t - a[0][1])
    for k, v in difs.items(): off[k] = _mediana(v)
    if off[0] is None: off[0] = 0
    def salida(a):
        v = [t - off[k] for k, t in a if off[k] is not None]
        return _mediana(v) if v else None
    # Paradas sin dato (solo las hacen viajes que no salen de cabecera): se completan con esos viajes
    falta = collections.defaultdict(list)
    for sv, a in al:
        s0 = salida(a)
        if s0 is None: continue
        for k, t in a:
            if off[k] is None: falta[k].append(t - s0)
    for k, v in falta.items(): off[k] = _mediana(v)
    # Que nunca vaya hacia atrás (una parada no puede estar antes que la anterior)
    ult = 0
    for k in range(len(off)):
        if off[k] is not None:
            off[k] = max(ult, round(off[k])); ult = off[k]
    out_g = []
    for servs in grupos:
        tr = []
        for sv, a in al:
            if servs is not None and sv not in servs: continue
            s0 = salida(a)
            if s0 is None: continue
            s0 = round(s0); de, ha = a[0][0], a[-1][0]
            tr.append((s0, de, ha))
        tr.sort()
        # Salidas como diferencias con la anterior (ocupa mucho menos): 360, 12, 12, 15…
        enc, prev = [], 0
        for s0, de, ha in tr:
            d = s0 - prev; prev = s0
            enc.append(d if (de == 0 and ha == len(canon) - 1) else [d, de, ha])
        out_g.append(enc)
    return {'m': off, 'v': out_g}

COLOR_DEF = {'A': '#2b2f7a', 'C': '#008431', 'T': '#c60018'}
lineas, recorridos, usadas = [], [], set()
# Tipos de día con los mismos servicios van juntos (lunes a jueves suele ser igual)
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
horarios_out = {}
shapes_out = {}   # "linea|sentido" -> [[lat,lon], ...]  (geometría real del GTFS)
for rid, r in routes.items():
    lin = r['route_short_name'].strip()
    dirs = sorted(d for (l, d) in pat if l == lin)
    if not dirs: continue
    # Sentidos: que coincidan con la copia anterior (mismo 1 y 2) cuando la línea ya existía
    main = {d: pat[(lin, d)].most_common(1)[0][0] for d in dirs}   # tuplas de stop_id en orden
    m = {}
    if (lin, 1) in oldR and len(dirs) == 2:
        sim = lambda a, b: len(set(a) & set(b)) / max(1, len(set(a) | set(b)))
        a = sim(main[dirs[0]], oldR[(lin, 1)]) + sim(main[dirs[1]], oldR.get((lin, 2), []))
        b = sim(main[dirs[1]], oldR[(lin, 1)]) + sim(main[dirs[0]], oldR.get((lin, 2), []))
        m = {dirs[0]: 1, dirs[1]: 2} if a >= b else {dirs[0]: 2, dirs[1]: 1}
    else:
        m = {d: i + 1 for i, d in enumerate(dirs)}
    for d in dirs:
        for o, c in enumerate(main[d]):
            recorridos.append([c, lin, m[d], o]); usadas.add(c)
        # Geometría real: el shape más usado por los viajes de este patrón
        sc = pat_shapes[(lin, d)].get(main[d])
        sid = sc.most_common(1)[0][0] if sc else None
        if sid and sid in shapes_pts and len(shapes_pts[sid]) >= 2:
            shapes_out[f'{lin}|{m[d]}'] = shapes_pts[sid]
        try:
            hp = horario_paradas(main[d], viajes[(lin, d)], GRUPOS)
            if hp: horarios_out[f'{lin}|{m[d]}'] = hp
        except Exception as e:   # el horario por parada es un extra: si algo raro pasa, no se para nada
            print(f'Horario por parada de {lin}|{m[d]}: no se ha podido calcular ({e})')
    prev = oldL.get(lin, {})
    hs = {m[d]: sorted(horas[(lin, d)], key=mins) for d in dirs}
    # Primer y último de un día normal de cada día de la semana: {'lun': [[ini, fin] ida, [ini, fin] vuelta], …, 'dom': …}
    horario = {}
    if NORMALES:
        for t, servs in NORMALES.items():
            par = []
            for sentido in (1, 2):
                d = next((x for x in dirs if m[x] == sentido), None)
                hh = sorted((h for sv, h in salidas[(lin, d)] if sv in servs), key=mins) if d is not None else []
                par.append([hhmm(hh[0]), hhmm(hh[-1])] if hh else None)
            if any(par): horario[t] = par
    # Lo de siempre (lo que usan las versiones antiguas de la app): un martes normal
    if horario.get('mar'): horario['lab'] = horario['mar']
    lab_ok = bool(horario.get('lab'))
    color = prev.get('color') or (('#' + r['route_color']) if r.get('route_color') else COLOR_DEF.get(lin[0], '#000d6f'))
    lineas.append({
        'numero': lin, 'nombre': ' '.join(r['route_long_name'].split()), 'color': color,
        # lo de siempre (y lo que usan las versiones antiguas de la app): un laborable normal si se sabe
        'hora_inicio_ida': (horario['lab'][0][0] if horario['lab'][0] else None) if lab_ok else (hhmm(hs[1][0]) if hs.get(1) else None),
        'hora_fin_ida': (horario['lab'][0][1] if horario['lab'][0] else None) if lab_ok else (hhmm(hs[1][-1]) if hs.get(1) else None),
        'hora_inicio_vuelta': (horario['lab'][1][0] if horario['lab'][1] else None) if lab_ok else (hhmm(hs[2][0]) if hs.get(2) else None),
        'hora_fin_vuelta': (horario['lab'][1][1] if horario['lab'][1] else None) if lab_ok else (hhmm(hs[2][-1]) if hs.get(2) else None),
        **({'horario': {k: v for k, v in horario.items() if k != 'lab'}} if horario else {}),
        'nocturna': lin.startswith('A'),
    })
orden = lambda n: (0 if n[0].isdigit() else 1, n.zfill(3))
lineas.sort(key=lambda l: orden(l['numero']))
recorridos.sort(key=lambda x: (orden(x[1]), x[2], x[3]))
paradas = []
for c in sorted(usadas, key=lambda x: int(x) if x.isdigit() else 10**9):
    s = stops[c]; o = oldP.get(c, {})
    p = {'codigo': c, 'nombre': ' '.join(s['stop_name'].split()), 'latitud': round(float(s['stop_lat']), 6), 'longitud': round(float(s['stop_lon']), 6)}
    for k in ('calle', 'numero', 'codigo_postal', 'municipio', 'direccion_completa'):
        if o.get(k): p[k] = o[k]
    # Accesibilidad para silla de ruedas, si el GTFS la publica (stops.txt → wheelchair_boarding):
    # 1 = accesible, 2 = no accesible, 0/vacío = sin dato. Se guarda solo cuando se sabe.
    wb = str(s.get('wheelchair_boarding', '') or '').strip()
    if wb == '1': p['accesible'] = 1
    elif wb == '2': p['accesible'] = 0
    paradas.append(p)
fi, ff = feed['feed_start_date'], feed['feed_end_date']
data = {'generado': f'{fi[:4]}-{fi[4:6]}-{fi[6:]}', 'caduca': f'{ff[:4]}-{ff[4:6]}-{ff[6:]}', 'fuente': 'GTFS oficial de TUSSAM (Punto de Acceso Nacional)',
        'paradas': paradas, 'lineas': lineas, 'recorridos': recorridos}
open(OUT, 'w', encoding='utf8').write(f"/* Paradas, líneas y recorridos de TUSSAM. Fuente: GTFS oficial, válido del {data['generado']} al {data['caduca']}. */\nwindow.BUSSEV_DATA=" + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
# Horario de cada parada: archivo aparte (www/horarios.js), que la app carga solo cuando hace falta
hor = {'generado': data['generado'], 'caduca': data['caduca'], 'dias': DIA_GRUPO, 'l': horarios_out}
open(OUT + '.horarios.js', 'w', encoding='utf8').write("/* Horario de cada parada (GTFS oficial de TUSSAM): por línea|sentido, minutos desde cabecera ('m') y salidas por tipo de día ('v', en diferencias). */\nwindow.BUSSEV_HORARIOS=" + json.dumps(hor, ensure_ascii=False, separators=(',', ':')) + ';\n')
print(f'Horario por parada: {len(horarios_out)} líneas-sentido, {os.path.getsize(OUT + ".horarios.js") // 1024} KB, tipos de día {DIA_GRUPO}.')
# La geometría real se guarda aparte (solo para el build; no se sube ni va en el APK)
open(OUT + '.shapes.json', 'w', encoding='utf8').write(json.dumps(shapes_out, ensure_ascii=False, separators=(',', ':')))
print(len(paradas), 'paradas,', len(lineas), 'líneas,', len(recorridos), 'relaciones; nuevas paradas:', len([p for p in paradas if p['codigo'] not in oldP]))
nsent = len({(x[1], x[2]) for x in recorridos})
# El dibujo de las líneas sale del trazado oficial del Ayuntamiento (geojson/lineas.json) ajustado a las calles;
# la geometría del GTFS solo se usa si algún día TUSSAM la publica. Solo se menciona si la trae.
if shapes_out: print(f'Geometría del GTFS (shapes.txt): {len(shapes_out)} de {nsent} líneas-sentido.')
# Primer y último autobús: se enseñan algunas líneas en el log para poder comprobarlo
if NORMALES:
    print('Horario de un día normal (martes / viernes / sábado / domingo y festivo), ida:')
    for l in lineas:
        if l['numero'] in ('29', '16', 'C1', '2', 'A1', 'A6') and l.get('horario'):
            h = l['horario']; f = lambda t: '–'.join(h[t][0]) if h.get(t) and h[t][0] else 'no circula'
            print(f"  {l['numero']}: {f('mar')} / {f('vie')} / {f('sab')} / {f('dom')}")
else:
    print('El GTFS no trae calendario: primer y último autobús de todo el periodo.')
# Accesibilidad de las paradas (silla de ruedas): la app solo enseña el icono si TUSSAM lo publica
acc = sum(1 for p in paradas if 'accesible' in p)
print(f'Accesibilidad de paradas: {acc} de {len(paradas)} con dato.' if acc else 'Accesibilidad de paradas: TUSSAM no la publica (la app no enseña el icono).')
