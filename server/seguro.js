
export const escaparHtml = (t = '') =>
  String(t)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const BARRA = String.fromCharCode(92);          // el carácter \
const SEP_LINEA = String.fromCharCode(0x2028);
const SEP_PARRAFO = String.fromCharCode(0x2029);

// U+2028 y U+2029 son saltos de línea de verdad para JavaScript (no para JSON),
// así que crudos dentro de un <script> lo parten en dos.
const SEPARADORES = new RegExp('[' + SEP_LINEA + SEP_PARRAFO + ']', 'g');

/** Devuelve la secuencia de escape de un carácter, p. ej. 0x3c -> < */
const escapeU = (cp) => BARRA + 'u' + cp.toString(16).padStart(4, '0');

/** JSON listo para incrustar dentro de un <script> sin que se escape de él. */
export const jsonEnLinea = (o) =>
  JSON.stringify(o)
    .replace(/</g, escapeU(0x3c))
    .replace(/>/g, escapeU(0x3e))
    .replace(SEPARADORES, (c) => escapeU(c.charCodeAt(0)));
