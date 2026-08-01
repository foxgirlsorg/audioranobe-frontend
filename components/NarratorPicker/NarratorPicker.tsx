'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, X } from 'lucide-react';
import { api } from '@/lib/api';
import type { NarratorCard, Paginated } from '@/lib/types';
import styles from '@/components/GenrePicker/GenrePicker.module.css';

export interface NarratorRef {
  id: number;
  slug: string;
  name: string;
  avatar_url?: string | null;
}

interface Props {
  value: NarratorRef[];
  onChange: (narrators: NarratorRef[]) => void;
  lockedIds?: number[];
  placeholder?: string;
}

export default function NarratorPicker({
  value,
  onChange,
  lockedIds = [],
  placeholder = 'Найти чтеца по названию…',
}: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NarratorCard[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const seqRef = useRef(0);

  useEffect(() => {
    const seq = ++seqRef.current;
    setLoading(true);
    const t = window.setTimeout(async () => {
      try {
        const d = await api<Paginated<NarratorCard>>('/narrators', {
          params: { q: query.trim(), per_page: 20 },
        });
        if (seq === seqRef.current) setResults(Array.isArray(d.items) ? d.items : []);
      } catch {
        if (seq === seqRef.current) setResults([]);
      } finally {
        if (seq === seqRef.current) setLoading(false);
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const selectedIds = useMemo(() => value.map((n) => n.id), [value]);
  const matches = useMemo(
    () => results.filter((n) => !selectedIds.includes(n.id)).slice(0, 20),
    [results, selectedIds]
  );

  const add = (n: NarratorRef) => {
    if (!selectedIds.includes(n.id)) onChange([...value, n]);
    setQuery('');
    inputRef.current?.focus();
  };

  const remove = (id: number) => {
    if (lockedIds.includes(id)) return;
    onChange(value.filter((n) => n.id !== id));
  };

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <div className={styles.bar} onClick={() => inputRef.current?.focus()}>
        {value.map((n) => {
          const locked = lockedIds.includes(n.id);
          return (
            <span key={n.id} className={styles.chip}>
              {n.name}
              {locked ? null : (
                <button
                  type="button"
                  className={styles.chipRemove}
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(n.id);
                  }}
                  aria-label={`Убрать чтеца ${n.name}`}
                >
                  <X size={12} />
                </button>
              )}
            </span>
          );
        })}
        <input
          ref={inputRef}
          className={styles.input}
          type="text"
          value={query}
          placeholder={value.length === 0 ? placeholder : ''}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && query === '' && value.length > 0) {
              remove(value[value.length - 1].id);
              return;
            }
            if (e.key === 'Enter') {
              e.preventDefault();
              if (matches.length > 0) add(matches[0]);
              return;
            }
            if (e.key === 'Escape') setOpen(false);
          }}
          autoComplete="off"
        />
      </div>

      {open ? (
        <div className={styles.dropdown} role="listbox">
          {matches.length === 0 ? (
            <div className={styles.option} aria-disabled="true">
              <span>{loading ? 'Ищем…' : 'Ничего не найдено'}</span>
            </div>
          ) : (
            matches.map((n) => (
              <button key={n.id} type="button" className={styles.option} onClick={() => add(n)}>
                <span className={styles.optionMain}>
                  {n.avatar_url ? (
                    <img src={n.avatar_url} alt="" className={styles.optionAvatar} />
                  ) : (
                    <span className={styles.optionAvatarFallback}>
                      <Mic size={11} />
                    </span>
                  )}
                  {n.name}
                </span>
                <span className={styles.optionCount}>{n.titles_count}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
