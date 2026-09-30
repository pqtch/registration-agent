// Implements: ADR 0040 (the plan has a home: Plan tab, week grid)
//
// The plan's signature: the student's week, Mon–Fri (weekend columns only when
// something meets then), each kept section a block at its real time, and any
// overlap hatched in the danger ink. It has to answer "does this week work?"
// at a squint, before a single label is read.
//
// Visual only. The same facts are in the section list under it, so the figure
// is one labelled image to assistive tech (role="img") and its parts are hidden.
import { useMemo } from "react";
import type { Day } from "../../shared/types";
import { layoutWeek, type GridConflict, type GridItem } from "../weekLayout";

const HOUR_PX = 26;
const GUTTER_PX = 26;
const DAY_LABEL: Record<Day, string> = {
  M: "Mon", T: "Tue", W: "Wed", R: "Thu", F: "Fri", S: "Sat", U: "Sun",
};

function hourLabel(min: number): string {
  const h = Math.floor(min / 60);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${h < 12 ? "a" : "p"}`;
}

export default function WeekGrid({
  items,
  conflicts,
  label,
}: {
  items: GridItem[];
  conflicts: GridConflict[];
  label: string;
}) {
  const l = useMemo(() => layoutWeek(items, conflicts), [items, conflicts]);
  const hours = (l.endMin - l.startMin) / 60;
  const n = l.days.length;
  const colLeft = (i: number) => `calc(${GUTTER_PX}px + (100% - ${GUTTER_PX}px) * ${i} / ${n})`;
  const colWidth = (share = 1) => `calc((100% - ${GUTTER_PX}px) / ${n} * ${share})`;
  const y = (min: number) => ((min - l.startMin) / 60) * HOUR_PX;
  const dayIndex = (d: Day) => l.days.indexOf(d);

  return (
    <figure role="img" aria-label={label} className="select-none">
      <div aria-hidden className="relative h-5">
        {l.days.map((d, i) => (
          <span
            key={d}
            className="absolute top-0 text-center text-[11px] font-medium text-ink-2"
            style={{ left: colLeft(i), width: colWidth() }}
          >
            {DAY_LABEL[d]}
          </span>
        ))}
      </div>
      <div aria-hidden className="relative" style={{ height: hours * HOUR_PX }}>
        {Array.from({ length: hours + 1 }, (_, h) => (
          <div key={h} className="absolute inset-x-0" style={{ top: h * HOUR_PX }}>
            <div
              className="absolute right-0 border-t border-line"
              style={{ left: GUTTER_PX }}
            />
            {h < hours && (
              <span className="absolute left-0 -top-[7px] w-[22px] text-right text-[10px] tabular-nums text-ink-3">
                {hourLabel(l.startMin + h * 60)}
              </span>
            )}
          </div>
        ))}
        {l.days.slice(1).map((d, i) => (
          <div
            key={d}
            className="absolute top-0 bottom-0 border-l border-line"
            style={{ left: colLeft(i + 1) }}
          />
        ))}
        {/* Bands sit UNDER the blocks: a clashing block's fill is translucent,
            so the hatch shows through the shared window while its label stays
            crisp on top. */}
        {l.bands.map((band, i) => (
          <div
            key={i}
            className="week-clash-band absolute pointer-events-none rounded-[2px]"
            style={{
              top: y(band.start),
              height: Math.max(y(band.end) - y(band.start), 3),
              left: colLeft(dayIndex(band.day)),
              width: colWidth(),
            }}
          />
        ))}
        {l.blocks.map((b) => (
          <div
            key={`${b.id}-${b.day}-${b.start}`}
            className={`absolute overflow-hidden rounded-[4px] ${b.lanes > 1 ? "px-0.5" : "px-1"} py-0.5 text-[10px] font-semibold leading-tight tabular-nums ring-1 ring-inset ${
              b.clash
                ? "bg-red-600/10 text-red-700 ring-red-600/35 dark:bg-red-400/15 dark:text-red-300 dark:ring-red-400/40"
                : b.registered
                ? "bg-ink/[0.07] text-ink-2 ring-line-2"
                : "bg-fordham-maroon/[0.08] text-fordham-maroon ring-fordham-maroon/20 dark:bg-fordham-maroon-ink/15 dark:text-fordham-maroon-ink dark:ring-fordham-maroon-ink/25"
            }`}
            style={{
              top: y(b.start) + 1,
              height: Math.max(y(b.end) - y(b.start) - 2, 10),
              left: `calc(${colLeft(dayIndex(b.day))} + ${colWidth(b.lane / b.lanes)} + 1px)`,
              width: `calc(${colWidth(1 / b.lanes)} - 2px)`,
            }}
          >
            {/* On a clash the hatch shows through the translucent fill, so the
                label gets a paper-coloured backing to stay legible over it. */}
            {b.clash ? (
              <span className="rounded-[2px] bg-paper/90 box-decoration-clone px-0.5 -mx-0.5">
                {b.label}
              </span>
            ) : (
              b.label
            )}
          </div>
        ))}
      </div>
    </figure>
  );
}
