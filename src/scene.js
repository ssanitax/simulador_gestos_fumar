import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const MODELO_MECHERO = new URL("./assets/mechero.fbx", import.meta.url).href;
const ALTO_MECHERO = 1.48;

const SEPARACION = 0.95;
const FILTRO = 0.78;
const DURACION_FUMADA = 120;
const ORIGEN_PAPEL = -0.52;
const LARGO_ENTERO = 1.18;
const LARGO_MINIMO = 0.14;
const BOCA = { x: 0, y: 1.32, z: 3.55 };
const EXHALACION = { x: 0, y: 1.4, z: 3.7 };
const YAW_BOCA = Math.PI / 2;
const ALTURA_MESA = -0.42;
const CENICERO = { x: 0, z: 0.06 };
const RADIO_CUENCO = 0.36;
const RADIO_CERCA = 0.95;

export function crearMundo(canvas) {
  const escena = new THREE.Scene();
  escena.background = new THREE.Color("#07101c");
  escena.fog = new THREE.Fog("#07101c", 12, 28);

  const camara = new THREE.PerspectiveCamera(46, 1, 0.1, 80);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  crearLuces(escena);
  crearSuelo(escena);

  const mechero = crearMechero();
  const cigarro = crearCigarro();
  const humo = crearHumo(escena);
  const cenizaSuelta = crearCenizaSuelta(escena);
  crearCenicero(escena, renderer);
  escena.add(mechero.grupo);
  escena.add(cigarro.grupo);

  const punta = new THREE.Vector3();
  const llamaPunto = new THREE.Vector3();

  let zurdo = false;
  let encendido = false;
  let agotado = false;
  let consumo = 0;
  let factorBoca = 0;
  let esperaBoca = 0;
  let enBocaFirme = false;
  let cenizaSoltada = 0;
  let ultimaSacudida = -1;
  let factorAbajo = 0;
  let estabaApoyado = false;
  const muestrasMano = [];
  let tiempo = 0;
  let poseMechero = { x: -SEPARACION, y: ALTURA_MESA, z: 0.05 };
  let poseCigarro = { x: SEPARACION, y: ALTURA_MESA + 0.1, z: 0.05 };
  let giroMechero = 0.4;
  let giroCigarro = Math.PI;
  let azimut = 0;
  let alturaCamara = 2.35;

  function reposo() {
    const lado = zurdo ? 1 : -1;
    return {
      mechero: { x: lado * SEPARACION, y: ALTURA_MESA, z: 0.05 },
      cigarro: { x: -lado * SEPARACION, y: ALTURA_MESA + 0.1, z: 0.05 },
      giroMechero: zurdo ? Math.PI - 0.5 : 0.5,
      giroCigarro: zurdo ? 0 : Math.PI,
    };
  }

  function fijarMano(esZurdo, inmediato = false) {
    zurdo = esZurdo;
    if (!inmediato) return;
    const base = reposo();
    poseMechero = { ...base.mechero };
    poseCigarro = { ...base.cigarro };
    giroMechero = base.giroMechero;
    giroCigarro = base.giroCigarro;
    colocar();
  }

  function colocar() {
    mechero.grupo.position.set(poseMechero.x, poseMechero.y, poseMechero.z);
    mechero.grupo.rotation.y = giroMechero;
    cigarro.grupo.position.set(poseCigarro.x, poseCigarro.y, poseCigarro.z);
    cigarro.grupo.rotation.y = giroCigarro;
  }

  function ajustar() {
    const ancho = window.innerWidth;
    const alto = Math.max(window.innerHeight, 1);
    camara.aspect = ancho / alto;
    camara.updateProjectionMatrix();
    renderer.setSize(ancho, alto);
  }

  function actualizar(entrada, dt) {
    const base = reposo();
    const control = entrada?.control;
    tiempo += dt;

    const llevaMechero = Boolean(control?.destinoMechero);
    const llevaCigarro = Boolean(control?.destinoCigarro);
    const metaMechero = llevaMechero
      ? {
          x: control.destinoMechero.x,
          y: Math.max(ALTURA_MESA, control.destinoMechero.y - 1.22),
          z: control.destinoMechero.z,
        }
      : base.mechero;
    const enLaBoca = acercamiento(entrada?.cara, control, encendido && llevaCigarro && !control?.puntaAbajo, dt);
    factorAbajo = seguir(factorAbajo, llevaCigarro && control?.puntaAbajo ? 1 : 0, 8, dt);
    giroMechero = seguir(giroMechero, base.giroMechero, 8, dt);
    let yaw = base.giroCigarro;
    if (llevaCigarro && control?.destinoCigarro) {
      const dx = poseMechero.x - control.destinoCigarro.x;
      const dz = poseMechero.z - control.destinoCigarro.z;
      if (Math.hypot(dx, dz) > 0.12) yaw = Math.atan2(-dz, dx);
    }
    giroCigarro = seguirAngulo(giroCigarro, mezclarAngulo(yaw, YAW_BOCA, enLaBoca), llevaCigarro ? 10 : 6, dt);
    let metaCigarro = llevaCigarro && control?.destinoCigarro
      ? desdeFiltro(control.destinoCigarro, giroCigarro)
      : base.cigarro;
    if (llevaCigarro && control?.destinoCigarro && factorAbajo > 0) {
      metaCigarro = mezclarPunto(metaCigarro, {
        x: control.destinoCigarro.x,
        y: control.destinoCigarro.y - FILTRO,
        z: control.destinoCigarro.z,
      }, factorAbajo);
    }
    if (enLaBoca > 0) metaCigarro = mezclarPunto(metaCigarro, BOCA, enLaBoca);

    poseMechero = seguirPunto(poseMechero, metaMechero, llevaMechero ? 26 : 5, dt);
    poseCigarro = seguirPunto(poseCigarro, metaCigarro, llevaCigarro ? 26 : 5, dt);
    colocar();
    orientarCigarro(cigarro.grupo, giroCigarro, factorAbajo);

    const llama = Boolean(control?.llama);
    mechero.animarLlama(tiempo, llama);

    mechero.grupo.updateMatrixWorld(true);
    cigarro.grupo.updateMatrixWorld(true);
    if (llama && !encendido && !agotado) {
      mechero.ancla.getWorldPosition(llamaPunto);
      cigarro.ancla.getWorldPosition(punta);
      if (llamaPunto.distanceTo(punta) < 0.42) encendido = true;
    }
    const enLaPunta = enLaBoca > 0.7 && encendido;
    if (encendido) {
      const ritmo = enLaPunta ? 2 : 1;
      consumo = Math.min(1, consumo + (dt * ritmo) / DURACION_FUMADA);
      if (consumo >= 1) {
        encendido = false;
        agotado = true;
      }
    }
    const largoPapel = LARGO_ENTERO + (LARGO_MINIMO - LARGO_ENTERO) * consumo;
    const quemado = LARGO_ENTERO - largoPapel;
    let largoCeniza = Math.max(0, quemado - cenizaSoltada);
    aplicarConsumo(cigarro, consumo, largoCeniza, encendido);
    aplicarPunta(cigarro, encendido, consumo, tiempo);
    cigarro.grupo.updateMatrixWorld(true);
    cigarro.ancla.getWorldPosition(punta);
    let apoyado = false;
    if (factorAbajo > 0.55) {
      const suelo = ALTURA_MESA + 0.03;
      if (punta.y < suelo) {
        const sube = suelo - punta.y;
        poseCigarro.y += sube;
        cigarro.grupo.position.y += sube;
        punta.y = suelo;
        apoyado = true;
        if (!estabaApoyado) {
          encendido = false;
          aplicarPunta(cigarro, false, consumo, tiempo);
          cenizaSuelta.soltar(punta, 0.22);
        }
      }
    }
    estabaApoyado = apoyado;
    if (llevaCigarro && control?.pellizcoCigarro && largoCeniza > 0.06 && factorAbajo < 0.4) {
      const cerca = Math.hypot(punta.x - CENICERO.x, punta.z - CENICERO.z) < RADIO_CERCA;
      if (!cerca) muestrasMano.length = 0;
      else if (esSacudida(muestrasMano, control.pellizcoCigarro.y, tiempo) && tiempo - ultimaSacudida > 0.5) {
        cenizaSuelta.soltar(punta, largoCeniza);
        cenizaSoltada = quemado;
        ultimaSacudida = tiempo;
        muestrasMano.length = 0;
        largoCeniza = 0;
        aplicarConsumo(cigarro, consumo, 0, encendido);
      }
    } else if (!llevaCigarro) {
      muestrasMano.length = 0;
    }
    cenizaSuelta.actualizar(dt);
    const sigueEnBoca = enLaBoca > 0.7 && encendido;
    const exhalar = enBocaFirme && enLaBoca < 0.45;
    if (exhalar) enBocaFirme = false;
    else if (sigueEnBoca) enBocaFirme = true;
    humo.actualizar(sigueEnBoca, exhalar, punta, dt);

    const cara = entrada?.cara;
    const azimutObjetivo = cara ? THREE.MathUtils.clamp((0.5 - cara.x) * 0.35, -0.16, 0.16) : 0;
    const alturaObjetivo = cara
      ? THREE.MathUtils.clamp(2.35 + (0.5 - cara.y) * 0.45, 1.9, 2.8)
      : 2.35;
    azimut = seguir(azimut, azimutObjetivo, 3, dt);
    alturaCamara = seguir(alturaCamara, alturaObjetivo, 3, dt);
    const radio = 5.3;
    camara.position.set(Math.sin(azimut) * radio, alturaCamara, Math.cos(azimut) * radio);
    camara.lookAt(0, 0.55, 0);

    return { encendido, consumido: agotado, enBoca: enLaBoca > 0.55, apoyado };
  }

  function acercamiento(cara, control, activo, dt) {
    const pellizco = control?.pellizcoCigarro;
    let objetivo = 0;
    if (activo && pellizco && cara?.boca && cara.cercania > 0.02) {
      const dist = Math.hypot(pellizco.x - cara.boca.x, pellizco.y - cara.boca.y) / cara.cercania;
      objetivo = curva((1.85 - dist) / (1.85 - 0.42));
      esperaBoca = 0;
    } else if (activo && esperaBoca < 1.5) {
      esperaBoca += dt;
      objetivo = factorBoca;
    }
    factorBoca = seguir(factorBoca, objetivo, 5, dt);
    return factorBoca;
  }

  function dibujar() {
    renderer.render(escena, camara);
  }

  fijarMano(false, true);
  ajustar();
  window.addEventListener("resize", ajustar);
  return { actualizar, dibujar, fijarMano };
}

