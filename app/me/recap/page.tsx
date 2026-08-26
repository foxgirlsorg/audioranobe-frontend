'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Download, Headphones, Share2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errMsg, useToast } from '@/lib/toast';
import { usePageTitle } from '@/lib/usePageTitle';
import { downloadNodePng } from '@/lib/exportImage';
import type { Recap } from '@/lib/types';
import Spinner from '@/components/Spinner/Spinner';
import EmptyState from '@/components/EmptyState/EmptyState';
import RecapMonthlyCard from '@/components/RecapMonthlyCard/RecapMonthlyCard';
import styles from './page.module.css';

export default function RecapPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [recap, setRecap] = useState<Recap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);

  usePageTitle('Итоги месяца');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const demo = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('demo');
      setRecap(await api<Recap>(demo ? '/me/recap?demo=1' : '/me/recap'));
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    void load();
  }, [user, authLoading, load]);

  const exportPng = async () => {
    if (!cardRef.current || !recap) return;
    setExporting(true);
    try {
      await downloadNodePng(cardRef.current, `recap-${recap.period_label}`);
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setExporting(false);
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/me/recap`);
      toast('Ссылка скопирована', 'ok');
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  if (!authLoading && !user) {
    return (
      <div className={styles.wrap}>
        <EmptyState icon={Headphones} title={'Войдите в аккаунт'} body={'Итоги доступны только авторизованным слушателям.'} />
        <Link href="/auth/login" className="btn btn-primary">{'Войти'}</Link>
      </div>
    );
  }

  const empty = recap && recap.total_seconds <= 0;

  return (
    <div className={styles.wrap}>
      {loading || authLoading ? (
        <div className={styles.center}><Spinner size={34} /></div>
      ) : error ? (
        <div className={styles.center}>
          <EmptyState icon={Headphones} title={'Не удалось загрузить'} body={error} />
        </div>
      ) : empty || !recap ? (
        <div className={styles.center}>
          <EmptyState
            icon={Headphones}
            title={'Пока пусто'}
            body={'За прошлый месяц вы ещё не дослушали ни одной главы на сайте.'}
          />
        </div>
      ) : (
        <>
          <RecapMonthlyCard recap={recap} ref={cardRef} />
          <div className={styles.actions}>
            <button type="button" className="btn btn-primary" onClick={exportPng} disabled={exporting}>
              <Download size={15} /> {exporting ? 'Готовим…' : 'Скачать картинку'}
            </button>
            <button type="button" className="btn" onClick={() => void share()}>
              <Share2 size={15} /> {'Поделиться'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
