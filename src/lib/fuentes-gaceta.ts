import { Barlow, Barlow_Condensed, Newsreader } from "next/font/google";

/**
 * Tipografías de la identidad "Gaceta" (landing y pantalla de mantenimiento).
 * Se exponen como variables CSS: --font-display, --font-serif, --font-texto.
 */
const display = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
});

const serif = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-serif",
});

const sans = Barlow({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-texto",
});

/** Clases que declaran las tres variables de fuente en un contenedor. */
export const fuentesGaceta = `${display.variable} ${serif.variable} ${sans.variable}`;