function desdeFiltro(pellizco, giro) {
  const ox = -FILTRO * Math.cos(giro);
  const oz = FILTRO * Math.sin(giro);
  return { x: pellizco.x - ox, y: pellizco.y, z: pellizco.z - oz };
}

function aplicarConsumo(cigarro, consumo, largoCeniza = 0, encendido = false) {
  const largo = LARGO_ENTERO + (LARGO_MINIMO - LARGO_ENTERO) * consumo;
  cigarro.papel.scale.x = largo;
  const extremo = ORIGEN_PAPEL + largo;
  const hayCeniza = largoCeniza > 0.03;
  cigarro.ceniza.visible = hayCeniza;
  cigarro.ceniza.position.x = extremo + 0.055;
  cigarro.ceniza.scale.y = Math.max(largoCeniza - 0.04, 0.001);
  const punta = extremo + (hayCeniza ? largoCeniza : encendido ? 0.072 : 0);
  cigarro.casquete.visible = !hayCeniza;
  cigarro.casquete.position.x = extremo - 0.008;
  cigarro.brasa.position.x = extremo + 0.018;
  cigarro.carbon.position.x = extremo + 0.05;
  cigarro.ancla.position.x = punta + 0.03;
  cigarro.luzPunta.position.x = extremo + 0.02;
  cigarro.materialCasquete.color.set(hayCeniza || encendido ? "#6e6963" : "#f3ead8");
}

