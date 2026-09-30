// The audit's "where you stand" summary (ADR 0040), live from storage: the
// worker rewrites it on every audit refresh.
import { useEffect, useState } from "react";
import type { AuditSummary } from "../background/agent/audit-summary";

export function useAuditSummary(): AuditSummary | null {
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  useEffect(() => {
    chrome.storage.local.get("auditSummary", (r) => setSummary((r.auditSummary as AuditSummary) ?? null));
    const onChange = (changes: { [k: string]: chrome.storage.StorageChange }) => {
      if (changes.auditSummary) setSummary((changes.auditSummary.newValue as AuditSummary) ?? null);
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
  }, []);
  return summary;
}
