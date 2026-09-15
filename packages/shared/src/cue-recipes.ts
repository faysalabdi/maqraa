import type { CelebrationEvent } from "./celebration";
import raw from "./cue-recipes.json";

/**
 * How each cue is built, as data rather than code, because the two clients
 * consume it differently: the web synthesises it live through Web Audio, while
 * mobile has no oscillator and plays files rendered from this same table by
 * `mobile/scripts/gen-cue-sounds.py`. Editing a recipe means re-running that
 * script, or the two platforms drift apart.
 */
export type CuePartial = {
  freq: number;
  /** Offset from the start of the cue, in seconds. */
  at: number;
  dur: number;
  type: "sine" | "triangle";
  peak: number;
  /** Glide to this frequency across the partial's life. */
  sweepTo?: number;
};

export const CUE_RECIPES = raw as Record<CelebrationEvent, CuePartial[]>;
