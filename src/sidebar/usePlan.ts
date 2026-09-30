// The plan for the loaded catalog term, live across every view that reads it
// (Plan tab, section cards, the header count). chrome.storage.local is the one
// copy; each hook instance subscribes to onChanged, so adding a section from a
// card updates the Plan tab without a message bus. Implements: ADR 0040.
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addSection,
  findConflicts,
  ordered,
  planKey,
  removeSection,
  termLabel as labelFor,
  totalCredits,
  type PlannedSection,
} from "../shared/plan";

export function usePlan() {
  const [term, setTerm] = useState<string | null>(null);
  const [storedLabel, setStoredLabel] = useState<string | null>(null);
  const [sections, setSections] = useState<PlannedSection[]>([]);

  useEffect(() => {
    chrome.storage.local.get(["catalogTerm", "catalogTermLabel"], (r) => {
      setTerm((r.catalogTerm as string) ?? null);
      setStoredLabel((r.catalogTermLabel as string) ?? null);
    });
    const onChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.catalogTerm) setTerm((changes.catalogTerm.newValue as string) ?? null);
      if (changes.catalogTermLabel) setStoredLabel((changes.catalogTermLabel.newValue as string) ?? null);
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
  }, []);

  useEffect(() => {
    if (!term) {
      setSections([]);
      return;
    }
    const key = planKey(term);
    chrome.storage.local.get(key, (r) => setSections((r[key] as PlannedSection[]) ?? []));
    const onChange = (changes: { [k: string]: chrome.storage.StorageChange }) => {
      if (changes[key]) setSections((changes[key].newValue as PlannedSection[]) ?? []);
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
  }, [term]);

  // Read-modify-write against storage, not local state, so two views editing
  // in quick succession can't drop each other's change.
  const update = useCallback(
    (fn: (list: PlannedSection[]) => PlannedSection[]) => {
      if (!term) return;
      const key = planKey(term);
      chrome.storage.local.get(key, (r) => {
        const next = fn((r[key] as PlannedSection[]) ?? []);
        chrome.storage.local.set({ [key]: next });
      });
    },
    [term]
  );

  const add = useCallback((s: PlannedSection) => update((l) => addSection(l, s)), [update]);
  const remove = useCallback((crn: string) => update((l) => removeSection(l, crn)), [update]);
  const clear = useCallback(() => update(() => []), [update]);

  const sorted = useMemo(() => ordered(sections), [sections]);
  const conflicts = useMemo(() => findConflicts(sections), [sections]);

  return {
    term,
    termLabel: storedLabel ?? (term ? labelFor(term) : ""),
    sections: sorted,
    add,
    remove,
    clear,
    conflicts,
    credits: totalCredits(sections),
  };
}
