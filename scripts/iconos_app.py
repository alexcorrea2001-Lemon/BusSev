#!/usr/bin/env python3
"""Genera los iconos de la app que se pueden elegir en Ajustes (Android: fondo + dibujo adaptativos)
y sus miniaturas para la pantalla de Ajustes (SVG dentro de www/app.js, entre las marcas ICONOS_APP_ARTE).

Todos comparten el mismo autobús (el del icono clásico) para que se reconozcan como BusSev.
Uso: python3 scripts/iconos_app.py
"""
import math
import pathlib
import re

RAIZ = pathlib.Path(__file__).resolve().parent.parent
RES = RAIZ / 'android/app/src/main/res'


def f(v):
    return ('%.2f' % v).rstrip('0').rstrip('.')


def rr(x, y, w, h, r):
    return (f'M{f(x + r)},{f(y)}h{f(w - 2 * r)}a{f(r)},{f(r)} 0 0 1 {f(r)},{f(r)}v{f(h - 2 * r)}a{f(r)},{f(r)} 0 0 1 {f(-r)},{f(r)}'
            f'h{f(-(w - 2 * r))}a{f(r)},{f(r)} 0 0 1 {f(-r)},{f(-r)}v{f(-(h - 2 * r))}a{f(r)},{f(r)} 0 0 1 {f(r)},{f(-r)}z')


def circ(cx, cy, r):
    return f'M{f(cx - r)},{f(cy)}a{f(r)},{f(r)} 0 1 0 {f(2 * r)},0a{f(r)},{f(r)} 0 1 0 {f(-2 * r)},0z'


def anillo(cx, cy, r, g):
    return circ(cx, cy, r) + f'M{f(cx - r + g)},{f(cy)}a{f(r - g)},{f(r - g)} 0 1 1 {f(2 * (r - g))},0a{f(r - g)},{f(r - g)} 0 1 1 {f(-2 * (r - g))},0z'


def rect(x, y, w, h):
    return f'M{f(x)},{f(y)}h{f(w)}v{f(h)}h{f(-w)}z'


def bus(cuerpo, cristal, luces, letrero=None, dx=0, dy=0, s=1.0):
    """El autobús de frente. Devuelve capas (path, color, opacidad)."""
    def T(x, y):
        return 54 + (x - 54) * s + dx, 54 + (y - 54) * s + dy
    def R(x, y, w, h, r):
        X, Y = T(x, y)
        return rr(X, Y, w * s, h * s, r * s)
    def C(x, y, r):
        X, Y = T(x, y)
        return circ(X, Y, r * s)
    capas = [
        (R(37, 75, 7, 8, 2) + R(64, 75, 7, 8, 2), cuerpo, 1),     # ruedas
        (R(33, 27, 42, 50, 8), cuerpo, 1),                          # carrocería
        (R(37.5, 37, 33, 18, 3.5), cristal, 1),                     # parabrisas
        (C(42.5, 66, 3.6) + C(65.5, 66, 3.6), luces, 1),            # faros
    ]
    if letrero:
        capas.append((R(41, 30.5, 26, 4, 2), letrero, 1))           # letrero de destino
    return capas


def lunares(color, paso, r, op=1.0, desfase=True, hueco=None):
    p = ''
    fila = 0
    y = -paso / 2
    while y < 112:
        x = (paso / 2 if (desfase and fila % 2) else 0) - paso / 2
        while x < 112:
            if not hueco or math.hypot(x - 54, y - 54) > hueco:
                p += circ(x, y, r)
            x += paso
        y += paso
        fila += 1
    return (p, color, op)


def estrella(cx, cy, r):
    return (f'M{f(cx)},{f(cy - r)}L{f(cx + r * .28)},{f(cy - r * .28)}L{f(cx + r)},{f(cy)}L{f(cx + r * .28)},{f(cy + r * .28)}'
            f'L{f(cx)},{f(cy + r)}L{f(cx - r * .28)},{f(cy + r * .28)}L{f(cx - r)},{f(cy)}L{f(cx - r * .28)},{f(cy - r * .28)}z')


