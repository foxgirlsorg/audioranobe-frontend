'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ShieldOff,
  LayoutDashboard,
  Inbox,
  Flag,
  Users,
  Mic,
  BookMarked,
  Feather,
  Shield,
  Filter,
  Lock,
  Trash2,
  Megaphone,
  Radio,
  ScrollText,
  BookHeadphones,
  ListChecks,
  ChevronsLeft,
  ChevronsRight,
  type LucideIcon,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useModSidebar } from '@/lib/modSidebar';
import { useModCollapse } from './modSidebarCollapse';
import Spinner from '@/components/Spinner/Spinner';
import styles from './modnav.module.css';

type CountKey = 'pending_requests' | 'open_reports' | 'jobs_error';
type Tab = { href: string; label: string; icon: LucideIcon; adminOnly?: boolean; countKey?: CountKey };
type Group = { label: string; tabs: Tab[] };

const GROUPS: Group[] = [
  {
    label: 'Главное',
    tabs: [{ href: '/mod', label: 'Обзор', icon: LayoutDashboard }],
  },
  {
    label: 'Модерация',
    tabs: [
      { href: '/mod/queue', label: 'Очередь', icon: Inbox, countKey: 'pending_requests' },
      { href: '/mod/reports', label: 'Жалобы', icon: Flag, countKey: 'open_reports' },
      { href: '/mod/words', label: 'Стоп-слова', icon: Filter, adminOnly: true },
      { href: '/mod/usernames', label: 'Имена', icon: Lock, adminOnly: true },
      { href: '/mod/trash', label: 'Корзина', icon: Trash2, adminOnly: true },
    ],
  },
  {
    label: 'Люди и контент',
    tabs: [
      { href: '/mod/users', label: 'Пользователи', icon: Users },
      { href: '/mod/narrators', label: 'Чтецы', icon: Mic },
      { href: '/mod/authors', label: 'Авторы', icon: Feather },
      { href: '/mod/genres', label: 'Теги', icon: BookMarked, adminOnly: true },
      { href: '/mod/dmca', label: 'DMCA', icon: Shield, adminOnly: true },
    ],
  },
  {
    label: 'Система',
    tabs: [
      { href: '/mod/narration', label: 'Озвучка', icon: BookHeadphones, adminOnly: true },
      { href: '/mod/tasks', label: 'Задачи', icon: ListChecks, countKey: 'jobs_error' },
      { href: '/mod/broadcast', label: 'Рассылка', icon: Radio },
      { href: '/mod/announcements', label: 'Объявления', icon: Megaphone, adminOnly: true },
      { href: '/mod/audit', label: 'Аудит', icon: ScrollText, adminOnly: true },
    ],
  },
];

export function splitHeading(heading: string): { title: string; accent?: string } {
  const i = heading.indexOf(' ');
  if (i < 0) return { title: heading };
  return { title: heading.slice(0, i), accent: heading.slice(i + 1) };
}

function isActive(pathname: string | null, href: string): boolean {
  return href === '/mod' ? pathname === '/mod' : (pathname ?? '').startsWith(href);
}

/** Counts are best-effort — a fetch error just leaves badges off, nothing blocks the nav. */
function useModCounts(): Partial<Record<CountKey, number>> {
  const [counts, setCounts] = useState<Partial<Record<CountKey, number>>>({});
  useEffect(() => {
    let alive = true;
    api<{ pending_requests: number; open_reports: number; jobs_error: number }>('/mod/dashboard')
      .then((d) => {
        if (alive)
          setCounts({
            pending_requests: d.pending_requests,
            open_reports: d.open_reports,
            jobs_error: d.jobs_error,
          });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return counts;
}

function NavGroups({
  pathname,
  isAdmin,
  counts,
  collapsed,
  onNavigate,
}: {
  pathname: string | null;
  isAdmin: boolean;
  counts: Partial<Record<CountKey, number>>;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <>
      {GROUPS.map((group, gi) => {
        const tabs = group.tabs.filter((t) => !t.adminOnly || isAdmin);
        if (tabs.length === 0) return null;
        return (
          <div key={group.label} className={styles.group}>
            {collapsed ? (
              gi > 0 && <div className={styles.groupHair} />
            ) : (
              <div className={styles.groupLabel}>{group.label}</div>
            )}
            {tabs.map((tab) => {
              const active = isActive(pathname, tab.href);
              const Icon = tab.icon;
              const count = tab.countKey ? counts[tab.countKey] : undefined;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`${styles.item} ${active ? styles.active : ''} ${collapsed ? styles.itemCollapsed : ''}`}
                  aria-current={active ? 'page' : undefined}
                  onClick={onNavigate}
                  title={collapsed ? tab.label : undefined}
                >
                  <span className={styles.itemIconWrap}>
                    <Icon size={15} aria-hidden="true" className={styles.itemIcon} />
                    {collapsed && !!count && <span className={styles.itemDot} aria-hidden="true" />}
                  </span>
                  {!collapsed && (
                    <>
                      <span className={styles.itemLabel}>{tab.label}</span>
                      {!!count && <span className={styles.itemBadge}>{count > 99 ? '99+' : count}</span>}
                      {tab.adminOnly && <span className={styles.tagAdmin}>admin</span>}
                    </>
                  )}
                </Link>
              );
            })}
          </div>
        );
      })}
    </>
  );
}

export function ModNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { open, setOpen } = useModSidebar();
  const { collapsed, setCollapsed } = useModCollapse();
  const counts = useModCounts();

  const [mounted, setMounted] = useState(false);
  const drawerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, setOpen]);

  return (
    <>
      <nav
        aria-label="Разделы модерации"
        className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''}`}
      >
        <NavGroups pathname={pathname} isAdmin={isAdmin} counts={counts} collapsed={collapsed} />
        <button
          type="button"
          className={styles.collapseBtn}
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
          title={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
        >
          {collapsed ? <ChevronsRight size={15} /> : <ChevronsLeft size={15} />}
        </button>
      </nav>

      {mounted &&
        createPortal(
          <>
            <div
              className={`${styles.drawerBackdrop} ${open ? styles.drawerBackdropOpen : ''}`}
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
            <div
              className={`${styles.drawer} ${open ? styles.drawerOpen : ''}`}
              ref={drawerRef}
              role="dialog"
              aria-modal="true"
              aria-label="Разделы модерации"
            >
              <NavGroups
                pathname={pathname}
                isAdmin={isAdmin}
                counts={counts}
                onNavigate={() => setOpen(false)}
              />
            </div>
          </>,
          document.body
        )}
    </>
  );
}

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

  // The mod panel uses the full viewport width instead of the site's
  // centered .container — see body.mod-fullscreen in globals.css.
  useEffect(() => {
    document.body.classList.add('mod-fullscreen');
    return () => document.body.classList.remove('mod-fullscreen');
  }, []);

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
      <ModNav />
      <div className={styles.contentCol}>
        <header className={styles.head}>
          <span className="eyebrow">{'Модерация'}</span>
          <h1 className={styles.title}>
            {title}
            {accent ? <span className={styles.titleAccent}> {accent}</span> : null}
          </h1>
        </header>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}

export default ModNav;
