'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ShieldOff } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import Spinner from '@/components/Spinner';
import styles from './modnav.module.css';

const TABS: { href: string; label: string; adminOnly?: boolean }[] = [
  { href: '/mod', label: 'Обзор' },
  { href: '/mod/queue', label: 'Очередь' },
  { href: '/mod/reports', label: 'Жалобы' },
  { href: '/mod/users', label: 'Пользователи' },
  { href: '/mod/genres', label: 'Жанры', adminOnly: true },
  { href: '/mod/authors', label: 'Авторы', adminOnly: true },
  { href: '/mod/dmca', label: 'DMCA', adminOnly: true },
  { href: '/mod/words', label: 'Стоп-слова', adminOnly: true },
  { href: '/mod/trash', label: 'Корзина' },
  { href: '/mod/announcements', label: 'Объявления', adminOnly: true },
  { href: '/mod/broadcast', label: 'Рассылка' },
  { href: '/mod/audit', label: 'Аудит', adminOnly: true },
];

/**
 * Splits a translated two-tone heading into the white part (first word) and
 * the accented part (the rest), matching the ModShell title/accent props.
 * Headings are translated as whole phrases so each locale can pick natural
 * word order; in English this reproduces the original title/accent split.
 */
export function splitHeading(heading: string): { title: string; accent?: string } {
  const i = heading.indexOf(' ');
  if (i < 0) return { title: heading };
  return { title: heading.slice(0, i), accent: heading.slice(i + 1) };
}

/** Section tabs shared by every /mod page. Audit is only visible to admins. */
export function ModNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
    <nav className={styles.nav} aria-label={'Разделы модерации'}>
      {TABS.filter((tab) => !tab.adminOnly || isAdmin).map((tab) => {
        const active =
          tab.href === '/mod' ? pathname === '/mod' : (pathname ?? '').startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={active ? `${styles.tab} ${styles.active}` : styles.tab}
            aria-current={active ? 'page' : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Small reusable error panel with an optional retry action. */
export function ErrorPanel({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className={`glass-panel ${styles.errorPanel}`}>
      <p className={styles.errorText}>{message}</p>
      {onRetry ? (
        <button type="button" className="btn" onClick={onRetry}>
          {'Попробовать ещё раз'}
        </button>
      ) : null}
    </div>
  );
}

/**
 * Guard + chrome for every moderation page: waits for auth, redirects guests
 * to /auth/login, shows a styled 403 for non-staff (or non-admins when
 * adminOnly), then renders the page heading, the section tabs and children.
 * Children are only mounted once the guard passes, so pages can fetch freely.
 */
export function ModShell({
  title,
  accent,
  adminOnly = false,
  children,
}: {
  title: string;
  accent?: string;
  adminOnly?: boolean;
  children: React.ReactNode;
}) {
  const { user, loading, isMod } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login');
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className={styles.loading}>
        <Spinner />
      </div>
    );
  }

  if (!isMod || (adminOnly && user.role !== 'admin')) {
    const modButNotAdmin = isMod && adminOnly;
    return (
      <div className={`glass-panel ${styles.forbidden}`}>
        <span className={styles.forbiddenGlow} aria-hidden="true" />
        <ShieldOff size={30} className={styles.forbiddenIcon} aria-hidden="true" />
        <div className={styles.forbiddenCode}>403</div>
        <span className="eyebrow">{'Доступ ограничен'}</span>
        <p className={styles.forbiddenBody}>
          {modButNotAdmin
            ? 'Этот раздел доступен только администраторам.'
            : 'Раздел модерации доступен только команде AudioRanobe.'}
        </p>
        <Link href={modButNotAdmin ? '/mod' : '/'} className="btn btn-primary">
          {modButNotAdmin ? 'Назад к обзору' : 'На главную'}
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      <header className={styles.head}>
        <span className="eyebrow">{'Модерация'}</span>
        <h1 className={styles.title}>
          {title}
          {accent ? <span className={styles.titleAccent}> {accent}</span> : null}
        </h1>
      </header>
      <ModNav />
      <div className={styles.content}>{children}</div>
    </div>
  );
}

export default ModNav;
