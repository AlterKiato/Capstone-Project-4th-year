'use client';

/*! React Bits Swipe Toast, David Haz (2026), MIT + Commons Clause.
 * Full notice: /licenses/react-bits-swipe-toast.txt; local adaptations: NOTICE.md. */
import React, { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { animate, motion, useMotionValue, useTransform } from 'motion/react';

import './SwipeToast.css';

export type SwipeToastCloseReason = 'timeout' | 'swipe' | 'action' | 'close' | 'escape' | 'programmatic';
export type SwipeToastFuse = 'bottom' | 'top' | 'none';
export type SwipeToastPhase = 'open' | 'closing' | 'gone';

export interface SwipeToastProps {
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actionLabel?: ReactNode;
  onAction?: () => void;
  open?: boolean;
  onClose?: (reason: SwipeToastCloseReason) => void;
  background?: string;
  color?: string;
  fuseColor?: string;
  width?: number;
  radius?: number;
  slideMs?: number;
  settleBounce?: number;
  swipeDistance?: number;
  duration?: number;
  fuse?: SwipeToastFuse;
  pauseOnHover?: boolean;
  closeButton?: boolean;
  inline?: boolean;
  dismissible?: boolean;
  className?: string;
  announce?: boolean;
}

type Sample = [number, number];

interface Drag {
  id: number;
  startY: number;
  grab: number | null;
  moved: boolean;
  hist: Sample[];
}

interface Latest {
  onClose?: (reason: SwipeToastCloseReason) => void;
  onAction?: () => void;
  slideMs: number;
  inline: boolean;
}

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];
const FLICK = 0.11;
const DEAD_ZONE = 3;
const RESIST_PX = 24;
const COLLAPSE_MS = 200;
const EXIT = 0.7;
const BURN = [{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }];
const reducedSnapshot = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const reducedServerSnapshot = () => false;
const subscribeReduced = (notify: () => void) => {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  query.addEventListener('change', notify);
  return () => query.removeEventListener('change', notify);
};

const rubberband = (over: number, dim: number, c = 0.55) => (over * dim * c) / (dim + c * Math.abs(over));
const velocityOf = (hist: Sample[]) => {
  if (hist.length < 2) return 0;
  const [t0, y0] = hist[0];
  const [t1, y1] = hist[hist.length - 1];
  return performance.now() - t1 > 100 ? 0 : (y1 - y0) / Math.max(1, t1 - t0);
};

