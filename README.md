# Flores Amarillas · Un jardín para ti

Un jardín 3D para sembrar flores, escribir una carta y compartir un regalo sin crear una cuenta.

## Experiencia

- Portada con cielo azul, prado verde y flores amarillas. Interfaz marfil, verde y rosa.
- Sobre personalizado para quien recibe; apertura con música opcional.
- Cinta rosa, miel o lavanda; papel marfil, rosa o kraft; entre 3 y 24 flores.
- Tarde de sol o noche con luciérnagas. Ocasión personalizable.
- Carta de hasta 360 caracteres y tres pequeñas razones de hasta 60 caracteres, descubribles desde las flores y los botones de la carta.
- Compartir nativo cuando está disponible, copiar enlace y respaldo manual.
- Postal ilustrada PNG de 1200 × 1600. La ilustración respeta cantidad, papel y cinta; no es una captura de la escena 3D.
- Releer, plegar la carta, editar y repetir la sorpresa. El destinatario puede crear un regalo nuevo.
- Jardín y borrador guardados en este dispositivo; máximo 100 flores sembradas.
- Controles de música y cámara disponibles también para quien recibe. Movimiento reducido, foco de modales y carta desplazable en pantallas pequeñas.

## Desarrollo

El frontend no requiere build. Three.js 0.170 y anime.js 3.2.2 se cargan desde un importmap; las fuentes vienen de Google Fonts.

```sh
python3 -m http.server 5180 --bind 127.0.0.1
```

En modo estático los regalos usan enlaces con hash; para enlaces cortos y vistas previas hace falta el servidor con PostgreSQL:

```sh
npm ci --prefix server
# Preparar server/public con index.html y las carpetas css/, js/ y shared/.
# También se puede indicar una carpeta de assets mediante STATIC_ROOT.
DATABASE_URL=postgresql://... PORT=3000 ORIGEN=http://localhost:3000 node server/index.js
```

`STATIC_ROOT` solo debe apuntar a la carpeta de assets públicos, no a una carpeta con credenciales. En desarrollo los assets llevan `no-store`; en producción, caché corta con revalidación.

## Archivos

| Archivo                                           | Responsabilidad                                                            |
| ------------------------------------------------- | -------------------------------------------------------------------------- |
| `index.html`, `css/styles.css`                    | Portada, controles, editor, sobre y carta responsive                       |
| `js/main.js`                                      | Flujo del regalo, estado, persistencia y acciones                          |
| `js/garden.js`, `js/flower.js`, `js/bichos.js`    | Jardín y flores procedurales, fauna, iluminación                           |
| `js/ui.js`                                        | Transiciones, modales accesibles y escritura cancelable                    |
| `js/share.js`                                     | Enlaces cortos con timeout y respaldo hash compatible con regalos antiguos |
| `js/postcard.js`                                  | Descarga de la postal ilustrada                                            |
| `js/audio.js`                                     | Música opcional con errores y tiempos máximos de espera                    |
| `shared/gift.js`                                  | Validación compartida entre navegador y API                                |
| `shared/bouquet.js`                               | Ilustración determinista del ramo para editor, postal y vista previa       |
| `server/index.js`, `server/db.js`, `server/og.js` | API, PostgreSQL y OpenGraph                                                |

## Datos y compatibilidad

Los enlaces `/r/:id` guardan el regalo en PostgreSQL e incluyen sus datos en el HTML. Los enlaces `#r=...` incluyen los datos en la URL y funcionan sin servidor. La normalización acepta los campos abreviados de enlaces antiguos.

La tabla existente se conserva. El arranque añade de forma idempotente la columna `detalles jsonb` para cinta, papel, ambiente, ocasión, recuerdos y semilla. Las filas antiguas reciben valores predeterminados. No se publican la dedicatoria ni los recuerdos en OpenGraph.

El enlace es la forma de acceso al regalo: quien lo tenga puede abrirlo. No hay seguimiento visible del destinatario ni notificaciones a terceros.

## Estabilidad de las animaciones

El crecimiento pertenece al bucle de render y usa un tiempo absoluto. Al finalizar se retira su estado de animación antes de fijar la flor abierta, de modo que una actualización tardía no puede volver a cerrarla. El editor mantiene quieta la escena; se anima su panel y no un desenfoque de pantalla completa sobre WebGL. Se mantiene la cadena simple RenderPass → Bloom → OutputPass.

El ajuste de movimiento reducido evita vuelos de cámara, caída de pétalos y escritura progresiva. La cantidad de pasto, la resolución y las sombras se adaptan al dispositivo. Las geometrías y materiales exclusivos de cada envoltura se liberan al reemplazarla.

## Pruebas

```sh
node --test tests/gift.test.mjs tests/og.test.mjs
node server/seguro.test.mjs
# Usar exclusivamente una base de pruebas:
DATABASE_URL=postgresql://... FLORES_TEST_DB=1 node --test tests/database.test.mjs
```

Se comprueban compatibilidad, Unicode, validación, enlace de respaldo ante error/timeout, privacidad y rasterización de OpenGraph, persistencia en PostgreSQL y escapes HTML/JSON. La prueba de base elimina únicamente las filas con IDs aleatorios que ella misma crea.

## Despliegue

`Dockerfile` construye un servicio Node + Express que sirve frontend y API. Usa el lockfile para instalar dependencias. `docker-compose.yml` conecta este servicio a PostgreSQL y publica el puerto en la interfaz definida por `BIND_IP`. Configurar los valores privados desde `.env`; nunca incluirlos en el repositorio.

El script existente `deploy/desplegar.sh` es para el VPS configurado por el propietario. La nueva versión no se despliega automáticamente por arrancar la vista previa local.
