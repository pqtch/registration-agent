# 0040 — The plan has a home: a Plan tab, a week grid, section cards, and where you stand

- **Status**: Accepted
- **Date**: 2026-09-30
- **Related**: builds on 0037 (panel payloads); keeps 0024 (the answer is the document), 0026 (system voice), 0031/0032 (surface grammar), 0009 (PII boundary); 0023's weekend days are honoured by the overlap rule

## Context

The product is called RamPlan and had no plan in it. A rendered audit (2026-09-30) scored it 2/4
on recognition over recall: the advisor's recommended sections lived only in prose, and to
register a student copied CRNs from chat history by hand. The empty Advisor screen showed four
generic questions over ~400px of nothing, while the student's audit sat loaded. Patch chose the
feature set on 2026-09-30: Plan tab, section cards, where you stand, and send the plan to the
advisor. He also chose to keep the Claude-app dialect and sharpen it rather than replace it.

## Decision

1. **Plan tab** (Advisor · Plan · Settings). Kept sections for the loaded catalog term, in
   `chrome.storage.local` under `plan:<termCode>`. The page shows the term in the display serif
   with a credit total, the **week grid**, a plain sentence naming any overlap, the section
   list (remove, seats, CRN, attribute codes), **Copy CRNs**, and **Email plan to <advisor>**
   (a `mailto:` built from the plan's own contents).
2. **The week grid is the signature.** Mon–Fri (weekend columns only when something meets
   then), blocks at their real times, and overlaps hatched in the danger ink under the blocks,
   with backed labels. It answers "does this week work?" at a squint. It is one labelled image
   to assistive tech; the list under it carries the same facts as text.
3. **Section cards** sit under a catalog-search citation, behind a native `<details>` so the
   answer stays primary. Each row has Add/Added, and warns *before* adding if the section
   would overlap something already kept.
4. **Where you stand** replaces the generic suggestions once the audit has been summarised
   (`auditToSummary`, parsed at refresh, PII-free): progress, credits as the audit states
   them, and each block's open requirements as one-tap questions.
5. **The advisor sees the plan** in the uncached volatile block (0020), so "does this fit my
   plan?" is answered against what was kept, and the advisor knows sections are kept by Add.
6. The overlap rule lives once, in `shared/plan.ts` (`findConflicts`): shared time on a day,
   and touching ends don't count. The grid draws conflicts; it never decides them.

## Alternatives considered

### Alternative A: let the advisor manage the plan by tool call
Deferred, not rejected. A tool that writes the plan puts a model between the student and their
registration data. Add/Remove by hand keeps the student the author. Revisit once students ask
the advisor to do it.

### Alternative B: a timetable as the whole Plan page
A full-height calendar at 320–420px leaves no room for the list, and the list is where CRNs,
seats and the overlap sentence live. The grid is sized to the plan's own hours instead.

### Alternative C: plan in IndexedDB
The catalog is there, but `chrome.storage.local` is small, already mocked by the harness, and
gives `onChanged` for free, which keeps the tab count, the cards and the Plan page in sync
without a message bus.

## Consequences

- Seats are a snapshot from the last catalog load, and the page says so. Registration stays
  in Banner, and the page says that too.
- A plan belongs to one catalog term; loading another term shows that term's plan. Multi-term
  planning (the "Ahead" view Patch asked about) builds on this key scheme.
- `catalogTermLabel` is stored alongside `catalogTerm` when a catalog loads (Banner's own
  description); older installs fall back to the term-code arithmetic from 0017's
  retrospective until their next catalog load.

## Revisit if...

- Students keep more than ~8 sections (the grid's lanes get narrow at 320px).
- Banner seat counts need to be live rather than snapshots.
