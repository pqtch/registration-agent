// Implements: ADR 0024 (the advisor tells the truth about what it's doing),
// ADR 0026 (turn-scoped notices), ADR 0032 (the Claude-app dialect), ADR 0043 (saved chats)
//
// The advisor conversation. This file owns the turn state machine: what the
// worker's broadcasts do to the transcript, onboarding's intake flow, and which
// chat is on screen. Streaming pace (usePacedStream), scroll geometry
// (useLogScroll), the composer and the chat bar live beside it.
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { conversationalOnly } from "../../shared/types";
import type { ConversationMessage, ToolEvent, SystemActionItem, MemoryType } from "../../shared/types";
import Message from "../components/Message";
import Notice from "../components/Notice";
import Composer from "../components/Composer";
import { ChatBar, ChatHistory } from "../components/ChatBar";
import { describeTurnError } from "../errorCopy";
import { useAuditSummary } from "../useAuditSummary";
import WhereYouStand from "../components/WhereYouStand";
import FirstRun, { DEGREEWORKS_URL } from "../components/FirstRun";
import { ResidentMascot, usePrefersReducedMotion, type MascotState } from "../components/Mascot";
import { useMascotDirector } from "../useMascotDirector";
import { bubblePhrase, type Beat } from "../mascotDirector";
import { usePacedStream } from "../usePacedStream";
import { useLogScroll, FLOOR_MIN } from "../useLogScroll";
import { useChatHistory, type SavedChat } from "../chatHistory";

const SUGGESTIONS = [
  "What do I still need to graduate?",
  "What core requirements am I missing?",
  "What electives can I take next semester?",
  "How many credits do I have left?",
];

// One per mount, so it never re-rolls while the student watches.
const GREETINGS: ((name: string | null) => string)[] = [
  (n) => (n ? `Back to planning, ${n}?` : "Back to planning?"),
  (n) => (n ? `What's next, ${n}?` : "What's next?"),
  () => "Checking on a requirement?",
  () => "Where are we headed this semester?",
];

// The pure-reasoning gap only. A tool in flight says what it is doing instead.
const THINKING_PHRASES = [
  "Consulting the audit",
  "Cross-checking blocks",
  "Flipping through requirements",
  "Wrangling credits",
  "Squinting at course codes",
  "Reading the core's fine print",
  "Counting your credits twice",
  "Petitioning the registrar",
  "Comparing section times",
  "Channeling your advisor",
];

const TOOL_PHRASES: Record<string, string> = {
  search_catalog: "Searching the catalog",
  list_attributes: "Checking attribute codes",
  recall_memory: "Recalling what I know",
  save_memory: "Saving a memory",
  forget_memory: "Updating my memory",
  run_what_if: "Running a what-if audit",
};

// The intake conversation lives in session storage only; saved chats are in
// chatHistory. SESSION_KEY also holds a pre-history conversation, restored once.
const SESSION_KEY = "chat_messages";
const ONBOARDING_MODE_KEY = "chat_onboarding_mode";
const SHOW_CONTINUE_KEY = "chat_show_continue";
const INTAKE_KEYS = [SESSION_KEY, ONBOARDING_MODE_KEY, SHOW_CONTINUE_KEY];

