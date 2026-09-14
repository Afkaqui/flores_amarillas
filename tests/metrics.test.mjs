import { test } from "node:test";
import assert from "node:assert/strict";
import express from "../server/node_modules/express/index.js";
import { pool, prepararEsquema } from "../server/db.js";
import { prepareFeatures, sameOrigin } from "../server/features.js";
import {
  prepareMetrics,
  flushMetrics,
  countMetric,
  metricsReport,
  registerMetricEvents,
  httpMetrics,
  routeGroup,
} from "../server/metrics.js";
import { localMetricsRequest } from "../server/metrics-admin.js";

test("metrics keep private URLs and identifiers out of route dimensions", () => {
  assert.equal(routeGroup("/r/abc1234"), "gift_page");
  assert.equal(routeGroup("/api/regalos/abc1234/respuestas"), "replies");
  assert.equal(routeGroup("/private-name"), "other");
  assert.equal(routeGroup("/media/private-file"), "media");
});
test("local dashboard rejects external hosts, origins and cross-site access", () => {
  const req = (headers) => ({ headers });
  assert.ok(localMetricsRequest(req({ host: "127.0.0.1:5184" }), 5184));
  assert.equal(
    localMetricsRequest(req({ host: "attacker.example:5184" }), 5184),
    false,
  );
  assert.equal(
    localMetricsRequest(
      req({ host: "127.0.0.1:5184", origin: "https://evil.example" }),
      5184,
    ),
    false,
  );
  assert.equal(
    localMetricsRequest(
      req({ host: "127.0.0.1:5184", "sec-fetch-site": "cross-site" }),
      5184,
    ),
    false,
  );
});
test(
  "metrics persist counts and volume, deduplicate browser-days, bound telemetry and do not accept private payloads",
  { skip: process.env.FLORES_TEST_DB !== "1" },
  async () => {
    await prepararEsquema();
    await prepareFeatures();
    await prepareMetrics();
    const before = await metricsReport(1);
    const app = express();
    app.use(httpMetrics);
    app.use("/api", sameOrigin);
    registerMetricEvents(app);
    app.post("/api/regalos", (_req, res) => res.status(201).json({ ok: true }));
    app.get("/broken", (_req, res) => res.status(500).end("failed"));
    const server = app.listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    const base = "http://127.0.0.1:" + server.address().port;
    const post = (body, cookie = "", headers = {}) =>
      fetch(base + "/api/metricas/eventos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
          ...headers,
        },
        body: JSON.stringify(body),
      });
    try {
      const first = await post({ event: "page_view", source: "direct" });
      assert.equal(first.status, 204);
      const cookie = first.headers.get("set-cookie").split(";")[0];
      assert.equal((await post({ event: "whatsapp_opened" }, cookie)).status, 204);
      assert.equal(
        (await post({ event: "page_view", source: "direct" }, cookie)).status,
        204,
      );
      assert.equal(
        (await post({ event: "page_view", mensaje: "private letter" }, cookie))
          .status,
        400,
      );
      assert.equal((await post({ event: "gift_created" }, cookie)).status, 400);
      assert.equal(
        (await post({ event: "page_view", source: "x".repeat(3000) }, cookie))
          .status,
        413,
      );
      assert.equal(
        (
          await post({ event: "page_view" }, cookie, {
            "sec-fetch-site": "cross-site",
          })
        ).status,
        403,
      );
      assert.equal(
        (await post({ event: "page_view" }, cookie, { DNT: "1" })).status,
        204,
      );
      await fetch(base + "/api/regalos", {
        method: "POST",
        headers: { Cookie: cookie },
      });
      await fetch(base + "/broken");
      countMetric("event", "media_uploaded", { input: 2000, output: 800 });
      countMetric("event", "assistant_success", { tokens: 37 });
      await flushMetrics();
      const report = await metricsReport(1);
      assert.equal(
        report.totals.events.page_view - (before.totals.events.page_view || 0),
        2,
      );
      assert.equal(
        report.browserDays.page_view - (before.browserDays.page_view || 0),
        1,
      );
      assert.equal(
        report.totals.events.gift_created -
          (before.totals.events.gift_created || 0),
        1,
      );
      assert.equal(
        report.totals.uploadedBytes - before.totals.uploadedBytes,
        800,
      );
      assert.equal(report.totals.tokens - before.totals.tokens, 37);
      assert.ok(report.totals.http.other.errors >= 1);
      assert.ok(report.totals.http.gifts.output >= 11);
      assert.ok(!JSON.stringify(report).includes("private letter"));
      await flushMetrics();
      assert.equal(
        (await metricsReport(1)).totals.events.page_view,
        report.totals.events.page_view,
      );
      assert.equal((await metricsReport(9999)).period.days, 365);
    } finally {
      await new Promise((r) => server.close(r));
      await pool.end();
    }
  },
);
