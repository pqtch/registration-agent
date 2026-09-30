// Implements: ADR 0040 (the plan has a home), ADR 0042 (the plan fills itself from the audit)
//
// The student's term, whole: the classes they're registered for, the sections
// they plan to add (each with a backup that fits), and what the audit says is
// still needed, with the sections that meet it and fit the week. Everything is
// computed locally from the audit and the loaded catalog; the advisor is one
// tap away for judgment, not needed for lookup.
import { useEffect, useMemo, useState } from "react";
import WeekGrid from "../components/WeekGrid";
import { useSchedule, codeOf, type RegisteredRow } from "../useSchedule";
import { loadCatalogTerm } from "../useCatalog";
import { crns, plannedFrom, type PlannedSection } from "../../shared/plan";
import { backupFor, candidatesFor, type Candidate, type OpenRequirement } from "../../shared/requirements";
import { meetingsLabel, daysLabel, timeRange } from "../meetingFormat";
import { advisorEmail, gmailComposeUrl } from "../advisorEmail";
import { scheduleImage } from "../scheduleImage";

function useWho() {
  const [who, setWho] = useState({ firstName: null as string | null, advisorEmail: null as string | null, advisorName: null as string | null });
  useEffect(() => {
    chrome.storage.local.get(["studentFirstName", "studentAdvisorEmail", "studentAdvisorName"], (r) =>
      setWho({
        firstName: (r.studentFirstName as string) ?? null,
        advisorEmail: (r.studentAdvisorEmail as string) ?? null,
        advisorName: (r.studentAdvisorName as string) ?? null,
      })
    );
  }, []);
  return who;
}

