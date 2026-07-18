/** Design tokens mirrored from the web app's globals.css (light + dark). */
export const palette = {
  light: {
    bg: "#faf8f3",
    bgMuted: "#f1ece2",
    surface: "#ffffff",
    fg: "#1f2630",
    fgMuted: "#5d6672",
    border: "#e9e3d6",
    brand: "#0f9663",
    brandDark: "#0c7a51",
    brandFg: "#ffffff",
    accent: "#e3a72f",
    accentSoft: "#f6e7c4",
    accentFg: "#5a3f12",
    iris: "#5b6cf0",
    irisFg: "#ffffff",
    locked: "#b6b1a6",
    danger: "#e0533d",
    flame: "#f0762e",
    readPage: "#ffffff",
  },
  dark: {
    bg: "#0e1311",
    bgMuted: "#1d2620",
    surface: "#161d19",
    fg: "#f1efe6",
    fgMuted: "#9aa69c",
    border: "#283330",
    brand: "#27b07b",
    brandDark: "#1d9568",
    brandFg: "#04130c",
    accent: "#e8b94f",
    accentSoft: "#2a2417",
    accentFg: "#f1d488",
    iris: "#7c87f5",
    irisFg: "#0a0a18",
    locked: "#5a6760",
    danger: "#ef6a55",
    flame: "#f6894a",
    readPage: "#11100e",
  },
} as const;

export type Palette = Record<keyof (typeof palette)["light"], string>;

/** The web's shadow-card, translated to iOS shadow props. */
export const cardShadow = {
  shadowColor: "#14181e",
  shadowOpacity: 0.12,
  shadowRadius: 17,
  shadowOffset: { width: 0, height: 8 },
  elevation: 4,
} as const;

export const softShadow = {
  shadowColor: "#14181e",
  shadowOpacity: 0.08,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
} as const;