def flor(cx, cy, r):
    """Flor de cuatro pétalos del azulejo."""
    a, b = r, r * 0.42
    return (f'M{f(cx)},{f(cy - a)}c{f(b)},{f(a * .45)} {f(b)},{f(a * .75)} 0,{f(a)}c{f(-b)},{f(-a * .25)} {f(-b)},{f(-a * .55)} 0,{f(-a)}z'
            f'M{f(cx)},{f(cy + a)}c{f(b)},{f(-a * .45)} {f(b)},{f(-a * .75)} 0,{f(-a)}c{f(-b)},{f(a * .25)} {f(-b)},{f(a * .55)} 0,{f(a)}z'
            f'M{f(cx - a)},{f(cy)}c{f(a * .45)},{f(-b)} {f(a * .75)},{f(-b)} {f(a)},0c{f(-a * .25)},{f(b)} {f(-a * .55)},{f(b)} {f(-a)},0z'
            f'M{f(cx + a)},{f(cy)}c{f(-a * .45)},{f(-b)} {f(-a * .75)},{f(-b)} {f(-a)},0c{f(a * .25)},{f(b)} {f(a * .55)},{f(b)} {f(a)},0z')


TODO = rect(0, 0, 108, 108)

ICONOS = {
    # El clásico es el icono de siempre (mipmap/ic_launcher); aquí solo su miniatura
    'Clasico': {
        'bg': [(TODO, '#D41C2B', 1), (circ(30, 24, 56), '#FFFFFF', .07)],
        'fg': bus('#FFFFFF', '#D41C2B', '#F2A20C'),
    },
    'Noche': {
        'bg': [(TODO, '#0B1533', 1), (circ(54, 120, 70), '#1E3A8A', .55), (circ(54, 120, 48), '#2B4CB0', .35)]
              + [(estrella(x, y, r), '#FFFFFF', .9) for x, y, r in [(30, 32, 2.4), (42, 26, 1.5), (80, 50, 1.6), (27, 52, 1.3), (80, 72, 1.4), (30, 74, 1.7)]]
              + [(circ(74, 33, 7.5), '#FDE68A', 1), (circ(78, 30, 6.6), '#0B1533', 1)],
        'fg': bus('#FACC15', '#1E2A55', '#FFF7D6', '#FFFFFF', dy=4, s=.78) + [
            (circ(47.5, 51, 1.2) + circ(52.5, 51, 1.2) + circ(57.5, 51, 1.2) + circ(62.5, 51, 1.2), '#FDE68A', .9)],
    },
    'Azulejo': {
        'bg': [(TODO, '#F6EFDC', 1)]
              + [(''.join(flor(x, y, 9) for x in range(0, 109, 27) for y in range(0, 109, 27)), '#1D4F9C', 1),
                 (''.join(circ(x, y, 2.4) for x in range(0, 109, 27) for y in range(0, 109, 27)), '#E8A317', 1),
                 (''.join(circ(x + 13.5, y + 13.5, 1.6) for x in range(0, 109, 27) for y in range(0, 109, 27)), '#2F8F5B', 1),
                 (anillo(54, 54, 28, 2.6), '#E8A317', 1), (circ(54, 54, 25.4), '#1D4F9C', 1)],
        'fg': bus('#FFFFFF', '#1D4F9C', '#E8A317', dy=1, s=.66),
    },
    'Feria': {
        'bg': [(TODO, '#C8102E', 1), lunares('#FFFFFF', 15, 3.4, 1, True, 29), (anillo(54, 54, 28, 2.2), '#FFFFFF', 1)],
        'fg': [(circ(54, 54, 24.4), '#FFFFFF', 1)] + bus('#C8102E', '#FFFFFF', '#FFD54A', dy=1, s=.65),
    },
    'SemanaSanta': {
        'bg': [(TODO, '#3A1557', 1), (circ(54, 30, 70), '#5B2A86', .5), (circ(54, 20, 44), '#7A3BA8', .35),
               (anillo(54, 54, 29, 1.3), '#E8C46A', .9), (anillo(54, 54, 26, .7), '#E8C46A', .5)],
        'fg': bus('#E8C46A', '#2E1145', '#FFF4D8', dy=0, s=.7),
    },
    'Giralda': {
        'escala': (.76, 5),
        'bg': [(TODO, '#F28F3B', 1), (rect(0, 0, 108, 40), '#C2496A', 1), (rect(0, 36, 108, 14), '#D86A52', 1),
               (circ(54, 74, 24), '#FFD17A', 1), (circ(54, 74, 17), '#FFE7A8', 1), (rect(0, 86, 108, 22), '#5A2346', 1)],
        'fg': [(rect(46, 46, 16, 44) + rect(47.5, 34, 13, 13) + rect(49.5, 25, 9, 10) + rect(51, 19, 6, 7)
                + 'M51,19q3,-7 6,0z' + rect(53.3, 10, 1.4, 6) + rect(44.5, 45, 19, 2) + rect(46, 33, 16, 1.6) + rect(48.5, 24.2, 11, 1.4), '#3A1D3F', 1),
               ('M54.7,11l4,2.2l-4,1.4z', '#3A1D3F', 1),
               (rect(49, 37, 2, 5) + rect(53, 37, 2, 5) + rect(57, 37, 2, 5) + rect(51, 28, 2, 4) + rect(55, 28, 2, 4), '#FFCF7A', .9),
               (rect(50.5, 56, 2.4, 6) + rect(55.1, 56, 2.4, 6) + rect(50.5, 70, 2.4, 6) + rect(55.1, 70, 2.4, 6), '#FFCF7A', .5)],
    },
    'Verde': {
        'bg': [(TODO, '#0B6E2F', 1)] + [(f'M{x},0h9l-40,108h-9z', '#FFFFFF', .07) for x in range(-10, 160, 26)] + [(circ(54, 54, 26.5), '#0E8A3B', 1)],
        'fg': bus('#FFFFFF', '#0B6E2F', '#FFD54A', dy=1, s=.7),
    },
}


