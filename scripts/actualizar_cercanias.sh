#!/usr/bin/env bash
# Descarga el GTFS oficial de Renfe Cercanías (todo España) y regenera www/cercanias.js solo con el núcleo de Sevilla.
# Si no se puede, se queda el que ya hay (o la app funciona sin Cercanías). Nunca hace fallar la compilación.
set -u
cd "$(dirname "$0")/.."
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
FUENTES=(
  "https://ssl.renfe.com/ftransit/Fichero_CER_FOMENTO/fomento_transit.zip"
  "https://files.mobilitydatabase.org/mdb-2653/latest.zip"
)
for url in "${FUENTES[@]}"; do
  echo "Descargando el horario de Cercanías: $url"
  if curl -fsSL --max-time 180 --retry 2 -o "$TMP/c.zip" "$url" && [ "$(head -c 2 "$TMP/c.zip")" = "PK" ] \
     && rm -rf "$TMP/g" && unzip -q -o "$TMP/c.zip" -d "$TMP/g"; then
    G="$TMP/g"; [ -f "$G/stops.txt" ] || G="$(dirname "$(find "$TMP/g" -name stops.txt | head -1)")"
    if python3 scripts/cercanias_a_datos.py "$G" "$TMP/cercanias.js"; then
      cp "$TMP/cercanias.js" www/cercanias.js
      echo "www/cercanias.js actualizado."
      exit 0
    fi
    echo "  No se ha podido convertir."
  else
    echo "  No se ha podido descargar."
  fi
done
echo "Sin horario nuevo de Cercanías: se queda el anterior."
exit 0
