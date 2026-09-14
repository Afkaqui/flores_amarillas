import { normalizeGift, RIBBONS, PAPERS, OCCASIONS } from "./gift.js";
const esc = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );
/** A deterministic botanical preview, also used for the downloadable keepsake. */
export function bouquetSVG(value) {
  const d = normalizeGift(value);
  let flowers = "";
  for (let i = 0; i < d.flores; i++) {
    const a = i * 2.39996 + d.semilla,
      r = Math.sqrt((i + 0.5) / d.flores) * 63;
    const x = 150 + Math.cos(a) * r,
      y = 85 + Math.sin(a) * r * 0.65;
    const radius = 16 + Math.sin(i * 3 + d.semilla) * 3;
    flowers += `<path d="M150 225 Q${x + 12} 140 ${x} ${y}" fill="none" stroke="#79865d" stroke-width="2"/>`;
    let petals = "";
    for (let k = 0; k < 10; k++)
      petals += `<ellipse cx="0" cy="${-radius * 0.6}" rx="${radius * 0.34}" ry="${radius * 0.62}" transform="rotate(${k * 36})" fill="${i % 3 === 0 ? "#f4d16b" : "#e7b544"}"/>`;
    flowers += `<g transform="translate(${x} ${y}) rotate(${i * 29})">${petals}<circle r="${radius * 0.29}" fill="#987137"/><circle r="${radius * 0.16}" fill="#bc9042"/></g>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 270" role="img" aria-label="Ramo de ${d.flores} flores"><path d="M65 93 L143 249 Q150 258 159 249 L234 93 Q199 134 150 116 Q105 134 65 93" fill="${PAPERS[d.papel]}" stroke="#bb9f7533"/><path d="M82 101 L148 239 L156 226 L110 121 M215 102 L153 240 L159 196" fill="none" stroke="#a58a5530" stroke-width="2"/>${flowers}<path d="M136 193 Q104 166 109 189 Q115 208 150 197 Q189 166 190 187 Q181 208 150 197 L140 245 M150 197 L176 240" fill="none" stroke="${RIBBONS[d.cinta]}" stroke-width="7" stroke-linecap="round"/><ellipse cx="150" cy="198" rx="10" ry="7" fill="${RIBBONS[d.cinta]}"/></svg>`;
}
