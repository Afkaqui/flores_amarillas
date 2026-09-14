import express from "express";
import { createHash, randomBytes } from "node:crypto";
import { pool } from "./db.js";

export const CLIENT_EVENTS = new Set([
  "page_view",
  "creator_started",
  "step_bouquet",
  "step_letter",
  "assistant_opened",
  "assistant_applied",
  "gift_opened",
  "gift_shared",
  "postcard_saved",
  "postcard_error",
]);
const SERVER_EVENTS = new Set([
  "gift_created",
  "reply_created",
  "assistant_success",
  "media_uploaded",
]);
const pending = new Map(),
  visitors = new Map(),
  limits = new Map();
let flushing = null,
  timer = null,
  lastCleanup = 0;
const health = { lastFlush: null, failedFlushes: 0, dropped: 0 };
export const metricsDay = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const digest = (value) => createHash("sha256").update(value).digest("hex");
const cookie = (req) =>
  (req.headers.cookie || "").match(
    /(?:^|;\s*)flores_metrics=([a-f0-9]{32})(?:;|$)/,
  )?.[1];
const empty = (day, kind, name, variant) => ({
  day,
  kind,
  name,
  variant,
  count: 0,
  input_bytes: 0,
  output_bytes: 0,
  tokens: 0,
  ms: 0,
  max_ms: 0,
  b100: 0,
  b500: 0,
  b2000: 0,
  b10000: 0,
  bslow: 0,
});
function merge(row) {
  const key = [row.day, row.kind, row.name, row.variant].join("|");
  if (!pending.has(key)) {
    if (pending.size >= 500) {
      health.dropped++;
      return;
    }
    pending.set(key, empty(row.day, row.kind, row.name, row.variant));
  }
  const target = pending.get(key);
  for (const key of [
    "count",
    "input_bytes",
    "output_bytes",
    "tokens",
    "ms",
    "b100",
    "b500",
    "b2000",
    "b10000",
    "bslow",
  ])
    target[key] += row[key] || 0;
  target.max_ms = Math.max(target.max_ms, row.max_ms || 0);
}
export function countMetric(
  kind,
  name,
  { variant = "all", input = 0, output = 0, tokens = 0, ms = 0 } = {},
) {
  const row = empty(metricsDay(), kind, name, variant);
  Object.assign(row, {
    count: 1,
    input_bytes: Math.max(0, input),
    output_bytes: Math.max(0, output),
    tokens: Math.max(0, tokens),
    ms: Math.round(ms),
    max_ms: Math.round(ms),
  });
  row[
    ms <= 100
      ? "b100"
      : ms <= 500
        ? "b500"
        : ms <= 2000
          ? "b2000"
          : ms <= 10000
            ? "b10000"
            : "bslow"
  ] = 1;
  merge(row);
}
function countEvent(name, req, data = {}) {
  countMetric("event", name, data);
  if (req.get("dnt") === "1" || req.get("sec-gpc") === "1") return;
  const token = cookie(req) || req.metricsVisitor;
  if (!token) return;
  const day = metricsDay(),
    visitor = digest(day + ":" + token);
  const key = [day, name, visitor].join("|");
  if (visitors.size < 5000 || visitors.has(key))
    visitors.set(key, { day, event: name, visitor });
  else health.dropped++;
}
export async function prepareMetrics() {
  await pool.query(`CREATE TABLE IF NOT EXISTS flower_metrics (
    day date NOT NULL, kind text NOT NULL, name text NOT NULL, variant text NOT NULL,
    count bigint NOT NULL DEFAULT 0, input_bytes bigint NOT NULL DEFAULT 0, output_bytes bigint NOT NULL DEFAULT 0,
    tokens bigint NOT NULL DEFAULT 0, ms bigint NOT NULL DEFAULT 0, max_ms bigint NOT NULL DEFAULT 0,
    b100 bigint NOT NULL DEFAULT 0, b500 bigint NOT NULL DEFAULT 0, b2000 bigint NOT NULL DEFAULT 0, b10000 bigint NOT NULL DEFAULT 0, bslow bigint NOT NULL DEFAULT 0,
    PRIMARY KEY(day,kind,name,variant));
    CREATE TABLE IF NOT EXISTS flower_metric_visitors (day date NOT NULL,event text NOT NULL,visitor text NOT NULL,PRIMARY KEY(day,event,visitor));
    CREATE TABLE IF NOT EXISTS flower_metric_info (id integer PRIMARY KEY,started timestamptz NOT NULL DEFAULT now());
    INSERT INTO flower_metric_info(id) VALUES(1) ON CONFLICT DO NOTHING;`);
}
export async function flushMetrics() {
  if (flushing) return flushing;
  const rows = [...pending.values()],
    unique = [...visitors.values()];
  pending.clear();
  visitors.clear();
  if (!rows.length && !unique.length) return;
  flushing = (async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      if (rows.length)
        await client.query(
          `INSERT INTO flower_metrics SELECT * FROM jsonb_to_recordset($1::jsonb) AS r(day date,kind text,name text,variant text,count bigint,input_bytes bigint,output_bytes bigint,tokens bigint,ms bigint,max_ms bigint,b100 bigint,b500 bigint,b2000 bigint,b10000 bigint,bslow bigint)
        ON CONFLICT(day,kind,name,variant) DO UPDATE SET
        count=flower_metrics.count+EXCLUDED.count,input_bytes=flower_metrics.input_bytes+EXCLUDED.input_bytes,output_bytes=flower_metrics.output_bytes+EXCLUDED.output_bytes,tokens=flower_metrics.tokens+EXCLUDED.tokens,ms=flower_metrics.ms+EXCLUDED.ms,max_ms=GREATEST(flower_metrics.max_ms,EXCLUDED.max_ms),
        b100=flower_metrics.b100+EXCLUDED.b100,b500=flower_metrics.b500+EXCLUDED.b500,b2000=flower_metrics.b2000+EXCLUDED.b2000,b10000=flower_metrics.b10000+EXCLUDED.b10000,bslow=flower_metrics.bslow+EXCLUDED.bslow`,
          [JSON.stringify(rows)],
        );
      if (unique.length)
        await client.query(
          `INSERT INTO flower_metric_visitors SELECT * FROM jsonb_to_recordset($1::jsonb) AS r(day date,event text,visitor text) ON CONFLICT DO NOTHING`,
          [JSON.stringify(unique)],
        );
      if (Date.now() - lastCleanup > 86400000) {
        await client.query(
          "DELETE FROM flower_metric_visitors WHERE day < CURRENT_DATE - 30; DELETE FROM flower_metrics WHERE day < CURRENT_DATE - 365",
        );
        lastCleanup = Date.now();
      }
      await client.query("COMMIT");
      health.lastFlush = new Date().toISOString();
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  })()
    .catch(() => {
      health.failedFlushes++;
      rows.forEach(merge);
      unique.forEach((v) => {
        if (visitors.size < 5000)
          visitors.set([v.day, v.event, v.visitor].join("|"), v);
      });
    })
    .finally(() => {
      flushing = null;
    });
  return flushing;
}
export function startMetrics() {
  timer ||= setInterval(flushMetrics, 5000);
  timer.unref();
}
export async function stopMetrics() {
  clearInterval(timer);
  timer = null;
  await flushMetrics();
  await flushMetrics();
}
export function metricsHealth() {
  return { ...health, pending: pending.size, visitorPending: visitors.size };
}
export function routeGroup(path) {
  if (path === "/") return "home";
  if (/^\/r\/[a-z0-9]{7}$/.test(path)) return "gift_page";
  if (/^\/api\/regalos\/[a-z0-9]{7}\/respuestas$/.test(path)) return "replies";
  if (path === "/api/regalos") return "gifts";
  if (/^\/api\/regalos\/[a-z0-9]{7}$/.test(path)) return "gift";
  if (path === "/api/asistente") return "assistant";
  if (path === "/api/media") return "upload";
  if (path === "/api/session") return "session";
  if (path.startsWith("/media/")) return "media";
  if (path.startsWith("/og/")) return "preview";
  if (/^\/(css|js|shared)\//.test(path)) return "assets";
  return "other";
}
export function httpMetrics(req, res, next) {
  if (
    req.path === "/api/metricas/eventos" ||
    req.path === "/metrics" ||
    req.path.startsWith("/metrics/")
  )
    return next();
  const started = performance.now(),
    group = routeGroup(req.path);
  let sent = 0;
  const write = res.write,
    end = res.end;
  const bytes = (chunk) =>
    typeof chunk === "string"
      ? Buffer.byteLength(chunk)
      : chunk?.byteLength || 0;
  res.write = function (chunk, ...args) {
    sent += bytes(chunk);
    return write.call(this, chunk, ...args);
  };
  res.end = function (chunk, ...args) {
    sent += bytes(chunk);
    return end.call(this, chunk, ...args);
  };
  res.once("finish", () => {
    const input = Math.min(
      12 * 1024 * 1024,
      Math.max(0, Number(req.get("content-length")) || 0),
    );
    countMetric("http", group, {
      variant: String(Math.floor(res.statusCode / 100)) + "xx",
      input,
      output: sent,
      ms: performance.now() - started,
    });
    if (req.method !== "POST") return;
    const event = {
      gifts: "gift_created",
      replies: "reply_created",
      assistant: "assistant_success",
      upload: "media_uploaded",
    }[group];
    if (
      event &&
      res.statusCode >= 200 &&
      res.statusCode < 300 &&
      SERVER_EVENTS.has(event)
    )
      countEvent(event, req, {
        tokens: res.locals.metricTokens || 0,
        input: res.locals.metricInput || 0,
        output: res.locals.metricOutput || 0,
      });
  });
  next();
}
export function registerMetricEvents(app) {
  app.post(
    "/api/metricas/eventos",
    express.json({ limit: "2kb" }),
    async (req, res) => {
      res.set("Cache-Control", "no-store");
      if (req.get("dnt") === "1" || req.get("sec-gpc") === "1")
        return res.status(204).end();
      const body = req.body;
      if (
        !body ||
        !CLIENT_EVENTS.has(body.event) ||
        Object.keys(body).some(
          (k) => !["event", "source", "giftId"].includes(k),
        )
      )
        return res.status(400).json({ error: "Evento inválido" });
      const key = digest(req.ip || "unknown"),
        now = Date.now();
      let limit = limits.get(key);
      if (!limit || now - limit.start > 60000) {
        if (limits.size >= 5000)
          for (const [k, v] of limits)
            if (now - v.start > 60000) limits.delete(k);
        if (limits.size >= 5000) return res.status(429).end();
        limit = { start: now, n: 0 };
        limits.set(key, limit);
      }
      if (++limit.n > 120) return res.status(429).end();
      if (body.event === "gift_opened" && body.giftId) {
        if (!/^[a-z0-9]{7}$/.test(body.giftId)) return res.status(400).end();
        try {
          const session = (req.headers.cookie || "").match(
            /(?:^|;\s*)flores_session=([a-f0-9]{48})(?:;|$)/,
          )?.[1];
          const { rows } = await pool.query(
            "SELECT creator_hash FROM regalos WHERE id=$1",
            [body.giftId],
          );
          if (
            !rows.length ||
            (session && rows[0].creator_hash === digest(session))
          )
            return res.status(204).end();
        } catch {
          return res.status(503).end();
        }
      }
      if (!cookie(req)) {
        req.metricsVisitor = randomBytes(16).toString("hex");
        res.cookie("flores_metrics", req.metricsVisitor, {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          maxAge: 86400000,
          path: "/",
        });
      }
      countEvent(body.event, req);
      if (body.event === "page_view")
        countMetric(
          "source",
          ["direct", "whatsapp", "instagram", "facebook", "other"].includes(
            body.source,
          )
            ? body.source
            : "other",
        );
      res.status(204).end();
    },
  );
}

export async function metricsReport(days = 7) {
  days = Math.min(365, Math.max(1, Number.parseInt(days, 10) || 7));
  const end = metricsDay();
  const startDate = new Date(end + "T12:00:00Z");
  startDate.setUTCDate(startDate.getUTCDate() - days + 1);
  const start = startDate.toISOString().slice(0, 10);
  const [rows, unique, stock, info] = await Promise.all([
    pool.query(
      "SELECT * FROM flower_metrics WHERE day BETWEEN $1 AND $2 ORDER BY day",
      [start, end],
    ),
    pool.query(
      "SELECT event,count(*)::int AS n FROM flower_metric_visitors WHERE day BETWEEN $1 AND $2 GROUP BY event",
      [start, end],
    ),
    pool.query(
      `SELECT count(*)::int AS gifts,count(*) FILTER(WHERE jsonb_array_length(COALESCE(detalles->'fotos','[]'::jsonb))>0)::int AS with_photos,count(*) FILTER(WHERE COALESCE(detalles->>'voz','')<>'')::int AS with_voice,(SELECT count(*)::int FROM flower_replies) AS replies,(SELECT count(*)::int FROM flower_media) AS files FROM regalos`,
    ),
    pool.query("SELECT started FROM flower_metric_info WHERE id=1"),
  ]);
  const totals = {
      events: {},
      sources: {},
      http: {},
      tokens: 0,
      uploadedBytes: 0,
    },
    daily = {};
  for (const r of rows.rows) {
    const day =
      r.day instanceof Date
        ? r.day.toISOString().slice(0, 10)
        : String(r.day).slice(0, 10);
    daily[day] ||= { day, visits: 0, gifts: 0, opens: 0, replies: 0 };
    if (r.kind === "event") {
      totals.events[r.name] = (totals.events[r.name] || 0) + Number(r.count);
      totals.tokens += Number(r.tokens);
      if (r.name === "media_uploaded")
        totals.uploadedBytes += Number(r.output_bytes);
      const field = {
        page_view: "visits",
        gift_created: "gifts",
        gift_opened: "opens",
        reply_created: "replies",
      }[r.name];
      if (field) daily[day][field] += Number(r.count);
    }
    if (r.kind === "source")
      totals.sources[r.name] = (totals.sources[r.name] || 0) + Number(r.count);
    if (r.kind === "http") {
      const t = (totals.http[r.name] ||= {
        requests: 0,
        errors: 0,
        rejected: 0,
        input: 0,
        output: 0,
        ms: 0,
        max: 0,
        buckets: [0, 0, 0, 0, 0],
      });
      t.requests += Number(r.count);
      t.errors += r.variant === "5xx" ? Number(r.count) : 0;
      t.rejected += r.variant === "4xx" ? Number(r.count) : 0;
      t.input += Number(r.input_bytes);
      t.output += Number(r.output_bytes);
      t.ms += Number(r.ms);
      t.max = Math.max(t.max, Number(r.max_ms));
      ["b100", "b500", "b2000", "b10000", "bslow"].forEach(
        (b, i) => (t.buckets[i] += Number(r[b])),
      );
    }
  }
  for (const t of Object.values(totals.http)) {
    t.meanMs = Math.round(t.ms / t.requests);
    let n = 0;
    const i = t.buckets.findIndex((b) => (n += b) >= t.requests * 0.95);
    t.p95 = ["≤ 100 ms", "≤ 500 ms", "≤ 2 s", "≤ 10 s", "> 10 s"][i];
    delete t.ms;
  }
  return {
    period: { start, end, days, timezone: "America/Lima" },
    started: info.rows[0]?.started || null,
    totals,
    daily: Object.values(daily),
    browserDays: Object.fromEntries(unique.rows.map((r) => [r.event, r.n])),
    stock: stock.rows[0],
    health: metricsHealth(),
    notes: [
      "Las visitas y aperturas son eventos del navegador; las peticiones HTTP incluyen bots y vistas previas.",
      "Navegadores/día es una estimación por cookie de 24 horas, no personas. Los identificadores se conservan 30 días; los totales, 365.",
      "Compartir confirma copiar o cerrar el diálogo de compartir; no acredita entrega. Guardar postal confirma generar la descarga, no guardarla en disco.",
      "Los pasos muestran actividad, no una cohorte lineal: se puede entrar al asistente desde el inicio. No sumes aperturas y creaciones como una conversión del mismo grupo.",
    ],
  };
}