function clockTime(ts: number): string {
  return new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function PlanView({ onAsk }: { onAsk: (text: string) => void }) {
  const sch = useSchedule();
  const { catalog } = sch;
  const who = useWho();
  const [pending, setPending] = useState<string | null>(null);
  const [copy, setCopy] = useState<"idle" | "done" | "failed">("idle");
  const [emailNote, setEmailNote] = useState<string | null>(null);

  useEffect(() => {
    if (pending && (catalog.term === pending || catalog.error)) setPending(null);
  }, [pending, catalog.term, catalog.error]);
  useEffect(() => {
    if (copy !== "done") return;
    const t = setTimeout(() => setCopy("idle"), 2000);
    return () => clearTimeout(t);
  }, [copy]);

  const byCrn = useMemo(() => new Map(sch.busy.map((b) => [b.crn, b])), [sch.busy]);
  const backups = useMemo(() => {
    // One backup per class: a section already offered as someone's backup is
    // treated as taken, so two classes never lean on the same fallback.
    const m = new Map<string, Candidate | null>();
    const held: typeof sch.busy = [];
    for (const s of sch.sections) {
      const b = backupFor(s, sch.fills.get(s.crn) ?? null, catalog.courses, [...sch.busy, ...held]);
      m.set(s.crn, b);
      if (b) held.push({ crn: b.section.crn, courseCode: b.course.courseCode, meetings: [], registered: false });
    }
    return m;
  }, [sch.sections, sch.fills, sch.busy, catalog.courses]);
  const needed = useMemo(() => {
    const covered = new Set([...sch.fills.values()].map((r) => r.id));
    return sch.open.filter((r) => !covered.has(r.id));
  }, [sch.open, sch.fills]);

  const gridItems = useMemo(
    () => sch.busy.map((b) => ({ id: b.crn, label: b.courseCode, meetings: b.meetings, registered: b.registered })),
    [sch.busy]
  );
  const clashLine = sch.conflicts
    .map((c) => `${byCrn.get(c.a)?.courseCode ?? c.a} and ${byCrn.get(c.b)?.courseCode ?? c.b} overlap ${daysLabel([c.day])} ${timeRange(c.start, c.end) ?? ""}`.trim())
    .join(". ");

  const termOptions = catalog.terms.length
    ? catalog.terms
    : sch.term
    ? [{ code: sch.term, description: sch.termLabel }]
    : [];
  const shownTerm = pending ?? sch.term ?? "";
  const shownLabel = termOptions.find((t) => t.code === shownTerm)?.description ?? sch.termLabel;

  async function emailAdvisor() {
    const { subject, body } = advisorEmail({
      termLabel: sch.termLabel,
      firstName: who.firstName,
      advisorName: who.advisorName,
      credits: sch.credits,
      registered: sch.registered.map((r) => ({
        courseCode: codeOf(r.cls),
        title: r.cls.title,
        meetings: r.kind === "found" ? r.section.meetings : null,
      })),
      planned: sch.sections.map((s) => {
        const b = backups.get(s.crn);
        const f = sch.fills.get(s.crn);
        return {
          section: s,
          fills: f ? { label: f.label, block: f.block } : null,
          backup: b ? { courseCode: b.course.courseCode, crn: b.section.crn, meetings: b.section.meetings } : null,
        };
      }),
    });
    let pasted = false;
    try {
      // The item takes the drawing as a promise, so the write starts inside
      // the click's user activation instead of after the canvas work.
      const png = scheduleImage(gridItems, sch.conflicts, `${sch.termLabel} plan`, `${sch.credits} credits`);
      await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
      pasted = true;
    } catch {
      /* the draft still opens; the note says the picture didn't copy */
    }
    const url = gmailComposeUrl(who.advisorEmail, subject, body);
    if (chrome.tabs?.create) chrome.tabs.create({ url });
    else window.open(url, "_blank", "noopener");
    setEmailNote(
      pasted
        ? "Your draft is open in Gmail, and your week is copied as a picture. Paste it into the email with Ctrl+V."
        : "Your draft is open in Gmail. The picture of your week couldn't be copied, so the email has the text only."
    );
  }

  return (
    <div className="h-full overflow-y-auto px-4 pt-4 pb-10">
      <div className="flex items-end justify-between gap-3">
        <label className="relative -ml-1.5 inline-flex items-center gap-1.5 rounded-lg px-1.5 py-0.5 hover:bg-ink/[0.06] focus-within:ring-2 focus-within:ring-fordham-maroon dark:focus-within:ring-fordham-maroon-ink">
          <span className="sr-only">Term</span>
          <span aria-hidden className="font-serif text-[26px] font-medium leading-tight text-ink">
            {shownLabel || "Choose a term"}
          </span>
          <svg aria-hidden width="14" height="14" viewBox="0 0 14 14" className="mt-1 text-ink-3">
            <path d="M3.5 5.5L7 9l3.5-3.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {/* The native select stays the control (keyboard, screen readers, the
              OS picker); it sits invisibly over the heading it drives. */}
          <select
            value={shownTerm}
            onChange={(e) => {
              setPending(e.target.value);
              loadCatalogTerm(e.target.value);
            }}
            className="absolute inset-0 w-full cursor-pointer opacity-0"
          >
            {!shownTerm && <option value="">Choose a term</option>}
            {termOptions.map((t) => (
              <option key={t.code} value={t.code}>
                {t.description}
              </option>
            ))}
          </select>
        </label>
        {sch.credits > 0 && (
          <p className="pb-1 text-sm tabular-nums text-ink-2">
            {sch.credits} {sch.credits === 1 ? "credit" : "credits"}
          </p>
        )}
      </div>
      <CatalogLine catalog={catalog} pendingLabel={pending ? shownLabel : null} onRefresh={() => sch.term && loadCatalogTerm(sch.term)} />

      {!sch.term ? (
        <p className="mt-4 text-sm text-ink-2">Choose the term you're planning. Its course catalog loads once and stays in your browser.</p>
      ) : (
        <>
          <section aria-label="Your week" className="card mt-4 px-3 pb-3 pt-2.5">
            <WeekGrid items={gridItems} conflicts={sch.conflicts} label={weekSummary(sch.busy.length, sch.conflicts.length)} />
            <div className="mt-2 flex items-center gap-4 text-[11px] text-ink-3">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="h-2.5 w-2.5 rounded-[3px] bg-ink/[0.07] ring-1 ring-inset ring-line-2" /> Registered
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="h-2.5 w-2.5 rounded-[3px] bg-fordham-maroon/15 ring-1 ring-inset ring-fordham-maroon/30 dark:bg-fordham-maroon-ink/20 dark:ring-fordham-maroon-ink/35" /> Planned
              </span>
            </div>
            {clashLine && (
              <p role="status" className="mt-2 text-xs font-medium text-red-700 dark:text-red-400">
                {clashLine}.
              </p>
            )}
          </section>

          {sch.registered.length > 0 && (
            <Group title="Registered" count={sch.registered.length}>
              <ul className="card divide-y divide-line">
                {sch.registered.map((r) => (
                  <RegisteredItem key={codeOf(r.cls)} row={r} termLabel={sch.termLabel} catalogLoading={!!catalog.progress} onChoose={sch.choose} />
                ))}
              </ul>
            </Group>
          )}

          <Group title="Planned" count={sch.sections.length}>
            {sch.sections.length === 0 ? (
              <p className="card px-3.5 py-3 text-sm text-ink-2">
                Nothing planned yet. Open a requirement under <span className="font-medium text-ink">Still needed</span> to
                see the sections that fit your week.
              </p>
            ) : (
              <>
                <ul className="card divide-y divide-line">
                  {sch.sections.map((s) => (
                    <PlannedItem
                      key={s.crn}
                      s={s}
                      fills={sch.fills.get(s.crn) ?? null}
                      backup={backups.get(s.crn) ?? null}
                      clashes={sch.conflicts
                        .filter((c) => c.a === s.crn || c.b === s.crn)
                        .map((c) => byCrn.get(c.a === s.crn ? c.b : c.a)?.courseCode ?? "another class")}
                      onRemove={() => sch.remove(s.crn)}
                      onSwap={(b) => {
                        sch.remove(s.crn);
                        sch.add(plannedFrom(b.course, b.section));
                      }}
                    />
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(crns(sch.sections).join(", ")).then(() => setCopy("done"), () => setCopy("failed"));
                    }}
                    className={PRIMARY_BTN}
                  >
                    {copy === "done" ? `Copied ${sch.sections.length} ${sch.sections.length === 1 ? "CRN" : "CRNs"}` : "Copy CRNs"}
                  </button>
                  <button onClick={emailAdvisor} className={SECONDARY_BTN}>
                    Email plan to advisor
                  </button>
                </div>
                {copy === "failed" && (
                  <p role="alert" className="mt-2 text-xs text-ink-2">
                    Couldn't copy. Select them here instead:{" "}
                    <span className="select-all font-medium tabular-nums">{crns(sch.sections).join(", ")}</span>
                  </p>
                )}
                {emailNote && (
                  <p role="status" className="mt-2 text-xs text-ink-2">
                    {emailNote}
                  </p>
                )}
                <p className="mt-2 text-xs text-ink-3">Registration is still yours to do in Banner.</p>
              </>
            )}
          </Group>

          <Group
            title="Still needed"
            aside={sch.summary?.percentComplete != null ? `${sch.summary.percentComplete}% of degree complete` : undefined}
          >
            {needed.length === 0 ? (
              <p className="card px-3.5 py-3 text-sm text-ink-2">
                {sch.open.length ? "Everything still open in your audit has a planned section." : "Your audit shows no open requirements."}
              </p>
            ) : (
              <ul className="card divide-y divide-line">
                {needed.map((r) => (
                  <NeededItem
                    key={r.id}
                    req={r}
                    candidates={catalog.courses.length ? candidatesFor(r, catalog.courses, sch.busy) : []}
                    catalogReady={catalog.courses.length > 0}
                    onAdd={(c) => sch.add(plannedFrom(c.course, c.section))}
                    onAsk={() => onAsk(`What should I take for ${r.label} (${r.block}) in ${sch.termLabel}, and which sections fit my schedule?`)}
                  />
                ))}
              </ul>
            )}
          </Group>
        </>
      )}
    </div>
  );
}

