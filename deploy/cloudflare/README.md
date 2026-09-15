# Flores para ti: Cloudflare Tunnel

`floresparati.site` y `www.floresparati.site` usan el túnel
`floresparati-vps-kaqui`. El segundo nombre redirige al primero. No se publica
ningún puerto del gateway ni del túnel. El certificado de administración no se
monta en contenedores: sólo la credencial específica de este túnel, en lectura.

En el VPS, estos archivos viven en `/home/kaqui/flores-edge/`. Su `.env` privado
contiene únicamente `TUNNEL_CREDENTIAL_FILE` con la ruta a la credencial que
cloudflared generó directamente en ese VPS. Nunca incluir certificados,
credenciales o tokens en Git. La aplicación conserva PostgreSQL y su volumen.

```sh
cd /home/kaqui/flores-edge
docker compose config --quiet
docker compose run --rm --no-deps gateway -t
docker compose up -d
docker compose ps
docker logs --tail 20 flores_tunnel
```

La configuración fuerza HTTPS, impide embeber la página en otro sitio, añade
cabeceras de seguridad y conserva la grabación de voz. Límites de peticiones,
conexiones, tiempo y tamaño se aplican antes del backend, además de sus límites
por operación. Las imágenes están fijadas por digest; contenedores sin
capacidades Linux, con usuario 1000 y raíz de sólo lectura. El VPS rechaza
`exec` con `no-new-privileges` incluso en contenedores de prueba sin red;
esa opción queda pendiente de corregir en el runtime del host, sin modificar
la configuración global de los demás servicios.
La API de métricas sigue exigiendo la clave; no publicar el puerto 2000.

El `.env` de la aplicación usa `ORIGEN=https://floresparati.site` y
`LEGACY_ORIGINS=https://amarillas.pascare.tech` para conservar los regalos del
dominio anterior. Los datos locales del navegador no se transfieren entre
dominios: para gestionar un regalo anterior, conservar su enlace original.

Administración en ambos equipos: `~/.local/bin/cloudflared-flores list` y
`~/.local/bin/cloudflared-flores route dns floresparati-vps-kaqui <hostname>`.
Un nuevo hostname también necesita una regla de ingreso y un destino explícito;
el resto devuelve 404. `cloudflared-eduardo` usa una autorización separada y no
forma parte de este despliegue.

Los certificados de cloudflared permiten administrar túneles y rutas DNS;
no conceden permisos de configuración general de SSL/WAF. Esos ajustes
requieren el panel o un token específico con permisos limitados.

Referencias: [túneles locales](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/create-local-tunnel/)
y [cabeceras de Cloudflare](https://developers.cloudflare.com/fundamentals/reference/http-headers/).
