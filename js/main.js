import { track, startVisitMetrics } from "./metrics.js";
import { setIconContent } from "./icons.js";
import { mountFlowerReasons } from "./flower-reasons.js";
import { openEnvelope } from "./envelope.js";
import * as THREE from "three";
import anime from "animejs";
import { GardenFallback } from "./garden-fallback.js";
import { initCreator } from "./creator.js";
import { Garden } from "./garden.js";
import {
  crearEnlace,
  enlaceConHash,
  leerRegalo,
  copiar,
  registrarApertura,
  mensajeParaCompartir,
  enlaceWhatsApp,
} from "./share.js";
import { Musica } from "./audio.js";
import {
  $,
  mostrar,
  ocultar,
  lluviaDePetalos,
  toast,
  escribir,
  completarCarta,
  abrirModal,
  cerrarModal,
  pause,
  reducedMotion,
} from "./ui.js";
import { normalizeGift, DEFAULT_MESSAGE, OCCASIONS } from "../shared/gift.js";
import { bouquetSVG, guardarPostal } from "./postcard.js";
anime.suspendWhenDocumentHidden = false;
startVisitMetrics();
const flowerReasons = mountFlowerReasons($("#memory-list"));
const giftDock = $("#gift-dock");
function fitLetterAboveDock() {
  if (!giftDock.getClientRects().length) return;
  const clearance = Math.ceil(innerHeight - giftDock.getBoundingClientRect().top + 12);
  document.documentElement.style.setProperty("--gift-dock-clearance", `${clearance}px`);
}
new ResizeObserver(fitLetterAboveDock).observe(giftDock);
window.addEventListener("resize", fitLetterAboveDock, { passive: true });

const STORE = "flores-jardin-v2",
  DRAFT = "flores-carta-v2",
  AMBIENT_PREFERENCE = "flores-ambiente-v1";
const readStorage = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
};
const writeStorage = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
};
const received = leerRegalo();
const savedAmbient = readStorage(AMBIENT_PREFERENCE);
const initialAmbient = ["noche", "atardecer"].includes(savedAmbient)
  ? savedAmbient
  : matchMedia("(pointer: coarse), (max-width: 767px)").matches
    ? "noche"
    : "atardecer";
let current = normalizeGift({
  permitirRespuesta: true,
  semilla: Math.random(),
  ...readStorage(DRAFT),
  ambiente: initialAmbient,
});
document.body.dataset.ambiente = received?.ambiente || initialAmbient;
let role = received ? "invitado" : "autor",
  mode = "intro",
  busy = false,
  link = "",
  linkGeneration = 0;
let linkState = "idle";
let opened = false,
  musicWanted = true,
  musicReady = null,
  audioContext;
