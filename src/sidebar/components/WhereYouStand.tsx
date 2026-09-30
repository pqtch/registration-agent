// Implements: ADR 0040 (where you stand: the empty screen reads the audit)
//
// The empty Advisor screen used to offer four generic questions over ~400px of
// nothing while the student's audit sat loaded (audit 2026-09-30, #6). It now
// shows what the audit already says, parsed at refresh (auditToSummary, no PII):
// overall progress, credits, and each block's open requirements. Every open
// requirement is a question the student can send with one tap.
//
// Honest content: every number here is the audit's own. Nothing is estimated.
import type { AuditSummary } from "../../background/agent/audit-summary";

export default function WhereYouStand({
  summary,
  onAsk,
}: {
  summary: AuditSummary;
  onAsk: (text: string) => void;
}) {
  const pct = summary.percentComplete;
  const open = summary.blocks.filter((b) => b.open.length > 0);
  // Only the audit's own figures: "96 of 124 credits" when the degree block
  // states a total, otherwise what's applied and what's in progress.
  const inProg = summary.creditsInProgress ? `, ${summary.creditsInProgress} in progress` : "";
  const credits =
    summary.creditsApplied === null
      ? null
      : summary.creditsRequired !== null
        ? `${summary.creditsApplied} of ${summary.creditsRequired} credits${inProg}`
        : `${summary.creditsApplied} credits applied${inProg}`;

  return (
    <section aria-label="Where you stand" className="mt-1">
      {(pct !== null || credits) && (
        <div>
          <p className="flex items-baseline justify-between text-xs tabular-nums text-stone-600 dark:text-stone-400">
            <span>{credits ?? "Degree progress"}</span>
            {pct !== null && <span className="font-medium text-stone-800 dark:text-stone-200">{pct}% complete</span>}
          </p>
          {pct !== null && (
            <div
              className="mt-1.5 h-1.5 rounded-full bg-stone-200 dark:bg-stone-800 overflow-hidden"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Degree progress"
            >
              <div
                className="h-full rounded-full bg-fordham-maroon dark:bg-fordham-maroon-ink"
                style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
              />
            </div>
          )}
        </div>
      )}

      {open.length > 0 ? (
        <div className="mt-5 space-y-4">
          {open.map((b) => (
            <div key={b.id}>
              <h3 className="flex items-baseline justify-between text-xs text-stone-600 dark:text-stone-400">
                <span className="font-semibold text-stone-800 dark:text-stone-200">{b.title}</span>
                <span className="tabular-nums">{b.percentComplete}%</span>
              </h3>
              <ul className="mt-1 divide-y divide-stone-200 dark:divide-stone-800 border-y border-stone-200 dark:border-stone-800">
                {b.open.map((o) => (
                  <li key={o.id}>
                    <button
                      onClick={() => onAsk(`What can I take for ${o.label}, and which sections fit my schedule?`)}
                      className="focus-ring group flex w-full items-center justify-between gap-2 px-1 py-2.5 text-left text-sm text-stone-700 dark:text-stone-300 hover:text-fordham-maroon dark:hover:text-fordham-maroon-ink transition-colors"
                    >
                      <span>{o.label}</span>
                      <span aria-hidden className="shrink-0 text-xs text-stone-500 dark:text-stone-400 group-hover:text-fordham-maroon dark:group-hover:text-fordham-maroon-ink">
                        Ask
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-stone-600 dark:text-stone-400">
          Your audit shows no open requirements.
        </p>
      )}
    </section>
  );
}
