'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MailWarning } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import styles from './UnverifiedEmailBanner.module.css';

export default function UnverifiedEmailBanner() {
  const { user } = useAuth();
  const [mailEnabled, setMailEnabled] = useState(false);

  useEffect(() => {
    let alive = true;
    api<{ email_verification: boolean }>('/config')
      .then((c) => {
        if (alive) setMailEnabled(!!c.email_verification);
      })
      .catch(() => {
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!user || user.email_verified || user.is_banned || !mailEnabled) return null;

  return (
    <div className={styles.banner} role="status">
      <MailWarning size={16} className={styles.icon} />
      <span className={styles.text}>
        Почта не подтверждена — восстановить пароль по ней не получится.{' '}
        <Link href="/me/settings" className={styles.link}>
          Подтвердить
        </Link>
      </span>
    </div>
  );
}
