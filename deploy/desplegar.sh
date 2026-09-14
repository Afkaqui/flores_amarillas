#!/usr/bin/env bash
# Sube el sitio al VPS y rehace el contenedor. Se corre desde la máquina local:
#   VPS=usuario@servidor bash deploy/desplegar.sh
#
# Los datos del servidor no viven en el repositorio (es público). Ponlos en
# deploy/servidor.local, que está ignorado por git:
#   VPS=usuario@servidor
#   DOMINIO=amarillas.pascare.tech
set -euo pipefail

cd "$(dirname "$0")/.."

# shellcheck source=/dev/null
[ -f deploy/servidor.local ] && . deploy/servidor.local

VPS="${VPS:-}"
if [ -z "$VPS" ]; then
  echo "Falta VPS=usuario@servidor (exportalo o ponlo en deploy/servidor.local)" >&2
  exit 1
fi

DIR="${DIR:-flores-amarillas}"
PASARELA="${PASARELA:-10.200.0.1}"
PUERTO="${PUERTO:-3061}"
DOMINIO="${DOMINIO:-amarillas.pascare.tech}"

echo "-> subiendo archivos a $VPS:~/$DIR"
tar czf - index.html css js server deploy Dockerfile docker-compose.yml .dockerignore README.md \
  | ssh "$VPS" "mkdir -p ~/$DIR && tar xzf - -C ~/$DIR"

echo "-> construyendo la imagen (el sitio sigue arriba mientras tanto)"
ssh "$VPS" "cd ~/$DIR && docker compose build 2>&1 | tail -2"

echo "-> cambiando el contenedor"
# Se construye antes y recién después se recrea: así la caída es de ~1 segundo
# y no de todo lo que tarda el build. Sólo este servicio: nunca tocar
# contenedores ajenos en un VPS compartido.
ssh "$VPS" "cd ~/$DIR && docker compose up -d 2>&1 | tail -2"

echo "-> comprobando"
# OJO: la comprobación local va contra la pasarela de Docker, NO contra
# localhost: el puerto se publica sólo en $PASARELA (ver la guía del VPS).
# La pública se hace desde el propio VPS, para no depender de que la red de
# quien despliega resuelva el dominio.
ssh "$VPS" "
  # Node tarda un segundo en escuchar; se reintenta antes de dar por fallido.
  for i in \$(seq 1 15); do
    codigo=\$(curl -s -o /dev/null -w '%{http_code}' http://$PASARELA:$PUERTO/salud || true)
    [ \"\$codigo\" = '200' ] && break
    sleep 1
  done
  printf 'salud local   %s\n' \"\$codigo\"
  curl -s -o /dev/null -w 'portada       %{http_code}\n' --max-time 20 https://$DOMINIO/
  curl -s -o /dev/null -w 'imagen previa %{http_code}\n' --max-time 20 https://$DOMINIO/og/portada.png

  # Y lo que se rompió una vez: que un regalo sirva su CSS y su JS de verdad,
  # no el index disfrazado. Se mira el tipo de contenido, no sólo el código.
  R=\$(curl -s -X POST https://$DOMINIO/api/regalos -H 'Content-Type: application/json' \
        -d '{\"para\":\"Comprobacion\",\"mensaje\":\"despliegue\",\"de\":\"deploy\",\"flores\":6}')
  ID=\$(echo \"\$R\" | sed -E 's/.*\"id\":\"([^\"]+)\".*/\1/')
  printf 'css desde /r/  %s\n' \"\$(curl -s -o /dev/null -w '%{http_code} %{content_type}' https://$DOMINIO/css/styles.css)\"
  printf 'html del ramo  %s\n' \"\$(curl -s -o /dev/null -w '%{http_code}' https://$DOMINIO/r/\$ID)\"
  printf 'ruta huerfana  %s\n' \"\$(curl -s -o /dev/null -w '%{http_code}' https://$DOMINIO/r/js/main.js)\"
  docker exec postgres_db psql -U admin -d flores_db -c \"DELETE FROM regalos WHERE para = 'Comprobacion';\" > /dev/null 2>&1 || true
"

echo "listo -> https://$DOMINIO"
