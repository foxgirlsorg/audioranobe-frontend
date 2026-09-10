'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Inbox } from 'lucide-react';
import { api } from '@/lib/api';
import { errMsg, useToast } from '@/lib/toast';
import { timeAgo } from '@/lib/format';
import type { ModQueuePage, ModRequest, NarratorRefBrief, UserBrief } from '@/lib/types';
import Spinner from '@/components/Spinner/Spinner';
import UserAvatar from '@/components/UserAvatar/UserAvatar';
import EmptyState from '@/components/EmptyState/EmptyState';
import Tabs from '@/components/Tabs/Tabs';
import InfiniteScroll from '@/components/InfiniteScroll/InfiniteScroll';
import { useInfiniteList } from '@/lib/useInfiniteList';
import { ModShell, ErrorPanel, splitHeading } from '@/app/mod/modnav';
import styles from './page.module.css';

type TabKey = 'all' | 'transfer' | 'narrator' | 'title' | 'chapter' | 'author';
type Counts = ModQueuePage['counts'];

// Handovers get their own tab; the per-type tabs hold content changes
// (create/update/delete) only, so no request shows up under two of them.
const TABS: { key: TabKey; label: string; params: { type?: string; kind?: string } }[] = [
  { key: 'all', label: 'Все', params: {} },
  { key: 'transfer', label: 'Передачи', params: { kind: 'transfer' } },
  { key: 'narrator', label: 'Чтецы', params: { type: 'narrator', kind: 'content' } },
  { key: 'title', label: 'Тайтлы', params: { type: 'title', kind: 'content' } },
  { key: 'chapter', label: 'Главы', params: { type: 'chapter', kind: 'content' } },
  { key: 'author', label: 'Авторы', params: { type: 'author', kind: 'content' } },
];
const TAB_KEYS: string[] = TABS.map((t) => t.key);

/** Which tab's count a request belongs to (besides "all"). */
function tabOf(r: ModRequest): TabKey {
  return r.action === 'transfer' ? 'transfer' : (r.entity_type as TabKey);
}

const ACTION_LABELS: Record<string, string> = {
  create: 'создание',
  update: 'изменение',
  delete: 'удаление',
  transfer: 'передача',
};

const ENTITY_LABELS: Record<string, string> = {
  narrator: 'чтец',
  title: 'тайтл',
  chapter: 'глава',
  author: 'автор',
};

function entityTypeLabel(entityType: string): string {
  const key = ENTITY_LABELS[entityType];
  return key ? key : entityType;
}

function fmtVal(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'да' : 'нет';
  if (Array.isArray(v)) {
    if (v.length === 0) return '—';
    return v
      .map((x) => (x !== null && typeof x === 'object' ? JSON.stringify(x) : String(x)))
      .join(', ');
  }
  if (typeof v === 'object') return JSON.stringify(v);
  const s = String(v);
  return s === '' ? '—' : s;
}

function entityName(r: ModRequest): string {
  if (r.entity && typeof r.entity.name === 'string' && r.entity.name) return r.entity.name;
  if (typeof r.payload.name === 'string' && r.payload.name) return r.payload.name;
  const typeLabel = entityTypeLabel(r.entity_type);
  return r.entity_id != null ? `${typeLabel} #${r.entity_id}` : typeLabel;
}

function entityLink(r: ModRequest): string | null {
  if (r.entity_type === 'chapter') {
    return r.entity_id != null ? `/chapter/${r.entity_id}` : null;
  }
  if (r.entity_type === 'author') {
    return r.entity_id != null ? `/author/${r.entity_id}` : null;
  }
  const slug = r.entity && typeof r.entity.slug === 'string' ? r.entity.slug : '';
  if (!slug) return null;
  return r.entity_type === 'title'
    ? `/title/${encodeURIComponent(slug)}`
    : `/narrator/${encodeURIComponent(slug)}`;
}

