# 0045 — Fordham knowledge comes from fordham.edu, cited

- **Status**: Accepted
- **Date**: 2026-09-30
- **Related**: extends 0024 (the advisor tells the truth about what it's doing) and 0037 (panel payloads)

## Context

Patch (2026-09-30): "we need registration information and fordham knowledge. So it knows the
requirements for specific majors." The advisor had the student's audit, a what-if audit and the
catalog. Anything else about Fordham (another major's requirements, core rules, registration dates,
overloads, pass/fail) came from the model's training, where it is often out of date or wrong. Nothing
on screen showed which kind of answer the student was reading.

## Decision

- **An order of authority**, written into the advisor prompt: first the audit, then `run_what_if` for
  an undeclared program, then fordham.edu. The model's own memory of Fordham is **not a source**;
  when none of the three answers, it says so.
- **fordham.edu through Claude's server-side web search**: `web_search_20260209`,
  `allowed_domains: ["fordham.edu"]` (subdomains included, so the bulletin and the registrar), and
  `max_uses: 3` per request. It is offered only in normal chat, not during the intake.
- **The panel shows the work.** A search shows as a chip ("Searched fordham.edu · “query” · 4
  pages") while it runs. After the answer, the pages it actually cited are listed as **Sources**,
  each once, with its title and domain. Sources are panel-only; they never go back to the model.
- **It is the student's to turn off.** Settings → Fordham search. Each search costs a cent ($10 per
  1,000 searches, per Anthropic's docs) plus the text it reads, and the setting's footer says so.
- **An organization can have web search disabled.** The API answers with a 400, so the turn retries
  once without the tool and a notice says the answer used only the audit and the catalog.
- **Long searches can pause** (`stop_reason: "pause_turn"`). The turn is sent back as it stands, with
  no new user message, and the API resumes it.

The prompt's tool guide was rewritten in the same change. The capitalised MANDATORY/NEVER lines were
written for models that needed shouting, and Sonnet 5.5 follows plain instructions literally.

## Consequences

- This is a live lookup, not a curated knowledge pack. It is current, but a bad page is quoted as
  readily as a good one. The citations make that visible rather than preventing it.
- Nothing here was checked against the live API; the tests use a fake stream. The first real search
  is the check. If the chip never resolves, the fallback resolves it at the end of the round, but the
  count may read 0.
- Registration status (time ticket, holds) is not covered. It lives behind the student's Banner login,
  and this change doesn't read it.
