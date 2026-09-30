import { beforeEach, describe, expect, it } from "vitest";
import { saveCourses } from "../../shared/db";
import type { Course } from "../../shared/types";
import { executeCatalogSearch, executeCatalogSearchWithPanel } from "./catalog-search";

const course = (code: string, sections: Course["sections"]): Course => ({
  courseCode: code,
  subject: code.split(" ")[0],
  title: `${code} title`,
  credits: 3,
  description: "",
  prerequisites: "",
  sections,
});
const section = (crn: string, days: ("M" | "T" | "W" | "R" | "F")[], start: string, end: string, seats = 5) => ({
  crn,
  instructor: "Prof. Example",
  seatsAvailable: seats,
  campus: "RH",
  deliveryMode: "in_person" as const,
  meetings: [{ days, startTime: start, endTime: end, building: "Keating", room: "206" }],
  attributes: [{ code: "EP3", description: "Eloquentia Perfecta 3" }],
});

describe("search_catalog panel payload (ADR 0037)", () => {
  beforeEach(async () => {
    await saveCourses([
      course("ENGL 3014", [section("40001", ["T", "F"], "13:00", "14:15"), section("40002", ["M"], "09:00", "10:15", 0)]),
      course("COMM 3233", [section("40010", ["T"], "14:30", "17:15")]),
      course("HIST 1000", [section("40020", ["W"], "10:00", "11:15")]),
    ]);
  });

  it.each([
    [{ attributes: ["EP3"], has_seats: true }],
    [{ course_code: "engl  3014" }],
    [{ subject: "COMM" }],
    [{ days: ["T" as const] }],
  ])("gives the model byte-identical JSON either way (%j)", async (input) => {
    const plain = JSON.stringify(await executeCatalogSearch(input));
    const { results } = await executeCatalogSearchWithPanel(input);
    expect(JSON.stringify(results)).toBe(plain);
  });

  it("puts exactly the model's sections, in order, into the panel, with structured meetings", async () => {
    const { results, panel } = await executeCatalogSearchWithPanel({ days: ["T"] });
    expect(panel.map((c) => c.sections.map((s) => s.crn))).toEqual(results.map((c) => c.sections.map((s) => s.crn)));
    const engl = panel.find((c) => c.courseCode === "ENGL 3014")!;
    expect(engl.sections[0].meetings[0]).toMatchObject({ days: ["T", "F"], startTime: "13:00", endTime: "14:15" });
    expect(engl.sections[0].attributes[0]).toEqual({ code: "EP3", description: "Eloquentia Perfecta 3" });
  });
});
