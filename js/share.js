import { normalizeGift } from "../shared/gift.js";
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
    return url.href;
  } catch {
    return enlaceConHash(gift);
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
