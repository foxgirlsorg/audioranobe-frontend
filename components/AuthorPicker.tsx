'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { api } from '@/lib/api';
import { errMsg, useToast } from '@/lib/toast';
import type { Author, Paginated } from '@/lib/types';
import styles from './GenrePicker.module.css';

interface Props {
  value: Author | null;
  onChange: (author: Author | null) => void;
  placeholder?: string;
}

/**
 * Single-select author search. If the typed name doesn't exist yet the picker
 * offers to create the author inline, so adding a book is never blocked by a
 * missing one. Reuses the genre picker's chip-in-a-search-bar styling.
 */
export default function AuthorPicker({
  value,
  onChange,
  placeholder = 'Найти или создать автора…',
}: Props) {
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Author[]>([]);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const seqRef = useRef(0);

  useEffect(() => {
    const seq = ++seqRef.current;
    const t = window.setTimeout(async () => {
      try {
        const d = await api<Paginated<Author>>('/authors', {
          params: { q: query.trim(), per_page: 20 },
        });
        if (seq === seqRef.current) setResults(Array.isArray(d.items) ? d.items : []);
      } catch {
        // best-effort — the create path still works
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

  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () => results.filter((a) => a.id !== value?.id).slice(0, 20),
    [results, value]
  );
  const exactExists = results.some((a) => a.name.trim().toLowerCase() === q);
  const canCreate = q.length > 0 && !exactExists;

  const pick = (a: Author) => {
    onChange(a);
    setQuery('');
    setOpen(false);
  };

  const createAuthor = async () => {
    const name = query.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const created = await api<{ id: number; slug: string; name: string }>('/authors', {
        method: 'POST',
        body: { name },
      });
      pick({ ...created, titles_count: 0 });
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setCreating(false);
  };

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <div className={styles.bar} onClick={() => inputRef.current?.focus()}>
        {value ? (
          <span className={styles.chip}>
            {value.name}
            <button
              type="button"
              className={styles.chipRemove}
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
              aria-label={'Убрать автора'}
            >
              <X size={12} />
            </button>
          </span>
        ) : null}
        <input
          ref={inputRef}
          className={styles.input}
          type="text"
          value={query}
          placeholder={value ? '' : placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (matches.length > 0) pick(matches[0]);
              else if (canCreate) void createAuthor();
            }
            if (e.key === 'Escape') setOpen(false);
          }}
          autoComplete="off"
        />
      </div>

      {open && (matches.length > 0 || canCreate) ? (
        <div className={styles.dropdown} role="listbox">
          {matches.map((a) => (
            <button key={a.id} type="button" className={styles.option} onClick={() => pick(a)}>
              <span>{a.name}</span>
              <span className={styles.optionCount}>{a.titles_count}</span>
            </button>
          ))}
          {canCreate ? (
            <button
              type="button"
              className={`${styles.option} ${styles.createOption}`}
              disabled={creating}
              onClick={() => void createAuthor()}
            >
              <Plus size={13} />
              {creating ? 'Создаём…' : `Создать автора «${query.trim()}»`}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
