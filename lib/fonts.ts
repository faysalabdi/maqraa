import { Inter, Noto_Naskh_Arabic, Amiri } from "next/font/google";

export const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

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
