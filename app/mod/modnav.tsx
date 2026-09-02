'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ShieldOff, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useModSidebar } from '@/lib/modSidebar';
import { useModCollapse } from './modSidebarCollapse';
import { GROUPS, type CountKey } from './navGroups';
import Spinner from '@/components/Spinner/Spinner';
import styles from './modnav.module.css';

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
    api<{
      pending_requests: number;
      open_reports: number;
      jobs_error: number;
      review_queue: number;
      comments_unchecked: number;
    }>('/mod/dashboard')
      .then((d) => {
        if (alive)
          setCounts({
            pending_requests: d.pending_requests,
            open_reports: d.open_reports,
            jobs_error: d.jobs_error,
            review_queue: d.review_queue,
            comments_unchecked: d.comments_unchecked,
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
  can,
  counts,
  collapsed,
  onNavigate,
}: {
  pathname: string | null;
  can: (perm: string) => boolean;
  counts: Partial<Record<CountKey, number>>;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <>
      {GROUPS.map((group, gi) => {
        const tabs = group.tabs.filter(
          (t) => (!t.perm || can(t.perm)) && (!t.anyPerm || t.anyPerm.some(can))
        );
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
  const { can } = useAuth();
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
        <NavGroups pathname={pathname} can={can} counts={counts} collapsed={collapsed} />
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
                can={can}
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
  perm,
  anyPerm,
  children,
}: {
  title: string;
  accent?: string;
  /** Permission required for this page beyond panel access. */
  perm?: string;
  /** Access granted if the user holds ANY of these permissions. */
  anyPerm?: string[];
  children: React.ReactNode;
}) {
  const { user, loading, isMod, can } = useAuth();
  const { collapsed } = useModCollapse();
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

  const permOk = (!perm || can(perm)) && (!anyPerm || anyPerm.some(can));
  if (!isMod || !permOk) {
    const modButNotAllowed = isMod && !permOk;
    return (
      <div className={`glass-panel ${styles.forbidden}`}>
        <span className={styles.forbiddenGlow} aria-hidden="true" />
        <ShieldOff size={30} className={styles.forbiddenIcon} aria-hidden="true" />
        <div className={styles.forbiddenCode}>403</div>
        <span className="eyebrow">{'Доступ ограничен'}</span>
        <p className={styles.forbiddenBody}>
          {modButNotAllowed
            ? 'У вас нет прав для этого раздела.'
            : 'Раздел модерации доступен только команде AudioRanobe.'}
        </p>
        <Link href={modButNotAllowed ? '/mod' : '/'} className="btn btn-primary">
          {modButNotAllowed ? 'Назад к обзору' : 'На главную'}
        </Link>
      </div>
    );
  }

  return (
    <div className={`${styles.shell} ${collapsed ? styles.shellCollapsed : ''}`}>
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
