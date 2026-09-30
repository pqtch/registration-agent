// Dev-only chrome.* mock — the sidebar rendered standalone in a plain tab.
//
// NOT part of the extension build: nothing in manifest.json references
// dev.html, so @crxjs never bundles this. It exists so the UI can be
// rendered, screenshotted, and visually verified without loading the MV3
// extension or touching real DegreeWorks/Banner/Anthropic — every byte of
// data below is fabricated.
//
// Pick a scenario with ?state=…  (see SCENARIOS at the bottom):
//   /src/sidebar/dev.html?state=firstrun        fresh install, 0/3 checks
//   /src/sidebar/dev.html?state=firstrun-mid    key + audit present, 2/3
//   /src/sidebar/dev.html?state=empty           ready, suggestions visible
//   /src/sidebar/dev.html?state=chat            restored conversation
//   /src/sidebar/dev.html?state=whatif          fast run_what_if (pose-hold test)
//   /src/sidebar/dev.html?state=fordham         a fordham.edu search with cited sources (autosend)
//   /src/sidebar/dev.html?state=saves           onboarding save batch bubble
//   /src/sidebar/dev.html?state=error           AI_CHAT replies with AI_ERROR
//   /src/sidebar/dev.html?state=toolcap         AI_CHAT ends at the tool cap
//   /src/sidebar/dev.html?state=audit-expired   warn Notice
//   /src/sidebar/dev.html?state=audit-error     error Notice
//   /src/sidebar/dev.html?state=no-audit        info Notice
//   /src/sidebar/dev.html?state=toast           curator-save toast
//   /src/sidebar/dev.html?state=profile-loading busy status strip
//   /src/sidebar/dev.html?state=plan            Plan tab: 3 kept sections, no overlaps
//   /src/sidebar/dev.html?state=plan-conflict   Plan tab: two sections overlap on Tuesday
//   /src/sidebar/dev.html?state=plan-empty      Plan tab: term loaded, nothing kept
// Plan scenarios open on the Plan tab (&page=plan is implied). Scenarios marked
// `autosend` only show their state after a sent message; tools/shots.sh reads
// that flag (and the scenario list) from window.__RAMPLAN_SCENARIOS.
//
// In `chat`/`empty`, typing a message and pressing Enter plays a canned
// slow stream (tool call in flight ~2.4s, prose ~40ms/word) so mid-stream
// states are reachable interactively. Dark mode comes free: the theme
// default is "system", so emulate prefers-color-scheme (webshot --dark).

import type { ConversationMessage, PanelCourse, PanelSection } from "../../shared/types";
import type { PlannedSection } from "../../shared/plan";
import type { AuditSummary } from "../../background/agent/audit-summary";

type Listener = (msg: unknown) => void;
type Broadcast = { delay: number; msg: Record<string, unknown> };

interface Scenario {
  local: Record<string, unknown>; // chrome.storage.local seed
  session: Record<string, unknown>; // chrome.storage.session seed
  auditText: string | null;
  profile: string | null;
  onboardingCompletedAt: number | null;
  memories: unknown[];
  onLoad?: Broadcast[]; // broadcasts fired after mount
  onChat?: Broadcast[]; // script played when the UI dispatches AI_CHAT
  autosend?: boolean; // the state only exists after a sent message
  page?: "chat" | "plan" | "settings"; // tab to open on
}

// ─── Fabricated data (no real students, no real advisors) ────────────────────

const AUDIT = "Student: [NAME] · BS Computer Science · 96/124 credits (mock)";
const PROFILE =
  "Name: [NAME]\nProgram: BS Computer Science, class of 2027\nStanding: Junior · 96/124 credits\nCore: complete except EP3 + Pluralism\nGPA band: dean's-list range (mock)";

