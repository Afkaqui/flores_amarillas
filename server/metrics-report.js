import { pool } from "./db.js";
import { metricsReport } from "./metrics.js";
try {
  console.log(
    JSON.stringify(await metricsReport(process.argv[2] || 7), null, 2),
  );
} catch {
  console.error(
    "No se pudieron consultar las métricas. Revisa DATABASE_URL y que el servidor haya inicializado el esquema.",
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
