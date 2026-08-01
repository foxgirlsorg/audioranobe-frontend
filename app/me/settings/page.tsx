'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Bell,
  EyeOff,
  ImagePlus,
  Link2 as LinkIcon,
  KeyRound,
  MailWarning,
  ShieldAlert,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';
import { api } from '@/lib/api';
import type {
  AuthProvider,
  ContentPrefs,
  Genre,
  Identity,
  Me,
  NotificationPrefs,
} from '@/lib/types';
import ProviderAuth from '@/components/ProviderAuth/ProviderAuth';
import { useAuth } from '@/lib/auth';
import { useToast, errMsg } from '@/lib/toast';
import Spinner from '@/components/Spinner/Spinner';
import SocialsEditor from '@/components/SocialsEditor/SocialsEditor';
import ImageCropper from '@/components/ImageCropper/ImageCropper';
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog';
import Modal from '@/components/Modal/Modal';
import MarkdownEditor from '@/components/MarkdownEditor/MarkdownEditor';
import styles from './page.module.css';

const USERNAME_RE = /^[A-Za-z0-9_]{3,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PROVIDER_LABELS: Record<AuthProvider, string> = {
  google: 'Google',
  discord: 'Discord',
  telegram: 'Telegram',
};
const MAX_SOCIAL_LEN = 200;

const PREF_DEFS: { key: keyof NotificationPrefs; label: string; hint: string }[] = [
  {
    key: 'new_chapter',
    label: 'Новые главы',
    hint: 'Выходит новая глава тайтла из вашей библиотеки',
  },
  {
    key: 'narrator_release',
    label: 'Релизы чтецов',
    hint: 'Чтец, на которого вы подписаны, публикует что-то новое',
  },
  {
    key: 'comment_reply',
    label: 'Ответы на комментарии',
    hint: 'Кто-то отвечает на ваш комментарий',
  },
  {
    key: 'narrator_comment',
    label: 'Комментарии к озвучкам',
    hint: 'Кто-то комментирует тайтл в озвучке вашей команды',
  },
  {
    key: 'system',
    label: 'Объявления',
    hint: 'Новости и служебные сообщения от команды AudioRanobe',
  },
  {
    key: 'request_approved',
    label: 'Заявки одобрены',
    hint: 'Модератор одобрил вашу заявку на создание или изменение',
  },
  {
    key: 'request_rejected',
    label: 'Заявки отклонены',
    hint: 'Модератор отклонил вашу заявку с указанием причины',
  },
  {
    key: 'entity_modified',
    label: 'Изменения объектов',
    hint: 'Модератор изменил чтеца или тайтл, к которому вы имеете отношение',
  },
  {
    key: 'entity_deleted',
    label: 'Удаление объектов',
    hint: 'Модератор удалил объект, к которому вы имеете отношение',
  },
];

function validSocial(u: string): boolean {
  if (u.length > MAX_SOCIAL_LEN) return false;
  try {
    const p = new URL(u);
    return p.protocol === 'http:' || p.protocol === 'https:';
  } catch {
    return false;
  }
}

function splitHeading(s: string): [string, string] {
  const i = s.indexOf(' ');
  return i === -1 ? [s, ''] : [s.slice(0, i), s.slice(i + 1)];
}

export default function SettingsPage() {
  const { user, loading: authLoading, refresh, logout } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [emailVerificationOn, setEmailVerificationOn] = useState(false);
  const [resending, setResending] = useState(false);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [socials, setSocials] = useState<string[]>([]);
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    let alive = true;
    api<{ email_verification: boolean }>('/config')
      .then((c) => {
        if (alive) setEmailVerificationOn(!!c.email_verification);
      })
      .catch(() => {
      });
    return () => {
      alive = false;
    };
  }, []);

  async function resendVerification() {
    setResending(true);
    try {
      await api('/me/verify-email/resend', { method: 'POST', body: {} });
      toast('Письмо отправлено — проверьте почту');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setResending(false);
    }
  }

  const [cropTarget, setCropTarget] = useState<'avatar' | 'cover' | null>(null);
  const [uploading, setUploading] = useState<'avatar' | 'cover' | null>(null);

  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [prefBusy, setPrefBusy] = useState<keyof NotificationPrefs | null>(null);

  const hasPassword = user?.has_password ?? true;
  const [identities, setIdentities] = useState<Identity[] | null>(null);
  const [unlinking, setUnlinking] = useState<AuthProvider | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailPw, setEmailPw] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);

  const [content, setContent] = useState<ContentPrefs | null>(null);
  const [sensitiveGenres, setSensitiveGenres] = useState<Genre[]>([]);
  const [contentBusy, setContentBusy] = useState<'nsfw' | number | null>(null);

  const [delOpen, setDelOpen] = useState(false);
  const [delPw, setDelPw] = useState('');
  const [deleting, setDeleting] = useState(false);

  const seededRef = useRef(false);
  const leavingRef = useRef(false);

  useEffect(() => {
    if (!authLoading && !user && !leavingRef.current) router.replace('/auth/login');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user && !seededRef.current) {
      seededRef.current = true;
      setUsername(user.username);
      setDisplayName(user.display_name);
      setBio(user.bio);
      setSocials(user.socials ?? []);
      setPrefs(user.notification_prefs);
      setContent(user.content_prefs);
      setIdentities(user.identities ?? []);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    api<{ items: Genre[] }>('/genres?per_page=200')
      .then((r) => {
        if (alive) setSensitiveGenres((r.items ?? []).filter((g) => g.is_sensitive));
      })
      .catch(() => {
      });
    return () => {
      alive = false;
    };
  }, [user]);

  if (authLoading || !user) {
    return (
      <div className={styles.center}>
        <Spinner size={34} />
      </div>
    );
  }

  async function saveProfile() {
    if (savingProfile) return;
    const name = username.trim();
    if (!USERNAME_RE.test(name)) {
      toast('Имя пользователя: 3–30 символов, только латинские буквы, цифры и подчёркивание', 'error');
      return;
    }
    const cleaned = socials.map((s) => s.trim()).filter((s) => s !== '');
    if (cleaned.length > 10) {
      toast('Можно добавить не больше 10 ссылок', 'error');
      return;
    }
    for (const u of cleaned) {
      if (!validSocial(u)) {
        toast(
          `Неверная ссылка: ${u.slice(0, 60)} — только http(s), не длиннее ${MAX_SOCIAL_LEN} символов`,
          'error'
        );
        return;
      }
    }
    setSavingProfile(true);
    try {
      await api<Me>('/me', {
        method: 'PATCH',
        body: {
          username: name,
          display_name: displayName.trim(),
          bio: bio.trim(),
          socials: cleaned,
        },
      });
      setSocials(cleaned);
      await refresh();
      toast('Профиль сохранён', 'ok');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setSavingProfile(false);
    }
  }

  async function uploadImage(kind: 'avatar' | 'cover', blob: Blob) {
    setUploading(kind);
    try {
      const fd = new FormData();
      fd.append('file', blob, `${kind}.jpg`);
      await api<Me>(kind === 'avatar' ? '/me/avatar' : '/me/cover', { formData: fd });
      await refresh();
      toast(kind === 'avatar' ? 'Аватар обновлён' : 'Обложка обновлена', 'ok');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setUploading(null);
    }
  }

  async function changePassword() {
    if (savingPw) return;
    if (hasPassword && !oldPw) {
      toast('Введите текущий пароль', 'error');
      return;
    }
    if (newPw.length < 8) {
      toast('Новый пароль должен быть не короче 8 символов', 'error');
      return;
    }
    if (newPw !== newPw2) {
      toast('Новые пароли не совпадают', 'error');
      return;
    }
    setSavingPw(true);
    try {
      await api('/me/password', {
        method: 'POST',
        body: { old_password: oldPw, new_password: newPw },
      });
      setOldPw('');
      setNewPw('');
      setNewPw2('');
      toast(hasPassword ? 'Пароль изменён' : 'Пароль установлен', 'ok');
      await refresh();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setSavingPw(false);
    }
  }

  async function togglePref(key: keyof NotificationPrefs) {
    if (!prefs || prefBusy) return;
    const next = !prefs[key];
    setPrefBusy(key);
    setPrefs({ ...prefs, [key]: next });
    try {
      const me = await api<Me>('/me/notification-prefs', {
        method: 'PATCH',
        body: { [key]: next },
      });
      setPrefs(me.notification_prefs);
      toast('Настройки уведомлений сохранены', 'ok');
    } catch (e) {
      setPrefs((p) => (p ? { ...p, [key]: !next } : p));
      toast(errMsg(e), 'error');
    } finally {
      setPrefBusy(null);
    }
  }

  async function saveEmail() {
    if (savingEmail) return;
    const email = newEmail.trim();
    if (!EMAIL_RE.test(email)) {
      toast('Введите корректный email', 'error');
      return;
    }
    setSavingEmail(true);
    try {
      await api<Me>('/me/email', {
        method: 'POST',
        body: hasPassword ? { email, password: emailPw } : { email },
      });
      await refresh();
      setEmailOpen(false);
      setEmailPw('');
      toast('Почта обновлена — подтвердите её по ссылке в письме', 'ok');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setSavingEmail(false);
    }
  }

  async function unlink(provider: AuthProvider) {
    if (unlinking) return;
    setUnlinking(provider);
    try {
      const res = await api<{ identities: Identity[] }>(`/me/identities/${provider}`, {
        method: 'DELETE',
      });
      setIdentities(res.identities);
      await refresh();
      toast(`${PROVIDER_LABELS[provider]} отвязан`, 'ok');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setUnlinking(null);
    }
  }

  async function saveContent(next: ContentPrefs, busy: 'nsfw' | number) {
    if (!content || contentBusy !== null) return;
    const prev = content;
    setContentBusy(busy);
    setContent(next);
    try {
      const me = await api<Me>('/me/content-prefs', {
        method: 'PATCH',
        body: { hide_nsfw: next.hide_nsfw, hidden_genres: next.hidden_genres },
      });
      setContent(me.content_prefs);
      toast('Настройки контента сохранены', 'ok');
    } catch (e) {
      setContent(prev);
      toast(errMsg(e), 'error');
    } finally {
      setContentBusy(null);
    }
  }

  function toggleNsfw() {
    if (!content) return;
    void saveContent({ ...content, hide_nsfw: !content.hide_nsfw }, 'nsfw');
  }

  function toggleGenre(id: number) {
    if (!content) return;
    const hidden = content.hidden_genres.includes(id)
      ? content.hidden_genres.filter((g) => g !== id)
      : [...content.hidden_genres, id];
    void saveContent({ ...content, hidden_genres: hidden }, id);
  }

  async function deleteAccount() {
    if (deleting) return;
    if (!delPw) {
      toast('Введите пароль, чтобы подтвердить удаление аккаунта', 'error');
      return;
    }
    setDeleting(true);
    try {
      await api('/me', { method: 'DELETE', body: { password: delPw } });
      leavingRef.current = true;
      logout();
      toast('Ваш аккаунт удалён. До встречи.', 'ok');
      router.replace('/');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setDeleting(false);
      setDelPw('');
    }
  }

  const [headPlain, headAccent] = splitHeading('Мои настройки');

  return (
    <div className={styles.page}>
      <Link href={`/user/${encodeURIComponent(user.username)}`} className="back-link">
        <ArrowLeft size={14} />
        {'В профиль'}
      </Link>

      <header className={styles.header}>
        <span className="eyebrow">{'Аккаунт'}</span>
        <h1 className="section-title">
          {headPlain} <span className="accent">{headAccent}</span>
        </h1>
      </header>

      <section className={`glass-panel ${styles.panel}`}>
        <div className={styles.panelHead}>
          <UserIcon size={16} className={styles.panelIcon} />
          <div>
            <h2 className={styles.panelTitle}>{'Профиль'}</h2>
            <p className={styles.panelHint}>
              {'Вы вошли как'}{' '}
              <span className={styles.email}>{user.email ?? user.username}</span>
              {user.email === null ? ' — почта не указана' : null}
            </p>
          </div>
        </div>

        {emailVerificationOn ? (
          <div
            className={
              user.email_verified
                ? `${styles.verifyRow} ${styles.verifyOk}`
                : styles.verifyRow
            }
          >
            {user.email_verified ? (
              <>
                <ShieldCheck size={15} />
                <span>{'Почта подтверждена'}</span>
              </>
            ) : (
              <>
                <MailWarning size={15} />
                <span>{'Почта не подтверждена — проверьте входящие.'}</span>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={resending}
                  onClick={() => void resendVerification()}
                >
                  {resending ? 'Отправляем…' : 'Отправить ещё раз'}
                </button>
              </>
            )}
          </div>
        ) : null}

        <div className={styles.field}>
          <label className={styles.label} htmlFor="settings-display">
            {'Отображаемое имя'}
          </label>
          <input
            id="settings-display"
            className="input"
            value={displayName}
            maxLength={40}
            placeholder={username || 'Как вас показывать'}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <p className={styles.fieldHint}>
            {'Любые символы, до 40 знаков. Пусто — будет показан логин.'}
          </p>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="settings-username">
            {'Логин'}
          </label>
          <input
            id="settings-username"
            className="input"
            value={username}
            maxLength={30}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
          <p className={styles.fieldHint}>
            {'Адрес страницы и упоминания: /user/'}
            {username || '…'}
            {', @'}
            {username || '…'}
            {'. Латиница, цифры и подчёркивание.'}
          </p>
        </div>

        <div className={styles.field}>
          <span className={styles.label}>{'О себе'}</span>
          <MarkdownEditor
            value={bio}
            onChange={setBio}
            maxLength={2000}
            placeholder={'Расскажите, что вы слушаете…'}
          />
        </div>

        <div className={styles.field}>
          <span className={styles.label}>{'Ссылки на соцсети'}</span>
          <SocialsEditor value={socials} onChange={setSocials} />
        </div>

        <div className={styles.panelActions}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={saveProfile}
            disabled={savingProfile}
          >
            {savingProfile ? 'Сохраняем…' : 'Сохранить профиль'}
          </button>
        </div>
      </section>

      <section className={`glass-panel ${styles.panel}`}>
        <div className={styles.panelHead}>
          <ImagePlus size={16} className={styles.panelIcon} />
          <div>
            <h2 className={styles.panelTitle}>{'Аватар и обложка'}</h2>
            <p className={styles.panelHint}>
              {'Аватар — квадратный, обложка — широкий баннер 3:1 в вашем профиле.'}
            </p>
          </div>
        </div>

        <div className={styles.imagesRow}>
          <div className={styles.imageBlock}>
            <div className={styles.imageHead}>
              <span className={styles.label}>{'Аватар'}</span>
              <span className={styles.ratio}>{'1:1'}</span>
            </div>
            <div className={styles.imageStage}>
              <div className={styles.avatarPreview}>
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt={'Текущий аватар'} className={styles.previewImg} />
                ) : (
                  <UserIcon size={26} />
                )}
              </div>
            </div>
            <button
              type="button"
              className={`btn ${styles.imageAction}`}
              onClick={() => setCropTarget('avatar')}
              disabled={uploading !== null}
            >
              <ImagePlus size={15} />
              {uploading === 'avatar' ? 'Загружаем…' : 'Сменить аватар'}
            </button>
          </div>

          <div className={styles.imageBlock}>
            <div className={styles.imageHead}>
              <span className={styles.label}>{'Обложка профиля'}</span>
              <span className={styles.ratio}>{'3:1'}</span>
            </div>
            <div className={styles.imageStage}>
              <div className={styles.coverPreview}>
                {user.cover_url ? (
                  <img src={user.cover_url} alt={'Текущая обложка'} className={styles.previewImg} />
                ) : (
                  <ImagePlus size={26} />
                )}
              </div>
            </div>
            <button
              type="button"
              className={`btn ${styles.imageAction}`}
              onClick={() => setCropTarget('cover')}
              disabled={uploading !== null}
            >
              <ImagePlus size={15} />
              {uploading === 'cover' ? 'Загружаем…' : 'Сменить обложку'}
            </button>
          </div>
        </div>
      </section>

      <section className={`glass-panel ${styles.panel}`}>
        <div className={styles.panelHead}>
          <KeyRound size={16} className={styles.panelIcon} />
          <div>
            <h2 className={styles.panelTitle}>{hasPassword ? 'Пароль' : 'Задать пароль'}</h2>
            <p className={styles.panelHint}>
              {hasPassword
                ? 'Минимум 8 символов. Выберите что-нибудь уникальное.'
                : 'Вы вошли через сторонний сервис, пароля у аккаунта нет. Задайте его, чтобы входить и по логину.'}
            </p>
          </div>
        </div>

        <div className={styles.pwGrid}>
          {hasPassword ? (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="settings-oldpw">
                {'Текущий пароль'}
              </label>
              <input
                id="settings-oldpw"
                className="input"
                type="password"
                value={oldPw}
                onChange={(e) => setOldPw(e.target.value)}
                autoComplete="current-password"
              />
            </div>
          ) : null}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="settings-newpw">
              {'Новый пароль'}
            </label>
            <input
              id="settings-newpw"
              className="input"
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="settings-newpw2">
              {'Повторите новый пароль'}
            </label>
            <input
              id="settings-newpw2"
              className="input"
              type="password"
              value={newPw2}
              onChange={(e) => setNewPw2(e.target.value)}
              autoComplete="new-password"
            />
          </div>
        </div>

        <div className={styles.panelActions}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={changePassword}
            disabled={savingPw}
          >
            {savingPw ? 'Сохраняем…' : hasPassword ? 'Сменить пароль' : 'Задать пароль'}
          </button>
        </div>
      </section>

      <section className={`glass-panel ${styles.panel}`}>
        <div className={styles.panelHead}>
          <Bell size={16} className={styles.panelIcon} />
          <div>
            <h2 className={styles.panelTitle}>{'Уведомления'}</h2>
            <p className={styles.panelHint}>{'Выберите, какие уведомления вы хотите получать.'}</p>
          </div>
        </div>

        <div className={styles.prefList}>
          {PREF_DEFS.map((def) => {
            const on = prefs ? prefs[def.key] : true;
            return (
              <div key={def.key} className={styles.prefRow}>
                <div className={styles.prefText}>
                  <span className={styles.prefLabel}>{def.label}</span>
                  <span className={styles.prefHint}>{def.hint}</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={def.label}
                  className={on ? `${styles.switch} ${styles.switchOn}` : styles.switch}
                  disabled={prefBusy !== null}
                  onClick={() => togglePref(def.key)}
                >
                  <span className={styles.knob} />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className={`glass-panel ${styles.panel}`}>
        <div className={styles.panelHead}>
          <LinkIcon size={16} className={styles.panelIcon} />
          <div>
            <h2 className={styles.panelTitle}>{'Способы входа'}</h2>
            <p className={styles.panelHint}>
              {hasPassword
                ? 'Привяжите сервисы, чтобы входить в один клик.'
                : 'У аккаунта пока нет пароля — вход возможен только через привязанные сервисы. Задайте пароль выше, чтобы отвязать последний из них.'}
            </p>
          </div>
        </div>

        <div className={styles.prefList}>
          <div className={styles.prefRow}>
            <div className={styles.prefText}>
              <span className={styles.prefLabel}>{'Почта'}</span>
              <span className={styles.prefHint}>
                {user.email ?? 'не указана'}
                {user.email && !user.email_verified ? ' — не подтверждена' : ''}
              </span>
            </div>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setNewEmail(user.email ?? '');
                setEmailPw('');
                setEmailOpen(true);
              }}
            >
              {user.email ? 'Изменить' : 'Добавить'}
            </button>
          </div>

          {(identities ?? []).map((idn) => (
            <div key={idn.provider} className={styles.prefRow}>
              <div className={styles.prefText}>
                <span className={styles.prefLabel}>{PROVIDER_LABELS[idn.provider]}</span>
                <span className={styles.prefHint}>
                  {idn.display_name || idn.email || 'привязан'}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={unlinking !== null}
                onClick={() => void unlink(idn.provider)}
              >
                {unlinking === idn.provider ? 'Отвязываем…' : 'Отвязать'}
              </button>
            </div>
          ))}
          {identities !== null && identities.length === 0 ? (
            <p className={styles.panelHint}>{'Пока ничего не привязано.'}</p>
          ) : null}
        </div>

        <ProviderAuth
          mode="link"
          hide={(identities ?? []).map((i) => i.provider)}
          onLinked={(next) => {
            setIdentities(next);
            void refresh();
          }}
        />
      </section>

      <Modal
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        title={user.email ? 'Изменить почту' : 'Добавить почту'}
      >
        <div className={styles.editForm}>
          <label className={styles.label} htmlFor="settings-newemail">
            {'Новый адрес'}
          </label>
          <input
            id="settings-newemail"
            className="input"
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            autoComplete="email"
          />
          {hasPassword ? (
            <>
              <label className={styles.label} htmlFor="settings-emailpw">
                {'Текущий пароль'}
              </label>
              <input
                id="settings-emailpw"
                className="input"
                type="password"
                value={emailPw}
                onChange={(e) => setEmailPw(e.target.value)}
                autoComplete="current-password"
              />
            </>
          ) : null}
          <p className={styles.panelHint}>
            {'Новый адрес нужно будет подтвердить — на него придёт письмо со ссылкой.'}
          </p>
          <div className={styles.panelActions}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void saveEmail()}
              disabled={savingEmail}
            >
              {savingEmail ? 'Сохраняем…' : 'Сохранить'}
            </button>
          </div>
        </div>
      </Modal>

      <section className={`glass-panel ${styles.panel}`}>
        <div className={styles.panelHead}>
          <EyeOff size={16} className={styles.panelIcon} />
          <div>
            <h2 className={styles.panelTitle}>{'Контент'}</h2>
            <p className={styles.panelHint}>
              {'Скрытые тайтлы не появляются в каталоге, поиске, на главной и в рекомендациях. По прямой ссылке они по-прежнему открываются.'}
            </p>
          </div>
        </div>

        <div className={styles.prefList}>
          <div className={styles.prefRow}>
            <div className={styles.prefText}>
              <span className={styles.prefLabel}>{'Скрывать 18+'}</span>
              <span className={styles.prefHint}>
                {'Тайтлы с меткой 18+ не будут показываться в списках'}
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={content ? content.hide_nsfw : true}
              aria-label={'Скрывать 18+'}
              className={
                (content ? content.hide_nsfw : true)
                  ? `${styles.switch} ${styles.switchOn}`
                  : styles.switch
              }
              disabled={!content || contentBusy !== null}
              onClick={toggleNsfw}
            >
              <span className={styles.knob} />
            </button>
          </div>

          {sensitiveGenres.map((g) => {
            const on = content ? content.hidden_genres.includes(g.id) : false;
            return (
              <div key={g.id} className={styles.prefRow}>
                <div className={styles.prefText}>
                  <span className={styles.prefLabel}>{`Скрывать «${g.name}»`}</span>
                  <span className={styles.prefHint}>
                    {'Чувствительный тег — по умолчанию показывается'}
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={`Скрывать ${g.name}`}
                  className={on ? `${styles.switch} ${styles.switchOn}` : styles.switch}
                  disabled={!content || contentBusy !== null}
                  onClick={() => toggleGenre(g.id)}
                >
                  <span className={styles.knob} />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className={`glass-panel ${styles.panel} ${styles.dangerPanel}`}>
        <div className={styles.panelHead}>
          <ShieldAlert size={16} className={`${styles.panelIcon} ${styles.dangerIcon}`} />
          <div>
            <h2 className={styles.panelTitle}>{'Опасная зона'}</h2>
            <p className={styles.panelHint}>
              {'Удаление аккаунта навсегда стирает профиль, библиотеку, избранное, историю и подписки. Комментарии останутся, но будут анонимными.'}
            </p>
          </div>
        </div>

        <div className={styles.panelActions}>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              setDelPw('');
              setDelOpen(true);
            }}
          >
            {'Удалить аккаунт'}
          </button>
        </div>
      </section>

      <ImageCropper
        open={cropTarget === 'avatar'}
        onClose={() => setCropTarget(null)}
        aspect={1}
        title={'Обрезка аватара'}
        onCropped={(blob) => uploadImage('avatar', blob)}
      />
      <ImageCropper
        open={cropTarget === 'cover'}
        onClose={() => setCropTarget(null)}
        aspect={3}
        title={'Обрезка обложки профиля'}
        onCropped={(blob) => uploadImage('cover', blob)}
      />

      <ConfirmDialog
        open={delOpen}
        onClose={() => setDelOpen(false)}
        onConfirm={deleteAccount}
        title={'Удалить аккаунт?'}
        danger
        body={
          <div className={styles.deleteBody}>
            <p>
              {'Это навсегда. Профиль, библиотека, избранное, история прослушивания, коллекции и подписки исчезнут безвозвратно — отменить или восстановить не получится.'}
            </p>
            <label className={styles.label} htmlFor="settings-delpw">
              {'Подтвердите действие паролем'}
            </label>
            <input
              id="settings-delpw"
              className="input"
              type="password"
              value={delPw}
              onChange={(e) => setDelPw(e.target.value)}
              autoComplete="current-password"
              placeholder={'Ваш пароль'}
            />
          </div>
        }
      />
    </div>
  );
}
