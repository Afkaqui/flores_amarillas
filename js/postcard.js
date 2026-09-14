import { normalizeGift, OCCASIONS } from "../shared/gift.js";
import { drawingSVG } from "../shared/drawing.js";
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
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timer = setTimeout(() => {
      image.onload = image.onerror = null;
      reject(
        new Error("Una imagen tardó demasiado. Intenta guardar de nuevo."),
      );
    }, 12000);
    image.onload = () => {
      clearTimeout(timer);
      resolve(image);
    };
    image.onerror = () => {
      clearTimeout(timer);
      reject(
        new Error(
          "No se pudo cargar una foto. No guardamos una postal incompleta.",
        ),
      );
    };
    image.src = src;
  });
}
async function loadSVG(svg) {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    return await loadImage(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}
export async function renderPostal(value) {
  const d = normalizeGift(value);
  await Promise.race([
    document.fonts.ready,
    new Promise((r) => setTimeout(r, 1500)),
  ]);
  const [photos, drawings, bouquet] = await Promise.all([
    Promise.all(d.fotos.map(loadImage)),
    Promise.all(d.dibujos.map((d) => loadSVG(drawingSVG(d)))),
    loadSVG(bouquetSVG(d)),
  ]);
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  const extraHeight =
    photos.length * 850 +
    Math.ceil(drawings.length / 3) * 420 +
    (d.recuerdos.length ? 100 + d.recuerdos.length * 85 : 0) +
    (d.voz ? 140 : 0);
  const ctx = canvas.getContext("2d");
  let size = 39,
    lines;
  do {
    ctx.font = `italic ${size}px Fraunces, Georgia, serif`;
    lines = wrap(ctx, d.mensaje, 920);
    if (lines.length * size * 1.5 <= 530) break;
    size--;
  } while (size > 23);
  const baseHeight = extraHeight
    ? Math.max(1120, 1000 + lines.length * size * 1.5)
    : 1600;
  canvas.height = Math.ceil(baseHeight + extraHeight);
  const gradient = ctx.createLinearGradient(0, 0, 1200, canvas.height);
  gradient.addColorStop(0, "#fffcf3");
  gradient.addColorStop(1, d.papel === "rosa" ? "#f1ded4" : "#f4e6ca");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1200, canvas.height);
  ctx.strokeStyle = "#c9ac754d";
  ctx.lineWidth = 2;
  ctx.strokeRect(40, 40, 1120, canvas.height - 80);
  ctx.textAlign = "center";
  ctx.drawImage(bouquet, 330, 70, 540, 486);
  ctx.fillStyle = "#987647";
  ctx.font = "20px Outfit, sans-serif";
  ctx.fillText(OCCASIONS[d.ocasion].toUpperCase(), 600, 570);
  ctx.fillStyle = "#61472d";
  ctx.font = "52px Fraunces, Georgia, serif";
  ctx.fillText("Para " + d.para + ",", 600, 655, 970);
  ctx.font = `italic ${size}px Fraunces, Georgia, serif`;
  ctx.fillStyle = "#765a3c";
  lines.forEach((line, i) => ctx.fillText(line, 600, 750 + i * size * 1.5));
  ctx.font = "24px Outfit, sans-serif";
  ctx.fillStyle = "#9f8560";
  ctx.fillText("Con todo mi cariño,", 600, baseHeight - 230);
  ctx.font = "52px Caveat, cursive";
  ctx.fillStyle = "#966a51";
  ctx.fillText(d.de || "alguien que te quiere", 600, baseHeight - 165, 970);
  let y = baseHeight - 70;
  if (d.recuerdos.length) {
    ctx.font = "22px Outfit, sans-serif";
    ctx.fillStyle = "#748267";
    ctx.fillText("PEQUEÑAS RAZONES PARA QUERERTE", 600, y);
    y += 65;
    ctx.font = "30px Fraunces, Georgia, serif";
    ctx.fillStyle = "#617253";
    for (const memory of d.recuerdos) {
      wrap(ctx, memory, 920).forEach((line, i) =>
        ctx.fillText(line, 600, y + i * 38),
      );
      y += 85;
    }
    y += 35;
  }
  for (let i = 0; i < drawings.length; i += 3) {
    const row = drawings.slice(i, i + 3),
      start = (1200 - row.length * 340) / 2;
    row.forEach((image, j) => {
      const x = start + j * 340;
      ctx.fillStyle = "#fffefa";
      ctx.fillRect(x + 10, y, 320, 385);
      ctx.drawImage(image, x + 40, y + 15, 260, 260);
      ctx.fillStyle = "#718063";
      let noteSize = 24,
        noteLines;
      do {
        ctx.font = `${noteSize}px Fraunces, Georgia, serif`;
        noteLines = wrap(ctx, d.dibujos[i + j].note, 285);
        if (noteLines.length <= 4) break;
        noteSize--;
      } while (noteSize > 11);
      noteLines.forEach((line, k) =>
        ctx.fillText(line, x + 170, y + 292 + k * 24),
      );
    });
    y += 420;
  }
  photos.forEach((image, i) => {
    const w = image.naturalWidth,
      h = image.naturalHeight,
      scale = Math.min(960 / w, 600 / h);
    ctx.fillStyle = "#fffefa";
    ctx.fillRect(100, y, 1000, 805);
    ctx.strokeStyle = "#e2d9c9";
    ctx.strokeRect(100, y, 1000, 805);
    ctx.drawImage(
      image,
      600 - (w * scale) / 2,
      y + 25 + (600 - h * scale) / 2,
      w * scale,
      h * scale,
    );
    ctx.fillStyle = "#6c7c5d";
    ctx.font = "31px Fraunces, Georgia, serif";
    const caption =
      d.momentos.find((item) => item.foto === d.fotos[i])?.texto ||
      "Un momento que quería guardar contigo.";
    wrap(ctx, caption, 910)
      .slice(0, 4)
      .forEach((line, k) => ctx.fillText(line, 600, y + 673 + k * 38));
    y += 850;
  });
  if (d.voz) {
    ctx.font = "24px Outfit, sans-serif";
    ctx.fillStyle = "#977280";
    ctx.fillText("Esta carta también tiene una nota de voz.", 600, y + 25);
    ctx.fillText("Puedes escucharla en el enlace del regalo.", 600, y + 65);
    const id =
      value?.id ||
      (typeof window !== "undefined" && window.__createdGift?.id) ||
      location.pathname.match(/^\/r\/([a-z0-9]{7})$/)?.[1];
    if (id && /^[a-z0-9]{7}$/.test(id)) {
      ctx.font = "20px Outfit, sans-serif";
      ctx.fillText(location.origin + "/r/" + id, 600, y + 102, 980);
    }
  }
  ctx.font = "17px Outfit, sans-serif";
  ctx.fillStyle = "#9a967f";
  ctx.fillText(
    "flores amarillas · un pequeño jardín para ti",
    600,
    canvas.height - 70,
  );
  return canvas;
}
export async function guardarPostal(value) {
  const d = normalizeGift(value);
  const canvas = await renderPostal(d);
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
