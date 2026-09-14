/**
 * In-session review queue. Pure functions only.
 *
 * The rule this exists to enforce: a word you got wrong comes back before the
 * session can end. Previously every answer — including "Again" — dropped the
 * card for good and only shortened its next interval, so a session could
 * finish containing words the reader never once recalled.
 *
 * A miss also changes HOW the word comes back. First sight asks for recall
 * (a flashcard); the retry asks for recognition (multiple choice), which is
 * the easier cue and a different retrieval path. Repeated misses alternate,
 * so a reader is never shown the identical prompt twice in a row.
 */

export type ReviewMode = "recall" | "choice";

export type SessionCard = {
  id: string;
  /** Presentations so far. 0 until the card has been answered once. */
  attempts: number;
  /** Whether the reader has ever missed this card in this session. */
  missed: boolean;
};

export type ReviewSession = {
  /** Ids still to master. The head is the current card. */
  order: string[];
  cards: Record<string, SessionCard>;
  /** Ids mastered this session, in the order they were mastered. */
  mastered: string[];
  total: number;
};

export function createSession(ids: string[]): ReviewSession {
  const cards: Record<string, SessionCard> = {};
  for (const id of ids) cards[id] = { id, attempts: 0, missed: false };
  return { order: [...ids], cards, mastered: [], total: ids.length };
}

export function isDone(session: ReviewSession): boolean {
  return session.order.length === 0;
}

export function currentCard(session: ReviewSession): SessionCard | null {
  const id = session.order[0];
  return id ? session.cards[id] : null;
}

/** How the card at the head of the queue should be asked right now. */
export function modeFor(card: SessionCard): ReviewMode {
  return card.attempts % 2 === 0 ? "recall" : "choice";
}

export function currentMode(session: ReviewSession): ReviewMode | null {
  const card = currentCard(session);
  return card ? modeFor(card) : null;
}

export type Progress = {
  mastered: number;
  total: number;
  remaining: number;
  /** 0..1, by words mastered — not by cards seen. */
  fraction: number;
};

export function progress(session: ReviewSession): Progress {
  const mastered = session.mastered.length;
  return {
    mastered,
    total: session.total,
    remaining: session.order.length,
    fraction: session.total === 0 ? 1 : mastered / session.total,
  };
}

/**
 * Answer the current card. A pass masters it and drops it from the queue; a
 * miss sends it to the back, so it returns later in the same session rather
 * than immediately (spacing the retry is the point of requeueing at all).
 */
export function answer(session: ReviewSession, passed: boolean): ReviewSession {
  const id = session.order[0];
  if (!id) return session;

  const prev = session.cards[id];
  const card: SessionCard = {
    id,
    attempts: prev.attempts + 1,
    missed: prev.missed || !passed,
  };
  const cards = { ...session.cards, [id]: card };

  return passed
    ? {
        ...session,
        cards,
        order: session.order.slice(1),
        mastered: [...session.mastered, id],
      }
    : { ...session, cards, order: [...session.order.slice(1), id] };
}

/**
 * The SM-2 quality to report for a card, sent once when it is finally mastered.
 *
 * Grading once per card per session keeps one review equal to one quality, the
 * way SM-2 assumes. A card that was missed at all grades as a lapse (below 3)
 * however confidently it was answered afterwards: the reader did forget it, and
 * the in-session relearning should not buy a longer interval than that.
 *
 * `selfGrade` is the reader's own Again/Hard/Good/Easy on a recall card. A
 * correct multiple-choice answer has no self-grade — recognition is weaker
 * evidence than recall, so it reads as Good rather than Easy.
 */
export function qualityFor(card: SessionCard, selfGrade?: number): number {
  if (card.missed) return 2;
  return selfGrade ?? 4;
}

/**
 * Wrong answers for a multiple-choice prompt, drawn from the reader's own
 * vocabulary. Words they are already learning make far better distractors than
 * anything generated, and it costs no model call.
 */
export function pickDistractors<T extends { id: string; gloss: string }>(
  pool: T[],
  correct: T,
  count: number,
  rng: () => number = Math.random,
): T[] {
  const seen = new Set([correct.gloss.trim().toLowerCase()]);
  const candidates: T[] = [];
  for (const item of pool) {
    if (item.id === correct.id) continue;
    const key = item.gloss.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    candidates.push(item);
  }

  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  return candidates.slice(0, count);
}

/** The options for a choice prompt, correct answer shuffled in. */
export function buildChoices<T extends { id: string; gloss: string }>(
  pool: T[],
  correct: T,
  optionCount = 4,
  rng: () => number = Math.random,
): T[] {
  const options = [correct, ...pickDistractors(pool, correct, optionCount - 1, rng)];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return options;
}
