import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { palette, type Palette } from "./theme";

type ThemePref = "light" | "dark" | "system";

type ThemeState = {
  scheme: "light" | "dark";
  pref: ThemePref;
  palette: Palette;
  setPref: (p: ThemePref) => void;
  toggle: () => void;
};

const KEY = "theme-pref";
const ThemeContext = createContext<ThemeState | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme() ?? "light";
  const [pref, setPrefState] = useState<ThemePref>("system");

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (v === "light" || v === "dark" || v === "system") setPrefState(v);
      })
      .catch(() => {});
  }, []);

  const setPref = (p: ThemePref) => {
    setPrefState(p);
    AsyncStorage.setItem(KEY, p).catch(() => {});
  };

  const scheme: "light" | "dark" = pref === "system" ? (system as "light" | "dark") : pref;
  const toggle = () => setPref(scheme === "dark" ? "light" : "dark");

  return (
    <ThemeContext.Provider
      value={{ scheme, pref, palette: palette[scheme], setPref, toggle }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme outside ThemeProvider");
  return ctx;
}
