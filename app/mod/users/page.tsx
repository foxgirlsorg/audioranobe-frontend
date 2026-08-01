'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ImagePlus, KeyRound, Pencil, Search, Trash2, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errMsg, useToast } from '@/lib/toast';
import { formatDate } from '@/lib/format';
import type { Me, Paginated, Role } from '@/lib/types';
import Spinner from '@/components/Spinner/Spinner';
import EmptyState from '@/components/EmptyState/EmptyState';
import InfiniteScroll from '@/components/InfiniteScroll/InfiniteScroll';
import { useInfiniteList } from '@/lib/useInfiniteList';
import UserAvatar from '@/components/UserAvatar/UserAvatar';
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog';
import Modal from '@/components/Modal/Modal';
import { ModShell, ErrorPanel, splitHeading } from '@/app/mod/modnav';
import Select from '@/components/Select/Select';
import Toggle from '@/components/Toggle/Toggle';
import styles from './page.module.css';

const ROLE_LABELS: Record<string, string> = {
  user: 'пользователь',
  moderator: 'модератор',
  admin: 'админ',
};

function UsersContent() {
  const { user: me } = useAuth();
  const { toast } = useToast();
  const isAdmin = me?.role === 'admin';

  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [toDelete, setToDelete] = useState<Me | null>(null);
  const [toEdit, setToEdit] = useState<Me | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [imageBusy, setImageBusy] = useState<'avatar' | 'cover' | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const [toBan, setToBan] = useState<Me | null>(null);
  const [banReason, setBanReason] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(q.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [q]);

  const fetchPage = useCallback(
    (page: number) => api<Paginated<Me>>('/mod/users', { params: { q: query, page } }),
    [query]
  );
  const list = useInfiniteList<Me>(fetchPage);

  const replaceRow = (updated: Me) => list.patch((u) => u.id === updated.id, () => updated);

  const changeRole = async (u: Me, role: string) => {
    if (role === u.role) return;
    setBusyId(u.id);
    try {
      const updated = await api<Me>(`/mod/users/${u.id}`, {
        method: 'PATCH',
        body: { role },
      });
      replaceRow(updated);
      toast(
        `${u.username} теперь ${ROLE_LABELS[role] ? ROLE_LABELS[role] : role}`
      );
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setBusyId(null);
  };

  const openEdit = (u: Me) => {
    setToEdit(u);
    setEditUsername(u.username);
    setEditEmail(u.email ?? '');
    setEditBio(u.bio || '');
    setEditPassword('');
  };

  const saveEdit = async () => {
    if (!toEdit) return;
    setBusyId(toEdit.id);
    try {
      const updated = await api<Me>(`/mod/users/${toEdit.id}`, {
        method: 'PATCH',
        body: {
          username: editUsername.trim() || undefined,
          ...(isAdmin
            ? {
                email: editEmail.trim() || undefined,
                bio: editBio,
                ...(editPassword ? { password: editPassword } : {}),
              }
            : {}),
        },
      });
      replaceRow(updated);
      setToEdit(null);
      toast(editPassword ? 'Профиль и пароль обновлены' : 'Профиль обновлён');
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setBusyId(null);
  };

  const openBanDialog = (u: Me) => {
    setToBan(u);
    setBanReason('');
  };

  const toggleBan = async () => {
    if (!toBan) return;
    setBusyId(toBan.id);
    try {
      const updated = await api<Me>(`/mod/users/${toBan.id}`, {
        method: 'PATCH',
        body: { is_banned: !toBan.is_banned, ban_reason: banReason.trim() || undefined },
      });
      replaceRow(updated);
      setToBan(null);
      toast(
        updated.is_banned
          ? `${toBan.username} забанен`
          : `${toBan.username} разбанен`
      );
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setBusyId(null);
  };

  const deleteUser = async (u: Me) => {
    setBusyId(u.id);
    try {
      await api(`/mod/users/${u.id}`, { method: 'DELETE' });
      toast('Пользователь удалён');
      list.remove((x) => x.id === u.id);
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setBusyId(null);
  };

  const roles: Role[] = ['user', 'moderator', 'admin'];

  const sendResetLink = async (u: Me) => {
    setBusyId(u.id);
    try {
      const res = await api<{ sent: boolean }>(`/mod/users/${u.id}/reset-password`, {
        method: 'POST',
        body: {},
      });
      toast(
        res.sent
          ? `Ссылка для сброса отправлена на ${u.email}`
          : 'Почта не настроена на сервере — ссылка записана в лог'
      );
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setBusyId(null);
  };

  const setVerified = async (value: boolean) => {
    if (!toEdit) return;
    setBusyId(toEdit.id);
    try {
      const updated = await api<Me>(`/mod/users/${toEdit.id}`, {
        method: 'PATCH',
        body: { email_verified: value },
      });
      replaceRow(updated);
      setToEdit(updated);
      toast(value ? 'Почта отмечена подтверждённой' : 'Отметка подтверждения снята');
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setBusyId(null);
  };

  const uploadImage = async (kind: 'avatar' | 'cover', file: File) => {
    if (!toEdit) return;
    setImageBusy(kind);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const updated = await api<Me>(`/mod/users/${toEdit.id}/${kind}`, { formData: fd });
      replaceRow(updated);
      setToEdit(updated);
      toast(kind === 'avatar' ? 'Аватар обновлён' : 'Обложка обновлена');
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setImageBusy(null);
  };

  const removeImage = async (kind: 'avatar' | 'cover') => {
    if (!toEdit) return;
    setImageBusy(kind);
    try {
      const updated = await api<Me>(`/mod/users/${toEdit.id}`, {
        method: 'PATCH',
        body: kind === 'avatar' ? { remove_avatar: true } : { remove_cover: true },
      });
      replaceRow(updated);
      setToEdit(updated);
      toast(kind === 'avatar' ? 'Аватар удалён' : 'Обложка удалена');
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setImageBusy(null);
  };

  const toggleSkipModeration = async (u: Me) => {
    setBusyId(u.id);
    try {
      const updated = await api<Me>(`/mod/users/${u.id}/skip-moderation`, {
        method: 'PATCH',
        body: { skip_moderation: !u.skip_moderation },
      });
      replaceRow(updated);
      toast(
        updated.skip_moderation
          ? `${u.username} публикует без модерации`
          : `${u.username} снова проходит модерацию`
      );
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setBusyId(null);
  };

  return (
    <div>
      <div className={styles.searchRow}>
        <Search size={16} className={styles.searchIcon} aria-hidden="true" />
        <input
          className={`input ${styles.searchInput}`}
          type="search"
          placeholder={'Поиск по нику или email…'}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label={'Поиск пользователей'}
        />
      </div>

      {list.error ? (
        <ErrorPanel message={list.error} onRetry={list.reload} />
      ) : list.loading || !list.items ? (
        <div className={styles.loading}>
          <Spinner />
        </div>
      ) : list.items.length === 0 ? (
        <EmptyState
          icon={Users}
          title={'Пользователи не найдены'}
          body={'Попробуйте изменить запрос.'}
        />
      ) : (
        <>
          <div className={`glass-panel ${styles.tableWrap}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{'Пользователь'}</th>
                  <th>{'Email'}</th>
                  <th>{'Роль'}</th>
                  <th>{'Без модерации'}</th>
                  <th>{'Статус'}</th>
                  <th>{'Регистрация'}</th>
                  <th aria-label={'Действия'} />
                </tr>
              </thead>
              <tbody>
                {list.items.map((u) => {
                  const self = me?.id === u.id;
                  const busy = busyId === u.id;
                  return (
                    <tr key={u.id} className={u.is_banned ? styles.bannedRow : undefined}>
                      <td>
                        <div className={styles.userCell}>
                          <UserAvatar user={u} size={30} />
                          <Link
                            href={`/user/${u.id}`}
                            className={styles.username}
                          >
                            {u.username}
                          </Link>
                          {u.is_banned ? (
                            <span className={styles.bannedChip}>{'забанен'}</span>
                          ) : null}
                        </div>
                      </td>
                      <td className={styles.email}>{u.email ?? '—'}</td>
                      <td>
                        <Select
                          size="sm"
                          className={styles.roleSelect}
                          value={u.role}
                          disabled={!isAdmin || self || busy}
                          options={roles.map((r) => ({
                            value: r,
                            label: ROLE_LABELS[r] ? ROLE_LABELS[r] : r,
                          }))}
                          onChange={(v) => changeRole(u, v)}
                          ariaLabel={`Роль пользователя ${u.username}`}
                        />
                      </td>
                      <td>
                        <Toggle
                          checked={u.skip_moderation}
                          disabled={!isAdmin || busy}
                          onChange={() => void toggleSkipModeration(u)}
                          label={u.skip_moderation ? 'разрешено' : 'нет'}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className={
                            u.is_banned
                              ? `btn ${styles.smallBtn}`
                              : `btn btn-danger ${styles.smallBtn}`
                          }
                          disabled={self || busy}
                          onClick={() => {
                            setToBan(u);
                            setBanReason('');
                            if (!isAdmin) {
                              void (async () => {
                                setBusyId(u.id);
                                try {
                                  const updated = await api<Me>(`/mod/users/${u.id}`, {
                                    method: 'PATCH',
                                    body: { is_banned: !u.is_banned },
                                  });
                                  replaceRow(updated);
                                  toast(
                                    updated.is_banned
                                      ? `${u.username} забанен`
                                      : `${u.username} разбанен`
                                  );
                                } catch (e) {
                                  toast(errMsg(e), 'error');
                                }
                                setBusyId(null);
                              })();
                            }
                          }}
                        >
                          {u.is_banned ? 'Разбанить' : 'Забанить'}
                        </button>
                      </td>
                      <td className={styles.joined}>{formatDate(u.created_at)}</td>
                      <td>
                        <div className={styles.rowActions}>
                          <button
                            type="button"
                            className={`btn btn-ghost ${styles.smallBtn}`}
                            disabled={self || busy}
                            onClick={() => openEdit(u)}
                            aria-label={`Редактировать ${u.username}`}
                            title={'Редактировать'}
                          >
                            <Pencil size={15} />
                          </button>
                          {isAdmin ? (
                            <button
                              type="button"
                              className={`btn btn-ghost ${styles.smallBtn}`}
                              disabled={self || busy}
                              onClick={() => setToDelete(u)}
                              aria-label={`Удалить ${u.username}`}
                              title={'Удалить аккаунт'}
                            >
                              <Trash2 size={15} />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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

      <Modal
        open={!!toEdit}
        onClose={() => setToEdit(null)}
        title={'Редактировать пользователя'}
      >
        <div className={styles.editForm}>
          <label className={styles.fieldLabel}>
            {'Имя пользователя'}
            <input
              className="input"
              type="text"
              value={editUsername}
              onChange={(e) => setEditUsername(e.target.value)}
              placeholder={'Имя пользователя'}
            />
          </label>
          {isAdmin ? (
            <>
              <label className={styles.fieldLabel}>
                {'Email'}
                <input
                  className="input"
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder={'Email'}
                />
              </label>
              <label className={styles.fieldLabel}>
                {'О себе'}
                <textarea
                  className="textarea"
                  rows={3}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder={'Биография пользователя'}
                />
              </label>
              <label className={styles.fieldLabel}>
                {'Новый пароль'}
                <input
                  className="input"
                  type="text"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder={'Оставьте пустым, чтобы не менять'}
                  autoComplete="new-password"
                />
              </label>
            </>
          ) : null}
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busyId === toEdit?.id}
            onClick={() => {
              if (toEdit) void sendResetLink(toEdit);
            }}
          >
            <KeyRound size={14} />
            {'Отправить ссылку для сброса'}
          </button>

          {isAdmin ? (
            <Toggle
              checked={!!toEdit?.email_verified}
              onChange={(on) => void setVerified(on)}
              disabled={imageBusy !== null || busyId === toEdit?.id}
              label="Почта подтверждена"
            />
          ) : null}

          <div className={styles.imagesBlock}>
            <span className={styles.fieldLabel}>{'Изображения профиля'}</span>
            <div className={styles.imageRow}>
              <span className={styles.imagePreview}>
                {toEdit?.avatar_url ? (
                  <img src={toEdit.avatar_url} alt="" />
                ) : (
                  <span className={styles.imageEmpty}>{'нет'}</span>
                )}
              </span>
              <span className={styles.imageName}>{'Аватар'}</span>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={imageBusy !== null}
                onClick={() => avatarInputRef.current?.click()}
              >
                <ImagePlus size={14} />
                {'Заменить'}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={imageBusy !== null || !toEdit?.avatar_url}
                onClick={() => void removeImage('avatar')}
                aria-label={'Удалить аватар'}
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className={styles.imageRow}>
              <span className={`${styles.imagePreview} ${styles.imageWide}`}>
                {toEdit?.cover_url ? (
                  <img src={toEdit.cover_url} alt="" />
                ) : (
                  <span className={styles.imageEmpty}>{'нет'}</span>
                )}
              </span>
              <span className={styles.imageName}>{'Обложка'}</span>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={imageBusy !== null}
                onClick={() => coverInputRef.current?.click()}
              >
                <ImagePlus size={14} />
                {'Заменить'}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={imageBusy !== null || !toEdit?.cover_url}
                onClick={() => void removeImage('cover')}
                aria-label={'Удалить обложку'}
              >
                <Trash2 size={14} />
              </button>
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadImage('avatar', f);
                e.target.value = '';
              }}
            />
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadImage('cover', f);
                e.target.value = '';
              }}
            />
          </div>

          <div className={styles.editActions}>
            <button type="button" className="btn btn-ghost" onClick={() => setToEdit(null)}>
              {'Отмена'}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busyId === toEdit?.id}
              onClick={saveEdit}
            >
              {'Сохранить'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!toBan}
        onClose={() => setToBan(null)}
        title={toBan?.is_banned ? 'Разбанить пользователя' : 'Забанить пользователя'}
      >
        <div className={styles.editForm}>
          {toBan?.is_banned ? (
            <p className={styles.banInfo}>
              {`Вы уверены, что хотите разбанить ${toBan?.username}?`}
            </p>
          ) : (
            <>
              <p className={styles.banInfo}>
                {`Забанить пользователя ${toBan?.username}?`}
              </p>
              <label className={styles.fieldLabel}>
                {'Причина бана *'}
                <textarea
                  className="textarea"
                  rows={3}
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder={'Укажите причину бана…'}
                />
              </label>
            </>
          )}
          <div className={styles.editActions}>
            <button type="button" className="btn btn-ghost" onClick={() => setToBan(null)}>
              {'Отмена'}
            </button>
            <button
              type="button"
              className={toBan?.is_banned ? 'btn btn-primary' : 'btn btn-danger'}
              disabled={busyId === toBan?.id || (!toBan?.is_banned && !banReason.trim())}
              onClick={toggleBan}
            >
              {toBan?.is_banned ? 'Разбанить' : 'Забанить'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) void deleteUser(toDelete);
        }}
        title={'Удалить пользователя'}
        body={
          toDelete
            ? `Навсегда удалить аккаунт ${toDelete.username}? Комментарии останутся и будут показаны как от удалённого пользователя. Это действие нельзя отменить.`
            : ''
        }
        danger
      />
    </div>
  );
}

export default function ModUsersPage() {
  const h = splitHeading('Управление пользователями');
  return (
    <ModShell title={h.title} accent={h.accent}>
      <UsersContent />
    </ModShell>
  );
}
