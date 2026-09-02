'use client';

import { useEffect, useState } from 'react';
import { Award, Pencil, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { errMsg, useToast } from '@/lib/toast';
import type { Badge } from '@/lib/types';
import Spinner from '@/components/Spinner/Spinner';
import EmptyState from '@/components/EmptyState/EmptyState';
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog';
import { ModShell, ErrorPanel, splitHeading } from '@/app/mod/modnav';
import styles from './page.module.css';

function BadgePreview({ svg }: { svg: string }) {
  return <span className={styles.preview} dangerouslySetInnerHTML={{ __html: svg }} />;
}

function BadgeForm({
  name,
  svg,
  onName,
  onSvg,
  onSubmit,
  busy,
  submitLabel,
}: {
  name: string;
  svg: string;
  onName: (v: string) => void;
  onSvg: (v: string) => void;
  onSubmit: () => void;
  busy: boolean;
  submitLabel: string;
}) {
  return (
    <div className={styles.formRow}>
      <input
        className={`input ${styles.nameInput}`}
        type="text"
        placeholder={'Название бейджа'}
        value={name}
        onChange={(e) => onName(e.target.value)}
      />
      <textarea
        className={`textarea ${styles.svgInput}`}
        rows={3}
        placeholder={'<svg viewBox="0 0 24 24">…</svg>'}
        value={svg}
        onChange={(e) => onSvg(e.target.value)}
      />
      {svg.trim() ? <BadgePreview svg={svg} /> : null}
      <button
        type="button"
        className="btn btn-primary"
        disabled={busy || !name.trim() || !svg.trim()}
        onClick={onSubmit}
      >
        {submitLabel}
      </button>
    </div>
  );
}

function BadgesContent() {
  const { toast } = useToast();

  const [items, setItems] = useState<Badge[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  const [newName, setNewName] = useState('');
  const [newSvg, setNewSvg] = useState('');
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editSvg, setEditSvg] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  const [toDelete, setToDelete] = useState<Badge | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api<{ items: Badge[] }>('/mod/badges')
      .then((d) => {
        if (alive) {
          setItems(d.items);
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
  }, [reload]);

  const createBadge = async () => {
    const name = newName.trim();
    const svg = newSvg.trim();
    if (!name || !svg) return;
    setCreating(true);
    try {
      await api('/mod/badges', { method: 'POST', body: { name, svg } });
      toast('Бейдж создан');
      setNewName('');
      setNewSvg('');
      setReload((n) => n + 1);
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setCreating(false);
  };

  const startEdit = (b: Badge) => {
    setEditingId(b.id);
    setEditName(b.name);
    setEditSvg(b.svg);
  };

  const saveEdit = async (b: Badge) => {
    const name = editName.trim();
    const svg = editSvg.trim();
    if (!name || !svg) return;
    setBusyId(b.id);
    try {
      await api(`/mod/badges/${b.id}`, { method: 'PATCH', body: { name, svg } });
      toast('Бейдж обновлён');
      setEditingId(null);
      setReload((n) => n + 1);
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setBusyId(null);
  };

  const deleteBadge = async (b: Badge) => {
    setBusyId(b.id);
    try {
      await api(`/mod/badges/${b.id}`, { method: 'DELETE' });
      toast('Бейдж удалён');
      setItems((prev) => prev?.filter((x) => x.id !== b.id) ?? prev);
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setBusyId(null);
  };

  return (
    <div>
      <div className={`glass-panel ${styles.createForm}`}>
        <h3 className={styles.formTitle}>{'Новый бейдж'}</h3>
        <BadgeForm
          name={newName}
          svg={newSvg}
          onName={setNewName}
          onSvg={setNewSvg}
          onSubmit={createBadge}
          busy={creating}
          submitLabel={'Создать'}
        />
      </div>

      {error ? (
        <ErrorPanel message={error} onRetry={() => setReload((n) => n + 1)} />
      ) : loading || !items ? (
        <div className={styles.loading}>
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={Award} title={'Бейджей пока нет'} body={'Создайте первый бейдж выше.'} />
      ) : (
        <div className={`glass-panel ${styles.tableWrap}`}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th aria-label={'Иконка'} />
                <th>{'Название'}</th>
                <th aria-label={'Действия'} />
              </tr>
            </thead>
            <tbody>
              {items.map((b) => {
                const editing = editingId === b.id;
                const busy = busyId === b.id;
                return editing ? (
                  <tr key={b.id}>
                    <td colSpan={3}>
                      <BadgeForm
                        name={editName}
                        svg={editSvg}
                        onName={setEditName}
                        onSvg={setEditSvg}
                        onSubmit={() => saveEdit(b)}
                        busy={busy}
                        submitLabel={'Сохранить'}
                      />
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => setEditingId(null)}
                      >
                        {'Отмена'}
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={b.id}>
                    <td>
                      <BadgePreview svg={b.svg} />
                    </td>
                    <td className={styles.badgeName}>{b.name}</td>
                    <td>
                      <div className={styles.rowActions}>
                        <button
                          type="button"
                          className={`btn btn-ghost ${styles.smallBtn}`}
                          disabled={busy}
                          onClick={() => startEdit(b)}
                          title={'Редактировать'}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          className={`btn btn-ghost ${styles.smallBtn}`}
                          disabled={busy}
                          onClick={() => setToDelete(b)}
                          title={'Удалить'}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) void deleteBadge(toDelete);
        }}
        title={'Удалить бейдж'}
        body={
          toDelete
            ? `Удалить бейдж «${toDelete.name}»? Он будет снят со всех пользователей.`
            : ''
        }
        danger
      />
    </div>
  );
}

export default function ModBadgesPage() {
  const h = splitHeading('Управление бейджами');
  return (
    <ModShell title={h.title} accent={h.accent} adminOnly>
      <BadgesContent />
    </ModShell>
  );
}
