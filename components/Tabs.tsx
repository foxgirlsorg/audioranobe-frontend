'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from './Tabs.module.css';

interface Tab {
  key: string;
  label: string;
  count?: number;
}

/** Pure controlled tabs — no URL dependency. */
function TabsBase({
  tabs,
  active,
  onChange,
}: {
  tabs: Tab[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className={styles.tabs} role="tablist">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={t.key === active}
          className={t.key === active ? `${styles.tab} ${styles.active}` : styles.tab}
          onClick={() => onChange(t.key)}
        >
          {t.label}
          {t.count != null ? <span className={styles.count}>{t.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

/**
 * Tabs with URL-sync: reads/sets a query parameter to keep tab state in the URL.
 * The useSearchParams() call is isolated here so that only pages using urlParam
 * need a Suspense boundary.
 */
function TabsWithUrl({
  tabs,
  active,
  onChange,
  urlParam,
}: {
  tabs: Tab[];
  active: string;
  onChange: (key: string) => void;
  urlParam: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    if (synced) return;
    const fromUrl = searchParams.get(urlParam);
    if (fromUrl && tabs.some((t) => t.key === fromUrl) && fromUrl !== active) {
      onChange(fromUrl);
    }
    setSynced(true);
  }, [urlParam, searchParams, tabs, active, onChange, synced]);

  const handleClick = useCallback(
    (key: string) => {
      onChange(key);
      const params = new URLSearchParams(searchParams.toString());
      params.set(urlParam, key);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [onChange, urlParam, searchParams, router],
  );

  return (
    <div className={styles.tabs} role="tablist">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={t.key === active}
          className={t.key === active ? `${styles.tab} ${styles.active}` : styles.tab}
          onClick={() => handleClick(t.key)}
        >
          {t.label}
          {t.count != null ? <span className={styles.count}>{t.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

/**
 * When urlParam is set, we wrap in a lazy-loaded Suspense boundary because
 * useSearchParams() requires it during static generation.
 */
export function Tabs(props: { tabs: Tab[]; active: string; onChange: (key: string) => void; urlParam?: string }) {
  if (props.urlParam) {
    return (
      <React.Suspense fallback={<div className={styles.tabs} />}>
        <TabsWithUrl {...props} urlParam={props.urlParam} />
      </React.Suspense>
    );
  }
  return <TabsBase tabs={props.tabs} active={props.active} onChange={props.onChange} />;
}

export default Tabs;
