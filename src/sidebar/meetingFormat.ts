// How a meeting time reads on screen: "Tue/Fri 1:00–2:15 PM". Registrar data is
// 24h with R for Thursday (ADR 0023); students read 12h and day names. One
// module so the plan, the section cards and the citations say it the same way.
import type { Day, MeetingTime } from "../shared/types";
import { toMinutes } from "./weekLayout";

export const DAY_SHORT: Record<Day, string> = {
  M: "Mon", T: "Tue", W: "Wed", R: "Thu", F: "Fri", S: "Sat", U: "Sun",
};

export function daysLabel(days: Day[]): string {
  return days.map((d) => DAY_SHORT[d] ?? d).join("/");
}

function clock(min: number): { text: string; pm: boolean } {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return { text: `${h12}:${String(m).padStart(2, "0")}`, pm: h >= 12 };
}

// "1:00–2:15 PM", or "11:30 AM–12:45 PM" when the span crosses noon.
export function timeRange(start: string, end: string): string | null {
  const s = toMinutes(start);
  const e = toMinutes(end);
  if (s === null || e === null) return null;
  const a = clock(s);
  const b = clock(e);
  const suffix = (pm: boolean) => (pm ? "PM" : "AM");
  return a.pm === b.pm
    ? `${a.text}–${b.text} ${suffix(b.pm)}`
    : `${a.text} ${suffix(a.pm)}–${b.text} ${suffix(b.pm)}`;
}

export function meetingLabel(m: MeetingTime): string {
  const t = timeRange(m.startTime, m.endTime);
  if (!t || m.days.length === 0) return "No set meeting time";
  return `${daysLabel(m.days)} ${t}`;
}

export function meetingsLabel(ms: MeetingTime[]): string {
  const timed = ms.filter((m) => timeRange(m.startTime, m.endTime) && m.days.length);
  return timed.length ? timed.map(meetingLabel).join("; ") : "No set meeting time";
}
