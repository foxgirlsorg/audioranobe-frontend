'use client';

import { useEffect } from 'react';

const NO_DRAG =
  'input, textarea, select, option, [contenteditable="true"], [contenteditable=""], [draggable="true"], [role="slider"]';

const THRESHOLD = 6;

function scrollableAncestor(start: EventTarget | null): HTMLElement | null {
  let el = start instanceof Element ? (start as HTMLElement) : null;
  for (; el && el !== document.body; el = el.parentElement) {
    if (el.scrollWidth - el.clientWidth < 2) continue;
    const overflowX = getComputedStyle(el).overflowX;
    if (overflowX === 'auto' || overflowX === 'scroll') return el;
  }
  return null;
}

export default function DragScroll() {
  useEffect(() => {
    let el: HTMLElement | null = null;
    let startX = 0;
    let startY = 0;
    let startScroll = 0;
    let pointerId = -1;
    let dragging = false;
    let snap = '';

    const stop = () => {
      if (el && dragging) {
        el.style.scrollSnapType = snap;
        if (el.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId);
      }
      document.body.classList.remove('drag-scrolling');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('dragstart', onDragStart);
      window.removeEventListener('blur', stop);
      el = null;
      dragging = false;
      pointerId = -1;
    };

    const onDragStart = (e: Event) => e.preventDefault();

    const onSelectStart = (e: Event) => {
      if (dragging) e.preventDefault();
    };

    const onMove = (e: PointerEvent) => {
      if (!el) return;
      if (e.buttons === 0) {
        onUp();
        return;
      }
      const dx = e.clientX - startX;

      if (!dragging) {
        if (Math.abs(dx) < THRESHOLD || Math.abs(dx) <= Math.abs(e.clientY - startY)) return;
        dragging = true;
        snap = el.style.scrollSnapType;
        el.style.scrollSnapType = 'none';
        document.body.classList.add('drag-scrolling');
        window.getSelection()?.removeAllRanges();
        try {
          el.setPointerCapture(pointerId);
        } catch {
        }
      }

      const max = el.scrollWidth - el.clientWidth;
      el.scrollLeft = Math.max(0, Math.min(max, startScroll - dx));
      startScroll = el.scrollLeft;
      startX = e.clientX;
    };

    const onUp = () => {
      if (dragging) {
        const swallow = (e: MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
        };
        window.addEventListener('click', swallow, { capture: true, once: true });
        setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0);
      }
      stop();
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      if (e.target instanceof Element && e.target.closest(NO_DRAG)) return;

      const found = scrollableAncestor(e.target);
      if (!found) return;

      el = found;
      startX = e.clientX;
      startY = e.clientY;
      startScroll = found.scrollLeft;
      pointerId = e.pointerId;
      dragging = false;

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
      window.addEventListener('dragstart', onDragStart);
      window.addEventListener('blur', stop);
    };

    window.addEventListener('pointerdown', onDown);
    document.addEventListener('selectstart', onSelectStart);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      document.removeEventListener('selectstart', onSelectStart);
      stop();
    };
  }, []);

  return null;
}
