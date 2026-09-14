import sharp from "sharp";
import { normalizeGift, OCCASIONS } from "../shared/gift.js";
import { bouquetSVG } from "../shared/bouquet.js";
import { escaparHtml } from "./seguro.js";
const esc = escaparHtml;
export function svgDelRegalo(value) {
  const d = normalizeGift(value);
  const name = Array.from(d.para || "ti")
    .slice(0, 22)
    .join("");
  const size = name.length > 14 ? 55 : 74;
  const bouquet = bouquetSVG(d).replace(
    "<svg ",
    '<svg x="775" y="70" width="380" height="400" ',
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><defs><linearGradient id="paper" x2="1" y2="1"><stop stop-color="#fffcf2"/><stop offset="1" stop-color="#ecd7b2"/></linearGradient></defs><rect width="1200" height="630" fill="url(#paper)"/><rect x="25" y="25" width="1150" height="580" rx="6" fill="none" stroke="#b69a6450"/>${bouquet}<text x="75" y="105" font-family="DejaVu Sans" font-size="17" letter-spacing="3" fill="#a08454">UN PEQUEÑO JARDÍN PARA TI</text><text x="75" y="195" font-family="DejaVu Serif" font-size="37" fill="#8c704b">Para</text><text x="75" y="285" font-family="DejaVu Serif" font-size="${size}" fill="#60482e">${esc(name)}</text><text x="75" y="370" font-family="DejaVu Sans" font-size="23" fill="#8c704b">${esc(d.de ? d.de + " pensó en ti." : "Alguien pensó en ti.")}</text><text x="75" y="410" font-family="DejaVu Sans" font-size="23" fill="#8c704b">Tu ramo y una carta te están esperando.</text><text x="75" y="520" font-family="DejaVu Sans" font-size="18" fill="#a08454">${esc(OCCASIONS[d.ocasion])}</text><text x="75" y="565" font-family="DejaVu Serif" font-size="20" fill="#9b7a48">flores amarillas · pequeños gestos, mucho amor</text></svg>`;
}
export function svgDePortada() {
  return svgDelRegalo({
    para: "alguien especial",
    ocasion: "siempre",
    flores: 16,
  });
}
let portada;
export async function pngDePortada() {
  portada ||= sharp(Buffer.from(svgDePortada()))
    .png({ compressionLevel: 9, palette: true })
    .toBuffer()
    .catch((error) => {
      portada = null;
      throw error;
    });
  return portada;
}
const cache = new Map();
export async function pngDelRegalo(gift) {
  if (cache.has(gift.id)) return cache.get(gift.id);
  const png = await sharp(Buffer.from(svgDelRegalo(gift)))
    .png({ compressionLevel: 9, palette: true })
    .toBuffer();
  if (cache.size >= 150) cache.delete(cache.keys().next().value);
  cache.set(gift.id, png);
  return png;
}