const SwipeToast: React.FC<SwipeToastProps> = ({
  title = 'File archived',
  description = '',
  icon,
  actionLabel = '',
  onAction,
  open = true,
  onClose,
  background = '#27272a',
  color = '#f5f5f5',
  fuseColor = '#f5a524',
  width = 356,
  radius = 12,
  slideMs = 400,
  settleBounce = 0.2,
  swipeDistance = 40,
  duration = 4000,
  fuse = 'bottom',
  pauseOnHover = true,
  closeButton = false,
  inline = false,
  dismissible = true,
  className = '',
  announce = true
}) => {
  const reduce = useSyncExternalStore(subscribeReduced, reducedSnapshot, reducedServerSnapshot);
  const [phase, setPhase] = useState<SwipeToastPhase>('open');
  const [instant, setInstant] = useState(false);
  const [mounted, setMounted] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const fuseRef = useRef<HTMLElement>(null);
  const anim = useRef<Animation | null>(null);
  const drag = useRef<Drag | null>(null);
  const flags = useRef({ hover: false, interacting: false, focus: false, hidden: false });
  const pendingClose = useRef<SwipeToastCloseReason | null>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const burnTimer = useRef<number | undefined>(undefined);
  const remaining = useRef(duration);
  const runningSince = useRef<number | null>(null);
  const active = useRef(false);
  const closeRef = useRef<(why: SwipeToastCloseReason) => void>(() => {});
  const leaving = useRef(false);
  const phaseRef = useRef(phase);
  const latest = useRef<Latest>({} as Latest);
  useLayoutEffect(() => { latest.current = { onClose, onAction, slideMs, inline }; }, [onClose, onAction, slideMs, inline]);

  const y = useMotionValue(0);
  const fade = useMotionValue(1);
  const transform = useTransform(y, v => `translateY(${v}px)`);

  const syncFuse = () => {
    const a = anim.current;
    const f = flags.current;
    if (f.hover || f.interacting || f.focus || f.hidden) {
      a?.pause();
      if (runningSince.current !== null) remaining.current = Math.max(0, remaining.current - (Date.now() - runningSince.current));
      runningSince.current = null;
      window.clearTimeout(burnTimer.current);
      burnTimer.current = undefined;
    } else if (active.current && phaseRef.current === 'open' && duration > 0 && runningSince.current === null) {
      if (a?.playState === 'paused') a.play();
      runningSince.current = Date.now();
      burnTimer.current = window.setTimeout(() => { if (active.current) closeRef.current('timeout'); }, remaining.current);
    }
  };
  const finish = (why: SwipeToastCloseReason) => {
    if (!active.current) return;
    phaseRef.current = 'gone';
    setPhase('gone');
    leaving.current = false;
    if (latest.current.inline) closeTimer.current = window.setTimeout(() => { if (active.current) latest.current.onClose?.(why); }, COLLAPSE_MS);
    else latest.current.onClose?.(why);
  };
  const close = (why: SwipeToastCloseReason) => {
    if (phaseRef.current !== 'open' || leaving.current) return;
    if (drag.current) {
      pendingClose.current = why;
      return;
    }
    anim.current?.pause();
    window.clearTimeout(burnTimer.current);
    runningSince.current = null;
    const now = reduce;
    setInstant(now);
    phaseRef.current = 'closing';
    setPhase('closing');
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => finish(why), now ? 0 : latest.current.slideMs * EXIT + 60);
  };
  const rescue = () => {
    window.clearTimeout(closeTimer.current);
    setInstant(false);
    y.set(0);
    fade.set(1);
    phaseRef.current = 'open';
    setPhase('open');
  };

  useLayoutEffect(() => { closeRef.current = close; });

  useEffect(() => {
    if (!open) close('programmatic');
    else if (phaseRef.current !== 'open') rescue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    if (phase !== 'open' || duration <= 0 || !fuseRef.current) return undefined;
    remaining.current = duration;
    runningSince.current = null;
    anim.current?.cancel();
    const a = fuseRef.current.animate(BURN, { duration, easing: 'linear', fill: 'forwards' });
    if (reduce) a.cancel();
    anim.current = a;
    syncFuse();
    return () => {
      a.onfinish = null;
      a.cancel();
      window.clearTimeout(burnTimer.current);
      runningSince.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, duration]);
  useEffect(() => {
    active.current = true;
    flags.current.hidden = document.hidden;
    syncFuse();
    if (!pauseOnHover) {
      flags.current.hover = false;
      syncFuse();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pauseOnHover]);
  useEffect(() => {
    const onVisibility = () => {
      flags.current.hidden = document.hidden;
      syncFuse();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      active.current = false;
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearTimeout(closeTimer.current);
      window.clearTimeout(burnTimer.current);
      anim.current?.cancel();
      y.stop(); fade.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const swipeOut = (dy: number, v: number) => {
    anim.current?.pause();
    window.clearTimeout(burnTimer.current);
    leaving.current = true;
    pendingClose.current = null;
    if (!reduce && cardRef.current) {
      animate(y, dy + cardRef.current.offsetHeight, { type: 'spring', duration: 0.3, bounce: 0, velocity: v * 1000 });
    }
    animate(fade, 0, { duration: reduce ? 0 : 0.3, ease: EASE_OUT }).then(() => finish('swipe'));
  };
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (
      e.button !== 0 ||
      !dismissible ||
      drag.current ||
      leaving.current ||
      (e.target as HTMLElement).closest('button')
    )
      return;
    if (phaseRef.current === 'closing') rescue();
    try {
      cardRef.current?.setPointerCapture(e.pointerId);
    } catch {}
    y.stop();
    drag.current = {
      id: e.pointerId,
      startY: e.clientY,
      grab: null,
      moved: false,
      hist: [[performance.now(), y.get()]]
    };
    flags.current.interacting = true;
    syncFuse();
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    if (d.grab === null) {
      if (Math.abs(e.clientY - d.startY) < DEAD_ZONE) return;
      d.grab = e.clientY - y.get();
      if (cardRef.current) cardRef.current.dataset.swiping = '';
    }
    const raw = e.clientY - d.grab;
    const next = raw >= 0 ? raw : rubberband(raw, RESIST_PX);
    y.set(next);
    d.moved = true;
    d.hist.push([performance.now(), next]);
    if (d.hist.length > 4) d.hist.shift();
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (cardRef.current) delete cardRef.current.dataset.swiping;
    try {
      cardRef.current?.releasePointerCapture(e.pointerId);
    } catch {}
    flags.current.interacting = false;
    const dy = y.get();
    const v = velocityOf(d.hist);
    if (dy > 0 && (v > FLICK || (dy >= swipeDistance && v >= 0))) {
      swipeOut(dy, v);
      return;
    }
    if (d.moved) {
      animate(
        y,
        0,
        reduce
          ? { duration: 0.2, ease: EASE_OUT }
          : { type: 'spring', duration: 0.5, bounce: settleBounce, velocity: v * 1000 }
      );
    }
    const queued = pendingClose.current;
    pendingClose.current = null;
    if (queued) close(queued);
    else syncFuse();
  };

  return (
    <div
      className={`swipe-toast${className ? ` ${className}` : ''}`}
      data-phase={phase}
      data-inline={inline ? 'true' : 'false'}
      data-fuse={duration > 0 ? fuse : 'none'}
      data-dismissible={dismissible ? 'true' : 'false'}
      data-instant={instant ? '' : undefined}
      data-mounted={mounted ? 'true' : 'false'}
      style={
        {
          '--st-bg': background,
          '--st-ink': color,
          '--st-fuse': fuseColor,
          '--st-w': `${width}px`,
          '--st-radius': `${radius}px`,
          '--st-slide': `${slideMs}ms`,
          '--st-gap': '10px'
        } as CSSProperties
      }
    >
      <div className="swipe-toast__gate">
        <div className="swipe-toast__lift">
          <motion.div
            ref={cardRef}
            className="swipe-toast__card"
            role={announce ? 'status' : 'group'}
            aria-label={announce ? undefined : 'Unsaved feedback notification'}
            aria-live={announce ? 'polite' : 'off'}
            aria-atomic="true"
            tabIndex={0}
            style={{ transform, opacity: fade }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={e => {
              const d = drag.current;
              if (d?.id !== e.pointerId) return;
              drag.current = null; pendingClose.current = null;
              delete e.currentTarget.dataset.swiping;
              flags.current.interacting = false;
              y.set(0); syncFuse();
            }}
            onPointerEnter={e => {
              if (pauseOnHover && e.pointerType === 'mouse') {
                flags.current.hover = true;
                syncFuse();
              }
            }}
            onPointerLeave={e => {
              if (e.pointerType === 'mouse') {
                flags.current.hover = false;
                syncFuse();
              }
            }}
            onFocus={() => {
              flags.current.focus = true;
              syncFuse();
            }}
            onBlur={e => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                flags.current.focus = false;
                syncFuse();
              }
            }}
            onKeyDown={e => {
              if (e.key === 'Escape' && dismissible) {
                e.stopPropagation();
                close('escape');
              }
            }}
          >
            {icon ? (
              <span className="swipe-toast__icon" aria-hidden="true">
                {icon}
              </span>
            ) : null}
            <span className="swipe-toast__body">
              <span className="swipe-toast__title">{title}</span>
              {description ? <span className="swipe-toast__desc">{description}</span> : null}
            </span>
            {actionLabel ? (
              <button
                type="button"
                className="swipe-toast__action"
                onClick={() => {
                  latest.current.onAction?.();
                  close('action');
                }}
              >
                {actionLabel}
              </button>
            ) : null}
            {closeButton ? (
              <button type="button" className="swipe-toast__close" aria-label="Dismiss unsaved feedback notification" onClick={() => close('close')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" focusable="false"><path d="m6 6 12 12M18 6 6 18" /></svg>
              </button>
            ) : null}
            <i ref={fuseRef} className="swipe-toast__fuse" aria-hidden="true" />
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default SwipeToast;
