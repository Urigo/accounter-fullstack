import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import type { Point } from './types.js';
import {
  decayVelocity,
  INERTIA_MIN_SPEED,
  INERTIA_WINDOW_MS,
  normalizeWheelDeltaY,
  pinchZoomFactor,
  releaseVelocity,
  wheelZoomFactor,
  type PanSample,
} from './viewer-geometry.js';

/** Safari's trackpad pinch. Not part of `lib.dom`. */
type GestureEvent = UIEvent & { scale: number; clientX: number; clientY: number };

export interface ViewerGestureHandlers {
  zoomByFactor(factor: number, client: Point): void;
  toggleAt(client: Point): void;
  onPanChange?(panning: boolean): void;
}

/** Movement before a press turns into a pan, so a click stays a click. */
const PAN_THRESHOLD_PX = 3;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_PX = 24;
/** A glide never outlasts about two seconds at 60fps, whatever the frame timing. */
const INERTIA_MAX_FRAMES = 120;

type Pan = {
  pointerId: number;
  pointerType: string;
  start: Point;
  scroll: Point;
  active: boolean;
  /** Recent positions of a touch pan, for the release velocity. */
  samples: PanSample[];
};

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
}

/**
 * Pointer, wheel and pinch handling for the canvas scroll box.
 *
 * - Ctrl/⌘ + wheel — which is also how Chrome, Edge and Firefox report a trackpad pinch — zooms at
 *   the cursor. React's `onWheel` is passive and cannot `preventDefault`, so the listener is added
 *   by hand. A plain wheel stays native scrolling.
 * - Safari reports a trackpad pinch through `gesture*` events instead. On touch devices Pointer
 *   Events drive the pinch, so there the gesture events are only cancelled, never applied.
 * - A primary-button drag pans by moving the scroll position. Two touch pointers pinch.
 * - A touch pan glides on after release. The canvas is `touch-none`, which drops the browser's own
 *   momentum, so a light inertia stands in: the last 100ms of velocity, decayed per frame. The next
 *   press stops it, and it is off under `prefers-reduced-motion`.
 *
 * Drag tracking listens on `window` rather than relying on pointer capture, because vaul's own
 * `pointerdown` captures the pointer on the event target. Nothing here stops propagation: Radix's
 * outside-click detection would otherwise keep its "inside" flag set and swallow the next click.
 */
