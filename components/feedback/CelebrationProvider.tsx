"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { cueFor, MUTE_STORAGE_KEY, type CelebrationEvent } from "@maqraa/shared";
import { playCue } from "@/lib/feedback/sounds";
import { Confetti } from "./Confetti";

type CelebrationValue = {
  celebrate: (event: CelebrationEvent) => void;
  muted: boolean;
  setMuted: (muted: boolean) => void;
};

const CelebrationContext = createContext<CelebrationValue>({
  celebrate: () => {},
  muted: false,
  setMuted: () => {},
});

function readMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTE_STORAGE_KEY) === "1";
  } catch {
    // Private windows and blocked site data both throw here.
    return false;
  }
}

function reducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function CelebrationProvider({ children }: { children: ReactNode }) {
  // Starts unmuted on the server and on first paint, then corrects itself —
  // reading storage during render would not match the server-rendered HTML.
  const [muted, setMutedState] = useState(false);
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    setMutedState(readMuted());
  }, []);

  const setMuted = useCallback((next: boolean) => {
    setMutedState(next);
    try {
      window.localStorage.setItem(MUTE_STORAGE_KEY, next ? "1" : "0");
    } catch {
      // Preference just does not persist; the toggle still works this session.
    }
  }, []);

  const celebrate = useCallback(
    (event: CelebrationEvent) => {
      const cue = cueFor(event);
      if (!muted && cue.sound) playCue(cue.sound);
      // Motion is dropped for readers who asked for less of it; the sound is
      // not — it carries the same information without the movement.
      if (cue.confetti && !reducedMotion()) setBurst((n) => n + 1);
    },
    [muted],
  );

  return (
    <CelebrationContext.Provider value={{ celebrate, muted, setMuted }}>
      {children}
      {burst > 0 && <Confetti key={burst} />}
    </CelebrationContext.Provider>
  );
}

export function useCelebration(): CelebrationValue {
  return useContext(CelebrationContext);
}
