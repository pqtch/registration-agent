// Implements: ADR 0040 (the plan has a home: Plan tab, week grid)
//
// The noun the product was missing. RamPlan's advisor could find and argue
// for sections, but nothing it found could be kept: to register, a student
// copied CRNs out of chat history by hand. This page holds the term's kept
// sections, shows the week they make (WeekGrid), says plainly if two collide,
// and hands the CRNs to registration.
//
// Data: usePlan (chrome.storage.local, per catalog term). Overlaps come from
// shared/plan.ts's findConflicts, the one place that rule lives.
import { useEffect, useMemo, useState } from "react";
import WeekGrid from "../components/WeekGrid";
import { usePlan } from "../usePlan";
import { useAuditSummary } from "../useAuditSummary";
import { crns, planEmail, type PlannedSection } from "../../shared/plan";
import { meetingsLabel, daysLabel, timeRange } from "../meetingFormat";

export default function PlanView({
  onAsk,
  onOpenSettings,
}: {
  onAsk: (text: string) => void;
  onOpenSettings: () => void;
}) {
  const { term, termLabel, sections, remove, conflicts, credits } = usePlan();
  const summary = useAuditSummary();
  const [who, setWho] = useState<{
    firstName: string | null;
    advisorEmail: string | null;
    advisorName: string | null;
  }>({ firstName: null, advisorEmail: null, advisorName: null });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    chrome.storage.local.get(
      ["studentFirstName", "studentAdvisorEmail", "studentAdvisorName"],
      (r) =>
        setWho({
          firstName: (r.studentFirstName as string) ?? null,
          advisorEmail: (r.studentAdvisorEmail as string) ?? null,
          advisorName: (r.studentAdvisorName as string) ?? null,
        })
    );
  }, []);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const byCrn = useMemo(() => new Map(sections.map((s) => [s.crn, s])), [sections]);
  const clashWith = (crn: string) =>
    conflicts
      .filter((c) => c.a === crn || c.b === crn)
      .map((c) => ({ other: byCrn.get(c.a === crn ? c.b : c.a), c }));

  const gridItems = useMemo(
    () => sections.map((s) => ({ id: s.crn, label: s.courseCode, meetings: s.meetings })),
    [sections]
  );

  // Up to two open requirements from the audit, as things to ask for.
  const openAsks = (summary?.blocks ?? [])
    .flatMap((b) => b.open.map((o) => o.label))
    .slice(0, 2);

  if (!term) {
    return (
      <Page>
        <h2 className="font-serif text-[26px] font-medium leading-tight text-stone-900 dark:text-stone-100">
          Your plan
        </h2>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
          A plan is built from one term's course catalog. Load a term in Settings to start.
        </p>
        <button onClick={onOpenSettings} className={SECONDARY_BTN + " mt-4"}>
          Open Settings
        </button>
      </Page>
    );
  }

  const clashLine =
    conflicts.length === 0
      ? null
      : conflicts
          .map((c) => {
            const a = byCrn.get(c.a)?.courseCode ?? c.a;
            const b = byCrn.get(c.b)?.courseCode ?? c.b;
            return `${a} and ${b} overlap ${daysLabel([c.day])} ${timeRange(c.start, c.end) ?? ""}`.trim();
          })
          .join(". ");

  const email = who.advisorEmail
    ? planEmail(sections, { firstName: who.firstName, termLabel })
    : null;

  return (
    <Page>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-serif text-[26px] font-medium leading-tight text-stone-900 dark:text-stone-100">
          {termLabel}
        </h2>
        {sections.length > 0 && (
          <p className="text-sm tabular-nums text-stone-600 dark:text-stone-400">
            {credits} {credits === 1 ? "credit" : "credits"}
          </p>
        )}
      </div>

      {sections.length === 0 ? (
        <div className="mt-2">
          <p className="text-sm text-stone-600 dark:text-stone-400">
            Nothing kept yet. When the advisor finds sections, tap <span className="font-medium text-stone-800 dark:text-stone-200">Add</span> on
            the ones you want and they land here, on your week.
          </p>
          {openAsks.length > 0 && (
            <div className="mt-4 divide-y divide-stone-200 dark:divide-stone-800 border-y border-stone-200 dark:border-stone-800">
              {openAsks.map((req) => (
                <button
                  key={req}
                  onClick={() => onAsk(`Find ${termLabel} sections for ${req} that fit my schedule.`)}
                  className="focus-ring block w-full text-left px-1 py-2.5 text-sm text-stone-700 dark:text-stone-300 hover:text-fordham-maroon dark:hover:text-fordham-maroon-ink transition-colors"
                >
                  Find sections for {req}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <p
            className={`mt-1 text-xs ${
              clashLine ? "text-red-700 dark:text-red-400 font-medium" : "text-stone-600 dark:text-stone-400"
            }`}
            role={clashLine ? "alert" : undefined}
          >
            {clashLine ?? `${sections.length} ${sections.length === 1 ? "section" : "sections"}, no overlaps`}
          </p>

          <div className="mt-4">
            <WeekGrid
              items={gridItems}
              conflicts={conflicts}
              label={`Your week for ${termLabel}: ${sections.length} sections${
                conflicts.length ? `, ${conflicts.length} overlapping` : ", no overlaps"
              }. Details are in the list below.`}
            />
          </div>

          <ul className="mt-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm dark:shadow-none divide-y divide-stone-100 dark:divide-stone-800 overflow-hidden">
            {sections.map((s) => (
              <SectionRow key={s.crn} s={s} clashes={clashWith(s.crn)} onRemove={() => remove(s.crn)} />
            ))}
          </ul>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => {
                navigator.clipboard.writeText(crns(sections).join(", ")).then(() => setCopied(true));
              }}
              className={PRIMARY_BTN}
            >
              {copied ? `Copied ${sections.length} CRNs` : "Copy CRNs"}
            </button>
            {email && who.advisorEmail && (
              <a
                href={`mailto:${who.advisorEmail}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`}
                className={SECONDARY_BTN}
              >
                Email plan to {who.advisorName ?? "advisor"}
              </a>
            )}
          </div>
          <p className="mt-2 text-xs text-stone-600 dark:text-stone-400">
            Seats are as of the last catalog load. Registration is still yours to do in Banner.
          </p>
        </>
      )}
    </Page>
  );
}

function SectionRow({
  s,
  clashes,
  onRemove,
}: {
  s: PlannedSection;
  clashes: { other: PlannedSection | undefined }[];
  onRemove: () => void;
}) {
  return (
    <li className="flex items-start gap-2 px-3.5 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug text-stone-900 dark:text-stone-100">
          <span className="font-semibold tabular-nums">{s.courseCode}</span>{" "}
          <span className="text-stone-700 dark:text-stone-300">{s.title}</span>
        </p>
        <p className="mt-0.5 text-xs tabular-nums text-stone-600 dark:text-stone-400">
          {meetingsLabel(s.meetings)} · CRN {s.crn} ·{" "}
          {s.seats > 0 ? (
            `${s.seats} ${s.seats === 1 ? "seat" : "seats"}`
          ) : (
            <span className="font-medium text-amber-700 dark:text-amber-300">Full</span>
          )}
        </p>
        {(s.instructor || s.attributes.length > 0) && (
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-stone-600 dark:text-stone-400">
            {s.instructor && <span>{s.instructor}</span>}
            {s.attributes.slice(0, 4).map((a) => (
              <span
                key={a.code}
                title={a.description}
                className="rounded border border-stone-200 dark:border-stone-700 px-1 py-px text-[10px] font-medium text-stone-700 dark:text-stone-300"
              >
                {a.code}
              </span>
            ))}
          </p>
        )}
        {clashes.map(({ other }, i) => (
          <p key={i} className="mt-1 text-xs font-medium text-red-700 dark:text-red-400">
            Overlaps {other?.courseCode ?? "another section"}
          </p>
        ))}
      </div>
      <button
        onClick={onRemove}
        aria-label={`Remove ${s.courseCode} from plan`}
        className="focus-ring shrink-0 inline-flex items-center justify-center w-7 h-7 -mr-1 rounded text-stone-500 hover:text-stone-900 hover:bg-stone-100 dark:text-stone-400 dark:hover:text-stone-100 dark:hover:bg-stone-800 transition-colors"
      >
        <svg aria-hidden width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
    </li>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return <div className="h-full overflow-y-auto px-4 pt-5 pb-8">{children}</div>;
}

const PRIMARY_BTN =
  "focus-ring inline-flex items-center rounded-lg px-3.5 py-2 text-sm font-medium bg-fordham-maroon text-white hover:bg-fordham-maroon/90 active:scale-[0.98] transition-[background-color,transform] duration-200 ease-spring";
const SECONDARY_BTN =
  "focus-ring inline-flex items-center rounded-lg px-3.5 py-2 text-sm font-medium border border-stone-300 dark:border-stone-700 text-stone-800 dark:text-stone-200 hover:border-fordham-maroon dark:hover:border-fordham-maroon-ink active:scale-[0.98] transition-[border-color,transform] duration-200 ease-spring";
