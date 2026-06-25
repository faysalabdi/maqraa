import { Hanken_Grotesk, Spectral, Noto_Naskh_Arabic, Amiri } from "next/font/google";

/* UI sans — replaces Inter. Warm, legible, slightly geometric. */
export const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

/* Editorial serif — for landing headlines, screen titles (use `font-serif`). */
export const spectral = Spectral({
  subsets: ["latin"],
  variable: "--font-spectral",
  display: "swap",
  weight: ["400", "500", "600"],
});

/* Arabic body + display. */
export const naskh = Noto_Naskh_Arabic({
  subsets: ["arabic"],
  variable: "--font-naskh",
  display: "swap",
  weight: ["400", "500", "700"],
});

export const amiri = Amiri({
  subsets: ["arabic"],
  variable: "--font-amiri",
  display: "swap",
  weight: ["400", "700"],
});