function UserPill({ u }: { u: UserBrief }) {
  return (
    <Link href={`/user/${u.id}`} className={styles.pill}>
      <UserAvatar user={u} size={22} />
      <span className={styles.pillName}>{u.display_name || u.username}</span>
      <span className={styles.pillHandle}>@{u.username}</span>
    </Link>
  );
}

function NarratorPill({ n }: { n: NarratorRefBrief }) {
  return (
    <Link href={`/narrator/${encodeURIComponent(n.slug)}`} className={`${styles.pill} ${styles.pillPlain}`}>
      <span className={styles.pillName}>{n.name}</span>
    </Link>
  );
}

/**
 * A handover, read as "from → to" with names instead of ids, plus what
 * approving it will actually do (PanelController::applyTransfer).
 */
function TransferSides({ r }: { r: ModRequest }) {
  const t = r.transfer;
  if (!t) return null;
  const narrator = r.entity_type === 'narrator';
  const pill = (x: UserBrief | NarratorRefBrief) =>
    'username' in x ? <UserPill key={`u${x.id}`} u={x} /> : <NarratorPill key={`n${x.id}`} n={x} />;
  const from: (UserBrief | NarratorRefBrief)[] = t.from;

  return (
    <>
      <div className={styles.transferSides}>
        <div className={styles.side}>
          <span className={styles.sideLabel}>{narrator ? 'Сейчас владеет' : 'Сейчас у чтецов'}</span>
          <div className={styles.pills}>
            {from.length > 0 ? from.map(pill) : <span className={styles.nobody}>никого</span>}
          </div>
        </div>
        <ArrowRight size={18} className={styles.transferArrow} aria-hidden="true" />
        <div className={styles.side}>
          <span className={styles.sideLabel}>{narrator ? 'Получит' : 'Перейдёт к чтецу'}</span>
          <div className={styles.pills}>
            {t.to ? pill(t.to) : <span className={styles.gone}>получатель больше не существует</span>}
          </div>
        </div>
      </div>
      <p className={styles.transferNote}>
        {narrator
          ? 'После одобрения получатель станет единственным владельцем — все нынешние участники потеряют доступ к чтецу.'
          : 'После одобрения тайтл уйдёт от всех нынешних чтецов, а их отметки в главах будут сняты.'}
      </p>
    </>
  );
}

