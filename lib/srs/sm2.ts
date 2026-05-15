/**
 * SM-2 spaced repetition. Pure functions only.
 * Quality scale: 0..5. UI maps Again=1, Hard=3, Good=4, Easy=5.
 */

export type SrsState = {
  ease: number;
  intervalDays: number;
  repetitions: number;
};

export type SrsReview = SrsState & {
  dueAt: Date;
  lapsed: boolean;
};

const MIN_EASE = 1.3;
const DEFAULT_EASE = 2.5;

export function initialState(): SrsState {
  return { ease: DEFAULT_EASE, intervalDays: 0, repetitions: 0 };
}

export function rate(state: SrsState, quality: number, now: Date = new Date()): SrsReview {
  const q = Math.max(0, Math.min(5, Math.round(quality)));

  let { ease, intervalDays, repetitions } = state;
  let lapsed = false;

  if (q < 3) {
    repetitions = 0;
    intervalDays = 1;
    ease = Math.max(MIN_EASE, ease - 0.2);
    lapsed = true;
  } else {
    repetitions += 1;
    if (repetitions === 1) intervalDays = 1;
    else if (repetitions === 2) intervalDays = 6;
    else intervalDays = Math.round(intervalDays * ease);

    if (q === 3) {
      intervalDays = Math.max(1, Math.round(intervalDays * 1.2));
      ease = Math.max(MIN_EASE, ease - 0.15);
    } else if (q === 5) {
      intervalDays = Math.round(intervalDays * ease * 1.3);
      ease = ease + 0.1;
    }
  }

  const dueAt = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);
  return { ease, intervalDays, repetitions, dueAt, lapsed };
}

export const SRS_GRADUATED_INTERVAL_DAYS = 21;
