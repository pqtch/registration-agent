// How Fordhawke's strips play (tools/mascot/PIPELINE.md). One table, one
// sequence builder, so a state's timing lives in one place instead of a CSS
// class per state with a hand-copied steps() count.
//
// Playback matters more than frame rate here. The strips were generated as
// poses, not closed cycles: for most of them the jump from the last frame back
// to the first is the biggest jump in the whole strip. The previews Patch
// approved on 07-13 played gestures ping-pong (1-2-3-4-3-2); the shipped CSS
// looped them straight, so every cycle ended in a snap. Ping-pong never
// crosses that seam. Locomotion (walk) is a real cycle and loops.
import type { MascotState } from "./components/Mascot";

export type Playback = "loop" | "pingpong";

export interface StateMotion {
  frames: number; // cells in the strip (checked against the PNGs in tests)
  msPerFrame: number; // PIPELINE.md's gate timings
  playback: Playback;
}

export const MOTION: Record<MascotState, StateMotion> = {
  idle: { frames: 6, msPerFrame: 180, playback: "pingpong" },
  walk: { frames: 8, msPerFrame: 120, playback: "loop" },
  "walk-left": { frames: 8, msPerFrame: 120, playback: "loop" },
  wave: { frames: 8, msPerFrame: 140, playback: "pingpong" },
  ponder: { frames: 6, msPerFrame: 200, playback: "pingpong" },
  whatif: { frames: 8, msPerFrame: 160, playback: "pingpong" },
  reading: { frames: 6, msPerFrame: 200, playback: "pingpong" },
};

// Loop: 0..n-1. Ping-pong: 0..n-1..1, so neither end frame is shown twice in
// a row (that would read as a hitch at every turn).
export function frameSequence(frames: number, playback: Playback): number[] {
  const forward = Array.from({ length: frames }, (_, i) => i);
  if (playback === "loop" || frames < 3) return forward;
  return [...forward, ...forward.slice(1, -1).reverse()];
}

export function cycleMs(state: MascotState): number {
  const m = MOTION[state];
  return frameSequence(m.frames, m.playback).length * m.msPerFrame;
}

// Web Animations keyframes: each frame holds (step-end) for exactly one
// msPerFrame slot. A closing keyframe repeats the last frame so it holds its
// full slot too, rather than flashing for zero time before the loop restarts.
export function spriteKeyframes(state: MascotState, cell: number): Keyframe[] {
  const m = MOTION[state];
  const seq = frameSequence(m.frames, m.playback);
  const at = (f: number) => `${-f * cell}px`;
  return [
    ...seq.map((f, i) => ({
      backgroundPositionX: at(f),
      offset: i / seq.length,
      easing: "step-end",
    })),
    { backgroundPositionX: at(seq[seq.length - 1]), offset: 1 },
  ];
}

// Pose changes dissolve instead of cutting: the incoming pose fades in over the
// outgoing one, which fades out a beat later, so the figure never goes
// see-through mid-change. Short enough to stay under the 300ms UI ceiling.
export const CROSSFADE_MS = 200;
