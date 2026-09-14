import { describe, expect, it } from "vitest";
import {
  answer,
  buildChoices,
  createSession,
  currentCard,
  currentMode,
  isDone,
  pickDistractors,
  progress,
  qualityFor,
  type ReviewSession,
} from "./review-queue";

const ids = ["a", "b", "c"];

/** Answer the head card repeatedly with the given outcomes. */
function play(session: ReviewSession, outcomes: boolean[]): ReviewSession {
  return outcomes.reduce((s, passed) => answer(s, passed), session);
}

describe("createSession", () => {
  it("queues every card and masters none", () => {
    const s = createSession(ids);
    expect(s.order).toEqual(ids);
    expect(s.mastered).toEqual([]);
    expect(s.total).toBe(3);
    expect(isDone(s)).toBe(false);
  });

  it("is immediately done when empty", () => {
    expect(isDone(createSession([]))).toBe(true);
    expect(progress(createSession([])).fraction).toBe(1);
  });
});

describe("answer", () => {
  it("masters a passed card and drops it from the queue", () => {
    const s = answer(createSession(ids), true);
    expect(s.order).toEqual(["b", "c"]);
    expect(s.mastered).toEqual(["a"]);
  });

  it("sends a missed card to the back rather than dropping it", () => {
    const s = answer(createSession(ids), false);
    expect(s.order).toEqual(["b", "c", "a"]);
    expect(s.mastered).toEqual([]);
  });

  it("never ends the session while a card has been missed", () => {
    // Miss everything once, then pass everything.
    let s = play(createSession(ids), [false, false, false]);
    expect(isDone(s)).toBe(false);
    expect(s.order).toHaveLength(3);
    s = play(s, [true, true, true]);
    expect(isDone(s)).toBe(true);
    expect(s.mastered).toEqual(ids);
  });

  it("counts attempts and remembers a miss after a later pass", () => {
    const s = play(createSession(["a"]), [false, true]);
    expect(s.cards.a.attempts).toBe(2);
    expect(s.cards.a.missed).toBe(true);
  });

  it("is a no-op on a finished session", () => {
    const done = answer(createSession(["a"]), true);
    expect(answer(done, true)).toBe(done);
  });
});

describe("mode", () => {
  it("asks for recall first and recognition on the retry", () => {
    const s = createSession(["a"]);
    expect(currentMode(s)).toBe("recall");
    expect(currentMode(answer(s, false))).toBe("choice");
  });

  it("alternates so the same prompt is never repeated back to back", () => {
    let s = createSession(["a"]);
    const seen = [];
    for (let i = 0; i < 4; i++) {
      seen.push(currentMode(s));
      s = answer(s, false);
    }
    expect(seen).toEqual(["recall", "choice", "recall", "choice"]);
  });
});

describe("progress", () => {
  it("counts words mastered, not cards seen", () => {
    // Three misses mean three cards seen and nothing mastered.
    const s = play(createSession(ids), [false, false, false]);
    expect(progress(s)).toMatchObject({ mastered: 0, remaining: 3, fraction: 0 });
  });

  it("reaches 1 only when every word is mastered", () => {
    const s = play(createSession(ids), [true, true, true]);
    expect(progress(s).fraction).toBe(1);
  });
});

describe("qualityFor", () => {
  it("passes the reader's own grade through on a clean first pass", () => {
    const card = { id: "a", attempts: 1, missed: false };
    expect(qualityFor(card, 5)).toBe(5);
    expect(qualityFor(card, 3)).toBe(3);
  });

  it("reads a correct recognition answer as Good", () => {
    expect(qualityFor({ id: "a", attempts: 1, missed: false })).toBe(4);
  });

  it("lapses a card that was ever missed, however it was answered after", () => {
    const card = { id: "a", attempts: 2, missed: true };
    expect(qualityFor(card, 5)).toBeLessThan(3);
    expect(qualityFor(card)).toBeLessThan(3);
  });
});

describe("pickDistractors", () => {
  const pool = [
    { id: "a", gloss: "a book" },
    { id: "b", gloss: "a door" },
    { id: "c", gloss: "a house" },
    { id: "d", gloss: "patience" },
  ];

  it("never offers the correct answer as a distractor", () => {
    const out = pickDistractors(pool, pool[0], 3, () => 0);
    expect(out.map((x) => x.id)).not.toContain("a");
    expect(out).toHaveLength(3);
  });

  it("drops duplicate glosses so two options cannot read the same", () => {
    const dupes = [...pool, { id: "e", gloss: "A Door" }];
    const out = pickDistractors(dupes, pool[0], 4, () => 0);
    const glosses = out.map((x) => x.gloss.toLowerCase());
    expect(new Set(glosses).size).toBe(glosses.length);
  });

  it("returns what it can when the pool is too small", () => {
    expect(pickDistractors(pool.slice(0, 2), pool[0], 3, () => 0)).toHaveLength(1);
  });
});

describe("buildChoices", () => {
  it("always includes the correct answer", () => {
    const pool = [
      { id: "a", gloss: "a book" },
      { id: "b", gloss: "a door" },
      { id: "c", gloss: "a house" },
      { id: "d", gloss: "patience" },
    ];
    for (let seed = 0; seed < 5; seed++) {
      const out = buildChoices(pool, pool[2], 4, () => seed / 5);
      expect(out.map((x) => x.id)).toContain("c");
      expect(out).toHaveLength(4);
    }
  });
});
