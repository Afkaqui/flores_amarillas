/* Prueba rápida de los escapes: node server/seguro.test.mjs */
import { escaparHtml, jsonEnLinea } from './seguro.js';

const SEP_LINEA = String.fromCharCode(0x2028);
const SEP_PARRAFO = String.fromCharCode(0x2029);
const HAY_SEPARADORES = new RegExp('[' + SEP_LINEA + SEP_PARRAFO + ']');

let fallos = 0;
const comprobar = (nombre, ok) => {
  console.log((ok ? '  ok   ' : '  FALLA') + '  ' + nombre);
  if (!ok) fallos++;
};

// 1. Un mensaje que intenta salirse del <script>
const malicioso = {
  mensaje: '</script><img src=x onerror=alert(1)>' + SEP_LINEA + 'fin',
  para: 'Ana"><b>',
};
const salida = jsonEnLinea(malicioso);

comprobar('no deja pasar </script>', !salida.includes('</script>'));
comprobar('no deja pasar < ni >', !/[<>]/.test(salida));
comprobar('no deja separadores de línea crudos', !HAY_SEPARADORES.test(salida));
comprobar('sigue siendo JSON válido', (() => {
  try { return JSON.parse(salida).mensaje === malicioso.mensaje; } catch { return false; }
})());

// 2. Las etiquetas meta
const meta = escaparHtml('Ana" /><meta property="og:title" content="pirata');
comprobar('escapa comillas y picos en meta', !/[<>"]/.test(meta));
comprobar('escapa el ampersand', escaparHtml('Ana & Luis') === 'Ana &amp; Luis');

console.log(fallos ? '\n' + fallos + ' fallo(s)' : '\ntodo bien');
process.exit(fallos ? 1 : 0);
