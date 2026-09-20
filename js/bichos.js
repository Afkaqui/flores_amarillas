import * as THREE from 'three';
import { mulberry32 } from './flower.js';


const TWO_PI = Math.PI * 2;

/* ---------- texturas ---------- */
function texturaAbeja() {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = '#FFC81F';
  x.fillRect(0, 0, 32, 64);
  x.fillStyle = '#3A2A16';
  x.fillRect(0, 0, 32, 6);     // cabeza
  x.fillStyle = '#2E2113';
  x.fillRect(0, 22, 32, 6);
  x.fillRect(0, 36, 32, 6);
  x.fillRect(0, 50, 32, 7);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ---------- geometrías compartidas ----------
   Las alas se dibujan en el plano XY (x = hacia afuera, y = hacia adelante)
   y se acuestan en el plano XZ, que es donde vuelan. */
function aPlanoDeVuelo(forma) {
  const g = new THREE.ShapeGeometry(forma, 14);
  g.rotateX(Math.PI / 2);
  return g;
}

/** Ala delantera: borde de ataque largo y punta barrida hacia atrás */
function alaDelantera(L = 1, A = 0.6) {
  const f = new THREE.Shape();
  f.moveTo(0, 0.05 * A);
  f.bezierCurveTo(0.45 * L, 0.6 * A, 0.88 * L, 0.46 * A, L, 0.02 * A);
  f.bezierCurveTo(0.94 * L, -0.5 * A, 0.52 * L, -0.8 * A, 0.1 * L, -0.4 * A);
  f.bezierCurveTo(0.03 * L, -0.22 * A, 0, -0.08 * A, 0, 0.05 * A);
  return aPlanoDeVuelo(f);
}

/** Ala trasera: más corta y redonda, cae hacia atrás */
function alaTrasera(L = 0.72, A = 0.55) {
  const f = new THREE.Shape();
  f.moveTo(0, 0.1 * A);
  f.bezierCurveTo(0.4 * L, 0.28 * A, 0.8 * L, 0.1 * A, 0.92 * L, -0.3 * A);
  f.bezierCurveTo(0.8 * L, -0.85 * A, 0.35 * L, -1 * A, 0.1 * L, -0.6 * A);
  f.bezierCurveTo(0.02 * L, -0.35 * A, 0, -0.1 * A, 0, 0.1 * A);
  return aPlanoDeVuelo(f);
}

/** Ala de abeja: angosta y transparente */
function alaAbeja(L = 1, A = 0.3) {
  const f = new THREE.Shape();
  f.moveTo(0, 0);
  f.bezierCurveTo(0.4 * L, 0.5 * A, 0.9 * L, 0.4 * A, L, 0);
  f.bezierCurveTo(0.9 * L, -0.45 * A, 0.4 * L, -0.5 * A, 0, 0);
  return aPlanoDeVuelo(f);
}

const ALA_DELANTERA = alaDelantera();
const ALA_TRASERA = alaTrasera();
const ALA_ABEJA = alaAbeja();

const CUERPO_ABEJA = new THREE.CapsuleGeometry(0.4, 0.62, 4, 10);
CUERPO_ABEJA.rotateX(Math.PI / 2);   // el largo del cuerpo apunta a +Z

let TEX_ABEJA = null;

class Bicho extends THREE.Group {
  constructor(rnd) {
    super();
    this.rnd = rnd;
    this.vel = new THREE.Vector3();
    this.objetivo = new THREE.Vector3(
      (rnd() - 0.5) * 14, 1 + rnd() * 1.5, (rnd() - 0.5) * 14
    );
    this.espera = 0;
    this.fase = rnd() * TWO_PI;
    this.flor = null;
    this.rumbo = 3 + rnd() * 5;      // cuánto insiste con este destino
    this._dir = new THREE.Vector3(0, 0, 1);
    this._mira = new THREE.Vector3();
    this._p = new THREE.Vector3();
    this._empuje = new THREE.Vector3();
  }

  /** Elige una flor abierta al azar (o un punto cualquiera si no hay) */
  elegirDestino(flores, altoExtra, radio = 13) {
    this.rumbo = 5 + this.rnd() * 6;
    const abiertas = flores.filter((f) => f.growth > 0.85 && (f !== this.flor || flores.length === 1));
    if (abiertas.length && (this instanceof Abeja || this.rnd() < 0.85)) {
      this.flor = abiertas[Math.floor(this.rnd() * abiertas.length)];
      return;
    }
    this.flor = null;
    const a = this.rnd() * TWO_PI;
    const r = this instanceof Abeja ? 1 + this.rnd() * 2.5 : 2 + this.rnd() * radio;
    this.objetivo.set(Math.cos(a) * r, 0.8 + this.rnd() * altoExtra, Math.sin(a) * r);
  }

  /** Punto exacto al que apuntar (la corola de su flor, si tiene una) */
  puntoObjetivo(salida) {
    if (this.flor && (this.flor.parent || this.flor.userData.decorativa)) {
      // Batched field flowers retain their transform, but have no scene parent.
      return this.flor.head.getWorldPosition(salida);
    }
    return salida.copy(this.objetivo);
  }

  /** Empuje hacia el objetivo con un poco de deriva */
  navegar(destino, dt, t, velMax, acel) {
    const dir = this._empuje.copy(destino).sub(this.position);
    const dist = dir.length();
    if (dist > 0.0001) dir.divideScalar(dist);

    this.vel.addScaledVector(dir, acel * dt);
    // deriva: nadie vuela en línea recta
    this.vel.x += Math.sin(t * 2.1 + this.fase) * 0.12 * dt;
    this.vel.z += Math.cos(t * 1.7 + this.fase * 1.4) * 0.12 * dt;
    this.vel.multiplyScalar(Math.pow(0.965, dt * 60));

    const v = this.vel.length();
    if (v > velMax) this.vel.multiplyScalar(velMax / v);
    this.position.addScaledVector(this.vel, dt);

    return dist;
  }

  // Recompute orientation to avoid accumulating roll while hovering.
  mirarAdelante(alabeo = 0) {
    if (this.vel.lengthSq() > 1e-6) this._dir.copy(this.vel).normalize();
    this._mira.copy(this.position).add(this._dir);
    this.lookAt(this._mira);
    if (alabeo) this.rotateZ(alabeo);
  }
}

export class Abeja extends Bicho {
  constructor(rnd) {
    super(rnd);
    TEX_ABEJA = TEX_ABEJA || texturaAbeja();

    const cuerpo = new THREE.Mesh(
      CUERPO_ABEJA,
      new THREE.MeshStandardMaterial({ map: TEX_ABEJA, roughness: 0.75 })
    );
    cuerpo.scale.setScalar(0.135);
    this.add(cuerpo);

    const cabeza = new THREE.Mesh(
      new THREE.SphereGeometry(0.048, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x241a10, roughness: 0.8 })
    );
    cabeza.position.z = 0.105;
    this.add(cabeza);

    const matAla = new THREE.MeshStandardMaterial({
      color: 0xffffff, transparent: true, opacity: 0.42,
      roughness: 0.2, side: THREE.DoubleSide, depthWrite: false,
    });
    this.alas = [];
    for (const lado of [1, -1]) {
      const pivot = new THREE.Object3D();
      pivot.position.set(0, 0.048, 0.015);
      const ala = new THREE.Mesh(ALA_ABEJA, matAla);
      ala.scale.set(0.16 * lado, 0.16, 0.16);
      ala.rotation.y = lado * -0.35;
      pivot.add(ala);
      this.add(pivot);
      this.alas.push({ pivot, lado });
    }

    this.orbita = rnd() * TWO_PI;
    this.escala = 0.8 + rnd() * 0.35;
    this.scale.setScalar(this.escala);
  }

  actualizar(t, dt, flores) {
    const destino = this.puntoObjetivo(this._p);
    this.rumbo -= dt;

    // se queda dando vueltas encima de la flor un rato
    if (this.espera > 0) {
      this.espera -= dt;
      this.orbita += dt * 2.4;
      const r = 0.16;
      destino.x += Math.cos(this.orbita) * r;
      destino.z += Math.sin(this.orbita) * r;
      destino.y += 0.1 + Math.sin(t * 3 + this.fase) * 0.03;
      if (this.espera <= 0) this.elegirDestino(flores, 1.4);
    } else {
      destino.y += 0.16;
    }

    const dist = this.navegar(destino, dt, t, 2.6, 5.5);
    if (this.espera <= 0) {
      if (dist < 0.25) this.espera = 1.6 + this.rnd() * 2.6;
      else if (this.rumbo <= 0) this.elegirDestino(flores, 1.4);   // se aburrió
    }
    this.mirarAdelante();

    // alas: tan rápidas que se ven como un borrón
    const flap = Math.sin(t * 52 + this.fase) * 0.9;
    for (const a of this.alas) a.pivot.rotation.z = a.lado * (0.35 + flap * 0.55);
  }
}

