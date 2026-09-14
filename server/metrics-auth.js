import {
  createHash,
  randomBytes,
  scryptSync,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
const derive = promisify(scrypt);
const digest = (value) => createHash("sha256").update(value).digest("hex");
const lifetime = 30 * 60 * 1000;
export function metricsAuth(
  key = process.env.METRICS_ADMIN_KEY,
  { secure = false } = {},
) {
  if (typeof key !== "string" || !/^[A-Za-z0-9_-]{43,128}$/.test(key))
    throw new Error(
      "Configura una clave aleatoria de métricas con el generador local.",
    );
  const salt = randomBytes(16),
    expected = scryptSync(key, salt, 32);
  const sessions = new Map();
  let attempts = 0,
    windowStart = Date.now(),
    checking = false;
  const token = (req) =>
    (req.headers.cookie || "").match(
      /(?:^|;\s*)flores_metrics_admin=([a-f0-9]{64})(?:;|$)/,
    )?.[1];
  const cookie = (value, age) =>
    `flores_metrics_admin=${value}; Path=/metrics; HttpOnly; SameSite=Strict; Max-Age=${age}${secure ? "; Secure" : ""}`;
  return {
    authenticated(req) {
      const value = token(req);
      if (!value) return false;
      const id = digest(value),
        expires = sessions.get(id);
      if (!expires || expires <= Date.now()) {
        sessions.delete(id);
        return false;
      }
      return true;
    },
    async login(candidate) {
      if (Date.now() - windowStart >= 60000) {
        attempts = 0;
        windowStart = Date.now();
      }
      if (checking || attempts >= 5) return { status: 429 };
      attempts++;
      if (typeof candidate !== "string" || candidate.length > 128)
        return { status: 401 };
      checking = true;
      try {
        const actual = await derive(candidate, salt, 32);
        if (!timingSafeEqual(actual, expected)) return { status: 401 };
        const value = randomBytes(32).toString("hex");
        for (const [id, expires] of sessions)
          if (expires <= Date.now()) sessions.delete(id);
        if (sessions.size >= 8) sessions.delete(sessions.keys().next().value);
        sessions.set(digest(value), Date.now() + lifetime);
        return { status: 204, cookie: cookie(value, lifetime / 1000) };
      } finally {
        checking = false;
      }
    },
    logout(req) {
      const value = token(req);
      if (value) sessions.delete(digest(value));
      return cookie("", 0);
    },
  };
}
