'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Headphones } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errMsg } from '@/lib/toast';
import { usePageTitle } from '@/lib/usePageTitle';
import type { Recap } from '@/lib/types';
import Spinner from '@/components/Spinner/Spinner';
import EmptyState from '@/components/EmptyState/EmptyState';
import RecapCard from '@/components/RecapCard/RecapCard';
import RecapDeck from '@/components/RecapDeck/RecapDeck';
import { fillTemplate } from '@/lib/recapTemplate';
import styles from '../page.module.css';

export default function YearRecapPage({ params }: { params: { year: string } }) {
  const year = params.year;
  const { user, loading: authLoading } = useAuth();
  const [recap, setRecap] = useState<Recap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportKey, setExportKey] = useState(0);

  usePageTitle(`Итоги ${year}`);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const demo = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('demo');
      setRecap(await api<Recap>(`/me/recap/${encodeURIComponent(year)}${demo ? '?demo=1' : ''}`));
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    if (authLoading || !user) return;
    void load();
  }, [user, authLoading, load]);

  const refreshForExport = useCallback(async (): Promise<Recap | null> => {
    try {
      const demo = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('demo');
      const fresh = await api<Recap>(`/me/recap/${encodeURIComponent(year)}${demo ? '?demo=1' : ''}`);
      setRecap(fresh);
      // Force the finale card to fully remount from this fresh data: a plain
      // re-render skips writing unchanged text back to the DOM, so a
      // devtools edit to the rendered numbers would otherwise survive into
      // the exported image.
      setExportKey((k) => k + 1);
      return fresh;
    } catch {
      return null;
    }
  }, [year]);

  if (!authLoading && !user) {
    return (
      <div className={styles.wrap}>
        <EmptyState icon={Headphones} title={'Войдите в аккаунт'} body={'Итоги доступны только авторизованным слушателям.'} />
        <Link href="/auth/login" className="btn btn-primary">{'Войти'}</Link>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      {loading || authLoading ? (
        <div className={styles.center}><Spinner size={34} /></div>
      ) : error || !recap ? (
        <div className={styles.center}>
          <EmptyState icon={Headphones} title={`Итоги ${year}`} body={error ?? 'Итоги за этот год ещё не готовы.'} />
        </div>
      ) : (
        <RecapDeck
          recap={recap}
          onBeforeDownload={refreshForExport}
          finale={
            recap.design ? (
              <RecapCard key={exportKey} html={fillTemplate(recap.design.html, recap)} css={recap.design.css} />
            ) : undefined
          }
        />
      )}
    </div>
  );
}
