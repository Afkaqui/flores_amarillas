# Flores Amarillas · Un jardín para ti

Un jardín 3D para sembrar flores, escribir una carta y compartir un regalo sin crear una cuenta.

## Experiencia

- Portada con cielo azul, prado verde y flores amarillas. Interfaz marfil, verde y rosa.
- Creador en tres pasos: para quién, su ramo, tu carta. Vista previa y borrador automático.
- Sobre personalizado para quien recibe; música activada por defecto y botón para silenciar. Si el navegador bloquea el inicio automático, se reintenta en el primer gesto.
- Dibujos adjuntos a la carta (hasta seis), paleta de cinco colores, plantillas de flor/corazón/destello, trazos suaves, edición, deshacer y dedicatorias.
- Detalles de la carta con dibujos, fotos, voz y respuesta opcional del destinatario.
- Tres fotos opcionales con dedicatoria, procesadas a WebP y mostradas completas; voz hasta 30 segundos con reproductor propio, normalizada a Ogg.
- Tu cómplice ofrece tres alternativas visuales de carta y estilo con acciones contextuales para afinarlas mediante GLM-5.3-Flash en OpenCode Go. Aplicar, descartar y deshacer; una propuesta tardía no sobrescribe ediciones nuevas.
- Gestión del regalo mediante un token independiente, guardado en el dispositivo del creador. Eliminar retira sus archivos salvo que los use otro regalo guardado.
- Cinta rosa, miel o lavanda; papel marfil, rosa o kraft; entre 3 y 24 flores.
- Tarde de sol o noche con luciérnagas. Ocasión personalizable.
- Carta de hasta 360 caracteres y tres pequeñas razones de hasta 60 caracteres, descubribles desde las flores y los botones de la carta.
- Compartir opcional por WhatsApp con mensaje editable y enlace listo, compartir nativo cuando está disponible, copiar enlace y respaldo manual. WhatsApp elige la apertura en app/web; la persona selecciona el contacto y confirma el envío. No se accede a sus contactos ni se envían mensajes automáticamente.
- Postal PNG de 1200 px de ancho y altura adaptable, con el estilo de la carta: fondo marfil, texto a la izquierda, firma manuscrita y dibujos en notas con cinta. Incluye razones, fotos completas con sus frases y el enlace para escuchar la voz. No es una captura de la escena 3D.
- Releer, plegar la carta, editar y repetir la sorpresa. El destinatario puede crear un regalo nuevo.
- Jardín y borrador guardados en este dispositivo; máximo 100 flores sembradas.
- Controles de música y cámara disponibles también para quien recibe. Movimiento reducido, foco de modales y carta desplazable en pantallas pequeñas.

## Desarrollo

El frontend no requiere build. Three.js 0.170 y anime.js 3.2.2 se cargan desde un importmap; las fuentes vienen de Google Fonts.

```sh
python3 -m http.server 5180 --bind 127.0.0.1
```

En modo estático los regalos de texto usan enlaces con hash; los dibujos que excedan el tamaño de URL, los archivos, respuestas y el asistente necesitan backend. No se comparten enlaces incompletos. Para enlaces cortos y vistas previas hace falta el servidor con PostgreSQL.

```sh
npm ci --prefix server
# Preparar server/public con index.html y las carpetas css/, js/ y shared/.
# También se puede indicar una carpeta de assets mediante STATIC_ROOT.
node server/scripts/setup-metrics.mjs .env
DATABASE_URL=postgresql://... PORT=3000 ORIGEN=http://localhost:3000 node --env-file=.env server/index.js
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
| `shared/bouquet.js`                               | Ilustración determinista del ramo para editor y vista previa       |
| `server/index.js`, `server/db.js`, `server/og.js` | API, PostgreSQL y OpenGraph                                                |

## Datos y compatibilidad

Los enlaces `/r/:id` guardan el regalo en PostgreSQL e incluyen sus datos en el HTML. Los enlaces `#r=...` incluyen los datos en la URL y funcionan sin servidor. La normalización acepta los campos abreviados de enlaces antiguos.

