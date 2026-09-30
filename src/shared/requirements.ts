// Implements: ADR 0042 (the plan fills itself from the audit)
//
// What the audit says a requirement accepts, and which catalog sections meet it.
// Pure functions over plain data. The sidebar runs them against the local
// catalog, so "what fits my week" is answered without a model call.
import type { Course, MeetingTime, Section } from "./types";
import { findConflicts } from "./plan";

/** One way to satisfy a requirement, from a DegreeWorks rule's courseArray. */
export interface CourseOption {
  subject: string; // "@" = any subject
  number: string; // "@" = any, "3@" = 3000-level, or an exact number
  numberEnd?: string; // inclusive range end when the rule gives one
  attributes: string[]; // ATTRIBUTE= values the section must carry (any of)
}

export interface OpenRequirement {
  id: string;
  label: string;
  block: string; // the block's title, e.g. "Core Curriculum"
  options: CourseOption[];
}

/** A class the audit shows as in progress or registered, by term. */
export interface RegisteredClass {
  term: string;
  subject: string;
  number: string;
  section: string; // Banner sequence, e.g. "L01"; "" when the audit omits it
  title: string;
  credits: number;
  status: "in-progress" | "registered";
}

function numberMatches(opt: CourseOption, number: string): boolean {
  if (opt.number === "@") return true;
  if (opt.numberEnd) {
    const n = Number.parseInt(number, 10);
    return n >= Number.parseInt(opt.number, 10) && n <= Number.parseInt(opt.numberEnd, 10);
  }
  if (opt.number.endsWith("@")) return number.startsWith(opt.number.slice(0, -1));
  return opt.number === number;
}

export function courseParts(course: Pick<Course, "courseCode" | "subject">): { subject: string; number: string } {
  const number = course.courseCode.slice(course.subject.length).trim();
  return { subject: course.subject, number };
}

export function optionMatches(opt: CourseOption, course: Pick<Course, "courseCode" | "subject">, section: Pick<Section, "attributes">): boolean {
  const { subject, number } = courseParts(course);
  if (opt.subject !== "@" && opt.subject !== subject) return false;
  if (!numberMatches(opt, number)) return false;
  if (opt.attributes.length === 0) return true;
  return section.attributes.some((a) => opt.attributes.includes(a.code));
}

/** A rule of pure wildcards with no attribute would match the whole catalog. */
function isUsable(opt: CourseOption): boolean {
  return !(opt.subject === "@" && opt.number === "@" && opt.attributes.length === 0);
}

/** The first open requirement this section would count toward, or null. */
export function requirementFor(
  course: Pick<Course, "courseCode" | "subject">,
  section: Pick<Section, "attributes">,
  open: OpenRequirement[]
): OpenRequirement | null {
  return open.find((r) => r.options.some((o) => isUsable(o) && optionMatches(o, course, section))) ?? null;
}

type Busy = { crn: string; meetings: MeetingTime[] };

export function clashes(section: Busy, busy: Busy[]): boolean {
  return findConflicts([section, ...busy.filter((b) => b.crn !== section.crn)]).some(
    (c) => c.a === section.crn || c.b === section.crn
  );
}

export interface Candidate {
  course: Course;
  section: Section;
}

/**
 * Sections that meet a requirement and fit around `busy`, best first: open
 * seats, then more seats. Excludes sections already in `busy`.
 */
export function candidatesFor(req: OpenRequirement, courses: Course[], busy: Busy[], limit = 5): Candidate[] {
  const taken = new Set(busy.map((b) => b.crn));
  const out: Candidate[] = [];
  for (const course of courses) {
    for (const section of course.sections) {
      if (taken.has(section.crn)) continue;
      if (!req.options.some((o) => isUsable(o) && optionMatches(o, course, section))) continue;
      if (clashes({ crn: section.crn, meetings: section.meetings }, busy)) continue;
      out.push({ course, section });
    }
  }
  return out
    .sort((a, b) => Number(b.section.seatsAvailable > 0) - Number(a.section.seatsAvailable > 0) || b.section.seatsAvailable - a.section.seatsAvailable)
    .slice(0, limit);
}

/**
 * A backup for a planned section: another section of the same course that fits,
 * else a section of another course meeting the same requirement. Open seats first.
 */
export function backupFor(
  planned: { crn: string; courseCode: string },
  req: OpenRequirement | null,
  courses: Course[],
  busy: Busy[]
): Candidate | null {
  const others = busy.filter((b) => b.crn !== planned.crn);
  const taken = new Set(busy.map((b) => b.crn));
  const fits = (s: Section) => !taken.has(s.crn) && s.seatsAvailable > 0 && !clashes({ crn: s.crn, meetings: s.meetings }, others);
  const same = courses.find((c) => c.courseCode === planned.courseCode);
  const sibling = same?.sections.find(fits);
  if (same && sibling) return { course: same, section: sibling };
  if (!req) return null;
  return candidatesFor(req, courses, busy, 10).find((c) => c.course.courseCode !== planned.courseCode && fits(c.section)) ?? null;
}

export type Resolution =
  | { kind: "found"; course: Course; section: Section }
  | { kind: "choose"; course: Course } // several sections, the audit didn't say which
  | { kind: "missing" }; // not in the loaded catalog

/** Find a registered class's section in the catalog. Never guesses between sections. */
export function resolveRegistered(cls: RegisteredClass, courses: Course[]): Resolution {
  const course = courses.find((c) => {
    const p = courseParts(c);
    return p.subject === cls.subject && p.number === cls.number;
  });
  if (!course) return { kind: "missing" };
  const exact = cls.section ? course.sections.find((s) => s.section === cls.section) : undefined;
  if (exact) return { kind: "found", course, section: exact };
  if (course.sections.length === 1) return { kind: "found", course, section: course.sections[0] };
  return { kind: "choose", course };
}
