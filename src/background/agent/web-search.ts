// Implements: ADR 0045 (Fordham knowledge comes from fordham.edu, cited)
//
// Claude's server-side web search, restricted to fordham.edu. It answers what
// the audit can't: program requirements the student isn't enrolled in, core
// rules, registration dates and policy. Every claim it supports comes back with
// a citation, and the panel lists those pages under the answer.
import type Anthropic from "@anthropic-ai/sdk";

export const FORDHAM_SEARCH_KEY = "fordhamSearch"; // student's toggle; on unless false

export const FORDHAM_SEARCH_TOOL: Anthropic.Messages.WebSearchTool20260209 = {
  type: "web_search_20260209",
  name: "web_search",
  allowed_domains: ["fordham.edu"],
  max_uses: 3,
};

export interface Source {
  url: string;
  title: string;
}

/** The 400 an organization gets when an admin has turned web search off. */
export function isWebSearchDisabled(err: unknown): boolean {
  const e = err as { status?: number; message?: string };
  return e?.status === 400 && /web search/i.test(e.message ?? "") && /not enabled|disabled/i.test(e.message ?? "");
}

/** Pages the answer actually cited, first use order, one per URL. */
export function citedSources(messages: Anthropic.Messages.Message[]): Source[] {
  const seen = new Map<string, Source>();
  for (const m of messages) {
    for (const block of m.content) {
      if (block.type !== "text") continue;
      for (const c of block.citations ?? []) {
        if (c.type === "web_search_result_location" && !seen.has(c.url)) {
          seen.set(c.url, { url: c.url, title: c.title?.trim() || new URL(c.url).hostname });
        }
      }
    }
  }
  return [...seen.values()];
}

/** Search results by the server_tool_use id they answer. */
export function searchResults(message: Anthropic.Messages.Message): Map<string, { count: number; error?: string }> {
  const out = new Map<string, { count: number; error?: string }>();
  for (const block of message.content) {
    if (block.type !== "web_search_tool_result") continue;
    const c = block.content;
    out.set(block.tool_use_id, Array.isArray(c) ? { count: c.length } : { count: 0, error: c.error_code });
  }
  return out;
}
