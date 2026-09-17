/**
 * How a review session is portioned out.
 *
 * Shared because the two clients have to agree on it: a reader who does ten
 * words on the phone and opens the web app should not be offered a different
 * deal. Web had these numbers inline; mobile had none at all and dealt the
 * whole due list in one session.
 */

/** A session this small just starts; anything larger asks how many first. */
export const QUICK_START_MAX = 12;

/** Batch sizes worth offering — only those smaller than what is due. */
export function batchPresets(total: number): number[] {
  return [10, 20, 30].filter((n) => n < total);
}

/** Whether a finished batch leaves anything behind to continue with. */
export function hasMoreAfter(offset: number, dealt: number, total: number): boolean {
  return offset + dealt < total;
}
