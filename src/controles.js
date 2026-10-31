// Ángulo en el nudillo: recto ≈ 3.14, cerrado ≈ 1.3.
const PUNO = 2.2;
const DEDO_RECTO = 2.45;
const OTROS_ABAJO = 2.25;
const VICTORIA = 2.5;
const VICTORIA_ABIERTA = 0.5;
const VICTORIA_CERRADA = 0.32;
const DEDOS_JUNTOS = 0.9;

const ALCANCE_X = 6.4;
const ALCANCE_Y = 3.55;

export function crearEstado() {
  return {
    llama: false,
    cogidoMechero: false,
    esperaMechero: 0,
    armado: false,
    cogido: false,
    esperaCigarro: 0,
    ultimoMechero: null,
    ultimoCigarro: null,
    suaveLuz: null,
    suaveFumar: null,
  };
}

export function asignar(zurdo) {
  return zurdo
    ? { mechero: "derecha", cigarro: "izquierda" }
    : { mechero: "izquierda", cigarro: "derecha" };
}

export function medirMano(puntos) {
  if (!puntos || puntos.length < 21) return null;
  const escala = distancia(puntos[0], puntos[9]) || 1;
  return {
    indice: anguloDedo(puntos, 5),
    medio: anguloDedo(puntos, 9),
    anular: anguloDedo(puntos, 13),
    menique: anguloDedo(puntos, 17),
    apertura: distancia(puntos[8], puntos[12]) / escala,
    juntos: dispersionPuntas(puntos) / escala,
  };
}

export function aMundo(punto) {
  return {
    x: acotar((0.5 - punto.x) * ALCANCE_X, -2.7, 2.7),
    y: acotar((0.78 - punto.y) * ALCANCE_Y, -0.45, 2.65),
    z: 0.12,
  };
}

export function avanzar(estado, manos, asignacion) {
  const luz = manos?.[asignacion.mechero] ?? null;
  const fumado = manos?.[asignacion.cigarro] ?? null;
  const suaveLuz = suavizar(estado.suaveLuz, luz?.medicion ?? null);
  const suaveFumar = suavizar(estado.suaveFumar, fumado?.medicion ?? null);
  const mechero = pasoMechero(estado, suaveLuz);
  const cigarro = pasoCigarro(estado, suaveFumar);
  const destinoMechero = mechero.cogidoMechero
    ? (luz ? aMundo(luz.palma) : estado.ultimoMechero)
    : null;
  const destinoCigarro = cigarro.cogido
    ? (fumado ? aMundo(fumado.pellizco) : estado.ultimoCigarro)
    : null;

  return {
    llama: mechero.llama,
    cogidoMechero: mechero.cogidoMechero,
    esperaMechero: mechero.esperaMechero,
    armado: cigarro.armado,
    cogido: cigarro.cogido,
    esperaCigarro: cigarro.esperaCigarro,
    ultimoMechero: destinoMechero ?? estado.ultimoMechero,
    ultimoCigarro: destinoCigarro ?? estado.ultimoCigarro,
    suaveLuz,
    suaveFumar,
    destinoMechero,
    destinoCigarro,
    pellizcoCigarro: fumado?.pellizco ?? null,
    puntaAbajo: cigarro.puntaAbajo,
  };
}

function suavizar(previo, medicion) {
  if (!medicion) return null;
  if (!previo) return medicion;
  return {
    indice: mezclar(previo.indice, medicion.indice),
    medio: mezclar(previo.medio, medicion.medio),
    anular: mezclar(previo.anular, medicion.anular),
    menique: mezclar(previo.menique, medicion.menique),
    apertura: mezclar(previo.apertura, medicion.apertura),
    juntos: mezclar(previo.juntos ?? medicion.juntos, medicion.juntos),
  };
}

function mezclar(actual, objetivo) {
  return actual + (objetivo - actual) * 0.72;
}

