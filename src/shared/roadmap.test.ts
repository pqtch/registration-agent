import { describe, expect, it } from "vitest";
import { livePlacements, nextTerms, roadmapPromptText } from "./roadmap";

describe("nextTerms", () => {
  it("walks fall and spring after the given term, skipping summers", () => {
    expect(nextTerms("202720", 3).map((t) => t.label)).toEqual(["Fall 2027", "Spring 2028", "Fall 2028"]);
    expect(nextTerms("202710", 2).map((t) => t.code)).toEqual(["202720", "202810"]);
    expect(nextTerms("202630", 1).map((t) => t.label)).toEqual(["Fall 2026"]);
    expect(nextTerms("junk", 2)).toEqual([]);
  });
});

describe("livePlacements", () => {
  it("drops placements in terms that are no longer ahead", () => {
    expect(livePlacements({ a: "202810", b: "202620" }, [{ code: "202810" }])).toEqual({ a: "202810" });
  });
});

describe("roadmapPromptText", () => {
  it("groups placements by term for the advisor", () => {
    const text = roadmapPromptText(
      [
        { label: "Senior capstone", block: "Major", term: "202810" },
        { label: "EP4", block: "Core", term: "202810" },
      ],
      1
    );
    expect(text).toContain("- Fall 2027: Senior capstone (Major); EP4 (Core)");
    expect(text).toContain("1 open requirements are not placed yet.");
  });
});
