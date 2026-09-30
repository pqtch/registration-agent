# 0042 — The plan fills itself from the audit

- **Status**: Accepted
- **Date**: 2026-09-30
- **Related**: extends 0040 (the plan has a home); keeps 0009 (PII boundary) and 0037 (panel payloads)

## Context

Patch's live check (2026-09-30) asked for a term dropdown on the Plan tab, and for the plan to start
from the classes the student is already scheduled for. It should find those classes in the audit and
cross-reference the catalog for their meeting times. He also agreed to try the Plan as the first tab.

Before this, a plan began empty. Its only way in was the advisor: ask, wait for a catalog search,
then tap Add. The week grid didn't know about classes the student was already registered for, so it
could approve a section that collided with one of them.

## Decision

The Plan is the first and default tab. Its heading is the term picker: a native `<select>` laid
invisibly over the serif term name. Picking a term loads that term's catalog through the existing
`REFRESH_CATALOG`.

- **Registered classes come from the audit.** `auditToSummary` keeps every class DegreeWorks marks
  `inProgress` or `preregistered`: term, subject, number, section and credits. Course facts only, so
  there is no PII. Banner's section number (`sequenceNumber`) is now kept on catalog sections, so a
  registered class resolves to its exact CRN and meeting time. When the audit gives no section and the
  course has several, the Plan **asks** which one. It never guesses a time. A class not in the loaded
  catalog is listed without a time and says so.
- **"Still needed" comes from the audit's rules.** Each open requirement keeps its course matchers
  (`courseArray`: subject, number or `N@` or a range, `ATTRIBUTE=`). `shared/requirements.ts` matches
  them against the local catalog, and lists the sections that fit around the whole week, open seats
  first. A pure-wildcard rule matches nothing, because it would match the whole catalog. Lookup is
  instant and free; "Ask the advisor" stays on every requirement for judgment.
- **Every planned section gets one backup:** another section of the same course, else one meeting the
  same requirement. It must fit, have seats, and not be anyone else's backup. Swap is one tap.
- **Overlaps are computed over the whole week** (registered plus planned), on the Plan and on the
  chat's section cards. The advisor's prompt now also lists the registered classes.
- **The advisor email** (`sidebar/advisorEmail.ts`) opens a prefilled Gmail compose. Fordham student
  mail is Gmail. It lists each class with its CRN, time and backup, and the requirement it counts
  toward per the audit. It gives no model-written reasons. A link can't attach a file, so the week is
  drawn to a PNG (`scheduleImage.ts`) and put on the clipboard, and the note tells the student to paste it.

## Consequences

- The harness seeds a fabricated Spring 2027 catalog into IndexedDB (`dev/catalog-mock.ts`), so the
  whole flow runs offline. The sidebar reads the catalog directly through `useCatalog`, one shared store.
- Catalogs loaded before this change have no section numbers. Their registered classes resolve only
  when the course has one section, until the student refreshes seats.
- Gmail opens in the browser's default Google account. A student signed into a personal account
  first must switch before the draft opens. Not solved.
- The rule matcher reads `ATTRIBUTE=` only. Other qualifiers (`DWTERM`, `DWCREDITS`) are ignored, so a
  listed section can still fail a rule's finer print. The audit stays the authority.
