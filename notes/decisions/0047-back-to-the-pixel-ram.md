# 0047 — Back to the pixel ram

- **Status**: Accepted
- **Date**: 2026-09-30
- **Related**: supersedes 0044 (the vector rig); keeps 0039's playback and the bubble anchoring from 0044

## Context

Patch saw the hand-drawn vector Fordhawke and said: "that ram sprite that you made isn't great ...
otherwise we need to go back to the pixel art one." The rig's motion was smooth, but the drawing was
the weak part. SVG paths authored by hand can't match the pixel master he approved in July, which
came out of an image model and a curated pipeline.

Measuring the strips showed why the pixel ram had looked muddy. In each 130px frame the figure is
only about 75px tall, so a detailed master was being read at 75px.

## Decision

- **The shipped mascot is the pixel strips again**, with 0039's playback: ping-pong gestures and
  dissolving poses. The unused walk poses stay out.
- **The size setting stays but snaps to whole-pixel scales**, the only ones pixel art survives:
  Off, Normal (1x, the strips' 130px) and Large (2x, 260px). At 2x each art pixel is a 2×2 block:
  crisp, and much easier to read.
- **The bubble stays anchored to his head.** It is placed at the cell's centre and 62% up the cell,
  where the idle cap sits, so the trail lands on him at both sizes.
- The vector rig, its styles and its preview page are deleted. Git keeps them (7f06d22).

## Open

Smoother pixel motion means more frames per pose. The existing pipeline (`tools/mascot/PIPELINE.md`:
anchor sheets at 2×3 and 2×4, image generation on OpenRouter at about $0.07 an image) can make
them. That is Patch's call, because it spends money.