const music = new Musica("S7gMzYqXIZc");
const canvas = $("#scene");
let garden;
try {
  garden = new Garden(canvas);
} catch (error) {
  garden = new GardenFallback(canvas);
}
window.__jardin = garden;
canvas.addEventListener("webglcontextlost", (event) => {
  event.preventDefault();
  if (garden instanceof GardenFallback) return;
  cancelAnimationFrame(garden._raf);
  garden.controls?.dispose?.();
  garden = new GardenFallback(canvas);
  window.__jardin = garden;
  garden.presentarRamo(current);
  toast("Seguimos en modo ilustrado. Tu regalo está a salvo.");
});
document.addEventListener("flores:modal", (event) => {
  garden.editorPausado = event.detail.open;
  if (event.detail.open) closeMemory(false);
  if (!event.detail.open)
    queueMicrotask(() => {
      if (mode === "intro" && !busy) setVisible("#intro", true);
    });
});
const setMode = (value) => {
  mode = value;
  document.body.dataset.mode = value;
};
const setVisible = (id, visible) => $(id).classList.toggle("hidden", !visible);
function setAmbient(value) {
  const night = value === "noche";
  garden.aplicarEstilo({ ambiente: night ? "noche" : "atardecer" });
  document.body.dataset.ambiente = night ? "noche" : "atardecer";
  $("#ambient-label").textContent = night ? "Luciérnagas" : "Tarde de sol";
  setIconContent($("#btn-ambient").firstElementChild, night ? "moon" : "sun");
  $("#btn-ambient").setAttribute(
    "aria-label",
    night ? "Cambiar a tarde de sol" : "Cambiar a noche de luciérnagas",
  );
}
$("#btn-ambient").addEventListener("click", () => {
  const ambient =
    document.body.dataset.ambiente === "noche" ? "atardecer" : "noche";
  setAmbient(ambient);
  writeStorage(AMBIENT_PREFERENCE, ambient);
  if (role === "autor" && !["ramo", "preparando"].includes(mode)) {
    $("#f-ambient").value = ambient;
    saveDraft();
  }
});
function updateView() {
  const fixed = garden.vistaFijada;
  $("#btn-view").setAttribute("aria-pressed", String(fixed));
  $("#btn-view").setAttribute(
    "aria-label",
    fixed ? "Permitir giro suave" : "Fijar la vista",
  );
  $("#btn-view").title =
    (fixed ? "Permitir giro suave" : "Fijar la vista") + " (F)";
}
function toggleView() {
  if (reducedMotion.matches) {
    toast("La vista permanece quieta con movimiento reducido.");
    return;
  }
  garden.fijarVista(!garden.vistaFijada);
  garden.autoRotar(true);
  updateView();
  writeStorage("flores-vista-v2", garden.vistaFijada);
}
const fixedPreference = readStorage("flores-vista-v2");
garden.fijarVista(fixedPreference !== false);
updateView();
$("#btn-view").addEventListener("click", toggleView);
window.addEventListener("keydown", (e) => {
  if (
    !e.repeat &&
    e.key.toLowerCase() === "f" &&
    !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) &&
    !document.querySelector(".modal:not(.hidden)")
  )
    toggleView();
});

music.onCambio = (playing) => {
  setIconContent($("#btn-sound"), musicWanted ? "music" : "music-off");
  $("#btn-sound").setAttribute("aria-pressed", String(musicWanted));
  $("#btn-sound").setAttribute(
    "aria-label",
    musicWanted ? "Silenciar música" : "Activar música",
  );
  $("#btn-sound").title = musicWanted ? "Silenciar música" : "Activar música";
};
music.onError = () => {
  musicWanted = false;
  music.onCambio(false);
  toast("La música no está disponible ahora. Tu jardín sigue aquí.");
};
async function toggleMusic(want = !musicWanted, { quiet = false } = {}) {
  musicWanted = want;
  $("#reveal-music").checked = want;
  music.onCambio(music.sonando);
  if (!want) {
    music.pausar();
    return;
  }
  if (document.hidden || music.suspendida) return;
  if (!musicReady) musicReady = music.preparar();
  setIconContent($("#btn-sound"), "loader");
  const ok = await musicReady;
  setIconContent($("#btn-sound"), musicWanted ? "music" : "music-off");
  if (!ok) {
    musicReady = null;
    if (!quiet)
      toast("No pudimos cargar la música. Puedes volver a intentarlo.");
    return;
  }
  if (musicWanted && !document.hidden && !music.suspendida) {
    music.volumen = 5;
    music.reproducir();
    music.atenuar(26, reducedMotion.matches ? 0 : 1400);
  }
}
$("#btn-sound").addEventListener("click", () => toggleMusic());
$("#reveal-music").addEventListener("change", (event) =>
  toggleMusic(event.target.checked),
);
function startDefaultMusic(event) {
  if (
    document.hidden || music.suspendida ||
    !musicWanted ||
    music.sonando ||
    event.target.closest?.("#btn-sound, #reveal-music, .voice-player")
  )
    return;
  if (music.disponible) {
    music.reproducir();
    music.atenuar(26, reducedMotion.matches ? 0 : 1400);
  } else toggleMusic(true, { quiet: true });
}
document.addEventListener("pointerdown", startDefaultMusic, { capture: true });
document.addEventListener("keydown", startDefaultMusic, { capture: true });
function pausePageAudio() {
  music.suspender(true);
  audioContext?.suspend().catch(() => {});
}
function resumePageAudio() {
  if (document.hidden) return;
  music.suspender(false);
  if (musicWanted) toggleMusic(true, { quiet: true });
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pausePageAudio();
  else resumePageAudio();
});
window.addEventListener("pagehide", pausePageAudio);
window.addEventListener("pageshow", resumePageAudio);
toggleMusic(true, { quiet: true });
document.addEventListener("flores:voice-play", () => music.atenuar(4, 200));
document.addEventListener("flores:voice-stop", () => {
  if (
    ![...document.querySelectorAll(".voice-player audio")].some(
      (audio) => !audio.paused,
    )
  )
    music.atenuar(26, 400);
});
function seedSound() {
  if (!musicWanted || document.hidden || music.suspendida) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    audioContext.resume();
    const oscillator = audioContext.createOscillator(),
      gain = audioContext.createGain(),
      now = audioContext.currentTime;
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(660, now);
    oscillator.frequency.exponentialRampToValueAtTime(990, now + 0.2);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.045, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.36);
  } catch {
    /* sound is optional */
  }
}