function weekSummary(classes: number, overlaps: number): string {
  if (!classes) return "Your week is empty.";
  return `Your week: ${classes} ${classes === 1 ? "class" : "classes"}${overlaps ? `, ${overlaps} ${overlaps === 1 ? "overlap" : "overlaps"}` : ", no overlaps"}.`;
}

function CatalogLine({
  catalog,
  pendingLabel,
  onRefresh,
}: {
  catalog: ReturnType<typeof useSchedule>["catalog"];
  pendingLabel: string | null;
  onRefresh: () => void;
}) {
  if (catalog.progress) {
    const { done, total } = catalog.progress;
    return (
      <p role="status" className="mt-1 text-xs tabular-nums text-ink-3">
        Loading {pendingLabel ?? "the"} catalog{total > 1 ? ` · ${done} of ${total}` : "…"}
      </p>
    );
  }
  if (catalog.error) {
    return (
      <p role="alert" className="mt-1 text-xs text-red-700 dark:text-red-400">
        {catalog.error.expired ? "Your Banner session expired. " : "The catalog didn't load. "}
        {catalog.error.recoveryUrl ? (
          <a href={catalog.error.recoveryUrl} target="_blank" rel="noreferrer" className="font-medium underline">
            Open Banner, then try again
          </a>
        ) : (
          <button onClick={onRefresh} className="focus-ring font-medium underline">
            Try again
          </button>
        )}
      </p>
    );
  }
  if (!catalog.updatedAt) return null;
  return (
    <p className="mt-1 text-xs text-ink-3">
      Seats as of {clockTime(catalog.updatedAt)} ·{" "}
      <button onClick={onRefresh} className="focus-ring rounded font-medium text-fordham-maroon hover:underline dark:text-fordham-maroon-ink">
        Refresh seats
      </button>
    </p>
  );
}

