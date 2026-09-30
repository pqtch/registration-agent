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
          <p className="flex items-baseline justify-between text-xs tabular-nums text-ink-2">
            <span>{credits ?? "Degree progress"}</span>
            {pct !== null && <span className="font-medium text-ink">{pct}% complete</span>}
          </p>
          {pct !== null && (
            <div
              className="mt-1.5 h-1.5 rounded-full bg-sunk overflow-hidden"
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
              <h3 className="flex items-baseline justify-between text-xs text-ink-2">
                <span className="font-semibold text-ink">{b.title}</span>
                <span className="tabular-nums">{b.percentComplete}%</span>
              </h3>
              <ul className="mt-1 card divide-y divide-line overflow-hidden">
                {b.open.map((o) => (
                  <li key={o.id}>
                    <button
                      onClick={() => onAsk(`What can I take for ${o.label}, and which sections fit my schedule?`)}
                      className="focus-ring group flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-sm text-ink-2 hover:text-fordham-maroon dark:hover:text-fordham-maroon-ink transition-colors"
                    >
                      <span>{o.label}</span>
                      <span aria-hidden className="shrink-0 text-xs text-ink-3 group-hover:text-fordham-maroon dark:group-hover:text-fordham-maroon-ink">
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
        <p className="mt-4 text-sm text-ink-2">
          Your audit shows no open requirements.
        </p>
      )}
    </section>
  );
}
