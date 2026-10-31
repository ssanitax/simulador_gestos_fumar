import { FaceLandmarker, FilesetResolver, GestureRecognizer } from "@mediapipe/tasks-vision";

// La versión del wasm tiene que coincidir con la del package.json.
const VERSION = "0.10.20";
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`;
const MODELO_MANO =
  "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task";
const MODELO_CARA =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

const VACIO = { manos: { izquierda: null, derecha: null }, cara: null };

let lectorManos;
let lectorCara;
let ultimoTiempo = -1;

export async function prepararVision() {
  const vision = await FilesetResolver.forVisionTasks(WASM);
  // CPU a propósito: el espacio 3D ya usa la tarjeta gráfica.
  lectorManos = await GestureRecognizer.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODELO_MANO, delegate: "CPU" },
    runningMode: "VIDEO",
    numHands: 2,
  });
  lectorCara = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODELO_CARA, delegate: "CPU" },
    runningMode: "VIDEO",
    numFaces: 1,
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: false,
  });
}

export function leerFrame(video) {
  if (!lectorManos || !lectorCara || video.readyState < 2 || video.videoWidth === 0) return VACIO;

  const tiempo = siguienteTiempo();
  try {
    const manos = lectorManos.recognizeForVideo(video, tiempo);
    const caras = lectorCara.detectForVideo(video, tiempo);
    return { manos: manosDe(manos), cara: caraDe(caras) };
  } catch (error) {
    console.warn(error);
    return VACIO;
  }
}

function siguienteTiempo() {
  let tiempo = Math.round(performance.now());
  if (tiempo <= ultimoTiempo) tiempo = ultimoTiempo + 1;
  ultimoTiempo = tiempo;
  return tiempo;
}

function manosDe(resultado) {
  const salida = { izquierda: null, derecha: null };
  const marcas = resultado.landmarks ?? [];
  for (let i = 0; i < marcas.length; i += 1) {
    const categoria = resultado.handedness?.[i]?.[0];
    const nombre = categoria?.categoryName ?? "";
    // Left/Right son las manos de la persona si el vídeo no está espejado.
    const lado = nombre === "Left" ? "izquierda" : nombre === "Right" ? "derecha" : "";
    if (!lado || !marcas[i] || marcas[i].length < 21) continue;
    const mano = {
      lado,
      puntuacion: categoria?.score ?? 0,
      puntos: resultado.worldLandmarks?.[i]?.length >= 21 ? resultado.worldLandmarks[i] : marcas[i],
      muneca: marcas[i][0],
      palma: marcas[i][9],
      pellizco: puntoMedio(marcas[i][8], marcas[i][12]),
    };
    const previa = salida[lado];
    if (!previa || mano.puntuacion > previa.puntuacion) salida[lado] = mano;
  }
  return salida;
}

function puntoMedio(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
}

function caraDe(caras) {
  const puntos = caras.faceLandmarks?.[0];
  if (!puntos) return null;
  const nariz = puntos[1];
  const ojoA = puntos[33];
  const ojoB = puntos[263];
  const labioAlto = puntos[13];
  const labioBajo = puntos[14];
  return {
    x: nariz.x,
    y: nariz.y,
    boca: labioAlto && labioBajo
      ? { x: (labioAlto.x + labioBajo.x) / 2, y: (labioAlto.y + labioBajo.y) / 2 }
      : { x: nariz.x, y: nariz.y + 0.06 },
    cercania: Math.hypot(ojoA.x - ojoB.x, ojoA.y - ojoB.y),
  };
}
