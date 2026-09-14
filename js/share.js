/* ============================================================
   El regalo viaja de dos formas:

   1. Enlace corto  amarillas.pascare.tech/r/ab12cd  — el servidor lo guarda y
      devuelve la página con las etiquetas OpenGraph, que es lo único que lee
      el robot de WhatsApp (no ejecuta JavaScript). Es el camino normal.
   2. Hash          .../#r=eyJwIjoi…                 — todo el regalo dentro de
      la URL, sin servidor. Sirve de respaldo si la API falla y mantiene vivos
      los enlaces repartidos antes de que existiera el backend.
   ============================================================ */

function b64urlEncode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str) {
  const s = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Enlace largo, autocontenido: no necesita servidor ni base de datos. */
export function enlaceConHash(regalo) {
  const payload = {
    p: regalo.para || '',
    m: regalo.mensaje || '',
    d: regalo.de || '',
    n: regalo.flores || 12,
  };
  return location.origin + location.pathname.replace(/\/r\/[^/]*$/, '/')
    + '#r=' + b64urlEncode(JSON.stringify(payload));
}

/**
 * Guarda el ramo en el servidor y devuelve el enlace corto.
 * Si algo falla (API caída, sin red), cae al enlace con hash: el regalo se
 * puede mandar igual, sólo se pierde la vista previa bonita.
 */
export async function crearEnlace(regalo) {
  try {
    const r = await fetch('/api/regalos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(regalo),
    });
    if (!r.ok) throw new Error('respuesta ' + r.status);
    const datos = await r.json();
    if (!datos.url) throw new Error('sin url');
    return datos.url;
  } catch (err) {
    console.warn('[flores] enlace corto no disponible, uso el hash:', err.message);
    return enlaceConHash(regalo);
  }
}

/** Lee el regalo: primero el que inyectó el servidor, si no el del hash. */
export function leerRegalo() {
  const delServidor = window.__REGALO__;
  if (delServidor && delServidor.para) {
    return {
      para: String(delServidor.para).slice(0, 28),
      mensaje: String(delServidor.mensaje || '').slice(0, 180),
      de: String(delServidor.de || '').slice(0, 28),
      flores: Math.min(24, Math.max(3, parseInt(delServidor.flores, 10) || 12)),
      id: delServidor.id,
    };
  }

  const m = location.hash.match(/#r=([A-Za-z0-9\-_]+)/);
  if (!m) return null;
  try {
    const o = JSON.parse(b64urlDecode(m[1]));
    return {
      para: String(o.p || '').slice(0, 28),
      mensaje: String(o.m || '').slice(0, 180),
      de: String(o.d || '').slice(0, 28),
      flores: Math.min(24, Math.max(3, parseInt(o.n, 10) || 12)),
      id: null,
    };
  } catch {
    return null;
  }
}

/** Avisa al servidor que alguien abrió el ramo de verdad (no un rastreador). */
export function registrarApertura(id) {
  if (!id) return;
  fetch('/api/regalos/' + encodeURIComponent(id), { cache: 'no-store' }).catch(() => {});
}

export async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = texto;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { /* noop */ }
    ta.remove();
    return ok;
  }
}
