// One quiet chip for every memory type: the word carries the meaning, so the
// colour doesn't have to.
import type { MemoryType } from "../../shared/types";

export interface MemoryTypeStyle {
  label: string;
  bg: string;
  text: string;
}

const LABELS: Record<MemoryType, string> = {
  interest: "Interest",
  constraint: "Constraint",
  goal: "Goal",
  decision: "Decision",
  note: "Note",
};

export function memoryTypeStyle(type: string): MemoryTypeStyle {
  const label = LABELS[type as MemoryType] ?? type.charAt(0).toUpperCase() + type.slice(1);
  return { label, bg: "bg-ink/[0.06]", text: "text-ink-2" };
}