function esSacudida(muestras, altura, ahora) {
  muestras.push({ t: ahora, y: altura });
  while (muestras.length && ahora - muestras[0].t > 0.65) muestras.shift();
  if (muestras.length < 5) return false;
  let minimo = muestras[0].y;
  let maximo = muestras[0].y;
  let cambios = 0;
  let signoPrevio = 0;
  for (let i = 1; i < muestras.length; i += 1) {
    minimo = Math.min(minimo, muestras[i].y);
    maximo = Math.max(maximo, muestras[i].y);
    const delta = muestras[i].y - muestras[i - 1].y;
    if (Math.abs(delta) < 0.012) continue;
    const signo = Math.sign(delta);
    if (signoPrevio && signo !== signoPrevio) cambios += 1;
    signoPrevio = signo;
  }
  return cambios >= 2 && maximo - minimo > 0.045;
}

function aplicarPunta(cigarro, encendido, consumo, tiempo) {
  const fade = encendido ? (consumo > 0.82 ? 1 - (consumo - 0.82) / 0.18 : 1) : 0;
  const brasa = cigarro.materialBrasa;
  const carbon = cigarro.materialCarbon;
  const quedaMarca = consumo > 0.02;
  cigarro.brasa.visible = encendido || quedaMarca;
  cigarro.carbon.visible = encendido || quedaMarca;
  if (fade > 0) {
    const pulso = 0.86 + Math.sin(tiempo * 17) * 0.1 + Math.sin(tiempo * 29) * 0.05;
    brasa.color.set("#ffffff");
    brasa.emissive.set("#ff5a18");
    brasa.emissiveIntensity = 1.05 * fade * pulso;
    carbon.color.set("#5c4036");
    carbon.emissive.set("#4a2410");
    carbon.emissiveIntensity = 0.12 * fade * pulso;
    cigarro.luzPunta.intensity = 0.62 * fade * pulso;
  } else {
    brasa.color.set("#3a332e");
    brasa.emissive.set("#000000");
    brasa.emissiveIntensity = 0;
    carbon.color.set("#4a433c");
    carbon.emissive.set("#000000");
    carbon.emissiveIntensity = 0;
    cigarro.luzPunta.intensity = 0;
  }
}

function curva(valor) {
  const x = Math.max(0, Math.min(1, valor));
  return x * x * (3 - 2 * x);
}

