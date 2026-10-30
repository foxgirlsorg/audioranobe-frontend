'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Mic } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { LIMITS } from '@/lib/limits';
import { useToast, errMsg } from '@/lib/toast';
import { useMyNarrators } from '@/lib/narrators';
import type { NarratorFull, UserBrief, UserSearchHit } from '@/lib/types';
import Spinner from '@/components/Spinner/Spinner';
import EmptyState from '@/components/EmptyState/EmptyState';
import SocialsEditor from '@/components/SocialsEditor/SocialsEditor';
import Tabs from '@/components/Tabs/Tabs';
import DangerZone from '@/components/DangerZone/DangerZone';
import NarratorPosts from '@/components/NarratorPosts/NarratorPosts';
import MarkdownEditor from '@/components/MarkdownEditor/MarkdownEditor';
import Toggle from '@/components/Toggle/Toggle';
import UserPicker from '@/components/UserPicker/UserPicker';
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog';
import StatusBadge from '@/components/StatusBadge/StatusBadge';
import NarratorStatsView from '@/components/NarratorStatsView/NarratorStatsView';
import styles from './page.module.css';

const ImageCropper = dynamic(() => import('@/components/ImageCropper/ImageCropper'), { ssr: false });

type MemberRow = { user: UserBrief; role: 'owner' | 'editor' };

