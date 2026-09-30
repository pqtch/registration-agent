# RamPlan — repo law

An MV3 Chrome extension: an AI academic advisor that lives inside Fordham's DegreeWorks,
grounded in the student's live degree audit and the Banner course catalog. React + TypeScript
+ Vite + `@crxjs`, Tailwind, Zustand, IndexedDB (`idb`), Anthropic SDK.

This file is the local law for work in this repo. It holds only what is load-bearing every
session; everything else is a pointer. **Identity is not here** — a facet booting via
`abraxas <facet> ~/registration-agent` carries identity and memory over the bridge.

## Read on demand, do not duplicate here

| Need | Read |
|---|---|
| Architecture, repo layout, tech stack, security posture | `README.md` |
| Why anything is the way it is — the ADRs | `notes/decisions/` (+ its `README.md` index) |
| Manual feature walkthrough / demo script | `notes/TESTING.md` |
| DegreeWorks + Banner API shapes | `notes/degreeworks-api*.md` |
| Sprite/logo generation pipeline | `tools/mascot/PIPELINE.md` |

**Code is the source of truth, never the docs.** When they disagree, the code wins and the
doc gets fixed.

## Commands

```bash
npm run build      # vite build → dist/   (~3s)
npm test           # vitest run
npm run dev        # vite dev server on :5173 — needed for the render path below
npm run build:win  # build + rsync dist/ to /mnt/c/Users/Public/ramplan-dist/ (WSL→Windows Chrome)
```

## The render path — how to actually SEE the UI

The sidebar renders standalone in a plain tab, with **no extension, no DegreeWorks, no Banner,
no API key, no network**. Every byte is fabricated (`src/sidebar/dev/chrome-mock.ts`). This is
the loop for any visual verdict.

```bash
npm run dev &   # serves :5173
# then open http://localhost:5173/src/sidebar/dev.html?state=chat
```

**Screenshots: `tools/shots.sh [OUTDIR] [WIDTH]`** (defaults `shots/`, 400). It shoots every
harness scenario in light and dark with the `agent-browser` CLI (`npm i -g agent-browser`),
reading the scenario list, and which scenarios need a sent message, from the harness itself
(`window.__RAMPLAN_SCENARIOS`), so a new scenario needs no script edit. It fails loudly if
the page isn't the harness: a dead dev server renders Chrome's error page, which
screenshots perfectly well. Look at every shot; a shot nobody opened proves nothing.

The sidebar's real width is ~400px (Chrome's side panel minimum is 320px); check both, not
1280. The theme default is `system`, so check light and dark.

Scenarios are listed with one-line descriptions at the top of `src/sidebar/dev/chrome-mock.ts`
(the code is the list; don't copy it here). `?state=plan*` scenarios open on the Plan tab via
`&page=plan`, which the harness adds. In `chat`/`empty`, typing + Enter plays a canned slow
stream, so mid-stream states are reachable.

Some states (`error`, `toolcap`, `whatif`'s run) only render in response to a *sent* message.
`&autosend` drives the real composer on load (`&autosend=Your%20text` for custom text);
`shots.sh` adds it for scenarios flagged `autosend`. Dev-only (`boot.ts`), never bundled.

Both `dev.html` and `boot.ts` are absent from `manifest.json`, so `@crxjs` never bundles the
harness (mock + autosend). It cannot ship. Confirm after a build: `grep -rl
"chrome-mock\|__RAMPLAN" dist/` prints nothing.

## Repo conventions

- **ADRs are the decision record.** A non-obvious choice gets a numbered ADR in
  `notes/decisions/` (`TEMPLATE.md` to start). Source files cite them in a header comment
  (`// Implements: ADR 0031`). Follow that citation when changing behavior — and when you
  supersede a decision, say so in the new ADR; several already supersede earlier ones
  (0036 supersedes 0035's glyph; the header lockup supersedes 0036's crest pairing).
- Anonymized fixtures in `notes/fixtures/` back the offline test loop (ADR 0018). Never commit
  real student data — the PII boundary is at the renderer (ADR 0009).
- Secrets never enter the repo. The API key is the user's own, in `chrome.storage.local`.

## Current state — the Web Store push

Goal: RamPlan on the Chrome Web Store, **unlisted** (link-installable, invisible to search) so
testers run it against **their own** DegreeWorks. Unlisted was chosen for lower review scrutiny
and less trademark exposure than a public listing carrying Fordham branding.

**Code state (2026-09-30, evening).** Second rework, after Patch's first live check. The Plan
is now the home tab and fills itself from the audit (0042). There are saved chats (0043), a vector
Fordhawke with a size setting (0044), and Fordham knowledge from fordham.edu with sources (0045),
all on one surface-token system (0041). Chat runs on `claude-sonnet-5-5`, and the SDK is 0.130.
Everything was verified through the render path. **The live DegreeWorks check of this build is
Patch's**; so is the first real fordham.edu search, because the tests use a fake stream.
Permissions are unchanged; the key is still bring-your-own.

**Ship blockers — all paperwork:**
1. **Privacy policy — drafted, needs hosting.** Text lives in `PRIVACY.md`; a self-contained
   hostable copy is `docs/index.html`. Host from **`pqtch/registration-agent`** (Patch's repo,
   the deploy target — not the `NickTrinh` upstream in the README/ADR 0001): enable GitHub Pages
   (main branch, `/docs`) → served at `https://pqtch.github.io/registration-agent/`. Paste that
   URL + complete the data-use certification in the dashboard.
2. **Screenshots** — ≥1 at 1280×800 or 640×400. Generate from the render path
   (`?state=chat`, `whatif`, `saves` are strongest), never from live student data.
3. **Listing copy** + packaged zip of `dist/`.
4. **Developer account** — one-time $5, verified email. Do first; verification can lag.

**Resolved (see git history):** extension icon is now the ram mascot head — ringed head at
128/48, ringless bigger head at 16 for toolbar legibility (`public/icons/`, masters backed up
in `notes/brand/icon-exploration/`); `action.default_icon` made explicit. Header logo bloat
fixed — `App.tsx` now imports 64px-tall header bakes (`logo-header{,-dark}.png`, ~6KB each);
the 599KB masters stay as source for the icon crop but no longer ship (1.16MB → 11KB). The
suspected chat-transcript contrast issue did not reproduce — it was an entry fade mid-render.

**Follow-up (not blocking):** the icon swap supersedes ADR 0036 for the extension icon and
wants its own ADR when the push resumes.
