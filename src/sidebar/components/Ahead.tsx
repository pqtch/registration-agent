// Implements: ADR 0046 (Ahead: the roadmap past this term)
//
// The terms after the one being planned, and which of them the student means to
// take each open requirement in. Placement is theirs and saved locally; the
// advisor sees it. Requirements this term's plan already covers aren't listed.
import { useEffect, useMemo, useState } from "react";
import type { OpenRequirement } from "../../shared/requirements";
import { ROADMAP_KEY, livePlacements, nextTerms, type Roadmap } from "../../shared/roadmap";

function useRoadmap(): [Roadmap, (reqId: string, term: string) => void] {
  const [roadmap, setRoadmap] = useState<Roadmap>({});
  useEffect(() => {
    chrome.storage.local.get(ROADMAP_KEY, (r) => setRoadmap((r[ROADMAP_KEY] as Roadmap) ?? {}));
    const onChange = (c: { [k: string]: chrome.storage.StorageChange }) => {
      if (c[ROADMAP_KEY]) setRoadmap((c[ROADMAP_KEY].newValue as Roadmap) ?? {});
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
  }, []);
  const place = (reqId: string, term: string) => {
    const next = { ...roadmap };
    if (term) next[reqId] = term;
    else delete next[reqId];
    setRoadmap(next);
    chrome.storage.local.set({ [ROADMAP_KEY]: next });
  };
  return [roadmap, place];
}

export default function Ahead({ term, needed }: { term: string; needed: OpenRequirement[] }) {
  const terms = useMemo(() => nextTerms(term, 4), [term]);
  const [roadmap, place] = useRoadmap();
  const live = livePlacements(roadmap, terms);
  if (!terms.length || !needed.length) return null;

  const groups = terms
    .map((t) => ({ ...t, reqs: needed.filter((r) => live[r.id] === t.code) }))
    .filter((g) => g.reqs.length);
  const unplaced = needed.filter((r) => !live[r.id]);

  const Row = ({ r }: { r: OpenRequirement }) => (
    <li className="flex items-center gap-2 px-3.5 py-2.5">
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-ink">{r.label}</span>
        <span className="block text-xs text-ink-3">{r.block}</span>
      </span>
      <select
        value={live[r.id] ?? ""}
        onChange={(e) => place(r.id, e.target.value)}
        aria-label={`Term for ${r.label}`}
        className="focus-ring shrink-0 rounded-md border border-line-2 bg-raised px-1.5 py-1 text-xs text-ink"
      >
        <option value="">Not placed</option>
        {terms.map((t) => (
          <option key={t.code} value={t.code}>
            {t.label}
          </option>
        ))}
      </select>
    </li>
  );

  return (
    <section className="mt-6">
      <h3 className="mb-2 flex items-baseline justify-between px-0.5 text-xs font-semibold text-ink">
        <span>Ahead</span>
        <span className="font-normal text-ink-3">
          {unplaced.length ? `${unplaced.length} not placed` : "Every open requirement has a term"}
        </span>
      </h3>
      <div className="space-y-3">
        {groups.map((g) => (
          <div key={g.code} className="card overflow-hidden">
            <p className="flex items-baseline justify-between border-b border-line px-3.5 py-2 text-xs">
              <span className="font-semibold text-ink">{g.label}</span>
              <span className="tabular-nums text-ink-3">
                {g.reqs.length} {g.reqs.length === 1 ? "requirement" : "requirements"}
              </span>
            </p>
            <ul className="divide-y divide-line">
              {g.reqs.map((r) => (
                <Row key={r.id} r={r} />
              ))}
            </ul>
          </div>
        ))}
        {unplaced.length > 0 && (
          <div className="card overflow-hidden">
            {groups.length > 0 && <p className="border-b border-line px-3.5 py-2 text-xs font-semibold text-ink">Not placed yet</p>}
            <ul className="divide-y divide-line">
              {unplaced.map((r) => (
                <Row key={r.id} r={r} />
              ))}
            </ul>
          </div>
        )}
      </div>
      <p className="mt-2 px-0.5 text-xs text-ink-3">
        Pick the term you mean to take each one in. The advisor sees this roadmap; it isn't a registration.
      </p>
    </section>
  );
}
