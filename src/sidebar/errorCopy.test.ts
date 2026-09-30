import { describe, expect, it } from "vitest";
import { describeTurnError } from "./errorCopy";

describe("describeTurnError", () => {
  it.each([
    ["No API key set. Go to Settings and add your Anthropic API key.", "settings", /Add your Anthropic API key/],
    ["401 authentication_error: invalid x-api-key", "settings", /rejected/],
    ['401 {"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}', "settings", /rejected/],
    ["403 permission_error: not allowed", "settings", /isn't allowed/],
    ["400 invalid_request_error: Your credit balance is too low to access the Anthropic API.", "retry", /out of credit/],
    ["429 rate_limit_error: Number of request tokens has exceeded your per-minute rate limit", "retry", /Too many requests/],
    ["529 overloaded_error: Overloaded", "retry", /overloaded/],
    ["500 api_error: Internal server error", "retry", /server error/],
    ["TypeError: Failed to fetch", "retry", /Couldn't reach/],
    ["Connection error.", "retry", /Couldn't reach/],
  ])("%s → %s", (raw, fix, title) => {
    const copy = describeTurnError(raw);
    expect(copy.fix).toBe(fix);
    expect(copy.title).toMatch(title);
  });

  it("falls back to the generic sentence, and never offers Settings for an unknown failure", () => {
    expect(describeTurnError("something odd happened")).toEqual({
      title: "The advisor couldn't respond",
      fix: "retry",
    });
  });

  it("does not read a CRN-like number inside a word boundary as a status", () => {
    expect(describeTurnError("section 44012 not found").fix).toBe("retry");
    expect(describeTurnError("section 44012 not found").title).toBe("The advisor couldn't respond");
  });
});
