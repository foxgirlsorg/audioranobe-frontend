'use client';

import { useEffect, useState } from 'react';
import { Bell, BellRing } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast, errMsg } from '@/lib/toast';
import styles from './SubscribeButton.module.css';

export function SubscribeButton({
  narratorId,
  subscribed,
  count,
}: {
  narratorId: number;
  subscribed: boolean;
  count: number;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [sub, setSub] = useState(subscribed);
  const [n, setN] = useState(count);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSub(subscribed);
    setN(count);
  }, [subscribed, count]);

  async function toggle() {
    if (!user) {
      toast('Войдите, чтобы подписаться на чтецов', 'error');
      return;
    }
    if (busy) return;
    setBusy(true);
    const next = !sub;
    const prevSub = sub;
    const prevN = n;
    setSub(next);
    setN((v) => Math.max(0, v + (next ? 1 : -1)));
    try {
      const res = await api<{ my_subscription: boolean; subscribers_count: number }>(
        `/narrators/${narratorId}/subscribe`,
        { method: next ? 'PUT' : 'DELETE' }
      );
      setSub(res.my_subscription);
      setN(res.subscribers_count);
    } catch (e) {
      setSub(prevSub);
      setN(prevN);
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={sub ? `${styles.btn} ${styles.active}` : styles.btn}
      onClick={toggle}
      aria-pressed={sub}
      title={sub ? 'Отписаться от новинок' : 'Получать уведомления о новинках'}
    >
      {sub ? (
        <BellRing size={15} className={styles.iconOn} />
      ) : (
        <Bell size={15} className={styles.icon} />
      )}
      <span className={styles.label}>{sub ? 'Вы подписаны' : 'Подписаться'}</span>
      <span className={styles.count}>{n}</span>
    </button>
  );
}

export default SubscribeButton;
