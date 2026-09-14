import * as THREE from "three";
import anime from "animejs";
import { Garden } from "./garden.js";
import {
  crearEnlace,
  enlaceConHash,
  leerRegalo,
  copiar,
  registrarApertura,
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

const STORE = "flores-jardin-v2",
  DRAFT = "flores-carta-v2";
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
let current = normalizeGift(readStorage(DRAFT) || { semilla: Math.random() });
let role = received ? "invitado" : "autor",
  mode = "intro",
  busy = false,
  link = "",
  linkGeneration = 0;
let opened = false,
  musicWanted = false,
  musicReady = null,
  audioContext;
const music = new Musica("S7gMzYqXIZc");
const canvas = $("#scene");
let garden;
try {
  garden = new Garden(canvas);
} catch (error) {
  $("#load-error").classList.remove("hidden");
  throw error;
}
window.__jardin = garden;
document.addEventListener("flores:modal", (event) => {
  garden.editorPausado = event.detail.open;
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
  $("#btn-ambient").firstElementChild.textContent = night ? "☾" : "☼";
  $("#btn-ambient").setAttribute(
    "aria-label",
    night ? "Cambiar a tarde de sol" : "Cambiar a noche de luciérnagas",
  );
}
$("#btn-ambient").addEventListener("click", () => {
  const ambient =
    document.body.dataset.ambiente === "noche" ? "atardecer" : "noche";
  setAmbient(ambient);
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
  $("#btn-sound").setAttribute("aria-pressed", String(playing));
  $("#btn-sound").setAttribute(
    "aria-label",
    playing ? "Pausar música" : "Activar música",
  );
  $("#btn-sound").title = playing ? "Pausar música" : "Activar música";
};
music.onError = () => {
  musicWanted = false;
  music.onCambio(false);
  toast("La música no está disponible ahora. Tu jardín sigue aquí.");
};
async function toggleMusic(want = !musicWanted) {
  musicWanted = want;
  if (!want) {
    music.pausar();
    return;
  }
  if (!musicReady) musicReady = music.preparar();
  $("#btn-sound").textContent = "…";
  const ok = await musicReady;
  $("#btn-sound").textContent = "♪";
  if (!ok) {
    musicReady = null;
    musicWanted = false;
    toast("No pudimos cargar la música. Puedes volver a intentarlo.");
    return;
  }
  if (musicWanted) {
    music.volumen = 5;
    music.reproducir();
    music.atenuar(26, reducedMotion.matches ? 0 : 1400);
  }
}
$("#btn-sound").addEventListener("click", () => toggleMusic());
function seedSound() {
  if (!musicWanted) return;
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

function formData() {
  return normalizeGift({
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
const suggestions = {
  amor: "Si pudiera regalarte algo que dure para siempre, sería la forma en que te miro. Gracias por hacer florecer mis días. 💛",
  gracias:
    "Por escucharme, por acompañarme y por hacer más bonitos los días sencillos. Este pequeño jardín es mi manera de darte las gracias.",
  distancia:
    "Aunque hoy no pueda llevártelas en persona, estas flores van llenas de abrazos. Te siento cerquita, incluso desde aquí. 💛",
};
for (const button of document.querySelectorAll("[data-message]"))
  button.addEventListener("click", () => {
    $("#f-msg").value = suggestions[button.dataset.message];
    saveDraft();
    $("#f-msg").focus();
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
  setVisible("#memory-popover", false);
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
$("#btn-enter").addEventListener("click", enterGarden);
$("#btn-seed").addEventListener("click", () => plant(5));
$("#btn-gift").addEventListener("click", () => {
  if (!busy) abrirModal($("#gift-modal"));
});
$("#gift-close").addEventListener("click", () => cerrarModal($("#gift-modal")));
$("#gift-cancel").addEventListener("click", () =>
  cerrarModal($("#gift-modal")),
);
$("#btn-how").addEventListener("click", () => abrirModal($("#help-modal")));
$("#help-close").addEventListener("click", () => cerrarModal($("#help-modal")));
$("#help-ok").addEventListener("click", () => cerrarModal($("#help-modal")));
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

function showMemory(text) {
  $("#memory-text").textContent = text;
  setVisible("#memory-popover", true);
  $("#memory-close").focus();
}
$("#memory-close").addEventListener("click", () => {
  setVisible("#memory-popover", false);
  $("#btn-letter").focus();
});
function showCard(animate = true) {
  $("#c-to").textContent = current.para || "ti";
  $("#c-from").textContent = current.de || "alguien que te quiere";
  $("#c-occasion").textContent = OCCASIONS[current.ocasion];
  setVisible("#card-layer", true);
  setVisible("#gift-dock", true);
  if (animate) escribir($("#c-msg"), current.mensaje);
  else {
    completarCarta();
    $("#c-msg").textContent = current.mensaje;
    $("#c-msg").setAttribute("aria-label", current.mensaje);
    setVisible("#btn-skip", false);
  }
  const guest = role === "invitado";
  $("#btn-share").textContent = guest
    ? "Guardar este recuerdo ↓"
    : "Compartir regalo ↗";
  setVisible("#btn-download", !guest);
  setVisible("#btn-copy", !guest);
  setVisible("#btn-edit", !guest);
  $("#btn-back").textContent = guest
    ? "Crear mi propio regalo"
    : "Volver al jardín";
  const memories = $("#memory-list");
  memories.replaceChildren();
  current.recuerdos.forEach((text, i) => {
    const button = document.createElement("button");
    button.textContent = "✿";
    button.setAttribute("aria-label", "Descubrir razón " + (i + 1));
    button.addEventListener("click", () => showMemory(text));
    memories.appendChild(button);
  });
  if (current.recuerdos.length) {
    const hint = document.createElement("span");
    hint.textContent = "Cada flor guarda algo bonito";
    memories.appendChild(hint);
  }
  memories.classList.toggle("hidden", !current.recuerdos.length);
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
  setVisible("#memory-popover", false);
  await cerrarModal($("#gift-modal"));
  setMode("preparando");
  setVisible("#preparing", true);
  setAmbient(data.ambiente);
  try {
    await garden.presentarRamo(data);
    lluviaDePetalos(22);
    setMode("ramo");
    garden.vistaRamo(0);
    showCard();
  } finally {
    setVisible("#preparing", false);
    busy = false;
  }
}
$("#gift-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (busy) return;
  const data = formData();
  if (!data.para) {
    $("#f-to").focus();
    return;
  }
  if (!data.mensaje) data.mensaje = DEFAULT_MESSAGE;
  current = data;
  fillForm(data);
  writeStorage(DRAFT, data);
  link = enlaceConHash(data);
  const generation = ++linkGeneration;
  crearEnlace(data).then((url) => {
    if (generation === linkGeneration) link = url;
  });
  await presentGift(data);
});
$("#btn-skip").addEventListener("click", completarCarta);
$("#btn-card-close").addEventListener("click", () => {
  completarCarta();
  setVisible("#card-layer", false);
  $("#btn-letter").focus();
});
$("#btn-letter").addEventListener("click", () => {
  if (!busy) showCard(false);
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
  buttons.forEach((b) => (b.disabled = true));
  try {
    await guardarPostal(current);
    toast("Tu postal está lista para guardar. 💛");
  } catch {
    toast("No pudimos crear la postal. Inténtalo otra vez.");
  } finally {
    buttons.forEach((b) => (b.disabled = false));
  }
}
$("#btn-download").addEventListener("click", downloadPostcard);
async function copyLink() {
  if (await copiar(link))
    toast("Enlace copiado. Ya puedes hacerle llegar su jardín. 💛");
  else {
    $("#gift-link").value = link;
    abrirModal($("#link-modal"));
    $("#gift-link").focus();
    $("#gift-link").select();
  }
}
$("#btn-copy").addEventListener("click", copyLink);
$("#link-close").addEventListener("click", () => cerrarModal($("#link-modal")));
$("#btn-share").addEventListener("click", async () => {
  if (role === "invitado") return downloadPostcard();
  if (navigator.share) {
    try {
      await navigator.share({
        title: "Unas flores para " + current.para,
        text: "Hay un pequeño jardín esperando por ti. 💛",
        url: link,
      });
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
    }
  }
  await copyLink();
});
$("#btn-open").addEventListener("click", async () => {
  if (busy || !received) return;
  busy = true;
  $("#btn-open").disabled = true;
  if ($("#reveal-music").checked) toggleMusic(true);
  if (!opened) {
    registrarApertura(received.id);
    opened = true;
  }
  $("#btn-open").classList.add("opening");
  await pause(850);
  await ocultar($("#reveal"));
  busy = false;
  await presentGift(received, true);
});

async function start() {
  garden.sembrarCampo(innerWidth < 820 ? 38 : 58);
  garden.restaurarJardin(readStorage(STORE));
  garden.iniciar();
  if (received) {
    current = received;
    setMode("regalo");
    setAmbient(current.ambiente);
    $("#envelope-to").textContent = current.para;
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
