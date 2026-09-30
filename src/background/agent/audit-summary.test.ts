import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { AuditResponse } from "../../shared/degreeworks-types";
import { auditToSummary } from "./audit-summary";

const fixture = JSON.parse(
  readFileSync(resolve(__dirname, "../../../notes/fixtures/audit.fixture.json"), "utf8"),
) as AuditResponse;

describe("auditToSummary (anonymized fixture, ADR 0018)", () => {
  const s = auditToSummary(fixture);

  it("reads the header's own numbers", () => {
    expect(s.percentComplete).toBe(72);
    expect(s.creditsApplied).toBe(90); // 84 resident + 6 transfer
    expect(s.creditsInProgress).toBe(12);
    expect(s.creditsRequired).toBeNull(); // the fixture has no degree block to state it
  });

  it("lists open top-level rules, skipping complete and in-progress ones", () => {
    const core = s.blocks.find((b) => b.title === "Core Curriculum")!;
    expect(core.percentComplete).toBe(100);
    expect(core.open).toEqual([]);
    const major = s.blocks.find((b) => b.title === "Major in Integrative Neuroscience")!;
    expect(major.open.map((o) => o.label)).toEqual([
      "The Fine Arts",
      "Systems/Computational Concentration",
      "Research Experience",
      "Research Experience Capstone",
      "Major Elective",
    ]);
  });

  it("carries no student identity (ADR 0009)", () => {
    const out = JSON.stringify(s);
    for (const pii of ["Doe", "Jane", "A00000000", "jane.doe@example.edu"]) expect(out).not.toContain(pii);
  });

  it("takes credits required from the degree block when it states them", () => {
    const withDegree = {
      ...fixture,
      blockArray: [
        ...(fixture.blockArray ?? []),
        {
          ...(fixture.blockArray![0] as object),
          requirementType: "DEGREE",
          header: { qualifierArray: [{ name: "MINCREDITS", credits: "124", text: "" }] },
        },
      ],
    } as AuditResponse;
    expect(auditToSummary(withDegree).creditsRequired).toBe(124);
  });
});
