'use client';

import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { useAnimatedPresence } from '@/lib/useAnimatedPresence';
import styles from './Select.module.css';

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  hint?: string;
  disabled?: boolean;
}

export default function Select<T extends string = string>({
  value,
  options,
  onChange,
  placeholder = 'Не выбрано',
  disabled = false,
  id,
  ariaLabel,
  size = 'md',
  block = false,
  className = '',
  buttonClassName = '',
}: {
  value: T | '';
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  ariaLabel?: string;
  size?: 'sm' | 'md';
  block?: boolean;
  className?: string;
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [pos, setPos] = useState<{ left: number; top: number; width: number; up: boolean } | null>(
    null
  );
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dropdownMounted = useAnimatedPresence(open, 130);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const typeahead = useRef({ buffer: '', at: 0 });

  const listId = useId();
  const selectedIdx = options.findIndex((o) => o.value === value);
  const selected = selectedIdx >= 0 ? options[selectedIdx] : null;

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    setActiveIdx(-1);
    if (refocus) btnRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || listRef.current?.contains(t)) return;
      close(false);
    };
    const onScroll = () => close(false);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, close]);

  useLayoutEffect(() => {
    // Leaves `pos` in place on close (rather than nulling it) so the menu can
    // keep rendering at its last position while useAnimatedPresence keeps it
    // mounted for the exit animation.
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const needed = Math.min(options.length * 38 + 8, 280);
    const up = r.bottom + needed > window.innerHeight && r.top > needed;
    setPos({
      left: r.left,
      top: up ? r.top - 5 : r.bottom + 5,
      width: r.width,
      up,
    });
  }, [open, options.length]);

  useEffect(() => {
    if (open) setActiveIdx(selectedIdx >= 0 ? selectedIdx : 0);
  }, [open, selectedIdx]);

  useEffect(() => {
    if (!open || activeIdx < 0) return;
    const node = listRef.current?.children[activeIdx] as HTMLElement | undefined;
    node?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIdx]);

  function commit(idx: number) {
    const opt = options[idx];
    if (!opt || opt.disabled) return;
    close(true);
    if (opt.value !== value) onChange(opt.value);
  }

  function step(from: number, dir: 1 | -1): number {
    const n = options.length;
    if (n === 0) return -1;
    let i = from;
    for (let hops = 0; hops < n; hops++) {
      i = (i + dir + n) % n;
      if (!options[i].disabled) return i;
    }
    return from;
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;

    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        close(true);
        return;
      case 'Tab':
        close(false);
        return;
      case 'ArrowDown':
        e.preventDefault();
        setActiveIdx((i) => step(i < 0 ? -1 : i, 1));
        return;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIdx((i) => step(i < 0 ? 0 : i, -1));
        return;
      case 'Home':
        e.preventDefault();
        setActiveIdx(step(-1, 1));
        return;
      case 'End':
        e.preventDefault();
        setActiveIdx(step(0, -1));
        return;
      case 'Enter':
      case ' ':
        e.preventDefault();
        commit(activeIdx);
        return;
      default:
        break;
    }

    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const now = Date.now();
      const t = typeahead.current;
      t.buffer = now - t.at > 700 ? e.key : t.buffer + e.key;
      t.at = now;
      const prefix = t.buffer.toLowerCase();
      const hit = options.findIndex(
        (o) => !o.disabled && o.label.toLowerCase().startsWith(prefix)
      );
      if (hit >= 0) setActiveIdx(hit);
    }
  }

  const wrapCls = [styles.wrap, block ? styles.block : '', className].filter(Boolean).join(' ');
  const btnCls = [
    styles.button,
    size === 'sm' ? styles.sm : '',
    open ? styles.buttonOpen : '',
    buttonClassName,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={wrapCls} ref={wrapRef}>
      <button
        type="button"
        id={id}
        ref={btnRef}
        className={btnCls}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKeyDown}
      >
        <span className={selected ? styles.value : styles.placeholder}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={14} className={open ? styles.chevOpen : styles.chev} />
      </button>

      {dropdownMounted && mounted && pos
        ? createPortal(
            <ul
              id={listId}
              ref={listRef}
              className={[
                styles.menu,
                pos.up ? styles.menuUp : '',
                open ? '' : styles.menuOut,
              ]
                .filter(Boolean)
                .join(' ')}
              style={{
                left: pos.left,
                width: pos.width,
                ...(pos.up ? { bottom: window.innerHeight - pos.top } : { top: pos.top }),
              }}
              role="listbox"
              aria-activedescendant={activeIdx >= 0 ? `${listId}-${activeIdx}` : undefined}
              tabIndex={-1}
            >
          {options.map((o, i) => {
            const cls = [
              styles.option,
              o.value === value ? styles.optionOn : '',
              i === activeIdx ? styles.optionActive : '',
              o.disabled ? styles.optionDisabled : '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <li
                key={o.value}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={o.value === value}
                aria-disabled={o.disabled || undefined}
                className={cls}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commit(i)}
                onMouseEnter={() => !o.disabled && setActiveIdx(i)}
              >
                <span className={styles.optionText}>
                  <span className={styles.optionLabel}>{o.label}</span>
                  {o.hint ? <span className={styles.optionHint}>{o.hint}</span> : null}
                </span>
                {o.value === value ? <Check size={13} className={styles.tick} /> : null}
              </li>
            );
          })}
            </ul>,
            document.body
          )
        : null}
    </div>
  );
}
