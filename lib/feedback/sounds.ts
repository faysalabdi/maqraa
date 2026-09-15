import { CUE_RECIPES, type CelebrationEvent } from "@maqraa/shared";

/**
 * The cue sounds, synthesised in the browser rather than loaded as files.
 *
 * Nothing to download, nothing to license, and no request on the critical
 * path — at these lengths (a handful of enveloped oscillators) a recording
 * would buy nothing a few sine and triangle partials do not already give.
 *
 * The recipes live in @maqraa/shared because mobile cannot synthesise: it
 * plays files rendered from the same table.
 */

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
  for (const partial of CUE_RECIPES[event]) {
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