function Group({ title, count, aside, children }: { title: string; count?: number; aside?: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="mb-2 flex items-baseline justify-between px-0.5 text-xs font-semibold text-ink">
        <span>
          {title}
          {count ? <span className="ml-1.5 font-normal tabular-nums text-ink-3">{count}</span> : null}
        </span>
        {aside && <span className="font-normal text-ink-3">{aside}</span>}
      </h3>
      {children}
    </section>
  );
}

function RegisteredItem({
  row,
  termLabel,
  catalogLoading,
  onChoose,
}: {
  row: RegisteredRow;
  termLabel: string;
  catalogLoading: boolean;
  onChoose: (courseCode: string, crn: string) => void;
}) {
  const code = codeOf(row.cls);
  return (
    <li className="px-3.5 py-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm leading-snug text-ink">
          <span className="font-semibold tabular-nums">{code}</span> <span className="text-ink-2">{row.cls.title}</span>
        </p>
        {row.cls.status === "in-progress" && (
          <span className="shrink-0 rounded-md bg-ink/[0.06] px-1.5 py-0.5 text-[11px] font-medium text-ink-2">In progress</span>
        )}
      </div>
      {row.kind === "found" && (
        <p className="mt-0.5 text-xs tabular-nums text-ink-2">
          {meetingsLabel(row.section.meetings)} · CRN {row.section.crn}
          {row.section.section ? ` · ${row.section.section}` : ""}
        </p>
      )}
      {row.kind === "choose" && (
        <label className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-ink-2">
          Which section are you in?
          <select
            defaultValue=""
            onChange={(e) => e.target.value && onChoose(code, e.target.value)}
            className="focus-ring rounded-md border border-line-2 bg-raised px-1.5 py-1 text-xs text-ink"
          >
            <option value="" disabled>
              Choose
            </option>
            {row.course.sections.map((s) => (
              <option key={s.crn} value={s.crn}>
                {s.section ? `${s.section} · ` : ""}
                {meetingsLabel(s.meetings)}
              </option>
            ))}
          </select>
        </label>
      )}
      {row.kind === "missing" && (
        <p className="mt-0.5 text-xs text-ink-3">
          {catalogLoading ? "Finding its meeting time…" : `Not in the loaded ${termLabel} catalog, so its time isn't on your week.`}
        </p>
      )}
    </li>
  );
}

function PlannedItem({
  s,
  fills,
  backup,
  clashes,
  onRemove,
  onSwap,
}: {
  s: PlannedSection;
  fills: OpenRequirement | null;
  backup: Candidate | null;
  clashes: string[];
  onRemove: () => void;
  onSwap: (b: Candidate) => void;
}) {
  return (
    <li className="flex items-start gap-2 px-3.5 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug text-ink">
          <span className="font-semibold tabular-nums">{s.courseCode}</span> <span className="text-ink-2">{s.title}</span>
        </p>
        <p className="mt-0.5 text-xs tabular-nums text-ink-2">
          {meetingsLabel(s.meetings)} · CRN {s.crn} ·{" "}
          {s.seats > 0 ? `${s.seats} ${s.seats === 1 ? "seat" : "seats"}` : <span className="font-medium text-amber-700 dark:text-amber-300">Full</span>}
        </p>
        {fills && <p className="mt-0.5 text-xs text-ink-3">Counts toward {fills.label}</p>}
        {clashes.map((other) => (
          <p key={other} className="mt-1 text-xs font-medium text-red-700 dark:text-red-400">
            Overlaps {other}
          </p>
        ))}
        {backup && (
          <div className="mt-2 flex items-center gap-2 rounded-lg bg-ink/[0.045] py-1.5 pl-2.5 pr-1.5">
            <p className="min-w-0 flex-1 text-xs leading-snug tabular-nums text-ink-2">
              <span className="font-medium text-ink-3">Backup</span>{" "}
              <span className="font-medium text-ink">{backup.course.courseCode}</span> · CRN {backup.section.crn}
              <span className="block">{meetingsLabel(backup.section.meetings)}</span>
            </p>
            <button
              onClick={() => onSwap(backup)}
              aria-label={`Swap ${s.courseCode} for backup ${backup.course.courseCode}, CRN ${backup.section.crn}`}
              className="focus-ring shrink-0 rounded-md px-2 py-1 text-xs font-medium text-fordham-maroon hover:bg-raised dark:text-fordham-maroon-ink"
            >
              Swap
            </button>
          </div>
        )}
      </div>
      <button
        onClick={onRemove}
        aria-label={`Remove ${s.courseCode} from plan`}
        className="focus-ring -mr-1.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-ink/[0.06] hover:text-ink"
      >
        <svg aria-hidden width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
    </li>
  );
}

