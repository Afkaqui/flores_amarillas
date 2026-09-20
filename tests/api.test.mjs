import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "../server/node_modules/sharp/lib/index.js";
import { templateFlower } from "../shared/drawing.js";
const enabled = process.env.FLORES_TEST_DB === "1";
test(
  "API preserves drawings and media, isolates ownership, restricts replies and deletes only authorized gifts",
  { skip: !enabled, timeout: 60000 },
  async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "flores-api-test-"));
    const port = 5194,
      origin = "http://127.0.0.1:" + port;
    const env = {
      ...process.env,
      PORT: String(port),
      ORIGEN: origin,
      MEDIA_ROOT: dir,
      STATIC_ROOT: path.resolve("."),
      OPENCODE_GO_API_KEY: "",
      AGENT_CONNECT_SECRET: "",
      METRICS_ADMIN_KEY: "test-admin-key-".repeat(4),
      METRICS_PORT: "0",
    };
    let child;
    const ids = [];
    async function start() {
      child = spawn(process.execPath, ["server/index.js"], {
        env,
        stdio: ["ignore", "pipe", "pipe"],
      });
      await new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("server-start-timeout")),
          10000,
        );
        child.stdout.on("data", (b) => {
          if (b.toString().includes("escuchando")) {
            clearTimeout(timer);
            resolve();
          }
        });
        child.once("exit", (code) => {
          clearTimeout(timer);
          reject(new Error("server-exited:" + code));
        });
      });
    }
    async function stop() {
      if (!child || child.exitCode !== null) return;
      await new Promise((r) => {
        child.once("exit", r);
        child.kill("SIGTERM");
      });
    }
    async function api(
      route,
      { cookie, method = "GET", data, headers = {}, body } = {},
    ) {
      const r = await fetch(origin + route, {
        method,
        headers: {
          ...headers,
          ...(cookie ? { Cookie: cookie } : {}),
          ...(data ? { "Content-Type": "application/json" } : {}),
        },
        body: data ? JSON.stringify(data) : body,
      });
      return r;
    }
    async function newSession() {
      const r = await api("/api/session", { method: "POST" });
      assert.equal(r.status, 200);
      return r.headers.get("set-cookie").split(";")[0];
    }
    try {
      await start();
      const home = await api("/");
      const homeHtml = await home.text();
      assert.equal(home.status, 200);
      assert.match(homeHtml, /Hay personas/);
      assert.ok(!homeHtml.includes("Tu clave de acceso"));
      const metrics = await api("/metrics");
      assert.equal(metrics.status, 200);
      assert.match(await metrics.text(), /Tu clave de acceso/);
      assert.equal((await api("/metrics/api/metrics")).status, 401);
      const a = await newSession(),
        b = await newSession();
      assert.equal(
        (
          await api("/api/session", {
            method: "POST",
            headers: { Origin: "https://other.example" },
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await api("/api/asistente", {
            method: "POST",
            cookie: a,
            data: { message: "Una idea", gift: { para: "Ana" } },
          })
        ).status,
        503,
      );
      const image = await sharp({
        create: { width: 40, height: 40, channels: 3, background: "#d9e8bc" },
      })
        .png()
        .toBuffer();
      const photoResponse = await api("/api/media", {
        method: "POST",
        cookie: a,
        headers: { "Content-Type": "image/png" },
        body: image,
      });
      assert.equal(photoResponse.status, 201);
      const photo = (await photoResponse.json()).url;
      assert.equal(
        (
          await api("/api/media", {
            method: "POST",
            cookie: a,
            headers: { "Content-Type": "audio/webm" },
            body: "not audio",
          })
        ).status,
        400,
      );
      const ogg = path.join(dir, "fixture.ogg");
      await promisify(execFile)("ffmpeg", [
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        "anullsrc=r=24000:cl=mono",
        "-t",
        "0.5",
        "-c:a",
        "libopus",
        ogg,
      ]);
      const audioResponse = await api("/api/media", {
        method: "POST",
        cookie: a,
        headers: { "Content-Type": "audio/ogg" },
        body: await readFile(ogg),
      });
      assert.equal(audioResponse.status, 201);
      const voice = (await audioResponse.json()).url;
      const gift = {
        para: "Prueba API V2",
        mensaje: "Una carta de prueba",
        dibujos: [{ ...templateFlower(), note: "Mi dibujo" }],
        fotos: [photo],
        momentos: [{ foto: photo, texto: "Nuestra foto de prueba" }],
        voz: voice,
        permitirRespuesta: true,
      };
      assert.notEqual(
        (await api("/api/regalos", { method: "POST", cookie: b, data: gift }))
          .status,
        201,
      );
      const first = await api("/api/regalos", {
        method: "POST",
        cookie: a,
        data: gift,
      });
      assert.equal(first.status, 201);
      const g = await first.json();
      ids.push(g.id);
      const received = await (await api("/api/regalos/" + g.id)).json();
      assert.deepEqual(received.dibujos, gift.dibujos);
      assert.equal(received.voz, voice);
      assert.deepEqual(received.fotos, [photo]);
      assert.deepEqual(received.momentos, gift.momentos);
      assert.equal(received.manageToken, undefined);
      assert.equal((await api(photo)).status, 200);
      assert.equal(
        (await api(voice)).headers.get("content-type").startsWith("audio/"),
        true,
      );
      const reply = {
        name: "Ana",
        flower: { ...templateFlower(), note: "Gracias" },
      };
      assert.equal(
        (
          await api("/api/regalos/" + g.id + "/respuestas", {
            method: "POST",
            cookie: a,
            data: reply,
          })
        ).status,
        403,
      );
      const ownerView = await (
        await api("/api/regalos/" + g.id + "/respuestas", { cookie: a })
      ).json();
      assert.equal(ownerView.isAuthor, true);
      assert.equal(ownerView.canReply, false);
      assert.equal(
        (
          await api("/api/regalos/" + g.id + "/respuestas", {
            method: "POST",
            cookie: b,
            data: { flower: reply.flower },
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await api("/api/regalos/" + g.id + "/respuestas", {
            method: "POST",
            cookie: b,
            data: reply,
          })
        ).status,
        201,
      );
      assert.equal(
        (
          await api("/api/regalos/" + g.id + "/respuestas", {
            method: "POST",
            cookie: b,
            data: reply,
          })
        ).status,
        409,
      );
      assert.equal(
        (await (await api("/api/regalos/" + g.id + "/respuestas")).json())
          .flowers.length,
        1,
      );
      assert.equal(
        (
          await api("/api/regalos/" + g.id, {
            method: "DELETE",
            headers: { Authorization: "Bearer " + "0".repeat(48) },
          })
        ).status,
        403,
      );
      const authorReplies = await (
        await api("/api/regalos/" + g.id + "/respuestas", { cookie: a })
      ).json();
      assert.equal(authorReplies.replies[0].name, "Ana");
      assert.equal(authorReplies.replies[0].flower.note, "Gracias");
      assert.equal(authorReplies.replies[0].owner_hash, undefined);
      const recipientReplies = await (
        await api("/api/regalos/" + g.id + "/respuestas", { cookie: b })
      ).json();
      assert.equal(recipientReplies.hasReplied, true);
      assert.equal(recipientReplies.canReply, false);
      await stop();
      await start();
      // A valid media owner remains valid after a deployment/restart.
      const second = await api("/api/regalos", {
        method: "POST",
        cookie: a,
        data: gift,
      });
      assert.equal(second.status, 201);
      const g2 = await second.json();
      ids.push(g2.id);
      assert.equal(
        (
          await api("/api/regalos/" + g2.id, {
            method: "DELETE",
            headers: { Authorization: "Bearer " + g2.manageToken },
          })
        ).status,
        200,
      );
      assert.equal((await api(photo)).status, 200);
      assert.equal(
        (
          await api("/api/regalos/" + g.id, {
            method: "DELETE",
            headers: { Authorization: "Bearer " + g.manageToken },
          })
        ).status,
        200,
      );
      assert.equal((await api("/api/regalos/" + g.id)).status, 404);
      assert.equal((await api(photo)).status, 404);
      assert.equal((await api(voice)).status, 404);
    } finally {
      await stop();
      const { pool } = await import("../server/db.js");
      await pool.query("DELETE FROM regalos WHERE id=ANY($1)", [ids]);
      await pool.end();
      await rm(dir, { recursive: true, force: true });
    }
  },
);
