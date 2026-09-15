import type { CelebrationEvent } from "@maqraa/shared";

/**
 * The cue sounds, synthesised in the browser rather than loaded as files.
 *
 * Nothing to download, nothing to license, and no request on the critical
 * path — at these lengths (a handful of enveloped oscillators) a recording
 * would buy nothing a few sine and triangle partials do not already give.
 */

type Partial = {
  freq: number;
  /** Offset from the start of the cue, in seconds. */
  at: number;
  dur: number;
  type: OscillatorType;
  peak: number;
  /** Glide to this frequency across the partial's life. */
  sweepTo?: number;
};

const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const B5 = 987.77;
const C6 = 1046.5;

const RECIPES: Record<CelebrationEvent, Partial[]> = {
  // Two rising notes. Short enough to fire on consecutive answers.
  "answer-correct": [
    { freq: E5, at: 0, dur: 0.11, type: "triangle", peak: 0.15 },
    { freq: B5, at: 0.065, dur: 0.16, type: "triangle", peak: 0.13 },
  ],
  // A definite "no": pitched down rather than sitting on one note, with a
  // triangle on top for enough harmonic content to cut through. Still not a
  // buzzer — it marks the requeue, it does not scold.
  "answer-missed": [
    { freq: 300, at: 0, dur: 0.22, type: "triangle", peak: 0.3, sweepTo: 130 },
    { freq: 150, at: 0, dur: 0.24, type: "sine", peak: 0.26, sweepTo: 80 },
  ],
  "word-graduated": [
    { freq: C5, at: 0, dur: 0.24, type: "triangle", peak: 0.13 },
    { freq: E5, at: 0.06, dur: 0.24, type: "triangle", peak: 0.13 },
    { freq: G5, at: 0.12, dur: 0.26, type: "triangle", peak: 0.13 },
  ],
  "session-complete": [
    { freq: C5, at: 0, dur: 0.6, type: "triangle", peak: 0.13 },
    { freq: E5, at: 0.08, dur: 0.6, type: "triangle", peak: 0.13 },
    { freq: G5, at: 0.16, dur: 0.6, type: "triangle", peak: 0.13 },
    { freq: C6, at: 0.24, dur: 0.6, type: "triangle", peak: 0.13 },
  ],
  "streak-extended": [
    { freq: 740, at: 0, dur: 0.32, type: "sine", peak: 0.14, sweepTo: 1760 },
    { freq: 370, at: 0, dur: 0.3, type: "triangle", peak: 0.07, sweepTo: 880 },
  ],
  "achievement-unlocked": [
    { freq: 880, at: 0, dur: 0.9, type: "sine", peak: 0.13 },
    { freq: 1320, at: 0.01, dur: 0.85, type: "sine", peak: 0.07 },
  ],
};

let ctx: AudioContext | null = null;

/**
 * One shared context, created on the first cue. Cues only ever follow a user
 * action, so by the time this runs the gesture requirement is already met.
 */
function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

export function playCue(event: CelebrationEvent): void {
  const context = audioContext();
  if (!context) return;
  // Safari suspends the context when the tab loses focus.
  if (context.state === "suspended") void context.resume();

  const now = context.currentTime;
  for (const partial of RECIPES[event]) {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = partial.type;
    const start = now + partial.at;
    osc.frequency.setValueAtTime(partial.freq, start);
    if (partial.sweepTo) {
      osc.frequency.exponentialRampToValueAtTime(partial.sweepTo, start + partial.dur);
    }
    // Exponential ramps cannot touch zero, hence the tiny floor either side.
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(partial.peak, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + partial.dur);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(start);
    osc.stop(start + partial.dur + 0.05);
  }
}
