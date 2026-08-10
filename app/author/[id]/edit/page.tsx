'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { LIMITS } from '@/lib/limits';
import { useToast, errMsg } from '@/lib/toast';
import type { AuthorFull } from '@/lib/types';
import Spinner from '@/components/Spinner/Spinner';
import EmptyState from '@/components/EmptyState/EmptyState';
import DangerZone from '@/components/DangerZone/DangerZone';
import SocialsEditor from '@/components/SocialsEditor/SocialsEditor';
import MarkdownEditor from '@/components/MarkdownEditor/MarkdownEditor';
import styles from './page.module.css';

export default function AuthorEditPage({ params }: { params: { id: string } }) {
  const authorRef = decodeURIComponent(params.id);
  const { user, loading: authLoading, isMod } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [author, setAuthor] = useState<AuthorFull | null>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [canEdit, setCanEdit] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);

  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [links, setLinks] = useState<string[]>([]);
  const [nameError, setNameError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/auth/login?next=${encodeURIComponent(`/author/${params.id}/edit`)}`);
    }
  }, [authLoading, user, router, params.id]);

  const loadAuthor = useCallback(async () => {
    try {
      setLoadError('');
      const data = await api<AuthorFull>(`/authors/${encodeURIComponent(authorRef)}`);
      setAuthor(data);
      setCanEdit(data.can_edit);
      setAccessChecked(true);
    } catch (e) {
      setLoadError(errMsg(e));
    } finally {
      setReady(true);
    }
  }, [authorRef]);

  useEffect(() => {
    if (user) void loadAuthor();
  }, [user, loadAuthor]);

  useEffect(() => {
    if (author) {
      setName(author.name);
      setBio(author.bio);
      setLinks(author.links ?? []);
    }
  }, [author]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!author) return;
    if (!name.trim()) {
      setNameError('Укажите название');
      return;
    }
    setNameError('');
    setSaving(true);
    try {
      const cleaned = links.map((s) => s.trim()).filter(Boolean);
      const res = await api<{ applied: boolean }>(`/authors/${author.id}`, {
        method: 'PATCH',
        body: { name: name.trim(), bio, links: cleaned },
      });
      if (res.applied) {
        toast('Изменения применены');
      } else {
        toast('Отправлено на модерацию');
      }
      router.push(`/author/${author.id}`);
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

  if (loadError || !author) {
    return (
      <div className={styles.center}>
        <EmptyState title="Не удалось загрузить автора" body={loadError || 'Что-то пошло не так.'} />
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
        <EmptyState title="Нет доступа" body="У вас нет прав на редактирование этого автора." />
        <Link href={`/author/${authorRef}`} className="btn btn-ghost">
          <ArrowLeft size={15} />
          Вернуться к автору
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Link href={`/author/${authorRef}`} className="back-link">
        <ArrowLeft size={14} />
        К автору
      </Link>

      <form className={`glass-panel ${styles.formPanel}`} onSubmit={handleSubmit} noValidate>
        <h1 className={styles.heading}>Редактирование автора</h1>
        <p className={styles.subtitle}>{author.name}</p>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="a-name">
            Название
          </label>
          <input
            id="a-name"
            className={nameError ? `input ${styles.inputError}` : 'input'}
            type="text"
            value={name}
            maxLength={LIMITS.authorName}
            onChange={(e) => {
              setName(e.target.value);
              if (nameError) setNameError('');
            }}
            aria-invalid={!!nameError}
          />
          {nameError ? <div className={styles.fieldError}>{nameError}</div> : null}
        </div>

        <div className={styles.field}>
          <span className={styles.label}>О себе</span>
          <MarkdownEditor
            value={bio}
            onChange={setBio}
            maxLength={LIMITS.authorBio}
            placeholder="Расскажите об этом авторе…"
          />
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Ссылки</span>
          <SocialsEditor value={links} onChange={setLinks} />
        </div>

        <div className={styles.formFoot}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Сохраняем…' : 'Сохранить изменения'}
          </button>
          {!isMod ? (
            <span className={styles.formNote}>Правки проходят модерацию</span>
          ) : null}
        </div>
      </form>

      <DangerZone
        kind="author"
        id={author.id}
        name={author.name}
        redirectTo="/catalog"
        onChanged={loadAuthor}
      />
    </div>
  );
}
