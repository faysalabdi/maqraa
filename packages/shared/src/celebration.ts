/**
 * The moments that earn a cue, and what each one fires. Pure data, shared so
 * web and mobile react to the same event in the same way rather than each
 * growing its own bespoke celebration.
 *
 * Constraints baked into the table below:
 *  - Only `session-complete` may run long. Everything else has to be short
 *    enough to fire back to back without cues stacking on each other.
 *  - A wrong answer never gets a harsh buzzer. It marks the requeue; it does
 *    not punish.
 *  - Nothing here fires on load. Every cue is the consequence of an action.
 */

export type CelebrationEvent =
  | "answer-correct"
  | "answer-missed"
  | "word-graduated"
  | "session-complete"
  | "streak-extended"
  | "achievement-unlocked";

export type HapticStrength = "light" | "medium" | "success" | "warning";

export type CueSpec = {
  sound: CelebrationEvent | null;
  haptic: HapticStrength | null;
  confetti: boolean;
  /** Rough budget in ms, so a cue cannot be authored longer than its slot. */
  maxMs: number;
};

export const CUES: Record<CelebrationEvent, CueSpec> = {
  "answer-correct": { sound: "answer-correct", haptic: "light", confetti: false, maxMs: 200 },
  "answer-missed": { sound: "answer-missed", haptic: "warning", confetti: false, maxMs: 250 },
  "word-graduated": { sound: "word-graduated", haptic: "success", confetti: false, maxMs: 400 },
  "session-complete": { sound: "session-complete", haptic: "success", confetti: true, maxMs: 1200 },
  "streak-extended": { sound: "streak-extended", haptic: "medium", confetti: false, maxMs: 400 },
  "achievement-unlocked": {
    sound: "achievement-unlocked",
    haptic: "success",
    confetti: true,
    maxMs: 1000,
  },
};

export function cueFor(event: CelebrationEvent): CueSpec {
  return CUES[event];
}

/** Key for the per-device mute preference. Same string on both clients. */
export const MUTE_STORAGE_KEY = "maqraa.feedback.muted";