function mezclarPunto(a, b, t) {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

function seguir(actual, objetivo, rapidez, dt) {
  return actual + (objetivo - actual) * (1 - Math.exp(-rapidez * dt));
}

function diferenciaAngulo(desde, hasta) {
  let delta = hasta - desde;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

function seguirAngulo(actual, objetivo, rapidez, dt) {
  return actual + diferenciaAngulo(actual, objetivo) * (1 - Math.exp(-rapidez * dt));
}

function mezclarAngulo(a, b, t) {
  return a + diferenciaAngulo(a, b) * t;
}

const EJE_CIGARRO = new THREE.Vector3();
const REF_CIGARRO = new THREE.Vector3();
const Y_CIGARRO = new THREE.Vector3();
const Z_CIGARRO = new THREE.Vector3();
const BASE_CIGARRO = new THREE.Matrix4();

function orientarCigarro(grupo, yaw, abajo) {
  const alfa = abajo * (Math.PI / 2);
  const horizontal = Math.cos(alfa);
  EJE_CIGARRO.set(Math.cos(yaw) * horizontal, -Math.sin(alfa), -Math.sin(yaw) * horizontal).normalize();
  REF_CIGARRO.set(-Math.sin(yaw), 0.35, -Math.cos(yaw)).normalize();
  Z_CIGARRO.crossVectors(EJE_CIGARRO, REF_CIGARRO).normalize();
  Y_CIGARRO.crossVectors(Z_CIGARRO, EJE_CIGARRO).normalize();
  grupo.quaternion.setFromRotationMatrix(BASE_CIGARRO.makeBasis(EJE_CIGARRO, Y_CIGARRO, Z_CIGARRO));
}

function seguirPunto(actual, objetivo, rapidez, dt) {
  return {
    x: seguir(actual.x, objetivo.x, rapidez, dt),
    y: seguir(actual.y, objetivo.y, rapidez, dt),
    z: seguir(actual.z, objetivo.z, rapidez, dt),
  };
}

function crearHumo(escena) {
  const textura = texturaHumo();
  const libres = [];
  const vivos = [];
  const origenExhala = new THREE.Vector3(EXHALACION.x, EXHALACION.y, EXHALACION.z);
  let acumulado = 0;

  for (let i = 0; i < 64; i += 1) {
    const material = new THREE.SpriteMaterial({
      map: textura,
      color: "#d7dee8",
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.visible = false;
    sprite.renderOrder = 2;
    escena.add(sprite);
    libres.push({
      sprite,
      material,
      vel: new THREE.Vector3(),
      vida: 0,
      total: 1,
      escala0: 0.08,
      escala1: 0.2,
      opacidad: 0.4,
    });
  }

  function soltar(origen, opciones) {
    const particula = libres.pop();
    if (!particula) return;
    particula.vida = opciones.vida;
    particula.total = opciones.vida;
    particula.escala0 = opciones.escala0;
    particula.escala1 = opciones.escala1;
    particula.opacidad = opciones.opacidad;
    particula.vel.set(opciones.vx, opciones.vy, opciones.vz);
    particula.sprite.visible = true;
    particula.sprite.position.copy(origen);
    const dispersion = opciones.dispersion;
    particula.sprite.position.x += (Math.random() - 0.5) * dispersion;
    particula.sprite.position.y += (Math.random() - 0.5) * dispersion;
    particula.sprite.position.z += (Math.random() - 0.5) * dispersion;
    particula.material.opacity = opciones.opacidad;
    particula.sprite.scale.setScalar(opciones.escala0);
    vivos.push(particula);
  }

  function actualizar(enLaPunta, exhalar, origenPunta, dt) {
    if (enLaPunta) {
      acumulado += dt;
      while (acumulado > 0.07) {
        acumulado -= 0.07;
        soltar(origenPunta, {
          vx: (Math.random() - 0.5) * 0.14,
          vy: 0.28 + Math.random() * 0.22,
          vz: 0.05 + Math.random() * 0.1,
          vida: 0.9 + Math.random() * 0.6,
          escala0: 0.05,
          escala1: 0.22,
          opacidad: 0.46,
          dispersion: 0.04,
        });
      }
    } else {
      acumulado = 0;
    }

    if (exhalar) {
      for (let i = 0; i < 26; i += 1) {
        const angulo = Math.random() * Math.PI * 2;
        const radio = 0.15 + Math.random() * 0.85;
        soltar(origenExhala, {
          vx: Math.cos(angulo) * radio * 0.42,
          vy: 0.18 + Math.random() * 0.5,
          vz: 0.2 + Math.random() * 0.45,
          vida: 1.6 + Math.random() * 1.1,
          escala0: 0.16,
          escala1: 0.55 + Math.random() * 0.35,
          opacidad: 0.36,
          dispersion: 0.22,
        });
      }
    }

    for (let i = vivos.length - 1; i >= 0; i -= 1) {
      const particula = vivos[i];
      particula.vida -= dt;
      if (particula.vida <= 0) {
        particula.sprite.visible = false;
        particula.material.opacity = 0;
        vivos.splice(i, 1);
        libres.push(particula);
        continue;
      }
      particula.vel.y += dt * 0.16;
      if (particula.sprite.position.z > 4.55) particula.vel.z *= 0.35;
      particula.sprite.position.x += particula.vel.x * dt;
      particula.sprite.position.y += particula.vel.y * dt;
      particula.sprite.position.z += particula.vel.z * dt;
      const queda = particula.vida / particula.total;
      const avance = 1 - queda;
      particula.sprite.scale.setScalar(particula.escala0 + (particula.escala1 - particula.escala0) * avance);
      particula.material.opacity = particula.opacidad * queda * queda;
    }
  }

  return { actualizar };
}

function texturaHumo() {
  const lienzo = document.createElement("canvas");
  lienzo.width = 64;
  lienzo.height = 64;
  const contexto = lienzo.getContext("2d");
  const gradiente = contexto.createRadialGradient(32, 32, 2, 32, 32, 32);
  gradiente.addColorStop(0, "rgba(255,255,255,0.9)");
  gradiente.addColorStop(0.35, "rgba(255,255,255,0.35)");
  gradiente.addColorStop(1, "rgba(255,255,255,0)");
  contexto.fillStyle = gradiente;
  contexto.fillRect(0, 0, 64, 64);
  const textura = new THREE.CanvasTexture(lienzo);
  textura.colorSpace = THREE.SRGBColorSpace;
  return textura;
}

function texturaLlama() {
  const ancho = 128;
  const alto = 256;
  const lienzo = document.createElement("canvas");
  lienzo.width = ancho;
  lienzo.height = alto;
  const contexto = lienzo.getContext("2d");
  contexto.filter = "blur(8px)";
  contexto.fillStyle = "#ffffff";
  contexto.beginPath();
  contexto.moveTo(64, 22);
  contexto.bezierCurveTo(112, 100, 98, 188, 64, 236);
  contexto.bezierCurveTo(30, 188, 16, 100, 64, 22);
  contexto.fill();
  contexto.filter = "none";
  contexto.globalCompositeOperation = "source-in";
  const cuerpo = contexto.createLinearGradient(0, 236, 0, 16);
  cuerpo.addColorStop(0, "rgba(90,150,255,0.4)");
  cuerpo.addColorStop(0.1, "rgba(255,255,230,1)");
  cuerpo.addColorStop(0.32, "rgba(255,186,36,0.96)");
  cuerpo.addColorStop(0.68, "rgba(255,78,8,0.5)");
  cuerpo.addColorStop(1, "rgba(255,30,0,0)");
  contexto.fillStyle = cuerpo;
  contexto.fillRect(0, 0, ancho, alto);
  const textura = new THREE.CanvasTexture(lienzo);
  textura.colorSpace = THREE.SRGBColorSpace;
  return textura;
}

function crearCenicero(escena, renderer) {
  const perfil = [
    [0, 0.032],
    [0.08, 0.031],
    [0.16, 0.03],
    [0.24, 0.029],
    [0.3, 0.032],
    [0.34, 0.042],
    [0.362, 0.058],
    [0.378, 0.076],
    [0.394, 0.092],
    [0.422, 0.104],
    [0.45, 0.11],
    [0.468, 0.104],
    [0.478, 0.086],
    [0.47, 0.062],
    [0.448, 0.04],
    [0.4, 0.024],
    [0.28, 0.018],
    [0.12, 0.016],
    [0, 0.016],
  ].map(([x, y]) => new THREE.Vector2(x, y));

  const segmentos = 128;
  const geometria = new THREE.LatheGeometry(perfil, segmentos);
  const posicion = geometria.attributes.position;
  const colores = new Float32Array(posicion.count * 3);
  const centros = [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2];
  const ancho = 0.32;
  const enElFilo = new Set([8, 9, 10, 11, 12, 13]);

  for (let i = 0; i <= segmentos; i += 1) {
    const phi = (i / segmentos) * Math.PI * 2;
    let peso = 0;
    for (const centro of centros) {
      let distancia = Math.abs(phi - centro);
      if (distancia > Math.PI) distancia = Math.PI * 2 - distancia;
      if (distancia >= ancho) continue;
      const t = 1 - distancia / ancho;
      peso = Math.max(peso, t * t * (3 - 2 * t));
    }
    for (let j = 0; j < perfil.length; j += 1) {
      const indice = j + i * perfil.length;
      let rojo = 0.86;
      let verde = 0.9;
      let azul = 0.94;
      if (j <= 6) {
        rojo = 0.34;
        verde = 0.37;
        azul = 0.4;
      } else if (j >= 16) {
        rojo = 0.58;
        verde = 0.62;
        azul = 0.66;
      }
      if (enElFilo.has(j) && peso > 0) {
        const x = posicion.getX(indice);
        const y = posicion.getY(indice);
        const z = posicion.getZ(indice);
        const radio = Math.hypot(x, z) || 1;
        const cresta = j >= 9 && j <= 11;
        const canto = j >= 12 && j <= 13;
        const fuerza = cresta ? 1 : canto ? 0.82 : 0.55;
        const nuevoRadio = Math.max(0.33, radio - (canto ? 0.02 : 0.034) * peso * fuerza);
        posicion.setXYZ(indice, (x / radio) * nuevoRadio, y - 0.058 * peso * fuerza, (z / radio) * nuevoRadio);
        const sombra = 1 - peso * 0.5;
        rojo *= sombra;
        verde *= sombra;
        azul *= sombra;
      }
      colores[indice * 3] = rojo;
      colores[indice * 3 + 1] = verde;
      colores[indice * 3 + 2] = azul;
    }
  }
  geometria.setAttribute("color", new THREE.BufferAttribute(colores, 3));
  geometria.computeVertexNormals();

  const pmrem = new THREE.PMREMGenerator(renderer);
  const entorno = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const malla = new THREE.Mesh(
    geometria,
    new THREE.MeshPhysicalMaterial({
      color: "#ffffff",
      metalness: 0.86,
      roughness: 0.42,
      clearcoat: 0.12,
      clearcoatRoughness: 0.55,
      envMap: entorno,
      envMapIntensity: 0.48,
      vertexColors: true,
    }),
  );
  malla.castShadow = true;
  malla.receiveShadow = true;
  malla.position.set(CENICERO.x, ALTURA_MESA, CENICERO.z);
  escena.add(malla);
}

function crearCenizaSuelta(escena) {
  const tonos = ["#b3ada4", "#8e8880", "#6a6560", "#9c8f84"].map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0 }),
  );
  const formas = variantesCeniza();
  const libres = [];
  const vivos = [];
  for (let i = 0; i < 64; i += 1) {
    const malla = new THREE.Mesh(formas[i % formas.length], tonos[i % tonos.length]);
    malla.visible = false;
    malla.castShadow = true;
    escena.add(malla);
    libres.push({ malla, vel: new THREE.Vector3(), giro: new THREE.Vector3(), quieta: false });
  }

  function soltar(origen, largo) {
    const cantidad = Math.min(16, Math.max(5, Math.round(largo * 11)));
    for (let i = 0; i < cantidad; i += 1) {
      let trozo = libres.pop();
      if (!trozo) {
        const indice = vivos.findIndex((item) => item.quieta);
        if (indice < 0) return;
        trozo = vivos.splice(indice, 1)[0];
      }
      trozo.quieta = false;
      trozo.malla.visible = true;
      trozo.malla.position.set(
        origen.x + (Math.random() - 0.5) * 0.06,
        origen.y + Math.random() * 0.03,
        origen.z + (Math.random() - 0.5) * 0.06,
      );
      const tamano = 0.75 + Math.random() * 0.9;
      trozo.malla.scale.set(tamano, tamano * (0.75 + Math.random() * 0.5), tamano);
      trozo.malla.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      trozo.vel.set((Math.random() - 0.5) * 0.35, 0.15 + Math.random() * 0.55, (Math.random() - 0.5) * 0.35);
      trozo.giro.set((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 7, (Math.random() - 0.5) * 9);
      vivos.push(trozo);
    }
  }

  function actualizar(dt) {
    for (const trozo of vivos) {
      if (trozo.quieta) continue;
      trozo.vel.y -= 5.2 * dt;
      trozo.malla.position.addScaledVector(trozo.vel, dt);
      trozo.malla.rotation.x += trozo.giro.x * dt;
      trozo.malla.rotation.y += trozo.giro.y * dt;
      trozo.malla.rotation.z += trozo.giro.z * dt;
      const punto = trozo.malla.position;
      const dist = Math.hypot(punto.x - CENICERO.x, punto.z - CENICERO.z);
      const suelo = ALTURA_MESA + (dist < RADIO_CUENCO ? 0.045 : 0.02);
      if (punto.y <= suelo) {
        punto.y = suelo + 0.006;
        trozo.vel.set(0, 0, 0);
        trozo.giro.set(0, 0, 0);
        trozo.malla.rotation.x = Math.PI / 2 + (Math.random() - 0.5) * 0.45;
        trozo.malla.rotation.y = Math.random() * Math.PI * 2;
        trozo.malla.rotation.z = (Math.random() - 0.5) * 0.35;
        trozo.quieta = true;
      }
    }
  }

  return { soltar, actualizar };
}

function variantesCeniza() {
  const formas = [];
  for (let i = 0; i < 4; i += 1) formas.push(copoCurvo(0.045 + i * 0.006, 0.07 + i * 0.018, 1.15 + i * 0.35, i + 1));
  for (let i = 0; i < 3; i += 1) formas.push(copoPlano(0.028 + i * 0.012, i + 4));
  for (let i = 0; i < 3; i += 1) formas.push(copoAstilla(i + 8));
  return formas;
}

function copoCurvo(radio, largo, arco, semilla) {
  const geometria = new THREE.CylinderGeometry(radio * 0.9, radio, largo, 7, 3, true, semilla, arco);
  arrugar(geometria, semilla, 0.004);
  geometria.computeVertexNormals();
  return geometria;
}

function copoPlano(ancho, semilla) {
  const geometria = new THREE.CircleGeometry(ancho, 7);
  const posicion = geometria.attributes.position;
  for (let i = 0; i < posicion.count; i += 1) {
    const x = posicion.getX(i);
    const y = posicion.getY(i);
    const distancia = Math.hypot(x, y);
    if (distancia < 0.0001) continue;
    const mella = 0.62 + 0.4 * Math.abs(Math.sin(semilla * 1.7 + Math.atan2(y, x) * 3));
    posicion.setXY(i, x * mella, y * mella);
    posicion.setZ(i, Math.sin(semilla + x * 30) * 0.004);
  }
  geometria.computeVertexNormals();
  return geometria;
}

function copoAstilla(semilla) {
  const geometria = new THREE.BoxGeometry(0.05 + semilla * 0.004, 0.012, 0.022);
  const posicion = geometria.attributes.position;
  for (let i = 0; i < posicion.count; i += 1) {
    posicion.setX(i, posicion.getX(i) + Math.sin(semilla + i) * 0.006);
    posicion.setY(i, posicion.getY(i) + Math.cos(semilla * 1.3 + i) * 0.003);
    posicion.setZ(i, posicion.getZ(i) * (0.7 + (i % 3) * 0.15));
  }
  geometria.computeVertexNormals();
  return geometria;
}

function arrugar(geometria, semilla, amplitud) {
  const posicion = geometria.attributes.position;
  for (let i = 0; i < posicion.count; i += 1) {
    const x = posicion.getX(i);
    const y = posicion.getY(i);
    const z = posicion.getZ(i);
    const radio = Math.hypot(x, z);
    if (radio < 0.001) continue;
    const onda = Math.sin(semilla * 2 + Math.atan2(z, x) * 4 + y * 28) * amplitud;
    const factor = (radio + onda) / radio;
    posicion.setX(i, x * factor);
    posicion.setZ(i, z * factor);
  }
}

function crearMechero() {
  const grupo = new THREE.Group();
  const ancla = new THREE.Object3D();
  ancla.position.set(0, ALTO_MECHERO, 0);
  grupo.add(ancla);

  const llama = new THREE.Group();
  llama.position.copy(ancla.position);
  const textura = texturaLlama();
  const lenguas = [
    { color: "#ff5a12", ancho: 0.16, alto: 0.46, y: 0.2, opacidad: 0.55 },
    { color: "#ffb01a", ancho: 0.1, alto: 0.36, y: 0.16, opacidad: 0.8 },
    { color: "#fff4c2", ancho: 0.05, alto: 0.22, y: 0.12, opacidad: 0.95 },
    { color: "#7eb6ff", ancho: 0.045, alto: 0.09, y: 0.03, opacidad: 0.9 },
  ].map((dato) => {
    const material = new THREE.SpriteMaterial({
      map: textura,
      color: dato.color,
      transparent: true,
      opacity: dato.opacidad,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.position.y = dato.y;
    sprite.scale.set(dato.ancho, dato.alto, 1);
    llama.add(sprite);
    return { sprite, material, ...dato };
  });
  const luz = new THREE.PointLight("#ff8a2a", 0, 3.2, 2);
  luz.position.y = 0.16;
  llama.add(luz);
  llama.visible = false;
  grupo.add(llama);

  function animarLlama(tiempoActivo, encendida) {
    llama.visible = encendida;
    if (!encendida) {
      luz.intensity = 0;
      return;
    }
    lenguas.forEach((lengua, indice) => {
      const fase = tiempoActivo * (14 + indice * 2.4) + indice * 1.7;
      const respiracion = 0.86 + Math.sin(fase) * 0.16 + Math.sin(fase * 2.2) * 0.06;
      lengua.sprite.scale.set(lengua.ancho * (0.92 + Math.sin(fase * 1.6) * 0.1), lengua.alto * respiracion, 1);
      lengua.sprite.position.x = Math.sin(fase * 1.15) * 0.014;
      lengua.sprite.position.y = lengua.y + Math.max(0, Math.sin(fase) * 0.02);
      lengua.material.opacity = lengua.opacidad * (0.72 + Math.sin(fase * 1.9) * 0.28);
    });
    luz.intensity = 1.7 + Math.sin(tiempoActivo * 21) * 0.45 + Math.sin(tiempoActivo * 37) * 0.2;
  }

  const cargador = new FBXLoader();
  cargador.load(MODELO_MECHERO, (modelo) => {
    prepararModelo(modelo);
    grupo.add(modelo);
    grupo.updateMatrixWorld(true);
    const caja = new THREE.Box3().setFromObject(modelo);
    const cima = new THREE.Vector3((caja.min.x + caja.max.x) / 2, caja.max.y, (caja.min.z + caja.max.z) / 2);
    grupo.worldToLocal(cima);
    ancla.position.copy(cima);
    llama.position.copy(cima);
  });

  return { grupo, llama, ancla, luz, animarLlama };
}

function prepararModelo(modelo) {
  modelo.rotation.x = -Math.PI / 2;
  const caja = new THREE.Box3().setFromObject(modelo);
  const alto = Math.max(caja.max.y - caja.min.y, 0.001);
  const escala = ALTO_MECHERO / alto;
  modelo.scale.setScalar(escala);
  modelo.position.y = -caja.min.y * escala;
  modelo.traverse((objeto) => {
    if (!objeto.isMesh) return;
    objeto.castShadow = true;
    objeto.receiveShadow = true;
    const materiales = Array.isArray(objeto.material) ? objeto.material : [objeto.material];
    for (const material of materiales) {
      if (!material) continue;
      if (material.name === "Brass - Old") material.color?.set("#c6a15b");
      if ("shininess" in material) material.shininess = material.name?.includes("Glossy") || material.name?.includes("Chrome") ? 90 : 30;
    }
  });
}

function ruido(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function texturaPapel() {
  const lienzo = document.createElement("canvas");
  lienzo.width = 128;
  lienzo.height = 256;
  const contexto = lienzo.getContext("2d");
  contexto.fillStyle = "#f6f0e3";
  contexto.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 180; i += 1) {
    const x = ruido(i, 1) * 128;
    const y = ruido(i, 2) * 256;
    contexto.strokeStyle = "rgba(220,214,200,0.22)";
    contexto.beginPath();
    contexto.moveTo(x, y);
    contexto.lineTo(x + 8, y);
    contexto.stroke();
  }
  const costura = contexto.createLinearGradient(0, 0, 16, 0);
  costura.addColorStop(0, "rgba(214,206,190,0.45)");
  costura.addColorStop(1, "rgba(246,240,227,0)");
  contexto.fillStyle = costura;
  contexto.fillRect(0, 0, 22, 256);
  const textura = new THREE.CanvasTexture(lienzo);
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.wrapS = THREE.RepeatWrapping;
  textura.wrapT = THREE.RepeatWrapping;
  textura.anisotropy = 8;
  return textura;
}

function texturaCorcho() {
  const lienzo = document.createElement("canvas");
  lienzo.width = 128;
  lienzo.height = 256;
  const contexto = lienzo.getContext("2d");
  contexto.fillStyle = "#d48945";
  contexto.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 900; i += 1) {
    const x = ruido(i, 11) * 128;
    const y = ruido(i, 12) * 256;
    const ancho = 3 + ruido(i, 13) * 9;
    const alto = 2 + ruido(i, 14) * 6;
    const oscuro = ruido(i, 15) > 0.45;
    contexto.fillStyle = oscuro ? `rgba(92,48,22,${0.35 + ruido(i, 16) * 0.5})` : `rgba(236,186,120,${0.25 + ruido(i, 17) * 0.45})`;
    contexto.beginPath();
    contexto.ellipse(x, y, ancho, alto, ruido(i, 18) * Math.PI, 0, Math.PI * 2);
    contexto.fill();
  }
  const textura = new THREE.CanvasTexture(lienzo);
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.wrapS = THREE.RepeatWrapping;
  textura.wrapT = THREE.RepeatWrapping;
  textura.anisotropy = 8;
  return textura;
}

function texturaBrasa() {
  const lienzo = document.createElement("canvas");
  lienzo.width = 32;
  lienzo.height = 64;
  const contexto = lienzo.getContext("2d");
  const cuerpo = contexto.createLinearGradient(0, 64, 0, 0);
  cuerpo.addColorStop(0, "#ffe0b0");
  cuerpo.addColorStop(0.22, "#ff5a14");
  cuerpo.addColorStop(0.62, "#9a3010");
  cuerpo.addColorStop(1, "#5c463c");
  contexto.fillStyle = cuerpo;
  contexto.fillRect(0, 0, 32, 64);
  const textura = new THREE.CanvasTexture(lienzo);
  textura.colorSpace = THREE.SRGBColorSpace;
  return textura;
}

function geometriaCeniza() {
  const geometria = new THREE.CylinderGeometry(0.066, 0.07, 1, 28, 1);
  geometria.translate(0, 0.5, 0);
  return geometria;
}

function crearCigarro() {
  const grupo = new THREE.Group();
  const radioPapel = 0.072;
  const papel = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.86, metalness: 0, map: texturaPapel() });
  const corcho = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.78, metalness: 0, map: texturaCorcho() });
  const mapaBrasa = texturaBrasa();
  const materialBrasa = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    map: mapaBrasa,
    emissive: "#ff5a18",
    emissiveMap: mapaBrasa,
    emissiveIntensity: 0,
    roughness: 0.62,
  });
  const materialCarbon = new THREE.MeshStandardMaterial({
    color: "#9a3414",
    emissive: "#6e200c",
    emissiveIntensity: 0,
    roughness: 0.8,
  });
  const materialCasquete = new THREE.MeshStandardMaterial({ color: "#f3ead8", roughness: 0.9 });

  const papelGrupo = new THREE.Group();
  papelGrupo.position.x = ORIGEN_PAPEL;
  const cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(radioPapel, radioPapel, 1, 32, 1, true), papel);
  cuerpo.rotation.z = -Math.PI / 2;
  cuerpo.position.x = 0.5;
  cuerpo.castShadow = true;
  papelGrupo.add(cuerpo);
  papelGrupo.scale.x = LARGO_ENTERO;
  grupo.add(papelGrupo);

  const boquilla = new THREE.Mesh(new THREE.CylinderGeometry(radioPapel, radioPapel, 0.418, 32), corcho);
  boquilla.rotation.z = Math.PI / 2;
  boquilla.position.x = -0.727;
  boquilla.castShadow = true;
  grupo.add(boquilla);

  const extremo = ORIGEN_PAPEL + LARGO_ENTERO;
  const materialCeniza = new THREE.MeshStandardMaterial({
    color: "#b7b2aa",
    roughness: 0.95,
    metalness: 0,
  });
  const ceniza = new THREE.Mesh(geometriaCeniza(), materialCeniza);
  ceniza.rotation.z = -Math.PI / 2;
  ceniza.visible = false;
  ceniza.castShadow = true;
  grupo.add(ceniza);

  const brasa = new THREE.Mesh(new THREE.CylinderGeometry(0.073, 0.07, 0.032, 28), materialBrasa);
  brasa.rotation.z = -Math.PI / 2;
  brasa.position.x = extremo;
  brasa.visible = false;
  grupo.add(brasa);

  const carbon = new THREE.Mesh(new THREE.CylinderGeometry(0.069, 0.067, 0.024, 28), materialCarbon);
  carbon.rotation.z = -Math.PI / 2;
  carbon.position.x = extremo;
  carbon.visible = false;
  grupo.add(carbon);

  const casquete = new THREE.Mesh(new THREE.SphereGeometry(radioPapel, 24, 12), materialCasquete);
  casquete.scale.set(0.22, 0.92, 0.92);
  casquete.position.x = extremo - 0.01;
  casquete.castShadow = true;
  grupo.add(casquete);

  const ancla = new THREE.Object3D();
  ancla.position.set(extremo + 0.04, 0, 0);
  grupo.add(ancla);

  const luzPunta = new THREE.PointLight("#ff6a2a", 0, 1.3, 2);
  luzPunta.position.set(extremo, 0, 0);
  grupo.add(luzPunta);

  return {
    grupo,
    materialBrasa,
    materialCarbon,
    materialCasquete,
    ancla,
    luzPunta,
    papel: papelGrupo,
    brasa,
    carbon,
    casquete,
    ceniza,
  };
}

