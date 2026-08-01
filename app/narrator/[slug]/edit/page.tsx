'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ImagePlus, Mic } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast, errMsg } from '@/lib/toast';
import type { NarratorFull, NarratorStats, UserBrief } from '@/lib/types';
import Spinner from '@/components/Spinner/Spinner';
import EmptyState from '@/components/EmptyState/EmptyState';
import SocialsEditor from '@/components/SocialsEditor/SocialsEditor';
import Tabs from '@/components/Tabs/Tabs';
import ImageCropper from '@/components/ImageCropper/ImageCropper';
import DangerZone from '@/components/DangerZone/DangerZone';
import NarratorPosts from '@/components/NarratorPosts/NarratorPosts';
import MarkdownEditor from '@/components/MarkdownEditor/MarkdownEditor';
import Toggle from '@/components/Toggle/Toggle';
import styles from './page.module.css';

type MemberRow = { user: UserBrief; role: 'owner' | 'editor' };

const ROLE_LABELS: Record<'owner' | 'editor', string> = {
  owner: 'владелец',
  editor: 'редактор',
};

export default function NarratorEditPage({ params }: { params: { slug: string } }) {
  const routeSlug = decodeURIComponent(params.slug);
  const searchParams = useSearchParams();
  const { user, loading: authLoading, isMod } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [narrator, setNarrator] = useState<NarratorFull | null>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [canEdit, setCanEdit] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);

  const [tab, setTab] = useState(() => searchParams.get('tab') || 'info');

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [bio, setBio] = useState('');
  const [socials, setSocials] = useState<string[]>([]);
  const [isSelf, setIsSelf] = useState(false);
  const [isAi, setIsAi] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [aiLocked, setAiLocked] = useState(false);
  const [adminContact, setAdminContact] = useState('');
  const [nameError, setNameError] = useState('');
  const [saving, setSaving] = useState(false);

  const [cropper, setCropper] = useState<'avatar' | 'cover' | null>(null);

  const [members, setMembers] = useState<MemberRow[] | null>(null);
  const [membersError, setMembersError] = useState('');

  const [stats, setStats] = useState<NarratorStats | null>(null);
  const [statsError, setStatsError] = useState('');

  const [transferUsername, setTransferUsername] = useState('');
  const [transferring, setTransferring] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/auth/login?next=${encodeURIComponent(`/narrator/${params.slug}/edit`)}`);
    }
  }, [authLoading, user, router, params.slug]);

  const loadNarrator = useCallback(async () => {
    try {
      setLoadError('');
      const data = await api<NarratorFull>(`/narrators/${encodeURIComponent(routeSlug)}`);
      setNarrator(data);
      setCanEdit(data.can_edit);
      setIsOwner(data.my_role === 'owner' || isMod);
      setAccessChecked(true);
    } catch (e) {
      setLoadError(errMsg(e));
    } finally {
      setReady(true);
    }
  }, [routeSlug, isMod]);

  useEffect(() => {
    if (user) void loadNarrator();
  }, [user, loadNarrator]);

  useEffect(() => {
    if (narrator) {
      setName(narrator.name);
      setSlug(narrator.slug);
      setBio(narrator.bio);
      setSocials(narrator.socials ?? []);
      setIsSelf(narrator.is_self);
      setIsAi(narrator.is_ai);
      setIsVerified(narrator.is_verified);
      setAiLocked(narrator.is_ai);
      setAdminContact(narrator.admin_contact ?? '');
    }
  }, [narrator]);

  const loadMembers = useCallback(async () => {
    if (!narrator) return;
    try {
      setMembersError('');
      const list = await api<MemberRow[]>(`/panel/narrators/${narrator.id}/members`);
      setMembers(list);
    } catch (e) {
      setMembersError(errMsg(e));
    }
  }, [narrator]);

  const loadStats = useCallback(async () => {
    if (!narrator) return;
    try {
      setStatsError('');
      const data = await api<NarratorStats>(`/panel/narrators/${narrator.id}/stats`);
      setStats(data);
    } catch (e) {
      setStatsError(errMsg(e));
    }
  }, [narrator]);

  useEffect(() => {
    if (!canEdit) return;
    if (tab === 'info') void loadMembers();
    if (tab === 'stats') void loadStats();
  }, [tab, canEdit, loadMembers, loadStats]);

  async function handleSaveInfo(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!narrator) return;
    if (!name.trim()) {
      setNameError('Укажите название');
      return;
    }
    setNameError('');
    setSaving(true);
    try {
      const cleaned = socials.map((s) => s.trim()).filter(Boolean);
      const res = await api<{ applied: boolean }>(`/panel/narrators/${narrator.id}`, {
        method: 'PATCH',
        body: {
          name: name.trim(),
          slug: slug.trim(),
          bio,
          socials: cleaned,
          is_self: isSelf,
          ...(isAi !== (narrator.is_ai ?? false) ? { is_ai: isAi } : {}),
          ...(isMod && isVerified !== (narrator.is_verified ?? false)
            ? { is_verified: isVerified }
            : {}),
          admin_contact: isSelf ? adminContact : null,
        },
      });
      if (res.applied) {
        toast('Изменения применены');
      } else {
        toast('Отправлено на модерацию');
      }
      setNarrator((prev) =>
        prev
          ? { ...prev, name: name.trim(), bio, socials: cleaned, is_self: isSelf, admin_contact: isSelf ? adminContact : null }
          : prev
      );
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function onCropped(blob: Blob) {
    if (!narrator || !cropper) return;
    const fd = new FormData();
    fd.append('file', blob, `${cropper}.jpg`);
    try {
      await api(`/panel/narrators/${narrator.id}/${cropper}`, { formData: fd });
      toast(cropper === 'avatar' ? 'Аватар обновлён' : 'Обложка обновлена');
      await loadNarrator();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }

  async function handleTransfer() {
    if (!narrator) return;
    const uname = transferUsername.trim();
    if (!uname) {
      toast('Введите имя пользователя', 'error');
      return;
    }
    setTransferring(true);
    try {
      await api(`/panel/narrators/${narrator.id}/transfer`, {
        method: 'POST',
        body: { username: uname },
      });
      toast('Запрос на передачу отправлен на модерацию');
      setTransferUsername('');
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setTransferring(false);
    }
  }

  const tabs = useMemo(() => {
    const list: { key: string; label: string; count?: number }[] = [
      { key: 'info', label: 'Инфо' },
      { key: 'images', label: 'Изображения' },
    ];
    list.push({ key: 'posts', label: 'Записи' });
    list.push({ key: 'stats', label: 'Статистика' });
    if (isOwner) {
      list.push({ key: 'transfer', label: 'Перенос' });
    }
    return list;
  }, [canEdit, isOwner]);

  if (authLoading || !user || !ready) {
    return (
      <div className={styles.center}>
        <Spinner />
      </div>
    );
  }

  if (loadError || !narrator) {
    return (
      <div className={styles.center}>
        <EmptyState title="Не удалось загрузить чтеца" body={loadError || 'Что-то пошло не так.'} />
      </div>
    );
  }

  if (!accessChecked) {
    return (
      <div className={styles.center}>
        <Spinner />
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className={styles.center}>
        <EmptyState title="Нет доступа" body="У вас нет прав на редактирование этого чтеца." />
        <Link href={`/narrator/${routeSlug}`} className="btn btn-ghost">
          <ArrowLeft size={15} />
          Вернуться к чтецу
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Link href={`/narrator/${routeSlug}`} className="back-link">
        <ArrowLeft size={14} />
        К чтецу
      </Link>

      <header className={styles.head}>
        <span className={styles.headAvatar}>
          {narrator.avatar_url ? (
            <img src={narrator.avatar_url} alt={narrator.name} className={styles.headAvatarImg} />
          ) : (
            <Mic size={26} />
          )}
        </span>
        <div className={styles.headBody}>
          <h1 className={styles.heading}>Редактирование чтеца</h1>
          <p className={styles.subtitle}>{narrator.name}</p>
        </div>
      </header>

      <div className={styles.tabsRow}>
        <Tabs tabs={tabs} active={tab} onChange={setTab} urlParam="tab" />
      </div>

      {tab === 'info' && (
        <form className={`glass-panel ${styles.formPanel}`} onSubmit={handleSaveInfo} noValidate>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="n-name">
              Название
            </label>
            <input
              id="n-name"
              className={nameError ? `input ${styles.inputError}` : 'input'}
              type="text"
              value={name}
              maxLength={120}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError('');
              }}
              aria-invalid={!!nameError}
            />
            {nameError ? <div className={styles.fieldError}>{nameError}</div> : null}
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="n-slug">
              Slug
            </label>
            <input
              id="n-slug"
              className="input"
              type="text"
              value={slug}
              maxLength={200}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="narrator-slug"
            />
          </div>

          <div className={styles.field}>
            <span className={styles.label}>О себе</span>
            <MarkdownEditor
              value={bio}
              onChange={setBio}
              maxLength={5000}
              placeholder="Расскажите слушателям об этом чтеце…"
            />
          </div>

          <div className={styles.field}>
            <span className={styles.label}>Ссылки на соцсети</span>
            <SocialsEditor value={socials} onChange={setSocials} />
          </div>

          <div className={styles.field}>
            <Toggle
              checked={isAi}
              disabled={aiLocked && !isMod}
              onChange={setIsAi}
              label="Синтезированный голос"
              hint="Отметьте, если это ИИ-озвучка. Рядом с именем появится метка."
            />
          </div>

          <div className={styles.field}>
            <Toggle
              checked={isSelf}
              onChange={setIsSelf}
              label="Собственный профиль"
            />
          </div>

          {isMod ? (
            <div className={styles.field}>
              <Toggle
                checked={isVerified}
                onChange={setIsVerified}
                label="Подтверждённый профиль"
                hint="Личность подтверждена: рядом с именем появится галочка."
              />
            </div>
          ) : null}

          {isSelf && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="n-admin-contact">
                Контакт администратора
              </label>
              <textarea
                id="n-admin-contact"
                className="textarea"
                value={adminContact}
                maxLength={2000}
                onChange={(e) => setAdminContact(e.target.value)}
                placeholder="Как связаться с владельцем профиля…"
              />
            </div>
          )}

          <div className={styles.field}>
            <span className={styles.label}>Владелец</span>
            {membersError ? (
              <div className={styles.formError}>{membersError}</div>
            ) : members === null ? (
              <p className={styles.formNote}>Загружаем…</p>
            ) : members.length === 0 ? (
              <p className={styles.formNote}>Владелец не назначен.</p>
            ) : (
              <ul className={styles.membersList}>
                {members.map((m) => (
                  <li key={m.user.id} className={styles.memberRow}>
                    <span className={styles.memberName}>
                      {m.user.avatar_url ? (
                        <img src={m.user.avatar_url} alt="" className={styles.memberAvatar} />
                      ) : null}
                      {m.user.username}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className={styles.formNote}>
              У чтеца всегда ровно один владелец. Чтобы передать права, используйте вкладку
              «Перенос».
            </p>
          </div>

          <div className={styles.formFoot}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Сохраняем…' : 'Сохранить изменения'}
            </button>
            {!isMod && narrator.mod_status === 'approved' ? (
              <span className={styles.formNote}>Правки проходят модерацию</span>
            ) : null}
          </div>
        </form>
      )}

      {tab === 'posts' && (
        <NarratorPosts narratorId={narrator.id} canEdit={canEdit} />
      )}

      {tab === 'images' && (
        <div className={styles.mediaGrid}>
          <div className={`glass-panel ${styles.mediaCard}`}>
            <div className={styles.mediaHead}>
              <span className={styles.label}>Аватар</span>
              <span className={styles.ratio}>1:1</span>
            </div>
            <div className={styles.mediaStage}>
              <div className={styles.avatarPreview}>
                {narrator.avatar_url ? (
                  <img src={narrator.avatar_url} alt="" className={styles.previewImg} />
                ) : (
                  <Mic size={30} />
                )}
              </div>
            </div>
            <button
              type="button"
              className={`btn ${styles.mediaAction}`}
              onClick={() => setCropper('avatar')}
            >
              <ImagePlus size={15} />
              {narrator.avatar_url ? 'Сменить аватар' : 'Загрузить аватар'}
            </button>
          </div>

          <div className={`glass-panel ${styles.mediaCard}`}>
            <div className={styles.mediaHead}>
              <span className={styles.label}>Обложка</span>
              <span className={styles.ratio}>3:1</span>
            </div>
            <div className={styles.mediaStage}>
              <div className={styles.coverPreview}>
                {narrator.cover_url ? (
                  <img src={narrator.cover_url} alt="" className={styles.previewImg} />
                ) : (
                  <Mic size={30} />
                )}
              </div>
            </div>
            <button
              type="button"
              className={`btn ${styles.mediaAction}`}
              onClick={() => setCropper('cover')}
            >
              <ImagePlus size={15} />
              {narrator.cover_url ? 'Сменить обложку' : 'Загрузить обложку'}
            </button>
          </div>
        </div>
      )}

      {tab === 'stats' && (
        <div className={`glass-panel ${styles.formPanel}`}>
          {statsError ? (
            <div className={styles.formError}>{statsError}</div>
          ) : !stats ? (
            <Spinner />
          ) : (
            <>
              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <span className={styles.statValue}>{stats.subscribers_count}</span>
                  <span className={styles.statLabel}>Подписчиков</span>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statValue}>{stats.totals.listens}</span>
                  <span className={styles.statLabel}>Прослушиваний</span>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statValue}>{stats.titles.length}</span>
                  <span className={styles.statLabel}>Тайтлов</span>
                </div>
              </div>

              {stats.titles.length > 0 && (
                <ul className={styles.statsTitles}>
                  {stats.titles.map((t) => (
                    <li key={t.id} className={styles.statsTitleRow}>
                      <Link href={`/title/${t.slug}`} className={styles.statsTitleLink}>
                        {t.name}
                      </Link>
                      <span className={styles.statsTitleMeta}>
                        {t.listens.toLocaleString()} прослушиваний
                        {t.avg_rating != null ? ` · ${t.avg_rating.toFixed(1)}★` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'transfer' && isOwner && (
        <div className={`glass-panel ${styles.formPanel}`}>
          <p className={styles.transferHint}>
            Введите имя пользователя, которому вы хотите передать права владельца. Запрос будет
            отправлен на модерацию.
          </p>
          <div className={styles.transferRow}>
            <input
              className={`input ${styles.transferInput}`}
              type="text"
              placeholder="Имя пользователя"
              value={transferUsername}
              onChange={(e) => setTransferUsername(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-primary"
              disabled={transferring || !transferUsername.trim()}
              onClick={handleTransfer}
            >
              {transferring ? 'Отправляем…' : 'Передать права'}
            </button>
          </div>
        </div>
      )}

      {tab === 'info' ? (
        <DangerZone
          kind="narrator"
          id={narrator.id}
          name={narrator.name}
          isDeleted={narrator.is_deleted}
          redirectTo="/catalog"
          onChanged={loadNarrator}
        />
      ) : null}

      <ImageCropper
        open={cropper === 'avatar'}
        onClose={() => setCropper(null)}
        aspect={1}
        title="Аватар чтеца"
        onCropped={onCropped}
      />
      <ImageCropper
        open={cropper === 'cover'}
        onClose={() => setCropper(null)}
        aspect={3 / 1}
        title="Обложка чтеца"
        onCropped={onCropped}
      />
    </div>
  );
}
