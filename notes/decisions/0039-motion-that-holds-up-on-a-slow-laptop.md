# 0039 — Motion that holds up on a slow laptop: ping-pong sprites, dissolving poses, memoized prose

- **Status**: Accepted
- **Date**: 2026-09-30
- **Related**: amends the sprite wiring from `d68f23e` (CSS `steps()`) and `tools/mascot/PIPELINE.md`; keeps 0031/0032's curves and 0038's floor

## Context

Patch, 2026-09-30: "make the animations a lot smoother, including the ram sprite." Measured
first, on the dev harness at 400px.

- **The ram.** The strips were generated as poses, not closed cycles. For five of the seven,
  the jump from the last frame back to the first is the largest jump in the strip (alpha-changed
  pixels per step, e.g. whatif 777 at the seam against 178–615 inside it). The previews Patch
  approved on 07-13 played gestures **ping-pong** (1-2-3-4-3-2); the shipped CSS looped them
  straight, so every cycle ended in a snap. A pose change swapped the class and cut to frame 0
  of the new strip.
- **The stream.** Under 6× CPU throttling (a student's older laptop), a streamed answer ran at
  ~37fps with 52 frames over 50ms (worst 117ms). A trace put the largest share of main-thread
  time in markdown parsing: every message in the log re-parsed on every paced-drain frame, not
  just the one being written.

## Decision

1. Sprites play through the Web Animations API from one table (`src/sidebar/mascotMotion.ts`):
   ping-pong for gestures (idle, wave, ponder, whatif, reading), loop for locomotion (walk).
   Timings stay the PIPELINE gate values. A test checks each table row against its PNG's width.
2. A pose change dissolves: the new pose fades in over the old (140ms), the old fades out 60ms
   later, and the old layer is removed at 200ms. Reduced motion swaps with no dissolve and
   stays on idle's first frame.
3. `Message` is memoized, so only the streaming message re-renders during a stream.
4. `transition-all` is gone; each transition names its properties. The header's and composer's
   `backdrop-blur` is gone because nothing ever scrolls beneath either one. The toast settles
   without overshoot, and messages restored on panel open don't animate in.

Result under the same 6× throttle: ~54fps, 0 frames over 50ms, worst 50ms.

## Alternatives considered

### Alternative A: generate more frames
More art is the other route to smoother motion (PIPELINE.md, ~$0.07 per generation plus
Patch's visual gate). It isn't ruled out. It was not the cause: the frames are consistent
(bounding boxes stable to a pixel), and the snap was the playback.

### Alternative B: keep CSS `steps()` and add `alternate`
`steps()` with `animation-direction: alternate` shows both end frames twice at each turn (a
visible hitch), and it needs a hand-copied step count per state class. The table plus WAAPI
generates the exact 1-2-3-4-3-2 sequence.

### Alternative C: crossfade by dimming both poses
Fading the old pose out while the new one fades in leaves the figure translucent at the
midpoint (~75% combined opacity). Overlapping the fades avoids that.

## Consequences

- Sprite timing now lives in TypeScript, not CSS. A new state needs a strip, a `MOTION` row
  and a `SPRITES` import; the test fails if the row's frame count disagrees with the PNG.
- Headless and throttled frame numbers come from the dev build. Production React is faster,
  so these numbers are a floor, not the ceiling.

## Revisit if...

- New frames are generated (then some states may loop cleanly and can switch to `loop`).
- A throttled trace shows the streaming message's own markdown parse dominating long answers.
