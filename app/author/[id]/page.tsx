'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Pencil } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type { AuthorFull } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { usePageTitle } from '@/lib/usePageTitle';
import Spinner from '@/components/Spinner/Spinner';
import EmptyState from '@/components/EmptyState/EmptyState';
import SocialLinks from '@/components/SocialLinks/SocialLinks';
import Section from '@/components/Section/Section';
import CardGrid from '@/components/CardGrid/CardGrid';
import TitleCardC from '@/components/TitleCardC/TitleCardC';
import Markdown from '@/components/Markdown/Markdown';
import styles from './page.module.css';

export default function AuthorPage({ params }: { params: { id: string } }) {
  const authorRef = decodeURIComponent(params.id);
  const { user, isMod } = useAuth();
  const [author, setAuthor] = useState<AuthorFull | null>(null);
  usePageTitle(author?.name);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setAuthor(null);
    (async () => {
      try {
        const a = await api<AuthorFull>(`/authors/${encodeURIComponent(authorRef)}`);
        if (alive) setAuthor(a);
      } catch (e) {
        if (!alive) return;
        if (e instanceof ApiError && e.status === 404) {
          setError('Такого автора не существует, или его страница ещё не опубликована.');
        } else {
          setError(e instanceof Error ? e.message : 'Не удалось загрузить страницу автора.');
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [authorRef]);

  useEffect(() => {
    if (author) setCanEdit(author.can_edit);
  }, [author]);

  if (loading) {
    return (
      <div className={styles.center}>
        <Spinner size={34} />
      </div>
    );
  }

  if (error || !author) {
    return (
      <div className={styles.center}>
        <EmptyState
          icon={BookOpen}
          title="Автор не найден"
          body={error ?? 'Не удалось загрузить страницу автора.'}
        />
      </div>
    );
  }

  const a = author;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <span className="eyebrow">Автор</span>
        <h1 className={styles.name}>
          {a.name}
          {canEdit ? (
            <Link href={`/author/${a.id}/edit`} className={styles.editBtn} title="Редактировать">
              <Pencil size={16} />
            </Link>
          ) : null}
        </h1>
        <span className={styles.meta}>{`Тайтлов: ${a.titles_count}`}</span>
        <SocialLinks urls={a.links} />
      </header>

      {a.bio ? (
        <div className={`glass-panel ${styles.bioPanel}`}>
          <span className="eyebrow">О себе</span>
          <div className={styles.bio}>
            <Markdown source={a.bio} />
          </div>
        </div>
      ) : null}

      <Section eyebrow="Каталог" title="Произведения" accent="тайтлы">
        {a.titles.length > 0 ? (
          <CardGrid>
            {a.titles.map((tc) => (
              <TitleCardC key={tc.id} title={tc} />
            ))}
          </CardGrid>
        ) : (
          <EmptyState
            icon={BookOpen}
            title="Пока нет тайтлов"
            body="К этому автору пока не привязано ни одной аудиокниги."
          />
        )}
      </Section>
    </div>
  );
}
