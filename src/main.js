// cámara -> vision.js lee cada mano
// controles.js decide llama, agarre y a qué objeto va cada mano
// scene.js dibuja el mechero y el cigarro

import { asignar, avanzar, crearEstado, describir, medirMano } from "./controles.js";
import { crearMundo } from "./scene.js";
import { leerFrame, prepararVision } from "./vision.js";

const video = document.querySelector("#camara");
const arranque = document.querySelector("#arranque");
const activar = document.querySelector("#activar");
const activarMini = document.querySelector("#activar-mini");
const probar = document.querySelector("#probar");
const errorEl = document.querySelector("#error");
const nombreEl = document.querySelector("#nombre-gesto");
const accionEl = document.querySelector("#accion");
const sensoresEl = document.querySelector("#sensores");
const ladosEl = document.querySelector("#lados");
const ladosIntroEl = document.querySelector("#lados-intro");

const mundo = crearMundo(document.querySelector("#vista"));

let camaraActiva = false;
let zurdo = false;
let estado = crearEstado();
let ultimoVideo = -1;
let reloj = 0;

probar.addEventListener("click", cerrarIntro);
activar.addEventListener("click", abrirCamara);
activarMini.addEventListener("click", abrirCamara);
// Los botones de diestro y zurdo no se muestran. La mano queda fija en zurdo.
// for (const boton of document.querySelectorAll("[data-mano]")) {
//   boton.addEventListener("click", () => aplicarMano(boton.dataset.mano === "zurdo"));
// }
// aplicarMano(leerMano(), true);
aplicarMano(true, true);

prepararVision()
  .then(() => {
    activar.disabled = false;
    activar.textContent = "Activar cámara";
    activarMini.disabled = false;
    activarMini.textContent = "Activar cámara";
  })
  .catch((error) => {
    console.error(error);
    mostrarError("No pude cargar los modelos de visión. Hace falta internet la primera vez.");
    activar.textContent = "Modelos no disponibles";
    activarMini.textContent = "Modelos no disponibles";
  });

requestAnimationFrame(cuadro);

function cuadro(ahora) {
  requestAnimationFrame(cuadro);
  const dt = reloj === 0 ? 0.016 : Math.min(0.05, (ahora - reloj) / 1000);
  reloj = ahora;

  let lectura = null;
  if (camaraActiva && video.currentTime !== ultimoVideo) {
    ultimoVideo = video.currentTime;
    lectura = leerFrame(video);
  }

  const manos = conMedicion(lectura?.manos);
  estado = avanzar(estado, manos, asignar(zurdo));
  const visual = mundo.actualizar({ cara: lectura?.cara ?? null, control: estado }, dt);
  mundo.dibujar();
  pintar(manos, visual);
}

function conMedicion(manos) {
  return {
    izquierda: medir(manos?.izquierda),
    derecha: medir(manos?.derecha),
  };
}

function medir(mano) {
  if (!mano) return null;
  return { ...mano, medicion: medirMano(mano.puntos) };
}

function pintar(manos, visual) {
  const texto = describir(estado, camaraActiva ? manos : null, visual);
  ponerTexto(nombreEl, texto.titulo);
  ponerTexto(accionEl, texto.accion);
  ponerTexto(sensoresEl, camaraActiva ? texto.sensores : "Cámara apagada.");
}

function aplicarMano(esZurdo, inmediato = false) {
  zurdo = esZurdo;
  mundo.fijarMano(zurdo, inmediato);
  const texto = zurdo
    ? "Mechero a la derecha. Cigarro a la izquierda."
    : "Mechero a la izquierda. Cigarro a la derecha.";
  ponerTexto(ladosEl, texto);
  ponerTexto(ladosIntroEl, texto);
  for (const boton of document.querySelectorAll("[data-mano]")) {
    const activo = (boton.dataset.mano === "zurdo") === zurdo;
    boton.classList.toggle("activo", activo);
    boton.setAttribute("aria-pressed", String(activo));
  }
  try {
    localStorage.setItem("mano-dominante", zurdo ? "zurdo" : "diestro");
  } catch {
    // Si el navegador bloquea el almacenamiento, la elección vale solo en esta visita.
  }
}

function leerMano() {
  try {
    return localStorage.getItem("mano-dominante") === "zurdo";
  } catch {
    return false;
  }
}

function ponerTexto(elemento, texto) {
  if (elemento.textContent !== texto) elemento.textContent = texto;
}

function cerrarIntro() {
  arranque.hidden = true;
  if (!camaraActiva) activarMini.hidden = false;
}

async function abrirCamara() {
  mostrarError("");
  activar.disabled = true;
  activarMini.disabled = true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
    camaraActiva = true;
    video.classList.add("visible");
    arranque.hidden = true;
    activarMini.hidden = true;
  } catch (error) {
    activar.disabled = false;
    activarMini.disabled = false;
    mostrarError(mensajeCamara(error));
  }
}

function mensajeCamara(error) {
  if (error?.name === "NotAllowedError") return "El navegador bloqueó la cámara. Permítela y vuelve a pulsar.";
  if (error?.name === "NotFoundError") return "No hay ninguna cámara disponible.";
  return "No se pudo abrir la cámara.";
}

function mostrarError(texto) {
  errorEl.hidden = !texto;
  errorEl.textContent = texto;
  if (texto) {
    arranque.hidden = false;
    activarMini.hidden = true;
  }
}