Las migraciones añaden sesiones anónimas, medios, respuestas y uso del agente. El identificador de sesión se guarda como hash; la cookie HttpOnly dura 90 días para recuperar propiedad de archivos tras reinicios. Las conversaciones se conservan en memoria hasta 24 horas y se pierden al reiniciar. Las sesiones de distintos visitantes no se mezclan.

La tabla existente se conserva. El arranque añade de forma idempotente la columna `detalles jsonb` para cinta, papel, ambiente, ocasión, recuerdos y semilla. Las filas antiguas reciben valores predeterminados. No se publican la dedicatoria ni los recuerdos en OpenGraph.

El enlace es la forma de acceso al regalo: quien lo tenga puede abrirlo. No hay seguimiento visible del destinatario ni notificaciones a terceros.

## Estabilidad de las animaciones

El crecimiento pertenece al bucle de render y usa un tiempo absoluto. Al finalizar se retira su estado de animación antes de fijar la flor abierta, de modo que una actualización tardía no puede volver a cerrarla. El editor mantiene quieta la escena; se anima su panel y no un desenfoque de pantalla completa sobre WebGL. Se mantiene la cadena simple RenderPass → Bloom → OutputPass.

El ajuste de movimiento reducido evita vuelos de cámara, caída de pétalos y escritura progresiva. La cantidad de pasto, la resolución y las sombras se adaptan al dispositivo. Las geometrías y materiales exclusivos de cada envoltura se liberan al reemplazarla.

## Pruebas

```sh
node --test tests/gift.test.mjs tests/og.test.mjs tests/v2.test.mjs tests/render-quality.test.mjs tests/sharing.test.mjs
node server/seguro.test.mjs
# Usar exclusivamente una base de pruebas:
DATABASE_URL=postgresql://... FLORES_TEST_DB=1 node --env-file=.env --test tests/database.test.mjs tests/api.test.mjs tests/metrics.test.mjs tests/metrics-security.test.mjs
```

Se comprueban compatibilidad, Unicode, validación, enlace de respaldo ante error/timeout, privacidad y rasterización de OpenGraph, persistencia en PostgreSQL y escapes HTML/JSON. La prueba de base elimina únicamente las filas con IDs aleatorios que ella misma crea.

## Despliegue

`Dockerfile` construye un servicio Node + Express que sirve frontend y API. Usa el lockfile para instalar dependencias. `docker-compose.yml` conecta este servicio a PostgreSQL y publica el puerto en la interfaz definida por `BIND_IP`. Configurar los valores privados desde `.env`; nunca incluirlos en el repositorio.

El script existente `deploy/desplegar.sh` es para el VPS configurado por el propietario. La nueva versión no se despliega automáticamente por arrancar la vista previa local.

## OpenCode Go y archivos

Configurar `OPENCODE_GO_API_KEY` directamente en el `.env` del servidor. El backend llama a `https://opencode.ai/zen/go/v1/chat/completions` con `glm-5.3-flash`, un User-Agent propio y `x-opencode-session`. La clave nunca va al navegador. La documentación de Go orienta su uso a agentes de programación; el propietario debe mantener un uso admitido por su suscripción.

El agente sólo devuelve propuestas de campos permitidos. No tiene herramientas de shell, acceso al código ni control del despliegue. No recibe imágenes, audios o trazos: sólo el texto y las opciones del regalo necesarias para preparar una propuesta.

Límites iniciales: 3 propuestas simultáneas, 30 peticiones por IP al día, 250 globales al día (`AI_DAILY_LIMIT`), respuesta de hasta 2800 tokens y espera de 45 segundos. Los contadores diarios se guardan en PostgreSQL. Son topes de solicitudes, no una garantía de importe exacto de facturación.

`MEDIA_ROOT` señala el almacenamiento persistente; Compose monta el volumen `flores_media` en `/app/media`. Fotos de hasta 10 MB y 40 millones de píxeles; máximo 12 subidas por sesión y 30 por IP al día. FFmpeg procesa voz y limita su duración a 30 segundos. Los archivos sin referencias se limpian después de 24 horas; la limpieza se ejecuta cada hora. Los regalos compartidos no caducan automáticamente.

