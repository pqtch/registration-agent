// Fordhawke, animated. The pixel-art ram sprite (tools/mascot/PIPELINE.md) as
// a CSS sprite-sheet: each state is a transparent horizontal strip of uniform
// 130x130 cells, played by stepping `background-position-x` in whole cells with
// the Web Animations API from the table in ../mascotMotion.ts (ping-pong for
// gestures, loop for locomotion). No JS frame loop — the browser owns the
// timing. `image-rendering: pixelated` is mandatory: these are true pixel art
// and any smoothing turns them to mush.
//
// Sizing is integer-ratio only (the crisp path for pixel art): the 130px cell
// renders at 1x (130) or exactly 0.5x (65). The hero greeter runs native; the
// thinking-line companion halves. Non-integer sizes shimmer — don't.
//
// prefers-reduced-motion → the static first frame of idle. A student who asked
// the OS to stop moving things gets a still ram, not a frozen mid-stride pose.
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { CROSSFADE_MS, cycleMs, spriteKeyframes } from "../mascotMotion";
import idleStrip from "../../../tools/mascot/strips/idle-strip.png";
import walkStrip from "../../../tools/mascot/strips/walk-strip.png";
import walkLeftStrip from "../../../tools/mascot/strips/walk-left-strip.png";
import waveStrip from "../../../tools/mascot/strips/wave-strip.png";
import ponderStrip from "../../../tools/mascot/strips/ponder-strip.png";
import whatifStrip from "../../../tools/mascot/strips/whatif-strip.png";
import readingStrip from "../../../tools/mascot/strips/reading-strip.png";

export type MascotState =
  | "idle"
  | "walk"
  | "walk-left"
  | "wave"
  | "ponder"
  | "whatif"
  | "reading";

const SPRITES: Record<MascotState, string> = {
  idle: idleStrip,
  walk: walkStrip,
  "walk-left": walkLeftStrip,
  wave: waveStrip,
  ponder: ponderStrip,
  whatif: whatifStrip,
  reading: readingStrip,
};

// The advisor narrates itself (ADR 0024) — the mascot's aria-label speaks the
// same plain truth, not "mascot." Idle/walk are silent (aria-hidden) because
// they carry no status a screen-reader user needs.
const LABELS: Record<MascotState, string> = {
  idle: "",
  walk: "",
  "walk-left": "",
  wave: "",
  ponder: "Fordhawke is thinking",
  whatif: "Fordhawke is running a what-if",
  reading: "Fordhawke is reading your audit",
};

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

export default function Mascot({
  state = "idle",
  size = 130,
  className,
}: {
  state?: MascotState;
  size?: number;
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  // Reduced motion collapses to idle's first frame regardless of the requested
  // state — a still companion, never a frozen mid-gesture.
  const effState: MascotState = reduced ? "idle" : state;
  const label = LABELS[state];

  // Layers: the current pose, plus the outgoing one for CROSSFADE_MS after a
  // change, so a pose change dissolves instead of cutting (mascotMotion.ts).
  const [layers, setLayers] = useState<{ id: number; state: MascotState }[]>(() => [
    { id: 0, state: effState },
  ]);
  useEffect(() => {
    setLayers((prev) => {
      const top = prev[prev.length - 1];
      if (top.state === effState) return prev;
      // Reduced motion: swap, never dissolve.
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
        <SpriteLayer
          key={l.id}
          state={l.state}
          size={size}
          still={reduced}
          fade={layers.length > 1 ? (i === layers.length - 1 ? "in" : "out") : null}
        />
      ))}
    </span>
  );
}

// One strip, played by the Web Animations API from the MOTION table. The
// browser still owns the timing (no JS frame loop); script only builds the
// keyframes, which CSS steps() couldn't express for ping-pong.
function SpriteLayer({
  state,
  size,
  still,
  fade,
}: {
  state: MascotState;
  size: number;
  still: boolean;
  fade: "in" | "out" | null;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || still || typeof el.animate !== "function") return;
    const anim = el.animate(spriteKeyframes(state, size), {
      duration: cycleMs(state),
      iterations: Infinity,
    });
    return () => anim.cancel();
  }, [state, size, still]);
  return (
    <span
      ref={ref}
      className={`mascot${fade ? ` mascot-fade-${fade}` : ""}`}
      style={
        {
          "--cell": `${size}px`,
          "--sprite": `url(${SPRITES[state]})`,
        } as CSSProperties
      }
    />
  );
}

// The resident: Fordhawke living in the corner of the chat pane, always on.
// Waves once on arrival, then breathes idle at rest; while a turn is in flight
// the caller passes an `activity` pose (whatif/reading/ponder) and it takes
// over. Activity always wins over the opening wave. Under reduced motion every
// pose resolves to the same still idle frame, so the wave timer is harmless.
export function ResidentMascot({
  activity,
  size = 130,
  className,
}: {
  activity?: MascotState | null;
  size?: number;
  className?: string;
}) {
  const [greeting, setGreeting] = useState(true);
  useEffect(() => {
    // One full wave, however the table times it.
    const t = setTimeout(() => setGreeting(false), cycleMs("wave"));
    return () => clearTimeout(t);
  }, []);
  const state: MascotState = activity ?? (greeting ? "wave" : "idle");
  return <Mascot state={state} size={size} className={className} />;
}
