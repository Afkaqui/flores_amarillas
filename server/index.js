import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';

import { prepararEsquema, guardarRegalo, leerRegalo, marcarApertura, regalosRecientes } from './db.js';
import { pngDelRegalo, pngDePortada } from './og.js';
import { escaparHtml, jsonEnLinea } from './seguro.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ESTATICOS = path.join(__dirname, 'public');
const PUERTO = Number(process.env.PORT || 3000);
const ORIGEN = process.env.ORIGEN || 'https://amarillas.pascare.tech';
const TOPE_POR_HORA = Number(process.env.TOPE_POR_HORA || 40);

const app = express();
app.disable('x-powered-by');
// Sólo nginx_proxy nos alcanza (el puerto se publica en la pasarela de Docker),
// así que su X-Forwarded-For sí es de fiar.
app.set('trust proxy', 1);
app.use(express.json({ limit: '8kb' }));

/* ============================================================
   Utilidades
   ============================================================ */
const ALFABETO = 'abcdefghijkmnpqrstuvwxyz23456789';   // sin l, o, 0, 1

function nuevoId(largo = 7) {
  const bytes = randomBytes(largo);
  let s = '';
  for (const b of bytes) s += ALFABETO[b % ALFABETO.length];
  return s;
}

const limpiar = (t, max) => String(t ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

const ipDe = (req) => {
  const cf = req.get('cf-connecting-ip');
  const ip = cf || req.ip || '';
  return ip.replace(/^::ffff:/, '') || null;
};

/* ============================================================
   API
   ============================================================ */
app.post('/api/regalos', async (req, res) => {
  const para = limpiar(req.body?.para, 28);
  const mensaje = limpiar(req.body?.mensaje, 180);
  const de = limpiar(req.body?.de, 28);
  const flores = Math.min(24, Math.max(3, parseInt(req.body?.flores, 10) || 12));

  if (!para) return res.status(400).json({ error: 'falta el nombre de quien recibe' });
  if (!mensaje) return res.status(400).json({ error: 'falta el mensaje' });

  const ip = ipDe(req);
  try {
    if ((await regalosRecientes(ip)) >= TOPE_POR_HORA) {
      return res.status(429).json({ error: 'demasiados ramos seguidos, espera un rato' });
    }

    // Reintenta por si el id ya existía (con 32^7 combinaciones es raro).
    for (let intento = 0; intento < 5; intento++) {
      const id = nuevoId();
      try {
        await guardarRegalo({ id, para, mensaje, de, flores, ip });
        return res.status(201).json({ id, url: `${ORIGEN}/r/${id}` });
      } catch (err) {
        if (err.code !== '23505') throw err;   // 23505 = clave duplicada
      }
    }
    res.status(500).json({ error: 'no se pudo generar el enlace' });
  } catch (err) {
    console.error('[POST /api/regalos]', err.message);
    res.status(500).json({ error: 'error guardando el ramo' });
  }
});

app.get('/api/regalos/:id', async (req, res) => {
  try {
    const r = await leerRegalo(req.params.id);
    if (!r) return res.status(404).json({ error: 'ese ramo no existe' });
    marcarApertura(r.id).catch(() => {});
    res.json({ para: r.para, mensaje: r.mensaje, de: r.de, flores: r.flores });
  } catch (err) {
    console.error('[GET /api/regalos]', err.message);
    res.status(500).json({ error: 'error leyendo el ramo' });
  }
});

/* ============================================================
   Imagen de vista previa
   ============================================================ */
app.get('/og/portada.png', async (_req, res) => {
  try {
    const png = await pngDePortada();
    res.type('png');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(png);
  } catch (err) {
    console.error('[GET /og/portada]', err.message);
    res.status(500).end();
  }
});

app.get('/og/:id.png', async (req, res) => {
  try {
    const r = await leerRegalo(req.params.id);
    if (!r) return res.status(404).end();
    const png = await pngDelRegalo(r);
    res.type('png');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(png);
  } catch (err) {
    console.error('[GET /og]', err.message);
    res.status(500).end();
  }
});

/* ============================================================
   /r/:id — el HTML con las etiquetas que lee WhatsApp
   ============================================================ */
let plantilla = null;
async function htmlBase() {
  if (!plantilla || process.env.NODE_ENV !== 'production') {
    plantilla = await readFile(path.join(ESTATICOS, 'index.html'), 'utf8');
  }
  return plantilla;
}

app.get('/r/:id', async (req, res) => {
  let r = null;
  try {
    r = await leerRegalo(req.params.id);
  } catch (err) {
    console.error('[GET /r]', err.message);
  }

  const html = await htmlBase();
  if (!r) {
    // El ramo no existe: que igual cargue el jardín, sin vista previa falsa.
    return res.status(404).send(html);
  }

  const titulo = `Para ${r.para} 🌼`;
  const descripcion = r.de
    ? `${r.de} te mandó flores amarillas. Ábrelas — es 21 de septiembre.`
    : 'Alguien te mandó flores amarillas. Ábrelas — es 21 de septiembre.';
  const url = `${ORIGEN}/r/${r.id}`;
  const imagen = `${ORIGEN}/og/${r.id}.png`;

  // El mensaje NO va en la vista previa: es para quien abre, no para el grupo.
  const meta = `
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Flores Amarillas" />
  <meta property="og:title" content="${escaparHtml(titulo)}" />
  <meta property="og:description" content="${escaparHtml(descripcion)}" />
  <meta property="og:url" content="${escaparHtml(url)}" />
  <meta property="og:image" content="${escaparHtml(imagen)}" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${escaparHtml(titulo)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escaparHtml(titulo)}" />
  <meta name="twitter:description" content="${escaparHtml(descripcion)}" />
  <meta name="twitter:image" content="${escaparHtml(imagen)}" />
  <script>window.__REGALO__ = ${jsonEnLinea({
    para: r.para, mensaje: r.mensaje, de: r.de, flores: r.flores, id: r.id,
  })};</script>`;

  // Se reemplazan las etiquetas genéricas por las de este regalo.
  const salida = html
    // Fuera TODAS las etiquetas por defecto del HTML: si quedan, WhatsApp
    // se queda con la primera og:image que encuentra (la portada genérica)
    // en vez de la de este ramo.
    .replace(/<meta (property="og:|name="twitter:)[^>]*>/g, '')
    .replace('</head>', `${meta}\n</head>`)
    .replace(
      /<title>[^<]*<\/title>/,
      `<title>${escaparHtml(titulo)} · Flores Amarillas</title>`
    );

  res.set('Cache-Control', 'public, max-age=300');
  res.send(salida);
});

/* ============================================================
   Estáticos y salud
   ============================================================ */
app.get('/salud', (_req, res) => res.type('text').send('ok\n'));

app.use(
  express.static(ESTATICOS, {
    etag: true,
    setHeaders(res, ruta) {
      res.set('X-Content-Type-Options', 'nosniff');
      if (ruta.endsWith('index.html')) res.set('Cache-Control', 'no-cache');
      else res.set('Cache-Control', 'public, max-age=300, must-revalidate');
    },
  })
);

/*
 * Cualquier otra ruta cae en el jardín... salvo las que piden un archivo. Si a
 * un .css o .js le devolvemos el index, el navegador lo descarta por el tipo
 * equivocado y la página sale sin estilos y sin escena: un fallo callado y
 * difícil de ver. Mejor un 404 ruidoso.
 */
app.use((req, res) => {
  if (/\.[a-z0-9]{2,5}$/i.test(req.path)) return res.status(404).type('text').send('no existe\n');
  res.sendFile(path.join(ESTATICOS, 'index.html'));
});

/* ============================================================
   Arranque
   ============================================================ */
try {
  await prepararEsquema();
  console.log('[flores] esquema listo');
} catch (err) {
  console.error('[flores] no se pudo preparar la base:', err.message);
  process.exit(1);
}

app.listen(PUERTO, '0.0.0.0', () => {
  console.log(`[flores] escuchando en :${PUERTO} — origen ${ORIGEN}`);
});
