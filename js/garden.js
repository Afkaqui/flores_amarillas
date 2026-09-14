import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import anime from "animejs";
import { Flower, mulberry32 } from "./flower.js";
import { Bichos } from "./bichos.js";
import { PAPERS, RIBBONS } from "../shared/gift.js";
import { reducedMotion, duration, pause } from "./ui.js";

const TWO_PI = Math.PI * 2;

/* Relieve suave del terreno: se usa para el pasto y para sembrar. */
export function alturaTerreno(x, z) {
  return (
    0.32 * Math.sin(x * 0.17) * Math.cos(z * 0.14) +
    0.16 * Math.sin(x * 0.07 + 1.3) * Math.sin(z * 0.09 - 0.6)
  );
}

export class Garden {
  constructor(canvas) {
    this.canvas = canvas;
    this.flores = [];
    this.reloj = new THREE.Clock();
    this.tiempo = 0;
    this.viento = 0.55;
    this.calidadBaja =
      innerWidth < 820 || (navigator.hardwareConcurrency || 8) <= 4;
    this.bouquetActivo = false;
    this.estilo ||= {
      cinta: "rosa",
      papel: "marfil",
      ambiente: "atardecer",
      semilla: 0.421,
    };

    this._initRenderer();
    this._initScene();
    this._initLuces();
    this._initCielo();
    this._initSuelo();
    this._initPasto();
    this._initDecor();
    this._initPolen();
    this._initBichos();
    this._initPost();
    this._initLuciernagas();
    this.aplicarEstilo(this.estilo);
    reducedMotion.addEventListener("change", () => this._aplicarRotacion());

    this.raycaster = new THREE.Raycaster();
    this.puntero = new THREE.Vector2();

    window.addEventListener("resize", () => this.resize());
    this.resize();
  }

