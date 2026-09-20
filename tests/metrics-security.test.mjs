import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createMetricsDashboard } from "../server/metrics-admin.js";
import { metricsAuth } from "../server/metrics-auth.js";

test("admin fails closed without a strong key and limits incorrect login attempts", async () => {
  assert.throws(() => createMetricsDashboard({ key: "" }));
  assert.throws(() => createMetricsDashboard({ key: "password" }));
  const key = randomBytes(32).toString("base64url"),
    auth = metricsAuth(key);
  for (let i = 0; i < 5; i++)
    assert.equal((await auth.login("wrong")).status, 401);
  assert.equal((await auth.login(key)).status, 429);
  assert.equal(
    auth.authenticated({
      headers: { cookie: "flores_metrics_admin=" + "a".repeat(64) },
    }),
    false,
  );
});

test("admin HTML, metrics and export data require login; logout revokes the session", async () => {
  const key = randomBytes(32).toString("base64url");
  let queries = 0;
  const server = createMetricsDashboard({
    key,
    flush: async () => {},
    report: async () => {
      queries++;
      return { privateCount: 42 };
    },
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const origin = "http://127.0.0.1:" + server.address().port;
  const post = (route, body = {}, headers = {}) =>
    fetch(origin + "/metrics" + route, {
      method: "POST",
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
    });
  try {
    const login = await fetch(origin + "/metrics");
    assert.match(await login.text(), /Métricas del proyecto/);
    assert.equal((await fetch(origin + "/metrics/api/metrics")).status, 401);
    assert.equal((await fetch(origin + "/metrics/dashboard.js")).status, 401);
    assert.equal(queries, 0);
    assert.equal(
      (await post("/login", { key }, { Origin: "http://127.0.0.1:5183" }))
        .status,
      403,
    );
    assert.equal((await post("/login", { key: "wrong" })).status, 401);
    const ok = await post("/login", { key });
    assert.equal(ok.status, 204);
    const header = ok.headers.get("set-cookie"),
      cookie = header.split(";")[0];
    assert.match(header, /HttpOnly/);
    assert.match(header, /Path=\/metrics;/);
    assert.match(header, /SameSite=Strict/);
    assert.match(header, /Max-Age=1800/);
    assert.ok(!cookie.includes(key));
    const data = await fetch(origin + "/metrics/api/metrics", {
      headers: { Cookie: cookie },
    });
    assert.deepEqual(await data.json(), { privateCount: 42 });
    assert.equal(queries, 1);
    assert.equal(data.headers.get("cache-control"), "no-store");
    assert.equal(
      (
        await fetch(origin + "/metrics/api/metrics", {
          headers: { Cookie: cookie, Origin: "http://evil.example" },
        })
      ).status,
      403,
    );
    assert.match(
      await (
        await fetch(origin + "/metrics", { headers: { Cookie: cookie } })
      ).text(),
      /Lo que está floreciendo/,
    );
    const out = await post("/logout", {}, { Cookie: cookie });
    assert.equal(out.status, 204);
    assert.match(out.headers.get("set-cookie"), /Max-Age=0/);
    assert.equal(
      (
        await fetch(origin + "/metrics/api/metrics", {
          headers: { Cookie: cookie },
        })
      ).status,
      401,
    );
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("admin sessions expire after thirty minutes and are not valid after restarting", async ({
  mock,
}) => {
  mock.timers.enable({ apis: ["Date"], now: 1000 });
  const key = randomBytes(32).toString("base64url"),
    auth = metricsAuth(key);
  const login = await auth.login(key),
    req = { headers: { cookie: login.cookie.split(";")[0] } };
  assert.ok(auth.authenticated(req));
  assert.equal(metricsAuth(key).authenticated(req), false);
  mock.timers.tick(30 * 60 * 1000 + 1);
  assert.equal(auth.authenticated(req), false);
});