let creator;
function formData() {
  return normalizeGift({
    ...creator?.read(),
    para: $("#f-to").value,
    mensaje: $("#f-msg").value,
    de: $("#f-from").value,
    flores: $("#f-size").value,
    cinta: $("#gift-form input[name=cinta]:checked").value,
    papel: $("#gift-form input[name=papel]:checked").value,
    ambiente: $("#f-ambient").value,
    ocasion: $("#f-occasion").value,
    recuerdos: [1, 2, 3].map((i) => $("#f-memory-" + i).value),
    semilla: current.semilla,
  });
}
function fillForm(data) {
  creator?.load(data);
  $("#f-to").value = data.para;
  $("#f-msg").value = data.mensaje;
  $("#f-from").value = data.de;
  $("#f-size").value = data.flores;
  $("#gift-form input[name=cinta][value=" + data.cinta + "]").checked = true;
  $("#gift-form input[name=papel][value=" + data.papel + "]").checked = true;
  $("#f-ambient").value = data.ambiente;
  $("#f-occasion").value = data.ocasion;
  [1, 2, 3].forEach(
    (i) => ($("#f-memory-" + i).value = data.recuerdos[i - 1] || ""),
  );
  updatePreview();
}
function updatePreview() {
  const data = formData();
  $("#f-msg-count").textContent = Array.from($("#f-msg").value).length;
  $("#f-size-val").textContent = data.flores;
  $("#bouquet-preview").innerHTML = bouquetSVG(data);
  creator?.refresh(data);
}
function saveDraft() {
  const data = formData();
  current = data;
  const saved = writeStorage(DRAFT, data);
  $("#draft-note").textContent = saved
    ? "Tu carta está guardada en este dispositivo"
    : "Tu carta estará aquí mientras mantengas esta página abierta";
  updatePreview();
}
$("#gift-form").addEventListener("input", saveDraft);
$("#gift-form").addEventListener("change", saveDraft);
$("#f-ambient").addEventListener("change", (event) => {
  writeStorage(AMBIENT_PREFERENCE, event.target.value);
});
const suggestions = {
  amor: "Si pudiera regalarte algo que dure para siempre, sería la forma en que te miro. Gracias por hacer florecer mis días.",
  gracias:
    "Por escucharme, por acompañarme y por hacer más bonitos los días sencillos. Este pequeño jardín es mi manera de darte las gracias.",
  distancia:
    "Aunque hoy no pueda llevártelas en persona, estas flores van llenas de abrazos. Te siento cerquita, incluso desde aquí.",
};
for (const button of document.querySelectorAll("[data-message]"))
  button.addEventListener("click", () => {
    $("#f-msg").value = suggestions[button.dataset.message];
    saveDraft();
    $("#f-msg").focus();
  });
