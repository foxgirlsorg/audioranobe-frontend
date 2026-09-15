'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, LibraryBig, Bell, MessageCircle, Menu, Music, RotateCcw, RotateCw } from 'lucide-react';
import { usePlayer } from '@/lib/player';
import { useBadges } from '@/lib/badges';
import { useAuth } from '@/lib/auth';
import { chapterNumberLabel } from '@/lib/format';
import PlayPauseIcon from '@/components/PlayPauseIcon/PlayPauseIcon';
import { isStandalone } from '@/lib/pwa';
import styles from './Dock.module.css';

const TABS = [
  { key: 'home', href: '/', label: 'Главная', icon: Home, match: (p: string) => p === '/' },
  { key: 'catalog', href: '/catalog', label: 'Каталог', icon: LibraryBig, match: (p: string) => p.startsWith('/catalog') },
  { key: 'notifications', href: '/me/notifications', label: 'Уведомления', icon: Bell, match: (p: string) => p.startsWith('/me/notifications') },
  { key: 'messages', href: '/me/chat', label: 'Сообщения', icon: MessageCircle, match: (p: string) => p.startsWith('/me/chat') },
] as const;

export default function Dock() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(isStandalone());
  }, []);

  const { user } = useAuth();
  const pathname = usePathname();
  const { messages: msgCount, notifications: notifCount } = useBadges();
  const { current, playing, toggle, skip, setFull } = usePlayer();

  useEffect(() => {
    document.body.classList.toggle('pwa-player', on && !!current);
    return () => document.body.classList.remove('pwa-player');
  }, [on, current]);

  if (!on) return null;

  const activeIndex = TABS.findIndex((t) => t.match(pathname));
  const cover = current ? current.volume.cover_url ?? current.title.cover_url : null;
  const chapterLabel = current
    ? `Гл. ${chapterNumberLabel(current.number, current.number_end)}${current.name ? ` — ${current.name}` : ''}`
    : '';
  const badgeFor = (key: string) => (key === 'messages' ? msgCount : key === 'notifications' ? notifCount : 0);

  return (
    <nav className={`app-dock ${styles.dock}`} aria-label="Навигация">
      {current ? (
        <div className={styles.player}>
          <button
            type="button"
            className={styles.tap}
            onClick={() => setFull(true)}
            aria-label="Открыть плеер"
          >
            <span className={styles.cover}>
              {cover ? <img src={cover} alt="" /> : <Music aria-hidden="true" />}
            </span>
            <span className={styles.meta}>
              <span className={styles.title}>{current.title.name}</span>
              <span className={styles.chapter}>{chapterLabel}</span>
            </span>
          </button>
          <div className={styles.pctl}>
            <button type="button" className={styles.seek} onClick={() => skip(-10)} aria-label="Назад на 10 секунд">
              <RotateCcw />
            </button>
            <button type="button" className={styles.play} onClick={toggle} aria-label={playing ? 'Пауза' : 'Воспроизвести'}>
              <PlayPauseIcon playing={playing} playClassName={styles.playIcon} />
            </button>
            <button type="button" className={styles.seek} onClick={() => skip(10)} aria-label="Вперёд на 10 секунд">
              <RotateCw />
            </button>
          </div>
        </div>
      ) : null}

      <div className={styles.tabs}>
        {activeIndex >= 0 ? (
          <span className={styles.indicator} style={{ transform: `translateX(${activeIndex * 100}%)` }}>
            <span />
          </span>
        ) : null}
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = t.match(pathname);
          const count = badgeFor(t.key);
          return (
            <Link
              key={t.key}
              href={t.href}
              className={active ? `${styles.tab} ${styles.tabOn}` : styles.tab}
              aria-label={t.label}
              aria-current={active ? 'page' : undefined}
            >
              {count > 0 ? <span className={styles.badge}>{count > 99 ? '99+' : count}</span> : null}
              <Icon aria-hidden="true" />
            </Link>
          );
        })}
        <button
          type="button"
          className={styles.tab}
          onClick={() => window.dispatchEvent(new Event('pwa-open-menu'))}
          aria-label={user ? 'Профиль' : 'Меню'}
        >
          {user ? (
            <span className={styles.pfp}>
              {user.avatar_thumb_url || user.avatar_url ? (
                <img src={user.avatar_thumb_url ?? user.avatar_url ?? ''} alt="" />
              ) : (
                (user.username?.charAt(0) || '?').toUpperCase()
              )}
            </span>
          ) : (
            <Menu aria-hidden="true" />
          )}
        </button>
      </div>
    </nav>
  );
}
