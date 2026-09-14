# Flores Amarillas · 21 de Septiembre

Maqueta de una web/juego: siembras tu propio jardín en 3D, armas un ramo de
flores amarillas y lo regalas con un mensaje — todo por un enlace, sin backend.

## Cómo correrlo

El front no tiene build: three.js y anime.js entran por importmap desde
jsDelivr. Para maquetar alcanza con un servidor estático (hace falta uno porque
son módulos ES):

```bash
python -m http.server 5180
```

Así funciona todo menos los enlaces cortos, que caen al respaldo con hash. Para
levantar también la API hace falta Postgres y:

```bash
cd server && npm install && DATABASE_URL=postgresql://... node index.js
```

## Estructura

```
index.html          markup de todas las capas (intro, HUD, modales, tarjeta)
css/styles.css      paleta, glassmorphism, tipografía, responsive
js/main.js          máquina de estados y todo el cableado de la UI
js/garden.js        escena three.js: cielo, terreno, pasto, polen, mariposas, ramo
js/flower.js        geometría procedural de la flor + animación de crecimiento
js/ui.js            helpers de anime.js (títulos, pétalos, toast, máquina de escribir)
js/share.js         enlaces del regalo: enlace corto contra la API, hash de respaldo
js/bichos.js        abejas y mariposas: vuelo, aleteo y visitas a las flores
js/audio.js         música de fondo con el reproductor de YouTube (iframe invisible)

server/index.js     Express: API, /r/:id con OpenGraph y los estáticos
server/db.js        Postgres: esquema y consultas
server/og.js        la imagen de vista previa (SVG -> PNG con sharp)
server/seguro.js    escapes para meter texto ajeno en HTML y en un <script>

Dockerfile          imagen de producción (Node + tipografías para sharp)
docker-compose.yml  puerto en la pasarela de Docker + red de postgres
deploy/desplegar.sh sube, reconstruye y comprueba
```

## Cómo funciona el regalo

Hay dos caminos, y ninguno pide cuenta de usuario: el enlace secreto *es* la
credencial.

**Enlace corto (el normal).** Al armar el ramo, el navegador manda el regalo a
`POST /api/regalos` y recibe `amarillas.pascare.tech/r/ab12cd`. Cuando alguien
comparte ese enlace, el servidor devuelve la página con etiquetas OpenGraph
propias de ese ramo — "Para Lucía", "Andrés te mandó flores amarillas" y una
imagen 1200x630 generada al vuelo — que es lo único que lee el robot de
WhatsApp, porque no ejecuta JavaScript. El mensaje **no** va en la vista
previa: es para quien abre, no para el grupo donde se pega el enlace.

**Hash (respaldo).** `#r=eyJwIjoi…` lleva el regalo entero dentro de la URL, sin
servidor. Se usa si la API falla, y mantiene vivos los enlaces repartidos antes
de que existiera el backend. Su límite es justamente la vista previa: el hash
nunca llega al servidor, así que WhatsApp no puede personalizarla.

En los dos casos, quien abre ve la pantalla "alguien te mandó flores", el ramo
crece desde el suelo y la dedicatoria se escribe sola.

## Servidor (`server/`)

Node + Express en un solo contenedor que sirve también los estáticos, así
nginx_proxy sigue viendo un único puerto.

| Ruta | Qué hace |
|---|---|
| `POST /api/regalos` | guarda el ramo y devuelve `{id, url}` |
| `GET /api/regalos/:id` | datos del ramo; cuenta la apertura |
| `GET /r/:id` | la página con las etiquetas OpenGraph de ese ramo |
| `GET /og/:id.png` | imagen de vista previa, SVG rasterizado con sharp |
| `GET /og/portada.png` | la misma estampa sin destinatario |
| `GET /salud` | para las comprobaciones del despliegue |

- Base `flores_db` en el `postgres_db` del VPS, con usuario propio `flores_app`
  (no se reusa el `admin` compartido). Una tabla, `regalos`.
- Freno anti-spam: 40 ramos por hora y por IP (`TOPE_POR_HORA`).
- Todo lo que escribe la gente pasa por `server/seguro.js` antes de entrar al
  HTML: escapes para las etiquetas meta y para el `<script>` que lleva el
  regalo — incluidos U+2028/U+2029, que en JavaScript son saltos de línea de
  verdad y partirían el script en dos. `node server/seguro.test.mjs` lo
  comprueba con un mensaje que intenta cerrar la etiqueta.

## Escena 3D

- Cielo con shader de gradiente + disco solar aditivo.
- Terreno de 160×160 con relieve por función (`alturaTerreno`), que también
  posiciona pasto, arbustos y flores.
- 26 000 briznas de pasto en un `InstancedMesh`, con vaivén de viento en el
  vertex shader (`onBeforeCompile` + atributo `aRand` por instancia).
- Flor procedural: tallo `TubeGeometry` sobre una curva Catmull-Rom, dos
  anillos de pétalos con pivotes (`setGrowth(0→1)` abre la corola), hojas y
  centro. Cada flor tiene su semilla, así que ninguna es igual a otra.
- Arbustos hechos de varios lóbulos chicos con ruido y color por vértice, más
  ~1000 hojas sueltas en un solo `InstancedMesh` orientadas hacia afuera de
  cada lóbulo (una sola llamada de dibujo para todas).
- Abejas y mariposas con una misma base de navegación: eligen una flor abierta,
  vuelan hacia ella con aceleración y rozamiento (más una deriva senoidal para
  que nadie vaya en línea recta) y se orientan hacia su propia velocidad. La
  abeja orbita la corola unos segundos y cambia de flor; la mariposa a veces se
  posa y abre y cierra las alas despacio. El cuerpo rayado de la abeja es una
  textura de canvas sobre una cápsula.