creator = initCreator({
  getGift: formData,
  setGift: fillForm,
  save: saveDraft,
  getReceived: () => received,
  onExit: enterGarden,
});
fillForm(current);

function saveGarden() {
  const flowers = garden.exportarJardin();
  $("#counter-num").textContent = flowers.length;
  const saved = writeStorage(STORE, flowers);
  $("#save-note").textContent = saved
    ? "Tu jardín está guardado en este dispositivo"
    : "Mantén esta página abierta para conservar tu jardín";
}
function plant(amount) {
  if (mode !== "jardin" || busy) return;
  const count = garden.exportarJardin().length,
    available = Math.min(amount, 100 - count);
  if (!available) {
    toast("Tu jardín ya tiene 100 flores. Es momento de preparar un ramo.");
    return;
  }
  garden.sembrarAlAzar(available, { duracion: 1100 });
  saveGarden();
  seedSound();
  lluviaDePetalos(5);
}
let press = null;
canvas.addEventListener("pointerdown", (e) => {
  press = {
    x: e.clientX,
    y: e.clientY,
    time: performance.now(),
    id: e.pointerId,
  };
});
canvas.addEventListener("pointercancel", () => {
  press = null;
});
canvas.addEventListener("pointerup", (e) => {
  if (!press || e.pointerId !== press.id) return;
  const valid =
    Math.hypot(e.clientX - press.x, e.clientY - press.y) < 8 &&
    performance.now() - press.time < 600;
  press = null;
  if (!valid || busy) return;
  if (mode === "ramo") {
    const memory = garden.recuerdoEnPunto(
      e.clientX / innerWidth,
      e.clientY / innerHeight,
    );
    if (memory) showMemory(memory);
    return;
  }
  if (mode !== "jardin") return;
  if (garden.exportarJardin().length >= 100) {
    toast("Ya florecieron 100. ¿Preparamos tu regalo?");
    return;
  }
  const point = garden.puntoEnSuelo(
    e.clientX / innerWidth,
    e.clientY / innerHeight,
  );
  if (!point) {
    toast("Toca el pasto dentro del jardín.");
    return;
  }
  garden.sembrar(point);
  saveGarden();
  seedSound();
  $("#tip").textContent = "Una flor más, una razón más para sonreír.";
});
async function enterGarden() {
  if (busy) return;
  busy = true;
  completarCarta();
  cerrarModal($("#gift-modal"));
  closeMemory(false);
  setVisible("#card-layer", false);
  setVisible("#gift-dock", false);
  setVisible("#reveal", false);
  await ocultar($("#intro"));
  garden.eliminarRamo();
  setMode("jardin");
  role = "autor";
  setVisible("#counter", true);
  setVisible("#hud-bottom", true);
  garden.controls.enabled = true;
  await garden.vistaJardin(1400);
  busy = false;
  saveGarden();
}
$("#btn-enter").addEventListener("click", async () => {
  track("creator_started");
  await ocultar($("#intro"));
  creator.go(0, false);
  abrirModal($("#gift-modal"));
});
$("#btn-seed").addEventListener("click", () => plant(5));
$("#btn-gift").addEventListener("click", () => {
  if (!busy) {
    track("creator_started");
    abrirModal($("#gift-modal"));
  }
});
$("#gift-close").addEventListener("click", () => {
  if ($("#gift-form").classList.contains("assistant-mode"))
    $("#assistant-close").click();
  else cerrarModal($("#gift-modal"));
});

