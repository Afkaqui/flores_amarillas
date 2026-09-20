import express from "express";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { mkdir, writeFile, unlink, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import { pool, leerRegalo } from "./db.js";
import { normalizeDrawing } from "../shared/drawing.js";
import { propose } from "./assistant.js";
import { createOriginGuard } from "./origins.js";
const exec = promisify(execFile);
const hash = (v) => createHash("sha256").update(v).digest("hex");
export const MEDIA_ROOT = path.resolve(
  process.env.MEDIA_ROOT || path.join(import.meta.dirname, "media"),
);
const sessions = new Map();
let active = 0;
let activeUploads = 0;
export const sameOrigin = createOriginGuard([
  process.env.ORIGEN,
  ...(process.env.LEGACY_ORIGINS || "").split(",").map((value) => value.trim()),
]);
async function session(req) {
  const match = (req.headers.cookie || "").match(
    /(?:^|;\s*)flores_session=([a-f0-9]{48})(?:;|$)/,
  );
  if (!match) return null;
  let s = sessions.get(match[1]);
  if (!s || s.expires < Date.now()) {
    const { rows } = await pool.query(
      "SELECT id,expires FROM flower_sessions WHERE id=$1 AND expires>now()",
      [hash(match[1])],
    );
    if (!rows.length) return null;
    s = {
      id: rows[0].id,
      expires: new Date(rows[0].expires).getTime(),
      history: [],
      busy: false,
      historyExpires: Date.now() + 86400000,
    };
    if (sessions.size >= 1000) {
      const removable = [...sessions].find(([, v]) => !v.busy);
      if (removable) sessions.delete(removable[0]);
      else return null;
    }
    sessions.set(match[1], s);
  }
  if (s.historyExpires < Date.now()) {
    s.history = [];
    s.historyExpires = Date.now() + 86400000;
  }
  return s;
}
async function requireSession(req, res, next) {
  try {
    const s = await session(req);
    if (!s)
      return res
        .status(401)
        .json({ error: "Vuelve a abrir el creador para continuar." });
    req.flowerSession = s;
    next();
  } catch {
    res
      .status(503)
      .json({ error: "No pudimos recuperar tu sesión. Inténtalo de nuevo." });
  }
}
export async function sessionHash(req) {
  return (await session(req))?.id || null;
}
export async function prepareFeatures() {
  await mkdir(MEDIA_ROOT, { recursive: true, mode: 0o700 });
  await pool.query(`ALTER TABLE regalos ADD COLUMN IF NOT EXISTS management_hash text;
    ALTER TABLE regalos ADD COLUMN IF NOT EXISTS creator_hash text;
    CREATE TABLE IF NOT EXISTS flower_sessions (id text PRIMARY KEY, expires timestamptz NOT NULL DEFAULT now()+interval '90 days');
    CREATE TABLE IF NOT EXISTS flower_media (name text PRIMARY KEY, owner_hash text NOT NULL, gift_id text REFERENCES regalos(id) ON DELETE SET NULL, created timestamptz NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS flower_replies (id bigserial PRIMARY KEY, gift_id text NOT NULL REFERENCES regalos(id) ON DELETE CASCADE, owner_hash text NOT NULL, flower jsonb NOT NULL, created timestamptz NOT NULL DEFAULT now(), UNIQUE(gift_id,owner_hash));
    ALTER TABLE flower_replies ADD COLUMN IF NOT EXISTS author_name text NOT NULL DEFAULT '';
    CREATE TABLE IF NOT EXISTS flower_ai_usage (day date NOT NULL, actor text NOT NULL, requests integer NOT NULL DEFAULT 0, tokens bigint NOT NULL DEFAULT 0, PRIMARY KEY(day,actor));`);
}
async function allowance(actor, limit) {
  const { rows } = await pool.query(
    `INSERT INTO flower_ai_usage(day,actor,requests) VALUES(CURRENT_DATE,$1,1) ON CONFLICT(day,actor) DO UPDATE SET requests=flower_ai_usage.requests+1 WHERE flower_ai_usage.requests<$2 RETURNING requests`,
    [actor, limit],
  );
  return rows.length > 0;
}
export async function claimMedia(req, gift, id) {
  const files = [...gift.fotos, gift.voz]
    .filter(Boolean)
    .map((v) => path.basename(v));
  if (!files.length) return;
  const owner = await sessionHash(req);
  if (!owner) throw new Error("media-owner");
  const { rows } = await pool.query(
    "SELECT name FROM flower_media WHERE name=ANY($1) AND owner_hash=$2",
    [files, owner],
  );
  if (rows.length !== new Set(files).size) throw new Error("media-owner");
  if (id)
    await pool.query(
      "UPDATE flower_media SET gift_id=$1 WHERE name=ANY($2) AND owner_hash=$3",
      [id, files, owner],
    );
}
export async function attachManagement(id, token, req) {
  await pool.query(
    "UPDATE regalos SET management_hash=$2,creator_hash=$3 WHERE id=$1",
    [id, hash(token), await sessionHash(req)],
  );
}
async function isGiftAuthor(req, id) {
  const owner = await sessionHash(req);
  const { rows } = await pool.query(
    "SELECT creator_hash,management_hash FROM regalos WHERE id=$1",
    [id],
  );
  if (!rows[0]) return false;
  if (owner && rows[0].creator_hash === owner) return true;
  const token = req.get("authorization")?.replace(/^Bearer /, "");
  if (
    token &&
    /^[a-f0-9]{48}$/.test(token) &&
    rows[0].management_hash === hash(token)
  ) {
    if (owner && !rows[0].creator_hash)
      await pool.query(
        "UPDATE regalos SET creator_hash=$2 WHERE id=$1 AND creator_hash IS NULL",
        [id, owner],
      );
    return true;
  }
  return false;
}
export function registerFeatures(app) {
  app.use("/api", sameOrigin);
  app.post("/api/session", async (req, res) => {
    try {
      let s = await session(req);
      if (!s) {
        if (!(await allowance("sessions:" + hash(req.ip || "unknown"), 30)))
          return res.status(429).json({
            error: "Hay demasiadas sesiones nuevas. Inténtalo más tarde.",
          });
        const token = randomBytes(24).toString("hex");
        await pool.query("INSERT INTO flower_sessions(id) VALUES($1)", [
          hash(token),
        ]);
        s = {
          id: hash(token),
          expires: Date.now() + 90 * 86400000,
          history: [],
          historyExpires: Date.now() + 86400000,
          busy: false,
        };
        if (sessions.size >= 1000) {
          const removable = [...sessions].find(([, v]) => !v.busy);
          if (removable) sessions.delete(removable[0]);
        }
        sessions.set(token, s);
        res.cookie("flores_session", token, {
          httpOnly: true,
          sameSite: "strict",
          secure: process.env.NODE_ENV === "production",
          maxAge: 90 * 86400000,
          path: "/",
        });
      }
      res.set("Cache-Control", "no-store").json({
        ready: !!(
          process.env.OPENCODE_GO_API_KEY || process.env.AGENT_CONNECT_SECRET
        ),
      });
    } catch {
      res.status(503).json({ error: "No pudimos iniciar tu sesión." });
    }
  });
  app.post(
    "/api/asistente",
    express.json({ limit: "256kb" }),
    requireSession,
    async (req, res) => {
      const s = req.flowerSession,
        message = req.body?.message;
      if (
        typeof message !== "string" ||
        !message.trim() ||
        message.length > 1200
      )
        return res
          .status(400)
          .json({ error: "Escribe una petición de hasta 1200 caracteres." });
      if (s.busy || active >= 3)
        return res.status(429).json({
          error: "Tu cómplice está terminando otra idea. Espera un momento.",
        });
      if (!(
        process.env.OPENCODE_GO_API_KEY || process.env.AGENT_CONNECT_SECRET
      ))
        return res.status(503).json({
          error:
            "Tu cómplice aún no está conectado. Puedes preparar tu regalo manualmente.",
        });
      s.busy = true;
      active++;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 45000);
      res.on("close", () => {
        if (!res.writableEnded) controller.abort();
      });
      try {
        const ip = hash(req.ip || "unknown");
        if (
          !(await allowance(ip, 30)) ||
          !(await allowance(
            "global",
            Number(process.env.AI_DAILY_LIMIT) || 250,
          ))
        )
          return res.status(429).json({
            error:
              "Por hoy hemos llegado al límite de ideas. Puedes seguir editando tu regalo.",
          });
        const result = await propose({
          message,
          gift: req.body.gift,
          history: s.history,
          sessionId: s.id,
          signal: controller.signal,
        });
        s.history.push(
          { role: "user", content: message },
          {
            role: "assistant",
            content: JSON.stringify({
              explanation: result.explanation,
              options: result.options,
            }),
          },
        );
        s.history = s.history.slice(-8);
        await pool.query(
          "UPDATE flower_ai_usage SET tokens=tokens+$1 WHERE day=CURRENT_DATE AND actor=$2",
          [result.usage, "global"],
        );
        res.locals.metricTokens = result.usage;
        res.set("Cache-Control", "no-store").json({
          patch: result.patch,
          options: result.options,
          followups: result.followups,
          explanation: result.explanation,
        });
      } catch (e) {
        if (Number.isSafeInteger(e.usage) && e.usage > 0) {
          res.locals.metricTokens = e.usage;
          await pool.query(
            "UPDATE flower_ai_usage SET tokens=tokens+$1 WHERE day=CURRENT_DATE AND actor=$2",
            [e.usage, "global"],
          ).catch(() => {});
        }
        // Only operational codes; never log credentials, prompts or provider bodies.
        console.error(JSON.stringify({
          event: "assistant_error",
          code: e.code === "provider_auth" ? "provider_auth"
            : e.code === "assistant_scope" ? "assistant_scope"
            : e.code === "assistant_review" ? "assistant_review"
            : e.code === "provider_limit" ? "provider_limit"
            : controller.signal.aborted ? "cancelled_or_timeout" : "provider_error",
          providerStatus: e.providerStatus || null,
        }));
        if (!res.destroyed)
          res.status(e.status || 502).json({
            error: e.status
              ? e.message
              : "No pudimos terminar esa idea. Puedes intentarlo de nuevo; tu carta está a salvo.",
          });
      } finally {
        clearTimeout(timer);
        s.busy = false;
        active--;
      }
    },
  );
  app.post(
    "/api/media",
    requireSession,
    express.raw({ type: () => true, limit: "10mb" }),
    async (req, res) => {
      if (activeUploads >= 2)
        return res
          .set("Retry-After", "3")
          .status(429)
          .json({
            error: "Estamos preparando otros archivos. Espera un momento.",
          });
      activeUploads++;
      const owner = req.flowerSession.id;
      let temp;
      try {
        if (!(await allowance("uploads:" + hash(req.ip || "unknown"), 30)))
          return res
            .status(429)
            .json({ error: "Has llegado al límite de archivos de hoy." });
        const { rows } = await pool.query(
          "SELECT count(*)::int AS count FROM flower_media WHERE owner_hash=$1",
          [owner],
        );
        if (rows[0].count >= 12)
          return res.status(429).json({
            error: "Has llegado al límite de archivos de esta sesión.",
          });
        const buffer = req.body;
        if (!Buffer.isBuffer(buffer) || !buffer.length)
          return res.status(400).json({ error: "El archivo está vacío." });
        let ext, output;
        const type = req.get("content-type")?.split(";")[0];
        if (["image/jpeg", "image/png", "image/webp"].includes(type)) {
          const source = sharp(buffer, {
            limitInputPixels: 40000000,
            animated: false,
          });
          const meta = await source.metadata();
          if (!["jpeg", "png", "webp"].includes(meta.format))
            throw new Error("format");
          output = await source
            .rotate()
            .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
            .webp({ quality: 82 })
            .toBuffer();
          ext = "webp";
        } else if (
          [
            "audio/webm",
            "audio/mp4",
            "audio/ogg",
            "video/webm",
            "video/mp4",
          ].includes(type)
        ) {
          const isOgg = buffer.subarray(0, 4).toString() === "OggS";
          const isWebm = buffer.subarray(0, 4).toString("hex") === "1a45dfa3";
          const isMp4 = buffer.subarray(4, 8).toString() === "ftyp";
          if (!isOgg && !isWebm && !isMp4) throw new Error("format");
          temp = path.join(MEDIA_ROOT, "." + randomBytes(24).toString("hex"));
          await writeFile(temp, buffer, { mode: 0o600 });
          const target = temp + ".ogg";
          try {
            await exec(
              "ffmpeg",
              [
                "-v",
                "error",
                "-nostdin",
                "-protocol_whitelist",
                "file,pipe",
                "-i",
                temp,
                "-t",
                "30",
                "-vn",
                "-ac",
                "1",
                "-ar",
                "24000",
                "-c:a",
                "libopus",
                "-b:a",
                "48k",
                "-f",
                "ogg",
                target,
              ],
              { timeout: 20000, maxBuffer: 4096 },
            );
            output = await readFile(target);
          } finally {
            await unlink(target).catch(() => {});
          }
          ext = "ogg";
        } else
          return res.status(415).json({
            error: "Elige una foto JPG, PNG o WebP, o graba una nota de voz.",
          });
        const name = randomBytes(24).toString("hex") + "." + ext;
        await writeFile(path.join(MEDIA_ROOT, name), output, { mode: 0o600 });
        try {
          await pool.query(
            "INSERT INTO flower_media(name,owner_hash) VALUES($1,$2)",
            [name, owner],
          );
        } catch (e) {
          await unlink(path.join(MEDIA_ROOT, name));
          throw e;
        }
        res.locals.metricInput = buffer.length;
        res.locals.metricOutput = output.length;
        res.status(201).json({ url: "/media/" + name });
      } catch {
        res.status(400).json({
          error:
            "No pudimos procesar el archivo. Prueba con otra foto o grabación.",
        });
      } finally {
        if (temp) await unlink(temp).catch(() => {});
        activeUploads--;
      }
    },
  );
  app.get("/media/:name", async (req, res) => {
    try {
      const name = req.params.name;
      if (!/^[a-f0-9]{48}\.(webp|ogg)$/.test(name))
        return res.status(404).end();
      const { rows } = await pool.query(
        "SELECT name FROM flower_media WHERE name=$1",
        [name],
      );
      if (!rows.length) return res.status(404).end();
      res.set("Cache-Control", "private, max-age=300");
      res.set("X-Content-Type-Options", "nosniff");
      res.sendFile(path.join(MEDIA_ROOT, name), (error) => {
        if (error && !res.headersSent && !res.destroyed)
          res.status(error.status === 404 ? 404 : 503).end();
      });
    } catch {
      res.status(503).end();
    }
  });
  app.get("/api/regalos/:id/respuestas", async (req, res) => {
    try {
      const gift = await leerRegalo(req.params.id);
      if (!gift)
        return res
          .status(404)
          .json({ error: "Ese jardín ya no está disponible." });
      const { rows } = await pool.query(
        "SELECT id,flower,author_name,created,owner_hash FROM flower_replies WHERE gift_id=$1 ORDER BY id LIMIT 6",
        [req.params.id],
      );
      const isAuthor = await isGiftAuthor(req, req.params.id);
      const owner = await sessionHash(req);
      const hasReplied =
        !!owner && rows.some((row) => row.owner_hash === owner);
      res.set("Cache-Control", "no-store").json({
        flowers: rows.map((row) => row.flower),
        replies: rows.map((row) => ({
          id: row.id,
          flower: row.flower,
          name: row.author_name || "Alguien que te quiere",
          created: row.created,
        })),
        isAuthor,
        hasReplied,
        canReply:
          !!gift.permitirRespuesta &&
          !isAuthor &&
          !hasReplied &&
          rows.length < 6,
      });
    } catch {
      res.status(500).json({ error: "No pudimos abrir las respuestas." });
    }
  });
  app.post(
    "/api/regalos/:id/respuestas",
    express.json({ limit: "64kb" }),
    requireSession,
    async (req, res) => {
      try {
        if (await isGiftAuthor(req, req.params.id))
          return res.status(403).json({
            error:
              "Este regalo lo creaste tú. Comparte el enlace para recibir su respuesta.",
          });
        const name =
          typeof req.body.name === "string" ? req.body.name.trim() : "";
        if (!name || Array.from(name).length > 28)
          return res.status(400).json({
            error: "Escribe tu nombre o apodo, de hasta 28 caracteres.",
          });
        const flower = normalizeDrawing(req.body.flower);
        const gift = await leerRegalo(req.params.id);
        if (!gift?.permitirRespuesta)
          return res
            .status(403)
            .json({ error: "Este jardín no admite respuestas." });
        if (!flower)
          return res.status(400).json({ error: "Elige o dibuja una flor." });
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          await client.query("SELECT id FROM regalos WHERE id=$1 FOR UPDATE", [
            gift.id,
          ]);
          const { rows } = await client.query(
            "SELECT count(*)::int AS n FROM flower_replies WHERE gift_id=$1",
            [gift.id],
          );
          if (rows[0].n >= 6) {
            await client.query("ROLLBACK");
            return res
              .status(409)
              .json({ error: "Este regalo ya tiene seis respuestas." });
          }
          await client.query(
            "INSERT INTO flower_replies(gift_id,owner_hash,flower,author_name) VALUES($1,$2,$3,$4)",
            [gift.id, req.flowerSession.id, flower, name],
          );
          await client.query("COMMIT");
        } catch (e) {
          await client.query("ROLLBACK");
          throw e;
        } finally {
          client.release();
        }
        res.status(201).json({ ok: true });
      } catch (e) {
        res.status(e.code === "23505" ? 409 : 500).json({
          error:
            e.code === "23505"
              ? "Tu respuesta ya está en este regalo."
              : "No pudimos guardar tu respuesta. Tu dibujo sigue aquí.",
        });
      }
    },
  );
  app.delete("/api/regalos/:id", async (req, res) => {
    try {
      const token = req.get("authorization")?.replace(/^Bearer /, "");
      if (!token || !/^[a-f0-9]{48}$/.test(token)) return res.status(403).end();
      const { rows } = await pool.query(
        "SELECT management_hash FROM regalos WHERE id=$1",
        [req.params.id],
      );
      if (
        !rows[0]?.management_hash ||
        !timingSafeEqual(
          Buffer.from(rows[0].management_hash),
          Buffer.from(hash(token)),
        )
      )
        return res.status(403).end();
      // Shared media may occur in another saved revision; retain those files.
      const files = await pool.query(
        `DELETE FROM flower_media m WHERE (m.gift_id=$1 OR EXISTS(SELECT 1 FROM regalos t WHERE t.id=$1 AND (t.detalles->'fotos' ? ('/media/'||m.name) OR t.detalles->>'voz'='/media/'||m.name))) AND NOT EXISTS(SELECT 1 FROM regalos g WHERE g.id<>$1 AND (g.detalles->'fotos' ? ('/media/'||m.name) OR g.detalles->>'voz'='/media/'||m.name)) RETURNING name`,
        [req.params.id],
      );
      await pool.query("DELETE FROM regalos WHERE id=$1", [req.params.id]);
      await Promise.all(
        files.rows.map((r) =>
          unlink(path.join(MEDIA_ROOT, r.name)).catch(() => {}),
        ),
      );
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: "No pudimos eliminar el regalo." });
    }
  });
  const cleanup = setInterval(async () => {
    try {
      for (const [k, v] of sessions)
        if (v.expires < Date.now()) sessions.delete(k);
      const { rows } = await pool.query(
        `DELETE FROM flower_media m WHERE created<now()-interval '24 hours' AND NOT EXISTS(SELECT 1 FROM regalos g WHERE g.detalles->'fotos' ? ('/media/'||m.name) OR g.detalles->>'voz'='/media/'||m.name) RETURNING name`,
      );
      await Promise.all(
        rows.map((r) => unlink(path.join(MEDIA_ROOT, r.name)).catch(() => {})),
      );
      await pool.query("DELETE FROM flower_ai_usage WHERE day<CURRENT_DATE-30");
      await pool.query("DELETE FROM flower_sessions WHERE expires<now()");
    } catch {}
  }, 3600000);
  cleanup.unref();
}
