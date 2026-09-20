import * as THREE from "three";


const TWO_PI = Math.PI * 2;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/* ---------- pétalo ---------- */
function buildPetalGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.3, 0.16, 0.36, 0.7, 0.11, 1.02);
  s.bezierCurveTo(0.06, 1.09, -0.06, 1.09, -0.11, 1.02);
  s.bezierCurveTo(-0.36, 0.7, -0.3, 0.16, 0, 0);

  const g = new THREE.ShapeGeometry(s, 16);
  const pos = g.attributes.position;
  // Copa: el pétalo se curva hacia arriba en la punta y a los lados.
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    pos.setZ(i, 0.2 * y * y * y + 0.45 * x * x);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/* ---------- hoja ---------- */
function buildLeafGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.42, 0.2, 0.38, 0.74, 0, 1.05);
  s.bezierCurveTo(-0.38, 0.74, -0.42, 0.2, 0, 0);
  const g = new THREE.ShapeGeometry(s, 12);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    pos.setZ(i, -0.3 * x * x);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

const PETAL_GEO = buildPetalGeometry();
const LEAF_GEO = buildLeafGeometry();
const CORE_GEO = new THREE.SphereGeometry(0.5, 20, 14);
const CROWN_GEO = new THREE.SphereGeometry(0.5, 16, 12);

const LEAF_MAT = new THREE.MeshStandardMaterial({
  color: 0x4c8f3a,
  roughness: 0.75,
  metalness: 0,
  side: THREE.DoubleSide,
});
const STEM_MAT = new THREE.MeshStandardMaterial({
  color: 0x4a8c37,
  roughness: 0.85,
  metalness: 0,
});
const CORE_MAT = new THREE.MeshStandardMaterial({
  color: 0x8a5a16,
  roughness: 0.95,
  metalness: 0,
});
const CROWN_MAT = new THREE.MeshStandardMaterial({
  color: 0xe8a51c,
  roughness: 0.55,
  emissive: 0x5a3c00,
  emissiveIntensity: 0.5,
});

// Variantes de amarillo: del sol pálido al ámbar encendido.
const TONOS = [0xf7c81b, 0xffd633, 0xf0b90a, 0xffcf1f, 0xf5bd00, 0xffde4d];

