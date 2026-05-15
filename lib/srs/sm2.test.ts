import { describe, it, expect } from "vitest";
import { initialState, rate } from "./sm2";

describe("sm2", () => {
  it("first Good moves to 1 day, second to 6 days", () => {
    const s0 = initialState();
    const r1 = rate(s0, 4);
    expect(r1.intervalDays).toBe(1);
    expect(r1.repetitions).toBe(1);

    const r2 = rate(r1, 4);
    expect(r2.intervalDays).toBe(6);
    expect(r2.repetitions).toBe(2);
  });

  it("Again resets reps and sets interval to 1 with reduced ease", () => {
    const s0 = initialState();
    const good1 = rate(s0, 4);
    const good2 = rate(good1, 4);
    const again = rate(good2, 1);
    expect(again.repetitions).toBe(0);
    expect(again.intervalDays).toBe(1);
    expect(again.ease).toBeLessThan(good2.ease);
    expect(again.lapsed).toBe(true);
  });

  it("ease never drops below 1.3", () => {
    let s = initialState();
    for (let i = 0; i < 30; i++) s = rate(s, 1);
    expect(s.ease).toBeGreaterThanOrEqual(1.3);
  });

  it("Easy grows faster than Good", () => {
    const s0 = initialState();
    const good = rate(rate(rate(s0, 4), 4), 4);
    const easy = rate(rate(rate(s0, 4), 4), 5);
    expect(easy.intervalDays).toBeGreaterThan(good.intervalDays);
  });
});