  /* ============================ setup ============================ */

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: "default",
    });
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, this.calidadBaja ? 1.25 : 1.75),
    );
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.98;
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xb8dce9, 30, 100);

    this.camera = new THREE.PerspectiveCamera(48, 1, 0.1, 600);
    this.camera.position.set(0, 13, 26);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.enablePan = false;
    this.controls.minDistance = 3.5;
    this.controls.maxDistance = 30;
    this.controls.minPolarAngle = 0.35;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.06;
    this.controls.rotateSpeed = 0.55;
    this.controls.zoomSpeed = 0.7;
    this.controls.target.set(0, 3, 0);
    this.controls.autoRotateSpeed = 0.28;
    this._rotarDeseado = true; // lo que pide el flujo de la app
    this.vistaFijada = true; // lo que pidió la persona (manda esto)
    this._aplicarRotacion();
  }

  _initLuces() {
    const hemi = new THREE.HemisphereLight(0xbfe4ff, 0x6b8a3a, 0.85);
    this.scene.add(hemi);
    this.hemi = hemi;

    const sol = new THREE.DirectionalLight(0xfff2c4, 1.85);
    sol.position.set(11, 16, 7);
    sol.castShadow = true;
    sol.shadow.mapSize.set(
      this.calidadBaja ? 1024 : 2048,
      this.calidadBaja ? 1024 : 2048,
    );
    const d = 17;
    sol.shadow.camera.left = -d;
    sol.shadow.camera.right = d;
    sol.shadow.camera.top = d;
    sol.shadow.camera.bottom = -d;
    sol.shadow.camera.near = 1;
    sol.shadow.camera.far = 60;
    sol.shadow.bias = -0.0016;
    sol.shadow.normalBias = 0.03;
    this.scene.add(sol);
    this.sol = sol;

    // relleno cálido de rebote
    const relleno = new THREE.DirectionalLight(0xffd98a, 0.45);
    relleno.position.set(-9, 5, -8);
    this.scene.add(relleno);
    this.relleno = relleno;
  }

  _initCielo() {
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uArriba: { value: new THREE.Color(0x429be0) },
        uMedio: { value: new THREE.Color(0x86cef4) },
        uAbajo: { value: new THREE.Color(0xd8eff4) },
      },
      vertexShader: `
        varying vec3 vPos;
        void main(){
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 uArriba; uniform vec3 uMedio; uniform vec3 uAbajo;
        varying vec3 vPos;
        void main(){
          float h = clamp(normalize(vPos).y * 0.5 + 0.5, 0.0, 1.0);
          vec3 c = mix(uAbajo, uMedio, smoothstep(0.42, 0.58, h));
          c = mix(c, uArriba, smoothstep(0.56, 0.95, h));
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    const cielo = new THREE.Mesh(new THREE.SphereGeometry(260, 32, 20), mat);
    this.scene.add(cielo);
    this.cieloMat = mat;

    // disco solar
    const solTex = discoTextura();
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: solTex,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    sprite.scale.setScalar(52);
    sprite.position.set(-35, 24, -95);
    this.scene.add(sprite);
    this.sunSprite = sprite;
  }

  _initSuelo() {
    const geo = new THREE.PlaneGeometry(160, 160, 160, 160);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, alturaTerreno(pos.getX(i), pos.getZ(i)));
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color: 0x679642,
      roughness: 1,
      metalness: 0,
    });
    const suelo = new THREE.Mesh(geo, mat);
    suelo.receiveShadow = true;
    this.scene.add(suelo);
    this.suelo = suelo;
  }

  _initPasto() {
    const movil = window.innerWidth < 820;
    const N = this.calidadBaja ? 5000 : 14000;

    const hoja = new THREE.PlaneGeometry(0.055, 1, 1, 4);
    hoja.translate(0, 0.5, 0);
    const p = hoja.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      p.setX(i, p.getX(i) * (1 - y * 0.85)); // se afina hacia la punta
      p.setZ(i, y * y * 0.08);
    }
    p.needsUpdate = true;
    hoja.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      metalness: 0,
      side: THREE.DoubleSide,
    });
    const uTime = { value: 0 };
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = uTime;
      sh.vertexShader =
        "uniform float uTime;\nattribute float aRand;\n" +
        sh.vertexShader.replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
         float sway = sin(uTime * 1.4 + aRand * 12.0) * 0.16 + sin(uTime * 0.6 + aRand * 5.0) * 0.07;
         transformed.x += sway * pow(max(transformed.y, 0.0), 1.6);
         transformed.z += sway * 0.5 * pow(max(transformed.y, 0.0), 1.6);`,
        );
    };
    this._pastoTime = uTime;

    const inst = new THREE.InstancedMesh(hoja, mat, N);
    inst.castShadow = false;
    inst.receiveShadow = true;
    const rnd = mulberry32(7);
    const dummy = new THREE.Object3D();
    const rands = new Float32Array(N);
    const col = new THREE.Color();

    for (let i = 0; i < N; i++) {
      const a = rnd() * TWO_PI;
      const r = Math.pow(rnd(), 0.55) * 30;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      dummy.position.set(x, alturaTerreno(x, z) - 0.02, z);
      dummy.rotation.set(0, rnd() * TWO_PI, (rnd() - 0.5) * 0.25);
      const h = 0.2 + rnd() * 0.36;
      dummy.scale.set(0.7 + rnd() * 0.5, h, 1);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      col.setHSL(
        0.245 + rnd() * 0.065,
        0.46 + rnd() * 0.2,
        0.22 + rnd() * 0.15,
      );
      inst.setColorAt(i, col);
      rands[i] = rnd();
    }
    hoja.setAttribute("aRand", new THREE.InstancedBufferAttribute(rands, 1));
    inst.instanceMatrix.needsUpdate = true;
    this.scene.add(inst);
    this.pasto = inst;
  }

  _initDecor() {
    const rnd = mulberry32(21);

    // colinas lejanas: masas de follaje, no esferas lisas
    const matColina = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      flatShading: true,
    });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TWO_PI + rnd() * 0.4;
      const r = 62 + rnd() * 22;
      const s = 16 + rnd() * 16;
      const m = new THREE.Mesh(
        follaje(s, 2, rnd, 0x6ea34d, 0x3e6b34, 0.1),
        matColina,
      );
      m.position.set(Math.cos(a) * r, -s * 0.55 + rnd() * 2, Math.sin(a) * r);
      m.scale.y = 0.42 + rnd() * 0.25;
      this.scene.add(m);
    }

    // arbustos: muchos lóbulos chicos + hojas sueltas encima, para que se lean
    // como follaje y no como una piedra verde
    const matArb = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.95,
      flatShading: true,
    });
    const matTronco = new THREE.MeshStandardMaterial({
      color: 0x5a3f22,
      roughness: 1,
    });

    const geoHojita = hojaCarta();
    const matrices = [];
    const coloresHoja = [];
    const mTmp = new THREE.Matrix4();
    const qTmp = new THREE.Quaternion();
    const vArriba = new THREE.Vector3(0, 1, 0);
    const dir = new THREE.Vector3();
    const posHoja = new THREE.Vector3();
    const escHoja = new THREE.Vector3();
    const colHoja = new THREE.Color();

    for (let i = 0; i < 18; i++) {
      const a = rnd() * TWO_PI;
      const rr = 13 + rnd() * 19;
      const g = new THREE.Group();
      const alto = 0.85 + rnd() * 0.7;

      const tronco = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.13, alto, 6),
        matTronco,
      );
      tronco.position.y = alto * 0.5;
      tronco.castShadow = true;
      g.add(tronco);

      // racimo de lóbulos chicos en forma de domo
      const lobulos = [];
      const n = 7 + Math.floor(rnd() * 5);
      for (let j = 0; j < n; j++) {
        const s = 0.26 + rnd() * 0.34;
        const ang = rnd() * TWO_PI;
        const rad = Math.pow(rnd(), 0.6) * 0.85;
        const p = new THREE.Vector3(
          Math.cos(ang) * rad,
          alto * 0.72 + rnd() * 0.55 - rad * 0.42,
          Math.sin(ang) * rad,
        );
        const b = new THREE.Mesh(
          follaje(s, 1, rnd, 0x74b84a, 0x2c5c2b, 0.18),
          matArb,
        );
        b.position.copy(p);
        b.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
        b.castShadow = true;
        b.receiveShadow = true;
        g.add(b);
        lobulos.push({ p, s });
      }

      const x = Math.cos(a) * rr,
        z = Math.sin(a) * rr;
      g.position.set(x, alturaTerreno(x, z) - 0.05, z);
      g.scale.setScalar(0.85 + rnd() * 0.55);
      this.scene.add(g);
      g.updateMatrixWorld(true);

      // hojas pegadas a la superficie de cada lóbulo, mirando hacia afuera
      for (const l of lobulos) {
        const cuantas = 5 + Math.floor(rnd() * 5);
        for (let k = 0; k < cuantas; k++) {
          dir.set(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize();
          if (dir.y < -0.2) dir.y = -dir.y; // casi ninguna apunta al piso
          dir.normalize();
          posHoja.copy(l.p).addScaledVector(dir, l.s * 0.82);
          qTmp.setFromUnitVectors(vArriba, dir);
          qTmp.multiply(
            new THREE.Quaternion().setFromAxisAngle(vArriba, rnd() * TWO_PI),
          );
          const e = l.s * (0.5 + rnd() * 0.45);
          escHoja.set(e, e, e);
          mTmp.compose(posHoja, qTmp, escHoja);
          matrices.push(g.matrixWorld.clone().multiply(mTmp));
          colHoja.setHSL(
            0.255 + rnd() * 0.06,
            0.45 + rnd() * 0.25,
            0.24 + dir.y * 0.1 + rnd() * 0.12,
          );
          coloresHoja.push(colHoja.clone());
        }
      }
    }

    const hojas = new THREE.InstancedMesh(
      geoHojita,
      new THREE.MeshStandardMaterial({
        roughness: 0.85,
        side: THREE.DoubleSide,
      }),
      matrices.length,
    );
    matrices.forEach((m, k) => {
      hojas.setMatrixAt(k, m);
      hojas.setColorAt(k, coloresHoja[k]);
    });
    hojas.instanceMatrix.needsUpdate = true;
    hojas.castShadow = true;
    hojas.receiveShadow = true;
    this.scene.add(hojas);

    // piedritas sueltas, para que el claro no sea sólo pasto
    const matPiedra = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.95,
      flatShading: true,
    });
    for (let i = 0; i < 10; i++) {
      const a = rnd() * TWO_PI;
      const r = 6 + rnd() * 20;
      const s = 0.18 + rnd() * 0.34;
      const m = new THREE.Mesh(
        follaje(s, 0, rnd, 0xcfc7b6, 0x9a9184, 0.32),
        matPiedra,
      );
      const x = Math.cos(a) * r,
        z = Math.sin(a) * r;
      m.position.set(x, alturaTerreno(x, z) + s * 0.25, z);
      m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
      m.scale.y = 0.6 + rnd() * 0.3;
      m.castShadow = true;
      m.receiveShadow = true;
      this.scene.add(m);
    }

    // nubes
    this.nubes = [];
    const matNube = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 1,
      flatShading: true,
      emissive: 0x8899aa,
      emissiveIntensity: 0.18,
    });
    for (let i = 0; i < 9; i++) {
      const g = new THREE.Group();
      const n = 3 + Math.floor(rnd() * 3);
      for (let j = 0; j < n; j++) {
        const s = 2.4 + rnd() * 3.2;
        const b = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), matNube);
        b.position.set(
          (rnd() - 0.5) * 9,
          (rnd() - 0.5) * 1.6,
          (rnd() - 0.5) * 5,
        );
        b.scale.y = 0.55;
        g.add(b);
      }
      const a = rnd() * TWO_PI;
      const r = 40 + rnd() * 45;
      g.position.set(Math.cos(a) * r, 22 + rnd() * 16, Math.sin(a) * r);
      g.userData.vel = 0.12 + rnd() * 0.22;
      this.scene.add(g);
      this.nubes.push(g);
    }
  }

  _initPolen() {
    const N = this.calidadBaja ? 140 : 300;
    const pos = new Float32Array(N * 3);
    const fase = new Float32Array(N);
    const rnd = mulberry32(99);
    for (let i = 0; i < N; i++) {
      const a = rnd() * TWO_PI;
      const r = Math.pow(rnd(), 0.6) * 22;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = 0.3 + rnd() * 9;
      pos[i * 3 + 2] = Math.sin(a) * r;
      fase[i] = rnd() * TWO_PI;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aFase", new THREE.BufferAttribute(fase, 1));

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uTex: { value: discoTextura(64, "rgba(255,232,150,") },
        uSize: { value: 34 * Math.min(window.devicePixelRatio, 2) },
      },
      vertexShader: `
        uniform float uTime; uniform float uSize;
        attribute float aFase;
        varying float vAlpha;
        void main(){
          vec3 p = position;
          p.x += sin(uTime * 0.45 + aFase) * 1.4;
          p.y += sin(uTime * 0.32 + aFase * 1.7) * 0.9;
          p.z += cos(uTime * 0.38 + aFase * 0.8) * 1.4;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = clamp(uSize / max(-mv.z, 2.0), 1.0, 9.0) * (0.6 + 0.4 * sin(uTime + aFase));
          vAlpha = 0.22 + 0.22 * sin(uTime * 0.8 + aFase * 2.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform sampler2D uTex; varying float vAlpha;
        void main(){
          vec4 t = texture2D(uTex, gl_PointCoord);
          gl_FragColor = vec4(t.rgb, t.a * vAlpha);
          if (gl_FragColor.a < 0.01) discard;
        }`,
    });
    this.polen = new THREE.Points(geo, mat);
    this.polenMat = mat;
    this.scene.add(this.polen);
  }

  _initBichos() {
    const movil = window.innerWidth < 820;
    this.bichos = new Bichos(this.scene, {
      abejas: movil ? 2 : 4,
      mariposas: movil ? 3 : 5,
    });
  }

  _initPost() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.22, 0.5, 0.95);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  /* ============================ siembra ============================ */

  /** Devuelve el punto del terreno bajo las coordenadas de pantalla (0..1) */
  puntoEnSuelo(nx, ny) {
    this.puntero.set(nx * 2 - 1, -(ny * 2 - 1));
    this.raycaster.setFromCamera(this.puntero, this.camera);
    const hit = this.raycaster.intersectObject(this.suelo, false)[0];
    if (!hit) return null;
    if (Math.hypot(hit.point.x, hit.point.z) > 15) return null;
    return hit.point;
  }

  sembrar(punto, { duracion = 1500, retraso = 0, seed = Math.random() } = {}) {
    const flower = new Flower(seed);
    flower.position.copy(punto);
    flower.userData.origen = {
      pos: flower.position.clone(),
      rot: flower.rotation.clone(),
    };
    this.scene.add(flower);
    this.flores.push(flower);
    if (!duracion || reducedMotion.matches) flower.setGrowth(1);
    else
      flower.userData.crecimiento = {
        inicio: performance.now() + duration(retraso),
        duracion: duration(duracion),
      };
    return flower;
  }

  /** Flores decorativas ya abiertas (fondo del intro). No cuentan como sembradas. */
  sembrarCampo(n = 60) {
    const rnd = mulberry32(99);
    for (let i = 0; i < n; i++) {
      const cluster = i % 8,
        angle = (cluster / 8) * TWO_PI;
      const distance = 6 + (cluster % 3) * 2.7;
      const x = Math.cos(angle) * distance + (rnd() - 0.5) * 3.3;
      const z = -Math.abs(Math.sin(angle) * distance) + (rnd() - 0.5) * 2.4 - 4;
      const flower = new Flower(rnd());
      flower.position.set(x, alturaTerreno(x, z), z);
      flower.userData.decorativa = true;
      flower.userData.origen = {
        pos: flower.position.clone(),
        rot: flower.rotation.clone(),
      };
      flower.fijarEscala(0.6 + rnd() * 0.35);
      flower.setGrowth(1);
      this.scene.add(flower);
      this.flores.push(flower);
    }
  }

  sembrarAlAzar(n = 1, opts = {}) {
    const creadas = [];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TWO_PI;
      const r = 1.6 + Math.pow(Math.random(), 0.55) * 11;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      creadas.push(
        this.sembrar(new THREE.Vector3(x, alturaTerreno(x, z), z), {
          retraso: i * 90 + (opts.retraso || 0),
          duracion: opts.duracion ?? 1500,
        }),
      );
    }
    return creadas;
  }

  limpiar() {
    for (const f of this.flores) {
      const prox = { t: f.growth };
      anime({
        targets: prox,
        t: 0,
        duration: 600,
        easing: "easeInBack",
        update: () => f.setGrowth(prox.t),
        complete: () => {
          this.scene.remove(f);
          f.dispose();
        },
      });
    }
    this.flores = [];
    if (this.ramo) {
      this.scene.remove(this.ramo);
      this.ramo = null;
    }
    this.bouquetActivo = false;
  }

  /* ============================ cámara ============================ */

  _aplicarRotacion() {
    this.controls.autoRotate =
      this._rotarDeseado && !this.vistaFijada && !reducedMotion.matches;
  }

  /** Lo que quiere el flujo (entrar al jardín, armar el ramo, etc.) */
  autoRotar(v) {
    this._rotarDeseado = v;
    this._aplicarRotacion();
  }

  /** Lo que pide la persona con el botón: si está fija, nada la mueve sola */
  fijarVista(v) {
    this.vistaFijada = v;
    this._aplicarRotacion();
    return this.vistaFijada;
  }

  volar(pos, target, duracion = 2200, easing = "easeInOutQuart") {
    this.autoRotar(false);
    duracion = duration(duracion);
    if (!duracion) {
      this._camGen = (this._camGen || 0) + 1;
      this.camera.position.copy(pos);
      this.controls.target.copy(target);
      this.controls.update();
      return Promise.resolve();
    }
    // Cada vuelo tiene su "generación": si empieza otro, el anterior deja de
    // escribir sobre la cámara (evitamos anime.remove, que mata el motor).
    const gen = (this._camGen = (this._camGen || 0) + 1);
    const p = {
      x: this.camera.position.x,
      y: this.camera.position.y,
      z: this.camera.position.z,
      tx: this.controls.target.x,
      ty: this.controls.target.y,
      tz: this.controls.target.z,
    };
    const inst = anime({
      targets: p,
      x: pos.x,
      y: pos.y,
      z: pos.z,
      tx: target.x,
      ty: target.y,
      tz: target.z,
      duration: duracion,
      easing,
      update: () => {
        if (gen !== this._camGen) return;
        this.camera.position.set(p.x, p.y, p.z);
        this.controls.target.set(p.tx, p.ty, p.tz);
      },
    });
    return Promise.race([inst.finished, espera(duracion + 250)]);
  }

  vistaJardin(duracion = 1800) {
    this.controls.enabled = true;
    return this.volar(
      new THREE.Vector3(0, 3.1, 9.5),
      new THREE.Vector3(0, 1.1, 0),
      duracion,
    ).then(() => {
      this.controls.autoRotateSpeed = 0.22;
      this.autoRotar(true);
    });
  }

  vistaRamo(duracion = 1200) {
    this.autoRotar(false);
    const mobile = innerWidth < 641;
    const portada = document.body.dataset.mode === "intro";
    this.controls.enabled = !portada;
    const target = mobile
      ? new THREE.Vector3(0, portada ? 2.65 : 0.15, 0)
      : new THREE.Vector3(portada ? -1.65 : 1.05, 1.4, 0);
    const distance = mobile ? (portada ? 6.4 : 6.2) : 5.9;
    return this.volar(
      new THREE.Vector3(target.x, target.y + 1.25, distance),
      target,
      duracion,
    );
  }

  /* ============================ ramo ============================ */

  /**
   * Envoltura: pliegos de papel abiertos en abanico, lazo con colas y el
   * atado de tallos asomando por abajo. El origen del grupo es el nudo.
   */
  _crearEnvoltura() {
    const group = new THREE.Group();
    const paperColor = PAPERS[this.estilo.papel] || PAPERS.marfil;
    const ribbonColor = RIBBONS[this.estilo.cinta] || RIBBONS.rosa;
    // Continuous, pleated paper: narrow at the knot, open around the flowers.
    for (let layer = 0; layer < 2; layer++) {
      const points = [],
        indices = [],
        segments = 72,
        rows = 10;
      for (let row = 0; row <= rows; row++) {
        const t = row / rows;
        for (let i = 0; i <= segments; i++) {
          const angle = (i / segments) * TWO_PI;
          const pleat = Math.sin(angle * 9 + layer) * 0.055 * t * t;
          const radius = 0.1 + Math.pow(t, 1.2) * (0.66 + layer * 0.1) + pleat;
          const top = 0.63 + Math.cos(angle * 3 + layer) * 0.09;
          points.push(
            Math.cos(angle) * radius,
            -0.17 + t * top + layer * 0.07,
            Math.sin(angle) * radius,
          );
          if (row < rows && i < segments) {
            const a = row * (segments + 1) + i,
              b = a + segments + 1;
            indices.push(a, b, a + 1, b, b + 1, a + 1);
          }
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(points, 3),
      );
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      const color = new THREE.Color(paperColor).multiplyScalar(
        layer ? 1.03 : 0.94,
      );
      const material = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.93,
        side: THREE.DoubleSide,
        emissive: paperColor,
        emissiveIntensity: 0.1,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      group.add(mesh);
    }
    const stems = new THREE.Mesh(
      new THREE.CylinderGeometry(0.095, 0.075, 0.48, 12),
      new THREE.MeshStandardMaterial({ color: 0x61734a, roughness: 0.85 }),
    );
    stems.position.y = -0.25;
    group.add(stems);
    const ribbon = new THREE.MeshStandardMaterial({
      color: ribbonColor,
      roughness: 0.52,
      side: THREE.DoubleSide,
    });
    const knot = new THREE.Mesh(
      new THREE.SphereGeometry(0.085, 16, 10),
      ribbon,
    );
    knot.scale.set(1, 0.7, 0.65);
    knot.position.set(0, -0.05, 0.14);
    group.add(knot);
    for (const side of [-1, 1]) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, -0.05, 0.14),
        new THREE.Vector3(side * 0.18, 0.06, 0.18),
        new THREE.Vector3(side * 0.31, 0.02, 0.16),
        new THREE.Vector3(side * 0.22, -0.09, 0.2),
        new THREE.Vector3(0, -0.05, 0.14),
      ]);
      const loop = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 28, 0.026, 6, false),
        ribbon,
      );
      group.add(loop);
      const tail = new THREE.Shape();
      tail.moveTo(-0.04, 0);
      tail.lineTo(0.04, 0);
      tail.bezierCurveTo(0.01, -0.17, 0.1, -0.32, 0.04, -0.48);
      tail.lineTo(0, -0.43);
      tail.lineTo(-0.04, -0.48);
      tail.bezierCurveTo(0.02, -0.25, -0.08, -0.14, -0.04, 0);
      const mesh = new THREE.Mesh(new THREE.ShapeGeometry(tail, 16), ribbon);
      mesh.position.set(side * 0.04, -0.06, 0.16);
      mesh.rotation.z = side * 0.3;
      group.add(mesh);
    }
    const rnd = mulberry32(4242);
    const leaf = hojaCarta(),
      leafMat = new THREE.MeshStandardMaterial({
        color: 0x899978,
        roughness: 0.85,
        side: THREE.DoubleSide,
      });
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * TWO_PI;
      const mesh = new THREE.Mesh(leaf, leafMat);
      mesh.position.set(Math.cos(angle) * 0.22, 0.18, Math.sin(angle) * 0.22);
      mesh.rotation.set(Math.sin(angle) * 0.85, angle, -Math.cos(angle) * 0.85);
      mesh.scale.setScalar(0.48 + rnd() * 0.15);
      group.add(mesh);
    }
    const whiteGeo = new THREE.SphereGeometry(0.022, 6, 5);
    const whiteMat = new THREE.MeshStandardMaterial({
      color: 0xfff6dd,
      roughness: 0.8,
    });
    for (let i = 0; i < 36; i++) {
      const a = rnd() * TWO_PI,
        r = 0.4 + rnd() * 0.3;
      const mesh = new THREE.Mesh(whiteGeo, whiteMat);
      mesh.position.set(Math.cos(a) * r, 0.52 + rnd() * 0.28, Math.sin(a) * r);
      group.add(mesh);
    }
    return group;
  }

  /** Sitio (posición, inclinación y alto) de la flor i dentro de un ramo de n */
  _sitioEnRamo(i, n, base) {
    const ang = i * 2.39996; // ángulo áureo: reparto parejo
    const k = n <= 1 ? 0 : Math.sqrt((i + 0.5) / n);
    const r = 0.42 * k;
    return {
      pos: new THREE.Vector3(
        base.x + Math.cos(ang) * r,
        base.y,
        base.z + Math.sin(ang) * r,
      ),
      tiltZ: -Math.cos(ang) * k * 0.5,
      tiltX: Math.sin(ang) * k * 0.5,
      // domo: las del centro sobresalen, las del borde quedan más bajas
      alto: 1.26 - k * 0.42,
    };
  }

  /** Arma un ramo con `n` flores (siembra las que falten) */
  async armarRamo(n) {
    this.bouquetActivo = true;
    this.autoRotar(false);

    const faltan = n - this.flores.length;
    if (faltan > 0) {
      this.sembrarAlAzar(faltan, { duracion: 900 });
      await espera(600 + faltan * 90);
    }

    const elegidas = this.flores.slice(-n);
    const base = new THREE.Vector3(0, 0.78, 0);

    this.vistaRamo(1800);

    const ramo = this._crearEnvoltura();
    ramo.position.copy(base);
    this.scene.add(ramo);
    this.ramo = ramo;
    ramo.scale.setScalar(0.001);
    anime({
      targets: ramo.scale,
      x: 1,
      y: 1,
      z: 1,
      duration: 900,
      delay: 500,
      easing: "easeOutElastic(1, .6)",
    });

    const total = elegidas.length;
    elegidas.forEach((f, i) => {
      const sitio = this._sitioEnRamo(i, total, base);
      const inicio = f.position.clone();
      const escalaFin = sitio.alto / f.userData.altura;
      const escalaIni = f.escalaBase;
      const control = inicio
        .clone()
        .lerp(sitio.pos, 0.5)
        .setY(Math.max(inicio.y, sitio.pos.y) + 2.2 + Math.random());

      const prox = { t: 0 };
      anime({
        targets: prox,
        t: 1,
        duration: 1500 + Math.random() * 400,
        delay: 350 + i * 55,
        easing: "easeInOutCubic",
        update: () => {
          const t = prox.t,
            u = 1 - t;
          f.position.set(
            u * u * inicio.x + 2 * u * t * control.x + t * t * sitio.pos.x,
            u * u * inicio.y + 2 * u * t * control.y + t * t * sitio.pos.y,
            u * u * inicio.z + 2 * u * t * control.z + t * t * sitio.pos.z,
          );
          f.userData.tiltZ = sitio.tiltZ * t;
          f.userData.tiltX = sitio.tiltX * t;
          f.fijarEscala(escalaIni + (escalaFin - escalaIni) * t);
        },
      });
    });

    this.floresRamo = elegidas;
    await espera(350 + total * 55 + 1700);
    return elegidas;
  }

  /** Hace crecer un ramo ya armado desde cero (modo regalo recibido) */
  async ramoSorpresa(n) {
    this.autoRotar(false);
    this.bouquetActivo = true;
    const base = new THREE.Vector3(0, 0.78, 0);

    const ramo = this._crearEnvoltura();
    ramo.position.copy(base);
    this.scene.add(ramo);
    this.ramo = ramo;
    ramo.scale.setScalar(0.001);
    anime({
      targets: ramo.scale,
      x: 1,
      y: 1,
      z: 1,
      duration: 800,
      easing: "easeOutElastic(1, .6)",
    });

    for (let i = 0; i < n; i++) {
      const sitio = this._sitioEnRamo(i, n, base);
      const f = this.sembrar(sitio.pos, {
        duracion: 1400,
        retraso: 300 + i * 110,
      });
      f.fijarEscala(sitio.alto / f.userData.altura);
      f.userData.tiltZ = sitio.tiltZ;
      f.userData.tiltX = sitio.tiltX;
    }
    this.floresRamo = this.flores.slice(-n);
    await espera(600 + n * 110 + 900);
  }

  /** Devuelve las flores del ramo a su lugar en el jardín */
  async deshacerRamo() {
    if (!this.bouquetActivo) return;
    if (this.ramo) {
      const ramo = this.ramo;
      anime({
        targets: ramo.scale,
        x: 0.001,
        y: 0.001,
        z: 0.001,
        duration: 500,
        easing: "easeInBack",
        complete: () => this.scene.remove(ramo),
      });
      this.ramo = null;
    }
    for (const f of this.floresRamo || []) {
      const o = f.userData.origen;
      if (!o) continue;
      const inicio = f.position.clone();
      const esc0 = f.escalaBase;
      const control = inicio
        .clone()
        .lerp(o.pos, 0.5)
        .setY(inicio.y + 2);
      const prox = { t: 0 };
      anime({
        targets: prox,
        t: 1,
        duration: 1300,
        delay: Math.random() * 300,
        easing: "easeInOutCubic",
        update: () => {
          const t = prox.t,
            u = 1 - t;
          f.position.set(
            u * u * inicio.x + 2 * u * t * control.x + t * t * o.pos.x,
            u * u * inicio.y + 2 * u * t * control.y + t * t * o.pos.y,
            u * u * inicio.z + 2 * u * t * control.z + t * t * o.pos.z,
          );
          f.userData.tiltZ = (f.userData.tiltZ || 0) * (1 - t);
          f.userData.tiltX = (f.userData.tiltX || 0) * (1 - t);
          f.fijarEscala(esc0 + (1 - esc0) * t);
        },
      });
    }
    this.bouquetActivo = false;
    this.floresRamo = [];
    await this.vistaJardin(2000);
  }

  _initLuciernagas() {
    const positions = new Float32Array(65 * 3);
    const rnd = mulberry32(861);
    for (let i = 0; i < 65; i++) {
      positions[i * 3] = (rnd() - 0.5) * 16;
      positions[i * 3 + 1] = 0.6 + rnd() * 2;
      positions[i * 3 + 2] = (rnd() - 0.5) * 15;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.luciernagas = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color: 0xffe49a,
        size: 0.09,
        map: discoTextura(),
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.scene.add(this.luciernagas);
  }

  aplicarEstilo(style) {
    this.estilo = { ...this.estilo, ...style };
    const night = this.estilo.ambiente === "noche";
    this.cieloMat.uniforms.uArriba.value.set(night ? 0x111d3b : 0x429be0);
    this.cieloMat.uniforms.uMedio.value.set(night ? 0x35466d : 0x86cef4);
    this.cieloMat.uniforms.uAbajo.value.set(night ? 0x706d93 : 0xd8eff4);
    this.scene.fog.color.set(night ? 0x354159 : 0xb8dce9);
    this.hemi.color.set(night ? 0xb9b8e0 : 0xd4edff);
    this.hemi.groundColor.set(night ? 0x525367 : 0x688b43);
    this.hemi.intensity = night ? 0.75 : 1.0;
    this.sol.color.set(night ? 0xb6c3ec : 0xfff1d1);
    this.sol.intensity = night ? 1.3 : 1.9;
    this.sol.position.set(-6, 9, 6);
    this.relleno.intensity = night ? 0.5 : 0.35;
    this.sunSprite.material.color.set(night ? 0xc0c5f3 : 0xffd9a1);
    this.sunSprite.scale.setScalar(night ? 12 : 22);
    this.renderer.toneMappingExposure = night ? 0.9 : 1.0;
  }

  eliminarRamo() {
    for (const flower of this.floresRamo || []) {
      this.scene.remove(flower);
      flower.dispose();
      const index = this.flores.indexOf(flower);
      if (index >= 0) this.flores.splice(index, 1);
    }
    this.floresRamo = [];
    if (this.ramo) {
      const geometries = new Set(),
        materials = new Set();
      this.ramo.traverse((object) => {
        if (object.geometry) geometries.add(object.geometry);
        if (object.material) materials.add(object.material);
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      this.scene.remove(this.ramo);
      this.ramo = null;
    }
    this.bouquetActivo = false;
  }

  async presentarRamo(data, instant = false) {
    this.eliminarRamo();
    this.aplicarEstilo(data);
    this.bouquetActivo = true;
    this.autoRotar(false);
    const base = new THREE.Vector3(0, 0.78, 0);
    this.ramo = this._crearEnvoltura();
    this.ramo.position.copy(base);
    this.scene.add(this.ramo);
    const rnd = mulberry32(Math.floor(data.semilla * 1e9));
    for (let i = 0; i < data.flores; i++) {
      const site = this._sitioEnRamo(i, data.flores, base);
      const flower = this.sembrar(site.pos, {
        duracion: instant ? 0 : 1300,
        retraso: instant ? 0 : 150 + i * 45,
        seed: rnd(),
      });
      flower.userData.regalo = true;
      flower.fijarEscala(site.alto / flower.userData.altura);
      flower.userData.tiltZ = site.tiltZ;
      flower.userData.tiltX = site.tiltX;
      flower.userData.recuerdo =
        data.recuerdos?.[i % (data.recuerdos?.length || 1)] || "";
    }
    this.floresRamo = this.flores.slice(-data.flores);
    await this.vistaRamo(instant ? 0 : 1400);
    if (!instant) await pause(300 + data.flores * 45);
    for (const flower of this.floresRamo) {
      delete flower.userData.crecimiento;
      flower.setGrowth(1);
    }
  }

  recuerdoEnPunto(x, y) {
    this.puntero.set(x * 2 - 1, -(y * 2 - 1));
    this.raycaster.setFromCamera(this.puntero, this.camera);
    const hit = this.raycaster.intersectObjects(this.floresRamo || [], true)[0];
    if (!hit) return null;
    let object = hit.object;
    while (object && !object.userData.recuerdo) object = object.parent;
    return object?.userData.recuerdo || null;
  }

  exportarJardin() {
    return this.flores
      .filter((f) => !f.userData.decorativa && !f.userData.regalo)
      .slice(0, 100)
      .map((f) => ({ x: f.position.x, z: f.position.z, seed: f.seed }));
  }

  restaurarJardin(flowers) {
    for (const point of (Array.isArray(flowers) ? flowers : []).slice(0, 100)) {
      if (
        ![point.x, point.z, point.seed].every(Number.isFinite) ||
        Math.abs(point.x) > 20 ||
        Math.abs(point.z) > 20
      )
        continue;
      this.sembrar(
        new THREE.Vector3(point.x, alturaTerreno(point.x, point.z), point.z),
        { duracion: 0, seed: point.seed },
      );
    }
  }

  borrarSiembras() {
    for (const flower of [...this.flores]) {
      if (flower.userData.decorativa || flower.userData.regalo) continue;
      this.scene.remove(flower);
      flower.dispose();
      this.flores.splice(this.flores.indexOf(flower), 1);
    }
  }

  /* ============================ loop ============================ */

  resize() {
    const w = window.innerWidth,
      h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    if (this.bouquetActivo) this.vistaRamo(0);
  }

  render() {
    const elapsed = this.reloj.getDelta();
    if (this.editorPausado) return;
    const dt = reducedMotion.matches ? 0 : Math.min(elapsed, 0.05);
    this.tiempo += dt;
    const t = this.tiempo;

    this._pastoTime.value = t;
    this.polenMat.uniforms.uTime.value = t;

    const now = performance.now();
    for (const f of this.flores) {
      const growth = f.userData.crecimiento;
      if (growth) {
        const progress = reducedMotion.matches
          ? 1
          : Math.max(0, Math.min(1, (now - growth.inicio) / growth.duracion));
        f.setGrowth(1 - Math.pow(1 - progress, 3));
        if (progress === 1) delete f.userData.crecimiento;
      }
      f.update(t, reducedMotion.matches ? 0 : this.viento);
      if (f.userData.tiltZ) f.rotation.z += f.userData.tiltZ;
      if (f.userData.tiltX) f.rotation.x += f.userData.tiltX;
    }

    for (const n of this.nubes) {
      n.position.x += n.userData.vel * dt;
      if (n.position.x > 110) n.position.x = -110;
    }

    if (!reducedMotion.matches) this.bichos.actualizar(t, dt, this.flores);
    this.luciernagas.visible = this.estilo.ambiente === "noche";
    if (this.luciernagas.visible && !reducedMotion.matches) {
      const positions = this.luciernagas.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++)
        positions.setY(i, 1.4 + Math.sin(t * 0.3 + i * 1.7) * 0.7);
      positions.needsUpdate = true;
    }

    this.controls.update();
    this.composer.render();
  }

  iniciar() {
    const bucle = () => {
      this._raf = requestAnimationFrame(bucle);
      this.render();
    };
    bucle();
  }
}

/* ============================ utilidades ============================ */

function discoTextura(size = 128, rgb = "rgba(255,245,200,") {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  g.addColorStop(0, rgb + "1)");
  g.addColorStop(0.25, rgb + "0.75)");
  g.addColorStop(1, rgb + "0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Hojita plana con nervadura curva, apuntando a +Y (para los arbustos) */
function hojaCarta() {
  const f = new THREE.Shape();
  f.moveTo(0, 0);
  f.bezierCurveTo(0.3, 0.22, 0.24, 0.78, 0, 1);
  f.bezierCurveTo(-0.24, 0.78, -0.3, 0.22, 0, 0);
  const g = new THREE.ShapeGeometry(f, 8);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      y = pos.getY(i);
    pos.setZ(i, -0.35 * x * x + 0.12 * y * y); // se dobla como hoja de verdad
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/**
 * Masa irregular con color por vértice: sirve para follaje (verde arriba,
 * oscuro abajo) y para piedras (gris claro arriba, sombra abajo).
 */
function follaje(radio, detalle, rnd, claro, oscuro, rugosidad = 0.2) {
  const g = new THREE.IcosahedronGeometry(radio, detalle);
  const pos = g.attributes.position;
  const cA = new THREE.Color(claro);
  const cB = new THREE.Color(oscuro);
  const cols = new Float32Array(pos.count * 3);
  const c = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      y = pos.getY(i),
      z = pos.getZ(i);
    const n =
      Math.sin(x * 3.1 + 1.7) * Math.cos(z * 2.7) * Math.sin(y * 2.3 + 0.4);
    const d = 1 + n * rugosidad + (rnd() - 0.5) * rugosidad * 0.5;
    pos.setXYZ(i, x * d, y * d, z * d);

    const t = Math.min(1, Math.max(0, (y / radio) * 0.5 + 0.5));
    c.copy(cB).lerp(cA, t * t * (0.85 + rnd() * 0.3));
    cols[i * 3] = c.r;
    cols[i * 3 + 1] = c.g;
    cols[i * 3 + 2] = c.b;
  }
  pos.needsUpdate = true;
  g.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  g.computeVertexNormals();
  return g;
}

export function espera(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
