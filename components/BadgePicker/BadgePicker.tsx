'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useAnimatedPresence } from '@/lib/useAnimatedPresence';
import type { Badge } from '@/lib/types';
import styles from './BadgePicker.module.css';

export default function BadgePicker({
  badges,
  value,
  onChange,
  disabled = false,
  placeholder = 'Найти бейдж…',
  ariaLabelledBy,
}: {
  badges: Badge[];
  value: number[];
  onChange: (ids: number[]) => void;
  disabled?: boolean;
  placeholder?: string;
  ariaLabelledBy?: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const byId = useMemo(() => new Map(badges.map((b) => [b.id, b])), [badges]);
  const selected = value.map((id) => byId.get(id)).filter((b): b is Badge => !!b);

  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      badges
        .filter((b) => !value.includes(b.id))
        .filter((b) => (q ? b.name.toLowerCase().includes(q) : true)),
    [badges, value, q]
  );

  const dropdownShown = open && matches.length > 0;
  const dropdownMounted = useAnimatedPresence(dropdownShown, 140);

  const add = (b: Badge) => {
    if (!value.includes(b.id)) onChange([...value, b.id]);
    setQuery('');
    inputRef.current?.focus();
  };

  const remove = (id: number) => onChange(value.filter((x) => x !== id));

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && query === '' && value.length > 0) {
      remove(value[value.length - 1]);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (matches.length > 0) add(matches[0]);
      return;
    }
    if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <div
        className={`${styles.bar} ${disabled ? styles.barDisabled : ''}`}
        onClick={() => !disabled && inputRef.current?.focus()}
      >
        {selected.map((b) => (
          <span key={b.id} className={styles.chip}>
            <span className={styles.chipIcon} dangerouslySetInnerHTML={{ __html: b.svg }} />
            {b.name}
            {!disabled ? (
              <button
                type="button"
                className={styles.chipRemove}
                onClick={(e) => {
                  e.stopPropagation();
                  remove(b.id);
                }}
                aria-label={`Убрать бейдж ${b.name}`}
              >
                <X size={12} />
              </button>
            ) : null}
          </span>
        ))}
        <input
          ref={inputRef}
          className={styles.input}
          type="text"
          value={query}
          placeholder={selected.length === 0 ? placeholder : ''}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          autoComplete="off"
          aria-labelledby={ariaLabelledBy}
        />
      </div>

      {dropdownMounted ? (
        <div className={`${styles.dropdown} ${dropdownShown ? '' : styles.dropdownOut}`} role="listbox">
          {matches.map((b) => (
            <button key={b.id} type="button" className={styles.option} onClick={() => add(b)}>
              <span className={styles.optionIcon} dangerouslySetInnerHTML={{ __html: b.svg }} />
              <span>{b.name}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
