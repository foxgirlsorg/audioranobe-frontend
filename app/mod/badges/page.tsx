'use client';

import { useEffect, useState } from 'react';
import { Award, Pencil, Trash2, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { errMsg, useToast } from '@/lib/toast';
import type { Badge } from '@/lib/types';
import Spinner from '@/components/Spinner/Spinner';
import EmptyState from '@/components/EmptyState/EmptyState';
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog';
import Modal from '@/components/Modal/Modal';
import { ModShell, ErrorPanel, splitHeading } from '@/app/mod/modnav';
import styles from './page.module.css';

/** Renders trusted, admin-authored SVG at a given box size. */
function BadgeIcon({ svg, size }: { svg: string; size: number }) {
  return (
    <span
      className={styles.icon}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

interface Draft {
  id: number | null;
  name: string;
  svg: string;
}

function BadgesContent() {
  const { toast } = useToast();

  const [items, setItems] = useState<Badge[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
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

  const save = async () => {
    if (!draft) return;
    const name = draft.name.trim();
    const svg = draft.svg.trim();
    if (!name || !svg) {
      toast('Укажите название и SVG', 'error');
      return;
    }
    setSaving(true);
    try {
      if (draft.id === null) {
        await api('/mod/badges', { method: 'POST', body: { name, svg } });
        toast('Бейдж создан');
      } else {
        await api(`/mod/badges/${draft.id}`, { method: 'PATCH', body: { name, svg } });
        toast('Бейдж обновлён');
      }
      setDraft(null);
      setReload((n) => n + 1);
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setSaving(false);
  };

  const deleteBadge = async (b: Badge) => {
    try {
      await api(`/mod/badges/${b.id}`, { method: 'DELETE' });
      toast('Бейдж удалён');
      setItems((prev) => prev?.filter((x) => x.id !== b.id) ?? prev);
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  if (error) return <ErrorPanel message={error} onRetry={() => setReload((n) => n + 1)} />;
  if (loading || !items) {
    return (
      <div className={styles.loading}>
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <button type="button" className="btn btn-primary" onClick={() => setDraft({ id: null, name: '', svg: '' })}>
          <Plus size={16} /> {'Создать бейдж'}
        </button>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={Award} title={'Бейджей пока нет'} body={'Создайте первый бейдж.'} />
      ) : (
        <div className={styles.grid}>
          {items.map((b) => (
            <div key={b.id} className={`glass-panel ${styles.card}`}>
              <div className={styles.cardIcon}>
                <BadgeIcon svg={b.svg} size={40} />
              </div>
              <span className={styles.cardName}>{b.name}</span>
              <div className={styles.cardActions}>
                <button
                  type="button"
                  className={`btn btn-ghost ${styles.smallBtn}`}
                  onClick={() => setDraft({ id: b.id, name: b.name, svg: b.svg })}
                  title={'Редактировать'}
                >
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  className={`btn btn-ghost ${styles.smallBtn}`}
                  onClick={() => setToDelete(b)}
                  title={'Удалить'}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id === null ? 'Новый бейдж' : 'Изменение бейджа'}>
        {draft ? (
          <div className={styles.editor}>
            <div className={styles.previewPane}>
              {draft.svg.trim() ? (
                <>
                  <BadgeIcon svg={draft.svg} size={64} />
                  <span className={styles.previewInline}>
                    <BadgeIcon svg={draft.svg} size={16} /> {draft.name || 'Название'}
                  </span>
                </>
              ) : (
                <span className={styles.previewEmpty}>{'Предпросмотр иконки'}</span>
              )}
            </div>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>{'Название'}</span>
              <input
                className="input"
                type="text"
                placeholder={'Название бейджа'}
                value={draft.name}
                maxLength={40}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                autoFocus
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>{'SVG-иконка'}</span>
              <textarea
                className={`textarea ${styles.svgInput}`}
                rows={6}
                placeholder={'<svg viewBox="0 0 24 24">…</svg>'}
                value={draft.svg}
                onChange={(e) => setDraft({ ...draft, svg: e.target.value })}
              />
            </label>

            <div className={styles.editorActions}>
              <button type="button" className="btn btn-ghost" onClick={() => setDraft(null)}>
                {'Отмена'}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={saving || !draft.name.trim() || !draft.svg.trim()}
                onClick={save}
              >
                {draft.id === null ? 'Создать' : 'Сохранить'}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) void deleteBadge(toDelete);
        }}
        title={'Удалить бейдж'}
        body={toDelete ? `Удалить бейдж «${toDelete.name}»? Он будет снят со всех пользователей.` : ''}
        danger
      />
    </div>
  );
}

export default function ModBadgesPage() {
  const h = splitHeading('Управление бейджами');
  return (
    <ModShell title={h.title} accent={h.accent} perm="badges.manage">
      <BadgesContent />
    </ModShell>
  );
}
