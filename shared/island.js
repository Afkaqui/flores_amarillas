import {
  drawingPaths,
  normalizeDrawings,
  templateFlower,
  INKS,
} from "./drawing.js";
const outline =
  "M139 230 C78 166 134 94 241 89 C307 36 423 56 485 88 C602 57 711 116 704 180 C785 238 715 327 627 339 C544 402 447 359 398 338 C326 389 209 363 191 310 C141 299 112 261 139 230Z";
export function islandSVG(drawings = [], { night = false, demo = false } = {}) {
  const items = normalizeDrawings(drawings);
  const flowers =
    demo && !items.length
      ? [0, 1, 2, 3, 4, 1].map((i) => templateFlower(INKS[i]))
      : items;
  let grass = "";
  for (let i = 0; i < 96; i++) {
    const x = 137 + ((i * 137.2) % 559),
      y = 105 + ((i * 53.9) % 238),
      h = 5 + (i % 7);
    grass += `<path d="M${x} ${y}q-3 -${h} -7 -${h + 2}m7 ${h + 2}q0 -${h + 6} 3 -${h + 8}m-3 ${h + 8}q5 -${h} 10 -${h}"/>`;
  }
  const sites = [
    [255, 182],
    [420, 147],
    [585, 202],
    [326, 282],
    [500, 285],
    [614, 279],
  ];
  let blooms = "";
  flowers.forEach((flower, i) => {
    const [x, y] = sites[i];
    blooms += `<g transform="translate(${x - 55} ${y - 92}) scale(.38)">${drawingPaths(flower)}</g>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 840 455" role="img" aria-label="Un pequeño jardín con ${items.length} flores dibujadas"><defs><linearGradient id="island-grass" x2=".2" y2="1"><stop stop-color="${night ? "#6A8877" : "#BAD987"}"/><stop offset="1" stop-color="${night ? "#396451" : "#78AE69"}"/></linearGradient><clipPath id="island-clip"><path d="${outline}"/></clipPath></defs><ellipse cx="426" cy="378" rx="279" ry="34" fill="#244B3C" opacity=".1"/><path d="${outline}" transform="translate(0 27)" fill="${night ? "#24483A" : "#436F49"}"/><path d="${outline}" transform="translate(0 13)" fill="#649457"/><path d="${outline}" fill="url(#island-grass)" stroke="#73A464" stroke-width="1.5"/><g clip-path="url(#island-clip)" fill="none" stroke="${night ? "#9FBE86" : "#578C4F"}" stroke-width="1.3" opacity=".4">${grass}</g><path d="M353 332Q386 274 427 246T471 121" fill="none" stroke="#DAD5A0" stroke-width="25" opacity=".45" stroke-linecap="round"/>${blooms}<g fill="#FFF2BF"><circle cx="193" cy="152" r="3"/><circle cx="669" cy="221" r="3"/><circle cx="482" cy="323" r="3"/></g></svg>`;
}
