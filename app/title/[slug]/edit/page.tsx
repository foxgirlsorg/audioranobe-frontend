'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast, errMsg } from '@/lib/toast';
import {
  NARRATION_STATUS_LABELS,
  RELEASE_STATUS_LABELS,
  STATUS_VALUES,
  type Author,
  type NarrationStatus,
  type ReleaseStatus,
  type TitleFull,
} from '@/lib/types';
import Spinner from '@/components/Spinner/Spinner';
import EmptyState from '@/components/EmptyState/EmptyState';
import GenrePicker from '@/components/GenrePicker/GenrePicker';
import AuthorPicker from '@/components/AuthorPicker/AuthorPicker';
import NarratorPicker, { type NarratorRef } from '@/components/NarratorPicker/NarratorPicker';
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog';
import DangerZone from '@/components/DangerZone/DangerZone';
import Tabs from '@/components/Tabs/Tabs';
import TitleContentManager from '@/components/TitleContentManager/TitleContentManager';
import TitleArtwork from '@/components/TitleArtwork/TitleArtwork';
import MarkdownEditor from '@/components/MarkdownEditor/MarkdownEditor';
import Select from '@/components/Select/Select';
import Toggle from '@/components/Toggle/Toggle';
import styles from './page.module.css';

const CURRENT_YEAR = new Date().getFullYear();

interface Form {
  name: string;
  slug: string;
  alt: string;
  desc: string;
  year: string;
  status: ReleaseStatus;
}

