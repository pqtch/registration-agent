// Implements: ADR 0032 (pin-to-top), ADR 0038 (the log's floor fits itself)
//
// The chat log's scroll contract. On send, the student's turn pins to the top
// and the answer streams visibly beneath it; nothing moves the pane again until
// the next send. "At the bottom" is measured on every scroll and every resize,
// never remembered. The floor under the log reserves the ram's corner at rest
// and, after a send, grows so the pinned turn has room to reach the top.
import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "./theme";

const BOTTOM_THRESHOLD = 40; // px: near the bottom counts as at it
const PIN_GAP = 8;

/** `floorMin` is the resident's band: his height plus a margin, or a little air when he's off. */
export function useLogScroll(floorMin: number) {
  const floorMinRef = useRef(floorMin);
  floorMinRef.current = floorMin;
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const floorRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pinnedTurnRef = useRef<HTMLElement | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  function measure() {
    const c = containerRef.current;
    if (!c) return;
    const at = c.scrollHeight - c.scrollTop - c.clientHeight < BOTTOM_THRESHOLD;
    setIsAtBottom((prev) => (prev === at ? prev : at));
  }

  function fitFloor() {
    const c = containerRef.current;
    const floor = floorRef.current;
    if (!c || !floor) return;
    let h = floorMinRef.current;
    const turn = pinnedTurnRef.current;
    if (turn?.isConnected) {
      const below = floor.getBoundingClientRect().top - turn.getBoundingClientRect().top;
      const padBottom = parseFloat(getComputedStyle(c).paddingBottom) || 0;
      h = Math.max(floorMinRef.current, c.clientHeight - PIN_GAP - below - padBottom);
    }
    floor.style.height = `${Math.round(h)}px`;
  }

  useEffect(() => {
    const c = containerRef.current;
    const content = contentRef.current;
    if (!c || !content) return;
    c.addEventListener("scroll", measure, { passive: true });
    // The floor sits outside `content`, so resizing it never re-triggers this.
    const ro = new ResizeObserver(() => {
      fitFloor();
      measure();
    });
    ro.observe(c);
    ro.observe(content);
    return () => {
      c.removeEventListener("scroll", measure);
      ro.disconnect();
    };
    // Refs only; registered once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pinLastUserTurn() {
    const c = containerRef.current;
    if (!c) return;
    const turns = c.querySelectorAll<HTMLElement>('[data-turn="user"]');
    const el = turns[turns.length - 1];
    if (!el) return;
    pinnedTurnRef.current = el;
    fitFloor(); // room first, or scrollTo clamps and the turn stays under the ram
    const top = c.scrollTop + (el.getBoundingClientRect().top - c.getBoundingClientRect().top) - PIN_GAP;
    c.scrollTo({ top, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }

  function landAtEnd() {
    const c = containerRef.current;
    if (c) c.scrollTop = c.scrollHeight;
    measure();
  }

  function scrollToBottom(smooth = false) {
    setIsAtBottom(true);
    requestAnimationFrame(() =>
      bottomRef.current?.scrollIntoView({ behavior: smooth && !prefersReducedMotion() ? "smooth" : "auto" })
    );
  }

  function resetPin() {
    pinnedTurnRef.current = null;
    fitFloor();
  }

  // A new size setting refits the floor at once.
  useEffect(() => {
    fitFloor();
    measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floorMin]);

  return { containerRef, contentRef, floorRef, bottomRef, isAtBottom, pinLastUserTurn, landAtEnd, scrollToBottom, resetPin };
}
