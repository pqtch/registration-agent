// Implements: ADR 0046 (Ahead: the roadmap past this term)
//
// Which later term the student means to take each open requirement in. It is
// the student's own placement, stored locally. The advisor reads it, but nothing
// here decides it for them.
import { termLabel } from "./plan";

export const ROADMAP_KEY = "roadmap"; // { [requirementId]: termCode }
export type Roadmap = Record<string, string>;

/**
 * The fall and spring terms after `code`, in order. Banner codes: YYYY10 is fall
 * of YYYY-1, YYYY20 is spring, YYYY30 is summer. Summers are left out: most
 * students plan around them, and a summer class can go in by hand as a note.
 */
export function nextTerms(code: string, count: number): { code: string; label: string }[] {
  const m = /^(\d{4})(10|20|30)$/.exec(code);
  if (!m) return [];
  let year = Number(m[1]);
  let season = m[2] === "10" ? 10 : 20; // a summer start counts from the spring before it
  if (m[2] === "30") season = 20;
  const out: { code: string; label: string }[] = [];
  while (out.length < count) {
    if (season === 10) season = 20;
    else {
      season = 10;
      year += 1;
    }
    const c = `${year}${season}`;
    out.push({ code: c, label: termLabel(c) });
  }
  return out;
}

/** Placements for terms that are still ahead; a term now in the past drops out. */
export function livePlacements(roadmap: Roadmap, terms: { code: string }[]): Roadmap {
  const valid = new Set(terms.map((t) => t.code));
  return Object.fromEntries(Object.entries(roadmap).filter(([, t]) => valid.has(t)));
}

/** The roadmap as the advisor reads it. */
export function roadmapPromptText(
  placed: { label: string; block: string; term: string }[],
  unplaced: number
): string {
  if (!placed.length) return unplaced ? `No later terms planned yet; ${unplaced} open requirements are unplaced.` : "";
  const byTerm = new Map<string, string[]>();
  for (const p of placed) byTerm.set(p.term, [...(byTerm.get(p.term) ?? []), `${p.label} (${p.block})`]);
  return [
    "The student's roadmap for later terms (their own placement, not a registration):",
    ...[...byTerm].map(([term, reqs]) => `- ${termLabel(term)}: ${reqs.join("; ")}`),
    unplaced ? `${unplaced} open requirements are not placed yet.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
