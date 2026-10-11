'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './page.module.css';

const TABS = [
  { href: '/dev', label: 'API' },
  { href: '/dev/widgets', label: 'Виджеты' },
];

export default function DevTabs() {
  const path = usePathname();
  return (
    <nav className={styles.tabs} aria-label={'Разделы'}>
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={path === t.href ? `${styles.tab} ${styles.tabActive}` : styles.tab}
          aria-current={path === t.href ? 'page' : undefined}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
