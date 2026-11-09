'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { api } from '@/lib/api';
import { LIMITS } from '@/lib/limits';
import { errMsg, useToast } from '@/lib/toast';
import { useAnimatedPresence } from '@/lib/useAnimatedPresence';
import type { Genre, Paginated } from '@/lib/types';
import Highlight from './Highlight';
import styles from './GenrePicker.module.css';

interface Props {
  value: number[];
  onChange: (ids: number[]) => void;
  allowCreate?: boolean;
  placeholder?: string;
  genres?: Genre[];
  onGenresChange?: (genres: Genre[]) => void;
  ariaLabelledBy?: string;
}

export default function GenrePicker({
  value,
  onChange,
  allowCreate = true,
  placeholder = 'Найти или создать тег…',
  genres: genresProp,
  onGenresChange,
  ariaLabelledBy,
}: Props) {
  const { toast } = useToast();
  const [ownGenres, setOwnGenres] = useState<Genre[]>([]);
  const genres = genresProp ?? ownGenres;

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const setGenres = (next: Genre[]) => {
    if (onGenresChange) onGenresChange(next);
    else setOwnGenres(next);
  };

  useEffect(() => {
    if (genresProp) return;
    let alive = true;
    api<Paginated<Genre>>('/genres', { params: { per_page: 2000 } })
      .then((d) => {
        if (alive) setOwnGenres(Array.isArray(d.items) ? d.items : []);
      })
      .catch(() => {
      });
    return () => {
      alive = false;
    };
  }, [genresProp]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const byId = useMemo(() => new Map(genres.map((g) => [g.id, g])), [genres]);
  const selected = value.map((id) => byId.get(id)).filter((g): g is Genre => !!g);

  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () => {
      const list = genres
        .filter((g) => !value.includes(g.id))
        .filter((g) => (q ? g.name.toLowerCase().includes(q) : true));
      if (!q) list.sort((a, b) => b.titles_count - a.titles_count);
      return list.slice(0, 30);
    },
    [genres, value, q]
  );

  const exactExists = genres.some((g) => g.name.trim().toLowerCase() === q);
  const canCreate = allowCreate && q.length > 0 && !exactExists;
  const dropdownShown = open && (matches.length > 0 || canCreate);
  const dropdownMounted = useAnimatedPresence(dropdownShown, 140);

  const add = (g: Genre) => {
    if (!value.includes(g.id)) onChange([...value, g.id]);
    setQuery('');
    inputRef.current?.focus();
  };

  const remove = (id: number) => onChange(value.filter((x) => x !== id));

  const createGenre = async () => {
    const name = query.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const created = await api<{ id: number; slug: string; name: string }>('/genres', {
        method: 'POST',
        body: { name },
      });
      const genre: Genre = { ...created, titles_count: 0, is_sensitive: false };
      if (!genres.some((g) => g.id === genre.id)) setGenres([...genres, genre]);
      if (!value.includes(genre.id)) onChange([...value, genre.id]);
      setQuery('');
      inputRef.current?.focus();
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setCreating(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && query === '' && value.length > 0) {
      remove(value[value.length - 1]);
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      if (matches.length > 0) {
        const step = e.key === 'ArrowDown' ? 1 : -1;
        setActive((i) => (i + step + matches.length) % matches.length);
      }
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (matches.length > 0) add(matches[Math.min(active, matches.length - 1)]);
      else if (canCreate) void createGenre();
      return;
    }
    if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div className={styles.wrap} ref={wrapRef}>
      {selected.length > 0 ? (
        <div className={styles.chips}>
          {selected.map((g) => (
            <span key={g.id} className={styles.chip}>
              {g.name}
              <button
                type="button"
                className={styles.chipRemove}
                onClick={() => remove(g.id)}
                aria-label={`Убрать тег ${g.name}`}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <div className={styles.bar}>
        <Search size={15} className={styles.searchIcon} aria-hidden="true" />
        <input
          ref={inputRef}
          className={styles.input}
          type="text"
          maxLength={LIMITS.genreName}
          value={query}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          autoComplete="off"
          aria-labelledby={ariaLabelledBy}
          aria-autocomplete="list"
        />
      </div>

      {dropdownMounted ? (
        <div className={`${styles.dropdown} ${dropdownShown ? '' : styles.dropdownOut}`} role="listbox">
          {!q && matches.length > 0 ? <div className={styles.dropHead}>Популярные</div> : null}
          {matches.map((g, i) => (
            <button
              key={g.id}
              type="button"
              role="option"
              aria-selected={i === active}
              className={i === active ? `${styles.option} ${styles.optionActive}` : styles.option}
              onMouseEnter={() => setActive(i)}
              onClick={() => add(g)}
            >
              <span>
                <Highlight text={g.name} query={query} />
              </span>
              <span className={styles.optionCount}>{g.titles_count}</span>
            </button>
          ))}
          {canCreate ? (
            <button
              type="button"
              className={`${styles.option} ${styles.createOption}`}
              disabled={creating}
              onClick={() => void createGenre()}
            >
              <Plus size={13} />
              {creating ? 'Создаём…' : `Создать тег «${query.trim()}»`}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