function Section({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionSide}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        {desc ? <p className={styles.sectionDesc}>{desc}</p> : null}
      </div>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

function snap(v: {
  name: string;
  slug: string;
  bio: string;
  socials: string[];
  isSelf: boolean;
  isAi: boolean;
  isVerified: boolean;
  adminContact: string;
}) {
  return JSON.stringify([
    v.name,
    v.slug,
    v.bio,
    v.socials.map((s) => s.trim()).filter(Boolean),
    v.isSelf,
    v.isAi,
    v.isVerified,
    v.adminContact,
  ]);
}

export default function NarratorEditPage({ params }: { params: { slug: string } }) {
  const routeSlug = decodeURIComponent(params.slug);
  const searchParams = useSearchParams();
  const { user, loading: authLoading, isMod, can } = useAuth();
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

  const [transferTo, setTransferTo] = useState<UserSearchHit | null>(null);
  const [confirmTransfer, setConfirmTransfer] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const transferIsInstant =
    isMod ||
    can('bypass.moderation') ||
    can('bypass.moderation.narrator');

  useEffect(() => {
    document.body.classList.add('edit-ui');
    return () => document.body.classList.remove('edit-ui');
  }, []);

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

  const applyNarrator = useCallback((n: NarratorFull) => {
    setName(n.name);
    setSlug(n.slug);
    setBio(n.bio);
    setSocials(n.socials ?? []);
    setIsSelf(n.is_self);
    setIsAi(n.is_ai);
    setIsVerified(n.is_verified);
    setAiLocked(n.is_ai);
    setAdminContact(n.admin_contact ?? '');
    setNameError('');
  }, []);

  useEffect(() => {
    if (narrator) applyNarrator(narrator);
  }, [narrator, applyNarrator]);

  useEffect(() => {
    if (narrator && !narrator.is_verified && !isMod && tab === 'posts') {
      setTab('info');
    }
  }, [narrator, tab, isMod]);

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

  useEffect(() => {
    if (!canEdit) return;
    if (tab === 'info' || tab === 'transfer') void loadMembers();
  }, [tab, canEdit, loadMembers]);

  const baseline = useMemo(
    () =>
      narrator
        ? snap({
            name: narrator.name,
            slug: narrator.slug,
            bio: narrator.bio,
            socials: narrator.socials ?? [],
            isSelf: narrator.is_self,
            isAi: narrator.is_ai,
            isVerified: narrator.is_verified,
            adminContact: narrator.admin_contact ?? '',
          })
        : null,
    [narrator]
  );
  const current = snap({ name, slug, bio, socials, isSelf, isAi, isVerified, adminContact });
  const dirty = baseline !== null && current !== baseline;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

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
        await loadNarrator();
      } else {
        toast('Отправлено на модерацию');
        applyNarrator(narrator);
      }
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function onCropped(blob: Blob) {
    if (!narrator || !cropper) return;
    const fd = new FormData();
    fd.append('file', blob, `${cropper}.webp`);
    try {
      await api(`/panel/narrators/${narrator.id}/${cropper}`, { formData: fd });
      toast(cropper === 'avatar' ? 'Аватар обновлён' : 'Обложка обновлена');
      await loadNarrator();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }

  const { refresh: refreshMyNarrators } = useMyNarrators();

  async function handleTransfer() {
    if (!narrator || !transferTo) return;
    setTransferring(true);
    try {
      const res = await api<{ applied: boolean }>(`/panel/narrators/${narrator.id}/transfer`, {
        method: 'POST',
        body: { user_id: transferTo.id },
      });
      if (res.applied) {
        refreshMyNarrators();
        toast(`Права на чтеца переданы @${transferTo.username}`);
        router.push(`/narrator/${narrator.slug}`);
        return;
      }
      toast('Запрос на передачу отправлен на модерацию');
      setTransferTo(null);
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
    if (isMod || narrator?.is_verified) {
      list.push({ key: 'posts', label: 'Записи' });
    }
    list.push({ key: 'stats', label: 'Статистика' });
    if (isOwner) {
      list.push({ key: 'transfer', label: 'Перенос' });
    }
    return list;
  }, [isMod, narrator?.is_verified, isOwner]);

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

  const showSaveBar = tab === 'info' && (dirty || saving);

  return (
    <div className={tab === 'stats' ? `${styles.page} ${styles.pageWide}` : styles.page}>
      <header className={styles.head}>
        <span className={styles.headAvatar}>
          {narrator.avatar_url ? (
            <img src={narrator.avatar_url} alt="" className={styles.headAvatarImg} />
          ) : (
            <Mic size={22} aria-hidden="true" />
          )}
        </span>
        <div className={styles.headBody}>
          <Link href={`/narrator/${routeSlug}`} className={styles.backLink}>
            <ArrowLeft size={14} />
            К чтецу
          </Link>
          <h1 className={styles.heading}>{narrator.name}</h1>
        </div>
        <div className={styles.headTags}>
          {narrator.is_verified ? <span className={styles.tag}>Подтверждён</span> : null}
          {narrator.is_ai ? <span className={styles.tag}>ИИ-голос</span> : null}
          <StatusBadge status={narrator.mod_status} />
        </div>
      </header>

      <div className={styles.tabsRow}>
        <Tabs tabs={tabs} active={tab} onChange={setTab} urlParam="tab" variant="underline" />
      </div>

      {tab === 'info' && (
        <form className={styles.form} onSubmit={handleSaveInfo} noValidate>
          <Section title="Основное" desc="Название, адрес страницы и пометки">
            <div className={styles.field}>
              <label className={styles.label} htmlFor="n-name">
                Название
              </label>
              <input
                id="n-name"
                className={nameError ? `input ${styles.inputError}` : 'input'}
                type="text"
                value={name}
                maxLength={LIMITS.narratorName}
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
                Адрес страницы
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
            <div className={styles.toggleList}>
              <Toggle
                checked={isAi}
                disabled={aiLocked && !isMod}
                onChange={setIsAi}
                label="Синтезированный голос"
                hint="Рядом с именем появится метка."
              />
              <Toggle checked={isSelf} onChange={setIsSelf} label="Собственный профиль" />
              {isMod ? (
                <Toggle
                  checked={isVerified}
                  onChange={setIsVerified}
                  label="Подтверждённый профиль"
                  hint="Рядом с именем появится галочка."
                />
              ) : null}
            </div>
          </Section>

          <Section title="О чтеце" desc="Показывается на странице чтеца">
            <MarkdownEditor
              value={bio}
              onChange={setBio}
              maxLength={LIMITS.narratorBio}
              placeholder="Расскажите слушателям об этом чтеце…"
              media="image"
            />
          </Section>

          <Section title="Ссылки" desc="Соцсети и сайты">
            <SocialsEditor value={socials} onChange={setSocials} />
          </Section>

          {isSelf ? (
            <Section title="Контакт для связи" desc="Виден только администрации">
              <textarea
                id="n-admin-contact"
                className="textarea"
                aria-label="Контакт администратора"
                value={adminContact}
                maxLength={2000}
                onChange={(e) => setAdminContact(e.target.value)}
                placeholder="Как связаться с владельцем профиля…"
              />
            </Section>
          ) : null}

          <Section title="Владелец" desc="У чтеца всегда ровно один владелец">
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
                      ) : (
                        <span className={styles.memberAvatar} aria-hidden="true" />
                      )}
                      {m.user.username}
                    </span>
                    {isOwner ? (
                      <button
                        type="button"
                        className={styles.linkBtn}
                        onClick={() => setTab('transfer')}
                      >
                        Передать права →
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Опасная зона" desc="Удалить чтеца">
            <DangerZone
              bare
              kind="narrator"
              id={narrator.id}
              name={narrator.name}
              isDeleted={narrator.is_deleted}
              redirectTo="/catalog"
              onChanged={() => {
                refreshMyNarrators();
                void loadNarrator();
              }}
            />
          </Section>

          {showSaveBar ? (
            <div className={styles.saveBar} role="region" aria-label="Сохранение">
              <span className={styles.saveDot} aria-hidden="true" />
              <span className={styles.saveText}>
                Есть несохранённые изменения
                {!isMod && narrator.mod_status === 'approved' ? (
                  <span className={styles.saveNote}> · Правки проходят модерацию</span>
                ) : null}
              </span>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => applyNarrator(narrator)}
                disabled={saving}
              >
                Сбросить
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Сохраняем…' : 'Сохранить изменения'}
              </button>
            </div>
          ) : null}
        </form>
      )}

      {tab === 'posts' && (isMod || narrator.is_verified) && (
        <NarratorPosts narratorId={narrator.id} canEdit={canEdit} />
      )}

      {tab === 'images' && (
        <div className={`glass-panel ${styles.mediaCard}`}>
          <div className={styles.mediaItem}>
            <span className={styles.label}>Аватар</span>
            <div className={styles.avatarPreview}>
              {narrator.avatar_url ? (
                <img src={narrator.avatar_url} alt="" className={styles.previewImg} />
              ) : (
                <Mic size={32} aria-hidden="true" />
              )}
            </div>
            <div className={styles.mediaActions}>
              <button type="button" className="btn btn-sm" onClick={() => setCropper('avatar')}>
                {narrator.avatar_url ? 'Заменить' : 'Загрузить аватар'}
              </button>
            </div>
          </div>
          <div className={styles.mediaItem}>
            <span className={styles.label}>Обложка</span>
            <div className={styles.coverPreview}>
              {narrator.cover_url ? (
                <img src={narrator.cover_url} alt="" className={styles.previewImg} />
              ) : (
                <Mic size={32} aria-hidden="true" />
              )}
            </div>
            <div className={styles.mediaActions}>
              <button type="button" className="btn btn-sm" onClick={() => setCropper('cover')}>
                {narrator.cover_url ? 'Заменить' : 'Загрузить обложку'}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'stats' && <NarratorStatsView narratorId={narrator.id} />}

      {tab === 'transfer' && isOwner && (
        <div className={styles.form}>
          <Section title="Передать права" desc="Новый владелец получит полный доступ к чтецу">
            <div className={styles.field} id="transfer-label">
              <span className={styles.label}>Пользователь</span>
              <UserPicker
                value={transferTo}
                onChange={setTransferTo}
                excludeIds={[
                  ...(user ? [user.id] : []),
                  ...(members ?? []).map((m) => m.user.id),
                ]}
                disabled={transferring}
                ariaLabelledBy="transfer-label"
              />
              <p className={styles.formNote}>
                {transferIsInstant
                  ? 'Передача произойдёт сразу, без модерации.'
                  : 'Запрос уйдёт на модерацию; до одобрения чтец остаётся за вами.'}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={transferring || !transferTo}
              onClick={() => setConfirmTransfer(true)}
            >
              {transferring ? 'Передаём…' : 'Передать права'}
            </button>
          </Section>
          <ConfirmDialog
            open={confirmTransfer}
            onClose={() => setConfirmTransfer(false)}
            onConfirm={() => void handleTransfer()}
            title="Передать права на чтеца?"
            body={
              transferTo ? (
                <>
                  {`«${narrator.name}» перейдёт к @${transferTo.username}. `}
                  {isMod
                    ? 'Передача произойдёт сразу; нынешние участники чтеца потеряют к нему доступ.'
                    : transferIsInstant
                      ? 'Это произойдёт сразу, и вы потеряете доступ к редактированию чтеца.'
                      : 'Заявка уйдёт на модерацию; после одобрения вы потеряете доступ к редактированию чтеца.'}
                </>
              ) : null
            }
            danger
          />
        </div>
      )}

      <ImageCropper
        open={cropper === 'avatar'}
        onClose={() => setCropper(null)}
        aspect={1}
        overlay="circle"
        title="Аватар чтеца"
        maxWidth={1024}
        maxHeight={1024}
        onCropped={onCropped}
      />
      <ImageCropper
        open={cropper === 'cover'}
        onClose={() => setCropper(null)}
        aspect={3 / 1}
        overlay="cover"
        title="Обложка чтеца"
        maxWidth={2048}
        maxHeight={2048}
        onCropped={onCropped}
      />
    </div>
  );
}
