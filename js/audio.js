
const API = "https://www.youtube.com/iframe_api";

let apiLista = null;
function cargarAPI() {
  if (apiLista) return apiLista;
  apiLista = new Promise((resolve, reject) => {
    if (window.YT && window.YT.Player) return resolve(window.YT);
    const previo = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previo === "function") previo();
      resolve(window.YT);
    };
    const s = document.createElement("script");
    s.src = API;
    s.async = true;
    s.onerror = () => {
      apiLista = null;
      reject(new Error("no se pudo cargar la API de YouTube"));
    };
    document.head.appendChild(s);
    setTimeout(() => {
      if (!window.YT?.Player) {
        apiLista = null;
        reject(new Error("timeout de la API de YouTube"));
      }
    }, 12000);
  });
  return apiLista;
}

export class Musica {
  /**
   * @param {string} videoId  id del video de YouTube
   * @param {string} contenedor  id del div donde se monta el iframe
   */
  constructor(videoId, contenedor = "yt") {
    this.videoId = videoId;
    this.contenedor = contenedor;
    this.player = null;
    this.sonando = false;
    this.suspendida = document.hidden;
    this.disponible = false;
    this.volumen = 32;
    this.onCambio = () => {};
    this.onError = () => {};
  }

  async preparar() {
    try {
      const YT = await cargarAPI();
      // Bind the API only after the iframe has left its initial about:blank origin.
      const frame = document.createElement("iframe");
      frame.id = this.contenedor;
      frame.title = "Música de fondo";
      frame.width = "200";
      frame.height = "200";
      frame.allow = "autoplay; encrypted-media";
      frame.tabIndex = -1;
      frame.setAttribute("aria-hidden", "true");
      const params = new URLSearchParams({
        enablejsapi: "1", origin: window.location.origin, autoplay: "0",
        controls: "0", disablekb: "1", loop: "1", playlist: this.videoId,
        playsinline: "1", rel: "0",
      });
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          frame.remove();
          reject(new Error("timeout del marco de música"));
        }, 12000);
        frame.onload = () => { clearTimeout(timer); resolve(); };
        frame.onerror = () => { clearTimeout(timer); reject(new Error("música no disponible")); };
        frame.src = `https://www.youtube.com/embed/${encodeURIComponent(this.videoId)}?${params}`;
        const previous = document.getElementById(this.contenedor);
        if (previous) previous.replaceWith(frame);
        else document.body.appendChild(frame);
      });
      frame.onload = frame.onerror = null;
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this.player?.destroy();
          this.player = null;
          reject(new Error("timeout del reproductor"));
        }, 10000);
        this.player = new YT.Player(this.contenedor, {
          events: {
            onReady: () => {
              clearTimeout(timer);
              this.disponible = true;
              resolve();
            },
            onError: (e) => {
              clearTimeout(timer);
              this.disponible = false;
              this.onError(e);
              reject(e);
            },
            onStateChange: (e) => {
              // 1 = reproduciendo, 2 = pausa, 0 = terminó
              if (e.data === 1 && (document.hidden || this.suspendida)) {
                this.pausar();
                return;
              }
              if (e.data === 1) this.sonando = true;
              if (e.data === 2 || e.data === 0) this.sonando = false;
              this.onCambio(this.sonando);
            },
          },
        });
      });
      return true;
    } catch (err) {
      this.disponible = false;
      this.player?.destroy();
      this.player = null;
      const failedFrame = document.getElementById(this.contenedor);
      if (failedFrame?.tagName === "IFRAME") failedFrame.remove();
      if (!document.getElementById(this.contenedor)) {
        const el = document.createElement("div");
        el.id = this.contenedor;
        el.setAttribute("aria-hidden", "true");
        document.body.appendChild(el);
      }
      return false;
    }
  }

  reproducir() {
    if (document.hidden || this.suspendida || !this.disponible || !this.player) return;
    try {
      this.player.unMute();
      this.player.setVolume(this.volumen);
      this.player.playVideo();
      // El estado real llega en onStateChange; un autoplay bloqueado no cuenta como reproducción.
    } catch {
      /* el iframe todavía no responde */
    }
  }

  pausar() {
    cancelAnimationFrame(this.fadeFrame);
    if (!this.disponible || !this.player) return;
    try {
      this.player.mute();
      this.player.pauseVideo();
      this.sonando = false;
      this.onCambio(false);
    } catch {
      /* noop */
    }
  }

  suspender(value) {
    this.suspendida = value;
    if (value) this.pausar();
  }

  alternar() {
    if (this.sonando) this.pausar();
    else this.reproducir();
    return this.sonando;
  }

  /** Baja el volumen un rato (para que se escuche la escena del regalo) */
  atenuar(destino = 12, ms = 800) {
    cancelAnimationFrame(this.fadeFrame);
    this.volumen = destino;
    if (document.hidden || this.suspendida || !this.disponible || !this.player) return;
    if (!ms) {
      this.player.setVolume(destino);
      return;
    }
    const desde = this.player.getVolume
      ? this.player.getVolume()
      : this.volumen;
    const t0 = performance.now();
    const paso = () => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      try {
        this.player.setVolume(desde + (destino - desde) * k);
      } catch {
        return;
      }
      if (k < 1) this.fadeFrame = requestAnimationFrame(paso);
    };
    paso();
  }
}