$("#btn-how").addEventListener("click", () => abrirModal($("#help-modal")));
$("#help-close").addEventListener("click", () => cerrarModal($("#help-modal")));
$("#help-ok").addEventListener("click", async () => {
  if (busy) return;
  cerrarModal($("#help-modal"));
  await enterGarden();
  $("#btn-seed").focus({ preventScroll: true });
});
$("#btn-reset").addEventListener("click", () => abrirModal($("#reset-modal")));
$("#reset-cancel").addEventListener("click", () =>
  cerrarModal($("#reset-modal")),
);
$("#reset-confirm").addEventListener("click", () => {
  garden.borrarSiembras();
  saveGarden();
  cerrarModal($("#reset-modal"));
  toast("Un nuevo comienzo. Tu carta sigue guardada.");
});

function closeMemory(restoreFocus = true) {
  flowerReasons.collapse(restoreFocus);
}
async function showMemory(text) {
  if (document.querySelector(".modal:not(.hidden)")) return;
  if ($("#card-layer").classList.contains("hidden")) await showCard(false);
  if ($("#card-layer").classList.contains("hidden") ||
      document.querySelector(".modal:not(.hidden)")) return;
  flowerReasons.setReasons(current.recuerdos);
  flowerReasons.revealText(text);
}
let cardEntry = 0;
let cardMotion = null;
async function showCard(animate = true) {
  const entry = ++cardEntry;
  cardMotion?.cancel();
  cardMotion = null;
  const layer = $("#card-layer");
  const entering = layer.classList.contains("hidden");
  const dockEntering = giftDock.classList.contains("hidden");
  setVisible("#btn-share", true);
  $("#c-to").textContent = current.para || "ti";
  $("#c-from").textContent = current.de || "alguien que te quiere";
  $("#c-occasion").textContent = OCCASIONS[current.ocasion];
  creator.renderLetter(current);
  if (animate) escribir($("#c-msg"), current.mensaje, { delay: entering ? 1000 : 350 });
  else {
    completarCarta();
    $("#c-msg").textContent = current.mensaje;
    $("#c-msg").setAttribute("aria-label", current.mensaje);
    setVisible("#btn-skip", false);
  }
  const guest = role === "invitado";
  setIconContent($("#btn-share"), guest ? "arrow-down" : "arrow-up-right",
    guest ? "Guardar este recuerdo" : "Compartir regalo");
  setVisible("#btn-download", !guest);
  setVisible("#btn-copy", !guest);
  setVisible("#btn-edit", !guest);
  $("#btn-back").textContent = guest
    ? "Crear mi propio regalo"
    : "Volver al jardín";
  flowerReasons.setReasons(current.recuerdos);
  if (entering) $(".card").scrollTop = 0;
  setVisible("#gift-dock", true);
  fitLetterAboveDock();
  if (dockEntering && !reducedMotion.matches)
    giftDock.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 450,
      delay: 350,
      easing: "ease-out",
      fill: "backwards",
    });
  setVisible("#card-layer", true);
  if (entering && !reducedMotion.matches) {
    const motion = layer.animate(
      [{ opacity: 0, transform: "translateY(18px)" },
       { opacity: 1, transform: "translateY(0)" }],
      { duration: 800, easing: "cubic-bezier(.22,.61,.36,1)", fill: "both" },
    );
    cardMotion = motion;
    let timeout;
    await Promise.race([
      motion.finished.catch(() => {}),
      new Promise((resolve) => { timeout = setTimeout(resolve, 950); }),
    ]);
    clearTimeout(timeout);
    if (cardMotion === motion) {
      motion.cancel();
      cardMotion = null;
    }
  }
  if (entry !== cardEntry || layer.classList.contains("hidden") ||
      document.querySelector(".modal:not(.hidden)")) return;
  $("#card-heading").tabIndex = -1;
  $("#card-heading").focus({ preventScroll: true });
}
async function presentGift(data, guest = false) {
  if (busy) return;
  busy = true;
  current = data;
  role = guest ? "invitado" : "autor";
  completarCarta();
  setVisible("#card-layer", false);
  setVisible("#gift-dock", false);
  setVisible("#hud-bottom", false);
  setVisible("#counter", false);
  closeMemory(false);
  await cerrarModal($("#gift-modal"));
  setMode("preparando");
  setVisible("#preparing", true);
  setAmbient(data.ambiente);
  try {
    await garden.presentarRamo(data);
    lluviaDePetalos(22);
    setMode("ramo");
    await ocultar($("#preparing"), { duracion: 180 });
    await pause(300);
    await showCard();
  } finally {
    setVisible("#preparing", false);
    busy = false;
  }
}
$("#gift-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (busy) return;
  if (creator.pending()) {
    toast("Termina de guardar tus fotos o tu voz antes de ver el regalo.");
    return;
  }
  const data = formData();
  if (!data.para) {
    creator.go(0);
    $("#f-to").focus();
    return;
  }
  if (!data.mensaje) data.mensaje = DEFAULT_MESSAGE;
  current = data;
  fillForm(data);
  writeStorage(DRAFT, data);
  link = enlaceConHash(data);
  if (
    link.length > 12000 || data.fotos.length || data.voz || data.permitirRespuesta
  ) link = "";
  linkState = "saving";
  const generation = ++linkGeneration;
  crearEnlace(data)
    .then((url) => {
      if (generation === linkGeneration) {
        link = url;
        linkState = "ready";
        updateShare();
      }
    })
    .catch(() => {
      if (generation === linkGeneration) {
        linkState = "error";
        updateShare();
        toast(
          "No se pudo guardar el enlace. Tu regalo sigue aquí; vuelve a intentarlo desde Editar.",
          6000,
        );
      }
    });
  await presentGift(data);
});
$("#btn-skip").addEventListener("click", completarCarta);
$("#btn-card-close").addEventListener("click", () => {
  cardEntry++;
  cardMotion?.cancel();
  cardMotion = null;
  completarCarta();
  setVisible("#card-layer", false);
  $("#btn-letter").focus();
});
$("#btn-letter").addEventListener("click", () => {
  if (!busy && !cardMotion) showCard(false);
});
$("#btn-edit").addEventListener("click", () => {
  fillForm(current);
  abrirModal($("#gift-modal"));
});
$("#btn-replay").addEventListener("click", async () => {
  if (!busy) await presentGift(current, role === "invitado");
});
$("#btn-back").addEventListener("click", () => {
  if (role === "invitado") location.assign("/");
  else enterGarden();
});
async function downloadPostcard() {
  const buttons = [$("#btn-download"), $("#btn-share")];
  const labels = buttons.map((button) => [...button.childNodes].map((node) => node.cloneNode(true)));
  buttons.forEach((button) => {
    button.disabled = true;
    button.classList.add("is-working");
    button.setAttribute("aria-busy", "true");
    setIconContent(button, "loader", "Preparando tu recuerdo…");
  });
  try {
    await guardarPostal(current);
    track("postcard_saved");
    toast("Tu recuerdo está listo, con sus fotos y dedicatorias.");
  } catch (error) {
    track("postcard_error");
    toast(
      error.message || "No pudimos crear la postal. Inténtalo otra vez.",
      6000,
    );
  } finally {
    buttons.forEach((button, i) => {
      button.disabled = false;
      button.classList.remove("is-working");
      button.removeAttribute("aria-busy");
      button.replaceChildren(...labels[i]);
    });
  }
}
$("#btn-download").addEventListener("click", downloadPostcard);
async function copyLink() {
  if (!link) {
    toast(
      "El regalo aún no tiene enlace. Espera un momento o vuelve a guardarlo desde Editar.",
    );
    return;
  }
  if (await copiar(link)) {
    track("gift_shared");
    toast("Enlace copiado. Ya puedes hacerle llegar su jardín.");
  } else {
    openShare();
    $("#gift-link").focus();
    $("#gift-link").select();
  }
}
$("#btn-copy").addEventListener("click", copyLink);
$("#link-close").addEventListener("click", () => cerrarModal($("#link-modal")));
function updateShare() {
  $("#gift-link").value = link;
  const ready = !!link && linkState !== "saving";
  const whatsapp = $("#share-whatsapp");
  whatsapp.setAttribute("aria-disabled", String(!ready));
  if (ready) whatsapp.href = enlaceWhatsApp($("#share-message").value, link);
  else whatsapp.removeAttribute("href");
  $("#share-copy").disabled = !ready;
  $("#share-native").disabled = !ready;
  $("#share-status").textContent = linkState === "saving"
    ? "Preparando el enlace de tu regalo…"
    : !link ? "No pudimos guardar el enlace. Tu carta sigue aquí: vuelve a Editar para intentarlo de nuevo."
    : "El enlace se añade al mensaje. En WhatsApp eliges a quién enviarlo.";
}
function openShare() {
  $("#share-message").value = mensajeParaCompartir(current);
  $("#share-native").classList.toggle("hidden", !navigator.share);
  updateShare();
  abrirModal($("#link-modal"));
}
$("#share-message").addEventListener("input", updateShare);
$("#share-copy").addEventListener("click", copyLink);
$("#share-whatsapp").addEventListener("click", (event) => {
  if (!link || linkState === "saving") event.preventDefault();
  else track("whatsapp_opened"); // Intent to share, not confirmation of delivery.
});
$("#share-native").addEventListener("click", async () => {
  if (!link || linkState === "saving") return;
  if (navigator.share) {
    try {
      await navigator.share({
        title: "Unas flores para " + current.para,
        text: $("#share-message").value.trim(),
        url: link,
      });
      track("gift_shared");
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
    }
  }
  await copyLink();
});
$("#btn-share").addEventListener("click", () => {
  if (role === "invitado") return downloadPostcard();
  openShare();
});
$("#btn-open").addEventListener("click", async () => {
  if (busy || !received) return;
  busy = true;
  $("#btn-open").disabled = true;
  toggleMusic($("#reveal-music").checked);
  if (!opened) {
    track("gift_opened", { giftId: received.id });
    registrarApertura(received.id);
    opened = true;
  }
  await openEnvelope($("#btn-open"), reducedMotion.matches);
  await ocultar($("#reveal"), { duracion: 500 });
  busy = false;
  await presentGift(received, true);
});

