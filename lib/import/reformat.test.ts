import { describe, it, expect } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import {
  chaptersFromToolInput,
  importModelFromEnv,
  reformatTextChunk,
  type ReformatOptions,
} from "./reformat";
import type { TextChunk } from "./chunk";

const goodInput = {
  chapters: [
    { title_ar: "الباب الأول", content_ar: "نص الكتاب", starts_mid_chapter: false },
    { title_ar: "تابع", content_ar: "تكملة", starts_mid_chapter: true },
  ],
};

const chunk: TextChunk = { index: 0, text: "…", fromPage: 1, toPage: 4 };

/** Minimal fake Anthropic client whose messages.create is scripted per call. */
function fakeClient(
  replies: Array<{ input?: unknown; stopReason?: string } | Error>,
): { client: Anthropic; calls: () => number } {
  let i = 0;
  const client = {
    messages: {
      create: async () => {
        const r = replies[Math.min(i, replies.length - 1)];
        i++;
        if (r instanceof Error) throw r;
        return {
          stop_reason: r.stopReason ?? "tool_use",
          content:
            r.input === undefined
              ? []
              : [{ type: "tool_use", name: "submit_chapters", input: r.input }],
        };
      },
    },
  } as unknown as Anthropic;
  return { client, calls: () => i };
}

function opts(client: Anthropic, extra: Partial<ReformatOptions> = {}): ReformatOptions {
  return { model: "test-model", client, maxAttempts: 3, delayMs: () => Promise.resolve(), ...extra };
}

describe("chaptersFromToolInput", () => {
  it("maps tool input to typed chapters", () => {
    const r = chaptersFromToolInput(goodInput);
    expect(r.chapters).toHaveLength(2);
    expect(r.chapters[0]).toEqual({
      titleAr: "الباب الأول",
      contentAr: "نص الكتاب",
      startsMidChapter: false,
    });
    expect(r.chapters[1].startsMidChapter).toBe(true);
  });

  it("rejects input without a chapters array", () => {
    expect(() => chaptersFromToolInput({ foo: 1 })).toThrow("no chapters array");
  });

  it("rejects chapters missing required strings", () => {
    expect(() => chaptersFromToolInput({ chapters: [{ title_ar: "x" }] })).toThrow(
      "missing title_ar/content_ar",
    );
  });
});

describe("reformatTextChunk", () => {
  it("returns chapters from a single successful call", async () => {
    const { client, calls } = fakeClient([{ input: goodInput }]);
    const r = await reformatTextChunk(chunk, opts(client));
    expect(r.chapters).toHaveLength(2);
    expect(calls()).toBe(1);
  });

  it("retries a retryable failure then succeeds", async () => {
    const rateLimited = Object.assign(new Error("rate limited"), { status: 429 });
    const { client, calls } = fakeClient([rateLimited, { input: goodInput }]);
    const logs: string[] = [];
    const r = await reformatTextChunk(chunk, opts(client, { onLog: (m) => logs.push(m) }));
    expect(r.chapters).toHaveLength(2);
    expect(calls()).toBe(2);
    expect(logs.join("\n")).toMatch(/retrying/);
  });

  it("does not retry a max_tokens truncation (fatal)", async () => {
    const { client, calls } = fakeClient([{ input: goodInput, stopReason: "max_tokens" }]);
    await expect(reformatTextChunk(chunk, opts(client))).rejects.toThrow("max_tokens");
    expect(calls()).toBe(1);
  });

  it("errors when the model returns no tool call", async () => {
    const { client } = fakeClient([{ input: undefined }, { input: undefined }, { input: undefined }]);
    await expect(reformatTextChunk(chunk, opts(client))).rejects.toThrow("no submit_chapters call");
  });
});

describe("importModelFromEnv", () => {
  it("prefers ANTHROPIC_IMPORT_MODEL, falls back to ANTHROPIC_TEST_MODEL", () => {
    const saved = { imp: process.env.ANTHROPIC_IMPORT_MODEL, test: process.env.ANTHROPIC_TEST_MODEL };
    try {
      process.env.ANTHROPIC_IMPORT_MODEL = "import-x";
      process.env.ANTHROPIC_TEST_MODEL = "test-y";
      expect(importModelFromEnv()).toBe("import-x");
      delete process.env.ANTHROPIC_IMPORT_MODEL;
      expect(importModelFromEnv()).toBe("test-y");
      delete process.env.ANTHROPIC_TEST_MODEL;
      expect(() => importModelFromEnv()).toThrow("is not set");
    } finally {
      if (saved.imp === undefined) delete process.env.ANTHROPIC_IMPORT_MODEL;
      else process.env.ANTHROPIC_IMPORT_MODEL = saved.imp;
      if (saved.test === undefined) delete process.env.ANTHROPIC_TEST_MODEL;
      else process.env.ANTHROPIC_TEST_MODEL = saved.test;
    }
  });
});
