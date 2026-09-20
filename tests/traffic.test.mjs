import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createTrafficGuard } from "../server/traffic.js";
function hit(
  guard,
  ip = "192.0.2.1",
  path = "/api/regalos",
  method = "GET",
  hold = false,
) {
  const res = new EventEmitter();
  res.headers = {};
  res.set = (k, v) => (res.headers[k] = v);
  res.status = (s) => ((res.code = s), res);
  res.json = (body) => {
    res.body = body;
    res.emit("finish");
  };
  let allowed = false;
  guard({ ip, path, method, socket: { remoteAddress: ip } }, res, () => {
    allowed = true;
    if (!hold) res.emit("finish");
  });
  return { res, allowed };
}
test("API burst is rejected before work and recovers after retry; other visitors remain usable", () => {
  let time = 0;
  const guard = createTrafficGuard({ now: () => time });
  for (let i = 0; i < 60; i++) assert.ok(hit(guard).allowed);
  const blocked = hit(guard);
  assert.equal(blocked.res.code, 429);
  assert.ok(Number(blocked.res.headers["Retry-After"]) > 0);
  assert.ok(hit(guard, "192.0.2.2").allowed);
  time += 1000;
  assert.ok(hit(guard).allowed);
});
test("global traffic and client memory are bounded even across many IPs", () => {
  const global = createTrafficGuard({ globalBurst: 3 });
  for (let i = 0; i < 3; i++) assert.ok(hit(global, "192.0.2." + i).allowed);
  assert.equal(hit(global, "192.0.2.99").res.code, 429);
  const capacity = createTrafficGuard({ maxClients: 2 });
  assert.ok(hit(capacity, "192.0.2.1").allowed);
  assert.ok(hit(capacity, "192.0.2.2").allowed);
  assert.equal(hit(capacity, "192.0.2.3").res.code, 429);
});
test("uploads are limited before buffers and slots are released exactly once on completion or disconnect", () => {
  const guard = createTrafficGuard();
  const a = hit(guard, "192.0.2.1", "/api/media", "POST", true),
    b = hit(guard, "192.0.2.2", "/api/media", "POST", true);
  assert.ok(a.allowed && b.allowed);
  assert.equal(hit(guard, "192.0.2.3", "/api/media", "POST").res.code, 429);
  a.res.emit("close");
  a.res.emit("finish");
  const c = hit(guard, "192.0.2.4", "/api/media", "POST", true);
  assert.ok(c.allowed);
  assert.equal(hit(guard, "192.0.2.5", "/api/media", "POST").res.code, 429);
});
test("normal page assets fit within burst and assistant has a separate tight limit", () => {
  const guard = createTrafficGuard();
  for (let i = 0; i < 55; i++)
    assert.ok(hit(guard, "192.0.2.1", "/js/main.js").allowed);
  for (let i = 0; i < 3; i++)
    assert.ok(hit(guard, "192.0.2.1", "/api/asistente", "POST").allowed);
  assert.equal(hit(guard, "192.0.2.1", "/api/asistente", "POST").res.code, 429);
});
