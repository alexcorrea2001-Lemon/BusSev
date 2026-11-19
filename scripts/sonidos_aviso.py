#!/usr/bin/env python3
"""Genera los sonidos del aviso de llegada (android/app/src/main/res/raw/aviso_*.ogg).

Son sonidos sintetizados aquí mismo (sin grabaciones de nadie), y cada uno se repite 3 veces
para que se oiga bien aunque el móvil esté en el bolsillo.
  campana -> «Campanas»: tres toques de campana tubular, con su reverberación
  bocina  -> «Ding-dong»: el timbre de dos notas, como de vibráfono
  suave   -> «Marimba»: un arpegio corto y alegre
  pitido  -> «Estación»: el aviso de tres notas de los andenes
Uso: python3 scripts/sonidos_aviso.py   (necesita numpy y ffmpeg)
"""
import pathlib
import subprocess
import tempfile
import wave

import numpy as np

RAIZ = pathlib.Path(__file__).resolve().parent.parent
RAW = RAIZ / 'android/app/src/main/res/raw'
SR = 32000


def nota(n):
    """Frecuencia de una nota: 'C5', 'G#4'…"""
    nombres = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}
    k, o = n[:-1], int(n[-1])
    return 440.0 * 2 ** ((nombres[k] + 12 * (o + 1) - 69) / 12)


def tono(f, dur, parciales, ataque=0.004, trem=0.0):
    """Suma de parciales (proporción, volumen, caída en s) con un ataque suave."""
    t = np.arange(int(SR * dur)) / SR
    s = np.zeros_like(t)
    for r, a, dec in parciales:
        if f * r < SR / 2 - 500:
            s += a * np.sin(2 * np.pi * f * r * t + r) * np.exp(-t / dec)
    s *= np.minimum(1, t / ataque)
    if trem:
        s *= 1 - 0.18 * (0.5 - 0.5 * np.cos(2 * np.pi * trem * t))
    return s


def reverb(x, tiempo=1.2, mezcla=0.22):
    """Reverberación suave (ruido que se apaga, como una sala), para que no suene «seco»."""
    rng = np.random.default_rng(7)
    n = int(tiempo * SR)
    t = np.arange(n) / SR
    ir = rng.standard_normal(n) * np.exp(-6.9 * t / tiempo)
    ir = np.convolve(ir, np.ones(8) / 8, mode='same')     # más oscura
    ir /= np.sqrt(np.sum(ir ** 2))
    mojado = np.fft.irfft(np.fft.rfft(x, len(x) + n) * np.fft.rfft(ir, len(x) + n))[:len(x) + n]
    seco = np.concatenate([x, np.zeros(n)])
    return seco + mezcla * mojado * (np.max(np.abs(x)) / (np.max(np.abs(mojado)) + 1e-9))


def mezclar(eventos, total):
    out = np.zeros(int(SR * total))
    for ini, s in eventos:
        i = int(ini * SR)
        n = min(len(s), len(out) - i)
        out[i:i + n] += s[:n]
    return out


def repetir(patron, dur, veces=3, pausa=0.35):
    return [(k * (dur + pausa) + t, s) for k in range(veces) for t, s in patron]


def guardar(nombre, x):
    x = x / (np.max(np.abs(x)) + 1e-9) * 0.89
    cola = int(0.02 * SR)
    x[-cola:] *= np.linspace(1, 0, cola)
    # Se guarda en OGG (Android lo reproduce igual y ocupa 10 veces menos que el WAV); necesita ffmpeg
    with tempfile.NamedTemporaryFile(suffix='.wav') as tmp:
        with wave.open(tmp.name, 'wb') as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes((x * 32767).astype('<i2').tobytes())
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', tmp.name, '-c:a', 'libvorbis', '-q:a', '5', str(RAW / f'aviso_{nombre}.ogg')], check=True)
    print(f'aviso_{nombre}.ogg  {len(x) / SR:.1f} s')


# Campana tubular: parciales inarmónicos típicos de campana
CAMPANA = [(0.5, 0.25, 1.4), (1, 1, 1.6), (1.19, 0.35, 1.0), (1.5, 0.3, 0.9), (2.0, 0.45, 0.8), (2.74, 0.3, 0.55), (3.76, 0.18, 0.4), (5.4, 0.08, 0.25)]
# Vibráfono: fundamental + 4.º parcial, con trémolo suave
VIBRA = [(1, 1, 1.3), (4.0, 0.22, 0.35), (10.0, 0.05, 0.08)]
# Marimba: madera, se apaga rápido
MARIMBA = [(1, 1, 0.45), (3.9, 0.3, 0.09), (9.2, 0.08, 0.03)]
# Carillón de andén: limpio y redondo
ANDEN = [(1, 1, 0.9), (2, 0.25, 0.5), (3, 0.08, 0.3)]


def main():
    RAW.mkdir(parents=True, exist_ok=True)
    # Campanas: tres toques (Sol5 Mi5 Do5) por repetición
    c = [(0.0, tono(nota('G5'), 2.2, CAMPANA)), (0.42, tono(nota('E5'), 2.2, CAMPANA)), (0.84, tono(nota('C5'), 2.4, CAMPANA))]
    guardar('campana', reverb(mezclar(repetir(c, 1.45, 3, 0.25), 6.4)))
    # Ding-dong: Mi5 – Do5
    d = [(0.0, tono(nota('E5'), 1.6, VIBRA, trem=5.5)), (0.5, tono(nota('C5'), 1.9, VIBRA, trem=5.5))]
    guardar('bocina', reverb(mezclar(repetir(d, 1.15, 3, 0.35), 6.0), 1.0, 0.18))
    # Marimba: Do5 Mi5 Sol5 Do6 Sol5
    notas = ['C5', 'E5', 'G5', 'C6', 'G5']
    m = [(i * 0.13, tono(nota(n), 0.9, MARIMBA, ataque=0.002)) for i, n in enumerate(notas)]
    guardar('suave', reverb(mezclar(repetir(m, 0.75, 3, 0.4), 4.6), 0.8, 0.16))
    # Estación: Sol4 Do5 Mi5 (como el aviso de andén)
    e = [(0.0, tono(nota('G4'), 1.2, ANDEN)), (0.3, tono(nota('C5'), 1.2, ANDEN)), (0.6, tono(nota('E5'), 1.5, ANDEN))]
    guardar('pitido', reverb(mezclar(repetir(e, 1.1, 3, 0.35), 5.4), 1.1, 0.2))


if __name__ == '__main__':
    main()
