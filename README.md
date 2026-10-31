# Mechero y cigarro

Escena 3D que se maneja con la cámara del ordenador. La cara y las manos mueven un mechero y un cigarro: se encienden, se fuman y la ceniza se suelta en un cenicero.

La página publicada está en [ssanitax.github.io/simulador_gestos_fumar](https://ssanitax.github.io/simulador_gestos_fumar/).

## Cómo se usa

La mano izquierda mueve lo que está a la izquierda. La derecha, lo de la derecha. Si se marca **zurdo**, el mechero queda a la derecha y el cigarro a la izquierda. En **diestro**, al revés.

- **Mechero:** puño cerrado para cogerlo, un dedo levantado para la llama y la mano abierta para soltarlo.
- **Cigarro:** el gesto de victoria y, después, juntar esos dos dedos. Mientras está cogido, sigue la mano. Si los dedos se acercan a la boca, el cigarro se coloca ahí, se consume el doble de rápido y sale humo. Al apartarlos, se exhala.
- La punta se enciende al tocar la llama. El cigarro se va consumiendo durante dos minutos, hasta un poco antes del filtro, y entonces se apaga.
- La ceniza se queda en la punta. Cerca del cenicero, sacudir la mano arriba y abajo la suelta: cae dentro o fuera según dónde se sacuda.
- Juntar todos los dedos pone el cigarro mirando hacia abajo. Apoyarlo en la mesa o en el cenicero lo apaga y deja un rastro de ceniza.

Hace falta una cámara y dar permiso al navegador. La primera vez también hace falta internet, porque los modelos de las manos y de la cara se descargan al abrirla.

## Qué se ha usado

La aplicación es una página web, sin servidor. El navegador lee la cámara, reconoce los gestos y dibuja la escena.

| Pieza | Para qué |
| --- | --- |
| HTML y CSS | La página, la cámara y las instrucciones |
| JavaScript (módulos) | Une la cámara, los gestos y la escena |
| [Vite](https://vitejs.dev/) | Arranca el proyecto en local y prepara la versión que se publica |
| [Three.js](https://threejs.org/) | La escena 3D: cigarro, cenicero, humo, ceniza y luces |
| [MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe/solutions/vision/gesture_recognizer) | Reconoce las dos manos y la cara en el vídeo |
| `getUserMedia` | Pide la cámara al navegador |
| Modelo FBX | El mechero, un mechero BIC ya modelado |

MediaPipe se ejecuta en la CPU para no pelearse con la tarjeta gráfica, que la usa Three.js. El mechero se carga con el lector FBX de Three.js.

## Arrancar en local

```bash
npm install
npm run dev
```

Se abre en `http://localhost:5173/`. `npm run build` genera la carpeta `dist`, que es la que se publica en GitHub Pages.
