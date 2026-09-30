// Implements: ADR 0042 (the plan fills itself from the audit)
//
// The plan as a draft email to the advisor. It says only what the plan holds:
// the classes, their CRNs and times, and the requirement each one counts toward
// according to the audit. It invents no reasons. Fordham mail is Gmail, so the
// draft opens in Gmail's compose window, prefilled; the student edits and sends.
import type { MeetingTime } from "../shared/types";
import type { PlannedSection } from "../shared/plan";
import { meetingsLabel } from "./meetingFormat";

export interface EmailInput {
  termLabel: string;
  firstName: string | null;
  advisorName: string | null;
  credits: number;
  registered: { courseCode: string; title: string; meetings: MeetingTime[] | null }[];
  planned: {
    section: PlannedSection;
    fills: { label: string; block: string } | null;
    backup: { courseCode: string; crn: string; meetings: MeetingTime[] } | null;
  }[];
}

export function advisorEmail(i: EmailInput): { subject: string; body: string } {
  const lines: string[] = [
    i.advisorName ? `Hi ${i.advisorName},` : "Hi,",
    "",
    `Here's my plan for ${i.termLabel} (${i.credits} ${i.credits === 1 ? "credit" : "credits"}).`,
  ];
  if (i.registered.length) {
    lines.push("", "Already registered:");
    for (const r of i.registered) {
      lines.push(`- ${r.courseCode} ${r.title}${r.meetings ? ` · ${meetingsLabel(r.meetings)}` : ""}`);
    }
  }
  if (i.planned.length) {
    lines.push("", "Planning to add:");
    for (const { section: s, fills, backup } of i.planned) {
      lines.push(`- ${s.courseCode} ${s.title} · CRN ${s.crn} · ${meetingsLabel(s.meetings)} · ${s.credits} cr`);
      if (fills) lines.push(`  Counts toward: ${fills.label} (${fills.block})`);
      if (backup) lines.push(`  Backup: ${backup.courseCode}, CRN ${backup.crn} · ${meetingsLabel(backup.meetings)}`);
    }
  }
  lines.push("", "Does this plan look right to you?", "", "Thanks,", ...(i.firstName ? [i.firstName] : []));
  return { subject: `My ${i.termLabel} course plan`, body: lines.join("\n") };
}

export function gmailComposeUrl(to: string | null, subject: string, body: string): string {
  const q = new URLSearchParams({ view: "cm", fs: "1", to: to ?? "", su: subject, body });
  return `https://mail.google.com/mail/?${q.toString()}`;
}
