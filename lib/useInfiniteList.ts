'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { errMsg } from '@/lib/toast';
import type { Paginated } from '@/lib/types';

/**
 * A paginated endpoint read as one growing list.
 *
 * `fetchPage` must be a useCallback: its identity is the reset signal, so a
 * changed filter or search term starts the list over rather than appending
 * someone else's rows to it.
 *
 * A failure to load *more* is kept apart from a failure to load the first page:
 * the first is a retry button under rows the reader can still use, the second is
 * an empty screen.
 */
export function useInfiniteList<T>(fetchPage: (page: number) => Promise<Paginated<T>>) {
  const [items, setItems] = useState<T[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [moreError, setMoreError] = useState('');
  const [nonce, setNonce] = useState(0);
  const run = useRef(0);

  useEffect(() => {
    const id = ++run.current;
    setLoading(true);
    setError('');
    setMoreError('');
    fetchPage(1)
      .then((res) => {
        if (id !== run.current) return;
        setItems(res.items);
        setTotal(res.total);
        setPage(res.page ?? 1);
      })
      .catch((e) => {
        if (id !== run.current) return;
        setItems(null);
        setError(errMsg(e));
      })
      .finally(() => {
        if (id === run.current) setLoading(false);
      });
  }, [fetchPage, nonce]);

  const hasMore = items !== null && items.length < total;

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    const id = run.current;
    setLoadingMore(true);
    setMoreError('');
    try {
      const res = await fetchPage(page + 1);
      if (id !== run.current) return;
      setItems((prev) => [...(prev ?? []), ...res.items]);
      setTotal(res.total);
      setPage(res.page ?? page + 1);
    } catch (e) {
      if (id === run.current) setMoreError(errMsg(e));
    } finally {
      if (id === run.current) setLoadingMore(false);
    }
  }, [fetchPage, page, hasMore, loadingMore]);

  /** Replace one row in place, for a list whose rows can be edited. */
  const patch = useCallback((match: (row: T) => boolean, next: (row: T) => T) => {
    setItems((prev) => (prev ? prev.map((r) => (match(r) ? next(r) : r)) : prev));
  }, []);

  /** Drop one row and keep the total honest. */
  const remove = useCallback((match: (row: T) => boolean) => {
    setItems((prev) => {
      if (!prev) return prev;
      const next = prev.filter((r) => !match(r));
      setTotal((t) => Math.max(0, t - (prev.length - next.length)));
      return next;
    });
  }, []);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return {
    items,
    total,
    loading,
    loadingMore,
    error,
    moreError,
    hasMore,
    loadMore,
    reload,
    patch,
    remove,
  };
}
