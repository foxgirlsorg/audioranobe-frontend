'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { errMsg } from '@/lib/toast';
import type { DashboardStats } from '@/lib/types';
import Spinner from '@/components/Spinner';
import { ModShell, ErrorPanel, splitHeading } from '@/app/mod/modnav';
import styles from './page.module.css';

const TILES: {
  key: keyof DashboardStats;
  label: string;
  href?: string;
  accent?: boolean;
}[] = [
  { key: 'pending_requests', label: 'Заявки на модерации', href: '/mod/queue', accent: true },
  { key: 'open_reports', label: 'Открытые жалобы', href: '/mod/reports', accent: true },
  { key: 'jobs_error', label: 'Задачи с ошибкой', accent: true },
  { key: 'users', label: 'Пользователи', href: '/mod/users' },
  { key: 'new_users_7d', label: 'Новые за 7 дней', href: '/mod/users' },
  { key: 'titles_total', label: 'Тайтлы', href: '/catalog' },
  { key: 'titles_pending', label: 'Тайтлы на модерации', href: '/mod/queue?type=title' },
  { key: 'chapters_total', label: 'Главы' },
  { key: 'narrators_total', label: 'Чтецы' },
  { key: 'comments_total', label: 'Комментарии' },
  { key: 'collections_total', label: 'Коллекции', href: '/collections' },
  { key: 'listens_total', label: 'Прослушивания' },
  { key: 'jobs_queued', label: 'Задачи в очереди' },
  { key: 'jobs_processing', label: 'Задачи в обработке' },
];

function DashboardContent() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    setError('');
    api<DashboardStats>('/mod/dashboard')
      .then((d) => {
        if (alive) setStats(d);
      })
      .catch((e) => {
        if (alive) setError(errMsg(e));
      });
    return () => {
      alive = false;
    };
  }, [reload]);

  if (error) {
    return (
      <ErrorPanel
        message={error}
        onRetry={() => {
          setStats(null);
          setReload((n) => n + 1);
        }}
      />
    );
  }

  if (!stats) {
    return (
      <div className={styles.loading}>
        <Spinner />
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      {TILES.map((tile) => {
        const inner = (
          <>
            <span className={styles.label}>{tile.label}</span>
            <span className={styles.value}>{stats[tile.key].toLocaleString('en-US')}</span>
          </>
        );
        const cls = `glass-panel ${styles.tile}${tile.accent ? ` ${styles.accentTile}` : ''}`;
        return tile.href ? (
          <Link key={tile.key} href={tile.href} className={`${cls} ${styles.tileLink}`}>
            {inner}
          </Link>
        ) : (
          <div key={tile.key} className={cls}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}

export default function ModDashboardPage() {
  const h = splitHeading('Центр управления');
  return (
    <ModShell title={h.title} accent={h.accent}>
      <DashboardContent />
    </ModShell>
  );
}