async function start() {
  garden.sembrarCampo();
  garden.restaurarJardin(readStorage(STORE));
  garden.iniciar();
  if (received) {
    current = received;
    setMode("regalo");
    setAmbient(current.ambiente);
    $("#envelope-to").textContent = current.para;
    $(".envelope-paper").classList.toggle("long-name", Array.from(current.para).length > 18);
    $("#reveal-title").textContent = current.para + ", este jardín es para ti.";
    $("#reveal-sub").textContent = current.de
      ? current.de + " te dejó flores y unas palabras del corazón."
      : "Alguien te dejó flores y unas palabras del corazón.";
    await garden.vistaJardin(0);
    garden.autoRotar(false);
    setVisible("#reveal", true);
  } else {
    setMode("intro");
    setAmbient(current.ambiente);
    await garden.presentarRamo(
      { ...current, flores: 16, semilla: 0.421 },
      true,
    );
    setVisible("#intro", true);
    if (location.hash.startsWith("#r=") || location.pathname.startsWith("/r/"))
      toast("No encontramos ese regalo. Puedes crear un nuevo jardín.");
  }
  setVisible("#hud-top", true);
  await ocultar($("#loader"), { duracion: 450 });
}
start().catch((error) => {
  console.error("[flores] no se pudo abrir el jardín", error);
  setVisible("#load-error", true);
  setVisible("#loader", true);
});

document.addEventListener("flores:gift-deleted", () => {
  link = "";
  $("#gift-link").value = "";
  for (const id of ["#btn-copy", "#btn-share", "#btn-island"])
    setVisible(id, false);
});
