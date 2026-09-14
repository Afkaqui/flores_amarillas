import { normalizeDrawings } from "./drawing.js";
export const COMPOSITIONS = {
  sencillo: "Sencillo",
  silvestre: "Silvestre",
  abundante: "Abundante",
};
export const DEFAULT_MESSAGE =
  "Gracias por hacer florecer mis días. Estas flores son una pequeña forma de decirte lo mucho que te quiero.";
export const RIBBONS = { rosa: "#b76e79", miel: "#b97f32", lavanda: "#9383b5" };
export const PAPERS = { marfil: "#f5e8d0", rosa: "#ecd3cc", kraft: "#c5a57d" };
export const OCCASIONS = {
  primavera: "21 de septiembre",
  amor: "Porque te quiero",
  aniversario: "Nuestro aniversario",
  cumple: "Feliz cumpleaños",
  siempre: "Un día para recordarte",
};
const text = (value, max) =>
  Array.from(String(value ?? "").trim())
    .slice(0, max)
    .join("");
const option = (value, options, fallback) =>
  Object.hasOwn(options, value) ? value : fallback;

/** Shared by the browser, API and previews; old gifts keep working. */
export function normalizeGift(value = {}) {
  const data = value && typeof value === "object" ? value : {};
  const fotos = (Array.isArray(data.fotos) ? data.fotos : [])
    .slice(0, 3)
    .filter(
      (v) => typeof v === "string" && /^\/media\/[a-f0-9]{48}\.webp$/.test(v),
    );
  const momentos = fotos.map((foto) => ({
    foto,
    texto: text(
      (Array.isArray(data.momentos) ? data.momentos : []).find(
        (item) => item?.foto === foto,
      )?.texto,
      120,
    ),
  }));
  return {
    version: 2,
    para: text(data.para ?? data.p, 28),
    mensaje: text(data.mensaje ?? data.m, 360),
    de: text(data.de ?? data.d, 28),
    flores: Math.min(
      24,
      Math.max(3, parseInt(data.flores ?? data.n, 10) || 12),
    ),
    cinta: option(data.cinta, RIBBONS, "rosa"),
    papel: option(data.papel, PAPERS, "marfil"),
    ambiente: data.ambiente === "noche" ? "noche" : "atardecer",
    ocasion: option(data.ocasion, OCCASIONS, "primavera"),
    recuerdos: (Array.isArray(data.recuerdos) ? data.recuerdos : [])
      .slice(0, 3)
      .map((v) => text(v, 60))
      .filter(Boolean),
    composicion: option(data.composicion, COMPOSITIONS, "silvestre"),
    dibujos: normalizeDrawings(data.dibujos),
    fotos,
    momentos,
    voz:
      typeof data.voz === "string" &&
      /^\/media\/[a-f0-9]{48}\.(webm|mp4|ogg)$/.test(data.voz)
        ? data.voz
        : "",
    permitirRespuesta: data.permitirRespuesta === true,
    semilla: Number.isFinite(data.semilla)
      ? Math.max(0, Math.min(0.999999, data.semilla))
      : 0.421,
  };
}