export function useViewerGestures(
  scrollRef: RefObject<HTMLDivElement | null>,
  enabled: boolean,
  handlers: ViewerGestureHandlers,
): void {
  const handlersRef = useRef(handlers);
  useLayoutEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !enabled) {
      return;
    }

    const touches = new Map<number, Point>();
    let pan: Pan | null = null;
    let pinchDistance: number | null = null;
    let pinched = false;
    let gestureActive = false;
    let gestureScale = 1;
    let lastPointerType = '';
    let lastTap: { time: number; point: Point } | null = null;
    let listening = false;
    let inertiaFrame = 0;

    const stopInertia = (): void => {
      if (inertiaFrame) {
        cancelAnimationFrame(inertiaFrame);
        inertiaFrame = 0;
      }
    };

    const startInertia = (samples: PanSample[], now: number): void => {
      let v = releaseVelocity(samples, now);
      if (Math.hypot(v.x, v.y) < INERTIA_MIN_SPEED || prefersReducedMotion()) {
        return;
      }
      let last = now;
      let frames = 0;
      const frame = (time: number): void => {
        const dt = Math.max(0, time - last);
        last = time;
        frames += 1;
        const before = { x: el.scrollLeft, y: el.scrollTop };
        // The finger moved the page; scrolling runs the other way.
        el.scrollLeft = before.x - v.x * dt;
        el.scrollTop = before.y - v.y * dt;
        v = decayVelocity(v, dt);
        const stuck = el.scrollLeft === before.x && el.scrollTop === before.y && dt > 0;
        if (Math.hypot(v.x, v.y) < INERTIA_MIN_SPEED || stuck || frames >= INERTIA_MAX_FRAMES) {
          inertiaFrame = 0;
          return;
        }
        inertiaFrame = requestAnimationFrame(frame);
      };
      inertiaFrame = requestAnimationFrame(frame);
    };

    const touchDistance = (): number => {
      const [a, b] = [...touches.values()];
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
    };
    const touchMidpoint = (): Point => {
      const [a, b] = [...touches.values()];
      return a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : { x: 0, y: 0 };
    };

    const endPan = (): void => {
      if (pan?.active) {
        handlersRef.current.onPanChange?.(false);
      }
      pan = null;
    };

    const onWheel = (e: WheelEvent): void => {
      if (!(e.ctrlKey || e.metaKey)) {
        return;
      }
      e.preventDefault();
      if (gestureActive) {
        return;
      }
      const delta = normalizeWheelDeltaY(e, el.clientHeight);
      handlersRef.current.zoomByFactor(wheelZoomFactor(delta), { x: e.clientX, y: e.clientY });
    };

    const onGestureStart = (event: Event): void => {
      event.preventDefault();
      gestureActive = true;
      gestureScale = 1;
    };
    const onGestureChange = (event: Event): void => {
      event.preventDefault();
      const e = event as GestureEvent;
      if (touches.size > 0 || navigator.maxTouchPoints > 0) {
        return;
      }
      const factor = gestureScale > 0 ? e.scale / gestureScale : 1;
      gestureScale = e.scale;
      handlersRef.current.zoomByFactor(factor, { x: e.clientX, y: e.clientY });
    };
    const onGestureEnd = (event: Event): void => {
      event.preventDefault();
      gestureActive = false;
    };

    const onPointerMove = (e: PointerEvent): void => {
      if (e.pointerType === 'touch' && touches.has(e.pointerId)) {
        touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pinchDistance != null && touches.size >= 2) {
          const distance = touchDistance();
          handlersRef.current.zoomByFactor(
            pinchZoomFactor(pinchDistance, distance),
            touchMidpoint(),
          );
          pinchDistance = distance;
          return;
        }
      }
      if (!pan || e.pointerId !== pan.pointerId) {
        return;
      }
      const dx = e.clientX - pan.start.x;
      const dy = e.clientY - pan.start.y;
      if (!pan.active) {
        if (Math.hypot(dx, dy) < PAN_THRESHOLD_PX) {
          return;
        }
        pan.active = true;
        handlersRef.current.onPanChange?.(true);
      }
      el.scrollLeft = pan.scroll.x - dx;
      el.scrollTop = pan.scroll.y - dy;
      if (pan.pointerType === 'touch') {
        const t = performance.now();
        pan.samples.push({ x: e.clientX, y: e.clientY, t });
        // Only the newest window matters; keep the list short on a long pan.
        while (pan.samples.length > 2 && t - (pan.samples[0]?.t ?? t) > INERTIA_WINDOW_MS) {
          pan.samples.shift();
        }
      }
    };

    const stopListening = (): void => {
      if (!listening) {
        return;
      }
      listening = false;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
    };

    const finishPointer = (e: PointerEvent, cancelled: boolean): void => {
      const wasTouch = touches.delete(e.pointerId);
      if (touches.size < 2) {
        pinchDistance = null;
      }
      if (pan && pan.pointerId === e.pointerId) {
        const wasPan = pan.active;
        const { samples } = pan;
        endPan();
        if (wasTouch && wasPan && !pinched && !cancelled && touches.size === 0) {
          startInertia(samples, performance.now());
        }
        if (wasTouch && !wasPan && !pinched && !cancelled) {
          const now = performance.now();
          const point = { x: e.clientX, y: e.clientY };
          if (
            lastTap &&
            now - lastTap.time <= DOUBLE_TAP_MS &&
            Math.hypot(point.x - lastTap.point.x, point.y - lastTap.point.y) <= DOUBLE_TAP_PX
          ) {
            lastTap = null;
            handlersRef.current.toggleAt(point);
          } else {
            lastTap = { time: now, point };
          }
        }
      }
      if (touches.size === 0) {
        pinched = false;
      }
      if (touches.size === 0 && !pan) {
        stopListening();
      }
    };
    function onPointerUp(e: PointerEvent): void {
      finishPointer(e, false);
    }
    function onPointerCancel(e: PointerEvent): void {
      finishPointer(e, true);
    }

    const onPointerDown = (e: PointerEvent): void => {
      // A new press catches the glide.
      stopInertia();
      lastPointerType = e.pointerType;
      if (e.pointerType === 'touch') {
        touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (touches.size >= 2) {
          // A second finger turns the pan into a pinch.
          endPan();
          pinched = true;
          lastTap = null;
          pinchDistance = touchDistance();
          return;
        }
      } else if (e.button !== 0) {
        return;
      }
      pan = {
        pointerId: e.pointerId,
        pointerType: e.pointerType,
        start: { x: e.clientX, y: e.clientY },
        scroll: { x: el.scrollLeft, y: el.scrollTop },
        active: false,
        samples: [],
      };
      try {
        el.setPointerCapture?.(e.pointerId);
      } catch {
        // Capture is a nicety; the window listeners below do the tracking.
      }
      if (!listening) {
        listening = true;
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('pointercancel', onPointerCancel);
      }
    };

    const onDoubleClick = (e: MouseEvent): void => {
      if (lastPointerType === 'touch') {
        return;
      }
      handlersRef.current.toggleAt({ x: e.clientX, y: e.clientY });
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('gesturestart', onGestureStart);
    el.addEventListener('gesturechange', onGestureChange);
    el.addEventListener('gestureend', onGestureEnd);
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('dblclick', onDoubleClick);

    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', onGestureStart);
      el.removeEventListener('gesturechange', onGestureChange);
      el.removeEventListener('gestureend', onGestureEnd);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('dblclick', onDoubleClick);
      stopListening();
      stopInertia();
      endPan();
    };
  }, [scrollRef, enabled]);
}
