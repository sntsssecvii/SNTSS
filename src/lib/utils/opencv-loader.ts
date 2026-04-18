/**
 * Carga OpenCV.js de forma lazy (singleton).
 * jscanify requiere window.cv disponible antes de usar sus métodos.
 * El archivo WASM pesa ~8MB y se carga una sola vez por sesión.
 */

const OPENCV_URL = "/opencv.js";
const LOAD_TIMEOUT_MS = 40_000;

let loadPromise: Promise<void> | null = null;

export function loadOpenCV(): Promise<void> {
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("OpenCV solo disponible en el browser"));
      return;
    }

    // Ya inicializado
    const cv = (window as any).cv;
    if (cv?.Mat) {
      resolve();
      return;
    }

    const timeout = setTimeout(() => {
      reject(new Error("OpenCV tardó demasiado en cargar"));
    }, LOAD_TIMEOUT_MS);

    const script = document.createElement("script");
    script.src = OPENCV_URL;
    script.async = true;

    script.onload = () => {
      // Polling hasta que WASM esté listo
      const check = setInterval(() => {
        if ((window as any).cv?.Mat) {
          clearInterval(check);
          clearTimeout(timeout);
          resolve();
        }
      }, 50);
    };

    script.onerror = () => {
      clearTimeout(timeout);
      loadPromise = null; // permite reintentar
      reject(new Error("No se pudo cargar OpenCV.js"));
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}