const PALETAS = [
  { ala: 0xff9a1f, borde: 0x6b3208 },   // monarca
  { ala: 0xfffaf0, borde: 0xd8a63c },   // blanca de campo
  { ala: 0xffd21f, borde: 0x8a5a12 },   // amarilla
  { ala: 0x6fa8e6, borde: 0x27456e },   // celeste
];

export class Mariposa extends Bicho {
  constructor(rnd) {
    super(rnd);
    const paleta = PALETAS[Math.floor(rnd() * PALETAS.length)];
    const matAla = new THREE.MeshStandardMaterial({
      color: paleta.ala, roughness: 0.55, side: THREE.DoubleSide,
      emissive: new THREE.Color(paleta.ala).multiplyScalar(0.12),
    });
    // el borde asoma apenas por debajo del ala: da el dibujo sin ensuciarla
    const matBorde = new THREE.MeshStandardMaterial({
      color: new THREE.Color(paleta.borde).lerp(new THREE.Color(paleta.ala), 0.35),
      roughness: 0.7, side: THREE.DoubleSide,
      emissive: new THREE.Color(paleta.borde).multiplyScalar(0.15),
    });

    const cuerpo = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.035, 0.42, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0x2e2013, roughness: 0.85 })
    );
    cuerpo.rotation.x = Math.PI / 2;
    cuerpo.scale.setScalar(0.42);
    this.add(cuerpo);

    this.alas = [];
    for (const lado of [1, -1]) {
      const pivot = new THREE.Object3D();
      this.add(pivot);

      const delantera = new THREE.Mesh(ALA_DELANTERA, matAla);
      delantera.scale.set(0.31 * lado, 0.31, 0.31);
      delantera.position.z = 0.045;
      const bordeD = new THREE.Mesh(ALA_DELANTERA, matBorde);
      bordeD.scale.set(0.327 * lado, 0.327, 0.327);
      bordeD.position.set(0, -0.005, 0.045);

      const trasera = new THREE.Mesh(ALA_TRASERA, matAla);
      trasera.scale.set(0.27 * lado, 0.27, 0.27);
      trasera.position.z = -0.055;
      trasera.rotation.y = lado * 0.3;

      pivot.add(bordeD, delantera, trasera);
      this.alas.push({ pivot, lado });
    }

    this.posada = 0;
    this.scale.setScalar(0.85 + rnd() * 0.5);
    this.elegirDestino([], 2.2);
  }

  actualizar(t, dt, flores) {
    const destino = this.puntoObjetivo(this._p);
    let flap;

    if (this.posada > 0) {
      // quieta sobre la corola, abriendo y cerrando las alas despacio
      this.posada -= dt;
      this.position.lerp(destino.clone().setY(destino.y + 0.055), Math.min(1, dt * 8));
      this.vel.multiplyScalar(0.8);
      flap = 0.5 + Math.sin(t * 1.8 + this.fase) * 0.45;
      if (this.posada <= 0) {
        this.elegirDestino(flores, 2.2);
        this.vel.set((this.rnd() - 0.5) * 0.6, 0.7, (this.rnd() - 0.5) * 0.6);
      }
    } else {
      this.rumbo -= dt;
      destino.y += 0.22 + Math.sin(t * 0.9 + this.fase) * 0.25;
      const dist = this.navegar(destino, dt, t, 1.5, 2.6);
      // el aleteo empuja: sube en el golpe y planea en la subida
      flap = Math.sin(t * 7.5 + this.fase);
      this.position.y += flap * 0.055 * dt * 16;

      // Llegó (o se cansó de intentarlo): se posa o sale hacia otra flor.
      // Sin esto quedaba orbitando su destino para siempre.
      if (dist < 0.32) {
        if (this.flor && this.rnd() < 0.55) {
          this.posada = 2.5 + this.rnd() * 4;
          this.rotation.set(0, this.rotation.y, 0);   // se acomoda derecha
        } else {
          this.elegirDestino(flores, 2.2);
        }
      } else if (this.rumbo <= 0) {
        this.elegirDestino(flores, 2.2);
      }

      this.mirarAdelante(-this.vel.x * 0.22);   // se inclina al girar
      flap = 0.28 + flap * 0.62;
    }

    for (const a of this.alas) a.pivot.rotation.z = a.lado * flap;
  }
}

