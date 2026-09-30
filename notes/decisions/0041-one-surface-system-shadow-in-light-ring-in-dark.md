# 0041 — One surface system: shadow in light, ring in dark

- **Status**: Accepted
- **Date**: 2026-09-30
- **Related**: amends 0025 (dark mode is a token split) and 0031 (native-app surface grammar)

## Context

Patch's first live check in DegreeWorks (2026-09-30) asked for two things in light mode: containers
should be shadowed like DegreeWorks' own cards rather than outlined, and grey text should be a step
darker. Neither was one edit. Every colour was a hard-coded Tailwind pair
(`text-stone-600 dark:text-stone-400`), about 150 of them, and depth was mixed: some containers had
borders, some had borders and `shadow-sm`, and some lists sat on the paper between hairlines.

## Decision

Colours are CSS variables in `src/sidebar/styles.css`. Tailwind reads them as named utilities
(`tailwind.config.js`), so a theme is one set of variables and not a `dark:` twin on every element.

- **Surfaces:** `paper` is the canvas, `raised` is a card, `sunk` is a well or input, and `line` / `line-2`
  are the hairline and the control border.
- **Text, four levels:** `ink`, `ink-2`, `ink-3` and `ink-4`. In light mode each level is one stone step
  darker than the pair it replaced (600 became 700, 500 became 600). `ink-4` is only for placeholders
  and disabled text.
- **Depth, one strategy per theme:** `shadow-lift` / `shadow-lift-2`. In light mode these are soft
  two-layer shadows. In dark mode the same token is a 1px white ring at about 7%, because a shadow on
  near-black can't be seen.
- **`.card`** (in `@layer components`) is `raised` plus radius plus `lift`. A container you act on is a
  card. Lists inside a card divide with `divide-line`. Chat prose is not carded.

## Consequences

- The next "slightly darker" change is one variable.
- A new component uses the tokens. A raw `stone-*` class is now a smell worth fixing where you find
  one. A few are left in files that no rework has touched yet.
- Changing `tailwind.config.js` needs a dev-server restart. Until then, `@apply` of a new token fails
  with "class does not exist". `.card` is plain CSS, so it doesn't depend on that.
