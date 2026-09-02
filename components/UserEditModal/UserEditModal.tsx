'use client';

import { useEffect, useRef, useState } from 'react';
import { ImagePlus, KeyRound, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errMsg, useToast } from '@/lib/toast';
import { resizeToWebp } from '@/lib/image';
import type { Badge, Me } from '@/lib/types';
import Modal from '@/components/Modal/Modal';
import SocialsEditor from '@/components/SocialsEditor/SocialsEditor';
import Toggle from '@/components/Toggle/Toggle';
import BadgePicker from '@/components/BadgePicker/BadgePicker';
import styles from './UserEditModal.module.css';

/**
 * The user-editing surface shared by the mod panel's user list and the
 * "edit" button on a public profile — same fields, same endpoints, one
 * component so the two never drift apart.
 */
export function UserEditModal({
  userId,
  onClose,
  onSaved,
}: {
  userId: number | null;
  onClose: () => void;
  onSaved: (updated: Me) => void;
}) {
  const { user: viewer } = useAuth();
  const isAdmin = viewer?.role === 'admin';
  const { toast } = useToast();

  const [target, setTarget] = useState<Me | null>(null);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState<'avatar' | 'cover' | null>(null);

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [socials, setSocials] = useState<string[]>([]);
  const [password, setPassword] = useState('');
  const [badges, setBadges] = useState<Badge[]>([]);
  const [badgeIds, setBadgeIds] = useState<number[]>([]);

  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (userId === null) {
      setTarget(null);
      return;
    }
    let alive = true;
    setLoadError('');
    setTarget(null);
    api<Me>(`/mod/users/${userId}`)
      .then((u) => {
        if (!alive) return;
        setTarget(u);
        setUsername(u.username);
        setDisplayName(u.display_name || '');
        setEmail(u.email ?? '');
        setBio(u.bio || '');
        setSocials(u.socials ?? []);
        setPassword('');
        setBadgeIds(u.badges.map((b) => b.id));
      })
      .catch((e) => {
        if (alive) setLoadError(errMsg(e));
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!isAdmin || userId === null) return;
    let alive = true;
    api<{ items: Badge[] }>('/mod/badges')
      .then((d) => {
        if (alive) setBadges(d.items);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [isAdmin, userId]);

  const applyUpdate = (updated: Me, keepOpen: boolean) => {
    setTarget(updated);
    onSaved(updated);
    if (!keepOpen) onClose();
  };

  const saveEdit = async () => {
    if (!target) return;
    setBusy(true);
    try {
      const updated = await api<Me>(`/mod/users/${target.id}`, {
        method: 'PATCH',
        body: {
          username: username.trim() || undefined,
          display_name: displayName,
          bio,
          socials,
          ...(isAdmin
            ? {
                email: email.trim() || undefined,
                ...(password ? { password } : {}),
              }
            : {}),
          ...(isAdmin ? { badge_ids: badgeIds } : {}),
        },
      });
      applyUpdate(updated, false);
      toast(password ? 'Профиль и пароль обновлены' : 'Профиль обновлён');
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setBusy(false);
  };

  const sendResetLink = async () => {
    if (!target) return;
    setBusy(true);
    try {
      const res = await api<{ sent: boolean }>(`/mod/users/${target.id}/reset-password`, {
        method: 'POST',
        body: {},
      });
      toast(
        res.sent
          ? `Ссылка для сброса отправлена на ${target.email}`
          : 'Почта не настроена на сервере — ссылка записана в лог'
      );
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setBusy(false);
  };

  const setVerified = async (value: boolean) => {
    if (!target) return;
    setBusy(true);
    try {
      const updated = await api<Me>(`/mod/users/${target.id}`, {
        method: 'PATCH',
        body: { email_verified: value },
      });
      applyUpdate(updated, true);
      toast(value ? 'Почта отмечена подтверждённой' : 'Отметка подтверждения снята');
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setBusy(false);
  };

  const uploadImage = async (kind: 'avatar' | 'cover', file: File) => {
    if (!target) return;
    setImageBusy(kind);
    try {
      const resized =
        kind === 'avatar'
          ? await resizeToWebp(file, 1024, 1024)
          : await resizeToWebp(file, 2048, 2048);
      const fd = new FormData();
      fd.append('file', resized, `${kind}.webp`);
      const updated = await api<Me>(`/mod/users/${target.id}/${kind}`, { formData: fd });
      applyUpdate(updated, true);
      toast(kind === 'avatar' ? 'Аватар обновлён' : 'Обложка обновлена');
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setImageBusy(null);
  };

  const removeImage = async (kind: 'avatar' | 'cover') => {
    if (!target) return;
    setImageBusy(kind);
    try {
      const updated = await api<Me>(`/mod/users/${target.id}`, {
        method: 'PATCH',
        body: kind === 'avatar' ? { remove_avatar: true } : { remove_cover: true },
      });
      applyUpdate(updated, true);
      toast(kind === 'avatar' ? 'Аватар удалён' : 'Обложка удалена');
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setImageBusy(null);
  };

  return (
    <Modal open={userId !== null} onClose={onClose} title={'Редактировать пользователя'}>
      {loadError ? (
        <div className={styles.loadError}>{loadError}</div>
      ) : !target ? (
        <div className={styles.loading}>{'Загрузка…'}</div>
      ) : (
        <div className={styles.editForm}>
          <label className={styles.fieldLabel}>
            {'Имя пользователя'}
            <input
              className="input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={'Имя пользователя'}
            />
          </label>
          <label className={styles.fieldLabel}>
            {'Отображаемое имя'}
            <input
              className="input"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={'Никнейм'}
            />
          </label>
          <label className={styles.fieldLabel}>
            {'О себе'}
            <textarea
              className="textarea"
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder={'Биография пользователя'}
            />
          </label>
          <div className={styles.fieldLabel}>
            {'Ссылки'}
            <SocialsEditor value={socials} onChange={setSocials} />
          </div>
          {isAdmin ? (
            <>
              <label className={styles.fieldLabel}>
                {'Email'}
                <input
                  className="input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={'Email'}
                />
              </label>
              <label className={styles.fieldLabel}>
                {'Новый пароль'}
                <input
                  className="input"
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={'Оставьте пустым, чтобы не менять'}
                  autoComplete="new-password"
                />
              </label>
            </>
          ) : null}

          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void sendResetLink()}>
            <KeyRound size={14} />
            {'Отправить ссылку для сброса'}
          </button>

          {isAdmin ? (
            <div className={styles.fieldLabel}>
              {'Бейджи'}
              <BadgePicker
                badges={badges}
                value={badgeIds}
                onChange={setBadgeIds}
                disabled={imageBusy !== null || busy}
              />
            </div>
          ) : null}

          {isAdmin ? (
            <Toggle
              checked={!!target.email_verified}
              onChange={(on) => void setVerified(on)}
              disabled={imageBusy !== null || busy}
              label="Почта подтверждена"
            />
          ) : null}

          <div className={styles.imagesBlock}>
            <span className={styles.fieldLabel}>{'Изображения профиля'}</span>
            <div className={styles.imageRow}>
              <span className={styles.imagePreview}>
                {target.avatar_url ? (
                  <img src={target.avatar_url} alt="" />
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
                disabled={imageBusy !== null || !target.avatar_url}
                onClick={() => void removeImage('avatar')}
                aria-label={'Удалить аватар'}
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className={styles.imageRow}>
              <span className={`${styles.imagePreview} ${styles.imageWide}`}>
                {target.cover_url ? (
                  <img src={target.cover_url} alt="" />
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
                disabled={imageBusy !== null || !target.cover_url}
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
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              {'Отмена'}
            </button>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void saveEdit()}>
              {'Сохранить'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default UserEditModal;
