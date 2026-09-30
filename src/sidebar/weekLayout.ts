// Geometry for the Plan tab's week grid (ADR 0040). Pure: items in, blocks out.
//
// Lanes are geometry, not policy: two blocks that share time on a day sit side
// by side so neither hides the other. Whether sharing time is a *conflict* is
// decided once, in shared/plan.ts (findConflicts), and passed in; the grid only
// draws it.
import type { Day, MeetingTime } from "../shared/types";

export interface GridItem {
  id: string; // CRN
  label: string; // course code, e.g. "ENGL 3014"
  meetings: MeetingTime[];
}

export interface GridConflict {
  a: string;
  b: string;
  day: Day;
  start: string; // "HH:MM"
  end: string;
}

export interface GridBlock {
  id: string;
  label: string;
  day: Day;
  start: number; // minutes from midnight
  end: number;
  lane: number;
  lanes: number; // lanes in this block's cluster
  clash: boolean;
}

export interface GridBand {
  day: Day;
  start: number;
  end: number;
}

export interface WeekLayout {
  days: Day[];
  startMin: number; // top of the grid, on the hour
  endMin: number; // bottom of the grid, on the hour
  blocks: GridBlock[];
  bands: GridBand[]; // conflict windows to hatch
  unscheduled: string[]; // ids with no timed meeting (online async, TBA)
}

const WEEKDAYS: Day[] = ["M", "T", "W", "R", "F"];
const MIN_SPAN = 4 * 60;
const EMPTY_START = 9 * 60;

export function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function layoutWeek(items: GridItem[], conflicts: GridConflict[] = []): WeekLayout {
  const raw: Omit<GridBlock, "lane" | "lanes" | "clash">[] = [];
  const unscheduled: string[] = [];
  for (const item of items) {
    let timed = false;
    for (const m of item.meetings) {
      const start = toMinutes(m.startTime);
      const end = toMinutes(m.endTime);
      if (start === null || end === null || end <= start) continue;
      timed = true;
      for (const day of m.days) raw.push({ id: item.id, label: item.label, day, start, end });
    }
    if (!timed) unscheduled.push(item.id);
  }

  const weekend = (["S", "U"] as Day[]).filter((d) => raw.some((b) => b.day === d));
  const days = [...WEEKDAYS, ...weekend];

  let startMin = EMPTY_START;
  let endMin = EMPTY_START + MIN_SPAN * 2;
  if (raw.length) {
    startMin = Math.floor(Math.min(...raw.map((b) => b.start)) / 60) * 60;
    endMin = Math.ceil(Math.max(...raw.map((b) => b.end)) / 60) * 60;
  }
  if (endMin - startMin < MIN_SPAN) endMin = startMin + MIN_SPAN;

  const clashIds = (day: Day) =>
    new Set(conflicts.filter((c) => c.day === day).flatMap((c) => [c.a, c.b]));

  const blocks: GridBlock[] = [];
  for (const day of days) {
    const dayBlocks = raw.filter((b) => b.day === day).sort((x, y) => x.start - y.start || x.end - y.end);
    const clashing = clashIds(day);
    // Clusters of blocks that share time (touching ends don't), then greedy lanes.
    let cluster: typeof dayBlocks = [];
    let clusterEnd = -1;
    const flush = () => {
      const laneEnds: number[] = [];
      const placed = cluster.map((b) => {
        let lane = laneEnds.findIndex((e) => e <= b.start);
        if (lane === -1) lane = laneEnds.length;
        laneEnds[lane] = b.end;
        return { ...b, lane };
      });
      for (const p of placed) blocks.push({ ...p, lanes: laneEnds.length, clash: clashing.has(p.id) });
      cluster = [];
    };
    for (const b of dayBlocks) {
      if (cluster.length && b.start >= clusterEnd) flush();
      cluster.push(b);
      clusterEnd = cluster.length === 1 ? b.end : Math.max(clusterEnd, b.end);
    }
    if (cluster.length) flush();
  }

  const bands: GridBand[] = [];
  for (const c of conflicts) {
    const start = toMinutes(c.start);
    const end = toMinutes(c.end);
    if (start !== null && end !== null && end > start) bands.push({ day: c.day, start, end });
  }

  return { days, startMin, endMin, blocks, bands, unscheduled };
}