function crearLuces(escena) {
  escena.add(new THREE.AmbientLight("#9aafc8", 0.38));
  escena.add(new THREE.HemisphereLight("#e4eeff", "#3a2a22", 0.55));

  const sol = new THREE.DirectionalLight("#fff4e0", 2.4);
  sol.position.set(3.5, 7, 4);
  sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024);
  sol.shadow.camera.near = 0.5;
  sol.shadow.camera.far = 20;
  sol.shadow.camera.left = -6;
  sol.shadow.camera.right = 6;
  sol.shadow.camera.top = 6;
  sol.shadow.camera.bottom = -6;
  escena.add(sol);

  const contra = new THREE.DirectionalLight("#9eb6dd", 0.9);
  contra.position.set(-4, 3, -3);
  escena.add(contra);
}

function crearSuelo(escena) {
  const suelo = new THREE.Mesh(
    new THREE.CylinderGeometry(3.2, 3.4, 0.22, 72),
    new THREE.MeshStandardMaterial({ color: "#1a2838", roughness: 0.9, metalness: 0.04 }),
  );
  suelo.position.y = ALTURA_MESA - 0.11;
  suelo.receiveShadow = true;
  escena.add(suelo);

  const rejilla = new THREE.GridHelper(6, 12, "#355070", "#1c2c40");
  rejilla.position.y = ALTURA_MESA + 0.012;
  const materiales = Array.isArray(rejilla.material) ? rejilla.material : [rejilla.material];
  for (const material of materiales) {
    material.transparent = true;
    material.opacity = 0.4;
  }
  escena.add(rejilla);
}