export class Flower extends THREE.Group {
  /**
   * @param {number} seed  semilla 0..1 para variar la flor
   */
  constructor(seed = Math.random()) {
    super();

    const rnd = mulberry32(Math.floor(seed * 1e9));
    this.seed = seed;
    this.phase = rnd() * TWO_PI;
    this.growth = 0;
    this.escalaBase = 1; // se achica/agranda al entrar en un ramo

    const altura = 1.15 + rnd() * 0.9;
    const escala = 0.85 + rnd() * 0.35;
    this.userData.altura = altura;

    /* ---- tallo curvo ---- */
    const lean = (rnd() - 0.5) * 0.22;
    const curva = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(lean * 0.3, altura * 0.35, lean * 0.2),
      new THREE.Vector3(lean * 0.8, altura * 0.72, lean * 0.5),
      new THREE.Vector3(lean, altura, lean * 0.6),
    ]);
    const stem = new THREE.Mesh(
      new THREE.TubeGeometry(curva, 14, 0.028 * escala, 6, false),
      STEM_MAT,
    );
    stem.castShadow = true;
    this.add(stem);
    this.stem = stem;

    /* ---- hojas ---- */
    const nHojas = 2 + Math.floor(rnd() * 2);
    for (let i = 0; i < nHojas; i++) {
      const t = 0.26 + i * 0.22 + rnd() * 0.06;
      const p = curva.getPoint(t);
      const hoja = new THREE.Mesh(LEAF_GEO, LEAF_MAT);
      hoja.position.copy(p);
      hoja.rotation.y = rnd() * TWO_PI;
      hoja.rotation.z = (i % 2 ? 1 : -1) * (0.7 + rnd() * 0.4);
      hoja.scale.setScalar((0.28 + rnd() * 0.12) * escala);
      hoja.castShadow = true;
      this.add(hoja);
    }

    /* ---- cabeza ---- */
    const head = new THREE.Group();
    const top = curva.getPoint(1);
    head.position.copy(top);
    head.rotation.x = 0.16 + rnd() * 0.2; // mira un poco hacia el frente
    head.rotation.z = (rnd() - 0.5) * 0.3;
    head.scale.setScalar(escala);
    this.add(head);
    this.head = head;

    const color = new THREE.Color(TONOS[Math.floor(rnd() * TONOS.length)]);
    color.offsetHSL(0, (rnd() - 0.5) * 0.06, (rnd() - 0.5) * 0.05);
    const petalMat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.44,
      metalness: 0,
      side: THREE.DoubleSide,
      emissive: color.clone().multiplyScalar(0.08),
      emissiveIntensity: 1,
    });
    this.petalMat = petalMat;
    this.color = color;

    this.petalPivots = [];
    const anillos = [
      {
        n: 10 + Math.floor(rnd() * 3),
        r: 0.075,
        esc: 0.44 * escala,
        tiltOpen: 0.02,
        off: 0,
      },
      {
        n: 8 + Math.floor(rnd() * 3),
        r: 0.04,
        esc: 0.33 * escala,
        tiltOpen: 0.4,
        off: 0.4,
      },
    ];
    for (const a of anillos) {
      for (let i = 0; i < a.n; i++) {
        const ang = (i / a.n) * TWO_PI + a.off + rnd() * 0.08;
        const pivot = new THREE.Object3D();
        pivot.rotation.y = ang;
        const m = new THREE.Mesh(PETAL_GEO, petalMat);
        m.position.set(0, 0, a.r);
        m.scale.setScalar(a.esc * (0.92 + rnd() * 0.16));
        m.castShadow = true;
        pivot.add(m);
        head.add(pivot);
        this.petalPivots.push({
          mesh: m,
          tiltOpen: a.tiltOpen + (rnd() - 0.5) * 0.14,
        });
      }
    }

    /* ---- centro ---- */
    const core = new THREE.Mesh(CORE_GEO, CORE_MAT);
    core.scale.set(0.23 * escala, 0.1 * escala, 0.23 * escala);
    core.position.y = 0.012;
    head.add(core);

    const crown = new THREE.Mesh(CROWN_GEO, CROWN_MAT);
    crown.scale.set(0.16 * escala, 0.08 * escala, 0.16 * escala);
    crown.position.y = 0.032;
    head.add(crown);

    this.setGrowth(0);
  }

  /** 0 = semilla, 1 = flor abierta */
  setGrowth(t) {
    const g = clamp01(t);
    this.growth = g;

    const e = this.escalaBase;
    const alto = Math.max(0.001, smoothstep(0, 0.85, g)) * e;
    const ancho = (0.45 + 0.55 * smoothstep(0.1, 1, g)) * e;
    this.scale.set(ancho, alto, ancho);

    const cabeza = smoothstep(0.3, 0.95, g);
    this.head.visible = cabeza > 0.01;
    const base =
      this.head.userData.baseScale ??
      (this.head.userData.baseScale = this.head.scale.x);
    this.head.scale.setScalar(Math.max(0.001, base * cabeza));

    // los pétalos se abren al final: de capullo cerrado a corola abierta
    const apertura = smoothstep(0.55, 1, g);
    for (const p of this.petalPivots) {
      p.mesh.rotation.x =
        -Math.PI / 2 + THREE.MathUtils.lerp(1.45, p.tiltOpen, apertura);
    }
    this.visible = g > 0.002;
  }

  /** Ajusta el tamaño total de la flor (para armar el ramo) */
  fijarEscala(v) {
    this.escalaBase = v;
    this.setGrowth(this.growth);
  }

  /** Vaivén de viento */
  update(time, viento = 1) {
    const s = this.growth;
    const w = viento * s;
    this.rotation.z = Math.sin(time * 1.15 + this.phase) * 0.055 * w;
    this.rotation.x = Math.cos(time * 0.85 + this.phase * 1.3) * 0.035 * w;
  }

  dispose() {
    this.stem.geometry.dispose();
    this.petalMat.dispose();
  }
}

/* PRNG determinista */
export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
