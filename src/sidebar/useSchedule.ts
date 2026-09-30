// Implements: ADR 0042 (the plan fills itself from the audit)
//
// The term's whole week: classes the audit says you're registered for,
// resolved to catalog sections, plus the sections you've planned. Overlaps,
// credits and what's still needed are computed over both, so nothing you
// add can quietly collide with a class you already have.
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePlan } from "./usePlan";
import { useCatalog } from "./useCatalog";
import { useAuditSummary } from "./useAuditSummary";
import { findConflicts } from "../shared/plan";
import { requirementFor, resolveRegistered, type OpenRequirement, type RegisteredClass } from "../shared/requirements";
import type { Course, MeetingTime, Section } from "../shared/types";

export type RegisteredRow =
  | { cls: RegisteredClass; kind: "found"; course: Course; section: Section }
  | { cls: RegisteredClass; kind: "choose"; course: Course }
  | { cls: RegisteredClass; kind: "missing" };

export interface BusySlot {
  crn: string;
  courseCode: string;
  meetings: MeetingTime[];
  registered: boolean;
}

const pickKey = (term: string) => `registeredPick:${term}`;
export const codeOf = (cls: RegisteredClass) => `${cls.subject} ${cls.number}`;

export function useSchedule() {
  const plan = usePlan();
  const catalog = useCatalog();
  const summary = useAuditSummary();
  const [picks, setPicks] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!plan.term) return;
    const key = pickKey(plan.term);
    chrome.storage.local.get(key, (r) => setPicks((r[key] as Record<string, string>) ?? {}));
  }, [plan.term]);

  const choose = useCallback(
    (courseCode: string, crn: string) => {
      if (!plan.term) return;
      const next = { ...picks, [courseCode]: crn };
      setPicks(next);
      chrome.storage.local.set({ [pickKey(plan.term)]: next });
    },
    [picks, plan.term]
  );

  // The catalog only answers for the term it holds.
  const catalogMatches = catalog.term === plan.term;

  const registered = useMemo<RegisteredRow[]>(
    () =>
      (summary?.registered ?? [])
        .filter((c) => c.term === plan.term)
        .map((cls) => {
          if (!catalogMatches) return { cls, kind: "missing" };
          const r = resolveRegistered(cls, catalog.courses);
          if (r.kind === "choose") {
            const picked = r.course.sections.find((s) => s.crn === picks[codeOf(cls)]);
            if (picked) return { cls, kind: "found", course: r.course, section: picked };
          }
          return { cls, ...r };
        }),
    [summary, plan.term, catalog.courses, catalogMatches, picks]
  );

  const busy = useMemo<BusySlot[]>(
    () => [
      ...registered.flatMap((r) =>
        r.kind === "found"
          ? [{ crn: r.section.crn, courseCode: r.course.courseCode, meetings: r.section.meetings, registered: true }]
          : []
      ),
      ...plan.sections.map((s) => ({ crn: s.crn, courseCode: s.courseCode, meetings: s.meetings, registered: false })),
    ],
    [registered, plan.sections]
  );

  const conflicts = useMemo(() => findConflicts(busy), [busy]);

  const open = useMemo<OpenRequirement[]>(
    () => (summary?.blocks ?? []).flatMap((b) => b.open.map((o) => ({ ...o, options: o.options ?? [], block: b.title }))),
    [summary]
  );

  // Which open requirement each planned section counts toward (by CRN).
  const fills = useMemo(() => {
    const m = new Map<string, OpenRequirement>();
    for (const s of plan.sections) {
      const r = requirementFor({ courseCode: s.courseCode, subject: s.courseCode.split(" ")[0] }, s, open);
      if (r) m.set(s.crn, r);
    }
    return m;
  }, [plan.sections, open]);

  const credits = plan.credits + registered.reduce((n, r) => n + r.cls.credits, 0);

  return { ...plan, catalog, catalogMatches, summary, registered, busy, conflicts, open, fills, credits, choose };
}
