import { useTheme } from "./theme-context";
import type { Palette } from "./theme";

/** The active palette, honouring the user's light/dark/system preference. */
export function usePalette(): Palette {
  return useTheme().palette;
}
