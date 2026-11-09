'use client';

import { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Award,
  Bell,
  Check,
  CheckCheck,
  ClipboardCheck,
  FileX,
  Headphones,
  Megaphone,
  MessageCircle,
  Mic,
  Newspaper,
  Pencil,
  Reply,
  UserCheck,
  UserPlus,
  XCircle,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { api } from '@/lib/api';
import type { Notification, NotificationType, Paginated } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { useBadges } from '@/lib/badges';
import { useToast, errMsg } from '@/lib/toast';
import { timeAgo } from '@/lib/format';
import Spinner from '@/components/Spinner/Spinner';
import EmptyState from '@/components/EmptyState/EmptyState';
import Pagination from '@/components/Pagination/Pagination';
import styles from './page.module.css';

const TYPE_ICONS: Record<NotificationType, ComponentType<{ size?: number | string }>> = {
  new_chapter: Headphones,
  narrator_release: Mic,
  comment_reply: Reply,
  narrator_comment: MessageCircle,
  mention: MessageCircle,
  system: Megaphone,
  request_reviewed: ClipboardCheck,
  request_approved: ClipboardCheck,
  request_rejected: XCircle,
  entity_modified: Pencil,
  entity_deleted: FileX,
  narrator_post: Newspaper,
  friend_request: UserPlus,
  friend_accept: UserCheck,
  narration_ready: Headphones,
  badge_earned: Award,
};

const TYPE_LABELS: Record<NotificationType, string> = {
  new_chapter: 'Новая глава',
  narrator_release: 'Релиз чтеца',
  comment_reply: 'Ответить',
  narrator_comment: 'Комментарий',
  mention: 'Упоминание',
  system: 'AudioRanobe',
  request_reviewed: 'Заявка рассмотрена',
  request_approved: 'Заявка одобрена',
  request_rejected: 'Заявка отклонена',
  entity_modified: 'Объект изменён',
  entity_deleted: 'Объект удалён',
  narrator_post: 'Запись чтеца',
  friend_request: 'Заявка в друзья',
  friend_accept: 'Заявка принята',
  narration_ready: 'Озвучка готова',
  badge_earned: 'Новый бейдж',
};

function splitHeading(s: string): [string, string] {
  const i = s.indexOf(' ');
  return i === -1 ? [s, ''] : [s.slice(0, i), s.slice(i + 1)];
}

function NotifBody({ text, expanded = false }: { text: string; expanded?: boolean }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [long, setLong] = useState(false);
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el && !open) setLong(el.scrollHeight > el.clientHeight + 1);
  }, [text, open]);

  useLayoutEffect(() => {
    if (expanded) setOpen(true);
  }, [expanded]);

  return (
    <>
      <p ref={ref} className={open ? styles.body : `${styles.body} ${styles.clamped}`}>
        {text}
      </p>
      {long ? (
        <button
          type="button"
          className={styles.expandBtn}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(!open);
          }}
        >
          {open ? 'Свернуть' : 'Показать полностью'}
        </button>
      ) : null}
    </>
  );
}

export default function MyNotificationsPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.center}>
          <Spinner size={34} />
        </div>
      }
    >
      <NotificationsInner />
    </Suspense>
  );
}

function NotificationsInner() {
  const { user, loading: authLoading } = useAuth();
  const focusId = Number(useSearchParams().get('n')) || 0;
  const { notifications: unreadCount } = useBadges();
  const router = useRouter();
  const { toast } = useToast();

  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<Notification> | null>(null);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth/login');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (focusId) setPage(1);
  }, [focusId]);

  useEffect(() => {
    if (!focusId || !data) return;
    document.getElementById(`notif-${focusId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [focusId, data]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const res = await api<Paginated<Notification>>('/me/notifications', {
          params: { page },
        });
        if (alive) setData(res);
      } catch (e) {
        if (alive) {
          toast(errMsg(e), 'error');
          setData({ items: [], page: 1, per_page: 24, total: 0 });
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, page]);

  if (authLoading || !user) {
    return (
      <div className={styles.center}>
        <Spinner size={34} />
      </div>
    );
  }

  function markLocal(id: number) {
    setData((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
          }
        : prev
    );
  }

  function markRead(n: Notification) {
    if (n.is_read) return;
    markLocal(n.id);
    api('/me/notifications/read', { method: 'POST', body: { ids: [n.id] } }).catch(() => {});
  }

  function open(n: Notification) {
    if (!n.is_read) {
      markLocal(n.id);
      api('/me/notifications/read', { method: 'POST', body: { ids: [n.id] } }).catch(() => {});
    }
    if (!n.link) return;
    if (n.link.startsWith('/')) router.push(n.link);
    else window.open(n.link, '_blank', 'noopener');
  }

  async function markAllRead() {
    if (markingAll) return;
    setMarkingAll(true);
    try {
      await api('/me/notifications/read', { method: 'POST', body: {} });
      setData((prev) =>
        prev ? { ...prev, items: prev.items.map((n) => ({ ...n, is_read: true })) } : prev
      );
      toast('Все уведомления отмечены прочитанными', 'ok');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setMarkingAll(false);
    }
  }

  const [headPlain, headAccent] = splitHeading('Мои уведомления');

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className="eyebrow">{'Входящие'}</span>
          <h1 className="section-title">
            {headPlain} <span className="accent">{headAccent}</span>
          </h1>
        </div>
        <button
          type="button"
          className={styles.markAll}
          onClick={markAllRead}
          disabled={markingAll || unreadCount === 0}
          title={'Отметить все уведомления прочитанными'}
        >
          <CheckCheck size={14} />
          {markingAll ? 'Отмечаем…' : 'Прочитать все'}
        </button>
      </header>

      {loading || !data ? (
        <div className={styles.center}>
          <Spinner />
        </div>
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={'Уведомлений нет'}
          body={'Новые главы, ответы и релизы чтецов будут появляться здесь.'}
        />
      ) : (
        <>
          <div className={styles.list}>
            {data.items.map((n) => {
              const Icon = TYPE_ICONS[n.type] ?? Bell;
              const clickable = !!n.link || !n.is_read;
              return (
                <div
                  key={n.id}
                  id={`notif-${n.id}`}
                  className={[
                    'glass-panel',
                    styles.row,
                    n.is_read ? '' : styles.unread,
                    n.id === focusId ? styles.focused : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  role={clickable ? 'button' : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  onClick={() => open(n)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      open(n);
                    }
                  }}
                >
                  <span className={styles.icon} aria-hidden="true">
                    <Icon size={17} />
                  </span>
                  <div className={styles.rowMain}>
                    <span className={styles.typeLabel}>
                      {TYPE_LABELS[n.type] ?? n.type}
                    </span>
                    <NotifBody text={n.body} expanded={n.id === focusId} />
                  </div>
                  <div className={styles.rowEnd}>
                    <span className={styles.when}>{timeAgo(n.created_at)}</span>
                    {!n.is_read ? (
                      <button
                        type="button"
                        className={styles.markReadBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          markRead(n);
                        }}
                        title={'Отметить прочитанным'}
                        aria-label={'Отметить прочитанным'}
                      >
                        <Check size={18} />
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
          <Pagination
            page={data.page}
            total={data.total}
            perPage={data.per_page}
            onPage={setPage}
          />
        </>
      )}
    </div>
  );
}
