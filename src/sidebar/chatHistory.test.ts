import { describe, expect, it } from "vitest";
import { titleFor, upsertChat, type SavedChat } from "./chatHistory";

const msg = (role: "user" | "assistant", content: string) => ({ role, content, timestamp: "" });
const chat = (id: string, updatedAt: number): SavedChat => ({ id, title: id, updatedAt, messages: [] });

describe("titleFor", () => {
  it("uses the first question, collapsed and capped", () => {
    expect(titleFor([msg("assistant", "hi"), msg("user", "  What   core do I need? ")])).toBe("What core do I need?");
    const long = titleFor([msg("user", "x".repeat(80))]);
    expect(long.length).toBe(48);
    expect(long.endsWith("…")).toBe(true);
    expect(titleFor([])).toBe("New chat");
  });
});

describe("upsertChat", () => {
  it("replaces by id, keeps newest first, and caps the list", () => {
    const list = [chat("a", 3), chat("b", 2), chat("c", 1)];
    expect(upsertChat(list, chat("c", 9)).map((c) => c.id)).toEqual(["c", "a", "b"]);
    expect(upsertChat(list, chat("d", 0), 3).map((c) => c.id)).toEqual(["a", "b", "c"]);
  });
});
