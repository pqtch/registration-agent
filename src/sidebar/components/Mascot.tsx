// Implements: ADR 0039 (motion that holds up), ADR 0047 (back to the pixel ram)
//
// Fordhawke in the corner of the chat pane: the pixel-art strips Patch approved,
// played by Web Animations (mascotMotion.ts). A pose change dissolves one layer
// into the next. Pixel art only stays crisp at whole-number scales, so his size
// setting is Normal (the strips' own 130px) or Large (2x), or off.
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { CROSSFADE_MS, cycleMs, spriteKeyframes } from "../mascotMotion";
import idleStrip from "../../../tools/mascot/strips/idle-strip.png";
import waveStrip from "../../../tools/mascot/strips/wave-strip.png";
import ponderStrip from "../../../tools/mascot/strips/ponder-strip.png";
import whatifStrip from "../../../tools/mascot/strips/whatif-strip.png";
import readingStrip from "../../../tools/mascot/strips/reading-strip.png";

export type MascotState = "idle" | "wave" | "ponder" | "whatif" | "reading";

const SPRITES: Record<MascotState, string> = {
  idle: idleStrip,
  wave: waveStrip,
  ponder: ponderStrip,
  whatif: whatifStrip,
  reading: readingStrip,
};

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

export type MascotSize = "off" | "normal" | "large";
/** The sprite cell's edge in CSS px. Whole multiples of the strips' 130. */
export const MASCOT_HEIGHT: Record<MascotSize, number> = { off: 0, normal: 130, large: 260 };
const SIZE_KEY = "mascotSize";

export function useMascotSize(): [MascotSize, (s: MascotSize) => void] {
  const [size, setSize] = useState<MascotSize>("normal");
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

function Mascot({ state, size, className }: { state: MascotState; size: number; className?: string }) {
  const reduced = usePrefersReducedMotion();
  const effState: MascotState = reduced ? "idle" : state;
  const label = LABELS[state];
  const [layers, setLayers] = useState<{ id: number; state: MascotState }[]>(() => [{ id: 0, state: effState }]);
  useEffect(() => {
    setLayers((prev) => {
      const top = prev[prev.length - 1];
      if (top.state === effState) return prev;
      if (reduced) return [{ id: top.id + 1, state: effState }];
      return [top, { id: top.id + 1, state: effState }];
    });
  }, [effState, reduced]);
  useEffect(() => {
    if (layers.length < 2) return;
    const t = setTimeout(() => setLayers((l) => l.slice(-1)), CROSSFADE_MS);
    return () => clearTimeout(t);
  }, [layers]);

  return (
    <span
      className={`mascot-stage${className ? ` ${className}` : ""}`}
      style={{ width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
    >
      {layers.map((l, i) => (
        <SpriteLayer key={l.id} state={l.state} size={size} still={reduced} fade={layers.length > 1 ? (i === layers.length - 1 ? "in" : "out") : null} />
      ))}
    </span>
  );
}

function SpriteLayer({ state, size, still, fade }: { state: MascotState; size: number; still: boolean; fade: "in" | "out" | null }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || still || typeof el.animate !== "function") return;
    const anim = el.animate(spriteKeyframes(state, size), { duration: cycleMs(state), iterations: Infinity });
    return () => anim.cancel();
  }, [state, size, still]);
  return (
    <span
      ref={ref}
      className={`mascot${fade ? ` mascot-fade-${fade}` : ""}`}
      style={{ "--cell": `${size}px`, "--sprite": `url(${SPRITES[state]})` } as CSSProperties}
    />
  );
}

export function ResidentMascot({ activity, height, className }: { activity?: MascotState | null; height: number; className?: string }) {
  const [greeting, setGreeting] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setGreeting(false), cycleMs("wave"));
    return () => clearTimeout(t);
  }, []);
  if (!height) return null;
  return <Mascot state={activity ?? (greeting ? "wave" : "idle")} size={height} className={className} />;
}
