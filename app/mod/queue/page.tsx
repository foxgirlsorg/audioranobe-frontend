'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Inbox } from 'lucide-react';
import { api } from '@/lib/api';
import { errMsg, useToast } from '@/lib/toast';
import { timeAgo } from '@/lib/format';
import type { ModRequest, Paginated } from '@/lib/types';
import Spinner from '@/components/Spinner/Spinner';
import EmptyState from '@/components/EmptyState/EmptyState';
import Tabs from '@/components/Tabs/Tabs';
import Pagination from '@/components/Pagination/Pagination';
import { ModShell, ErrorPanel, splitHeading } from '@/app/mod/modnav';
import styles from './page.module.css';

const TYPE_TABS = [
  { key: 'all', label: 'Все' },
  { key: 'narrator', label: 'Чтецы' },
  { key: 'title', label: 'Тайтлы' },
  { key: 'chapter', label: 'Главы' },
];

const ACTION_LABELS: Record<string, string> = {
  create: 'создание',
  update: 'изменение',
  delete: 'удаление',
};

const ENTITY_LABELS: Record<string, string> = {
  narrator: 'чтец',
  title: 'тайтл',
  chapter: 'глава',
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
  const slug = r.entity && typeof r.entity.slug === 'string' ? r.entity.slug : '';
  if (!slug) return null;
  return r.entity_type === 'title'
    ? `/title/${encodeURIComponent(slug)}`
    : `/narrator/${encodeURIComponent(slug)}`;
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

      {r.action === 'delete' ? (
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
  const [type, setType] = useState('all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<ModRequest> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const urlType = new URLSearchParams(window.location.search).get('type');
    if (urlType === 'narrator' || urlType === 'title' || urlType === 'chapter') setType(urlType);
    setInit(true);
  }, []);

  useEffect(() => {
    if (!init) return;
    let alive = true;
    setLoading(true);
    api<Paginated<ModRequest>>('/mod/queue', {
      params: { type: type === 'all' ? undefined : type, page },
    })
      .then((d) => {
        if (alive) {
          setData(d);
          setError('');
        }
      })
      .catch((e) => {
        if (alive) setError(errMsg(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [init, type, page, reload]);

  const removeRequest = (id: number) => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.filter((r) => r.id !== id),
            total: Math.max(0, prev.total - 1),
          }
        : prev
    );
  };

  return (
    <div>
      <Tabs
        tabs={TYPE_TABS}
        active={type}
        onChange={(k) => {
          setType(k);
          setPage(1);
        }}
      />
      {error ? (
        <ErrorPanel message={error} onRetry={() => setReload((n) => n + 1)} />
      ) : loading || !data ? (
        <div className={styles.loading}>
          <Spinner />
        </div>
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={'Очередь пуста'}
          body={'В этой категории нет ожидающих заявок.'}
        />
      ) : (
        <>
          <div className={styles.list}>
            {data.items.map((r) => (
              <RequestCard key={r.id} r={r} onDone={removeRequest} />
            ))}
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

export default function ModQueuePage() {
  const h = splitHeading('Очередь заявок');
  return (
    <ModShell title={h.title} accent={h.accent}>
      <QueueContent />
    </ModShell>
  );
}
