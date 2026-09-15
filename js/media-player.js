/** Small accessible voice player shared by the creator and the received letter. */
import { icon, setIconContent } from "./icons.js";
export function mountVoicePlayer(
  root,
  {
    title = "Un poquito de mi voz",
    subtitle = "Un mensaje para escucharlo cerquita.",
  } = {},
) {
  root.classList.add("voice-player");
  root.innerHTML = `<div class="voice-player-heading"><span aria-hidden="true">${icon("heart")}</span><div><b></b><small></small></div></div><div class="voice-player-controls"><button type="button" class="voice-play" aria-label="Escuchar mensaje de voz"><span aria-hidden="true">${icon("play")}</span></button><div class="voice-timeline"><div class="voice-bars" aria-hidden="true">${[9, 18, 13, 26, 20, 32, 16, 24, 11, 29, 18, 35, 23, 14, 27, 19, 31, 12, 21, 16].map((h) => `<i style="--bar:${h}px"></i>`).join("")}</div><input type="range" min="0" max="100" value="0" step="0.1" aria-label="Posición del mensaje de voz" disabled /><div class="voice-time"><span>0:00</span><span>—</span></div></div></div><p class="voice-player-status" role="status"></p>`;
  root.querySelector("b").textContent = title;
  root.querySelector("small").textContent = subtitle;
  const audio = document.createElement("audio");
  audio.preload = "metadata";
  audio.hidden = true;
  root.append(audio);
  const play = root.querySelector(".voice-play");
  const seek = root.querySelector("input");
  const status = root.querySelector(".voice-player-status");
  const times = root.querySelectorAll(".voice-time span");
  let source = "",
    failed = false;
  let attempt = 0,
    waiting = false;
  const format = (seconds) =>
    Number.isFinite(seconds)
      ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`
      : "—";
  function update() {
    const playing = !audio.paused && !audio.ended;
    root.classList.toggle("is-playing", playing);
    setIconContent(play.querySelector("span"), playing ? "pause" : "play");
    play.setAttribute(
      "aria-label",
      playing
        ? "Pausar mensaje de voz"
        : failed
          ? "Reintentar mensaje de voz"
          : "Escuchar mensaje de voz",
    );
    const hasDuration = Number.isFinite(audio.duration) && audio.duration > 0;
    seek.disabled = !hasDuration;
    seek.value = hasDuration
      ? String((audio.currentTime / audio.duration) * 100)
      : "0";
    seek.setAttribute(
      "aria-valuetext",
      `${format(audio.currentTime)} de ${format(audio.duration)}`,
    );
    root.style.setProperty("--voice-progress", `${seek.value}%`);
    times[0].textContent = format(audio.currentTime);
    times[1].textContent = format(audio.duration);
  }
  play.onclick = async () => {
    if (!source) return;
    if (waiting || !audio.paused) {
      attempt++;
      waiting = false;
      audio.pause();
      root.classList.remove("is-loading");
      status.textContent = "";
      update();
      return;
    }
    const current = ++attempt;
    waiting = true;
    root.classList.add("is-loading");
    play.setAttribute("aria-label", "Cancelar carga del mensaje de voz");
    status.textContent = "Preparando su voz…";
    let timer;
    try {
      if (failed) {
        failed = false;
        audio.load();
      }
      if (audio.ended) audio.currentTime = 0;
      await Promise.race([
        audio.play(),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error("timeout")), 12000);
        }),
      ]);
      if (current !== attempt) return;
      status.textContent = "";
    } catch {
      if (current !== attempt) return;
      failed = true;
      audio.pause();
      status.textContent =
        "No pudimos reproducirlo. Toca el botón para volver a intentar.";
    } finally {
      clearTimeout(timer);
      if (current === attempt) {
        waiting = false;
        root.classList.remove("is-loading");
        update();
      }
    }
  };
  seek.oninput = () => {
    if (Number.isFinite(audio.duration)) {
      audio.currentTime = (Number(seek.value) / 100) * audio.duration;
      update();
    }
  };
  audio.addEventListener("play", () => {
    document.dispatchEvent(
      new CustomEvent("flores:voice-play", { detail: root }),
    );
    update();
  });
  for (const event of [
    "timeupdate",
    "loadedmetadata",
    "durationchange",
    "pause",
    "ended",
  ])
    audio.addEventListener(event, update);
  audio.addEventListener("waiting", () => {
    if (!audio.paused) status.textContent = "Cargando el mensaje…";
  });
  audio.addEventListener("playing", () => {
    status.textContent = "";
  });
  audio.addEventListener("error", () => {
    if (source) {
      failed = true;
      status.textContent =
        "Este audio no está disponible. Puedes volver a intentarlo.";
      update();
    }
  });
  for (const event of ["pause", "ended"])
    audio.addEventListener(event, () =>
      document.dispatchEvent(new CustomEvent("flores:voice-stop")),
    );
  const pauseOther = (e) => {
    if (e.detail !== root) audio.pause();
  };
  const pauseHidden = () => {
    if (document.hidden) audio.pause();
  };
  document.addEventListener("flores:voice-play", pauseOther);
  document.addEventListener("visibilitychange", pauseHidden);
  return {
    setSource(value) {
      if (source === value) return;
      attempt++;
      waiting = false;
      root.classList.remove("is-loading");
      audio.pause();
      source = value;
      failed = false;
      status.textContent = "";
      if (value) audio.src = value;
      else audio.removeAttribute("src");
      audio.load();
      update();
    },
    pause() {
      audio.pause();
    },
    destroy() {
      attempt++;
      waiting = false;
      audio.pause();
      source = "";
      audio.removeAttribute("src");
      audio.load();
      document.removeEventListener("flores:voice-play", pauseOther);
      document.removeEventListener("visibilitychange", pauseHidden);
      root.replaceChildren();
    },
  };
}
