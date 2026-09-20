import anime from "animejs";
export const $ = (selector) => document.querySelector(selector);
export const reducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
);
export const duration = (ms) => (reducedMotion.matches ? 0 : ms);
export const pause = (ms) =>
  new Promise((resolve) => setTimeout(resolve, duration(ms)));

function animate(options, settle) {
  const ms = duration(options.duration || 0);
  if (!ms) {
    settle();
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      instance.pause();
      settle();
      resolve();
    };
    const instance = anime({ ...options, duration: ms, complete: finish });
    const timer = setTimeout(finish, ms + (options.delay || 0) + 150);
  });
}
export function mostrar(el, { y = 12, duracion = 500 } = {}) {
  el.classList.remove("hidden");
  return animate(
    {
      targets: el,
      opacity: [0, 1],
      translateY: [y, 0],
      duration: duracion,
      easing: "easeOutCubic",
    },
    () => {
      el.style.opacity = "";
      el.style.transform = "";
    },
  );
}
export function ocultar(el, { duracion = 350 } = {}) {
  return animate(
    { targets: el, opacity: 0, duration: duracion, easing: "easeInOutQuad" },
    () => {
      el.classList.add("hidden");
      el.style.opacity = "";
      el.style.transform = "";
    },
  );
}
export function lluviaDePetalos(cantidad = 18) {
  if (reducedMotion.matches || document.hidden) return;
  const capa = $("#petal-layer");
  const available = Math.max(0, 50 - capa.childElementCount);
  for (let i = 0; i < Math.min(cantidad, available); i++) {
    const p = document.createElement("div");
    p.className = "petal";
    p.style.left = Math.random() * 100 + "%";
    p.style.width = 8 + Math.random() * 8 + "px";
    p.style.height = 11 + Math.random() * 9 + "px";
    capa.appendChild(p);
    const anim = anime({
      targets: p,
      translateY: [-40, innerHeight + 80],
      translateX: (Math.random() - 0.5) * 220,
      rotate: Math.random() * 380,
      duration: 5000 + Math.random() * 2500,
      delay: Math.random() * 900,
      easing: "linear",
      complete: () => p.remove(),
    });
    setTimeout(() => {
      anim.pause();
      p.remove();
    }, 9000);
  }
}
let toastTimer;
export function toast(text, ms = 3200) {
  const el = $("#toast");
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), ms);
}
export function animarContador(el, _from, to) {
  el.textContent = to;
}
let finishWriting = () => {};
export function completarCarta() {
  finishWriting();
}
export function escribir(el, texto, { delay = 350 } = {}) {
  finishWriting();
  const chars = typeof Intl.Segmenter === "function"
    ? Array.from(new Intl.Segmenter("es", { granularity: "grapheme" }).segment(texto), (part) => part.segment)
    : Array.from(texto);
  let timer;
  let count = 0;
  const finish = () => {
    clearTimeout(timer);
    el.textContent = texto;
    $("#btn-skip").classList.add("hidden");
    finishWriting = () => {};
  };
  finishWriting = finish;
  el.setAttribute("aria-label", texto);
  if (reducedMotion.matches || document.hidden || !chars.length) {
    finish();
    return;
  }
  el.textContent = "";
  $("#btn-skip").classList.remove("hidden");
  const tick = () => {
    if (document.hidden) return finish();
    count++;
    el.textContent = chars.slice(0, count).join("");
    if (count >= chars.length) return finish();
    const char = chars[count - 1];
    const wait = /\n/.test(char) ? 600
      : /[.!?…]/.test(char) && chars[count] !== "." ? 480
      : /[,;:]/.test(char) ? 240
      : /\s/.test(char) ? 40
      : 70;
    // Advance one character at a time, even when a slow device delays a tick.
    timer = setTimeout(tick, wait);
  };
  timer = setTimeout(tick, delay);
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden) finishWriting();
});
reducedMotion.addEventListener("change", (e) => {
  if (e.matches) {
    finishWriting();
    $("#petal-layer").replaceChildren();
  }
});
let activeModal = null,
  previousFocus = null;
const focusable = (el) =>
  [
    ...el.querySelectorAll(
      'button:not(:disabled),input,textarea,select,a[href],summary,[tabindex="0"]',
    ),
  ].filter((e) => e.getClientRects().length && !e.closest(".hidden"));
export function abrirModal(el) {
  if (activeModal) cerrarModal(activeModal);
  previousFocus = document.activeElement;
  activeModal = el;
  for (const sibling of document.body.children)
    if (sibling !== el && sibling.id !== "toast") sibling.inert = true;
  el.inert = false;
  document.dispatchEvent(
    new CustomEvent("flores:modal", { detail: { open: true } }),
  );
  el.classList.remove("hidden");
  requestAnimationFrame(() => (focusable(el)[0] || el).focus());
  // Keep the full-screen backdrop stable; animate only its paper panel.
  return mostrar(el.querySelector(".modal-card"), { y: 10, duracion: 220 });
}
export function cerrarModal(el) {
  el.classList.add("hidden");
  el.style.opacity = "";
  el.style.transform = "";
  if (activeModal === el) {
    activeModal = null;
    document.dispatchEvent(
      new CustomEvent("flores:modal", { detail: { open: false } }),
    );
    for (const sibling of document.body.children) sibling.inert = false;
    if (previousFocus?.isConnected) previousFocus.focus();
  }
  return Promise.resolve();
}
window.addEventListener("keydown", (e) => {
  if (!activeModal) return;
  if (e.key === "Escape") {
    e.preventDefault();
    cerrarModal(activeModal);
  }
  if (e.key === "Tab") {
    const list = focusable(activeModal);
    if (!list.length) return;
    const first = list[0],
      last = list.at(-1);
    if (
      e.shiftKey &&
      (document.activeElement === first ||
        !activeModal.contains(document.activeElement))
    ) {
      e.preventDefault();
      last.focus();
    } else if (
      !e.shiftKey &&
      (document.activeElement === last ||
        !activeModal.contains(document.activeElement))
    ) {
      e.preventDefault();
      first.focus();
    }
  }
});
