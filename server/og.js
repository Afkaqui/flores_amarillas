import sharp from 'sharp';

/* ============================================================
   Imagen de vista previa (la que sale en WhatsApp): 1200x630.
   Se arma como SVG y se rasteriza con sharp — WhatsApp no muestra SVG.
   ============================================================ */

const ANCHO = 1200;
const ALTO = 630;

/** Las tipografías son las que instala el Dockerfile (fonts-dejavu-core). */
const SERIF = 'DejaVu Serif, Georgia, serif';
const SANS = 'DejaVu Sans, sans-serif';

const escapar = (t = '') =>
  String(t)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const recortar = (t, n) => (t.length > n ? t.slice(0, n - 1) + '…' : t);

/** Una flor amarilla de 8 pétalos centrada en (cx, cy) */
function flor(cx, cy, r, giro = 0, opacidad = 1) {
  const petalos = Array.from({ length: 8 }, (_, i) => {
    const a = giro + (i * 360) / 8;
    return `<ellipse cx="0" cy="${-r * 0.62}" rx="${r * 0.3}" ry="${r * 0.62}"
              transform="rotate(${a})" fill="url(#petalo)" />`;
  }).join('');
  return `
    <g transform="translate(${cx} ${cy})" opacity="${opacidad}">
      ${petalos}
      <circle r="${r * 0.34}" fill="#8A5A17" />
      <circle cx="${-r * 0.1}" cy="${-r * 0.1}" r="${r * 0.12}" fill="#B5822C" />
    </g>`;
}

export function svgDelRegalo({ para, de, flores = 12 }) {
  const nombre = escapar(recortar(para || 'ti', 18));
  const firma = de
    ? `${escapar(recortar(de, 20))} te mandó flores amarillas`
    : 'Alguien te mandó flores amarillas';

  // un ramito decorativo, con el tamaño según cuántas flores tiene el regalo
  const ramo = [
    flor(980, 250, 74, 6),
    flor(1080, 330, 62, 20, 0.95),
    flor(900, 360, 58, 34, 0.92),
    flor(1010, 430, 50, 12, 0.88),
    flores >= 12 ? flor(880, 190, 44, 25, 0.8) : '',
    flores >= 18 ? flor(1120, 210, 40, 48, 0.75) : '',
  ].join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO}" height="${ALTO}"
               viewBox="0 0 ${ANCHO} ${ALTO}">
    <defs>
      <linearGradient id="fondo" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#FFFBEF" />
        <stop offset="0.55" stop-color="#FFF0C8" />
        <stop offset="1" stop-color="#F8DC94" />
      </linearGradient>
      <linearGradient id="petalo" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#FFD84A" />
        <stop offset="1" stop-color="#E08A00" />
      </linearGradient>
    </defs>

    <rect width="${ANCHO}" height="${ALTO}" fill="url(#fondo)" />
    <circle cx="1010" cy="315" r="300" fill="#FFFFFF" opacity="0.28" />
    ${ramo}

    <rect x="80" y="92" width="286" height="44" rx="22" fill="#FFFFFF" opacity="0.72" />
    <text x="104" y="121" font-family="${SANS}" font-size="19" letter-spacing="3.4"
          fill="#8A6B24">21 DE SEPTIEMBRE</text>

    <text x="80" y="246" font-family="${SERIF}" font-size="56" fill="#6B5227">Para</text>
    <text x="80" y="346" font-family="${SERIF}" font-size="92" font-weight="bold"
          fill="#33261A">${nombre}</text>

    <text x="80" y="418" font-family="${SANS}" font-size="30" fill="#5A4322">${escapar(firma)}</text>

    <rect x="80" y="486" width="10" height="46" rx="5" fill="#F2A007" />
    <text x="108" y="508" font-family="${SANS}" font-size="24" fill="#7A5A18">Ábrelas: tu ramo te espera</text>
    <text x="108" y="536" font-family="${SANS}" font-size="19" fill="#A08A5E">amarillas.pascare.tech</text>
  </svg>`;
}

/** La misma estampa pero sin destinatario: es la que sale al compartir la portada. */
export function svgDePortada() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO}" height="${ALTO}"
               viewBox="0 0 ${ANCHO} ${ALTO}">
    <defs>
      <linearGradient id="fondo" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#FFFBEF" />
        <stop offset="0.55" stop-color="#FFF0C8" />
        <stop offset="1" stop-color="#F8DC94" />
      </linearGradient>
      <linearGradient id="petalo" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#FFD84A" />
        <stop offset="1" stop-color="#E08A00" />
      </linearGradient>
    </defs>

    <rect width="${ANCHO}" height="${ALTO}" fill="url(#fondo)" />
    <circle cx="1010" cy="315" r="300" fill="#FFFFFF" opacity="0.28" />
    ${flor(980, 250, 74, 6)}
    ${flor(1080, 330, 62, 20, 0.95)}
    ${flor(900, 360, 58, 34, 0.92)}
    ${flor(1010, 430, 50, 12, 0.88)}
    ${flor(880, 190, 44, 25, 0.8)}

    <rect x="80" y="92" width="286" height="44" rx="22" fill="#FFFFFF" opacity="0.72" />
    <text x="104" y="121" font-family="${SANS}" font-size="19" letter-spacing="3.4"
          fill="#8A6B24">21 DE SEPTIEMBRE</text>

    <text x="80" y="266" font-family="${SERIF}" font-size="78" font-weight="bold"
          fill="#33261A">Flores</text>
    <text x="80" y="356" font-family="${SERIF}" font-size="78" font-weight="bold"
          fill="#33261A">Amarillas</text>

    <text x="80" y="424" font-family="${SANS}" font-size="30" fill="#5A4322">Siembra tu jardin y regala un ramo</text>

    <rect x="80" y="486" width="10" height="46" rx="5" fill="#F2A007" />
    <text x="108" y="508" font-family="${SANS}" font-size="24" fill="#7A5A18">Un jardin que crece contigo</text>
    <text x="108" y="536" font-family="${SANS}" font-size="19" fill="#A08A5E">amarillas.pascare.tech</text>
  </svg>`;
}

let portada = null;
export async function pngDePortada() {
  if (!portada) {
    portada = await sharp(Buffer.from(svgDePortada()))
      .png({ compressionLevel: 9, palette: true })
      .toBuffer();
  }
  return portada;
}

/** SVG -> PNG. El resultado se cachea: un regalo nunca cambia. */
const cache = new Map();

export async function pngDelRegalo(regalo) {
  const clave = regalo.id;
  if (cache.has(clave)) return cache.get(clave);

  const png = await sharp(Buffer.from(svgDelRegalo(regalo)))
    .png({ compressionLevel: 9, palette: true })
    .toBuffer();

  if (cache.size > 500) cache.clear();   // tope tonto pero suficiente
  cache.set(clave, png);
  return png;
}
