import { cp, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));
const publicDir = path.join(root, "server/public");
await mkdir(publicDir, { recursive: true });
for (const entry of ["index.html", "css", "js", "shared"]) {
  await cp(path.join(root, entry), path.join(publicDir, entry), { recursive: true });
}
console.log("Assets públicos preparados en server/public");
