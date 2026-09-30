# 0037 — Panel payloads: tool results can carry data for the sidebar that the model never sees

- **Status**: Accepted
- **Date**: 2026-09-30
- **Related**: extends 0019 (tool registry); keeps 0028 (only conversational turns enter the prompt path); enables 0040

## Context

`search_catalog` returned compact JSON to the model (meetings flattened to strings like
`"TF 13:00-14:15 @ Keating 206"`, so a search round stays small), and the chat loop told the
sidebar only `{name, courseCount}`. So the sections the advisor found existed in the panel only
as the markdown table the model chose to write. None of them could be kept, compared, or checked
against the student's week, and the student copied CRNs out of chat history by hand.

## Decision

A `ToolDef` may implement `executeWithPanel`, which runs once and returns both the model's
result string and a panel payload. The chat loop sends the model its result unchanged and
broadcasts the payload on `AI_TOOL_RESULT` as `courses`. The sidebar stores it on the
`ToolEvent`, and `conversationalOnly` strips `toolEvents` before any history is sent.

For `search_catalog`, one matching pass (`matchCatalog`) yields both projections: the model's
compact JSON and `PanelCourse[]` with structured `MeetingTime[]` and attribute descriptions.
Tests pin that the model's JSON is byte-identical with and without the panel path, that the
panel holds exactly the model's sections in order, and that `conversationalOnly` output
carries no panel data.

## Alternatives considered

### Alternative A: parse the model's markdown table
It's model-authored, often partial ("the two that fit"), and has no CRNs unless the model
chose to print them. That puts the student's registration data at the mercy of prose.

### Alternative B: a second query from the sidebar
The sidebar would re-run the search against IndexedDB with the same input. That's two
implementations of the filters that can drift, so the cards could show sections the model
never saw.

### Alternative C: give the model the structured shape too
It's bigger per round for no gain in answer quality, and it would change a prompt path that
has been tuned (0010/0020).

## Consequences

- Session storage holds the payload on restored messages (up to 20 courses × 5 sections per
  search). It's cleared with the session like everything else there.
- Other tools can opt in later (what-if results, attribute lists) without touching the loop.
- Old messages restored from before this change have no `courses`; their citations render
  without cards, which is correct.
