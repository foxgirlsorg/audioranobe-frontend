'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useAnimatedPresence } from '@/lib/useAnimatedPresence';
import type { UserSearchHit } from '@/lib/types';
import UserAvatar from '@/components/UserAvatar/UserAvatar';
import base from '@/components/GenrePicker/GenrePicker.module.css';
import styles from './UserPicker.module.css';

const MIN_QUERY = 2;

interface Props {
  value: UserSearchHit | null;
  onChange: (user: UserSearchHit | null) => void;
  /** Accounts that can't be picked here (e.g. the current owner). */
  excludeIds?: number[];
  placeholder?: string;
  disabled?: boolean;
  ariaLabelledBy?: string;
}

/**
 * Single-account picker backed by GET /users/search: type part of a username
 * or display name, choose from the matches. Arrow keys move through the list,
 * Enter picks, Escape closes.
 */
export default function UserPicker({
  value,
  onChange,
  excludeIds = [],
  placeholder = 'Имя пользователя или ник…',
  disabled = false,
  ariaLabelledBy,
}: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const seqRef = useRef(0);

  const q = query.trim().replace(/^@/, '');
  const searchable = q.length >= MIN_QUERY;

  useEffect(() => {
    const seq = ++seqRef.current;
    if (!searchable) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = window.setTimeout(async () => {
      try {
        const d = await api<{ items: UserSearchHit[] }>('/users/search', { params: { q } });
        if (seq === seqRef.current) setResults(Array.isArray(d.items) ? d.items : []);
      } catch {
        if (seq === seqRef.current) setResults([]);
      } finally {
        if (seq === seqRef.current) setLoading(false);
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [q, searchable]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const matches = results.filter((u) => !excludeIds.includes(u.id));
  useEffect(() => setActive(0), [results]);

  const dropdownShown = open && searchable && !value;
  const dropdownMounted = useAnimatedPresence(dropdownShown, 140);

  const pick = (u: UserSearchHit) => {
    onChange(u);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className={base.wrap} ref={wrapRef}>
      <div
        className={`${base.bar} ${disabled ? styles.disabled : ''}`}
        onClick={() => !disabled && inputRef.current?.focus()}
      >
        {value ? (
          <span className={`${base.chip} ${styles.chip}`}>
            <UserAvatar user={value} size={20} />
            <span className={styles.chipName}>{value.display_name || value.username}</span>
            <span className={styles.chipHandle}>@{value.username}</span>
            {!disabled ? (
              <button
                type="button"
                className={base.chipRemove}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(null);
                  window.setTimeout(() => inputRef.current?.focus(), 0);
                }}
                aria-label="Выбрать другого пользователя"
              >
                <X size={12} />
              </button>
            ) : null}
          </span>
        ) : (
          <input
            ref={inputRef}
            className={base.input}
            type="text"
            value={query}
            placeholder={placeholder}
            disabled={disabled}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, Math.max(0, matches.length - 1)));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                if (matches[active]) pick(matches[active]);
              } else if (e.key === 'Escape') {
                setOpen(false);
              }
            }}
            autoComplete="off"
            role="combobox"
            aria-expanded={dropdownShown}
            aria-autocomplete="list"
            aria-labelledby={ariaLabelledBy}
          />
        )}
      </div>

      {dropdownMounted ? (
        <div className={`${base.dropdown} ${dropdownShown ? '' : base.dropdownOut}`} role="listbox">
          {matches.map((u, i) => (
            <button
              key={u.id}
              type="button"
              role="option"
              aria-selected={i === active}
              className={`${base.option} ${i === active ? styles.optionActive : ''}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(u)}
            >
              <span className={base.optionMain}>
                <UserAvatar user={u} size={26} />
                <span className={styles.names}>
                  <span className={styles.name}>{u.display_name || u.username}</span>
                  <span className={styles.handle}>@{u.username}</span>
                </span>
              </span>
            </button>
          ))}
          {matches.length === 0 ? (
            <div className={styles.status}>
              {loading ? (
                <>
                  <Loader2 size={14} className={styles.spin} />
                  Ищем…
                </>
              ) : (
                'Никого не нашли'
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
