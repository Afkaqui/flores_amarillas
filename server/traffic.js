import { createHash } from "node:crypto";
// Bounds requests before body parsing, database work or file conversion.
export function trafficClass(path, method) {
  if (path === "/api/asistente") return "assistant";
  if (path === "/api/media") return "upload";
  if (path === "/api/session") return "session";
  if (path.startsWith("/metrics")) return "admin";
  if (path.startsWith("/og/")) return "preview";
  if (path.startsWith("/api/") && !["GET", "HEAD", "OPTIONS"].includes(method))
    return "write";
  if (
    path.startsWith("/api/") ||
    path.startsWith("/r/") ||
    path.startsWith("/media/")
  )
    return "read";
  return "page";
}
const policies = {
  page: [120, 4],
  read: [60, 2],
  write: [12, 0.2],
  session: [6, 0.2],
  assistant: [3, 0.1],
  upload: [4, 0.1],
  admin: [15, 0.5],
  preview: [8, 0.3],
};
export function createTrafficGuard({
  now = Date.now,
  maxClients = 10000,
  globalBurst = 200,
  globalRate = 100,
  maxActive = 80,
} = {}) {
  const clients = new Map(),
    global = { tokens: globalBurst, at: now() };
  const work = { upload: 0, preview: 0 };
  let active = 0,
    lastCleanup = now();
  const take = (bucket, burst, rate, time) => {
    bucket.tokens = Math.min(
      burst,
      bucket.tokens + (Math.max(0, time - bucket.at) * rate) / 1000,
    );
    bucket.at = time;
    if (bucket.tokens < 1)
      return Math.max(1, Math.ceil((1 - bucket.tokens) / rate));
    bucket.tokens--;
    return 0;
  };
  return (req, res, next) => {
    const time = now(),
      group = trafficClass(req.path, req.method);
    const reject = (seconds) => {
      res.set("Retry-After", String(seconds));
      res.set("Cache-Control", "no-store");
      res
        .status(429)
        .json({
          error:
            "Hay demasiadas solicitudes. Espera un momento y vuelve a intentarlo.",
          retryAfter: seconds,
        });
    };
    const globalWait = take(global, globalBurst, globalRate, time);
    if (globalWait) return reject(globalWait);
    if (active >= maxActive) return reject(2);
    if (time - lastCleanup > 60000) {
      for (const [id, c] of clients)
        if (time - c.at > 600000) clients.delete(id);
      lastCleanup = time;
    }
    // req.ip comes only from Express's explicitly trusted proxy hop.
    const id = createHash("sha256")
      .update(req.ip || req.socket.remoteAddress || "unknown")
      .digest("hex");
    let client = clients.get(id);
    if (!client) {
      if (clients.size >= maxClients) return reject(60);
      client = { at: time, all: { tokens: 120, at: time }, groups: {} };
      clients.set(id, client);
    }
    client.at = time;
    const allWait = take(client.all, 120, 4, time);
    if (allWait) return reject(allWait);
    const [burst, rate] = policies[group];
    const bucket = (client.groups[group] ||= { tokens: burst, at: time });
    const wait = take(bucket, burst, rate, time);
    if (wait) return reject(wait);
    if (group in work && work[group] >= 2) return reject(3);
    active++;
    if (group in work) work[group]++;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      active--;
      if (group in work) work[group]--;
    };
    res.once("finish", release);
    res.once("close", release);
    next();
  };
}