Respaldar PostgreSQL y el volumen de medios. Verificar la restauración y guardar una copia fuera del VPS. La imagen anterior permite revertir la aplicación; las migraciones son aditivas.

La escena tiene alternativa ilustrada si falla o se pierde WebGL. La revisión visual se realiza exclusivamente mediante BrowserOS neo según las instrucciones del proyecto.

### Carta y respuestas en la misma vista

La carta muestra palabras, dibujos, fotos, audio y respuestas sin otra pantalla de detalles. El autor puede volver a su último regalo desde el inicio. Las respuestas se actualizan cada 15 segundos mientras la carta está visible, o con el botón de actualizar.

La sesión anónima que crea el regalo queda asociada a él: el servidor rechaza que esa sesión responda. El destinatario firma con un apodo de hasta 28 caracteres, recordado en su navegador; la firma y la respuesta se guardan con el regalo y son visibles a quienes tienen el enlace. Es una separación de sesiones, no una verificación de identidad entre dispositivos. La sesión y el token local de gestión permiten reconocer al autor al volver; perder ambos impide recuperar esa identificación sin un sistema de cuentas.

El asistente muestra una espera animada y tres tarjetas con entrada escalonada. Elegir una añade un mensaje a la conversación y abre un texto editable antes de aplicarlo. Las consultas posteriores reciben esa selección editada; cancelar o fallar conserva el borrador de la opción. Se respeta movimiento reducido. La eliminación usa una confirmación dentro de la carta.

## Métricas propias

El backend registra actividad y volumen en PostgreSQL: visitas, pasos del creador, regalos, aperturas, respuestas, postales, asistente, subidas, peticiones, errores y tiempos. No utiliza un servicio externo ni incorpora textos, nombres o archivos en las métricas.

La web abre las flores directamente en `/`. Sólo `/metrics` pide `METRICS_ADMIN_KEY`, generada en tu `.env` local: no hay acceso anónimo a datos ni exportaciones. En la vista previa, usa `http://127.0.0.1:5183/metrics`. El generador prepara la clave sin mostrarla y no sustituye la existente. Sin una clave configurada se bloquea únicamente `/metrics`; el jardín sigue funcionando. Incluye periodos, cierre de sesión y descarga JSON. Consulta [la guía de métricas](docs/METRICAS.md) para definiciones, límites y consulta por CLI.

## Rendimiento móvil y compartir (septiembre de 2026)

El perfil ligero se activa por pantalla pequeña, puntero táctil, memoria de hasta 4 GB, hasta cuatro hilos o ahorro de datos. Usa 1.800 hojas de pasto, terreno simplificado, 24 flores de fondo y 30 FPS como máximo, sin sombras dinámicas ni bloom. El ramo conserva sus flores y animación. Las flores del fondo se combinan por material y permanecen quietas. Tras 90 muestras lentas se reduce la resolución progresivamente hasta 0,65; las pausas del editor y las pestañas ocultas no cuentan como lentitud. No se cambia la calidad hacia arriba y abajo continuamente.

Revisión local con BrowserOS, escena inicial de 16 flores y viewport móvil de 390 × 844 (no un teléfono físico): 2.079 → 512 llamadas de dibujo y 254.316 → 101.210 triángulos por fotograma, comparando con 5fa6e90. En escritorio: 3.784 → 1.126 llamadas. Son presupuestos gráficos medidos, no una garantía de FPS ni de rendimiento en todos los OPPO. El equipo reportado es un OPPO A58 con Chrome; pendiente prueba física en ese teléfono. Las [especificaciones del A58 CPH2577](https://www.oppo.com/en/smartphones/series-a/a58/specs/) indican Helio G85, GPU Mali-G52 MC2 y pantalla 2400 × 1080; el perfil ligero no depende de que sus ocho núcleos aparenten potencia de escritorio.

La opción de WhatsApp usa el [enlace universal documentado](https://faq.whatsapp.com/425247423114725/), sin un SDK adicional. El mensaje no incluye el cuerpo de la carta. Los regalos con respuestas o archivos esperan a tener un enlace persistido antes de compartir. El contador privado `whatsapp_opened` mide clics, nunca entregas ni lecturas de WhatsApp.
