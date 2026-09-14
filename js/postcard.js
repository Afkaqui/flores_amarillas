import { normalizeGift, OCCASIONS } from "../shared/gift.js";
import { bouquetSVG } from "../shared/bouquet.js";
export { bouquetSVG };
function wrap(ctx, text, width) {
  const result = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const char of Array.from(paragraph)) {
      if (ctx.measureText(line + char).width > width && line) {
        result.push(line.trim());
        line = "";
      }
      line += char;
    }
    result.push(line.trim());
  }
  return result;
}
export async function guardarPostal(value) {
  const d = normalizeGift(value);
  await Promise.race([
    document.fonts.ready,
    new Promise((r) => setTimeout(r, 1500)),
  ]);
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 1600;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 1200, 1600);
  gradient.addColorStop(0, "#fffcf3");
  gradient.addColorStop(1, d.papel === "rosa" ? "#f1ded4" : "#f4e6ca");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1200, 1600);
  ctx.strokeStyle = "#c9ac754d";
  ctx.lineWidth = 2;
  ctx.strokeRect(40, 40, 1120, 1520);
  ctx.textAlign = "center";
  const img = new Image();
  const url = URL.createObjectURL(
    new Blob([bouquetSVG(d)], { type: "image/svg+xml" }),
  );
  try {
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });
    ctx.drawImage(img, 330, 70, 540, 486);
  } finally {
    URL.revokeObjectURL(url);
  }
  ctx.fillStyle = "#987647";
  ctx.font = "20px Outfit, sans-serif";
  ctx.fillText(OCCASIONS[d.ocasion].toUpperCase(), 600, 570);
  ctx.fillStyle = "#61472d";
  ctx.font = "52px Fraunces, Georgia, serif";
  ctx.fillText("Para " + d.para + ",", 600, 655, 970);
  let size = 39,
    lines;
  do {
    ctx.font = `italic ${size}px Fraunces, Georgia, serif`;
    lines = wrap(ctx, d.mensaje, 920);
    if (lines.length * size * 1.5 <= 530) break;
    size--;
  } while (size > 23);
  ctx.fillStyle = "#765a3c";
  lines.forEach((line, i) => ctx.fillText(line, 600, 750 + i * size * 1.5));
  ctx.font = "24px Outfit, sans-serif";
  ctx.fillStyle = "#9f8560";
  ctx.fillText("Con todo mi cariño,", 600, 1370);
  ctx.font = "52px Caveat, cursive";
  ctx.fillStyle = "#966a51";
  ctx.fillText(d.de || "alguien que te quiere", 600, 1435, 970);
  ctx.font = "17px Outfit, sans-serif";
  ctx.fillStyle = "#b39a76";
  ctx.fillText("flores amarillas · un pequeño jardín para ti", 600, 1500);
  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("No se pudo crear la postal");
  const download = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = download;
  a.download =
    "flores-para-" +
    d.para.replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 40) +
    ".png";
  a.click();
  setTimeout(() => URL.revokeObjectURL(download), 60000);
}
