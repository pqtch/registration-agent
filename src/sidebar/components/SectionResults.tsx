// Implements: ADR 0040 (section cards: the way into the plan)
//
// The evidence under a catalog-search citation, made actionable. The advisor's
// prose stays the document (ADR 0024); these are the sections the search
// actually returned (a panel payload the model never sees, ADR 0037), behind a
// native disclosure so a 20-result search doesn't bury the answer. Each row can
// be added to the plan, and says BEFORE you add it if it would overlap
// something already kept. The overlap rule is shared/plan.ts's, not ours.
import { useMemo } from "react";
import type { PanelCourse, PanelSection } from "../../shared/types";
import { findConflicts, type PlannedSection } from "../../shared/plan";
import { usePlan } from "../usePlan";
import { meetingsLabel } from "../meetingFormat";

export function toPlanned(c: PanelCourse, s: PanelSection): PlannedSection {
  return {
    crn: s.crn,
    courseCode: c.courseCode,
    title: c.title,
    credits: c.credits,
    instructor: s.instructor,
    seats: s.seats,
    mode: s.mode,
    meetings: s.meetings,
    attributes: s.attributes,
    addedAt: Date.now(),
  };
}

export default function SectionResults({ courses }: { courses: PanelCourse[] }) {
  const { term, sections: plan, add, remove } = usePlan();
  const rows = useMemo(
    () => courses.flatMap((c) => c.sections.map((s) => ({ c, s }))),
    [courses]
  );
  if (rows.length === 0) return null;
  const kept = new Set(plan.map((p) => p.crn));

  return (
    <details className="group mt-1">
      <summary className="focus-ring inline-flex cursor-pointer list-none items-center gap-1 rounded text-xs font-medium text-fordham-maroon dark:text-fordham-maroon-ink [&::-webkit-details-marker]:hidden">
        <svg aria-hidden width="10" height="10" viewBox="0 0 10 10" className="transition-transform duration-200 ease-spring group-open:rotate-90">
          <path d="M3.5 2l3 3-3 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="group-open:hidden">Show {rows.length} {rows.length === 1 ? "section" : "sections"}</span>
        <span className="hidden group-open:inline">Hide sections</span>
      </summary>
      <ul className="mt-2 card divide-y divide-line overflow-hidden">
        {rows.map(({ c, s }) => {
          const isKept = kept.has(s.crn);
          const overlaps = isKept
            ? []
            : findConflicts([...plan, toPlanned(c, s)]).filter((x) => x.a === s.crn || x.b === s.crn);
          const overlapWith = overlaps
            .map((x) => plan.find((p) => p.crn === (x.a === s.crn ? x.b : x.a))?.courseCode)
            .filter(Boolean);
          return (
            <li key={s.crn} className="flex items-start gap-2 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] leading-snug text-ink">
                  <span className="font-semibold tabular-nums">{c.courseCode}</span>{" "}
                  <span className="text-ink-2">{c.title}</span>
                </p>
                <p className="mt-0.5 text-xs tabular-nums text-ink-2">
                  {meetingsLabel(s.meetings)} ·{" "}
                  {s.seats > 0 ? `${s.seats} ${s.seats === 1 ? "seat" : "seats"}` : (
                    <span className="font-medium text-amber-700 dark:text-amber-300">Full</span>
                  )}{" "}
                  · CRN {s.crn}
                  {s.instructor ? ` · ${s.instructor}` : ""}
                </p>
                {overlapWith.length > 0 && (
                  <p className="mt-0.5 text-xs font-medium text-red-700 dark:text-red-400">
                    Overlaps {overlapWith.join(" and ")} in your plan
                  </p>
                )}
              </div>
              {term && (
                <button
                  onClick={() => (isKept ? remove(s.crn) : add(toPlanned(c, s)))}
                  aria-pressed={isKept}
                  aria-label={isKept ? `Remove ${c.courseCode} CRN ${s.crn} from plan` : `Add ${c.courseCode} CRN ${s.crn} to plan`}
                  className={`focus-ring shrink-0 min-w-[56px] rounded-md px-2 py-1 text-xs font-medium transition-[background-color,color,border-color,transform] duration-200 ease-spring active:scale-95 ${
                    isKept
                      ? "bg-fordham-maroon text-white hover:bg-fordham-maroon/90"
                      : "border border-line-2 text-ink hover:border-fordham-maroon dark:hover:border-fordham-maroon-ink"
                  }`}
                >
                  {isKept ? "Added" : "Add"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </details>
  );
}
