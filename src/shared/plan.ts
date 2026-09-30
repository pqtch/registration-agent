// The student's plan for a term (ADR 0040): the sections they kept, and the
// rules about them that are facts, not judgement: overlaps, credits, CRNs.
// Pure functions; storage is the caller's (usePlan, chrome.storage.local under
// `plan:<termCode>`). No model is involved in any of this.
import type { RegisteredClass } from "./requirements";
import type { Course, Day, MeetingTime, PanelSection, Section, SectionAttribute } from "./types";

export interface PlannedSection {
  crn: string;
  courseCode: string;
  title: string;
  credits: number;
  instructor: string;
  seats: number; // as of the catalog load it came from
  mode: PanelSection["mode"];
  meetings: MeetingTime[];
  attributes: SectionAttribute[];
  addedAt: number;
}

// Two kept sections that share time on a day. Touching (one ends 14:00, the
// next starts 14:00) is not an overlap. One entry per pair per day, with the
// shared window.
export interface Conflict {
  a: string; // crn
  b: string; // crn
  day: Day;
  start: string; // "HH:MM"
  end: string;
}

export const planKey = (term: string) => `plan:${term}`;

export function plannedFrom(c: Course, s: Section): PlannedSection {
  return {
    crn: s.crn,
    courseCode: c.courseCode,
    title: c.title,
    credits: c.credits,
    instructor: s.instructor,
    seats: s.seatsAvailable,
    mode: s.deliveryMode,
    meetings: s.meetings,
    attributes: s.attributes,
    addedAt: Date.now(),
  };
}

function minutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
const hhmm = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

type Slot = { crn: string; day: Day; start: number; end: number };

function slots(s: Pick<PlannedSection, "crn" | "meetings">): Slot[] {
  return s.meetings.flatMap((m) => {
    const start = minutes(m.startTime);
    const end = minutes(m.endTime);
    if (start === null || end === null || end <= start) return []; // async / TBA
    return m.days.map((day) => ({ crn: s.crn, day, start, end }));
  });
}

export function findConflicts(sections: Pick<PlannedSection, "crn" | "meetings">[]): Conflict[] {
  const all = sections.flatMap(slots);
  const seen = new Map<string, Conflict>();
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const x = all[i];
      const y = all[j];
      if (x.crn === y.crn || x.day !== y.day) continue;
      const start = Math.max(x.start, y.start);
      const end = Math.min(x.end, y.end);
      if (start >= end) continue;
      const [a, b] = x.crn < y.crn ? [x.crn, y.crn] : [y.crn, x.crn];
      const key = `${a}|${b}|${x.day}`;
      const prev = seen.get(key);
      if (!prev) seen.set(key, { a, b, day: x.day, start: hhmm(start), end: hhmm(end) });
      else {
        // Two meetings of the same pair on one day: widen to cover both.
        const ps = Math.min(minutes(prev.start)!, start);
        const pe = Math.max(minutes(prev.end)!, end);
        seen.set(key, { ...prev, start: hhmm(ps), end: hhmm(pe) });
      }
    }
  }
  return [...seen.values()];
}

export function totalCredits(sections: PlannedSection[]): number {
  return sections.reduce((n, s) => n + (Number.isFinite(s.credits) ? s.credits : 0), 0);
}

const DAY_ORDER: Day[] = ["M", "T", "W", "R", "F", "S", "U"];

// Display order: by first meeting (day, then time); sections with no meeting
// time last, in the order they were added.
export function ordered(sections: PlannedSection[]): PlannedSection[] {
  const first = (s: PlannedSection) => {
    const sl = slots(s);
    if (!sl.length) return Number.POSITIVE_INFINITY;
    return Math.min(...sl.map((x) => DAY_ORDER.indexOf(x.day) * 24 * 60 + x.start));
  };
  return [...sections].sort((p, q) => first(p) - first(q) || p.addedAt - q.addedAt);
}

export function crns(sections: PlannedSection[]): string[] {
  return ordered(sections).map((s) => s.crn);
}

export function addSection(list: PlannedSection[], s: PlannedSection): PlannedSection[] {
  return list.some((x) => x.crn === s.crn) ? list : [...list, s];
}

export function removeSection(list: PlannedSection[], crn: string): PlannedSection[] {
  return list.filter((x) => x.crn !== crn);
}

// Banner term codes: YYYY is the academic year ENDING (ADR 0017's
// retrospective), so 202710 is Fall 2026. Used only when Banner's own
// description wasn't stored with the catalog.
export function termLabel(code: string): string {
  const m = /^(\d{4})(\d{2})$/.exec(code);
  if (!m) return code;
  const year = Number(m[1]);
  switch (m[2]) {
    case "10":
      return `Fall ${year - 1}`;
    case "20":
      return `Spring ${year}`;
    case "30":
      return `Summer ${year}`;
    default:
      return `Term ${code}`;
  }
}

const DAY_CODE_ORDER = (days: Day[]) => DAY_ORDER.filter((d) => days.includes(d)).join("");

function meetingSummary(s: PlannedSection): string {
  const timed = s.meetings.filter((m) => minutes(m.startTime) !== null && minutes(m.endTime) !== null && m.days.length);
  if (!timed.length) return "async/TBA";
  return timed.map((m) => `${DAY_CODE_ORDER(m.days)} ${m.startTime}–${m.endTime}`).join("; ");
}


// The plan as the advisor reads it (volatile prompt block, ADR 0020/0040), so
// "does this fit my plan?" is answered against what the student actually kept.
export function planPromptText(
  sections: PlannedSection[],
  termLabel: string,
  registered: RegisteredClass[] = []
): string {
  const reg = registered.length
    ? [
        `Already registered for ${termLabel}, per the audit (any new section must fit around these):`,
        ...registered.map((c) => `- ${c.subject} ${c.number}${c.section ? ` ${c.section}` : ""} ${c.title} — ${c.credits} cr`),
        "",
      ]
    : [];
  if (!sections.length) {
    return [
      ...reg,
      `Nothing planned to add for ${termLabel} yet. The student adds sections from the Plan tab's Still needed list, or by tapping Add on the section cards under your catalog searches.`,
    ].join("\n");
  }
  const lines = ordered(sections).map(
    (s) => `- ${s.courseCode} ${s.title} — CRN ${s.crn} — ${meetingSummary(s)} — ${s.credits} cr`
  );
  const overlaps = findConflicts(sections).map((c) => {
    const code = (crn: string) => sections.find((s) => s.crn === crn)?.courseCode ?? crn;
    return `${code(c.a)} and ${code(c.b)} on ${c.day} ${c.start}–${c.end}`;
  });
  return [
    ...reg,
    `Sections the student plans to add for ${termLabel} (a working plan, not a registration):`,
    ...lines,
    `Total: ${totalCredits(sections)} credits.`,
    overlaps.length ? `Overlaps: ${overlaps.join("; ")}.` : "No overlaps.",
  ].join("\n");
}
