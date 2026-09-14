export const INKS = ["#D96675", "#E9AD35", "#ED9266", "#7586BB", "#397A50"];
export const MAX_DRAWINGS = 6;
export function normalizeDrawing(value) {
  if (!value || typeof value !== "object") return null;
  const strokes = (Array.isArray(value.strokes) ? value.strokes : [])
    .slice(0, 32)
    .map((s) => ({
      color: INKS.includes(s?.color) ? s.color : INKS[0],
      width: s?.width === 7 ? 7 : 4,
      points: (Array.isArray(s?.points) ? s.points : [])
        .slice(0, 80)
        .filter(
          (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite),
        )
        .map((p) => p.map((n) => Math.round(Math.min(300, Math.max(0, n))))),
    }))
    .filter((s) => s.points.length > 1);
  if (!strokes.length) return null;
  return {
    strokes,
    note: Array.from(String(value.note || ""))
      .slice(0, 80)
      .join(""),
  };
}
export function normalizeDrawings(value) {
  return (Array.isArray(value) ? value : [])
    .slice(0, MAX_DRAWINGS)
    .map(normalizeDrawing)
    .filter(Boolean);
}
// Midpoint curves keep the canvas and the saved SVG visually consistent.
export function strokePath(points) {
  if (!points.length) return "";
  let path = `M ${points[0].join(" ")}`;
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i],
      b = points[i + 1];
    path += ` Q ${a.join(" ")} ${(a[0] + b[0]) / 2} ${(a[1] + b[1]) / 2}`;
  }
  return path + ` L ${points.at(-1).join(" ")}`;
}
export function drawingPaths(value) {
  const d = normalizeDrawing(value);
  return d
    ? d.strokes
        .map(
          (s) =>
            `<path d="${strokePath(s.points)}" fill="none" stroke="${s.color}" stroke-width="${s.width}" stroke-linecap="round" stroke-linejoin="round"/>`,
        )
        .join("")
    : "";
}
export function drawingSVG(value) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" role="img" aria-label="Un dibujo hecho con cariño">${drawingPaths(value)}</svg>`;
}
export function templateFlower(color = INKS[0]) {
  const strokes = [
    {
      color: INKS[4],
      width: 4,
      points: [
        [150, 240],
        [148, 194],
        [151, 144],
        [150, 110],
      ],
    },
    {
      color: INKS[4],
      width: 4,
      points: [
        [150, 195],
        [116, 176],
        [104, 153],
        [133, 163],
        [150, 195],
        [176, 177],
        [185, 151],
        [163, 162],
        [150, 195],
      ],
    },
  ];
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3;
    const points = [];
    for (let j = 0; j <= 24; j++) {
      const t = (j * Math.PI * 2) / 24;
      const r = 25 + 22 * Math.cos(t);
      points.push([
        150 + Math.cos(a) * r - Math.sin(a) * Math.sin(t) * 15,
        105 + Math.sin(a) * r + Math.cos(a) * Math.sin(t) * 15,
      ]);
    }
    strokes.push({ color, width: 4, points });
  }
  return normalizeDrawing({ strokes, note: "" });
}

export function templateDrawing(kind, color = INKS[0]) {
  if (kind === "flower") return templateFlower(color);
  let points;
  if (kind === "heart") {
    points = Array.from({ length: 65 }, (_, i) => {
      const t = (i * Math.PI * 2) / 64;
      return [
        150 + 5 * 16 * Math.sin(t) ** 3,
        145 -
          5 *
            (13 * Math.cos(t) -
              5 * Math.cos(2 * t) -
              2 * Math.cos(3 * t) -
              Math.cos(4 * t)),
      ];
    });
  } else {
    points = [
      [150, 62],
      [171, 125],
      [236, 150],
      [172, 174],
      [150, 237],
      [128, 174],
      [64, 150],
      [127, 125],
      [150, 62],
    ];
  }
  return normalizeDrawing({ strokes: [{ color, width: 4, points }], note: "" });
}
