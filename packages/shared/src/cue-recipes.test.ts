import { existsSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CUES, type CelebrationEvent } from "./celebration";
import { CUE_RECIPES } from "./cue-recipes";

const SOUNDS = resolve(dirname(fileURLToPath(import.meta.url)), "../../../mobile/assets/sounds");

const sounded = (Object.keys(CUES) as CelebrationEvent[]).filter((e) => CUES[e].sound !== null);

describe("cue recipes", () => {
  it("covers every cue that asks for a sound", () => {
    for (const event of sounded) {
      const sound = CUES[event].sound as CelebrationEvent;
      expect(CUE_RECIPES[sound], `no recipe for ${sound}`).toBeDefined();
      expect(CUE_RECIPES[sound].length).toBeGreaterThan(0);
    }
  });

  it("has a rendered file for each recipe", () => {
    // Mobile cannot synthesise, so a recipe without a file is a silent cue on
    // iOS. Re-run mobile/scripts/gen-cue-sounds.py when this fails.
    for (const event of Object.keys(CUE_RECIPES) as CelebrationEvent[]) {
      const file = resolve(SOUNDS, `${event}.wav`);
      expect(existsSync(file), `missing ${event}.wav — regenerate the cue sounds`).toBe(true);
      expect(statSync(file).size).toBeGreaterThan(1024);
    }
  });

  it("authors every partial with a positive duration", () => {
    for (const partials of Object.values(CUE_RECIPES)) {
      for (const p of partials) {
        expect(p.dur).toBeGreaterThan(0);
        expect(p.peak).toBeGreaterThan(0);
        expect(p.at).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
