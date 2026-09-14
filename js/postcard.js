import { normalizeGift, OCCASIONS } from "../shared/gift.js";
import { drawingSVG } from "../shared/drawing.js";
import { bouquetSVG } from "../shared/bouquet.js";
export { bouquetSVG };
function wrap(ctx, text, width) {
  const lines = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? line + " " + word : word;
      if (ctx.measureText(candidate).width <= width) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      line = "";
      // Keep normal words together, but safely wrap a long unbroken dedication.
      for (const char of Array.from(word)) {
        if (line && ctx.measureText(line + char).width > width) {
          lines.push(line);
          line = "";
        }
        line += char;
      }
    }
    lines.push(line);
  }
  return lines;
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
async function loadLetterFonts() {
  let timer;
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load("400 34px Fraunces"),
        document.fonts.load("italic 400 27px Fraunces"),
        document.fonts.load("400 32px Caveat"),
        document.fonts.load("400 14px Outfit"),
      ]),
      new Promise((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                "Las letras de tu carta aún están cargando. Intenta guardar de nuevo.",
              ),
            ),
          10000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** Lay out the whole letter before painting so no attachment is clipped. */
export async function renderPostal(value) {
  const d = normalizeGift(value);
  const [photos, drawings] = await Promise.all([
    Promise.all(d.fotos.map(loadImage)),
    Promise.all(d.dibujos.map((drawing) => loadSVG(drawingSVG(drawing)))),
    loadLetterFonts(),
  ]);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const width = 600,
    inset = 52,
    content = width - inset * 2;
  const paint = [];
  let y = 54;
  const paragraph = (
    text,
    { font, color, line = 24, x = inset, maxWidth = content, align = "left" },
  ) => {
    ctx.font = font;
    const lines = wrap(ctx, text, maxWidth);
    const top = y;
    paint.push(() => {
      ctx.font = font;
      ctx.fillStyle = color;
      ctx.textAlign = align;
      ctx.textBaseline = "top";
      lines.forEach((text, i) => ctx.fillText(text, x, top + i * line));
    });
    y += lines.length * line;
  };
  function paper(x, top, w, h, fill, radii = 12) {
    ctx.save();
    ctx.shadowColor = "#80604812";
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 5;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(x, top, w, h, radii);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "#e9ddd1";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
  function tape(center, top) {
    ctx.save();
    ctx.translate(center, top);
    ctx.rotate((-5 * Math.PI) / 180);
    ctx.fillStyle = "#e1dcc2a3";
    ctx.fillRect(-25, -7, 50, 14);
    ctx.restore();
  }
  // The same small occasion mark as the top of the opened letter.
  paint.push(() => {
    ctx.save();
    ctx.translate(inset + 12, 61);
    ctx.fillStyle = "#b98b3d";
    for (let i = 0; i < 5; i++) {
      const angle = (i * Math.PI * 2) / 5;
      ctx.beginPath();
      ctx.ellipse(
        Math.cos(angle) * 7,
        Math.sin(angle) * 7,
        4.6,
        4.6,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.restore();
  });
  paragraph(OCCASIONS[d.ocasion].toUpperCase(), {
    font: "11px Outfit",
    color: "#a18960",
    line: 17,
    x: inset + 38,
    maxWidth: content - 38,
  });
  y += 38;
  paragraph("Para " + d.para + ",", {
    font: "400 34px Fraunces",
    color: d.ambiente === "noche" ? "#504950" : "#34513f",
    line: 43,
  });
  y += 30;
  paragraph(d.mensaje, {
    font: "italic 400 27px Fraunces",
    color: "#705439",
    line: 44,
  });
  y += 38;
  paragraph("Con todo mi cariño,", {
    font: "13px Outfit",
    color: "#a18a69",
    line: 20,
  });
  y += 6;
  paragraph(d.de || "alguien que te quiere", {
    font: "32px Caveat",
    color: "#8b6650",
    line: 39,
  });
  y += 38;
  if (d.recuerdos.length) {
    paragraph("CADA FLOR GUARDA ALGO BONITO", {
      font: "11px Outfit",
      color: "#889477",
      line: 18,
    });
    y += 18;
    d.recuerdos.forEach((memory) => {
      paragraph(memory, { font: "20px Fraunces", color: "#65775a", line: 29 });
      y += 16;
    });
    y += 12;
  }
  // Two notes per row, matching the letter gallery, with natural caption heights.
  for (let i = 0; i < drawings.length; i += 2) {
    const row = drawings.slice(i, i + 2);
    const noteWidth = 206,
      gap = 26;
    const start = (width - row.length * noteWidth - (row.length - 1) * gap) / 2;
    ctx.font = "24px Caveat";
    const notes = row.map((_, j) =>
      d.dibujos[i + j].note
        ? wrap(ctx, d.dibujos[i + j].note, noteWidth - 28)
        : [],
    );
    const heights = notes.map(
      (lines) => 190 + (lines.length ? 10 + lines.length * 28 : 0),
    );
    const top = y + 10;
    paint.push(() =>
      row.forEach((image, j) => {
        const x = start + j * (noteWidth + gap),
          h = heights[j];
        ctx.save();
        ctx.translate(x + noteWidth / 2, top + h / 2);
        ctx.rotate(((j % 2 ? 2 : -2) * Math.PI) / 180);
        ctx.translate(-noteWidth / 2, -h / 2);
        paper(0, 0, noteWidth, h, j % 2 ? "#fcf6f2" : "#fffcf7", [3, 3, 20, 3]);
        ctx.drawImage(image, 23, 12, 160, 160);
        ctx.font = "24px Caveat";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = "#738066";
        notes[j].forEach((line, k) =>
          ctx.fillText(line, noteWidth / 2, 182 + k * 28),
        );
        tape(noteWidth / 2, 0);
        ctx.restore();
      }),
    );
    y += Math.max(...heights) + 48;
  }
  if (photos.length) {
    y += 4;
    paragraph("PEDACITOS DE LO NUESTRO", {
      font: "12px Outfit",
      color: "#889477",
      line: 18,
    });
    y += 28;
  }
  photos.forEach((image, i) => {
    const scale = Math.min(
      (content - 32) / image.naturalWidth,
      440 / image.naturalHeight,
    );
    const imageW = image.naturalWidth * scale,
      imageH = image.naturalHeight * scale;
    const caption =
      d.momentos.find((m) => m.foto === d.fotos[i])?.texto ||
      "Un momento que quería guardar contigo.";
    ctx.font = "18px Fraunces";
    const lines = wrap(ctx, caption, content - 70);
    const h = 16 + imageH + 24 + lines.length * 27 + 22,
      top = y;
    paint.push(() => {
      paper(inset, top, content, h, "#fffefa", 16);
      ctx.drawImage(image, (width - imageW) / 2, top + 16, imageW, imageH);
      tape(width / 2, top);
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.font = "11px Outfit";
      ctx.fillStyle = "#a0a58d";
      ctx.fillText(
        String(i + 1).padStart(2, "0"),
        inset + 18,
        top + imageH + 43,
      );
      ctx.font = "18px Fraunces";
      ctx.fillStyle = "#65775a";
      lines.forEach((line, k) =>
        ctx.fillText(line, inset + 46, top + imageH + 40 + k * 27),
      );
    });
    y += h + 36;
  });
  if (d.voz) {
    const id =
      value?.id ||
      location.pathname.match(/^\/r\/([a-z0-9]{7})$/)?.[1] ||
      window.__createdGift?.id;
    const url =
      id && /^[a-z0-9]{7}$/.test(id) ? location.origin + "/r/" + id : "";
    const top = y;
    paint.push(() => paper(inset, top, content, url ? 118 : 96, "#fcf1ed", 16));
    y += 18;
    paragraph("Un poquito de mi voz ♡", {
      font: "22px Caveat",
      color: "#977280",
      line: 28,
      x: inset + 20,
      maxWidth: content - 40,
    });
    paragraph("Escúchala al abrir el enlace de este regalo.", {
      font: "13px Outfit",
      color: "#87746b",
      line: 22,
      x: inset + 20,
      maxWidth: content - 40,
    });
    if (url)
      paragraph(url, {
        font: "11px Outfit",
        color: "#87746b",
        line: 18,
        x: inset + 20,
        maxWidth: content - 40,
      });
    y = Math.max(y + 20, top + (url ? 118 : 96)) + 32;
  }
  y += 12;
  const footerY = y;
  paint.push(() => {
    ctx.strokeStyle = "#dce0d3";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(inset, footerY);
    ctx.lineTo(width - inset, footerY);
    ctx.stroke();
  });
  y += 24;
  paragraph("flores amarillas · pequeños gestos, mucho amor", {
    font: "11px Outfit",
    color: "#a19c86",
    line: 18,
    align: "center",
    x: width / 2,
  });
  y += 40;
  canvas.width = width * 2;
  canvas.height = Math.ceil(y * 2);
  ctx.scale(2, 2);
  ctx.fillStyle = "#fffaf0";
  ctx.fillRect(0, 0, width, y);
  ctx.strokeStyle = "#b9a07530";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(12, 12, width - 24, y - 24, 6);
  ctx.stroke();
  for (const draw of paint) draw();
  return canvas;
}
export async function guardarPostal(value) {
  const d = normalizeGift(value);
  const canvas = await renderPostal(value);
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
