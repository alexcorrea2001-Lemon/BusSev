"""Prueba del primer y último autobús con un GTFS inventado (como la línea 29: un día de Feria con servicio toda la noche)."""
import os, subprocess, json, shutil, datetime, sys, tempfile
R = sys.argv[1]
T = os.path.join(os.environ.get('PRUEBAS_TMP') or tempfile.gettempdir(), 'gtfs'); os.makedirs(T, exist_ok=True)
def escribe(d, nombre, filas):
    with open(f'{d}/{nombre}', 'w', encoding='utf8') as f: f.write('\n'.join(filas) + '\n')
def gtfs(d, modo):
    shutil.rmtree(d, ignore_errors=True); os.makedirs(d)
    escribe(d, 'feed_info.txt', ['feed_publisher_name,feed_publisher_url,feed_lang,feed_start_date,feed_end_date', 'TUSSAM,https://x,es,20260928,20270117'])
    escribe(d, 'routes.txt', ['route_id,route_short_name,route_long_name,route_type', 'R29,29,Prado San Sebastián - Torreblanca,3'])
    escribe(d, 'stops.txt', ['stop_id,stop_name,stop_lat,stop_lon', '1,Prado,37.38,-5.98', '2,Medio,37.39,-5.97', '3,Torreblanca,37.40,-5.90'])
    viajes = [('LAB', '06:00:00'), ('LAB', '12:00:00'), ('LAB', '23:30:00'), ('SAB', '06:30:00'), ('SAB', '24:15:00'), ('DOM', '07:15:00'), ('DOM', '23:00:00'),
              ('FERIA', '05:18:00'), ('FERIA', '29:00:00'), ('VIE', '06:00:00'), ('VIE', '25:30:00')]   # VIE: el viernes acaba más tarde   # Feria: servicio toda la noche (el culpable del «05:18 – 05:00»)
    t = ['route_id,service_id,trip_id,direction_id']; st = ['trip_id,arrival_time,departure_time,stop_id,stop_sequence']
    for i, (sv, h) in enumerate(viajes):
        for dirn in (0, 1):
            tid = f'{sv}{i}d{dirn}'; t.append(f'R29,{sv},{tid},{dirn}')
            hh, mm, _ = h.split(':'); base = int(hh) * 60 + int(mm) + (10 if dirn else 0)
            paradas = ['1', '2', '3'] if dirn == 0 else ['3', '2', '1']
            for k, sid in enumerate(paradas):
                x = base + k * 15; hs = f'{x // 60:02d}:{x % 60:02d}:00'; st.append(f'{tid},{hs},{hs},{sid},{k + 1}')
    escribe(d, 'trips.txt', t); escribe(d, 'stop_times.txt', st)
    feria = ['20261014', '20261015']           # dos días de Feria (miércoles y jueves): servicio especial
    festivo = '20261012'                        # lunes festivo: horario de domingo
    if modo == 'calendar':
        escribe(d, 'calendar.txt', ['service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date',
            'LAB,1,1,1,1,0,0,0,20260928,20270117', 'VIE,0,0,0,0,1,0,0,20260928,20270117', 'SAB,0,0,0,0,0,1,0,20260928,20270117', 'DOM,0,0,0,0,0,0,1,20260928,20270117'])
        escribe(d, 'calendar_dates.txt', ['service_id,date,exception_type'] + [f'FERIA,{x},1' for x in feria] + [f'LAB,{x},2' for x in feria]
                + [f'LAB,{festivo},2', f'DOM,{festivo},1'])
    elif modo == 'solo_dates':
        filas = ['service_id,date,exception_type']
        d0 = datetime.date(2026, 9, 28)
        while d0 <= datetime.date(2027, 1, 17):
            k = d0.strftime('%Y%m%d')
            if k in feria: sv = 'FERIA'
            elif k == festivo or d0.weekday() == 6: sv = 'DOM'
            elif d0.weekday() == 5: sv = 'SAB'
            elif d0.weekday() == 4: sv = 'VIE'
            else: sv = 'LAB'
            filas.append(f'{sv},{k},1'); d0 += datetime.timedelta(days=1)
        escribe(d, 'calendar_dates.txt', filas)
def corre(modo):
    d = f'{T}/{modo}'; gtfs(d, modo)
    out = f'{T}/{modo}_data.js'
    r = subprocess.run(['python3', '-I', R + 'scripts/gtfs_a_datos.py', d, R + 'www/data.js', out], capture_output=True, text=True)
    if r.returncode: print(r.stderr[-1500:]); raise SystemExit(1)
    txt = open(out, encoding='utf8').read(); D = json.loads(txt[txt.index('{'):txt.rindex('}') + 1])
    l = next(x for x in D['lineas'] if x['numero'] == '29')
    return l, r.stdout
for modo in ('calendar', 'solo_dates'):
    l, log = corre(modo)
    h = l['horario']
    assert 'lab' not in h, h
    for dd in ('lun', 'mar', 'mie', 'jue'): assert h[dd][0] == ['06:00', '23:30'], (modo, dd, h)
    assert h['vie'][0] == ['06:00', '01:30'], (modo, h)
    assert h['sab'][0] == ['06:30', '00:15'], (modo, h)
    assert h['dom'][0] == ['07:15', '23:00'], (modo, h)
    assert h['mar'][1] == ['06:10', '23:40'], (modo, h)
    assert (l['hora_inicio_ida'], l['hora_fin_ida']) == ('06:00', '23:30'), l
    print(f'OK {modo}:', {k: v[0] for k, v in h.items()}); print('   log:', [x for x in log.splitlines() if '29:' in x])
l, log = corre('sin_calendario')
assert 'horario' not in l and l['hora_inicio_ida'] == '05:18', l
print('OK sin calendario: se queda como antes (', l['hora_inicio_ida'], '-', l['hora_fin_ida'], ')')
# Horario de cada parada (www/horarios.js): la parada 2 está a 15 min de cabecera
h = open(f'{T}/calendar_data.js.horarios.js', encoding='utf8').read()
H = json.loads(h[h.index('{'):h.rindex('}') + 1])
assert H['dias'] == {'lun': 0, 'mar': 0, 'mie': 0, 'jue': 0, 'vie': 1, 'sab': 2, 'dom': 3}, H['dias']
e = H['l']['29|1']
assert e['m'] == [0, 15, 30], e
sal = []; s0 = 0
for x in e['v'][0]: s0 += x if isinstance(x, int) else x[0]; sal.append(s0)
assert sal == [360, 720, 1410], sal      # 06:00, 12:00, 23:30 los laborables
print('OK horario por parada:', H['dias'], e['m'], sal)