// "Where you stand" for the mock student, consistent with AUDIT and PROFILE:
// 96 of 124 credits, core complete except EP3 and Pluralism. Fabricated.
const SUMMARY: AuditSummary = {
  percentComplete: 77,
  creditsApplied: 96,
  creditsInProgress: null,
  creditsRequired: 124,
  blocks: [
    {
      id: "RA-MOCK-CORE",
      title: "Core Curriculum",
      percentComplete: 88,
      open: [
        { id: "1-7", label: "Eloquentia Perfecta 3", options: [{ subject: "@", number: "@", attributes: ["EP3"] }] },
        { id: "1-9", label: "Pluralism in the U.S.", options: [{ subject: "@", number: "@", attributes: ["PLUR"] }] },
      ],
    },
    {
      id: "RA-MOCK-MAJOR",
      title: "Major in Computer Science",
      percentComplete: 75,
      open: [
        { id: "2-4", label: "Upper-level CISC elective", options: [{ subject: "CISC", number: "4@", attributes: [] }] },
        { id: "2-6", label: "Senior capstone", options: [{ subject: "CISC", number: "4999", attributes: [] }] },
      ],
    },
  ],
  // Already registered for Spring 2027. ARHI 1101 has no section in the audit,
  // and two in the catalog, so the Plan asks which one (never guesses).
  registered: [
    { term: "202720", subject: "CISC", number: "3500", section: "R01", title: "Database Systems", credits: 4, status: "registered" },
    { term: "202720", subject: "MATH", number: "2006", section: "R02", title: "Discrete Mathematics", credits: 4, status: "registered" },
    { term: "202720", subject: "ARHI", number: "1101", section: "", title: "Art History Survey", credits: 3, status: "registered" },
    { term: "202710", subject: "CISC", number: "3400", section: "R01", title: "Operating Systems", credits: 4, status: "in-progress" },
  ],
};

const mt = (days: PanelSection["meetings"][number]["days"], startTime: string, endTime: string, building = "Keating", room = "206") => ({
  days, startTime, endTime, building, room,
});
const EP3 = { code: "EP3", description: "Eloquentia Perfecta 3" };
const PLUR = { code: "PLUR", description: "Pluralism in the U.S." };
const pc = (courseCode: string, title: string, credits: number, s: PanelSection): PanelCourse => ({
  courseCode, title, credits, totalSections: 1, sections: [s],
});
const ps = (crn: string, instructor: string, seats: number, meetings: PanelSection["meetings"], attributes = [EP3]): PanelSection => ({
  crn, instructor, seats, campus: "Rose Hill", mode: "in_person", meetings, attributes,
});

// The four sections behind the chat scenario's EP3 search (its prose names two).
const EP3_RESULTS: PanelCourse[] = [
  pc("ENGL 3014", "Writing the City", 3, ps("41021", "Prof. Example", 6, [mt(["T", "F"], "13:00", "14:15")])),
  pc("COMM 3233", "Rhetoric of Public Life", 3, ps("41388", "Prof. Sample", 3, [mt(["T"], "14:30", "17:15", "Faculty Memorial", "112")])),
  pc("PHIL 3712", "Ethics of Persuasion", 3, ps("41507", "Prof. Placeholder", 2, [mt(["T", "R"], "11:30", "12:45")])),
  pc("THEO 3310", "Faith and Argument", 3, ps("41662", "Prof. Mock", 5, [mt(["T", "R"], "16:00", "17:15", "Dealy", "105")], [EP3, PLUR])),
];

// The three sections behind the canned stream's ethics search.
const ETHICS_RESULTS: PanelCourse[] = [
  pc("PHIL 3000", "Philosophical Ethics", 3, ps("41101", "Prof. Example", 8, [mt(["M", "W", "F"], "09:30", "10:20")], [])),
  pc("PHIL 3004", "Ethics and Technology", 3, ps("41104", "Prof. Sample", 4, [mt(["T", "F"], "10:00", "11:15")], [])),
  pc("PHIL 3009", "Bioethics", 3, ps("41109", "Prof. Mock", 1, [mt(["M", "R"], "16:00", "17:15")], [])),
];

const planned = (c: PanelCourse, addedAt: number): PlannedSection => {
  const sec = c.sections[0];
  return {
    crn: sec.crn, courseCode: c.courseCode, title: c.title, credits: c.credits, instructor: sec.instructor,
    seats: sec.seats, mode: sec.mode, meetings: sec.meetings, attributes: sec.attributes, addedAt,
  };
};
const CISC = pc("CISC 4615", "Data Communications and Networks", 4, ps("41790", "Prof. Example", 9, [mt(["M", "W"], "10:00", "11:15", "John Mulcahy", "310")], []));
const SOCI = pc("SOCI 2400", "Race and Ethnicity", 3, ps("41833", "Prof. Sample", 12, [mt(["M", "R"], "14:30", "15:45", "Dealy", "201")], [PLUR]));
const HIST = pc("HIST 3050", "The City in History", 3, ps("41912", "Prof. Mock", 7, [mt(["T", "R"], "14:00", "15:15")], [PLUR]));
const PLAN: PlannedSection[] = [planned(EP3_RESULTS[0], 1), planned(CISC, 2), planned(SOCI, 3)];
const PLAN_CONFLICT: PlannedSection[] = [
  planned(EP3_RESULTS[0], 1), planned(CISC, 2), planned(EP3_RESULTS[1], 3), planned(HIST, 4),
];

