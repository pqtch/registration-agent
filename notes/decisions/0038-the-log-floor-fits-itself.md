# 0038 — The log's floor fits itself, and "at the bottom" is measured, not remembered

- **Status**: Accepted
- **Date**: 2026-09-30
- **Related**: repairs 0032's pin-to-top; keeps the resident's corner from the mascot commits (`27a2517`, `cf048f0`)

## Context

An audit of the rendered sidebar (2026-09-30, 400px and 320px, light and dark) found Fordhawke
standing opaque over the advisor's answer in four places: during a what-if, after a save toast,
and at 320px in a restored chat and in first run. Two faults combined.

1. `isAtBottom` started `true` and was recomputed only on a `scroll` event. A stream growing
   below the fold, a toast shrinking the pane, and a restored conversation all change the
   geometry without scrolling, so it stayed `true`. The resident only fades out when it is
   `false`, so he stayed visible over text, and "Latest" stayed hidden.
2. Pin-to-top could not pin. `scrollTo` clamps at the maximum scroll, so when little content sat
   below the student's new turn, the turn stayed near the bottom and the answer streamed in
   under the resident's corner, which is the opposite of 0032's contract.

The fixed 128px spacer under the log was right about the resident's band and wrong as the only
thing below the log.

## Decision

The spacer becomes **the floor**, sized by code. At rest it is the resident's band (128px). After
a send it grows to whatever the viewport has left below the pinned turn, so the turn can reach
the top, and it shrinks as the answer fills in, so the view holds still while the answer
streams. At-bottom is measured on scroll **and** by a `ResizeObserver` on the pane and the log
content. A restored conversation lands at its end.

## Alternatives considered

### Alternative A: move the resident out of the log's column
Put him in the composer bar or the header. Rejected for now: the corner is a deliberate,
recent choice ("always in the corner" won, per the mascot commits), and both faults were
measurement faults. Fixing them makes the corner honest without moving him.

### Alternative B: keep the fixed spacer, auto-scroll during the stream
This was the auto-follow that 0032 removed after live testing, because it scrolled citations away
before they could be read.

### Alternative C: size the floor through React state
Every resize would re-render the whole log mid-stream. The floor is sized with `style.height`
and sits outside the observed content, so resizing it can't loop the observer.

## Consequences

- The resident fades whenever text would pass under him, including while a long answer
  streams below the fold. The thought bubble fades with him, so the Stop button in the composer
  is the only running-state cue until the student returns to the bottom.
- The log's content now lives in an inner wrapper (`contentRef`); `space-y-3` moved onto it.
- Geometry constants live at the top of `AuditChat.tsx` (`BOTTOM_THRESHOLD`, `FLOOR_MIN`,
  `PIN_GAP`). If the sprite's rendered height changes, `FLOOR_MIN` changes with it.

## Revisit if...

- The resident's sprite grows past ~120px tall, or moves out of the corner.
- Students report losing the running-state cue during long answers.
