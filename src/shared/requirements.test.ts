import { describe, expect, it } from "vitest";
import { backupFor, candidatesFor, optionMatches, requirementFor, resolveRegistered, type OpenRequirement } from "./requirements";
import type { Course, Day, Section } from "./types";

const sec = (crn: string, section: string, days: Day[], s: string, e: string, seats = 5, attrs: string[] = []): Section => ({
  crn,
  section,
  instructor: "",
  seatsAvailable: seats,
  campus: "",
  deliveryMode: "in_person",
  meetings: [{ days, startTime: s, endTime: e, building: "", room: "" }],
  attributes: attrs.map((code) => ({ code, description: code })),
});
const course = (code: string, sections: Section[]): Course => ({
  courseCode: code, subject: code.split(" ")[0], title: code, credits: 3, description: "", prerequisites: "", sections,
});

const CATALOG = [
  course("CISC 4615", [sec("1", "R01", ["M", "W"], "10:00", "11:15"), sec("2", "R02", ["T", "R"], "10:00", "11:15")]),
  course("CISC 3500", [sec("3", "R01", ["T", "R"], "10:00", "11:15")]),
  course("ENGL 3014", [sec("4", "R01", ["F"], "09:00", "11:45", 0, ["EP3"])]),
  course("PHIL 3712", [sec("5", "R01", ["M"], "13:00", "14:15", 2, ["EP3"])]),
];
const req = (id: string, options: OpenRequirement["options"]): OpenRequirement => ({ id, label: id, block: "", options });
const EP3 = req("ep3", [{ subject: "@", number: "@", attributes: ["EP3"] }]);
const UPPER = req("upper", [{ subject: "CISC", number: "4@", attributes: [] }]);
const ANY = req("any", [{ subject: "@", number: "@", attributes: [] }]);

describe("optionMatches", () => {
  it("reads DegreeWorks wildcards and ranges", () => {
    const c = CATALOG[0];
    expect(optionMatches({ subject: "CISC", number: "4@", attributes: [] }, c, c.sections[0])).toBe(true);
    expect(optionMatches({ subject: "CISC", number: "3@", attributes: [] }, c, c.sections[0])).toBe(false);
    expect(optionMatches({ subject: "CISC", number: "4000", numberEnd: "4999", attributes: [] }, c, c.sections[0])).toBe(true);
    expect(optionMatches({ subject: "@", number: "@", attributes: ["EP3"] }, c, c.sections[0])).toBe(false);
  });
});

describe("requirementFor", () => {
  it("names the requirement a section counts toward, and ignores catch-all rules", () => {
    expect(requirementFor(CATALOG[2], CATALOG[2].sections[0], [ANY, EP3, UPPER])?.id).toBe("ep3");
    expect(requirementFor(CATALOG[1], CATALOG[1].sections[0], [ANY, EP3, UPPER])).toBeNull();
  });
});

describe("candidatesFor", () => {
  it("returns only sections that fit around what's busy, open seats first", () => {
    const busy = [{ crn: "3", meetings: CATALOG[1].sections[0].meetings }]; // T/R 10:00
    expect(candidatesFor(UPPER, CATALOG, busy).map((c) => c.section.crn)).toEqual(["1"]);
    expect(candidatesFor(EP3, CATALOG, []).map((c) => c.section.crn)).toEqual(["5", "4"]);
  });
});

describe("backupFor", () => {
  it("prefers another section of the same course, then the same requirement", () => {
    const planned = { crn: "1", courseCode: "CISC 4615", meetings: CATALOG[0].sections[0].meetings };
    expect(backupFor(planned, UPPER, CATALOG, [planned])?.section.crn).toBe("2");
    const busyTR = { crn: "3", meetings: CATALOG[1].sections[0].meetings };
    expect(backupFor(planned, UPPER, CATALOG, [planned, busyTR])).toBeNull();
    const ep = { crn: "4", courseCode: "ENGL 3014", meetings: CATALOG[2].sections[0].meetings };
    expect(backupFor(ep, EP3, CATALOG, [ep])?.section.crn).toBe("5");
  });
});

describe("resolveRegistered", () => {
  const cls = { term: "202720", subject: "CISC", number: "4615", section: "R02", title: "", credits: 4, status: "registered" as const };
  it("matches the audit's section exactly", () => {
    const r = resolveRegistered(cls, CATALOG);
    expect(r.kind === "found" && r.section.crn).toBe("2");
  });
  it("asks instead of guessing when the audit gives no section", () => {
    expect(resolveRegistered({ ...cls, section: "" }, CATALOG).kind).toBe("choose");
    const one = resolveRegistered({ ...cls, number: "3500", section: "" }, CATALOG);
    expect(one.kind === "found" && one.section.crn).toBe("3");
  });
  it("says missing when the course isn't in this catalog", () => {
    expect(resolveRegistered({ ...cls, number: "9999" }, CATALOG).kind).toBe("missing");
  });
});
