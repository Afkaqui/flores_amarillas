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
  const size = Math.min(74, Math.floor(600 / Math.max(1, Array.from(name).length * 0.68)));
  const sender = Array.from(d.de || "").slice(0, 30).join("");
  const bouquet = bouquetSVG(d).replace(
    "<svg ",
    '<svg x="775" y="70" width="380" height="400" ',
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><defs><linearGradient id="paper" x2="1" y2="1"><stop stop-color="#fffcf2"/><stop offset="1" stop-color="#f0eedf"/></linearGradient></defs><rect width="1200" height="630" fill="url(#paper)"/><rect x="25" y="25" width="1150" height="580" rx="6" fill="none" stroke="#b69a6450"/>${bouquet}<text x="75" y="105" font-family="DejaVu Sans" font-size="17" letter-spacing="3" fill="#a08454">UN PEQUEÑO JARDÍN PARA TI</text><text x="75" y="195" font-family="DejaVu Serif" font-size="37" fill="#8c704b">Para</text><text x="75" y="285" font-family="DejaVu Serif" font-size="${size}" fill="#34503e">${esc(name)}</text><text x="75" y="370" font-family="DejaVu Sans" font-size="23" fill="#8c704b">${esc(sender ? sender + " pensó en ti." : "Alguien pensó en ti.")}</text><text x="75" y="410" font-family="DejaVu Sans" font-size="23" fill="#8c704b">Tu ramo y una carta te están esperando.</text><text x="75" y="520" font-family="DejaVu Sans" font-size="18" fill="#a08454">${esc(OCCASIONS[d.ocasion])}</text><text x="75" y="565" font-family="DejaVu Serif" font-size="20" fill="#9b7a48">floresparati.site · pequeños gestos, mucho amor</text></svg>`;
}
export function svgDePortada() {
  const bouquet = bouquetSVG({ flores: 16, cinta: "rosa", papel: "marfil", semilla: 0.421 })
    .replace("<svg ", '<svg x="735" y="65" width="410" height="460" ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <rect width="1200" height="630" fill="#fbf7ec"/>
    <rect x="24" y="24" width="1152" height="582" rx="24" fill="none" stroke="#d8d9c5"/>
    <rect x="745" y="58" width="380" height="495" rx="180" fill="#e8eddf"/>
    ${bouquet}
    <text x="76" y="117" font-family="DejaVu Sans" font-size="17" letter-spacing="3" fill="#7a825f">PEQUEÑOS GESTOS. MUCHO AMOR.</text>
    <text x="70" y="230" font-family="DejaVu Serif" font-size="76" fill="#34503e">Flores para ti.</text>
    <text x="76" y="315" font-family="DejaVu Serif" font-size="35" fill="#a5757d">Un detalle que florece.</text>
    <text x="76" y="385" font-family="DejaVu Sans" font-size="24" fill="#6c715c">Un ramo, una carta y un pedacito</text>
    <text x="76" y="422" font-family="DejaVu Sans" font-size="24" fill="#6c715c">de lo que sientes.</text>
    <rect x="76" y="479" width="240" height="52" rx="26" fill="#34503e"/>
    <text x="196" y="512" text-anchor="middle" font-family="DejaVu Sans" font-size="19" fill="#fffbed">Crea su sorpresa</text>
    <text x="76" y="578" font-family="DejaVu Sans" font-size="17" fill="#7a825f">floresparati.site · Gratis y sin registro</text>
  </svg>`;
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
