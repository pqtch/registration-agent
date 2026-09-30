// Implements: ADR 0024 (one setup screen), ADR 0032 (step 3 loads the catalog inline)
//
// Three prerequisites with live checkmarks, so a new student always knows
// what's missing and where to fix it. The intake unlocks on the two hard ones
// (key, audit); the catalog is recommended, not required.
import type { ReactNode } from "react";
import { useCatalog, loadCatalogTerm } from "../useCatalog";

export const DEGREEWORKS_URL =
  "https://dw-prod.ec.fordham.edu/responsiveDashboard/worksheets/WEB31";

function Step({
  n,
  done,
  title,
  detail,
  action,
  extra,
}: {
  n: number;
  done: boolean;
  title: string;
  detail?: string;
  action: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <li className="flex items-start gap-3 px-3.5 py-3">
      <span
        aria-hidden
        className={`mt-0.5 w-5 shrink-0 text-center text-xs tabular-nums ${
          done ? "text-green-700 dark:text-green-400" : "text-ink-2"
        }`}
      >
        {done ? "✓" : `${n}.`}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-ink">
          {title}
          {done && <span className="sr-only"> — done</span>}
        </p>
        {detail && !done && (
          <p className="text-xs text-ink-2 mt-0.5 leading-snug">{detail}</p>
        )}
        {!done && extra}
      </div>
      {!done && <span className="shrink-0">{action}</span>}
    </li>
  );
}

export default function FirstRun({
  hasKey,
  hasAudit,
  hasCatalog,
  onOpenSettings,
  onStart,
  onSkip,
}: {
  hasKey: boolean;
  hasAudit: boolean;
  hasCatalog: boolean;
  onOpenSettings: () => void;
  onStart: () => void;
  onSkip: () => void;
}) {
  const ready = hasKey && hasAudit;

  // The same default Settings would pick: Banner's newest term. The parent's
  // storage listener flips `hasCatalog`, so the checkmark needs no wiring here.
  const catalog = useCatalog();
  const defaultTerm = catalog.terms[0] ?? null;
  const progress = catalog.progress;
  const fetching = !!progress;
  const fetchError = !!catalog.error;
  function loadCatalog() {
    if (defaultTerm && !fetching) loadCatalogTerm(defaultTerm.code);
  }
  const settingsLink = (
    <button
      onClick={onOpenSettings}
      className="focus-ring rounded px-2 py-1 text-xs font-medium text-fordham-maroon dark:text-fordham-maroon-ink border border-line hover:border-fordham-maroon dark:hover:border-fordham-maroon-ink transition-colors"
    >
      Open Settings
    </button>
  );

  return (
    <div className="pt-6 px-1 animate-msg-in">
      {/* No wordmark here — the header bar 60px above already says RamPlan.
          Repeating the brand inside the card was a stutter; the heading's
          job is the task, not the name. */}
      <p className="text-[15px] font-semibold text-ink mb-2">
        Set up in three steps.
      </p>

      <ol className="card divide-y divide-line overflow-hidden">
        <Step
          n={1}
          done={hasKey}
          title="Add your Anthropic API key"
          detail="Stored in your browser, sent nowhere but Anthropic."
          action={settingsLink}
        />
        <Step
          n={2}
          done={hasAudit}
          title="Open DegreeWorks so I can read your audit"
          detail="The audit loads itself as soon as the page opens."
          action={
            <a
              href={DEGREEWORKS_URL}
              target="_blank"
              rel="noreferrer"
              className="focus-ring rounded px-2 py-1 text-xs font-medium text-fordham-maroon dark:text-fordham-maroon-ink border border-line hover:border-fordham-maroon dark:hover:border-fordham-maroon-ink transition-colors inline-block"
            >
              Open DegreeWorks
            </a>
          }
        />
        <Step
          n={3}
          done={hasCatalog}
          title="Load a term's course catalog"
          detail="Recommended — I can't suggest real sections without it. You can switch terms later in Settings."
          action={
            defaultTerm && !fetchError ? (
              <button
                onClick={loadCatalog}
                disabled={fetching}
                className="focus-ring rounded px-2 py-1 text-xs font-medium text-fordham-maroon dark:text-fordham-maroon-ink border border-line hover:border-fordham-maroon dark:hover:border-fordham-maroon-ink disabled:opacity-50 transition-colors"
              >
                {fetching ? "Loading…" : `Load ${defaultTerm.description}`}
              </button>
            ) : (
              settingsLink
            )
          }
          extra={
            <>
              {fetching && progress && (
                <div
                  className="h-1 mt-2 bg-sunk rounded-full overflow-hidden"
                  role="progressbar"
                  aria-label="Catalog download"
                  aria-valuemin={0}
                  aria-valuemax={progress.total}
                  aria-valuenow={progress.done}
                >
                  <div
                    className="h-full bg-fordham-maroon dark:bg-fordham-maroon-ink rounded-full transition-[width] duration-200 ease-spring"
                    style={{
                      width: `${progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0}%`,
                    }}
                  />
                </div>
              )}
              {fetchError && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1 leading-snug">
                  Couldn't load the catalog — try it from Settings.
                </p>
              )}
            </>
          }
        />
      </ol>

      <div className="mt-4 space-y-2">
        {/* The button always names its action; while it's locked, the reason
            sits under it in readable ink. It used to live inside the disabled
            label at half opacity, dimmest in dark mode (audit 2026-09-30, #7). */}
        <button
          onClick={onStart}
          disabled={!ready}
          aria-describedby={ready ? undefined : "firstrun-locked"}
          className="focus-ring w-full px-3 py-2 rounded-lg bg-fordham-maroon text-white text-sm font-medium hover:bg-fordham-maroon/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Let's get to know each other
        </button>
        {!ready && (
          <p id="firstrun-locked" className="text-center text-xs text-ink-2">
            Finish steps 1 and 2 first.
          </p>
        )}
        <button
          onClick={onSkip}
          className="focus-ring w-full px-3 py-1.5 rounded-lg text-xs text-ink-2 hover:text-ink transition-colors"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
