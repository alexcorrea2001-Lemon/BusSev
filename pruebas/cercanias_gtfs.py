"""Prueba de Cercanías con un GTFS inventado de «toda España»: se quedan solo las líneas de Sevilla."""
import os, subprocess, json, shutil, sys, tempfile, datetime
R = sys.argv[1]
T = os.path.join(os.environ.get('PRUEBAS_TMP') or tempfile.gettempdir(), 'cercanias'); shutil.rmtree(T, ignore_errors=True); os.makedirs(T)
def escribe(nombre, filas):
    # Como el de Renfe: campos con espacios de más
    with open(f'{T}/{nombre}', 'w', encoding='utf8') as f: f.write('\n'.join(','.join(c + '   ' for c in fila.split(',')) for fila in filas) + '\n')
hoy = datetime.date.today(); ini = (hoy - datetime.timedelta(days=30)).strftime('%Y%m%d'); fin = (hoy + datetime.timedelta(days=200)).strftime('%Y%m%d')
escribe('routes.txt', ['route_id,route_short_name,route_long_name,route_type,route_color',
    '30T0001C1,C1,Lora del Río - Utrera,2,78B4E1', '30T0004C4,C4,Circular,2,8B2A8B', '10T0001C1,C1,Madrid C1,2,00AAEE'])
est = {'SJ': ('Sevilla-Santa Justa', 37.3917, -5.9755), 'SB': ('Sevilla-San Bernardo', 37.3780, -5.9806), 'VI': ('Virgen del Rocío', 37.3610, -5.9800),
       'DH': ('Dos Hermanas', 37.2860, -5.9230), 'UT': ('Utrera', 37.1840, -5.7810), 'LO': ('Lora del Río', 37.6580, -5.5270),
       'PA': ('Palacio de Congresos', 37.4040, -5.9350), 'MA': ('Madrid-Atocha', 40.4060, -3.6900), 'CH': ('Madrid-Chamartín', 40.4720, -3.6820)}
escribe('stops.txt', ['stop_id,stop_name,stop_lat,stop_lon'] + [f'{k},{n},{la},{lo}' for k, (n, la, lo) in est.items()])
escribe('calendar.txt', ['service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date', f'LAB,1,1,1,1,1,0,0,{ini},{fin}', f'FES,0,0,0,0,0,1,1,{ini},{fin}'])
t = ['route_id,service_id,trip_id,direction_id']; st = ['trip_id,arrival_time,departure_time,stop_id,stop_sequence']
def viaje(rid, sv, tid, d, paradas, h0):
    t.append(f'{rid},{sv},{tid},{d}')
    for k, (s, mm) in enumerate(paradas):
        x = h0 + mm; hs = f'{int(x // 60):02d}:{int(x % 60):02d}:00'; st.append(f'{tid},{hs},{hs},{s},{k + 1}')
c1 = [('LO', 0), ('SJ', 40), ('SB', 45), ('VI', 50), ('DH', 58), ('UT', 70)]
for i, h in enumerate(range(6 * 60, 22 * 60, 30)):
    viaje('30T0001C1', 'LAB', f'C1i{i}', 0, c1, h)
    viaje('30T0001C1', 'LAB', f'C1v{i}', 1, [(s, 70 - m) for s, m in reversed(c1)], h + 5)
viaje('30T0001C1', 'LAB', 'C1corto', 0, [('SJ', 0), ('SB', 5), ('VI', 10), ('DH', 18)], 7 * 60 + 12)   # uno que empieza en Santa Justa
for i, h in enumerate(range(7 * 60, 21 * 60, 60)):
    viaje('30T0004C4', 'FES', f'C4i{i}', 0, [('SJ', 0), ('PA', 6), ('SB', 14), ('VI', 20)], h)
    viaje('30T0004C4', 'FES', f'C4v{i}', 1, [('VI', 0), ('SB', 6), ('PA', 14), ('SJ', 20)], h)
viaje('10T0001C1', 'LAB', 'MAD1', 0, [('MA', 0), ('CH', 12)], 8 * 60)
escribe('trips.txt', t); escribe('stop_times.txt', st)
out = f'{T}/cercanias.js'
r = subprocess.run(['python3', '-I', R + 'scripts/cercanias_a_datos.py', T, out], capture_output=True, text=True)
if r.returncode: print(r.stdout, r.stderr[-1500:]); raise SystemExit(1)
txt = open(out, encoding='utf8').read(); C = json.loads(txt[txt.index('{'):txt.rindex('}') + 1])
nom = {e['codigo']: e['nombre'] for e in C['estaciones']}
assert sorted(l['etiqueta'] for l in C['lineas']) == ['C1', 'C4'], C['lineas']
assert not any('Madrid' in n for n in nom.values()), 'Madrid no entra'
assert all(l['numero'].startswith('R') for l in C['lineas'])
seq = [nom[c] for c, l, s, o in sorted(C['recorridos'], key=lambda x: (x[1], x[2], x[3])) if l == 'RC1' and s == 1]
assert seq == ['Lora del Río', 'Sevilla-Santa Justa', 'Sevilla-San Bernardo', 'Virgen del Rocío', 'Dos Hermanas', 'Utrera'], seq
e = C['horarios']['l']['RC1|1']
assert e['m'] == [0, 40, 45, 50, 58, 70], e['m']
g = C['horarios']['dias']['mar']
sal, s0 = [], 0
for x in e['v'][g]: s0 += x if isinstance(x, int) else x[0]; sal.append(s0)
assert sal[0] == 360 and 392 in sal, sal[:6]          # 06:00 y el corto (sale de Santa Justa a las 7:12 → «cabecera» 6:32)
print('OK cercanías:', [l['etiqueta'] for l in C['lineas']], len(C['estaciones']), 'estaciones,', len(e['v'][g]), 'trenes C1 un laborable')
