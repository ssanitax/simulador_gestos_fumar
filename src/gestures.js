// Cada gesto conocido se traduce a números que la escena entiende.
// Para añadir uno: copia un bloque, cambia el id al nombre de MediaPipe
// y ajusta altura, escala, giro, color y emisión.

export const GESTOS = [
  {
    id: "Open_Palm",
    tecla: "1",
    codigos: ["Digit1", "Numpad1"],
    nombre: "Palma abierta",
    accion: "Sube",
    frase: "Gesto reconocido",
    altura: 2.35,
    escala: 1.08,
    giro: 0.8,
    color: "#e7fbff",
    emision: 1.45,
  },
  {
    id: "Closed_Fist",
    tecla: "2",
    codigos: ["Digit2", "Numpad2"],
    nombre: "Puño",
    accion: "Baja",
    frase: "Gesto reconocido",
    altura: 0.42,
    escala: 0.82,
    giro: 0.15,
    color: "#ff6b5a",
    emision: 0.75,
  },
  {
    id: "Pointing_Up",
    tecla: "3",
    codigos: ["Digit3", "Numpad3"],
    nombre: "Señalar arriba",
    accion: "Impulso",
    frase: "Gesto reconocido",
    altura: 1.25,
    escala: 1,
    giro: 1.1,
    color: "#ffe08a",
    emision: 1.15,
  },
  {
    id: "Thumb_Up",
    tecla: "4",
    codigos: ["Digit4", "Numpad4"],
    nombre: "Pulgar arriba",
    accion: "Crece",
    frase: "Gesto reconocido",
    altura: 1.15,
    escala: 1.75,
    giro: 0.4,
    color: "#ffd15c",
    emision: 0.95,
  },
  {
    id: "Thumb_Down",
    tecla: "5",
    codigos: ["Digit5", "Numpad5"],
    nombre: "Pulgar abajo",
    accion: "Encoge",
    frase: "Gesto reconocido",
    altura: 0.72,
    escala: 0.5,
    giro: 0.25,
    color: "#8ea0b8",
    emision: 0.28,
  },
  {
    id: "Victory",
    tecla: "6",
    codigos: ["Digit6", "Numpad6"],
    nombre: "Victoria",
    accion: "Gira",
    frase: "Gesto reconocido",
    altura: 1.4,
    escala: 1.05,
    giro: 7,
    color: "#d28bff",
    emision: 1.15,
  },
  {
    id: "ILoveYou",
    tecla: "7",
    codigos: ["Digit7", "Numpad7"],
    nombre: "Te quiero",
    accion: "Brilla",
    frase: "Gesto reconocido",
    altura: 1.55,
    escala: 1.18,
    giro: 1.3,
    color: "#ff7ab8",
    emision: 1.8,
  },
];

const REPOSO = {
  id: "",
  nombre: "Sin gesto",
  accion: "Espera",
  frase: "Esperando un gesto",
  altura: 0.95,
  escala: 1,
  giro: 0.45,
  color: "#8ee7ff",
  emision: 0.55,
};

const POR_ID = new Map(GESTOS.map((gesto) => [gesto.id, gesto]));
const POR_TECLA = new Map(GESTOS.flatMap((gesto) => gesto.codigos.map((codigo) => [codigo, gesto.id])));

export function interpretar(id) {
  return POR_ID.get(id) ?? REPOSO;
}

export function gestoPorTecla(codigo) {
  return POR_TECLA.get(codigo) ?? "";
}
