/* ============================================================
   Música de fondo con el reproductor de YouTube (iframe invisible).
   El navegador sólo deja sonar tras un gesto del usuario, así que
   `reproducir()` se llama desde un click.
   ============================================================ */

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
    this.disponible = false;
    this.volumen = 32;
    this.onCambio = () => {};
    this.onError = () => {};
  }

  async preparar() {
    try {
      const YT = await cargarAPI();
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this.player?.destroy();
          this.player = null;
          reject(new Error("timeout del reproductor"));
        }, 10000);
        this.player = new YT.Player(this.contenedor, {
          videoId: this.videoId,
          width: 1,
          height: 1,
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            loop: 1,
            playlist: this.videoId, // necesario para que loop funcione
            playsinline: 1,
            modestbranding: 1,
            rel: 0,
          },
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
    if (!this.disponible || !this.player) return;
    try {
      this.player.unMute();
      this.player.setVolume(this.volumen);
      this.player.playVideo();
      this.sonando = true;
      this.onCambio(true);
    } catch {
      /* el iframe todavía no responde */
    }
  }

  pausar() {
    if (!this.disponible || !this.player) return;
    try {
      this.player.pauseVideo();
      this.sonando = false;
      this.onCambio(false);
    } catch {
      /* noop */
    }
  }

  alternar() {
    if (this.sonando) this.pausar();
    else this.reproducir();
    return this.sonando;
  }

  /** Baja el volumen un rato (para que se escuche la escena del regalo) */
  atenuar(destino = 12, ms = 800) {
    if (!this.disponible || !this.player) return;
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
      if (k < 1) requestAnimationFrame(paso);
    };
    paso();
  }
}