const LOCAL_READY = {
  anthropicApiKey: "sk-ant-dev-mock",
  catalogTerm: "202720",
  catalogTermLabel: "Spring 2027",
  catalogUpdatedAt: 1790778840000,
  auditSummary: SUMMARY,
  catalogCourseCount: 3247,
  studentFirstName: "Ava",
  studentAdvisorName: "Dr. R. Ramsey",
  studentAdvisorEmail: "advisor@example.edu",
  // Settings page reads these straight from storage.local.
  auditText: AUDIT,
  studentProfile: PROFILE,
  profileGeneratedAt: 1751980000000,
};

const MEMORIES = [
  {
    id: 1,
    type: "constraint",
    description: "Works Tuesday/Thursday mornings",
    content: "Ava works a campus job Tuesday and Thursday mornings until 11am, so sections before 11:30 on those days don't fit.",
    sourceQuote: "I work Tuesday and Thursday mornings",
    createdAt: 1751880000000,
    lastAccessedAt: 1751980000000,
  },
  {
    id: 2,
    type: "goal",
    description: "Wants to graduate a semester early",
    content: "Aiming to finish by December 2026 by front-loading core requirements.",
    sourceQuote: "I'd love to be done a semester early if it's possible",
    createdAt: 1751880000000,
    lastAccessedAt: 1751980000000,
  },
  {
    id: 3,
    type: "interest",
    description: "Prefers seminars over lectures",
    content: "Consistently picks discussion-heavy sections when both formats exist.",
    createdAt: 1751880000000,
    lastAccessedAt: 1751980000000,
  },
];

const TERMS = [
  { code: "202720", description: "Spring 2027" },
  { code: "202710", description: "Fall 2026" },
  { code: "202630", description: "Summer 2026" },
  { code: "202620", description: "Spring 2026" },
];

const CHAT_SESSION: ConversationMessage[] = [
  {
    role: "user",
    content: "What core requirements am I still missing?",
    timestamp: "2026-07-09T14:02:11.000Z",
  },
  {
    role: "assistant",
    content:
      "Good news, [NAME] — you're close. Your audit shows **two core requirements** still open:\n\n" +
      "1. **Eloquentia Perfecta 3** — a writing-intensive seminar. Most sections fill early.\n" +
      "2. **Pluralism in the U.S.** — any section carrying the `PLUR` attribute counts.\n\n" +
      "Everything else in the core is complete, including both theology requirements. " +
      "If you want, I can check which EP3 sections still have seats — or you can confirm " +
      "the plan with [ADVISOR] at [ADVISOR_EMAIL].",
    timestamp: "2026-07-09T14:02:26.000Z",
    toolEvents: [
      { name: "recall_memory", input: { ids: [3, 7] }, courseCount: 2 },
    ],
  },
  {
    role: "user",
    content: "Any EP3 sections with open seats on Tuesdays?",
    timestamp: "2026-07-09T14:03:40.000Z",
  },
  {
    role: "assistant",
    content:
      "Four sections match. The two that fit around your 11:30 lab:\n\n" +
      "| Course | Time | Seats |\n|---|---|---|\n" +
      "| ENGL 3014 | T/F 1:00–2:15 | 6 |\n" +
      "| COMM 3233 | T 2:30–5:15 | 3 |\n\n" +
      "COMM 3233 is a once-a-week seminar — heavier reading load, but it keeps " +
      "your Friday clear. Want a what-if audit with either one slotted in?",
    timestamp: "2026-07-09T14:03:58.000Z",
    toolEvents: [
      {
        name: "search_catalog",
        input: { attributes: ["EP3"], days: ["T"], has_seats: true },
        courseCount: 4,
        courses: EP3_RESULTS,
      },
    ],
  },
];

