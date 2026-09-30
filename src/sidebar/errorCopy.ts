// Implements: ADR 0026 (system events never speak in the advisor's voice)
//
// Our sentence for a failed turn: what went wrong, in words a student knows,
// and which action fixes it. The provider's raw text still renders under it
// in mono (Notice `body`), quoted, so nothing is hidden. Before this, a bad
// key read "401 authentication_error: invalid x-api-key" and offered Retry,
// which fails the same way every time (audit 2026-09-30, #2).
//
// Classes are matched on the raw message because that is all AI_ERROR
// carries: the worker forwards `err.message`, which the Anthropic SDK prefixes
// with the HTTP status and the error type.

export type TurnErrorFix = "settings" | "retry";

export interface TurnErrorCopy {
  title: string;
  fix: TurnErrorFix;
}

const CLASSES: { test: RegExp; copy: TurnErrorCopy }[] = [
  {
    test: /no api key/i,
    copy: { title: "Add your Anthropic API key to start", fix: "settings" },
  },
  {
    test: /\b401\b|authentication_error|invalid x-api-key/i,
    copy: { title: "Your Anthropic API key was rejected", fix: "settings" },
  },
  {
    test: /\b403\b|permission_error/i,
    copy: { title: "This API key isn't allowed to use the model", fix: "settings" },
  },
  {
    test: /credit balance/i,
    copy: { title: "Your Anthropic account is out of credit", fix: "retry" },
  },
  {
    test: /\b429\b|rate_limit/i,
    copy: { title: "Too many requests on this key. Wait a minute, then retry", fix: "retry" },
  },
  {
    test: /\b529\b|overloaded/i,
    copy: { title: "Anthropic is overloaded. Retry in a moment", fix: "retry" },
  },
  {
    test: /\b5\d\d\b|api_error|internal server error/i,
    copy: { title: "Anthropic had a server error. Retry in a moment", fix: "retry" },
  },
  {
    test: /failed to fetch|network ?error|connection error|econn|etimedout|timed out/i,
    copy: { title: "Couldn't reach Anthropic. Check your connection", fix: "retry" },
  },
];

const FALLBACK: TurnErrorCopy = { title: "The advisor couldn't respond", fix: "retry" };

export function describeTurnError(raw: string): TurnErrorCopy {
  return CLASSES.find((c) => c.test.test(raw))?.copy ?? FALLBACK;
}
