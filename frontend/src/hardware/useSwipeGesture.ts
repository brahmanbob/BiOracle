/**
 * useSwipeGesture.ts
 * Generic swipe detector. Fires `onSwipe(direction)` once per gesture.
 */
import { useEffect } from "react";

export type SwipeDirection = "up" | "down" | "left" | "right";

export function useSwipeGesture(
  onSwipe: (dir: SwipeDirection) => void,
  options?: { threshold?: number; target?: HTMLElement | Window | null; enabled?: boolean },
) {
  const threshold = options?.threshold ?? 60;
  const target = (options?.target as any) ?? window;
  const enabled = options?.enabled ?? true;

  useEffect(() => {
    if (!enabled) return;
    let startX = 0, startY = 0, startT = 0, tracking = false;

    const onStart = (e: TouchEvent | PointerEvent) => {
      const p = "touches" in e ? e.touches[0] : (e as PointerEvent);
      startX = p.clientX;
      startY = p.clientY;
      startT = Date.now();
      tracking = true;
    };
    const onEnd = (e: TouchEvent | PointerEvent) => {
      if (!tracking) return;
      tracking = false;
      const p = "changedTouches" in e ? e.changedTouches[0] : (e as PointerEvent);
      const dx = p.clientX - startX;
      const dy = p.clientY - startY;
      const dt = Date.now() - startT;
      if (dt > 1000) return; // too slow
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      if (Math.max(ax, ay) < threshold) return;
      if (ax > ay) {
        onSwipe(dx > 0 ? "right" : "left");
      } else {
        onSwipe(dy > 0 ? "down" : "up");
      }
    };

    target.addEventListener("touchstart", onStart, { passive: true });
    target.addEventListener("touchend", onEnd, { passive: true });
    target.addEventListener("pointerdown", onStart);
    target.addEventListener("pointerup", onEnd);
    return () => {
      target.removeEventListener("touchstart", onStart);
      target.removeEventListener("touchend", onEnd);
      target.removeEventListener("pointerdown", onStart);
      target.removeEventListener("pointerup", onEnd);
    };
  }, [onSwipe, threshold, target, enabled]);
}
