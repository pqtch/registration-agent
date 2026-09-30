// "Where you stand" (ADR 0040): the few facts from the audit the empty Advisor
// screen shows before any question is asked. Parsed once at audit refresh and
// stored as `auditSummary`.
//
// PII boundary (ADR 0009): block titles, rule labels, percentages and credit
// counts only. No name, student id, email or advisor ever enters this shape.
//
// "Open" uses the renderer's own reading of done (ruleStatus), so the summary
// and the text the advisor reads can't disagree. A rule whose remaining work is
// already in progress this term (inProgressIncomplete) isn't open: there is
// nothing left to plan for it.
import type { AuditResponse, AuditRule } from "../../shared/degreeworks-types";
import { ruleStatus } from "./degreeworks-audit-to-text";

export interface AuditSummary {
  percentComplete: number | null;
  creditsApplied: number | null; // resident + transfer
  creditsInProgress: number | null;
  creditsRequired: number | null; // only when the degree block states it
  blocks: {
    id: string;
    title: string;
    percentComplete: number;
    open: { id: string; label: string }[];
  }[];
}

const num = (v: string | undefined | null): number | null => {
  if (v === undefined || v === null || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function isOpen(rule: AuditRule): boolean {
  if (rule.ruleType === "Block" || rule.ruleType === "Blocktype") return false; // points at another block
  if (!rule.label?.trim()) return false;
  return ruleStatus(rule) !== "x" && rule.inProgressIncomplete !== "Yes";
}

export function auditToSummary(audit: AuditResponse): AuditSummary {
  const h = audit.auditHeader;
  const resident = num(h?.residentApplied);
  const transfer = num(h?.transferApplied);
  const applied = resident === null && transfer === null ? null : (resident ?? 0) + (transfer ?? 0);

  let creditsRequired: number | null = null;
  const degree = (audit.blockArray ?? []).find((b) => b.requirementType === "DEGREE");
  const minCredits = degree?.header?.qualifierArray?.find((q) => q.name === "MINCREDITS");
  if (minCredits) creditsRequired = num(minCredits.credits) ?? num(/(\d+)\s*credits/i.exec(minCredits.text ?? "")?.[1]);

  return {
    percentComplete: num(h?.percentComplete),
    creditsApplied: applied,
    creditsInProgress: num(h?.residentAppliedInProgress),
    creditsRequired,
    blocks: (audit.blockArray ?? [])
      .filter((b) => b.requirementType !== "DEGREE")
      .map((b) => ({
        id: b.requirementId || b.title,
        title: (b.title || b.requirementType).trim(),
        percentComplete: num(b.percentComplete) ?? 0,
        open: (b.ruleArray ?? []).filter(isOpen).map((r) => ({ id: r.ruleId || r.label, label: r.label.trim() })),
      })),
  };
}
