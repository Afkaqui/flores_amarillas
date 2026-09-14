import * as THREE from 'three';
import anime from 'animejs';
import { Garden, espera } from './garden.js';
import { crearEnlace, leerRegalo, copiar, registrarApertura } from './share.js';
import { Musica } from './audio.js';
import {
  $, mostrar, ocultar, animarTitulo, lluviaDePetalos,
  toast, animarContador, escribir, abrirModal, cerrarModal,
} from './ui.js';

// Si anime.js suspende su motor al ocultarse la pestaña, al volver puede no
// reanudarlo y deja el flujo colgado. Preferimos que siga su curso.
anime.suspendWhenDocumentHidden = false;

/* ============================================================
   Estado
   ============================================================ */
const estado = {
  modo: 'intro',        // intro | jardin | ramo | regalo
  sembradas: 0,
  primeraSiembra: true,
  enlace: '',
};

const canvas = $('#scene');
const jardin = new Garden(canvas);
jardin.sembrarCampo(30, { rMin: 3.5, rMax: 22 });
jardin.iniciar();

// acceso para depurar desde la consola
window.__jardin = jardin;

/* ============================================================
   Música de fondo
   ============================================================ */
const musica = new Musica('S7gMzYqXIZc');
const btnSonido = $('#btn-sound');
btnSonido.disabled = true;

musica.onCambio = (sonando) => btnSonido.classList.toggle('sonando', sonando);
musica.preparar().then((ok) => {
  btnSonido.disabled = !ok;
  if (!ok) btnSonido.title = 'La música no se pudo cargar';
});

btnSonido.addEventListener('click', () => {
  const sonando = musica.alternar();
  toast(sonando ? 'Música 🎵' : 'Silencio 🤫', 1400);
});

/* ============================================================
   Vista fija: la cámara deja de girar sola
   ============================================================ */
const btnVista = $('#btn-view');

function pintarVista(fija) {
  btnVista.classList.toggle('fijada', fija);
  btnVista.setAttribute('aria-pressed', String(fija));
  btnVista.title = fija ? 'Soltar la vista (F)' : 'Fijar la vista (F)';
  btnVista.setAttribute('aria-label', btnVista.title);
}

function alternarVista(avisar = true) {
  const fija = jardin.fijarVista(!jardin.vistaFijada);
  pintarVista(fija);
  try { localStorage.setItem('floresVistaFija', fija ? '1' : '0'); } catch { /* sin storage */ }
  if (avisar) toast(fija ? 'Vista fija 📌 · igual puedes arrastrar' : 'La cámara vuelve a girar ↻');
}

try {
  if (localStorage.getItem('floresVistaFija') === '1') pintarVista(jardin.fijarVista(true));
} catch { /* sin storage */ }

btnVista.addEventListener('click', () => alternarVista());

/** Arranca la música aprovechando el gesto del usuario (el navegador lo exige) */
function arrancarMusica() {
  if (musica.disponible && !musica.sonando) musica.reproducir();
}

/* ============================================================
   Arranque
   ============================================================ */
const regalo = leerRegalo();

window.addEventListener('load', async () => {
  await espera(650);
  await ocultar($('#loader'), { y: 0, duracion: 700 });

  if (regalo) {
    estado.modo = 'regalo';
    jardin.autoRotar(true);
    jardin.volar(new THREE.Vector3(0, 4.2, 12), new THREE.Vector3(0, 1.6, 0), 3200);
    $('#reveal-sub').textContent = regalo.de
      ? `${regalo.de} te mandó flores. Es 21 de septiembre.`
      : 'Ábrelas. Es 21 de septiembre.';
    await mostrar($('#reveal'), { y: 30 });
    animarTitulo($('.reveal-title'), 120);
    lluviaDePetalos(18, { duracionBase: 9000 });
  } else if (estado.modo === 'intro') {
    await mostrar($('#intro'), { y: 30 });
    animarTitulo($('.title'), 120);
  }
});

/* ============================================================
   Intro
   ============================================================ */
$('#btn-enter').addEventListener('click', async () => {
  arrancarMusica();
  estado.modo = 'jardin';
  ocultar($('#intro'));
  jardin.vistaJardin(3000);
  await espera(700);
  mostrar($('#hud-top'), { y: -20, duracion: 600 });
  mostrar($('#hud-bottom'), { y: 30, duracion: 600, delay: 120 });
  jardin.sembrarAlAzar(7, { retraso: 500 });
  actualizarContador(7);
});

$('#btn-how').addEventListener('click', () => abrirModal($('#help-modal')));
$('#help-close').addEventListener('click', () => cerrarModal($('#help-modal')));
$('#help-ok').addEventListener('click', () => cerrarModal($('#help-modal')));

/* ============================================================
   Sembrar tocando el pasto
   ============================================================ */
let pressX = 0, pressY = 0, pressT = 0;

canvas.addEventListener('pointerdown', (e) => {
  pressX = e.clientX; pressY = e.clientY; pressT = performance.now();
});

canvas.addEventListener('pointerup', (e) => {
  if (estado.modo !== 'jardin') return;
  const dist = Math.hypot(e.clientX - pressX, e.clientY - pressY);
  if (dist > 8 || performance.now() - pressT > 600) return; // fue un arrastre

  const punto = jardin.puntoEnSuelo(e.clientX / window.innerWidth, e.clientY / window.innerHeight);
  if (!punto) { toast('Siembra dentro del claro 🌱'); return; }

  jardin.sembrar(punto);
  actualizarContador(1);
  brotePolen(punto);

  if (estado.primeraSiembra) {
    estado.primeraSiembra = false;
    const tip = $('#tip');
    anime({ targets: tip, opacity: [1, 0], duration: 300, easing: 'easeInQuad', complete: () => {
      tip.textContent = 'Arrastra para girar · rueda para acercarte';
      anime({ targets: tip, opacity: [0, 1], duration: 400 });
    }});
  }
});