const SAVES_SESSION: ConversationMessage[] = [
  {
    role: "user",
    content: "That's everything about me, I think!",
    timestamp: "2026-07-09T14:05:00.000Z",
  },
  {
    role: "assistant",
    content: "",
    timestamp: "2026-07-09T14:05:10.000Z",
    systemAction: {
      kind: "onboarding-saves",
      done: false,
      items: [
        {
          type: "note",
          description: "Major: Computer Science, class of 2027",
          sourceQuote: "I'm a CS major graduating in 2027",
          status: "saved",
        },
        {
          type: "constraint",
          description: "Works Tuesday/Thursday mornings",
          sourceQuote: "I work Tuesday and Thursday mornings",
          status: "saved",
        },
        {
          type: "interest",
          description: "Prefers seminars over lectures",
          status: "pending",
        },
      ] as never[],
    } as never,
  },
];

// Words streamed for the interactive canned turn.
const STREAM_PROSE = (
  "Here's what I found, [NAME]. Three PHIL sections carry the ethics keyword " +
  "and still have seats this term. PHIL 3000 meets M/W/F at 9:30 with " +
  "Prof. Example — it's the standard pick and it satisfies the values " +
  "seminar slot too. Want the full section table?"
).split(" ");

function chatScript(): Broadcast[] {
  const steps: Broadcast[] = [
    { delay: 500, msg: { type: "AI_TOOL_USE", name: "search_catalog", input: { keyword: "ethics", has_seats: true } } },
    { delay: 2900, msg: { type: "AI_TOOL_RESULT", name: "search_catalog", courseCount: 3, courses: ETHICS_RESULTS } },
  ];
  let t = 3300;
  for (const w of STREAM_PROSE) {
    steps.push({ delay: t, msg: { type: "AI_CHUNK", delta: w + " " } });
    t += 40;
  }
  steps.push({ delay: t + 300, msg: { type: "AI_DONE" } });
  return steps;
}

// A what-if turn where run_what_if returns FAST (~700ms in flight). Before the
// movement director this made the whatif pose blink and vanish — the reason
// Patch only ever saw ponder. Use ?state=whatif to watch the director hold the
// crystal-ball beat for its full min-hold before reasoning takes over.
const WHATIF_PROSE = (
  "If you slot COMM 3233 into next spring, [NAME], your audit clears both the " +
  "values seminar and the EP3 requirement — and it keeps Fridays open. One " +
  "catch: it collides with your 11:30 lab, so you'd move the lab to the " +
  "Tuesday section. Want me to check seats?"
).split(" ");

function whatIfScript(): Broadcast[] {
  const steps: Broadcast[] = [
    { delay: 400, msg: { type: "AI_TOOL_USE", name: "run_what_if", input: { add: ["COMM 3233"] } } },
    { delay: 1100, msg: { type: "AI_TOOL_RESULT", courseCount: 1 } },
  ];
  let t = 1500;
  for (const w of WHATIF_PROSE) {
    steps.push({ delay: t, msg: { type: "AI_CHUNK", delta: w + " " } });
    t += 40;
  }
  steps.push({ delay: t + 300, msg: { type: "AI_DONE" } });
  return steps;
}

// A fordham.edu lookup (ADR 0045). The pages are fabricated stand-ins, not
// quotes from Fordham's real bulletin.
const FORDHAM_PROSE = (
  "The psychology major asks for 10 courses: an intro sequence, statistics and research methods, and upper-level electives across areas [mock]. " +
  "Your CISC credits won't count toward it, but your core is already done."
).split(" ");

function fordhamScript(): Broadcast[] {
  const steps: Broadcast[] = [
    { delay: 400, msg: { type: "AI_TOOL_USE", name: "web_search", input: { query: "Fordham Rose Hill psychology major requirements" } } },
    { delay: 1600, msg: { type: "AI_TOOL_RESULT", name: "web_search", courseCount: 4 } },
  ];
  let t = 1900;
  for (const w of FORDHAM_PROSE) {
    steps.push({ delay: t, msg: { type: "AI_CHUNK", delta: w + " " } });
    t += 40;
  }
  steps.push({
    delay: t + 100,
    msg: {
      type: "AI_SOURCES",
      sources: [
        { url: "https://bulletin.fordham.edu/mock/psychology-major", title: "Psychology Major (mock page)" },
        { url: "https://www.fordham.edu/mock/registrar/policies", title: "Registration Policies (mock page)" },
      ],
    },
  });
  steps.push({ delay: t + 300, msg: { type: "AI_DONE" } });
  return steps;
}

// ─── Scenarios ────────────────────────────────────────────────────────────────

