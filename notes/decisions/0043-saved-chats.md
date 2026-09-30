# 0043 — Saved chats

- **Status**: Accepted
- **Date**: 2026-09-30
- **Related**: amends 0032 (fresh-chat Continue) and PRIVACY.md

## Context

Patch (2026-09-30): "we need a way to save/start a new chat." There was one conversation, kept in
`chrome.storage.session`. It grew without end, could not be set aside, and vanished when the browser
closed.

## Decision

- **Chats persist in `chrome.storage.local`** as `{ id, title, updatedAt, messages }`, newest first,
  capped at 30 (`sidebar/chatHistory.ts`). The title is the student's first question, so no model
  call names a chat.
- **The chat bar** over the log holds the status line, **Chats** (the list) and **New chat**. The
  list is an in-pane panel: focus goes to the first chat, Esc closes it, and focus returns to its
  button. Deleting a chat offers **Undo** for six seconds instead of asking for confirmation.
- **A chat saves when a turn settles**, not on every streamed frame, and again if the panel closes
  mid-turn. Re-opening an old chat doesn't bump it to the top; only a new turn does.
- **The intake conversation is not a saved chat.** It stays in session storage, as before, and
  Continue clears it; its output is the memories.
- A conversation left in session storage by an earlier build is restored once and then saved.
- The worker is unchanged. Each turn still sends the on-screen history as text only (ADR 0028), so
  an old chat can be resumed.

PRIVACY.md and `docs/index.html` now say chats are kept in the browser until deleted.

## Consequences

`AuditChat.tsx` was split along the same lines. Streaming pace is `usePacedStream`, scroll geometry
is `useLogScroll`, and `Composer` and `ChatBar` are components. `StatusStrip` is gone, merged into
the chat bar. The broadcast state machine stays in `AuditChat`.
