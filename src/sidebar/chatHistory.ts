// Saved chats: every conversation stays in the browser (chrome.storage.local)
// until the student deletes it. The intake conversation is not saved; its
// output is the memories. Titles come from the student's first question, so
// no model call names a chat.
import { useCallback, useEffect, useState } from "react";
import type { ConversationMessage } from "../shared/types";

export interface SavedChat {
  id: string;
  title: string;
  updatedAt: number;
  messages: ConversationMessage[];
}

const CHATS_KEY = "chats";
const ACTIVE_KEY = "activeChatId";
export const MAX_CHATS = 30;

export function titleFor(messages: ConversationMessage[]): string {
  const first = messages.find((m) => m.role === "user")?.content.replace(/\s+/g, " ").trim() ?? "";
  if (!first) return "New chat";
  return first.length > 48 ? `${first.slice(0, 47).trimEnd()}…` : first;
}

/** Insert or replace by id, newest first, capped. */
export function upsertChat(list: SavedChat[], chat: SavedChat, max = MAX_CHATS): SavedChat[] {
  return [chat, ...list.filter((c) => c.id !== chat.id)].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, max);
}

function newId(): string {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function useChatHistory() {
  const [chats, setChats] = useState<SavedChat[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    chrome.storage.local.get([CHATS_KEY, ACTIVE_KEY], (r) => {
      setChats((r[CHATS_KEY] as SavedChat[]) ?? []);
      setActiveId((r[ACTIVE_KEY] as string) ?? null);
      setReady(true);
    });
  }, []);

  const write = (next: SavedChat[], active: string | null) => {
    setChats(next);
    setActiveId(active);
    chrome.storage.local.set({ [CHATS_KEY]: next, [ACTIVE_KEY]: active });
  };

  /** Save the conversation on screen as the active chat (creating it if new). */
  const save = useCallback(
    (messages: ConversationMessage[]) => {
      if (!messages.some((m) => m.role === "user")) return;
      chrome.storage.local.get([CHATS_KEY, ACTIVE_KEY], (r) => {
        const list = (r[CHATS_KEY] as SavedChat[]) ?? [];
        const id = (r[ACTIVE_KEY] as string) ?? newId();
        const prev = list.find((c) => c.id === id);
        // Opening an old chat must not bump it to the top; only a new turn does.
        if (prev && JSON.stringify(prev.messages) === JSON.stringify(messages)) return;
        write(upsertChat(list, { id, title: titleFor(messages), updatedAt: Date.now(), messages }), id);
      });
    },
    []
  );

  const startNew = useCallback(() => {
    setActiveId(null);
    chrome.storage.local.set({ [ACTIVE_KEY]: null });
  }, []);

  const open = useCallback(
    (id: string): SavedChat | null => {
      const chat = chats.find((c) => c.id === id) ?? null;
      if (chat) {
        setActiveId(id);
        chrome.storage.local.set({ [ACTIVE_KEY]: id });
      }
      return chat;
    },
    [chats]
  );

  const remove = useCallback(
    (id: string) => write(chats.filter((c) => c.id !== id), activeId === id ? null : activeId),
    [chats, activeId]
  );

  const restore = useCallback((chat: SavedChat) => write(upsertChat(chats, chat), activeId), [chats, activeId]);

  const active = chats.find((c) => c.id === activeId) ?? null;
  return { ready, chats, activeId, active, save, startNew, open, remove, restore };
}