const READY_BASE: Scenario = {
  local: LOCAL_READY,
  session: {},
  auditText: AUDIT,
  profile: PROFILE,
  onboardingCompletedAt: 1751970000000,
  memories: MEMORIES,
  onChat: chatScript(),
};

const SCENARIOS: Record<string, Scenario> = {
  firstrun: {
    local: {},
    session: {},
    auditText: null,
    profile: null,
    onboardingCompletedAt: null,
    memories: [],
  },
  "firstrun-mid": {
    local: { ...LOCAL_READY, catalogCourseCount: 0 },
    session: {},
    auditText: AUDIT,
    profile: PROFILE,
    onboardingCompletedAt: null,
    memories: [],
  },
  empty: READY_BASE,
  chat: {
    ...READY_BASE,
    session: { chat_messages: CHAT_SESSION },
  },
  fordham: {
    ...READY_BASE,
    onChat: fordhamScript(),
    autosend: true,
  },
  whatif: {
    ...READY_BASE,
    session: { chat_messages: CHAT_SESSION },
    onChat: whatIfScript(),
    autosend: true,
  },
  saves: {
    ...READY_BASE,
    session: { chat_messages: SAVES_SESSION, chat_onboarding_mode: true },
  },
  error: {
    ...READY_BASE,
    onChat: [{ delay: 900, msg: { type: "AI_ERROR", error: "401 authentication_error: invalid x-api-key" } }],
    autosend: true,
  },
  toolcap: {
    ...READY_BASE,
    onChat: [
      { delay: 400, msg: { type: "AI_CHUNK", delta: "I searched the catalog five times and hit my per-turn budget before finishing the comparison. " } },
      { delay: 800, msg: { type: "AI_NOTICE", kind: "tool-cap" } },
      { delay: 900, msg: { type: "AI_DONE" } },
    ],
    autosend: true,
  },
  "audit-expired": {
    ...READY_BASE,
    onLoad: [{ delay: 400, msg: { type: "AUDIT_EXPIRED" } }],
  },
  "audit-error": {
    ...READY_BASE,
    onLoad: [{ delay: 400, msg: { type: "AUDIT_ERROR", error: "DegreeWorks returned 503 Service Unavailable" } }],
  },
  "no-audit": {
    ...READY_BASE,
    auditText: null,
  },
  toast: {
    ...READY_BASE,
    session: { chat_messages: CHAT_SESSION },
    onLoad: [{ delay: 600, msg: { type: "AI_CURATOR_SAVED", description: "Prefers Tuesday/Friday seminars" } }],
  },
  "profile-loading": {
    ...READY_BASE,
    onLoad: [{ delay: 300, msg: { type: "PROFILE_LOADING" } }],
  },
  plan: { ...READY_BASE, local: { ...LOCAL_READY, "plan:202720": PLAN }, page: "plan" },
  "plan-conflict": { ...READY_BASE, local: { ...LOCAL_READY, "plan:202720": PLAN_CONFLICT }, page: "plan" },
  "plan-empty": { ...READY_BASE, page: "plan" },
};

// ─── The mock itself ──────────────────────────────────────────────────────────

