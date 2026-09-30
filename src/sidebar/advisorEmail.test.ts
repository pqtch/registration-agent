import { describe, expect, it } from "vitest";
import { advisorEmail, gmailComposeUrl } from "./advisorEmail";
import type { PlannedSection } from "../shared/plan";

const s: PlannedSection = {
  crn: "41021", courseCode: "ENGL 3014", title: "Writing the City", credits: 3, instructor: "", seats: 6,
  mode: "in_person", attributes: [], addedAt: 1,
  meetings: [{ days: ["T", "F"], startTime: "13:00", endTime: "14:15", building: "", room: "" }],
};

describe("advisorEmail", () => {
  it("says what the plan holds and nothing it doesn't", () => {
    const e = advisorEmail({
      termLabel: "Spring 2027", firstName: "Ava", advisorName: null, credits: 7,
      registered: [{ courseCode: "CISC 3500", title: "Database Systems", meetings: null }],
      planned: [{ section: s, fills: { label: "Eloquentia Perfecta 3", block: "Core Curriculum" }, backup: null }],
    });
    expect(e.subject).toBe("My Spring 2027 course plan");
    expect(e.body).toContain("Hi,\n");
    expect(e.body).toContain("- CISC 3500 Database Systems\n");
    expect(e.body).toContain("- ENGL 3014 Writing the City · CRN 41021 · Tue/Fri 1:00–2:15 PM · 3 cr");
    expect(e.body).toContain("  Counts toward: Eloquentia Perfecta 3 (Core Curriculum)");
    expect(e.body).not.toContain("Backup");
    expect(e.body.trim().endsWith("Ava")).toBe(true);
  });
  it("builds a Gmail compose link with the fields encoded", () => {
    const u = new URL(gmailComposeUrl("a@example.edu", "Plan & more", "line 1\nline 2"));
    expect(u.origin + u.pathname).toBe("https://mail.google.com/mail/");
    expect(u.searchParams.get("view")).toBe("cm");
    expect(u.searchParams.get("to")).toBe("a@example.edu");
    expect(u.searchParams.get("su")).toBe("Plan & more");
    expect(u.searchParams.get("body")).toBe("line 1\nline 2");
  });
});