function NeededItem({
  req,
  candidates,
  catalogReady,
  onAdd,
  onAsk,
}: {
  req: OpenRequirement;
  candidates: Candidate[];
  catalogReady: boolean;
  onAdd: (c: Candidate) => void;
  onAsk: () => void;
}) {
  const lookup = req.options.some((o) => !(o.subject === "@" && o.number === "@" && o.attributes.length === 0));
  return (
    <li>
      <details className="group">
        <summary className="focus-ring flex cursor-pointer list-none items-center justify-between gap-2 px-3.5 py-3 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0">
            <span className="block text-sm text-ink">{req.label}</span>
            <span className="block text-xs text-ink-3">{req.block}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5 text-xs text-ink-3">
            {lookup && catalogReady && (candidates.length ? `${candidates.length}${candidates.length === 5 ? "+" : ""} fit` : "None fit")}
            <svg aria-hidden width="10" height="10" viewBox="0 0 10 10" className="transition-transform duration-200 ease-spring group-open:rotate-90">
              <path d="M3.5 2l3 3-3 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </summary>
        <div className="px-3.5 pb-3">
          {lookup && catalogReady && candidates.length > 0 && (
            <ul className="divide-y divide-line rounded-xl bg-ink/[0.045]">
              {candidates.map((c) => (
                <li key={c.section.crn} className="flex items-center gap-2 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug text-ink">
                      <span className="font-semibold tabular-nums">{c.course.courseCode}</span> <span className="text-ink-2">{c.course.title}</span>
                    </p>
                    <p className="text-xs tabular-nums text-ink-2">
                      {meetingsLabel(c.section.meetings)} · {c.section.seatsAvailable > 0 ? `${c.section.seatsAvailable} seats` : "Full"}
                    </p>
                  </div>
                  <button
                    onClick={() => onAdd(c)}
                    aria-label={`Add ${c.course.courseCode}, CRN ${c.section.crn}, to plan`}
                    className="focus-ring shrink-0 rounded-md border border-line-2 bg-raised px-2.5 py-1 text-xs font-medium text-ink hover:border-fordham-maroon dark:hover:border-fordham-maroon-ink"
                  >
                    Add
                  </button>
                </li>
              ))}
            </ul>
          )}
          {lookup && catalogReady && candidates.length === 0 && (
            <p className="text-xs text-ink-2">No section of this requirement fits around your week in the loaded catalog.</p>
          )}
          {!catalogReady && <p className="text-xs text-ink-2">Load this term's catalog to see sections.</p>}
          <button onClick={onAsk} className="focus-ring mt-2 rounded text-xs font-medium text-fordham-maroon hover:underline dark:text-fordham-maroon-ink">
            Ask the advisor about {req.label}
          </button>
        </div>
      </details>
    </li>
  );
}

const PRIMARY_BTN =
  "focus-ring inline-flex items-center rounded-lg px-3.5 py-2 text-sm font-medium bg-fordham-maroon text-white hover:bg-fordham-maroon/90 active:scale-[0.98] transition-[background-color,transform] duration-200 ease-spring";
const SECONDARY_BTN =
  "focus-ring inline-flex items-center rounded-lg px-3.5 py-2 text-sm font-medium bg-raised shadow-lift text-ink hover:text-fordham-maroon dark:hover:text-fordham-maroon-ink active:scale-[0.98] transition-[color,transform] duration-200 ease-spring";
