import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { flushMetrics, metricsReport } from "./metrics.js";

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
export function startMetricsDashboard(
  port = Number(process.env.METRICS_PORT) || 0,
) {
  if (!port) return null;
  const server = createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'",
    );
    if (!localMetricsRequest(req, port)) {
      res.writeHead(403).end();
      return;
    }
    if (req.method !== "GET") {
      res.writeHead(405).end();
      return;
    }
    const url = new URL(req.url, "http://localhost");
    try {
      if (url.pathname === "/api/metrics") {
        await flushMetrics();
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(
          JSON.stringify(await metricsReport(url.searchParams.get("days"))),
        );
      } else if (url.pathname === "/") {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(
          await readFile(new URL("./metrics-dashboard.html", import.meta.url)),
        );
      } else if (url.pathname === "/dashboard.js") {
        res.setHeader("Content-Type", "text/javascript; charset=utf-8");
        res.end(
          await readFile(new URL("./metrics-dashboard.js", import.meta.url)),
        );
      } else res.writeHead(404).end();
    } catch {
      res
        .writeHead(503, { "Content-Type": "application/json" })
        .end(
          JSON.stringify({
            error: "No se pudieron consultar las métricas. Intenta actualizar.",
          }),
        );
    }
  });
  server.on("error", () =>
    console.error("[metrics] no se pudo iniciar el panel local"),
  );
  server.listen(port, "127.0.0.1", () =>
    console.log(`[metrics] panel local en http://127.0.0.1:${port}`),
  );
  return server;
}
