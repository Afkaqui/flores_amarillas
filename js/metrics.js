// First-party counters only: never send form values, messages, names or file URLs.
const sent = new Set();
const once = new Set([
  "page_view",
  "creator_started",
  "step_bouquet",
  "step_letter",
  "assistant_opened",
  "gift_opened",
]);
let chain = Promise.resolve();
function source() {
  let value = "";
  try {
    value = (
      new URLSearchParams(location.search).get("utm_source") ||
      new URL(document.referrer).hostname
    ).toLowerCase();
  } catch {}
  if (!value) return "direct";
  if (/whatsapp|wa\.me/.test(value)) return "whatsapp";
  if (/instagram/.test(value)) return "instagram";
  if (/facebook|fb\.com/.test(value)) return "facebook";
  return "other";
}
export function track(event, { giftId } = {}) {
  if (
    navigator.doNotTrack === "1" ||
    navigator.globalPrivacyControl ||
    (once.has(event) && sent.has(event))
  )
    return;
  sent.add(event);
  const body = { event };
  if (event === "page_view") body.source = source();
  if (event === "gift_opened" && /^[a-z0-9]{7}$/.test(giftId || ""))
    body.giftId = giftId;
  // Serialize to let the first response set the anonymous daily cookie.
  chain = chain
    .then(() =>
      fetch("/api/metricas/eventos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        keepalive: true,
        signal: AbortSignal.timeout(4000),
      }),
    )
    .catch(() => {});
}
export function startVisitMetrics() {
  if (!document.hidden) track("page_view");
  else
    document.addEventListener("visibilitychange", function visible() {
      if (!document.hidden) {
        document.removeEventListener("visibilitychange", visible);
        track("page_view");
      }
    });
}
