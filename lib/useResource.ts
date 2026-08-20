'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { errMsg } from '@/lib/toast';

/**
 * A single-fetch resource (as opposed to useInfiniteList's paginated one):
 * load-on-mount, race-safe refetch on dep change, and a manual reload().
 */
export function useResource<T>(fetcher: () => Promise<T>, deps: React.DependencyList) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const run = useRef(0);

  useEffect(() => {
    const id = ++run.current;
    setLoading(true);
    setError(null);
    fetcher()
      .then((d) => {
        if (id === run.current) setData(d);
      })
      .catch((e) => {
        if (id === run.current) {
          setData(null);
          setError(errMsg(e));
        }
      })
      .finally(() => {
        if (id === run.current) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { data, loading, error, reload };
}
