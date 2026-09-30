# 0044 — Fordhawke as a vector rig

- **Status**: Accepted
- **Date**: 2026-09-30
- **Related**: supersedes 0039's sprite playback (the director and bubble rules stay); the pixel pipeline (`tools/mascot/PIPELINE.md`) now serves only the logo and icons

## Context

Patch's live check (2026-09-30): "The ram sprite needs to be remade with smoother animations and
clearer imagery. There should also be a setting to change the size of the ram." Also: "the thought
bubble is slightly too far right."

Both problems came from the medium:

- The sprites were detailed pixel art drawn for 128px and shown at about 65px, so the detail blurred.
- Each pose was 6–8 frames, so motion stepped.
- Pixel art scales cleanly only by whole numbers, so a size setting could offer two steps at most.
- The bubble was placed by fixed offsets from the pane corner, not from the ram. Its trail ended past
  his head, and a size setting would have moved him out from under it.

Patch chose vector ("sure, let's try it"), knowing it leaves the pixel style he approved in July.

## Decision

- **One SVG, drawn in parts** (`components/Fordhawke.tsx`), keeping the character: cream face, gold
  spiral horns, mortarboard with gold tassel, brown blazer with the gold F, backpack. He is drawn
  facing left, into the conversation, so there is no mirror transform.
- **Motion is transforms on parts, never frames.** Idle breathes, blinks and sways the tassel.
  Changing pose cross-fades only the arm and prop variants (180ms) while the head eases to its new
  angle (340ms). Poses: wave (on open), thinking (hand at chin), reading (a scroll, eyes scanning),
  what-if (a crystal ball with a glow). The unused walk poses are gone.
- **Reduced motion:** nothing loops and the greeting wave is skipped. The pose still changes, because
  it says what he's doing.
- **Size is a setting:** Off, Small, Medium (the default) or Large, which is 0, 84, 108 or 136px tall
  (Settings → Appearance). The log's floor reserves his height, so the last line clears him.
- **The bubble is anchored to his height** (`--ram` on the pane). Its trail ends just over his cap at
  every size. With him off, it sits in the corner with no trail.
- **In dark mode** a faint cream rim (`drop-shadow`) keeps his dark outline from vanishing into the
  paper.

## Consequences

- `mascotMotion.ts`, its tests and the sprite imports are gone. The strips stay in `tools/mascot/`
  as history, and nothing ships them. The dead `RamMark` component is gone too.
- Poses are checked by eye on `src/sidebar/dev/mascot.html` (dev-only; every pose at every size,
  light and dark, `?still` for reduced motion). There is no unit test for how the drawing looks.
- The art is hand-authored SVG. Changing a pose means editing paths in one file, not regenerating
  images.
