'use client';

import { useEffect, useMemo, useState } from 'react';
import { KeyRound, Copy, Pencil, Trash2, Plus, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errMsg, useToast } from '@/lib/toast';
import type { Badge, ModPermission, ModRole } from '@/lib/types';
import Spinner from '@/components/Spinner/Spinner';
import EmptyState from '@/components/EmptyState/EmptyState';
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog';
import Modal from '@/components/Modal/Modal';
import Toggle from '@/components/Toggle/Toggle';
import Select, { type SelectOption } from '@/components/Select/Select';
import { ModShell, ErrorPanel, splitHeading } from '@/app/mod/modnav';
import styles from './page.module.css';

interface Draft {
  id: number | null;
  slug: string | null;
  name: string;
  public_name: string;
  priority: number;
  badge_id: number | null;
  permissions: Set<string>;
  is_system: boolean;
  is_wildcard: boolean;
}

function BadgeSwatch({ svg }: { svg: string }) {
  return <span className={styles.badgeSwatch} dangerouslySetInnerHTML={{ __html: svg }} aria-hidden="true" />;
}

function RolesContent() {
  const { toast } = useToast();
  const { can } = useAuth();
  const isSuper = can('*');
  const [roles, setRoles] = useState<ModRole[]>([]);
  const [catalog, setCatalog] = useState<ModPermission[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<ModRole | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api<{ roles: ModRole[]; catalog: ModPermission[]; badges: Badge[] }>('/mod/roles')
      .then((d) => {
        if (!alive) return;
        setRoles(d.roles);
        setCatalog(d.catalog);
        setBadges(d.badges);
        setError('');
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

  const grouped = useMemo(() => {
    const map = new Map<string, ModPermission[]>();
    for (const p of catalog) {
      const list = map.get(p.category) ?? [];
      list.push(p);
      map.set(p.category, list);
    }
    return [...map.entries()];
  }, [catalog]);

  const badgeOptions: SelectOption<string>[] = useMemo(
    () => [{ value: '', label: 'Без бейджа' }, ...badges.map((b) => ({ value: String(b.id), label: b.name }))],
    [badges]
  );

  const openNew = () =>
    setDraft({ id: null, slug: null, name: '', public_name: '', priority: 0, badge_id: null, permissions: new Set(), is_system: false, is_wildcard: false });

  const openEdit = (r: ModRole) =>
    setDraft({
      id: r.id,
      slug: r.slug,
      name: r.name,
      public_name: r.public_name,
      priority: r.priority,
      badge_id: r.badge_id,
      permissions: new Set(r.permissions),
      is_system: r.is_system,
      is_wildcard: r.is_wildcard,
    });

  const openCopy = (r: ModRole) =>
    setDraft({
      id: null,
      slug: null,
      name: `${r.name} — копия`,
      public_name: r.public_name,
      priority: r.priority,
      badge_id: r.badge_id,
      permissions: new Set(r.permissions),
      is_system: false,
      is_wildcard: false,
    });

  const togglePerm = (slug: string) =>
    setDraft((d) => {
      if (!d) return d;
      const next = new Set(d.permissions);
      next.has(slug) ? next.delete(slug) : next.add(slug);
      return { ...d, permissions: next };
    });

  const save = async () => {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) {
      toast('Укажите название роли', 'error');
      return;
    }
    setSaving(true);
    const body: Record<string, unknown> = {
      name,
      public_name: draft.public_name.trim(),
      priority: draft.priority,
      badge_id: draft.badge_id,
      permissions: [...draft.permissions],
    };
    try {
      if (draft.id === null) {
        await api('/mod/roles', { method: 'POST', body });
        toast('Роль создана');
      } else {
        await api(`/mod/roles/${draft.id}`, { method: 'PATCH', body });
        toast('Роль сохранена');
      }
      setDraft(null);
      setReload((n) => n + 1);
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setSaving(false);
  };

  const remove = async (r: ModRole) => {
    try {
      await api(`/mod/roles/${r.id}`, { method: 'DELETE' });
      toast('Роль удалена');
      setReload((n) => n + 1);
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  if (error) return <ErrorPanel message={error} onRetry={() => setReload((n) => n + 1)} />;
  if (loading) {
    return (
      <div className={styles.loading}>
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <button type="button" className="btn btn-primary" onClick={openNew}>
          <Plus size={16} /> {'Создать роль'}
        </button>
      </div>

      {roles.length === 0 ? (
        <EmptyState icon={KeyRound} title={'Ролей пока нет'} body={'Создайте первую роль.'} />
      ) : (
        <div className={styles.grid}>
          {roles.map((r) => (
            <div key={r.id} className={`glass-panel ${styles.card}`}>
              <div className={styles.cardHead}>
                {r.badge ? <BadgeSwatch svg={r.badge.svg} /> : <KeyRound size={18} className={styles.cardIcon} />}
                <div className={styles.cardName}>
                  <span className={styles.roleName}>{r.name}</span>
                  <span className={styles.roleSlug}>{`на профиле: ${r.public_name || '—'}`}</span>
                </div>
              </div>
              <div className={styles.cardMeta}>
                <span className={styles.metaItem}>
                  <Users size={13} /> {r.member_count}
                </span>
                <span className={styles.metaItem}>
                  {r.is_wildcard ? 'все права' : `${r.permissions.length} прав`}
                </span>
                {r.is_system ? <span className={styles.sysTag}>{'системная'}</span> : null}
              </div>
              <div className={styles.cardActions}>
                <button type="button" className={`btn btn-ghost ${styles.smallBtn}`} onClick={() => openEdit(r)}>
                  <Pencil size={14} /> {'Изменить'}
                </button>
                <button type="button" className={`btn btn-ghost ${styles.smallBtn}`} onClick={() => openCopy(r)}>
                  <Copy size={14} /> {'Копировать'}
                </button>
                {!r.is_system ? (
                  <button
                    type="button"
                    className={`btn btn-ghost ${styles.smallBtn}`}
                    onClick={() => setToDelete(r)}
                    disabled={r.member_count > 0}
                    title={r.member_count > 0 ? 'Сначала переведите пользователей на другую роль' : 'Удалить'}
                  >
                    <Trash2 size={14} />
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id === null ? 'Новая роль' : 'Изменение роли'} size="wide">
        {draft ? (
          <div className={styles.editor}>
            <div className={styles.fieldRow}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>{'Название'}</span>
                <input
                  className="input"
                  type="text"
                  value={draft.name}
                  maxLength={40}
                  placeholder={'Видно в панели модерации'}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  autoFocus
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>{'Имя на профиле'}</span>
                <input
                  className="input"
                  type="text"
                  value={draft.public_name}
                  maxLength={40}
                  placeholder={'Пусто — без метки на странице'}
                  onChange={(e) => setDraft({ ...draft, public_name: e.target.value })}
                />
              </label>
            </div>

            <div className={styles.fieldRow}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>{'Приоритет'}</span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={99}
                  value={draft.priority}
                  onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) || 0 })}
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>{'Бейдж роли'}</span>
                <Select<string>
                  value={draft.badge_id === null ? '' : String(draft.badge_id)}
                  options={badgeOptions}
                  onChange={(v) => setDraft({ ...draft, badge_id: v === '' ? null : Number(v) })}
                  ariaLabel="Бейдж роли"
                />
              </label>
            </div>

            <div className={styles.permsHead}>{'Права'}</div>
            <div className={styles.perms}>
              {grouped.map(([category, perms]) => (
                <section key={category} className={styles.permSection}>
                  <h4 className={styles.permSectionTitle}>{category}</h4>
                  {perms.map((p) => {
                    const locked = !isSuper && !can(p.slug);
                    return (
                      <div
                        key={p.slug}
                        className={`${styles.permRow} ${locked ? styles.permRowLocked : ''}`}
                        title={locked ? 'Нельзя выдать право, которого у вас нет' : undefined}
                      >
                        <div className={styles.permText}>
                          <span className={styles.permName}>{p.name}</span>
                          <span className={styles.permDesc}>{p.description}</span>
                        </div>
                        <Toggle
                          checked={draft.permissions.has(p.slug)}
                          disabled={locked}
                          onChange={() => togglePerm(p.slug)}
                        />
                      </div>
                    );
                  })}
                </section>
              ))}
            </div>

            <div className={styles.editorActions}>
              <button type="button" className="btn btn-ghost" onClick={() => setDraft(null)}>
                {'Отмена'}
              </button>
              <button type="button" className="btn btn-primary" onClick={save} disabled={saving || !draft.name.trim()}>
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
          if (toDelete) void remove(toDelete);
        }}
        title={'Удалить роль'}
        body={toDelete ? `Удалить роль «${toDelete.name}»?` : ''}
        danger
      />
    </div>
  );
}

export default function ModRolesPage() {
  const h = splitHeading('Роли и права');
  return (
    <ModShell title={h.title} accent={h.accent} perm="roles.manage">
      <RolesContent />
    </ModShell>
  );
}
