import { describe, expect, it } from "vitest";
import type { Day } from "./types";
import {
  addSection,
  crns,
  findConflicts,
  planEmail,
  planPromptText,
  removeSection,
  termLabel,
  totalCredits,
  type PlannedSection,
} from "./plan";

let t = 0;
const sec = (crn: string, code: string, meetings: [Day[], string, string][], credits = 3): PlannedSection => ({
  crn,
  courseCode: code,
  title: `${code} title`,
  credits,
  instructor: "",
  seats: 4,
  mode: "in_person",
  meetings: meetings.map(([days, startTime, endTime]) => ({ days, startTime, endTime, building: "", room: "" })),
  attributes: [],
  addedAt: ++t,
});

describe("findConflicts", () => {
  it("finds the shared window, once per pair per day", () => {
    const c = findConflicts([
      sec("2", "COMM 3233", [[["T"], "14:30", "17:15"]]),
      sec("1", "ENGL 3014", [[["T", "F"], "13:00", "14:45"]]),
    ]);
    expect(c).toEqual([{ a: "1", b: "2", day: "T", start: "14:30", end: "14:45" }]);
  });

  it("does not count touching ends as an overlap", () => {
    expect(
      findConflicts([sec("1", "A", [[["M"], "10:00", "11:00"]]), sec("2", "B", [[["M"], "11:00", "12:00"]])]),
    ).toEqual([]);
  });

  it("ignores sections with no meeting time", () => {
    expect(findConflicts([sec("1", "A", [[[], "", ""]]), sec("2", "B", [[["M"], "09:00", "10:00"]])])).toEqual([]);
  });

  it("counts weekend days (ADR 0023)", () => {
    expect(
      findConflicts([sec("1", "A", [[["S"], "09:00", "12:00"]]), sec("2", "B", [[["S"], "11:00", "13:00"]])]),
    ).toHaveLength(1);
  });

  it("never reports a section overlapping itself", () => {
    expect(findConflicts([sec("1", "A", [[["M"], "09:00", "10:00"], [["M"], "09:30", "10:30"]])])).toEqual([]);
  });
});

describe("plan list helpers", () => {
  it("adds idempotently and removes by CRN", () => {
    const a = sec("1", "A", []);
    const once = addSection([], a);
    expect(addSection(once, a)).toBe(once);
    expect(removeSection(once, "1")).toEqual([]);
  });

  it("totals credits and orders CRNs by the week, TBA last", () => {
    const list = [
      sec("3", "C", [[[], "", ""]], 1),
      sec("2", "B", [[["T"], "09:00", "10:00"]], 4),
      sec("1", "A", [[["M"], "15:00", "16:00"]], 3),
    ];
    expect(totalCredits(list)).toBe(8);
    expect(crns(list)).toEqual(["1", "2", "3"]);
  });
});

describe("termLabel", () => {
  it("reads YYYY as the academic year ending (ADR 0017)", () => {
    expect(termLabel("202710")).toBe("Fall 2026");
    expect(termLabel("202620")).toBe("Spring 2026");
    expect(termLabel("202630")).toBe("Summer 2026");
    expect(termLabel("202640")).toBe("Term 202640");
  });
});

describe("planEmail", () => {
  it("says only what the plan holds", () => {
    const e = planEmail([sec("40001", "ENGL 3014", [[["T", "F"], "13:00", "14:15"]])], {
      firstName: "Ava",
      termLabel: "Fall 2026",
    });
    expect(e.subject).toBe("Course plan for Fall 2026");
    expect(e.body).toBe(
      [
        "Hi,",
        "",
        "Here's the plan I'm considering for Fall 2026:",
        "",
        "ENGL 3014 ENGL 3014 title — CRN 40001 — TF 13:00–14:15 — 3 cr",
        "",
        "Total: 3 credits",
        "",
        "Thanks,",
        "Ava",
      ].join("\n"),
    );
  });
});

describe("planPromptText", () => {
  it("lists kept sections, total and overlaps for the advisor", () => {
    const text = planPromptText(
      [sec("2", "COMM 3233", [[["T"], "14:30", "17:15"]]), sec("1", "ENGL 3014", [[["T", "F"], "13:00", "14:45"]])],
      "Fall 2026",
    );
    expect(text).toContain("kept for Fall 2026");
    expect(text).toContain("- ENGL 3014 ENGL 3014 title — CRN 1 — TF 13:00–14:45 — 3 cr");
    expect(text).toContain("Total: 6 credits.");
    expect(text).toContain("Overlaps: ENGL 3014 and COMM 3233 on T 14:30–14:45.");
  });
  it("tells the advisor how sections get kept when there are none", () => {
    expect(planPromptText([], "Fall 2026")).toMatch(/tapping Add/);
  });
});
