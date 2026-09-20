import { randomBytes } from "node:crypto";
import { open, readFile, chmod } from "node:fs/promises";
import { resolve } from "node:path";
// Never prints credentials or replaces an existing key.
const file = resolve(process.argv[2] || ".env");
let current = "",
  exists = false;
try {
  current = await readFile(file, "utf8");
  exists = true;
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
const lines = [];
if (!/^METRICS_ADMIN_KEY\s*=/m.test(current))
  lines.push(
    "# Acceso privado al panel: no compartir ni subir a Git.",
    "METRICS_ADMIN_KEY=" + randomBytes(32).toString("base64url"),
  );
if (exists) await chmod(file, 0o600);
if (lines.length) {
  const handle = await open(file, exists ? "a" : "wx", 0o600);
  try {
    await handle.writeFile(
      (current && !current.endsWith("\n") ? "\n" : "") +
        "\n" +
        lines.join("\n") +
        "\n",
    );
  } finally {
    await handle.close();
  }
  console.log(
    "Clave configurada en el archivo de entorno (permisos 600). No se ha mostrado.",
  );
} else
  console.log("La clave ya está configurada; se conserva sin mostrarla.");
