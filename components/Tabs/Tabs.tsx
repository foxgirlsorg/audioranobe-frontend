'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from './Tabs.module.css';

interface Tab {
  key: string;
  label: string;
  count?: number;
  // Tint the tab (and its count) with the accent colour even when it is not the
  // active tab — used to flag a tab that needs attention, e.g. pending requests.
  accent?: boolean;
}

type Variant = 'pill' | 'underline' | 'segmented';

const VARIANT_CLASS: Record<Variant, string> = {
  pill: styles.pill,
  underline: styles.underline,
  segmented: styles.segmented,
};

function wrapClass(variant: Variant | undefined): string {
  return variant ? `${styles.tabs} ${VARIANT_CLASS[variant]}` : styles.tabs;
}

function tabClass(t: Tab, active: string): string {
  return [
    styles.tab,
    t.key === active ? styles.active : '',
    t.accent ? styles.alert : '',
  ]
    .filter(Boolean)
    .join(' ');
}

function TabsBase({
  tabs,
  active,
  onChange,
  variant,
}: {
  tabs: Tab[];
  active: string;
  onChange: (key: string) => void;
  variant?: Variant;
}) {
  return (
    <div className={wrapClass(variant)} role="tablist">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={t.key === active}
          className={tabClass(t, active)}
          onClick={() => onChange(t.key)}
        >
          {t.label}
          {t.count != null ? <span className={styles.count}>{t.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

function TabsWithUrl({
  tabs,
  active,
  onChange,
  urlParam,
  variant,
}: {
  tabs: Tab[];
  active: string;
  onChange: (key: string) => void;
  urlParam: string;
  variant?: Variant;
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
    <div className={wrapClass(variant)} role="tablist">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={t.key === active}
          className={tabClass(t, active)}
          onClick={() => handleClick(t.key)}
        >
          {t.label}
          {t.count != null ? <span className={styles.count}>{t.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Tabs(props: {
  tabs: Tab[];
  active: string;
  onChange: (key: string) => void;
  urlParam?: string;
  variant?: Variant;
}) {
  if (props.urlParam) {
    return (
      <React.Suspense fallback={<div className={styles.tabs} />}>
        <TabsWithUrl {...props} urlParam={props.urlParam} />
      </React.Suspense>
    );
  }
  return (
    <TabsBase tabs={props.tabs} active={props.active} onChange={props.onChange} variant={props.variant} />
  );
}

export default Tabs;
