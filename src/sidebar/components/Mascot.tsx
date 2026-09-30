// Implements: ADR 0044 (Fordhawke as a vector rig)
//
// Fordhawke in the corner of the chat pane. The resident waves once when the
// pane opens, idles, and takes the pose of whatever the turn is doing. His size
// is the student's (Settings → Appearance), including off.
import { useEffect, useState } from "react";
import Fordhawke from "./Fordhawke";

export type MascotState = "idle" | "wave" | "ponder" | "whatif" | "reading";

const LABELS: Partial<Record<MascotState, string>> = {
  ponder: "Fordhawke is thinking",
  whatif: "Fordhawke is running a what-if",
  reading: "Fordhawke is reading your audit",
};

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

export type MascotSize = "off" | "small" | "medium" | "large";
export const MASCOT_HEIGHT: Record<MascotSize, number> = { off: 0, small: 84, medium: 108, large: 136 };
const SIZE_KEY = "mascotSize";

export function useMascotSize(): [MascotSize, (s: MascotSize) => void] {
  const [size, setSize] = useState<MascotSize>("medium");
  useEffect(() => {
    const valid = (v: unknown): v is MascotSize => typeof v === "string" && v in MASCOT_HEIGHT;
    chrome.storage.local.get(SIZE_KEY, (r) => valid(r[SIZE_KEY]) && setSize(r[SIZE_KEY]));
    const onChange = (c: { [k: string]: chrome.storage.StorageChange }) => {
      if (valid(c[SIZE_KEY]?.newValue)) setSize(c[SIZE_KEY].newValue);
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
  }, []);
  return [size, (s) => chrome.storage.local.set({ [SIZE_KEY]: s })];
}

const WAVE_MS = 2400;

export function ResidentMascot({
  activity,
  height,
  className,
}: {
  activity?: MascotState | null;
  height: number;
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const [greeting, setGreeting] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setGreeting(false), WAVE_MS);
    return () => clearTimeout(t);
  }, []);
  if (!height) return null;
  const pose: MascotState = activity ?? (greeting && !reduced ? "wave" : "idle");
  return (
    <span className={className} style={{ width: height * 0.75, height }}>
      <Fordhawke pose={pose} still={reduced} label={LABELS[pose]} />
    </span>
  );
}