function brotePolen() {
  lluviaDePetalos(4, { duracionBase: 3200 });
}

function actualizarContador(delta) {
  const el = $('#counter-num');
  const antes = estado.sembradas;
  estado.sembradas += delta;
  animarContador(el, antes, estado.sembradas);
}

$('#btn-seed').addEventListener('click', () => {
  if (estado.modo !== 'jardin') return;
  jardin.sembrarAlAzar(5);
  actualizarContador(5);
  lluviaDePetalos(8, { duracionBase: 4200 });
});

$('#btn-reset').addEventListener('click', () => {
  if (estado.modo !== 'jardin') return;
  jardin.limpiar();
  const antes = estado.sembradas;
  estado.sembradas = 0;
  animarContador($('#counter-num'), antes, 0);
  toast('Jardín en blanco. A sembrar de nuevo 🌱');
});

/* ============================================================
   Modal de regalo
   ============================================================ */
const gift = $('#gift-modal');

$('#btn-gift').addEventListener('click', () => {
  if (estado.modo !== 'jardin') return;
  abrirModal(gift);
  setTimeout(() => $('#f-to').focus(), 400);
});
$('#gift-close').addEventListener('click', () => cerrarModal(gift));
$('#gift-cancel').addEventListener('click', () => cerrarModal(gift));

$('#f-msg').addEventListener('input', (e) => {
  $('#f-msg-count').textContent = e.target.value.length;
});
$('#f-size').addEventListener('input', (e) => {
  $('#f-size-val').textContent = e.target.value;
});

$('#gift-submit').addEventListener('click', async () => {
  const datos = {
    para: $('#f-to').value.trim(),
    mensaje: $('#f-msg').value.trim() || 'Porque hoy florece todo, y me acordé de ti.',
    de: $('#f-from').value.trim(),
    flores: parseInt($('#f-size').value, 10),
  };
  if (!datos.para) {
    toast('¿Para quién es el ramo? 🌼');
    anime({ targets: $('#f-to'), translateX: [0, -8, 8, -6, 6, 0], duration: 420, easing: 'easeInOutSine' });
    $('#f-to').focus();
    return;
  }

  estado.modo = 'ramo';
  // Se pide el enlace corto mientras corre la animación del ramo: para cuando
  // aparece la tarjeta ya está listo, y si el servidor falla cae al hash.
  const enlacePendiente = crearEnlace(datos);
  await cerrarModal(gift);
  ocultar($('#hud-bottom'), { y: 40, duracion: 400 });

  await jardin.armarRamo(datos.flores);
  lluviaDePetalos(46);
  estado.enlace = await enlacePendiente;
  await espera(1200);
  await mostrarTarjeta(datos, 'autor');
});

/* ============================================================
   Tarjeta
   ============================================================ */
const capaTarjeta = $('#card-layer');

async function mostrarTarjeta(datos, rol) {
  $('#c-to').textContent = datos.para || 'ti';
  $('#c-from').textContent = datos.de || 'alguien que te quiere';
  $('#c-msg').textContent = '';

  const acciones = $('#card-actions');
  acciones.style.visibility = 'hidden';

  await abrirModal(capaTarjeta);
  await escribir($('#c-msg'), datos.mensaje, { velocidad: 32, delay: 350 });

  $('#btn-copy').textContent = rol === 'autor' ? 'Copiar enlace del regalo' : 'Hacer mi propio ramo';
  $('#btn-back').textContent = rol === 'autor' ? 'Volver al jardín' : 'Ver el ramo';
  acciones.style.visibility = 'visible';
  anime({ targets: acciones.children, opacity: [0, 1], translateY: [14, 0], delay: anime.stagger(90), duration: 500, easing: 'easeOutQuad' });
  capaTarjeta.dataset.rol = rol;
}

$('#btn-copy').addEventListener('click', async () => {
  if (capaTarjeta.dataset.rol === 'autor') {
    const ok = await copiar(estado.enlace);
    toast(ok ? '¡Enlace copiado! Ya puedes mandarlo 💛' : estado.enlace);
  } else {
    location.href = location.origin + location.pathname;
  }
});

$('#btn-back').addEventListener('click', async () => {
  await cerrarModal(capaTarjeta);
  if (capaTarjeta.dataset.rol === 'autor') {
    estado.modo = 'jardin';
    mostrar($('#hud-bottom'), { y: 30, duracion: 500 });
    jardin.deshacerRamo();
  } else {
    jardin.controls.autoRotateSpeed = 0.4;
    jardin.autoRotar(true);
  }
});

/* ============================================================
   Modo regalo recibido
   ============================================================ */
$('#btn-open').addEventListener('click', async () => {
  arrancarMusica();
  registrarApertura(regalo.id);
  ocultar($('#reveal'));
  lluviaDePetalos(60);
  jardin.vistaRamo(2400);
  await jardin.ramoSorpresa(regalo.flores);
  await espera(1100);
  await mostrarTarjeta(regalo, 'invitado');
});

/* ============================================================
   Teclado
   ============================================================ */
window.addEventListener('keydown', (e) => {
  const escribiendo = /^(INPUT|TEXTAREA)$/.test(e.target.tagName);

  if (e.key === 'Escape') {
    if (!gift.classList.contains('hidden')) cerrarModal(gift);
    else if (!$('#help-modal').classList.contains('hidden')) cerrarModal($('#help-modal'));
    return;
  }
  if (!escribiendo && (e.key === 'f' || e.key === 'F')) alternarVista();
});