export default function TitleEditPage({ params }: { params: { slug: string } }) {
  const routeSlug = decodeURIComponent(params.slug);
  const { user, loading: authLoading, isMod } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { toast } = useToast();
  const router = useRouter();

  const [title, setTitle] = useState<TitleFull | null>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [canEdit, setCanEdit] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);

  const [tab, setTab] = useState('info');
  const [genreIds, setGenreIds] = useState<number[]>([]);
  const [author, setAuthor] = useState<Author | null>(null);
  const [narrationStatuses, setNarrationStatuses] = useState<Record<number, NarrationStatus>>({});
  const [narrators, setNarrators] = useState<NarratorRef[]>([]);
  const [myNarratorIds, setMyNarratorIds] = useState<number[]>([]);
  const [isAi, setIsAi] = useState(false);
  const [aiLocked, setAiLocked] = useState(false);
  const [isNsfw, setIsNsfw] = useState(false);
  const [nsfwLocked, setNsfwLocked] = useState(false);
  const [confirmNsfw, setConfirmNsfw] = useState(false);
  const [commentSub, setCommentSub] = useState(false);
  const [commentSubBusy, setCommentSubBusy] = useState(false);
  const formInit = useRef(false);

  const [form, setForm] = useState<Form>({
    name: '',
    slug: '',
    alt: '',
    desc: '',
    year: '',
    status: 'ongoing',
  });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/auth/login?next=${encodeURIComponent(`/title/${params.slug}/edit`)}`);
    }
  }, [authLoading, user, router, params.slug]);

  const loadTitle = useCallback(async () => {
    try {
      setLoadError('');
      const data = await api<TitleFull>(`/titles/${encodeURIComponent(routeSlug)}`);
      setTitle(data);
      setCanEdit(data.can_edit);
      setAccessChecked(true);
    } catch (e) {
      setLoadError(errMsg(e));
    } finally {
      setReady(true);
    }
  }, [routeSlug]);

  useEffect(() => {
    if (user) void loadTitle();
  }, [user, loadTitle]);

  const reloadTitle = useCallback(async () => {
    await loadTitle();
  }, [loadTitle]);

  useEffect(() => {
    if (!title || formInit.current) return;
    formInit.current = true;
    setForm({
      name: title.name,
      slug: title.slug,
      alt: (title.alt_names ?? []).join(', '),
      desc: title.description,
      year: title.year != null ? String(title.year) : '',
      status: title.release_status,
    });
    setAuthor(
      title.author ? { ...title.author, titles_count: 0 } : null
    );
    setIsAi(title.is_ai);
    setAiLocked(title.is_ai);
    setIsNsfw(title.is_nsfw);
    setNsfwLocked(title.is_nsfw);
    setCommentSub(title.comment_subscribed);
    setNarrators(
      (title.narrators ?? []).map((n) => ({
        id: n.id,
        slug: n.slug,
        name: n.name,
        avatar_url: n.avatar_url,
      }))
    );
    const statuses: Record<number, NarrationStatus> = {};
    for (const n of title.narrators ?? []) statuses[n.id] = n.narration_status ?? 'ongoing';
    setNarrationStatuses(statuses);
  }, [title]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    api<{ id: number }[]>('/panel/narrators')
      .then((list) => {
        if (alive) setMyNarratorIds((Array.isArray(list) ? list : []).map((n) => n.id));
      })
      .catch(() => {
      });
    return () => {
      alive = false;
    };
  }, [user]);

  const [genresReady, setGenresReady] = useState(false);
  useEffect(() => {
    if (!title || genresReady) return;
    setGenresReady(true);
    api<{ items: { id: number; slug: string }[] }>('/genres', { params: { per_page: 500 } })
      .then((d) => {
        const bySlug = new Map((d.items ?? []).map((g) => [g.slug, g.id]));
        setGenreIds(
          (title.genres ?? [])
            .map((g) => bySlug.get(g.slug))
            .filter((id): id is number => typeof id === 'number')
        );
      })
      .catch(() => {});
  }, [title, genresReady]);

  const losingAccess =
    !isMod &&
    myNarratorIds.length > 0 &&
    !narrators.some((n) => myNarratorIds.includes(n.id));

  const onNsfwToggle = (next: boolean) => {
    if (next) {
      setConfirmNsfw(true);
      return;
    }
    if (nsfwLocked && !isAdmin) {
      toast('Снять отметку 18+ может только администратор', 'error');
      return;
    }
    setIsNsfw(false);
  };

  async function toggleCommentSub(next: boolean) {
    if (!title || commentSubBusy) return;
    setCommentSubBusy(true);
    setCommentSub(next);
    try {
      await api(`/titles/${title.id}/comment-subscription`, {
        method: next ? 'PUT' : 'DELETE',
      });
      toast(next ? 'Уведомления о комментариях включены' : 'Уведомления о комментариях выключены');
    } catch (err) {
      setCommentSub(!next);
      toast(errMsg(err), 'error');
    } finally {
      setCommentSubBusy(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!title) return;
    if (!form.name.trim()) {
      setFormError('Укажите название');
      return;
    }
    if (narrators.length === 0) {
      setFormError('У тайтла должен остаться хотя бы один чтец');
      return;
    }
    let year: number | null = null;
    if (form.year.trim()) {
      const y = Number(form.year.trim());
      if (!Number.isInteger(y) || y < 0 || y > CURRENT_YEAR + 5) {
        setFormError('Похоже, год указан неверно');
        return;
      }
      year = y;
    }
    setFormError('');
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        narrator_ids: narrators.map((n) => n.id),
        name: form.name.trim(),
        slug: form.slug.trim(),
        alt_names: form.alt.split(',').map((s) => s.trim()).filter(Boolean),
        author_id: author?.id ?? null,
        description: form.desc,
        year,
        release_status: form.status,
        genre_ids: genreIds,
        narration_statuses: narrationStatuses,
      };
      if (isNsfw !== title.is_nsfw) body.is_nsfw = isNsfw;
      if (isAi !== title.is_ai) body.is_ai = isAi;

      const res = await api<{ applied: boolean }>(`/panel/titles/${title.id}`, {
        method: 'PATCH',
        body,
      });
      toast(res.applied ? 'Изменения применены' : 'Отправлено на модерацию');
      const fresh = await api<TitleFull>(`/titles/${title.id}`);
      router.push(`/title/${fresh.slug}`);
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || !user || !ready) {
    return (
      <div className={styles.center}>
        <Spinner />
      </div>
    );
  }

  if (loadError || !title) {
    return (
      <div className={styles.center}>
        <EmptyState title="Не удалось загрузить тайтл" body={loadError || 'Что-то пошло не так.'} />
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
        <EmptyState title="Нет доступа" body="У вас нет прав на редактирование этого тайтла." />
        <Link href={`/title/${routeSlug}`} className="btn btn-ghost">
          <ArrowLeft size={15} />
          Вернуться к тайтлу
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Link href={`/title/${routeSlug}`} className="back-link">
        <ArrowLeft size={14} />
        К тайтлу
      </Link>

      <header className={styles.head}>
        <h1 className={styles.heading}>Редактирование тайтла</h1>
        <p className={styles.subtitle}>{title.name}</p>
      </header>

      <div className={styles.tabsRow}>
        <Tabs
          tabs={[
            { key: 'info', label: 'Инфо' },
            { key: 'artwork', label: 'Оформление' },
            { key: 'content', label: 'Тома и главы' },
          ]}
          active={tab}
          onChange={setTab}
          urlParam="tab"
        />
      </div>

      {tab === 'artwork' ? <TitleArtwork title={title} onReload={reloadTitle} /> : null}

      {tab === 'content' ? (
        <TitleContentManager title={title} onReload={reloadTitle} />
      ) : null}

      <form
        className={`glass-panel ${styles.formPanel} ${
          tab === 'info' ? '' : styles.hiddenPanel
        }`}
        onSubmit={handleSubmit}
        noValidate
        hidden={tab !== 'info'}
      >

        {formError ? <div className={styles.formError}>{formError}</div> : null}

        <div className={styles.formRow}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="t-name">
              Название
            </label>
            <input
              id="t-name"
              className="input"
              type="text"
              value={form.name}
              maxLength={300}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="t-slug">
              Slug <span className={styles.optional}>адрес страницы</span>
            </label>
            <input
              id="t-slug"
              className="input"
              type="text"
              value={form.slug}
              maxLength={200}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              placeholder="my-book-slug"
            />
          </div>
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Автор</span>
          <AuthorPicker value={author} onChange={setAuthor} />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="t-alt">
            Альт. названия <span className={styles.optional}>через запятую</span>
          </label>
          <input
            id="t-alt"
            className="input"
            type="text"
            value={form.alt}
            onChange={(e) => setForm((f) => ({ ...f, alt: e.target.value }))}
            placeholder="Оригинальное название, перевод…"
          />
        </div>

        <div className={styles.formRow}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="t-year">
              Год
            </label>
            <input
              id="t-year"
              className="input"
              type="number"
              value={form.year}
              onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
              placeholder="2020"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="t-status">
              Статус тайтла
            </label>
            <Select<ReleaseStatus>
              id="t-status"
              block
              value={form.status}
              options={STATUS_VALUES.map((s) => ({ value: s, label: RELEASE_STATUS_LABELS[s] }))}
              onChange={(status) => setForm((f) => ({ ...f, status }))}
            />
          </div>
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Чтецы</span>
          <NarratorPicker value={narrators} onChange={setNarrators} />
          <p className={styles.formNote}>
            Можно добавить любого существующего чтеца. Отмечать чтецов по главам можно в
            управлении главами.
          </p>
          {losingAccess ? (
            <p className={styles.formWarn}>
              Вы убираете всех своих чтецов из этого тайтла — после сохранения вы потеряете к
              нему доступ.
            </p>
          ) : null}
        </div>

        {narrators.length > 0 ? (
          <div className={styles.field}>
            <span className={styles.label}>Статус озвучки</span>
            <div className={styles.narrationList}>
              {narrators.map((n) => (
                <div key={n.id} className={styles.narrationRow}>
                  <span className={styles.narrationName}>{n.name}</span>
                  <Select<NarrationStatus>
                    size="sm"
                    value={narrationStatuses[n.id] ?? 'ongoing'}
                    options={STATUS_VALUES.map((s) => ({
                      value: s,
                      label: NARRATION_STATUS_LABELS[s],
                    }))}
                    onChange={(v) =>
                      setNarrationStatuses((prev) => ({ ...prev, [n.id]: v }))
                    }
                    ariaLabel={`Статус озвучки: ${n.name}`}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className={styles.field}>
          <span className={styles.label}>Описание</span>
          <MarkdownEditor
            value={form.desc}
            onChange={(desc) => setForm((f) => ({ ...f, desc }))}
            placeholder="О чём эта книга? **Markdown** поддерживается."
          />
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Теги</span>
          <GenrePicker value={genreIds} onChange={setGenreIds} />
        </div>

        <div className={styles.field}>
          <Toggle
            checked={isAi}
            disabled={aiLocked && !isMod}
            onChange={setIsAi}
            label="Озвучено ИИ"
            hint="Отметьте, если главы озвучены синтезированным голосом."
          />
        </div>

        <div className={styles.field}>
          <Toggle
            checked={isNsfw}
            disabled={nsfwLocked && !isAdmin}
            onChange={onNsfwToggle}
            label="Материал 18+"
            hint={
              nsfwLocked && !isAdmin
                ? 'Отметка 18+ уже установлена. Снять её может только администратор.'
                : 'После включения отметку нельзя снять самостоятельно — только через администратора.'
            }
          />
        </div>

        <div className={styles.formFoot}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Сохраняем…' : 'Сохранить изменения'}
          </button>
          {!isMod && title.mod_status === 'approved' ? (
            <span className={styles.formNote}>Правки проходят модерацию</span>
          ) : null}
        </div>
      </form>

      {tab === 'info' ? (
        <section className={`glass-panel ${styles.formPanel}`}>
          <Toggle
            checked={commentSub}
            disabled={commentSubBusy}
            onChange={toggleCommentSub}
            label="Уведомлять о новых комментариях"
            hint="Присылать уведомление о каждом новом комментарии к этому тайтлу. Ответы на ваши собственные комментарии не дублируются."
          />
        </section>
      ) : null}

      {tab === 'info' ? (
        <DangerZone
          kind="title"
          id={title.id}
          name={title.name}
          isDeleted={title.is_deleted}
          redirectTo="/catalog"
          onChanged={reloadTitle}
        />
      ) : null}

      <ConfirmDialog
        open={confirmNsfw}
        onClose={() => setConfirmNsfw(false)}
        onConfirm={() => {
          setIsNsfw(true);
          setConfirmNsfw(false);
        }}
        title="Пометить как 18+"
        body="Это действие необратимо: снять отметку 18+ сможет только администратор."
        danger
      />
    </div>
  );
}