export default function AuditChat({
  onOpenSettings,
  pendingAsk,
  onAskTaken,
}: {
  onOpenSettings: () => void;
  pendingAsk?: { id: number; text: string } | null; // asked from the Plan, sent here as a turn
  onAskTaken?: () => void;
}) {
  const auditSummary = useAuditSummary();
  const history = useChatHistory();
  const log = useLogScroll();

  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [turnError, setTurnError] = useState<string | null>(null);
  const [turnNotice, setTurnNotice] = useState<"tool-cap" | "truncated" | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deleted, setDeleted] = useState<SavedChat | null>(null); // undo beats confirm

  const [hasKey, setHasKey] = useState(false);
  const [catalogCount, setCatalogCount] = useState(0);
  const [auditText, setAuditText] = useState<string | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditExpired, setAuditExpired] = useState(false);
  const [profile, setProfile] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  // Local-only, for [NAME] / [ADVISOR_EMAIL] substitution at render.
  const [names, setNames] = useState({ firstName: null as string | null, advisorEmail: null as string | null, advisorName: null as string | null });

  // Nothing paints in the empty state until restore and the onboarding check
  // resolve, so first launch never flashes suggestions before the setup steps.
  const [welcomeDecided, setWelcomeDecided] = useState(false);
  const [showWelcomeCard, setShowWelcomeCard] = useState(false);
  const [onboardingMode, setOnboardingMode] = useState(false);
  // SAVES_DONE marks the intake's final turn; its AI_DONE shows Continue.
  const onboardingFinalizedRef = useRef(false);
  const [showContinueButton, setShowContinueButton] = useState(false);
  const [justOnboarded, setJustOnboarded] = useState(false);

  const [thinkingPhrase, setThinkingPhrase] = useState(THINKING_PHRASES[0]);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const toastCounter = useRef(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const historyButtonRef = useRef<HTMLButtonElement>(null);
  const pinNextRef = useRef(false);
  const landAtEndRef = useRef(false);
  const restoredCountRef = useRef(0); // restored messages render without an entrance
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const loadingRef = useRef(false);
  loadingRef.current = loading;
  const intake = onboardingMode || showContinueButton;
  const intakeRef = useRef(intake);
  intakeRef.current = intake;

  // ─── The transcript's mutations, shared by the stream and the broadcasts ───

  function appendDelta(delta: string) {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === "assistant" && !last.systemAction) {
        return [...prev.slice(0, -1), { ...last, content: last.content + delta }];
      }
      return [...prev, { role: "assistant", content: delta, timestamp: new Date().toISOString() }];
    });
  }

  function finishTurn() {
    setLoading(false);
    // A turn of tool calls with no text leaves an empty bubble; drop it unless
    // it carries chips, which show the search happened.
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === "assistant" && !last.systemAction && !last.content.trim() && !(last.toolEvents ?? []).length) {
        return prev.slice(0, -1);
      }
      return prev;
    });
    if (onboardingFinalizedRef.current) {
      onboardingFinalizedRef.current = false;
      setShowContinueButton(true);
    }
  }

  const stream = usePacedStream(appendDelta, finishTurn);

  // ─── Mount: what the panel knows ───────────────────────────────────────────

  useEffect(() => {
    chrome.runtime.sendMessage({ type: "GET_AUDIT_TEXT" }, (res) => res?.text && setAuditText(res.text));
    chrome.runtime.sendMessage({ type: "GET_PROFILE" }, (res) => res?.profile && setProfile(res.profile));
    const readNames = () =>
      chrome.storage.local.get(["studentFirstName", "studentAdvisorEmail", "studentAdvisorName"], (r) =>
        setNames({
          firstName: (r.studentFirstName as string) ?? null,
          advisorEmail: (r.studentAdvisorEmail as string) ?? null,
          advisorName: (r.studentAdvisorName as string) ?? null,
        })
      );
    readNames();
    chrome.storage.local.get(["anthropicApiKey", "catalogCourseCount"], (r) => {
      setHasKey(typeof r.anthropicApiKey === "string" && r.anthropicApiKey.length > 0);
      setCatalogCount((r.catalogCourseCount as number) ?? 0);
    });
    const onStorage = (changes: { [k: string]: chrome.storage.StorageChange }, area: string) => {
      if (area !== "local") return;
      if (changes.anthropicApiKey) {
        const v = changes.anthropicApiKey.newValue;
        setHasKey(typeof v === "string" && v.length > 0);
      }
      if (changes.catalogCourseCount) setCatalogCount((changes.catalogCourseCount.newValue as number) ?? 0);
      if (changes.studentFirstName || changes.studentAdvisorEmail || changes.studentAdvisorName) readNames();
    };
    chrome.storage.onChanged.addListener(onStorage);
    return () => chrome.storage.onChanged.removeListener(onStorage);
  }, []);

  // Restore once history has loaded: an intake in progress, else the active
  // chat, else a conversation from before saved chats existed.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (!history.ready || restoredRef.current) return;
    restoredRef.current = true;
    chrome.storage.session.get(INTAKE_KEYS, (r) => {
      const saved = r[SESSION_KEY] as ConversationMessage[] | undefined;
      const inIntake = !!r[ONBOARDING_MODE_KEY] || !!r[SHOW_CONTINUE_KEY];
      const restore = (msgs: ConversationMessage[]) => {
        landAtEndRef.current = true;
        restoredCountRef.current = msgs.length;
        setMessages(msgs);
        setWelcomeDecided(true);
      };
      if (inIntake && saved?.length) {
        setOnboardingMode(!!r[ONBOARDING_MODE_KEY]);
        setShowContinueButton(!!r[SHOW_CONTINUE_KEY]);
        return restore(saved);
      }
      if (history.active?.messages.length) return restore(history.active.messages);
      if (saved?.length) {
        chrome.storage.session.remove(INTAKE_KEYS);
        return restore(saved);
      }
      chrome.runtime.sendMessage({ type: "GET_ONBOARDING_STATE" }, (s) => {
        const completedAt = (s?.completedAt as number | null) ?? null;
        chrome.runtime.sendMessage({ type: "GET_MEMORIES" }, (m) => {
          const count = Array.isArray(m?.memories) ? m.memories.length : 0;
          if (count === 0 && completedAt === null) setShowWelcomeCard(true);
          setWelcomeDecided(true);
        });
      });
    });
  }, [history.ready, history.active]);

  // Persist: the intake to session storage as it goes; a normal chat to saved
  // chats whenever a turn settles (not every streamed frame).
  const { save } = history;
  useEffect(() => {
    if (!restoredRef.current || messages.length === 0) return;
    if (intake) {
      chrome.storage.session.set({
        [SESSION_KEY]: messages,
        [ONBOARDING_MODE_KEY]: onboardingMode,
        [SHOW_CONTINUE_KEY]: showContinueButton,
      });
    } else if (!loading) {
      save(messages);
    }
  }, [messages, loading, intake, onboardingMode, showContinueButton, save]);

  // Closing the panel stops the worker spending tokens; the partial answer is kept.
  useEffect(
    () => () => {
      if (loadingRef.current) {
        chrome.runtime.sendMessage({ type: "CANCEL_AI_CHAT" });
        if (!intakeRef.current && messagesRef.current.length) save(messagesRef.current);
      }
    },
    [save]
  );

  // Give focus back after a turn if the Stop/Send swap took it.
  const wasLoadingRef = useRef(false);
  useEffect(() => {
    if (wasLoadingRef.current && !loading) textareaRef.current?.focus();
    wasLoadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    if (!deleted) return;
    const t = setTimeout(() => setDeleted(null), 6000);
    return () => clearTimeout(t);
  }, [deleted]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast((c) => (c?.id === toast.id ? null : c)), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!loading) return;
    const pick = (not?: string) => {
      let next = not;
      while (next === not) next = THINKING_PHRASES[Math.floor(Math.random() * THINKING_PHRASES.length)];
      return next!;
    };
    setThinkingPhrase(pick());
    const t = setInterval(() => setThinkingPhrase((prev) => pick(prev)), 2500);
    return () => clearInterval(t);
  }, [loading]);

  // ─── Worker broadcasts ─────────────────────────────────────────────────────

  useEffect(() => {
    const markSaves = (fn: (m: ConversationMessage & { systemAction: NonNullable<ConversationMessage["systemAction"]> }) => ConversationMessage) =>
      setMessages((prev) => {
        for (let i = prev.length - 1; i >= 0; i--) {
          const m = prev[i];
          if (m.systemAction?.kind !== "onboarding-saves") continue;
          return [...prev.slice(0, i), fn(m as Parameters<typeof fn>[0]), ...prev.slice(i + 1)];
        }
        return prev;
      });

    const listener = (message: { type: string; [k: string]: any }) => {
      switch (message.type) {
        case "AI_CHUNK":
          stream.push(message.delta);
          break;
        case "AI_DONE":
          stream.done();
          break;
        case "AI_ERROR":
          stream.flush();
          setTurnError(String(message.error ?? "Unknown error"));
          setLoading(false);
          break;
        case "AI_NOTICE":
          setTurnNotice(message.kind === "tool-cap" ? "tool-cap" : "truncated");
          break;
        case "AI_TOOL_USE": {
          if (message.name === "complete_onboarding") break; // shown by the saves bubble
          stream.flush(); // the chip anchors after the text said before the call
          const event: ToolEvent = { name: message.name, input: message.input ?? {} };
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant" && !last.systemAction) {
              return [...prev.slice(0, -1), { ...last, toolEvents: [...(last.toolEvents ?? []), event] }];
            }
            return [...prev, { role: "assistant", content: "", timestamp: new Date().toISOString(), toolEvents: [event] }];
          });
          break;
        }
        case "AI_TOOL_RESULT":
          if (message.name === "complete_onboarding") break;
          stream.flush();
          // Results arrive in call order, so the newest unresolved chip is this one.
          setMessages((prev) => {
            for (let i = prev.length - 1; i >= 0; i--) {
              const m = prev[i];
              if (m.role !== "assistant" || !m.toolEvents) continue;
              const j = m.toolEvents.map((e) => e.courseCount === undefined).lastIndexOf(true);
              if (j < 0) break;
              const events = m.toolEvents.slice();
              events[j] = {
                ...events[j],
                courseCount: message.courseCount,
                error: message.error, // present only when the tool threw
                ...(message.courses ? { courses: message.courses } : {}), // panel-only (ADR 0037)
              };
              return [...prev.slice(0, i), { ...m, toolEvents: events }, ...prev.slice(i + 1)];
            }
            return prev;
          });
          break;
        case "AUDIT_TEXT_READY":
          setAuditText(message.text);
          setAuditError(null);
          break;
        case "AUDIT_LOADING":
          setAuditError(null);
          setAuditExpired(false);
          break;
        case "AUDIT_EXPIRED":
          setAuditExpired(true);
          setAuditError(null);
          break;
        case "AUDIT_ERROR":
          setAuditError(message.error ?? "Audit fetch failed");
          break;
        case "PROFILE_LOADING":
          setProfileLoading(true);
          break;
        case "PROFILE_READY":
          setProfile(message.profile);
          setProfileLoading(false);
          break;
        case "PROFILE_ERROR":
          setProfileLoading(false);
          break;
        case "AI_CURATOR_SAVED":
          toastCounter.current += 1;
          setToast({ id: toastCounter.current, text: typeof message.description === "string" ? message.description : "memory saved" });
          break;
        case "ONBOARDING_SAVES_START": {
          stream.flush();
          const items: SystemActionItem[] = (Array.isArray(message.items) ? message.items : []).map(
            (o: { type?: string; description?: string; sourceQuote?: string }) => ({
              type: (o.type as MemoryType) ?? "note",
              description: o.description ?? "",
              sourceQuote: o.sourceQuote,
              status: "pending" as const,
            })
          );
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "", timestamp: new Date().toISOString(), systemAction: { kind: "onboarding-saves", items, done: false } },
          ]);
          break;
        }
        case "ONBOARDING_SAVE_COMMITTED": {
          const idx = typeof message.index === "number" ? message.index : -1;
          if (idx < 0) break;
          markSaves((m) => {
            if (idx >= m.systemAction.items.length) return m;
            const items = m.systemAction.items.slice();
            items[idx] = { ...items[idx], status: "saved" };
            return { ...m, systemAction: { ...m.systemAction, items } };
          });
          break;
        }
        case "ONBOARDING_SAVES_DONE":
          markSaves((m) => ({ ...m, systemAction: { ...m.systemAction, done: true } }));
          setOnboardingMode(false);
          onboardingFinalizedRef.current = true;
          break;
        case "ONBOARDING_COMPLETED":
          setShowWelcomeCard(false);
          setOnboardingMode(false);
          break;
        case "ONBOARDING_RESET":
          restoredCountRef.current = 0;
          setMessages([]);
          setOnboardingMode(false);
          onboardingFinalizedRef.current = false;
          setShowContinueButton(false);
          setShowWelcomeCard(true);
          chrome.storage.session.remove(INTAKE_KEYS);
          break;
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [stream]);

  // ─── Scroll ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (landAtEndRef.current) {
      landAtEndRef.current = false;
      log.landAtEnd();
    }
    if (pinNextRef.current) {
      pinNextRef.current = false;
      log.pinLastUserTurn();
    }
    // The log's functions read refs; `messages` is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  useEffect(() => {
    if (showContinueButton) log.scrollToBottom(true); // it must be seen to be pressed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showContinueButton]);

  // ─── Actions ───────────────────────────────────────────────────────────────

  function dispatch(msgs: ConversationMessage[], mode: "onboarding" | "normal") {
    chrome.runtime.sendMessage({
      type: "AI_CHAT",
      messages: conversationalOnly(msgs), // only real turns reach the model (ADR 0028)
      auditText: auditText ?? "",
      profile: profile ?? "",
      mode,
    });
  }

  function sendMessage(text: string, modeOverride?: "onboarding" | "normal") {
    if (!text.trim() || loading) return;
    const next = [...messages, { role: "user" as const, content: text.trim(), timestamp: new Date().toISOString() }];
    setMessages(next);
    setInput("");
    setLoading(true);
    setTurnError(null);
    setTurnNotice(null);
    setHistoryOpen(false);
    pinNextRef.current = true;
    dispatch(next, modeOverride ?? (onboardingMode ? "onboarding" : "normal"));
  }

  // Re-send the failed turn without appending it again.
  function retryTurn() {
    if (loading) return;
    setTurnError(null);
    setTurnNotice(null);
    setLoading(true);
    log.pinLastUserTurn();
    dispatch(messages, onboardingMode ? "onboarding" : "normal");
  }

  function cancelStream() {
    stream.flush(); // Stop means stop, not keep trickling out the backlog
    chrome.runtime.sendMessage({ type: "CANCEL_AI_CHAT" });
  }

  function startOnboarding() {
    setShowWelcomeCard(false);
    setOnboardingMode(true);
    chrome.storage.local.remove("onboarding_save_queue"); // a stale queue from an aborted intake
    sendMessage("Hi! I'd like to get started.", "onboarding");
  }

  function skipOnboarding() {
    setShowWelcomeCard(false);
    chrome.storage.local.remove("onboarding_save_queue");
    chrome.runtime.sendMessage({ type: "SET_ONBOARDING_COMPLETED" });
  }

  // The intake's output is the memories; its transcript clears to a fresh chat.
  function continueToChat() {
    setShowContinueButton(false);
    onboardingFinalizedRef.current = false;
    restoredCountRef.current = 0;
    setMessages([]);
    chrome.storage.session.remove(INTAKE_KEYS);
    setJustOnboarded(true);
    textareaRef.current?.focus();
  }

  function clearScreen() {
    if (loading) cancelStream();
    setMessages([]);
    setTurnError(null);
    setTurnNotice(null);
    restoredCountRef.current = 0;
    log.resetPin();
  }

  const closeHistory = useCallback(() => {
    setHistoryOpen(false);
    historyButtonRef.current?.focus();
  }, []);

  function newChat() {
    clearScreen();
    history.startNew();
    setHistoryOpen(false);
    textareaRef.current?.focus();
  }

  function openChat(id: string) {
    const chat = history.open(id);
    setHistoryOpen(false);
    if (!chat) return;
    clearScreen();
    landAtEndRef.current = true;
    restoredCountRef.current = chat.messages.length;
    setMessages(chat.messages);
  }

  function deleteChat(id: string) {
    setDeleted(history.chats.find((c) => c.id === id) ?? null);
    if (id === history.activeId) clearScreen();
    history.remove(id);
    if (history.chats.length <= 1) closeHistory();
  }

  const noKeyYet = welcomeDecided && !hasKey;

  useEffect(() => {
    if (!pendingAsk || !welcomeDecided || loading || showContinueButton) return;
    sendMessage(pendingAsk.text);
    onAskTaken?.();
    // The id is what makes a repeat ask fire; sendMessage reads current state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAsk?.id, welcomeDecided, loading, showContinueButton]);

  // ─── The ram and its bubble ────────────────────────────────────────────────

  // The one tool call awaiting its result drives both the pose and the bubble,
  // so the two can never disagree about what Fordhawke is doing.
  const last = messages[messages.length - 1];
  const inFlightTool =
    loading && last?.role === "assistant" && !last.systemAction
      ? (last.toolEvents ?? []).find((e) => e.courseCount === undefined && e.error === undefined)
      : undefined;
  const desiredBeat: Beat | null = !loading
    ? null
    : last?.role === "assistant" && !last.systemAction && last.content.trim() !== ""
    ? null // the growing answer is its own indicator
    : inFlightTool
    ? { pose: inFlightTool.name === "run_what_if" ? "whatif" : "reading", toolPhrase: TOOL_PHRASES[inFlightTool.name] ?? null }
    : { pose: "ponder", toolPhrase: null };
  const reducedMotion = usePrefersReducedMotion();
  const displayedBeat = useMascotDirector(desiredBeat, loading, reducedMotion);
  const mascotActivity: MascotState | null = displayedBeat?.pose ?? null;
  const statusPhrase = bubblePhrase(displayedBeat, desiredBeat, thinkingPhrase);

  const emptyChat = messages.length === 0;
  const greetingIndexRef = useRef(Math.floor(Math.random() * GREETINGS.length));
  const greeting = useMemo(() => (emptyChat ? GREETINGS[greetingIndexRef.current](names.firstName) : ""), [emptyChat, names.firstName]);

  const status = auditText
    ? profileLoading
      ? "Building your student profile…"
      : catalogCount > 0
      ? `Audit loaded · ${catalogCount.toLocaleString()} courses in catalog`
      : "Audit loaded"
    : "";

  return (
    <div className="flex h-full flex-col">
      <ChatBar
        status={status}
        busy={loading || profileLoading}
        chatCount={intake ? 0 : history.chats.length}
        historyOpen={historyOpen}
        onToggleHistory={() => (historyOpen ? closeHistory() : setHistoryOpen(true))}
        onNew={newChat}
        canNew={!intake && (!emptyChat || !!turnError)}
        historyButtonRef={historyButtonRef}
      />

      {auditError ? (
        <div className="mx-3 mt-2 shrink-0">
          <Notice severity="error" title="Audit refresh failed" body={auditError} action={{ label: "Open DegreeWorks", href: DEGREEWORKS_URL }} />
        </div>
      ) : auditExpired ? (
        <div className="mx-3 mt-2 shrink-0">
          <Notice
            severity="warn"
            title="DegreeWorks session expired — log in again and the audit refreshes itself"
            action={{ label: "Open DegreeWorks", href: DEGREEWORKS_URL }}
          />
        </div>
      ) : !auditText && welcomeDecided && !showWelcomeCard ? (
        <div className="mx-3 mt-2 shrink-0">
          <Notice severity="info" title="No audit loaded — open DegreeWorks and it loads itself" action={{ label: "Open DegreeWorks", href: DEGREEWORKS_URL }} />
        </div>
      ) : null}

      <div className="relative flex-1 overflow-hidden">
        {historyOpen && (
          <ChatHistory chats={history.chats} activeId={history.activeId} onOpen={openChat} onDelete={deleteChat} onClose={closeHistory} />
        )}
        {!log.isAtBottom && (
          <button
            onClick={() => log.scrollToBottom()}
            aria-label="Jump to latest"
            className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full bg-fordham-maroon/90 px-2.5 py-1.5 text-xs font-medium text-white shadow-lift-2 backdrop-blur-sm hover:bg-fordham-maroon"
          >
            <span aria-hidden>↓</span>
            <span>Latest</span>
          </button>
        )}
        {/* The resident holds the corner over the log, not in it. He fades while
            the student reads back up the history, and so does his bubble. */}
        <ResidentMascot activity={mascotActivity} className={`mascot-resident transition-opacity duration-300 ${log.isAtBottom ? "opacity-100" : "opacity-0"}`} />
        {statusPhrase && (
          <div aria-hidden className={`thought-bubble animate-msg-in transition-opacity duration-300 ${log.isAtBottom ? "opacity-100" : "opacity-0"}`}>
            <div className="rounded-2xl rounded-br-md bg-raised px-3 py-1.5 shadow-lift">
              <p className="shimmer-text text-[13px] italic leading-snug">{statusPhrase}…</p>
            </div>
            <span className="thought-dot thought-dot--1 bg-raised shadow-lift" />
            <span className="thought-dot thought-dot--2 bg-raised shadow-lift" />
          </div>
        )}
        {statusPhrase && <span className="sr-only">Advisor is thinking</span>}

        <div
          ref={log.containerRef}
          className="h-full overflow-y-auto p-3"
          role="log"
          aria-live={loading ? "off" : "polite"} // one announcement per finished turn, not per chunk
          aria-atomic="false"
          aria-label="Advisor conversation"
        >
          <div ref={log.contentRef} className="space-y-3">
            {emptyChat && welcomeDecided && showWelcomeCard && (
              <FirstRun
                hasKey={hasKey}
                hasAudit={!!auditText}
                hasCatalog={catalogCount > 0}
                onOpenSettings={onOpenSettings}
                onStart={startOnboarding}
                onSkip={skipOnboarding}
              />
            )}

            {emptyChat && welcomeDecided && !showWelcomeCard && (
              <div className="animate-msg-in pt-4">
                {justOnboarded && <p className="mb-3 text-xs text-ink-3">Onboarding complete — memories saved · view them in Settings</p>}
                <p className="mb-4 font-serif text-[26px] font-medium leading-tight text-ink">{greeting}</p>
                {auditSummary ? (
                  <WhereYouStand summary={auditSummary} onAsk={(t) => sendMessage(t)} />
                ) : (
                  <div className="card divide-y divide-line overflow-hidden">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => sendMessage(s)}
                        className="focus-ring block w-full px-3.5 py-2.5 text-left text-sm text-ink-2 transition-colors hover:text-fordham-maroon active:bg-ink/[0.04] dark:hover:text-fordham-maroon-ink"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {messages.map((msg, i) => (
              <Message
                key={i}
                message={msg}
                enter={i >= restoredCountRef.current}
                firstName={names.firstName}
                advisorEmail={names.advisorEmail}
                advisorName={names.advisorName}
              />
            ))}

            {turnError &&
              (() => {
                const copy = describeTurnError(turnError);
                return (
                  <Notice
                    severity="error"
                    title={copy.title}
                    body={turnError}
                    action={copy.fix === "settings" ? { label: "Open Settings", onClick: onOpenSettings } : { label: "Retry", onClick: retryTurn }}
                    onDismiss={() => setTurnError(null)}
                  />
                );
              })()}
            {turnNotice && (
              <Notice
                severity="info"
                title={turnNotice === "tool-cap" ? "Paused before finishing: too many lookups for one answer." : "The answer was cut off at its length limit."}
                action={{
                  label: "Continue",
                  onClick: () => {
                    setTurnNotice(null);
                    sendMessage("Continue");
                  },
                }}
                onDismiss={() => setTurnNotice(null)}
              />
            )}

            {showContinueButton && (
              <div className="flex justify-center pb-1 pt-2">
                <button
                  onClick={continueToChat}
                  className="focus-ring rounded-full bg-fordham-maroon px-4 py-2 text-sm font-medium text-white shadow-lift transition-[background-color,transform] duration-200 ease-spring hover:bg-fordham-maroon/90 active:scale-95"
                >
                  Continue to chat →
                </button>
              </div>
            )}
          </div>
          <div ref={log.floorRef} aria-hidden className="shrink-0" style={{ height: FLOOR_MIN }} />
          <div ref={log.bottomRef} />
        </div>
      </div>

      {deleted && (
        <div role="status" className="flex shrink-0 items-center gap-2 px-3 pb-1 text-xs text-ink-2">
          <span className="min-w-0 flex-1 truncate">Deleted “{deleted.title}”</span>
          <button
            onClick={() => {
              history.restore(deleted);
              setDeleted(null);
            }}
            className="focus-ring rounded px-1 font-medium text-fordham-maroon hover:underline dark:text-fordham-maroon-ink"
          >
            Undo
          </button>
        </div>
      )}
      {toast && (
        <div className="shrink-0 px-3 pb-1">
          <p
            key={toast.id}
            className="animate-toast-pop truncate border-l-2 border-fordham-maroon py-0.5 pl-2 text-[11px] leading-relaxed text-ink-2 dark:border-fordham-maroon-ink"
          >
            <span className="font-semibold">Saved</span> · {toast.text}
          </p>
        </div>
      )}

      <Composer
        value={input}
        onChange={setInput}
        onSend={() => sendMessage(input)}
        onStop={cancelStream}
        loading={loading}
        disabled={showContinueButton || noKeyYet}
        placeholder={showContinueButton ? "Press Continue to start chat…" : noKeyYet ? "Add your API key in Settings to start" : "Ask anything…"}
        textareaRef={textareaRef}
      />
    </div>
  );
}
