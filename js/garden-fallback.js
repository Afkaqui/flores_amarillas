import { bouquetSVG } from "../shared/bouquet.js";
import { islandSVG } from "../shared/island.js";
export class GardenFallback {
  constructor(canvas) {
    this.controls = { enabled: false };
    this.vistaFijada = true;
    this.flowers = [];
    this.element = document.createElement("div");
    this.element.className = "garden-fallback";
    this.element.setAttribute("aria-label", "Vista ilustrada del jardín");
    canvas.after(this.element);
    canvas.style.visibility = "hidden";
    document.body.classList.add("illustrated-mode");
  }
  aplicarEstilo(data) {
    this.element.dataset.night = data.ambiente === "noche";
  }
  async presentarRamo(data) {
    this.aplicarEstilo(data);
    this.element.innerHTML = bouquetSVG(data);
  }
  async vistaJardin() {
    this.element.innerHTML = islandSVG([], { demo: true });
  }
  vistaRamo() {}
  iniciar() {}
  fijarVista(value) {
    this.vistaFijada = value;
  }
  autoRotar() {}
  eliminarRamo() {}
  sembrarCampo() {}
  sembrarAlAzar(n) {
    for (let i = 0; i < n; i++)
      this.flowers.push({ x: 0, z: 0, seed: Math.random() });
  }
  sembrar() {
    this.sembrarAlAzar(1);
  }
  borrarSiembras() {
    this.flowers = [];
  }
  exportarJardin() {
    return this.flowers;
  }
  restaurarJardin(value) {
    this.flowers = Array.isArray(value) ? value.slice(0, 100) : [];
  }
  puntoEnSuelo() {
    return null;
  }
  recuerdoEnPunto() {
    return null;
  }
}
