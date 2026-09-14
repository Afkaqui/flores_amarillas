import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { flushMetrics, metricsReport } from "./metrics.js";
import { metricsAuth } from "./metrics-auth.js";

// A separate loopback listener. Never mounted on the public application router.
export function localMetricsRequest(req, port) {
  const hosts = new Set([
    `127.0.0.1:${port}`,
    `localhost:${port}`,
    `[::1]:${port}`,
  ]);
  if (!hosts.has(req.headers.host)) return false;
  if (req.headers["sec-fetch-site"] === "cross-site") return false;
  return (
    !req.headers.origin ||
    [...hosts].some((host) => req.headers.origin === `http://${host}`)
  );
}
export function createMetricsDashboard({
  key = process.env.METRICS_ADMIN_KEY,
  report = metricsReport,
  flush = flushMetrics,
} = {}) {
  const auth = metricsAuth(key);
  const server = createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
    );
    if (!localMetricsRequest(req, server.address().port))
      return res.writeHead(403).end();
    const url = new URL(req.url, "http://localhost");
    const json = (status, value) =>
      res
        .writeHead(status, {
          "Content-Type": "application/json; charset=utf-8",
        })
        .end(JSON.stringify(value));
    try {
      if (
        req.method === "POST" &&
        ["/login", "/logout"].includes(url.pathname)
      ) {
        // Exact origin includes port; another local app cannot forge a login/logout.
        if (req.headers.origin !== `http://${req.headers.host}`)
          return res.writeHead(403).end();
        if (url.pathname === "/logout") {
          res.setHeader("Set-Cookie", auth.logout(req));
          return res.writeHead(204).end();
        }
        if (req.headers["content-type"]?.split(";")[0] !== "application/json")
          return json(415, { error: "Solicitud inválida." });
        let body = "",
          size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 1024) {
            res.writeHead(413).end();
            return;
          }
          body += chunk.toString("utf8");
        }
        let data;
        try {
          data = JSON.parse(body);
        } catch {
          return json(400, { error: "Solicitud inválida." });
        }
        const result = await auth.login(data?.key);
        if (result.cookie) res.setHeader("Set-Cookie", result.cookie);
        if (result.status === 204) return res.writeHead(204).end();
        if (result.status === 429) res.setHeader("Retry-After", "60");
        return json(result.status, {
          error:
            result.status === 429
              ? "Demasiados intentos. Espera un minuto."
              : "La clave no es correcta.",
        });
      }
      if (req.method !== "GET") return res.writeHead(405).end();
      const authenticated = auth.authenticated(req);
      if (url.pathname === "/login.js") {
        res.setHeader("Content-Type", "text/javascript; charset=utf-8");
        return res.end(
          await readFile(new URL("./metrics-login.js", import.meta.url)),
        );
      }
      if (!authenticated) {
        if (url.pathname !== "/")
          return json(401, {
            error: "Introduce tu clave para consultar las métricas.",
          });
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        return res.end(
          await readFile(new URL("./metrics-login.html", import.meta.url)),
        );
      }
      if (url.pathname === "/api/metrics") {
        await flush();
        return json(200, await report(url.searchParams.get("days")));
      }
      if (url.pathname === "/" || url.pathname === "/dashboard.js") {
        const script = url.pathname === "/dashboard.js";
        res.setHeader(
          "Content-Type",
          script
            ? "text/javascript; charset=utf-8"
            : "text/html; charset=utf-8",
        );
        return res.end(
          await readFile(
            new URL(
              script ? "./metrics-dashboard.js" : "./metrics-dashboard.html",
              import.meta.url,
            ),
          ),
        );
      }
      res.writeHead(404).end();
    } catch {
      json(503, {
        error: "No se pudo completar la consulta. Inténtalo otra vez.",
      });
    }
  });
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  server.maxHeadersCount = 30;
  return server;
}
export function startMetricsDashboard(
  port = Number(process.env.METRICS_PORT) || 0,
) {
  if (!port) return null;
  let server;
  try {
    server = createMetricsDashboard();
  } catch {
    console.error(
      "[metrics] panel bloqueado: configura METRICS_ADMIN_KEY con el generador local",
    );
    return null;
  }
  server.on("error", () =>
    console.error("[metrics] no se pudo iniciar el panel local"),
  );
  server.listen(port, "127.0.0.1", () =>
    console.log(`[metrics] panel privado en http://127.0.0.1:${port}`),
  );
  return server;
}