- Polen en `Points` con shader propio, nubes low-poly a la deriva y bloom suave
  (`UnrealBloomPass`).

## Vista fija

La cámara gira sola despacio mientras miras el jardín. El botón 📌 del HUD (o
la tecla **F**) la deja quieta; arrastrar y hacer zoom siguen funcionando. La
preferencia queda en `localStorage`, así que se respeta al volver.

Por dentro hay dos banderas: `_rotarDeseado` es lo que pide el flujo de la app
(entrar al jardín enciende el giro, armar el ramo lo apaga) y `vistaFijada` es
lo que pidió la persona. `_aplicarRotacion()` las combina y la segunda manda,
así que ningún paso del flujo puede volver a encender el giro a tus espaldas.

## Música

Suena el video de YouTube `S7gMzYqXIZc` en bucle, desde un iframe de 1×1 px.
El navegador no deja arrancar audio sin un gesto del usuario, así que la
música empieza en el click de "Entrar al jardín" o "Abrir el ramo", y el botón
♪ del HUD la pausa y la reanuda. Si el video quedara sin permiso de embebido,
el botón se deshabilita solo y el resto sigue funcionando.

## Despliegue (VPS pascare)

En producción es un contenedor `nginx:alpine` que sirve los archivos tal cual —
no hay build ni Node en el servidor.

Los datos del servidor no están en el repositorio. Antes del primer despliegue:

```bash
cp deploy/servidor.local.example deploy/servidor.local   # y completar VPS=usuario@servidor
bash deploy/desplegar.sh                                 # sube, reconstruye y comprueba
```

| Pieza | Valor |
|---|---|
| Carpeta en el VPS | `~/flores-amarillas/` |
| Contenedor | `flores_amarillas` |
| Puerto | `10.200.0.1:3061` (sólo la pasarela de Docker, no internet) |
| Base de datos | `flores_db` en `postgres_db`, usuario `flores_app` |
| Sitio nginx | `~/nginx/conf.d/amarillas.conf`, creado con `kaqui-sites` |
| Certificado | `pascare.crt` (Cloudflare Origin `*.pascare.tech`, vence 2041) |
| Dominio | https://amarillas.pascare.tech |

Reglas del VPS que aplican acá (están en `~/GUIA_VPS.md` del servidor):

- El puerto se publica en `${BIND_IP}` (la pasarela `10.200.0.1`), nunca en
  `0.0.0.0`: así el sitio sólo se alcanza por nginx_proxy y Cloudflare.
- Las comprobaciones de salud van contra `10.200.0.1:3061`, **no** contra
  `localhost` — desde el host no responde, y es correcto que no responda.
- El `.conf` de nginx no se edita a mano: se crea y se recarga con
  `kaqui-sites`.
- Es un VPS compartido (~43 contenedores de ~12 proyectos): nunca operar sobre
  todos los contenedores ni reiniciar el demonio de Docker. `docker compose up -d`
  dentro de `~/flores-amarillas/` sólo toca este servicio.

## Notas para la siguiente pasada

- Un pluck al sembrar, además de la música.
- Guardar el jardín en `localStorage` para que no se pierda al recargar.
- La imagen de vista previa podría mostrar el ramo real (tantas flores como
  tiene el regalo, con sus colores) en vez de una estampa fija.
- Modo "atardecer" (paleta cálida) como variante.
- Al desplegar: cualquier hosting estático sirve (Netlify, Vercel, Nginx en el
  VPS). Ojo con que el hash del regalo no se pierda en redirecciones.

## Detalles técnicos que conviene recordar

- Los bichos necesitan siempre una salida: al llegar al destino eligen otro, y
  además cada uno lleva un `rumbo` con vencimiento por si nunca llega (la flor
  desapareció, el destino quedó inalcanzable). Sin eso se quedaban orbitando
  un punto para siempre.
- El alabeo al girar se aplica sobre una orientación recalculada de cero cada
  cuadro (`mirarAdelante`), nunca sumándolo a la rotación anterior: al frenarse,
  el bicho seguía girando solo.
- **Las rutas de los assets van absolutas** (`/css/styles.css`, `/js/main.js`).
  Con rutas relativas, al abrir un regalo en `/r/ab12cd` el navegador las pide
  como `/r/css/...`; el comodín del servidor respondía el `index.html`, el
  navegador descartaba el CSS por venir con tipo `text/html` y la página salía
  desnuda y sin escena. Ahora ese comodín devuelve 404 a todo lo que parezca un
  archivo: un fallo ruidoso en vez de uno callado.
- Comprobar el despliegue mirando sólo el código HTTP no alcanza — un 200 puede
  ser el `index.html` disfrazado de hoja de estilos. `deploy/desplegar.sh`
  compara también el `content_type` y pide una ruta huérfana esperando un 404.
- `anime.remove()` deja el motor de anime.js en un estado raro en esta versión;
  para cortar un vuelo de cámara se usa un contador de "generación" en
  `Garden.volar()` en vez de cancelar la animación.
- anime.js pausa todo cuando la pestaña se oculta y a veces no reanuda al
  volver: la promesa `finished` no resuelve y el flujo queda trabado. Por eso
  `main.js` pone `anime.suspendWhenDocumentHidden = false` y cada espera de UI
  corre contra un `setTimeout` de respaldo (`corre()` en `ui.js`).