export function installChromeMock(): void {
  const params = new URLSearchParams(window.location.search);
  const scenario = SCENARIOS[params.get("state") ?? "firstrun"] ?? SCENARIOS.firstrun;

  // &theme=dark|light — seeds the stored preference so dark mode is
  // reachable without prefers-color-scheme emulation.
  const theme = params.get("theme");
  if (theme === "dark" || theme === "light") {
    scenario.local = { ...scenario.local, themePreference: theme };
  }

  const listeners = new Set<Listener>();
  const storageListeners = new Set<(changes: Record<string, unknown>, area: string) => void>();
  const timers: ReturnType<typeof setTimeout>[] = [];

  const broadcast = (msg: unknown) => listeners.forEach((l) => l(msg));
  const play = (script: Broadcast[]) => {
    for (const step of script) timers.push(setTimeout(() => broadcast(step.msg), step.delay));
  };

  function makeArea(seed: Record<string, unknown>, area: string) {
    const store: Record<string, unknown> = { ...seed };
    return {
      get(keys: string | string[], cb: (r: Record<string, unknown>) => void) {
        const list = typeof keys === "string" ? [keys] : keys;
        const out: Record<string, unknown> = {};
        for (const k of list) if (k in store) out[k] = store[k];
        setTimeout(() => cb(out), 0);
      },
      set(items: Record<string, unknown>, cb?: () => void) {
        const changes: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(items)) {
          changes[k] = { oldValue: store[k], newValue: v };
          store[k] = v;
        }
        storageListeners.forEach((l) => l(changes, area));
        if (cb) setTimeout(cb, 0);
      },
      remove(keys: string | string[], cb?: () => void) {
        for (const k of typeof keys === "string" ? [keys] : keys) delete store[k];
        if (cb) setTimeout(cb, 0);
      },
    };
  }

  const mock = {
    storage: {
      local: makeArea(scenario.local, "local"),
      session: makeArea(scenario.session, "session"),
      onChanged: {
        addListener: (l: never) => storageListeners.add(l),
        removeListener: (l: never) => storageListeners.delete(l),
      },
    },
    // Opening a tab in the harness records the URL instead of leaving the page,
    // so the Gmail draft link can be inspected (window.__RAMPLAN_OPENED).
    tabs: {
      create({ url }: { url: string }) {
        const w = globalThis as { __RAMPLAN_OPENED?: string[] };
        (w.__RAMPLAN_OPENED ??= []).push(url);
      },
    },
    runtime: {
      onMessage: {
        addListener: (l: Listener) => listeners.add(l),
        removeListener: (l: Listener) => listeners.delete(l),
      },
      sendMessage(msg: { type: string }, cb?: (r: unknown) => void) {
        const reply = (r: unknown) => cb && setTimeout(() => cb(r), 0);
        switch (msg.type) {
          case "GET_AUDIT_TEXT":
            return reply({ text: scenario.auditText });
          case "GET_PROFILE":
            return reply({ profile: scenario.profile });
          case "GET_ONBOARDING_STATE":
            return reply({ completedAt: scenario.onboardingCompletedAt });
          case "GET_MEMORIES":
            return reply({ memories: scenario.memories });
          case "GET_AUTO_SAVE":
            return reply({ enabled: true });
          case "GET_CATALOG_TERMS":
            return reply({ terms: TERMS });
          case "GET_CATALOG_STATUS": {
            const count = (scenario.local as { catalogCourseCount?: number }).catalogCourseCount ?? 0;
            return reply(
              count > 0
                ? { term: "202720", courseCount: count, updatedAt: 1751980000000 }
                : { term: null, courseCount: 0, updatedAt: null }
            );
          }
          case "AI_CHAT":
            if (scenario.onChat) play(scenario.onChat);
            return reply({ ok: true });
          case "REFRESH_CATALOG": {
            // Canned catalog fetch so the FirstRun step-3 button (ADR 0032)
            // is drivable in the harness: five progress ticks, then READY +
            // the storage write that flips hasCatalog in the parent.
            const term = (msg as { term?: string }).term ?? "202720";
            const script: Broadcast[] = [];
            for (let i = 1; i <= 5; i++) {
              script.push({
                delay: i * 300,
                msg: { type: "CATALOG_PROGRESS", done: i, total: 5, label: `page ${i}` },
              });
            }
            script.push({
              delay: 1800,
              msg: { type: "CATALOG_READY", term, courseCount: 1899, updatedAt: Date.now() },
            });
            play(script);
            timers.push(
              setTimeout(() => {
                mock.storage.local.set({
                  catalogCourseCount: 1899,
                  catalogTerm: term,
                  catalogTermLabel: (msg as { termLabel?: string }).termLabel ?? null,
                });
              }, 1800)
            );
            return reply({ ok: true });
          }
          case "CANCEL_AI_CHAT":
            timers.forEach(clearTimeout);
            timers.length = 0;
            setTimeout(() => broadcast({ type: "AI_DONE" }), 100);
            return reply({ ok: true });
          default:
            return reply({});
        }
      },
    },
  };

  (globalThis as { chrome?: unknown }).chrome = mock;
  // For tools/shots.sh: every scenario, and which ones need a sent message.
  (globalThis as { __RAMPLAN_SCENARIOS?: unknown }).__RAMPLAN_SCENARIOS = Object.entries(SCENARIOS).map(
    ([name, sc]) => ({ name, autosend: !!sc.autosend, page: sc.page ?? "chat" })
  );
  // Scenarios that open on another tab say so through the same ?page= the app
  // already reads, so the shipped App carries no harness hook.
  if (!params.get("page")) {
    params.set("page", scenario.page ?? "chat");
    history.replaceState(null, "", `${location.pathname}?${params}`);
  }
  if (scenario.onLoad) play(scenario.onLoad);
}