def color_android(c, op):
    a = round(op * 255)
    return f'#{a:02X}{c[1:].upper()}'


def vector(capas, escala=None):
    out = ['<?xml version="1.0" encoding="utf-8"?>',
           '<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">']
    pre = '    '
    if escala:
        k, dy = escala
        out.append(f'    <group android:pivotX="54" android:pivotY="54" android:scaleX="{k}" android:scaleY="{k}" android:translateY="{dy}">')
        pre = '        '
    for p, c, op in capas:
        out.append(f'{pre}<path android:fillColor="{color_android(c, op)}" android:pathData="{p}"/>')
    if escala:
        out.append('    </group>')
    out.append('</vector>\n')
    return '\n'.join(out)


def svg(capas, escala=None):
    s = ''.join(f'<path d="{p}" fill="{c}"{"" if op == 1 else f" fill-opacity={chr(34)}{op}{chr(34)}"}/>' for p, c, op in capas)
    if escala:
        k, dy = escala
        s = f'<g transform="translate(54 {54 + dy}) scale({k}) translate(-54 -54)">{s}</g>'
    return s


def main():
    for k, d in ICONOS.items():
        if k == 'Clasico':
            continue
        n = re.sub(r'(?<!^)(?=[A-Z])', '', k).lower()
        (RES / f'drawable/ic_alt_{n}_bg.xml').write_text(vector(d['bg']))
        (RES / f'drawable/ic_alt_{n}_fg.xml').write_text(vector(d['fg'], d.get('escala')))
    js = 'const ICONOS_APP_ARTE = {\n' + ''.join(f"  {k}: '{svg(d['bg']) + svg(d['fg'], d.get('escala'))}',\n" for k, d in ICONOS.items()) + '};'
    app = RAIZ / 'www/app.js'
    s = app.read_text()
    s = re.sub(r'/\* ICONOS_APP_ARTE:INICIO \*/.*?/\* ICONOS_APP_ARTE:FIN \*/',
               lambda _: '/* ICONOS_APP_ARTE:INICIO */\n' + js + '\n/* ICONOS_APP_ARTE:FIN */', s, flags=re.S)
    app.write_text(s)
    print('Iconos generados:', ', '.join(ICONOS))


if __name__ == '__main__':
    main()
