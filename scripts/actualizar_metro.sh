#!/usr/bin/env bash
# Descarga el GTFS oficial del Metro de Sevilla (Punto de Acceso Nacional) y regenera www/metro.js.
# Si no se puede, se queda el que ya hay (o la app funciona sin metro). Nunca hace fallar la compilación.
set -u
cd "$(dirname "$0")/.."
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
URL="https://nap.transportes.gob.es/api/Fichero/download/1583"
cab=()
if [ -n "${NAP_API_KEY:-}" ]; then cab=(-H "ApiKey: ${NAP_API_KEY}"); fi
echo "Descargando el horario del Metro de Sevilla…"
if curl -fsSL --max-time 120 --retry 2 "${cab[@]}" -o "$TMP/metro.zip" "$URL" \
   && [ "$(head -c 2 "$TMP/metro.zip")" = "PK" ] \
   && unzip -q -o "$TMP/metro.zip" -d "$TMP/g"; then
  G="$TMP/g"; [ -f "$G/stops.txt" ] || G="$(dirname "$(find "$TMP/g" -name stops.txt | head -1)")"
  if python3 scripts/metro_a_datos.py "$G" "$TMP/metro.js"; then
    cp "$TMP/metro.js" www/metro.js
    echo "www/metro.js actualizado."
  else
    echo "No se ha podido convertir el horario del metro: se queda el anterior."
  fi
else
  echo "No se ha podido descargar el horario del metro: se queda el anterior."
fi
exit 0
