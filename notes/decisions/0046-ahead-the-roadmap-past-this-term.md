# 0046 — Ahead: the roadmap past this term

- **Status**: Accepted (roadmap); offering history deferred
- **Date**: 2026-09-30
- **Related**: extends 0040 and 0042; proposed in the 2026-09-30 rework plan as "multi-term roadmap + offering history"

## Context

Patch approved an Ahead view (2026-09-30), to be built after his live check, which came back the
same day. The Plan answers "what do I take this term". Students also need "when do I take the rest",
especially for requirements that don't fit this term, like a capstone that clashes with a registered
class.

## Decision

- **Ahead is a section at the foot of the Plan**, not a new tab. It lists the four fall and spring
  terms after the term being planned (`shared/roadmap.ts` `nextTerms`; summers are left out) and
  every open requirement this term's plan doesn't cover. Each requirement has a native term picker.
  Placed requirements group under their term, and the rest wait under "Not placed yet".
- **The placement is the student's.** It is stored locally (`roadmap`: requirement id → term) and
  never inferred. Placements in a term that is no longer ahead drop out on their own.
- **The advisor reads it.** The plan prompt gains a "roadmap for later terms" block, so "is my
  senior year realistic?" is answered against the student's own placement.
- **Counts, not credits.** A requirement's credits aren't known until a section is chosen, so Ahead
  shows how many requirements sit in a term and doesn't guess credit totals.

## Deferred: offering history

Offering history means "when is CISC 4999 usually offered?". Answering it takes Banner searches of
past terms, one term binding at a time, alongside the student's live session. It can't be checked
without a Fordham login, so it isn't built. The next step is a worker message that searches one
course across the last four terms, lazily, when a requirement row opens, and shows "Offered: Fall
2025, Spring 2026". Build it when Patch can check it live.

## Consequences

A requirement placed ahead still shows under "Still needed" for this term, with its sections, if any
fit. That is deliberate: placing it later doesn't mean it can't be taken now. A small "planned for
Fall 2027" hint on that row would help, but isn't built yet.
