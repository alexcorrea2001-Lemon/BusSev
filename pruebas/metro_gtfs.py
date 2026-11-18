"""Prueba del Metro con un GTFS inventado: andenes con estación «madre», trenes cada X minutos (frequencies.txt)
y un viaje suelto que no hace el recorrido entero."""
import os, subprocess, json, shutil, sys, tempfile, datetime
R = sys.argv[1]
T = os.path.join(os.environ.get('PRUEBAS_TMP') or tempfile.gettempdir(), 'metro'); shutil.rmtree(T, ignore_errors=True); os.makedirs(T)
def escribe(nombre, filas):
    with open(f'{T}/{nombre}', 'w', encoding='utf8') as f: f.write('\n'.join(filas) + '\n')
hoy = datetime.date.today(); ini = (hoy - datetime.timedelta(days=30)).strftime('%Y%m%d'); fin = (hoy + datetime.timedelta(days=300)).strftime('%Y%m%d')
escribe('feed_info.txt', ['feed_publisher_name,feed_publisher_url,feed_lang,feed_start_date,feed_end_date', f'Metro,https://x,es,{ini},{fin}'])
escribe('routes.txt', ['route_id,route_short_name,route_long_name,route_type,route_color', 'L1,L1,Ciudad Expo - Olivar de Quintos,1,0F9D58'])
est = [('E1', 'Ciudad Expo', 37.35, -6.06), ('E2', 'Cavaleri', 37.355, -6.05), ('E3', 'San Bernardo', 37.378, -5.98), ('E4', 'Nervión', 37.38, -5.97), ('E5', 'Olivar de Quintos', 37.30, -5.92)]
filas = ['stop_id,stop_name,stop_lat,stop_lon,location_type,parent_station']
for i, n, la, lo in est:
    filas.append(f'{i},{n},{la},{lo},1,')
    filas.append(f'{i}a,{n} andén 1,{la},{lo},0,{i}')
    filas.append(f'{i}b,{n} andén 2,{la},{lo},0,{i}')
escribe('stops.txt', filas)
escribe('calendar.txt', ['service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date', f'LAB,1,1,1,1,1,0,0,{ini},{fin}', f'FIN,0,0,0,0,0,1,1,{ini},{fin}'])
t = ['route_id,service_id,trip_id,direction_id']; st = ['trip_id,arrival_time,departure_time,stop_id,stop_sequence']; fr = ['trip_id,start_time,end_time,headway_secs']
def viaje(tid, sv, d, paradas, h0):
    t.append(f'L1,{sv},{tid},{d}')
    for k, (s, mm) in enumerate(paradas):
        x = h0 + mm; hs = f'{int(x // 60):02d}:{int(x % 60):02d}:00'; st.append(f'{tid},{hs},{hs},{s},{k + 1}')
ida = [('E1a', 0), ('E2a', 3), ('E3a', 20), ('E4a', 23), ('E5a', 40)]
vuelta = [('E5b', 0), ('E4b', 17), ('E3b', 20), ('E2b', 37), ('E1b', 40)]
viaje('LI', 'LAB', 0, ida, 6 * 60 + 30); fr.append('LI,06:30:00,23:00:00,600')        # cada 10 min
viaje('LV', 'LAB', 1, vuelta, 6 * 60 + 30); fr.append('LV,06:30:00,23:00:00,600')
viaje('FI', 'FIN', 0, ida, 7 * 60 + 30); fr.append('FI,07:30:00,23:00:00,900')        # fin de semana cada 15
viaje('FV', 'FIN', 1, vuelta, 7 * 60 + 30); fr.append('FV,07:30:00,23:00:00,900')
viaje('CORTO', 'LAB', 0, [('E2a', 0), ('E3a', 17)], 8 * 60)                            # uno que no hace el recorrido entero
escribe('trips.txt', t); escribe('stop_times.txt', st); escribe('frequencies.txt', fr)
out = f'{T}/metro.js'
r = subprocess.run(['python3', '-I', R + 'scripts/metro_a_datos.py', T, out], capture_output=True, text=True)
if r.returncode: print(r.stdout, r.stderr[-1500:]); raise SystemExit(1)
txt = open(out, encoding='utf8').read(); M = json.loads(txt[txt.index('{'):txt.rindex('}') + 1])
assert len(M['estaciones']) == 5, M['estaciones']                 # andenes juntados en su estación
assert M['linea']['color'] == '#0F9D58'
seq1 = [c for c, l, s, o in sorted(M['recorridos'], key=lambda x: (x[2], x[3])) if s == 1]
nombres = {e['codigo']: e['nombre'] for e in M['estaciones']}
assert [nombres[c] for c in seq1] == ['Ciudad Expo', 'Cavaleri', 'San Bernardo', 'Nervión', 'Olivar de Quintos'], seq1
h = M['horarios']; e = h['l']['M1|1']
assert e['m'] == [0, 3, 20, 23, 40], e['m']
g_lab, g_fin = h['dias']['mar'], h['dias']['sab']
assert g_lab != g_fin
sal, s0 = [], 0
for x in e['v'][g_lab]: s0 += x if isinstance(x, int) else x[0]; sal.append((s0, x if isinstance(x, list) else None))
completos = [s for s, x in sal if x is None]
assert completos[0] == 390 and completos[1] == 400 and completos[-1] == 1380, completos[:3]   # 06:30, 06:40 … 23:00
corto = [x for s, x in sal if x is not None]
assert corto and corto[0][1:] == [1, 2], corto                       # Cavaleri → San Bernardo
print('OK metro:', M['linea']['nombre'], len(M['estaciones']), 'estaciones,', len(e['v'][g_lab]), 'trenes un laborable,', len(e['v'][g_fin]), 'un sábado')
