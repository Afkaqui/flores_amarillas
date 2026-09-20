import { normalizeGift, OCCASIONS } from "../shared/gift.js";
import { escaparHtml, jsonEnLinea } from "./seguro.js";

export function giftDocument(html, r, origin) {
  const titulo = `Unas flores para ${r.para}`;
  const descripcion = r.de
    ? `${r.de} te dejó un pequeño jardín. ${OCCASIONS[r.ocasion] || OCCASIONS.primavera}.`
    : "Alguien pensó en ti y te dejó un pequeño jardín.";
  const url = `${origin}/r/${r.id}`;
  const imagen = `${origin}/og/${r.id}.png?v=20260920`;

  // El mensaje NO va en la vista previa: es para quien abre, no para el grupo.
  const meta = `
  <link rel="canonical" href="${escaparHtml(url)}" />
  <meta name="robots" content="noindex, nofollow" />
  <meta name="description" content="${escaparHtml(descripcion)}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Flores para ti" />
  <meta property="og:locale" content="es_PE" />
  <meta property="og:title" content="${escaparHtml(titulo)}" />
  <meta property="og:description" content="${escaparHtml(descripcion)}" />
  <meta property="og:url" content="${escaparHtml(url)}" />
  <meta property="og:image" content="${escaparHtml(imagen)}" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${escaparHtml(titulo)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escaparHtml(titulo)}" />
  <meta name="twitter:description" content="${escaparHtml(descripcion)}" />
  <meta name="twitter:image" content="${escaparHtml(imagen)}" />
  <script>window.__REGALO__ = ${jsonEnLinea({
    ...normalizeGift(r),
    id: r.id,
  })};</script>`;

  // Se reemplazan las etiquetas genéricas por las de este regalo.
  return html
    // Fuera TODAS las etiquetas por defecto del HTML: si quedan, WhatsApp
    // se queda con la primera og:image que encuentra (la portada genérica)
    // en vez de la de este ramo.
    .replace(/<meta\s+(property="og:|name="twitter:)[^>]*>/g, "")
    .replace(/<meta\s+name="(?:description|robots)"[^>]*>/g, "")
    .replace(/<link rel="canonical"[^>]*>/g, "")
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, "")
    .replace("</head>", `${meta}\n</head>`)
    .replace(
      /<title>[^<]*<\/title>/,
      `<title>${escaparHtml(titulo)} · Flores Amarillas</title>`,
    );

}
