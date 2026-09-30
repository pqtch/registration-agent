// Implements: ADR 0031 (native-app surface grammar — grouped settings)
// Implements: ADR 0032 (the Claude-app dialect)
import { useState, useEffect, type ReactNode } from "react";
import type { MemoryEntry } from "../../shared/types";
import Notice from "../components/Notice";
import { memoryTypeStyle } from "../components/memoryTypeStyles";
import { personalize } from "../personalize";
import {
  applyTheme,
  loadThemePreference,
  saveThemePreference,
  type ThemePreference,
} from "../theme";
import { useMascotSize } from "../components/Mascot";
import { useCatalog, loadCatalogTerm, clearCatalogError } from "../useCatalog";



export default function Settings() {
  const [apiKey, setApiKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  // Collapsed key card (ADR 0032): once a key exists the input row hides —
  // a settled setting shouldn't keep offering its empty form. "Replace"
  // reopens it.
  const [replacingKey, setReplacingKey] = useState(false);

  const [profile, setProfile] = useState<string | null>(null);
  const [profileDate, setProfileDate] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [auditText, setAuditText] = useState<string | null>(null);
  const [showAudit, setShowAudit] = useState(false);

  const catalog = useCatalog();
  const [selectedTerm, setSelectedTerm] = useState<string>("");

  // Long-term memory state. Provisional entries still accumulate internally
  // (the curator uses them for promotion tracking) but are deliberately not
  // exposed in the UI — they're developer-only implementation detail.
  const [memories, setMemories] = useState<MemoryEntry[]>([]);

  // Auto-save toggle: when ON (default), the Haiku curator runs after each
  // chat turn and saves durable facts automatically. When OFF, memories only
  // land via onboarding or explicit "remember X" save_memory calls.
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);

  // Per-entry inline edit state. Only one entry is editable at a time.
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraftDescription, setEditDraftDescription] = useState("");
  const [editDraftContent, setEditDraftContent] = useState("");

  // Theme preference: light / dark / system (default).
  const [theme, setTheme] = useState<ThemePreference>("system");
  const [mascotSize, setMascotSize] = useMascotSize();
  const [fordhamSearch, setFordhamSearch] = useState(true);
  useEffect(() => {
    chrome.storage.local.get("fordhamSearch", (r) => setFordhamSearch(r.fordhamSearch !== false));
  }, []);
  const toggleFordhamSearch = () => {
    const next = !fordhamSearch;
    setFordhamSearch(next);
    chrome.storage.local.set({ fordhamSearch: next });
  };

  // [NAME]/[ADVISOR]/[ADVISOR_EMAIL] render-time substitution for the
  // profile card (ADR 0032; Patch-approved). Same storage keys the chat
  // reads; edit mode still edits the RAW placeholder text — the tokens are
  // the stored truth, personalization is a view.
  const [firstName, setFirstName] = useState<string | null>(null);
  const [advisorEmail, setAdvisorEmail] = useState<string | null>(null);
  const [advisorName, setAdvisorName] = useState<string | null>(null);

  // Two-step confirms for the destructive actions. `confirm()` and `alert()`
  // are blocking OS chrome: unthemeable, out of place in a side panel, and
  // they render light in dark mode no matter what `color-scheme` says.
  const [pendingClearAll, setPendingClearAll] = useState(false);
  const [pendingRerun, setPendingRerun] = useState(false);
  const [rerunDone, setRerunDone] = useState(false);

  useEffect(() => {
    loadThemePreference().then(setTheme);
  }, []);

  useEffect(() => {
    // One round trip instead of six — fewer IPC hops, fewer race windows.
    chrome.storage.local.get(
      [
        "anthropicApiKey",
        "auditText",
        "studentProfile",
        "profileGeneratedAt",
        "studentFirstName",
        "studentAdvisorName",
        "studentAdvisorEmail",
      ],
      (r) => {
        const key = r.anthropicApiKey as string | undefined;
        if (key) setMaskedKey(`sk-ant-...${key.slice(-6)}`);
        if (r.auditText) setAuditText(r.auditText as string);
        if (r.studentProfile) setProfile(r.studentProfile as string);
        if (r.profileGeneratedAt) {
          const d = new Date(r.profileGeneratedAt as number);
          setProfileDate(
            d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
          );
        }
        if (r.studentFirstName) setFirstName(r.studentFirstName as string);
        if (r.studentAdvisorName) setAdvisorName(r.studentAdvisorName as string);
        if (r.studentAdvisorEmail) setAdvisorEmail(r.studentAdvisorEmail as string);
      }
    );


    // Load long-term memory list + auto-save toggle state
    chrome.runtime.sendMessage({ type: "GET_MEMORIES" }, (r) => {
      if (Array.isArray(r?.memories)) setMemories(r.memories);
    });
    chrome.runtime.sendMessage({ type: "GET_AUTO_SAVE" }, (r) => {
      if (typeof r?.enabled === "boolean") setAutoSaveEnabled(r.enabled);
    });
  }, []);

  // Listen for profile + catalog updates from the service worker
  useEffect(() => {
    const listener = (msg: any) => {
      if (msg.type === "PROFILE_READY") {
        setProfile(msg.profile);
        setProfileDate(new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }));
        setRefreshing(false);
      } else if (msg.type === "PROFILE_ERROR") {
        setRefreshing(false);
      } else if (msg.type === "MEMORY_UPDATED") {
        if (Array.isArray(msg.memories)) setMemories(msg.memories);
      } else if (msg.type === "AUTO_SAVE_UPDATED") {
        if (typeof msg.enabled === "boolean") setAutoSaveEnabled(msg.enabled);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  function saveKey() {
    if (!apiKey.trim()) return;
    chrome.storage.local.set({ anthropicApiKey: apiKey.trim() }, () => {
      setMaskedKey(`sk-ant-...${apiKey.trim().slice(-6)}`);
      setApiKey("");
      setReplacingKey(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  }

  function clearKey() {
    setReplacingKey(false);
    chrome.storage.local.remove("anthropicApiKey", () => setMaskedKey(null));
  }

  function refreshProfile() {
    setRefreshing(true);
    chrome.runtime.sendMessage({ type: "REFRESH_PROFILE" });
  }

  function startEdit() {
    setEditValue(profile ?? "");
    setEditing(true);
  }

  function saveEdit() {
    const trimmed = editValue.trim();
    if (!trimmed) return;
    setProfile(trimmed);
    setEditing(false);
    // Worker owns the write — it updates storage, cachedProfile, and
    // rebroadcasts PROFILE_READY so the chat sidebar picks up the edit.
    chrome.runtime.sendMessage({ type: "SET_PROFILE", profile: trimmed });
  }

  function cancelEdit() {
    setEditing(false);
    setEditValue("");
  }

  function deleteMemoryEntry(id: number) {
    // Worker owns the write, rebroadcasts MEMORY_UPDATED, listener above
    // re-renders. Optimistic local update keeps the UI responsive.
    setMemories((prev) => prev.filter((m) => m.id !== id));
    chrome.runtime.sendMessage({ type: "DELETE_MEMORY", id });
  }

  function clearAllMemories() {
    setPendingClearAll(false);
    setMemories([]);
    chrome.runtime.sendMessage({ type: "CLEAR_MEMORIES" });
  }

  function toggleAutoSave() {
    const next = !autoSaveEnabled;
    setAutoSaveEnabled(next);
    chrome.runtime.sendMessage({ type: "SET_AUTO_SAVE", enabled: next });
  }

  function selectTheme(next: ThemePreference) {
    setTheme(next);
    applyTheme(next);
    saveThemePreference(next);
  }

  function startMemoryEdit(m: MemoryEntry) {
    setEditingId(m.id);
    setEditDraftDescription(m.description);
    setEditDraftContent(m.content);
  }

  function cancelMemoryEdit() {
    setEditingId(null);
    setEditDraftDescription("");
    setEditDraftContent("");
  }

  function saveMemoryEdit() {
    if (editingId === null) return;
    const description = editDraftDescription.trim();
    const content = editDraftContent.trim();
    if (!description || !content) return;
    // Optimistic local update; the worker will rebroadcast MEMORY_UPDATED.
    setMemories((prev) =>
      prev.map((m) => (m.id === editingId ? { ...m, description, content } : m))
    );
    chrome.runtime.sendMessage({
      type: "EDIT_MEMORY",
      input: { id: editingId, description, content },
    });
    cancelMemoryEdit();
  }

  function rerunOnboarding() {
    setPendingRerun(false);
    // Wipe memories + provisional + session chat, then clear the completion
    // flag so the welcome card shows on the Advisor tab. The service worker
    // rebroadcasts MEMORY_UPDATED + ONBOARDING_RESET; AuditChat listens for
    // the latter and flips back to the welcome card in place, so no
    // close/reopen is needed.
    setMemories([]);
    chrome.runtime.sendMessage({ type: "CLEAR_MEMORIES" });
    chrome.runtime.sendMessage({ type: "CLEAR_PROVISIONAL" });
    chrome.runtime.sendMessage({ type: "RESET_ONBOARDING" });
    chrome.storage.session.clear();
    setRerunDone(true);
  }

  // The picker starts on the loaded term, else Banner's newest.
  const shownTerm = selectedTerm || catalog.term || catalog.terms[0]?.code || "";
  const loadingCatalog = !!catalog.progress;

  function formatCatalogDate(ts: number | null): string {
    return ts ? new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
  }

  return (
    // iOS grouped-settings grammar (ADR 0031): the page is the recessed
    // surface, each group is a raised rounded card of hairline-divided rows,
    // the explainer is a small footer BELOW its card — heading-first
    // documents become label-first controls.
    <div className="h-full space-y-7 overflow-y-auto bg-paper px-4 py-5">

      {/* API Key */}
      <Section
        label="Anthropic API Key"
        footer={
          <>
            Stored locally in your browser, never sent anywhere except
            Anthropic. Get one at{" "}
            <a
              href="https://console.anthropic.com"
              target="_blank"
              rel="noreferrer"
              className="focus-ring rounded underline text-fordham-maroon dark:text-fordham-maroon-ink"
            >
              console.anthropic.com
            </a>.
          </>
        }
      >
        {maskedKey && (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5">
            <span className="text-xs text-ink font-mono truncate">
              {saved ? "Saved ✓" : maskedKey}
            </span>
            <span className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => setReplacingKey((v) => !v)}
                className="focus-ring rounded px-1 text-xs font-medium text-fordham-maroon dark:text-fordham-maroon-ink active:scale-95 transition-transform"
              >
                {replacingKey ? "Cancel" : "Replace"}
              </button>
              <button
                onClick={clearKey}
                className="focus-ring rounded px-1 text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium active:scale-95 transition-transform"
              >
                Remove
              </button>
            </span>
          </div>
        )}
        {/* The input row only exists while there's something to type into it
            (ADR 0032): no key yet, or Replace open. A settled setting doesn't
            keep offering its empty form. */}
        {(!maskedKey || replacingKey) && (
          <div className="flex items-center gap-2 px-4 py-2">
            {/* Borderless field inside the card row — the row IS the field,
                like a grouped-table text cell. */}
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveKey()}
              placeholder={maskedKey ? "Replace key…" : "sk-ant-…"}
              aria-label="Anthropic API key"
              className="focus-ring flex-1 min-w-0 py-1 rounded bg-transparent text-sm font-mono placeholder:text-ink-4"
            />
            <button
              onClick={saveKey}
              disabled={!apiKey.trim()}
              className="focus-ring rounded px-1 text-sm font-medium text-fordham-maroon dark:text-fordham-maroon-ink disabled:opacity-40 active:scale-95 transition-transform"
            >
              {saved ? "Saved ✓" : "Save"}
            </button>
          </div>
        )}
      </Section>

      {/* Student Profile */}
      <Section
        label="Student Profile"
        labelAction={
          <span className="flex items-center gap-3">
            {!editing && profile && (
              <button onClick={startEdit} className="focus-ring rounded px-1 text-xs font-medium text-fordham-maroon dark:text-fordham-maroon-ink active:scale-95 transition-transform">
                Edit
              </button>
            )}
            <button
              onClick={refreshProfile}
              disabled={refreshing || editing}
              className="focus-ring rounded px-1 text-xs font-medium text-fordham-maroon dark:text-fordham-maroon-ink disabled:opacity-40 active:scale-95 transition-transform"
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </span>
        }
        footer={
          <>
            Auto-extracted from your DegreeWorks audit. Injected into every
            chat session as memory.
            {profileDate && <span className="ml-1">Last updated {profileDate}.</span>}
          </>
        }
      >
        {editing ? (
          <div className="px-4 py-3 space-y-2">
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              rows={10}
              aria-label="Student profile"
              className="focus-ring w-full text-xs text-ink bg-sunk rounded-lg p-3 font-mono leading-relaxed resize-none"
            />
            <div className="flex gap-4 justify-end">
              <button
                onClick={cancelEdit}
                className="focus-ring rounded px-1 text-sm text-ink-2 active:scale-95 transition-transform"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={!editValue.trim()}
                className="focus-ring rounded px-1 text-sm font-medium text-fordham-maroon dark:text-fordham-maroon-ink disabled:opacity-40 active:scale-95 transition-transform"
              >
                Save
              </button>
            </div>
          </div>
        ) : profile ? (
          /* Rendered personalized (ADR 0032): the student reads their own
             profile with their own name in it, not [NAME] robot-speak. Edit
             mode above still edits the RAW placeholder text — the tokens are
             what's stored and sent; the substitution is a view. */
          <pre className="px-4 py-3 text-xs text-ink-2 whitespace-pre-wrap font-mono leading-relaxed">
            {personalize(profile, firstName, advisorEmail, advisorName)}
          </pre>
        ) : (
          <div className="px-4 py-3 text-xs text-ink-3">
            No profile yet. Visit your DegreeWorks page to generate one automatically.
          </div>
        )}
      </Section>

      {/* Long-Term Memory */}
      <Section
        label="Long-Term Memory"
        labelAction={
          memories.length > 0 &&
          (pendingClearAll ? (
            <span className="flex items-center gap-2">
              <span className="text-xs text-ink-3">Delete all?</span>
              <button
                onClick={clearAllMemories}
                className="focus-ring rounded-full px-2 py-0.5 text-xs font-medium bg-red-600 text-white hover:bg-red-700 active:scale-95 transition-transform"
              >
                Delete
              </button>
              <button
                onClick={() => setPendingClearAll(false)}
                className="focus-ring rounded px-1 text-xs text-ink-2"
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              onClick={() => setPendingClearAll(true)}
              className="focus-ring rounded px-1 text-xs font-medium text-red-700 dark:text-red-400 active:scale-95 transition-transform"
            >
              Clear All
            </button>
          ))
        }
        footer={
          <>
            Durable facts the advisor has learned about you, injected into
            every chat. Auto-save ON lets the advisor learn from normal
            conversation; OFF limits saves to onboarding and explicit
            "remember this" requests.
          </>
        }
      >
        {/* Auto-save toggle — row title + switch; the explanation lives in
            the section footer, where iOS puts it. */}
        <label className="flex items-center justify-between gap-3 px-4 py-2.5 cursor-pointer">
          <span className="text-sm text-ink">
            Auto-save memories from chat
          </span>
          <Switch on={autoSaveEnabled} onToggle={toggleAutoSave} label="Auto-save memories from chat" />
        </label>

        {memories.length === 0 ? (
          <div className="px-4 py-3 text-xs text-ink-3">
            No memories yet. They'll appear here as you chat — or start by
            completing onboarding in the Advisor tab.
          </div>
        ) : (
          <>
            {memories.map((m) => (
              <div
                key={m.id}
                className="flex items-start gap-2 px-4 py-2.5"
              >
                <div className="flex-1 min-w-0">
                  {/* Payload leads, metadata follows: the description is why
                      the student is reading this row — it wraps instead of
                      truncating behind the type chip. */}
                  {editingId !== m.id && (
                    <p className="text-sm font-medium text-ink leading-snug mb-0.5">
                      {m.description}
                      {/* Same colored chip the onboarding save list uses
                          (memoryTypeStyles, ADR 0032) — one type, one color,
                          everywhere it appears. */}
                      {(() => {
                        const style = memoryTypeStyle(m.type);
                        return (
                          <span
                            className={`ml-1.5 align-middle text-[10px] font-medium px-1.5 py-0.5 rounded-full ${style.bg} ${style.text}`}
                          >
                            {style.label}
                          </span>
                        );
                      })()}
                    </p>
                  )}
                  {editingId === m.id ? (
                    <div className="space-y-1.5">
                      <input
                        type="text"
                        value={editDraftDescription}
                        onChange={(e) => setEditDraftDescription(e.target.value)}
                        placeholder="Description (≤10 words)"
                        aria-label="Memory description"
                        className="focus-ring w-full text-xs px-2 py-1.5 bg-sunk rounded-lg"
                      />
                      <textarea
                        value={editDraftContent}
                        onChange={(e) => setEditDraftContent(e.target.value)}
                        placeholder="Content (1–3 sentences)"
                        rows={3}
                        aria-label="Memory content"
                        className="focus-ring w-full text-xs px-2 py-1.5 bg-sunk rounded-lg resize-none leading-snug"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={cancelMemoryEdit}
                          className="focus-ring rounded px-1 text-xs text-ink-2 hover:underline"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={saveMemoryEdit}
                          disabled={!editDraftDescription.trim() || !editDraftContent.trim()}
                          className="focus-ring text-xs px-2 py-0.5 bg-fordham-maroon text-white rounded disabled:opacity-40"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-ink-2 leading-snug">{m.content}</p>
                      {/* ADR 0015: this quote exists so the student can VERIFY
                          the memory against what they remember saying. It is
                          evidence, so it is set like evidence — not shrunk to
                          10px grey italic like a disclaimer nobody reads. */}
                      {m.sourceQuote && (
                        <p className="text-xs text-ink-2 leading-snug mt-1.5 pl-2 border-l-2 border-line-2">
                          you said: “{m.sourceQuote}”
                        </p>
                      )}
                    </>
                  )}
                </div>
                {editingId === m.id ? null : (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => startMemoryEdit(m)}
                      className="focus-ring rounded inline-flex items-center justify-center min-w-6 min-h-6 text-xs text-ink-2 hover:text-fordham-maroon dark:hover:text-fordham-maroon-ink"
                      aria-label={`Edit memory: ${m.description}`}
                      title="Edit"
                    >
                      <span aria-hidden>✎</span>
                    </button>
                    <button
                      onClick={() => deleteMemoryEntry(m.id)}
                      className="focus-ring rounded inline-flex items-center justify-center min-w-6 min-h-6 text-xs text-ink-2 hover:text-red-700 dark:hover:text-red-400"
                      aria-label={`Delete memory: ${m.description}`}
                      title="Delete"
                    >
                      <span aria-hidden>×</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {/* Destructive row, iOS-style: red text row at the bottom of the
            group; two-step confirm swaps the row in place. */}
        {rerunDone ? (
          <div className="px-4 py-2.5">
            <Notice
              severity="info"
              title="Onboarding reset"
              body="Head to the Advisor tab — the welcome card is back."
              onDismiss={() => setRerunDone(false)}
            />
          </div>
        ) : pendingRerun ? (
          <div className="px-4 py-3 space-y-2">
            <p className="text-xs text-ink leading-snug">
              This deletes everything the advisor has learned about you and
              restarts the intake. Your audit, API key, and catalog stay intact.
            </p>
            <div className="flex gap-3 items-center">
              <button
                onClick={rerunOnboarding}
                className="focus-ring rounded-full px-3 py-1 text-xs font-medium bg-red-600 text-white hover:bg-red-700 active:scale-95 transition-transform"
              >
                Delete memories and re-run
              </button>
              <button
                onClick={() => setPendingRerun(false)}
                className="focus-ring rounded px-1 text-xs text-ink-2"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setPendingRerun(true)}
            className="focus-ring w-full text-left px-4 py-2.5 group"
          >
            <span className="block text-sm font-medium text-red-600 dark:text-red-400 group-active:scale-[0.98] origin-left transition-transform">
              Re-run Onboarding
            </span>
            <span className="block text-xs text-ink-3 mt-0.5">
              Wipes memories and restarts the intake. Audit, key, and catalog stay.
            </span>
          </button>
        )}
      </Section>

      {/* Course Catalog */}
      <Section
        label="Course Catalog"
        footer={
          <>
            Real Fordham sections from Banner — CRNs, meeting times, seats.
            The advisor searches this when recommending courses.{" "}
            {catalog.term && catalog.courses.length > 0 ? (
              <>
                {catalog.courses.length.toLocaleString()} courses loaded for {catalog.termLabel ?? catalog.term}
                {catalog.updatedAt && ` · ${formatCatalogDate(catalog.updatedAt)}`}.
              </>
            ) : (
              !loadingCatalog && !catalog.error && <>No catalog loaded yet. Pick a term and choose Load (about a minute).</>
            )}
          </>
        }
      >
        <div className="flex items-center gap-2 px-4 py-2">
          <select
            value={shownTerm}
            onChange={(e) => setSelectedTerm(e.target.value)}
            disabled={loadingCatalog || catalog.terms.length === 0}
            aria-label="Catalog term"
            className="focus-ring min-w-0 flex-1 rounded bg-transparent py-1 text-sm text-ink disabled:opacity-40"
          >
            {catalog.terms.length === 0 && <option value="">Loading terms…</option>}
            {catalog.terms.map((t) => (
              <option key={t.code} value={t.code}>
                {t.description}
              </option>
            ))}
          </select>
          <button
            onClick={() => shownTerm && loadCatalogTerm(shownTerm)}
            disabled={loadingCatalog || !shownTerm}
            className="focus-ring rounded px-1 text-sm font-medium text-fordham-maroon transition-transform active:scale-95 disabled:opacity-40 dark:text-fordham-maroon-ink"
          >
            {loadingCatalog ? "Loading…" : shownTerm === catalog.term ? "Refresh" : "Load"}
          </button>
        </div>

        {catalog.progress && (
          <div className="px-4 py-2.5">
            <div className="mb-1.5 flex justify-between text-xs tabular-nums text-ink-3">
              <span>Loading sections</span>
              <span>
                {catalog.progress.done} / {catalog.progress.total}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-sunk">
              <div
                className="h-full rounded-full bg-fordham-maroon transition-[width] duration-200 ease-spring dark:bg-fordham-maroon-ink"
                style={{ width: `${catalog.progress.total > 0 ? Math.round((catalog.progress.done / catalog.progress.total) * 100) : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* An expired session says where to recover; an opaque failure says so
            instead of offering a retry that fails the same way (ADR 0029). */}
        {catalog.error?.expired && catalog.error.recoveryUrl ? (
          <div className="px-4 py-2.5">
            <Notice
              severity="warn"
              title="Fordham registration session expired"
              body={catalog.error.message}
              action={{ label: "Open Browse Classes", href: catalog.error.recoveryUrl }}
              onDismiss={clearCatalogError}
            />
          </div>
        ) : catalog.error ? (
          <div className="px-4 py-2.5">
            <Notice severity="error" title="Catalog refresh failed" body={catalog.error.message} onDismiss={clearCatalogError} />
          </div>
        ) : null}
      </Section>
      <Section
        label="Fordham search"
        footer="The advisor can look up program requirements, core rules and registration policy on fordham.edu, and cite the pages it used. Each search costs a cent on your API key, plus the text it reads."
      >
        <label className="flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5">
          <span className="text-sm text-ink">Search fordham.edu</span>
          <Switch on={fordhamSearch} onToggle={toggleFordhamSearch} label="Search fordham.edu" />
        </label>
      </Section>


      {/* Raw Audit Text */}
      <Section
        label="Raw Audit Data"
        labelAction={
          auditText && (
            <button
              onClick={() => setShowAudit((v) => !v)}
              className="focus-ring rounded px-1 text-xs font-medium text-fordham-maroon dark:text-fordham-maroon-ink active:scale-95 transition-transform"
            >
              {showAudit ? "Hide" : "Show"}
            </button>
          )
        }
        footer={
          <>
            The exact text Claude reads from your DegreeWorks page each session.
            {auditText && (
              <span className="ml-1">
                {auditText.length < 1000
                  ? `${auditText.length} chars`
                  : `${Math.round(auditText.length / 1000)}k chars`}{" "}
                · ~{Math.round(auditText.length / 4).toLocaleString()} tokens.
              </span>
            )}
          </>
        }
      >
        {!auditText ? (
          <div className="px-4 py-3 text-xs text-ink-3">
            No audit captured yet. Visit your DegreeWorks page.
          </div>
        ) : showAudit ? (
          <pre className="px-4 py-3 text-xs text-ink-2 whitespace-pre-wrap font-mono leading-relaxed max-h-96 overflow-y-auto">
            {auditText}
          </pre>
        ) : (
          <div className="px-4 py-3 text-xs text-ink-3">
            {auditText.substring(0, 120).trim()}…
          </div>
        )}
      </Section>

      <Section label="Appearance" footer="System follows your operating-system dark-mode setting.">
        <Row label="Theme">
          <Segmented label="Theme" options={["light", "system", "dark"]} value={theme} onChange={selectTheme} />
        </Row>
        <Row label="Fordhawke">
          <Segmented label="Fordhawke size" options={["off", "normal", "large"]} value={mascotSize} onChange={setMascotSize} />
        </Row>
      </Section>

      {/* About — footer-only, like the fine print at the bottom of an iOS
          settings page. */}
      <p className="px-4 pb-2 text-xs text-ink-2 leading-relaxed">
        RamPlan reads your DegreeWorks audit and uses Claude AI (Sonnet for
        chat, Haiku for profile extraction) to help you plan your courses.
        All data is stored locally in your browser.
      </p>

    </div>
  );
}

// A switch is state, not an accent: neutral ink, never maroon (ADR 0032).
function Switch({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      onClick={onToggle}
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`focus-ring relative inline-flex h-6 w-10 shrink-0 rounded-full transition-colors duration-200 ${on ? "bg-ink" : "bg-line-2"}`}
    >
      <span
        className={`absolute top-0.5 inline-block h-5 w-5 rounded-full shadow-lift transition-transform duration-200 ease-spring ${
          on ? "translate-x-[18px] bg-paper" : "translate-x-0.5 bg-white"
        }`}
      />
    </button>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <span className="w-20 shrink-0 text-sm text-ink">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

// The header nav's segmented-control grammar, as a radio group.
function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-lg bg-sunk p-0.5">
      {options.map((o) => (
        <button
          key={o}
          role="radio"
          aria-checked={value === o}
          onClick={() => onChange(o)}
          className={`focus-ring flex-1 rounded-md py-1.5 text-xs font-medium capitalize transition-[background-color,color,box-shadow,transform] duration-200 ease-spring active:scale-95 ${
            value === o ? "bg-raised text-ink shadow-lift" : "text-ink-2 hover:text-ink"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

// One settings group in the iOS grouped-table grammar: small-caps label
// (optionally with a trailing action), a raised card whose children are
// hairline-divided rows, and the explainer as a footer below the card.
// Implements: ADR 0031.
function Section({
  label,
  labelAction,
  footer,
  children,
}: {
  label: string;
  labelAction?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      {/* Fordham's register is the catalog, not the dashboard: section heads
          are set in the display serif (ADR 0033's personality tier) in maroon
          ink, over a maroon hairline — the way a bulletin heads its sections.
          Tracked grey caps read as generic OS settings. Maroon only WRITES
          via the light/dark ink pair; controls stay neutral (ADR 0032). */}
      <div className="flex items-baseline justify-between gap-3 mx-4 mb-2 pb-1 border-b border-fordham-maroon/25 dark:border-fordham-maroon-ink/30">
        <h2 className="font-serif text-[17px] font-medium leading-tight text-fordham-maroon dark:text-fordham-maroon-ink">
          {label}
        </h2>
        {labelAction}
      </div>
      <div className="card divide-y divide-line overflow-hidden">
        {children}
      </div>
      {footer && (
        <p className="px-4 mt-1.5 text-xs text-ink-2 leading-snug">
          {footer}
        </p>
      )}
    </section>
  );
}
