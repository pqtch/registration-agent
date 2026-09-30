// Implements: ADR 0032 (paced streaming)
//
// The worker's text deltas arrive in network-sized bursts, and rendered raw they
// read as slabs. They land in a buffer that each animation frame drains in
// proportion to its length: fast when behind, gentle when caught up. `done`
// waits for the buffer to empty so a turn never closes mid-word. Under reduced
// motion, text lands as it arrives.
import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "./theme";

export interface PacedStream {
  push(delta: string): void;
  /** The turn is over; finish once the buffer has drained. */
  done(): void;
  /** Land everything buffered now (before a tool chip, an error, a stop). */
  flush(): void;
}

export function usePacedStream(append: (delta: string) => void, finish: () => void): PacedStream {
  const handlers = useRef({ append, finish });
  handlers.current = { append, finish };
  const api = useRef<(PacedStream & { stop(): void }) | null>(null);

  if (!api.current) {
    let buf = "";
    let raf: number | null = null;
    let donePending = false;
    const step = () => {
      if (!buf.length) {
        raf = null;
        if (donePending) {
          donePending = false;
          handlers.current.finish();
        }
        return;
      }
      const n = Math.max(2, Math.ceil(buf.length / 10));
      const chunk = buf.slice(0, n);
      buf = buf.slice(n);
      handlers.current.append(chunk);
      raf = requestAnimationFrame(step);
    };
    api.current = {
      push(delta) {
        if (prefersReducedMotion()) return handlers.current.append(delta);
        buf += delta;
        if (raf === null) raf = requestAnimationFrame(step);
      },
      done() {
        if (buf.length || raf !== null) donePending = true;
        else handlers.current.finish();
      },
      flush() {
        if (raf !== null) cancelAnimationFrame(raf);
        raf = null;
        if (buf.length) handlers.current.append(buf);
        buf = "";
        if (donePending) {
          donePending = false;
          handlers.current.finish();
        }
      },
      stop() {
        if (raf !== null) cancelAnimationFrame(raf);
        raf = null;
      },
    };
  }

  useEffect(() => () => api.current?.stop(), []);
  return api.current;
}
