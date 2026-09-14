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
COPYFILE_DISABLE=1 tar --no-xattrs -czf - --exclude=server/node_modules --exclude=server/media \
  index.html css js shared server Dockerfile docker-compose.yml .dockerignore README.md \
  | ssh "$VPS" "mkdir -p ~/$DIR && tar xzf - -C ~/$DIR"

echo "-> construyendo la imagen"
ssh "$VPS" "cd ~/$DIR && docker compose build > .deploy-build.log 2>&1"

echo "-> actualizando únicamente Flores Amarillas"
ssh "$VPS" "cd ~/$DIR && docker compose up -d --no-deps flores-amarillas"

echo "Construcción y actualización terminadas. Verificar salud, portada y un regalo mediante BrowserOS neo."
echo "https://$DOMINIO"