export function describir(estado, manos, visual) {
  const izquierda = manos?.izquierda ? "sí" : "no";
  const derecha = manos?.derecha ? "sí" : "no";
  const encendido = Boolean(visual?.encendido);
  let cigarro = "Cigarro en su sitio";
  if (visual?.consumido) cigarro = "El cigarro se ha apagado";
  else if (visual?.apoyado) cigarro = "Cigarro apoyado y apagado";
  else if (encendido && visual?.enBoca) cigarro = "Cigarro en la boca";
  else if (encendido) cigarro = "La punta está encendida";
  else if (estado.cogido) cigarro = "Cigarro siguiendo la mano";
  const titulo = estado.cogidoMechero
    ? (estado.llama ? "Mechero en la mano, con llama" : "Mechero en la mano")
    : "Mechero en su sitio";
  return {
    titulo,
    accion: cigarro,
    sensores: `Izquierda: ${izquierda} · Derecha: ${derecha}`,
  };
}

function pasoMechero(estado, medicion) {
  if (!medicion) {
    const espera = estado.esperaMechero + 1;
    if (estado.cogidoMechero && espera < 12) {
      return { cogidoMechero: true, llama: estado.llama, esperaMechero: espera };
    }
    return { cogidoMechero: false, llama: false, esperaMechero: espera };
  }

  let cogidoMechero = estado.cogidoMechero;
  let llama = estado.llama;
  if (esPuno(medicion)) {
    cogidoMechero = true;
    llama = false;
  } else if (esUnDedo(medicion)) {
    cogidoMechero = true;
    llama = true;
  } else if (esPalma(medicion)) {
    cogidoMechero = false;
    llama = false;
  }
  return { cogidoMechero, llama, esperaMechero: 0 };
}

function esPuno(medicion) {
  return medicion.indice < PUNO
    && medicion.medio < PUNO
    && medicion.anular < PUNO
    && medicion.menique < PUNO;
}

function esUnDedo(medicion) {
  return medicion.indice > DEDO_RECTO
    && medicion.medio < OTROS_ABAJO
    && medicion.anular < OTROS_ABAJO
    && medicion.menique < OTROS_ABAJO;
}

function esPalma(medicion) {
  return [medicion.indice, medicion.medio, medicion.anular, medicion.menique]
    .filter((anguloDedoActual) => anguloDedoActual > DEDO_RECTO).length >= 3;
}

function pasoCigarro(estado, medicion) {
  if (!medicion) {
    const espera = estado.esperaCigarro + 1;
    if (estado.cogido && espera < 12) {
      return { armado: estado.armado, cogido: true, esperaCigarro: espera, puntaAbajo: false };
    }
    return { armado: false, cogido: false, esperaCigarro: espera, puntaAbajo: false };
  }

  const victoria = medicion.indice > VICTORIA
    && medicion.medio > VICTORIA
    && medicion.anular < OTROS_ABAJO
    && medicion.menique < OTROS_ABAJO
    && medicion.apertura > VICTORIA_ABIERTA;
  const cerrado = medicion.apertura < VICTORIA_CERRADA;

  let armado = estado.armado;
  let cogido = estado.cogido;
  if (!cogido && victoria) armado = true;
  if (!cogido && armado && cerrado) {
    cogido = true;
    armado = false;
  }
  const puntaAbajo = cogido && medicion.juntos < DEDOS_JUNTOS;
  if (cogido && !puntaAbajo && (victoria || esPalma(medicion))) {
    cogido = false;
    armado = false;
  }

  return { armado, cogido, esperaCigarro: 0, puntaAbajo };
}

function dispersionPuntas(puntos) {
  const ids = [4, 8, 12, 16, 20];
  let maximo = 0;
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      maximo = Math.max(maximo, distancia(puntos[ids[i]], puntos[ids[j]]));
    }
  }
  return maximo;
}

function anguloDedo(puntos, mcp) {
  return angulo(puntos[mcp], puntos[mcp + 1], puntos[mcp + 2]);
}

function angulo(a, b, c) {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const abz = a.z - b.z;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const cbz = c.z - b.z;
  const producto = abx * cbx + aby * cby + abz * cbz;
  const magnitud = Math.hypot(abx, aby, abz) * Math.hypot(cbx, cby, cbz);
  if (magnitud === 0) return Math.PI;
  return Math.acos(acotar(producto / magnitud, -1, 1));
}

function distancia(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function acotar(valor, minimo, maximo) {
  return Math.max(minimo, Math.min(maximo, valor));
}
