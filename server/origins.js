// During a domain migration, old gift links keep using their own origin.
// This is an exact allowlist, never a wildcard or a CORS grant.
export function createOriginGuard(origins) {
  const allowed = new Set(origins.filter(Boolean));
  return (req, res, next) => {
    const origin = req.get("origin");
    if (
      req.get("sec-fetch-site") === "cross-site" ||
      (origin && allowed.size && !allowed.has(origin))
    ) {
      return res.status(403).json({
        error: "Abre el creador desde la página del jardín.",
      });
    }
    next();
  };
}
