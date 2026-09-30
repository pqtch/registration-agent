import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MOTION, cycleMs, frameSequence, spriteKeyframes } from "./mascotMotion";

// Width/height straight from the PNG's IHDR chunk (bytes 16–23), no decoder.
function pngSize(path: string): { w: number; h: number } {
  const b = readFileSync(path);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

describe("frameSequence", () => {
  it("loops straight", () => {
    expect(frameSequence(4, "loop")).toEqual([0, 1, 2, 3]);
  });
  it("ping-pongs without doubling either end (1-2-3-4-3-2, as previewed)", () => {
    expect(frameSequence(4, "pingpong")).toEqual([0, 1, 2, 3, 2, 1]);
    expect(frameSequence(6, "pingpong")).toEqual([0, 1, 2, 3, 4, 5, 4, 3, 2, 1]);
  });
  it("never repeats a frame back-to-back, including across the cycle seam", () => {
    for (const m of Object.values(MOTION)) {
      const s = frameSequence(m.frames, m.playback);
      const wrapped = [...s, s[0]];
      for (let i = 1; i < wrapped.length; i++) expect(wrapped[i]).not.toBe(wrapped[i - 1]);
    }
  });
});

describe("MOTION table", () => {
  it("matches the frame count of every strip on disk", () => {
    for (const [state, m] of Object.entries(MOTION)) {
      const { w, h } = pngSize(resolve(__dirname, `../../tools/mascot/strips/${state}-strip.png`));
      expect(w / h, state).toBe(m.frames);
    }
  });
});

describe("spriteKeyframes", () => {
  it("holds each frame one slot and closes on the last frame", () => {
    const k = spriteKeyframes("idle", 130);
    expect(k).toHaveLength(frameSequence(6, "pingpong").length + 1);
    expect(k[0]).toMatchObject({ backgroundPositionX: "0px", offset: 0, easing: "step-end" });
    expect(k[5]).toMatchObject({ backgroundPositionX: "-650px" });
    expect(k[k.length - 1]).toMatchObject({ backgroundPositionX: "-130px", offset: 1 });
  });
  it("sizes a cycle from the table", () => {
    expect(cycleMs("wave")).toBe(14 * 140);
  });
});
