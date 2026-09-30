import { describe, expect, it } from "vitest";
import type { MeetingTime } from "../shared/types";
import { layoutWeek, toMinutes, type GridItem } from "./weekLayout";

const mt = (days: MeetingTime["days"], startTime: string, endTime: string): MeetingTime => ({
  days,
  startTime,
  endTime,
  building: "",
  room: "",
});
const item = (id: string, ...meetings: MeetingTime[]): GridItem => ({ id, label: id, meetings });

describe("toMinutes", () => {
  it("parses 24h HH:MM and rejects the rest", () => {
    expect(toMinutes("14:05")).toBe(845);
    expect(toMinutes("9:30")).toBe(570);
    expect(toMinutes("")).toBeNull();
    expect(toMinutes("TBA")).toBeNull();
  });
});

describe("layoutWeek", () => {
  it("spans whole hours around the plan, at least four", () => {
    const l = layoutWeek([item("a", mt(["M", "W"], "10:30", "11:20"))]);
    expect(l.startMin).toBe(600);
    expect(l.endMin).toBe(600 + 240);
    expect(l.days).toEqual(["M", "T", "W", "R", "F"]);
    expect(l.blocks.map((b) => b.day)).toEqual(["M", "W"]);
  });

  it("adds a weekend column only when something meets then", () => {
    expect(layoutWeek([item("a", mt(["S"], "09:00", "12:00"))]).days).toEqual(["M", "T", "W", "R", "F", "S"]);
  });

  it("puts blocks that share time in side-by-side lanes", () => {
    const l = layoutWeek([item("a", mt(["T"], "13:00", "14:15")), item("b", mt(["T"], "14:00", "16:45"))]);
    const t = l.blocks.filter((b) => b.day === "T");
    expect(t.map((b) => [b.id, b.lane, b.lanes])).toEqual([
      ["a", 0, 2],
      ["b", 1, 2],
    ]);
  });

  it("keeps touching blocks in one lane", () => {
    const l = layoutWeek([item("a", mt(["T"], "13:00", "14:00")), item("b", mt(["T"], "14:00", "15:00"))]);
    expect(l.blocks.every((b) => b.lanes === 1 && b.lane === 0)).toBe(true);
  });

  it("marks clashes and bands from the conflicts it is given, not its own rule", () => {
    const l = layoutWeek(
      [item("a", mt(["T"], "13:00", "14:15")), item("b", mt(["T"], "14:00", "16:45"))],
      [{ a: "a", b: "b", day: "T", start: "14:00", end: "14:15" }],
    );
    expect(l.blocks.every((b) => b.clash)).toBe(true);
    expect(l.bands).toEqual([{ day: "T", start: 840, end: 855 }]);
  });

  it("lists sections with no meeting time instead of drawing them", () => {
    const l = layoutWeek([item("async", mt([], "", "")), item("a", mt(["F"], "09:00", "10:00"))]);
    expect(l.unscheduled).toEqual(["async"]);
    expect(l.blocks).toHaveLength(1);
  });
});
