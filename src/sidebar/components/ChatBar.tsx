// The chat pane's top row: what the panel knows (audit, catalog) on the left,
// and the conversation controls on the right, Chats (past conversations) and
// New chat. A sweep along its bottom edge is the panel's one busy indicator.
import { useEffect, useRef, type RefObject } from "react";
import type { SavedChat } from "../chatHistory";

export function ChatBar({
  status,
  busy,
  chatCount,
  historyOpen,
  onToggleHistory,
  onNew,
  canNew,
  historyButtonRef,
}: {
  status: string;
  busy: boolean;
  chatCount: number;
  historyOpen: boolean;
  onToggleHistory: () => void;
  onNew: () => void;
  canNew: boolean;
  historyButtonRef: RefObject<HTMLButtonElement>;
}) {
  return (
    <div className="relative flex h-9 shrink-0 items-center gap-2 border-b border-line pl-3 pr-1.5">
      <p className="min-w-0 flex-1 truncate text-xs text-ink-2">{status}</p>
      {chatCount > 0 && (
        <button
          ref={historyButtonRef}
          onClick={onToggleHistory}
          aria-expanded={historyOpen}
          aria-controls="chat-history"
          className={`focus-ring inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors ${
            historyOpen ? "bg-ink/[0.07] text-ink" : "text-ink-2 hover:bg-ink/[0.06] hover:text-ink"
          }`}
        >
          <svg aria-hidden width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M2 3.5h10M2 7h10M2 10.5h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Chats
        </button>
      )}
      <button
        onClick={onNew}
        disabled={!canNew}
        className="focus-ring inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-ink-2 transition-colors hover:bg-ink/[0.06] hover:text-ink disabled:pointer-events-none disabled:opacity-40"
      >
        <svg aria-hidden width="13" height="13" viewBox="0 0 14 14" fill="none">
          <path d="M7 2.5v9M2.5 7h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        New chat
      </button>
      {busy && (
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-px overflow-hidden">
          <span className="block h-full w-1/3 animate-sweep bg-fordham-maroon dark:bg-fordham-maroon-ink" />
        </span>
      )}
    </div>
  );
}

function when(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ChatHistory({
  chats,
  activeId,
  onOpen,
  onDelete,
  onClose,
}: {
  chats: SavedChat[];
  activeId: string | null;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    listRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div id="chat-history" role="region" aria-label="Past chats" className="absolute inset-x-2 top-2 z-30 animate-toast-pop">
      <div className="card max-h-[60vh] overflow-y-auto shadow-lift-2">
        <ul ref={listRef} className="divide-y divide-line">
          {chats.map((c) => (
            <li key={c.id} className="group flex items-center">
              <button
                onClick={() => onOpen(c.id)}
                aria-current={c.id === activeId ? "true" : undefined}
                className="focus-ring min-w-0 flex-1 rounded-lg px-3.5 py-2.5 text-left hover:bg-ink/[0.04] focus-visible:ring-inset focus-visible:ring-offset-0"
              >
                <span className={`block truncate text-sm ${c.id === activeId ? "font-semibold text-ink" : "text-ink"}`}>{c.title}</span>
                <span className="block text-xs tabular-nums text-ink-3">{when(c.updatedAt)}</span>
              </button>
              <button
                onClick={() => onDelete(c.id)}
                aria-label={`Delete chat: ${c.title}`}
                className="focus-ring mr-1.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-3 hover:bg-ink/[0.06] hover:text-ink"
              >
                <svg aria-hidden width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
