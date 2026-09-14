import anime from 'animejs';

export const $ = (sel) => document.querySelector(sel);

/*
 * anime.js congela sus animaciones cuando la pestaña se oculta y, al volver,
 * a veces no reanuda: la promesa `finished` no resuelve nunca y el flujo se
 * queda trabado. Toda espera de UI corre contra un reloj de respaldo.
 */
function corre(instancia, msMax) {
  return Promise.race([
    instancia.finished,
    new Promise((r) => setTimeout(r, msMax)),
  ]);
}

/* ---------- helpers de visibilidad ---------- */
export function mostrar(el, { y = 24, duracion = 700, delay = 0 } = {}) {
  el.classList.remove('hidden');
  const inst = anime({
    targets: el,
    opacity: [0, 1],
    translateY: [y, 0],
    duration: duracion,
    delay,
    easing: 'easeOutExpo',
  });
  return corre(inst, duracion + delay + 250).then(() => {
    el.style.opacity = '1';
    el.style.transform = '';
  });
}

export function ocultar(el, { y = -18, duracion = 500 } = {}) {
  const inst = anime({
    targets: el,
    opacity: 0,
    translateY: y,
    duration: duracion,
    easing: 'easeInQuad',
  });
  return corre(inst, duracion + 250).then(() => {
    el.classList.add('hidden');
    el.style.opacity = '';
    el.style.transform = '';
  });
}

/* ---------- título letra por letra ---------- */
export function partirTexto(el) {
  const html = el.innerHTML;
  el.innerHTML = html.replace(/([^<>]+)(?=<|$)/g, (txt) =>
    txt.replace(/\S/g, "<span class='char'>$&</span>")
  );
  return el.querySelectorAll('.char');
}

export function animarTitulo(el, delay = 0) {
  const chars = partirTexto(el);
  return anime({
    targets: chars,
    opacity: [0, 1],
    translateY: [64, 0],
    rotateZ: [() => anime.random(-22, 22), 0],
    scale: [0.6, 1],
    duration: 1200,
    delay: anime.stagger(38, { start: delay }),
    easing: 'easeOutElastic(1, .7)',
  });
}

/* ---------- lluvia de pétalos ---------- */
export function lluviaDePetalos(cantidad = 40, { duracionBase = 5200 } = {}) {
  const capa = document.getElementById('petal-layer');
  const W = window.innerWidth;

  for (let i = 0; i < cantidad; i++) {
    const p = document.createElement('div');
    p.className = 'petal';
    const s = 0.55 + Math.random() * 0.95;
    p.style.left = Math.random() * W + 'px';
    p.style.width = p.style.height = 16 * s + 'px';
    p.style.opacity = 0.65 + Math.random() * 0.35;
    capa.appendChild(p);

    const deriva = (Math.random() - 0.5) * 320;
    anime({
      targets: p,
      translateY: [-80, window.innerHeight + 120],
      translateX: [
        { value: deriva * 0.6, duration: duracionBase * 0.5, easing: 'easeInOutSine' },
        { value: deriva, duration: duracionBase * 0.5, easing: 'easeInOutSine' },
      ],
      rotateZ: anime.random(-540, 540),
      rotateX: anime.random(0, 360),
      duration: duracionBase + Math.random() * 2600,
      delay: Math.random() * 1800,
      easing: 'linear',
      complete: () => p.remove(),
    });
  }
}

/* ---------- toast ---------- */
let toastTimer;
export function toast(mensaje, ms = 2400) {
  const el = document.getElementById('toast');
  el.textContent = mensaje;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

/* ---------- contador animado ---------- */
export function animarContador(el, desde, hasta) {
  const prox = { v: desde };
  anime({
    targets: prox,
    v: hasta,
    duration: 600,
    round: 1,
    easing: 'easeOutCubic',
    update: () => { el.textContent = prox.v; },
  });
  anime({
    targets: el,
    scale: [1, 1.28, 1],
    duration: 520,
    easing: 'easeOutBack',
  });
}

/* ---------- máquina de escribir ---------- */
export function escribir(el, texto, { velocidad = 34, delay = 200 } = {}) {
  el.textContent = '';
  const caret = document.createElement('span');
  caret.className = 'caret';
  el.appendChild(caret);

  return new Promise((resolve) => {
    let i = 0;
    setTimeout(function paso() {
      if (i >= texto.length) {
        setTimeout(() => { caret.remove(); resolve(); }, 700);
        return;
      }
      caret.insertAdjacentText('beforebegin', texto[i++]);
      setTimeout(paso, velocidad);
    }, delay);
  });
}

/* ---------- modales ---------- */
export function abrirModal(el) {
  el.classList.remove('hidden');
  const card = el.querySelector('.modal-card, .card');
  anime({ targets: el, opacity: [0, 1], duration: 260, easing: 'easeOutQuad' });
  const inst = anime({
    targets: card,
    opacity: [0, 1],
    translateY: [40, 0],
    scale: [0.92, 1],
    duration: 700,
    easing: 'easeOutElastic(1, .8)',
  });
  return corre(inst, 950).then(() => {
    el.style.opacity = '1';
    card.style.opacity = '1';
  });
}

export function cerrarModal(el) {
  const card = el.querySelector('.modal-card, .card');
  anime({ targets: card, opacity: 0, translateY: 24, scale: 0.95, duration: 260, easing: 'easeInQuad' });
  const inst = anime({ targets: el, opacity: 0, duration: 300, delay: 80, easing: 'easeInQuad' });
  return corre(inst, 650).then(() => {
    el.classList.add('hidden');
    el.style.opacity = '';
    if (card) { card.style.opacity = ''; card.style.transform = ''; }
  });
}