function RequestCard({ r, onDone }: { r: ModRequest; onDone: (id: number) => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');

  const approve = async () => {
    setBusy(true);
    try {
      await api(`/mod/requests/${r.id}/approve`, { method: 'POST', body: {} });
      toast('Заявка одобрена');
      onDone(r.id);
    } catch (e) {
      toast(errMsg(e), 'error');
      setBusy(false);
    }
  };

  const reject = async () => {
    if (!note.trim()) {
      toast('Укажите причину отклонения', 'error');
      return;
    }
    setBusy(true);
    try {
      await api(`/mod/requests/${r.id}/reject`, {
        method: 'POST',
        body: { note: note.trim() },
      });
      toast('Заявка отклонена');
      onDone(r.id);
    } catch (e) {
      toast(errMsg(e), 'error');
      setBusy(false);
    }
  };

  const link = entityLink(r);
  const name = entityName(r);
  const keys = Object.keys(r.payload);
  const actionKey = ACTION_LABELS[r.action];

  return (
    <article className={`glass-panel ${styles.card}`}>
      <header className={styles.cardHead}>
        <span className={`${styles.chip} ${styles[r.action]}`}>
          {actionKey ? actionKey : r.action}
        </span>
        <span className={styles.typeChip}>{entityTypeLabel(r.entity_type)}</span>
        {link ? (
          <Link href={link} className={styles.entityName}>
            {name}
          </Link>
        ) : (
          <span className={styles.entityName}>{name}</span>
        )}
        <span className={styles.meta}>
          {'от'}{' '}
          {r.submitted_by ? (
            <Link
              href={`/user/${r.submitted_by.id}`}
              className={styles.submitter}
            >
              {r.submitted_by.username}
            </Link>
          ) : (
            'удалённый пользователь'
          )}
          {' · '}
          {timeAgo(r.created_at)}
        </span>
      </header>

      {r.action === 'transfer' && r.transfer ? (
        <TransferSides r={r} />
      ) : r.action === 'delete' ? (
        <p className={styles.deleteWarn}>
          {`Одобрение навсегда удалит этот объект (${entityTypeLabel(r.entity_type)}) и всё, что с ним связано.`}
        </p>
      ) : keys.length > 0 ? (
        <div className={styles.diff}>
          {keys.map((k) => (
            <div key={k} className={styles.diffRow}>
              <span className={styles.diffKey}>{k.replace(/_/g, ' ')}</span>
              <span className={styles.diffVal}>
                {r.action === 'update' ? (
                  <>
                    <span className={styles.old}>
                      {fmtVal(r.entity ? r.entity[k] : undefined)}
                    </span>
                    <span className={styles.arrow} aria-hidden="true">
                      →
                    </span>
                  </>
                ) : null}
                <span className={styles.new}>{fmtVal(r.payload[k])}</span>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className={styles.noChanges}>{'В заявке нет изменённых полей.'}</p>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          className={r.action === 'delete' ? 'btn btn-danger' : 'btn btn-primary'}
          disabled={busy}
          onClick={approve}
        >
          {'Одобрить'}
        </button>
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={() => setRejecting((v) => !v)}
        >
          {'Отклонить'}
        </button>
      </div>

      {rejecting ? (
        <div className={styles.rejectBox}>
          <textarea
            className="textarea"
            rows={2}
            placeholder={'Причина отклонения (обязательно)…'}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className={styles.actions}>
            <button
              type="button"
              className="btn btn-danger"
              disabled={busy || !note.trim()}
              onClick={reject}
            >
              {'Подтвердить отклонение'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => setRejecting(false)}
            >
              {'Отмена'}
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function QueueContent() {
  const [init, setInit] = useState(false);
  const [tab, setTab] = useState<TabKey>('all');
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    const urlType = new URLSearchParams(window.location.search).get('type');
    if (urlType && TAB_KEYS.includes(urlType)) setTab(urlType as TabKey);
    setInit(true);
  }, []);

  const fetchPage = useCallback(
    (page: number) => {
      const params = TABS.find((t) => t.key === tab)?.params ?? {};
      return api<ModQueuePage>('/mod/queue', { params: { ...params, page } }).then((d) => {
        if (d.counts) setCounts(d.counts);
        return d;
      });
    },
    [tab]
  );
  const list = useInfiniteList<ModRequest>(fetchPage);
  const removeRequest = (id: number) => {
    const done = list.items?.find((r) => r.id === id);
    list.remove((r) => r.id === id);
    if (done) {
      const key = tabOf(done);
      setCounts((c) => (c ? { ...c, all: c.all - 1, [key]: Math.max(0, c[key] - 1) } : c));
    }
  };

  return (
    <div>
      <Tabs
        variant="underline"
        tabs={TABS.map((t) => ({ key: t.key, label: t.label, count: counts?.[t.key] || undefined }))}
        active={tab}
        onChange={(k) => setTab(k as TabKey)}
      />
      {list.error ? (
        <ErrorPanel message={list.error} onRetry={list.reload} />
      ) : !init || list.loading || !list.items ? (
        <div className={styles.loading}>
          <Spinner />
        </div>
      ) : list.items.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={'Очередь пуста'}
          body={'В этой категории нет ожидающих заявок.'}
        />
      ) : (
        <>
          <div className={styles.list}>
            {list.items.map((r) => (
              <RequestCard key={r.id} r={r} onDone={removeRequest} />
            ))}
          </div>
          <InfiniteScroll
            hasMore={list.hasMore}
            loading={list.loadingMore}
            error={list.moreError}
            onLoad={list.loadMore}
            total={list.total}
            shown={list.items.length}
          />
        </>
      )}
    </div>
  );
}

export default function ModQueuePage() {
  const h = splitHeading('Очередь заявок');
  return (
    <ModShell title={h.title} accent={h.accent} perm="moderation.queue">
      <QueueContent />
    </ModShell>
  );
}
