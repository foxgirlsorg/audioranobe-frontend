'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { MailCheck, Pencil, Search, Trash2, Users } from 'lucide-react';
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
import UserEditModal from '@/components/UserEditModal/UserEditModal';
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
  const [toEditId, setToEditId] = useState<number | null>(null);
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

  const verifyEmail = async (u: Me, value: boolean) => {
    setBusyId(u.id);
    try {
      const updated = await api<Me>(`/mod/users/${u.id}`, {
        method: 'PATCH',
        body: { email_verified: value },
      });
      replaceRow(updated);
      toast(value ? 'Почта отмечена подтверждённой' : 'Отметка подтверждения снята');
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setBusyId(null);
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
                      <td className={styles.email}>
                        <span className={styles.emailRow}>
                          <span className={styles.emailText}>{u.email ?? '—'}</span>
                          {u.email && isAdmin ? (
                            u.email_verified ? (
                              <span className={styles.verifiedChip} title="Почта подтверждена">
                                <MailCheck size={13} />
                              </span>
                            ) : (
                              <button
                                type="button"
                                className={styles.verifyBtn}
                                disabled={busyId === u.id}
                                onClick={() => void verifyEmail(u, true)}
                                title="Отметить почту подтверждённой"
                              >
                                <MailCheck size={13} />
                                {'Подтвердить'}
                              </button>
                            )
                          ) : null}
                        </span>
                      </td>
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
                            disabled={busy}
                            onClick={() => setToEditId(u.id)}
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

      <UserEditModal userId={toEditId} onClose={() => setToEditId(null)} onSaved={replaceRow} />

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
