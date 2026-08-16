'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
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

function tabClass(t: Tab, active: string): string {
  return [
    styles.tab,
    t.key === active ? styles.active : '',
    t.accent ? styles.alert : '',
  ]
    .filter(Boolean)
    .join(' ');
}

// Tracks whether the tab strip has hidden content past either edge, so a
// `scrollable` bar can fade its overflow the same way the horizontal rails
// on the home page do (see TabScroller).
function useScrollEdges(enabled: boolean | undefined, tabs: Tab[]) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEdges({ start: el.scrollLeft > 1, end: el.scrollLeft < max - 1 });
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    return () => {
      el.removeEventListener('scroll', measure);
      ro.disconnect();
    };
  }, [enabled, measure, tabs]);

  return { ref, edges };
}

function TabsRender({
  tabs,
  active,
  onChange,
  variant,
  scrollable,
}: {
  tabs: Tab[];
  active: string;
  onChange: (key: string) => void;
  variant?: Variant;
  scrollable?: boolean;
}) {
  const { ref, edges } = useScrollEdges(scrollable, tabs);

  const wrapCls = [
    styles.tabs,
    variant ? VARIANT_CLASS[variant] : '',
    scrollable ? styles.scrollFade : '',
    scrollable && edges.start ? styles.fadeStart : '',
    scrollable && edges.end ? styles.fadeEnd : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={wrapCls} role="tablist" ref={ref}>
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
  scrollable,
}: {
  tabs: Tab[];
  active: string;
  onChange: (key: string) => void;
  urlParam: string;
  variant?: Variant;
  scrollable?: boolean;
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

  return <TabsRender tabs={tabs} active={active} onChange={handleClick} variant={variant} scrollable={scrollable} />;
}

export function Tabs(props: {
  tabs: Tab[];
  active: string;
  onChange: (key: string) => void;
  urlParam?: string;
  variant?: Variant;
  // Fades the strip's overflowing edges (like the home page's rails) instead
  // of letting tabs run off silently. Use when the tab list can outgrow its
  // container, e.g. on narrow viewports.
  scrollable?: boolean;
}) {
  if (props.urlParam) {
    return (
      <React.Suspense fallback={<div className={styles.tabs} />}>
        <TabsWithUrl {...props} urlParam={props.urlParam} />
      </React.Suspense>
    );
  }
  return <TabsRender {...props} />;
}

export default Tabs;