export class Bichos {
  constructor(scene, { abejas = 9, mariposas = 7, semilla = 77 } = {}) {
    const rnd = mulberry32(semilla);
    this.lista = [];

    for (let i = 0; i < abejas; i++) {
      const b = new Abeja(rnd);
      const a = rnd() * TWO_PI, r = 2 + rnd() * 10;
      b.position.set(Math.cos(a) * r, 0.9 + rnd() * 1.2, Math.sin(a) * r);
      scene.add(b);
      this.lista.push(b);
    }
    for (let i = 0; i < mariposas; i++) {
      const m = new Mariposa(rnd);
      const a = rnd() * TWO_PI, r = 3 + rnd() * 12;
      m.position.set(Math.cos(a) * r, 1.4 + rnd() * 1.6, Math.sin(a) * r);
      scene.add(m);
      this.lista.push(m);
    }
  }

  actualizar(t, dt, flores, floresRamo = []) {
    const abiertas = flores.filter((f) => f.growth > 0.85);
    const ramo = floresRamo.filter((f) => f.parent && f.growth > 0.85);
    const cercanas = abiertas.filter((f) => f.position.lengthSq() < 64);
    // Bees accompany the gift; butterflies can continue exploring the field.
    const destinosAbejas = ramo.length ? ramo : cercanas.length ? cercanas : abiertas;
    for (const b of this.lista) {
      const destinos = b instanceof Abeja ? destinosAbejas : abiertas;
      if (!b.iniciado || (b.flor && !destinos.includes(b.flor)) ||
          (b instanceof Abeja && !b.flor && destinos.length)) {
        b.espera = 0;
        if (b instanceof Mariposa) b.posada = 0;
        b.elegirDestino(destinos, 1.4);
        if (!b.iniciado && b instanceof Abeja && destinos.length) {
          b.puntoObjetivo(b.position);
          b.position.x += Math.cos(b.fase) * 1.1;
          b.position.z += Math.sin(b.fase) * 1.1;
          b.position.y += 0.45;
        }
        b.iniciado = true;
      }
      b.actualizar(t, dt, destinos);
    }
  }
}
