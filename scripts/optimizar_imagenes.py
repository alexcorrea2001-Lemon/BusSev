"""Reduce las imágenes demasiado grandes de www/img antes de meterlas en el APK.

En la app, los vehículos de fiesta y los escudos se ven pequeños (unos 120 px de alto como mucho), así que una foto
original de 1 MB no aporta nada y solo hace el APK más pesado y lento de descargar. Si alguna imagen pesa más de
LIMITE, se reescala (como mucho ALTO_MAX de alto y ANCHO_MAX de ancho, sin deformarla) y se vuelve a guardar como
WebP. Las que ya son ligeras no se tocan.

Uso: python3 scripts/optimizar_imagenes.py [carpeta]   (por defecto www/img)
Nunca hace fallar la compilación: si algo va mal, avisa y deja la imagen como estaba.
"""
import os, sys

LIMITE = 120 * 1024
ALTO_MAX, ANCHO_MAX = 240, 720

def main(carpeta):
    try:
        from PIL import Image
    except ImportError:
        print('Optimizar imágenes: falta Pillow (pip install pillow); se dejan como están.')
        return
    antes = despues = 0
    tocadas = []
    for raiz, _, archivos in os.walk(carpeta):
        for nombre in sorted(archivos):
            ruta = os.path.join(raiz, nombre)
            if not nombre.lower().endswith(('.webp', '.png', '.jpg', '.jpeg')): continue
            tam = os.path.getsize(ruta)
            if tam <= LIMITE: continue
            try:
                im = Image.open(ruta)
                im.load()
                im = im.convert('RGBA')
                bb = im.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
                if bb: im = im.crop(bb)   # quita el borde transparente sobrante
                esc = min(1.0, ALTO_MAX / im.height, ANCHO_MAX / im.width)
                if esc < 1: im = im.resize((max(1, round(im.width * esc)), max(1, round(im.height * esc))), Image.LANCZOS)
                destino = ruta if nombre.lower().endswith('.webp') else ruta  # se conserva el nombre (la app lo pide así)
                fmt = 'WEBP' if nombre.lower().endswith('.webp') else ('PNG' if nombre.lower().endswith('.png') else 'JPEG')
                tmp = destino + '.tmp'
                if fmt == 'WEBP': im.save(tmp, 'WEBP', quality=86, method=6)
                elif fmt == 'PNG': im.save(tmp, 'PNG', optimize=True)
                else: im.convert('RGB').save(tmp, 'JPEG', quality=86, optimize=True)
                nuevo = os.path.getsize(tmp)
                if nuevo < tam:
                    os.replace(tmp, destino)
                    antes += tam; despues += nuevo
                    tocadas.append(f'  {os.path.relpath(ruta, carpeta)}: {tam // 1024} KB -> {nuevo // 1024} KB ({im.width}x{im.height})')
                else:
                    os.remove(tmp)
            except Exception as e:  # imagen rara: se deja tal cual
                print(f'  {os.path.relpath(ruta, carpeta)}: no se ha podido reducir ({e}); se deja como está.')
    if tocadas:
        print(f'Imágenes reducidas para el APK ({len(tocadas)}): {antes // 1024} KB -> {despues // 1024} KB')
        print('\n'.join(tocadas))
    else:
        print('Imágenes: todas ligeras, no hace falta reducir ninguna.')

if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'www/img')
