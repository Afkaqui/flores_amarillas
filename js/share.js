import { normalizeGift } from "../shared/gift.js";
export function mensajeParaCompartir(gift) {
  const name = normalizeGift(gift).para;
  return `${name ? name + ", te" : "Te"} preparé unas flores 🌼\nHay unas palabras esperando por ti. Abre tu regalo cuando tengas un ratito 💛`;
}
export function enlaceWhatsApp(message, link) {
  const url = new URL(link);
  if (!["https:", "http:"].includes(url.protocol)) throw new Error("Enlace inválido");
  // Universal links let WhatsApp handle mobile/app/web without guessing the OS.
  return "https://wa.me/?text=" + encodeURIComponent(`${message.trim()}\n\n${url.href}`);
}
function encode(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
function decode(text) {
  const s = text.replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(
    new TextDecoder().decode(
      Uint8Array.from(atob(s + "=".repeat((4 - (s.length % 4)) % 4)), (c) =>
        c.charCodeAt(0),
      ),
    ),
  );
}
export function enlaceConHash(gift) {
  return location.origin + "/#r=" + encode(normalizeGift(gift));
}
export async function crearEnlace(gift) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    const session = await fetch("/api/session", {
      method: "POST",
      signal: controller.signal,
    });
    if (!session.ok) throw new Error("No se pudo iniciar la sesión");
    const response = await fetch("/api/regalos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(normalizeGift(gift)),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("No se pudo guardar el enlace");
    const data = await response.json();
    const url = new URL(data.url);
    if (!["https:", "http:"].includes(url.protocol))
      throw new Error("Enlace inválido");
    if (data.manageToken && typeof window !== "undefined") {
      window.__createdGift = { id: data.id, manageToken: data.manageToken };
      try {
        localStorage.setItem("flores-management-" + data.id, data.manageToken);
        localStorage.setItem("flores-last-gift", data.id);
        document.dispatchEvent(new CustomEvent("flores:gift-saved"));
      } catch {}
    }
    return url.href;
  } catch {
    const fallback = enlaceConHash(gift);
    if (
      fallback.length > 12000 ||
      gift.fotos?.length ||
      gift.voz ||
      gift.permitirRespuesta
    )
      throw new Error("Este regalo necesita guardarse en el servidor.");
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}
export function leerRegalo() {
  if (window.__REGALO__?.para)
    return {
      ...normalizeGift(window.__REGALO__),
      id: window.__REGALO__.id || null,
    };
  const match = location.hash.match(/^#r=([A-Za-z0-9_-]+)$/);
  if (!match || match[1].length > 12000) return null;
  try {
    const gift = normalizeGift(decode(match[1]));
    return gift.para ? { ...gift, id: null } : null;
  } catch {
    return null;
  }
}
export function registrarApertura(id) {
  if (id)
    fetch("/api/regalos/" + encodeURIComponent(id), {
      cache: "no-store",
    }).catch(() => {});
}
export async function copiar(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const input = document.createElement("textarea");
    input.value = text;
    input.style.cssText = "position:fixed;opacity:0";
    document.body.appendChild(input);
    input.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      /* manual copy remains available */
    }
    input.remove();
    return ok;
  }
}
