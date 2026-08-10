'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { MailWarning } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useConfig } from '@/lib/config';
import styles from './UnverifiedEmailBanner.module.css';

export default function UnverifiedEmailBanner() {
  const { user } = useAuth();
  const mailEnabled = useConfig()?.email_verification ?? false;
  const ref = useRef<HTMLDivElement | null>(null);

  const shown = !!user && !user.email_verified && !user.is_banned && mailEnabled;

  // The banner is fixed under the nav bar, so the page has to be told how far
  // down to start. Measured rather than assumed: the text wraps to two lines on
  // a phone.
  useEffect(() => {
    const el = ref.current;
    if (!shown || !el) {
      document.body.classList.remove('has-notice');
      document.documentElement.style.removeProperty('--notice-height');
      return;
    }
    document.body.classList.add('has-notice');
    const measure = () =>
      document.documentElement.style.setProperty('--notice-height', `${el.offsetHeight}px`);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.body.classList.remove('has-notice');
      document.documentElement.style.removeProperty('--notice-height');
    };
  }, [shown]);

  if (!shown) return null;

  return (
    <div className={styles.banner} role="status" ref={ref}>
      <MailWarning size={16} className={styles.icon} />
      <span className={styles.text}>
        Почта не подтверждена — вы не сможете восстановить пароль в случае его потери.{' '}
        <Link href="/me/settings" className={styles.link}>
          Подтвердить
        </Link>
      </span>
    </div>
  );
}
