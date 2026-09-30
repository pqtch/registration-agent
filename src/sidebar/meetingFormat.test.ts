import { describe, expect, it } from "vitest";
import { daysLabel, meetingsLabel, timeRange } from "./meetingFormat";

describe("meeting formatting", () => {
  it("names days, with R as Thursday", () => {
    expect(daysLabel(["T", "R"])).toBe("Tue/Thu");
  });
  it("puts one period on a same-half range and two across noon", () => {
    expect(timeRange("13:00", "14:15")).toBe("1:00–2:15 PM");
    expect(timeRange("08:30", "09:45")).toBe("8:30–9:45 AM");
    expect(timeRange("11:30", "12:45")).toBe("11:30 AM–12:45 PM");
    expect(timeRange("12:00", "13:15")).toBe("12:00–1:15 PM");
  });
  it("says so when there is no meeting time rather than printing blanks", () => {
    expect(meetingsLabel([{ days: [], startTime: "", endTime: "", building: "", room: "" }])).toBe(
      "No set meeting time",
    );
  });
  it("joins multiple meetings", () => {
    expect(
      meetingsLabel([
        { days: ["M", "W"], startTime: "10:00", endTime: "10:50", building: "", room: "" },
        { days: ["F"], startTime: "14:30", endTime: "16:20", building: "", room: "" },
      ]),
    ).toBe("Mon/Wed 10:00–10:50 AM; Fri 2:30–4:20 PM");
  });
});
