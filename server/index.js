import { createTrafficGuard } from "./traffic.js";
import {
  httpMetrics,
  registerMetricEvents,
  prepareMetrics,
  startMetrics,
  stopMetrics,
} from "./metrics.js";
import {
  createMetricsHandler,
  startMetricsDashboard,
} from "./metrics-admin.js";
import express from "express";
import { normalizeGift } from "../shared/gift.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { giftDocument } from "./seo.js";

import {
  prepararEsquema,
  guardarRegalo,
  leerRegalo,
  marcarApertura,
  regalosRecientes,
} from "./db.js";
import { pngDelRegalo, pngDePortada } from "./og.js";
import {
  registerFeatures,
  prepareFeatures,
  claimMedia,
  attachManagement,
  sessionHash,
} from "./features.js";
import { escaparHtml } from "./seguro.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ESTATICOS = process.env.STATIC_ROOT || path.join(__dirname, "public");
const PUERTO = Number(process.env.PORT || 3000);
const ORIGEN = process.env.ORIGEN || "https://floresparati.site";
const TOPE_POR_HORA = Number(process.env.TOPE_POR_HORA || 40);

const app = express();
app.disable("x-powered-by");
// Los gateways de Nginx suministran la IP del visitante en el último salto.
// El gateway del túnel sustituye cualquier cadena enviada por el cliente.
app.set("trust proxy", 1);
app.use(httpMetrics);
app.use(createTrafficGuard());
app.use((req, res, next) => {
  if (/^\/(r|metrics|api|media)(\/|$)/.test(req.path))
    res.set("X-Robots-Tag", "noindex, nofollow");
  next();
});
app.get("/robots.txt", (_req, res) => res.type("text/plain").send(
  `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /metrics\nDisallow: /media/\nSitemap: ${ORIGEN}/sitemap.xml\n`,
));
app.get("/sitemap.xml", (_req, res) => res.type("application/xml").send(
  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${escaparHtml(ORIGEN)}/</loc></url></urlset>`,
));
try {
  app.use("/metrics", createMetricsHandler({ origin: ORIGEN }));
} catch {
  // Missing admin configuration must never lock visitors out of their flowers.
  app.use("/metrics", (_req, res) =>
    res.status(503).send("Panel privado no configurado."),
  );
}
registerFeatures(app);
registerMetricEvents(app);
app.use(express.json({ limit: "256kb" }));

const ALFABETO = "abcdefghijkmnpqrstuvwxyz23456789"; // sin l, o, 0, 1

function nuevoId(largo = 7) {
  const bytes = randomBytes(largo);
  let s = "";
  for (const b of bytes) s += ALFABETO[b % ALFABETO.length];
  return s;
}

const ipDe = (req) => {
  const ip = req.ip || "";
  return ip.replace(/^::ffff:/, "") || null;
};

app.post("/api/regalos", async (req, res) => {
  const gift = normalizeGift(req.body);
  const { para, mensaje } = gift;

  if (!para)
    return res.status(400).json({ error: "falta el nombre de quien recibe" });
  if (!mensaje) return res.status(400).json({ error: "falta el mensaje" });

  const ip = ipDe(req);
  try {
    if (gift.permitirRespuesta && !(await sessionHash(req)))
      return res.status(401).json({
        error:
          "Abre el creador de nuevo para guardar un regalo con respuestas.",
      });
    await claimMedia(req, gift);
    if ((await regalosRecientes(ip)) >= TOPE_POR_HORA) {
      return res
        .status(429)
        .json({ error: "demasiados ramos seguidos, espera un rato" });
    }

    // Reintenta por si el id ya existía (con 32^7 combinaciones es raro).
    for (let intento = 0; intento < 5; intento++) {
      const id = nuevoId();
      try {
        await guardarRegalo({ ...gift, id, ip });
        const manageToken = randomBytes(24).toString("hex");
        await attachManagement(id, manageToken, req);
        await claimMedia(req, gift, id);
        return res
          .status(201)
          .json({ id, manageToken, url: `${ORIGEN}/r/${id}` });
      } catch (err) {
        if (err.code !== "23505") throw err; // 23505 = clave duplicada
      }
    }
    res.status(500).json({ error: "no se pudo generar el enlace" });
  } catch (err) {
    console.error("[POST /api/regalos]", err.message);
    res.status(500).json({ error: "error guardando el ramo" });
  }
});

app.get("/api/regalos/:id", async (req, res) => {
  try {
    const r = await leerRegalo(req.params.id);
    if (!r) return res.status(404).json({ error: "ese ramo no existe" });
    marcarApertura(r.id).catch(() => {});
    res.json(normalizeGift(r));
  } catch (err) {
    console.error("[GET /api/regalos]", err.message);
    res.status(500).json({ error: "error leyendo el ramo" });
  }
});

let activePreviews = 0;
app.get("/og/portada.png", async (_req, res) => {
  if (activePreviews >= 2) return res.set("Retry-After", "3").status(429).end();
  activePreviews++;
  try {
    const png = await pngDePortada();
    res.type("png");
    res.set("Cache-Control", "public, max-age=86400");
    res.send(png);
  } catch (err) {
    console.error("[GET /og/portada]", err.message);
    res.status(500).end();
  } finally {
    activePreviews--;
  }
});

app.get("/og/:id.png", async (req, res) => {
  if (activePreviews >= 2) return res.set("Retry-After", "3").status(429).end();
  activePreviews++;
  try {
    const r = await leerRegalo(req.params.id);
    if (!r) return res.status(404).end();
    const png = await pngDelRegalo(r);
    res.type("png");
    res.set("Cache-Control", "public, max-age=31536000, immutable");
    res.send(png);
  } catch (err) {
    console.error("[GET /og]", err.message);
    res.status(500).end();
  } finally {
    activePreviews--;
  }
});

let plantilla = null;
async function htmlBase() {
  if (!plantilla || process.env.NODE_ENV !== "production") {
    plantilla = await readFile(path.join(ESTATICOS, "index.html"), "utf8");
  }
  return plantilla;
}

app.get("/r/:id", async (req, res) => {
  let r = null;
  try {
    r = await leerRegalo(req.params.id);
  } catch (err) {
    console.error("[GET /r]", err.message);
  }

  const html = await htmlBase();
  if (!r) {
    // El ramo no existe: que igual cargue el jardín, sin vista previa falsa.
    return res.status(404).send(html);
  }

  const salida = giftDocument(html, r, ORIGEN);

  res.set("Cache-Control", "no-store");
  res.send(salida);
});

app.get("/salud", (_req, res) => res.type("text").send("ok\n"));

app.use(
  express.static(ESTATICOS, {
    etag: true,
    setHeaders(res, ruta) {
      if (process.env.NODE_ENV !== "production") {
        res.set("Cache-Control", "no-store");
        return;
      }
      res.set("X-Content-Type-Options", "nosniff");
      if (ruta.endsWith("index.html")) res.set("Cache-Control", "no-cache");
      else res.set("Cache-Control", "public, max-age=300, must-revalidate");
    },
  }),
);

/*
 * Cualquier otra ruta cae en el jardín... salvo las que piden un archivo. Si a
 * un .css o .js le devolvemos el index, el navegador lo descarta por el tipo
 * equivocado y la página sale sin estilos y sin escena: un fallo callado y
 * difícil de ver. Mejor un 404 ruidoso.
 */
app.use((error, req, res, next) => {
  if (error?.type === "entity.too.large")
    return res
      .status(413)
      .json({ error: "El archivo o dibujo es demasiado grande." });
  if (error instanceof SyntaxError)
    return res.status(400).json({ error: "No pudimos leer esos datos." });
  if (error)
    return res.status(500).json({ error: "No pudimos completar la petición." });
  next();
});
app.use((req, res) => {
  if (/\.[a-z0-9]{2,5}$/i.test(req.path))
    return res.status(404).type("text").send("no existe\n");
  res.status(404).set("X-Robots-Tag", "noindex").sendFile(path.join(ESTATICOS, "index.html"));
});

try {
  await prepararEsquema();
  await prepareFeatures();
  await prepareMetrics();
  startMetrics();
  console.log("[flores] esquema listo");
} catch (err) {
  console.error("[flores] no se pudo preparar la base:", err.message);
  process.exit(1);
}

const dashboard = startMetricsDashboard();
const server = app.listen(PUERTO, "0.0.0.0", () => {
  console.log(`[flores] escuchando en :${PUERTO} — origen ${ORIGEN}`);
});

server.requestTimeout = 60000;
server.headersTimeout = 15000;
server.keepAliveTimeout = 5000;
server.maxHeadersCount = 50;

let shuttingDown = false;
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    const deadline = setTimeout(() => process.exit(1), 10000);
    deadline.unref();
    dashboard?.close();
    server.close(async () => {
      await stopMetrics();
      process.exit(0);
    });
  });
