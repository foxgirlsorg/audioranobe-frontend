'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Mic2, MicOff, Pencil } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type { NarratorFull } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { formatCount, formatDate } from '@/lib/format';
import { usePageTitle } from '@/lib/usePageTitle';
import Spinner from '@/components/Spinner/Spinner';
import EmptyState from '@/components/EmptyState/EmptyState';
import StatusBadge from '@/components/StatusBadge/StatusBadge';
import SocialLinks from '@/components/SocialLinks/SocialLinks';
import SubscribeButton from '@/components/SubscribeButton/SubscribeButton';
import ReportButton from '@/components/ReportButton/ReportButton';
import Section from '@/components/Section/Section';
import CardGrid from '@/components/CardGrid/CardGrid';
import TitleCardC from '@/components/TitleCardC/TitleCardC';
import CommentSection from '@/components/CommentSection/CommentSection';
import NarratorPosts from '@/components/NarratorPosts/NarratorPosts';
import { PhotoView } from 'react-photo-view';
import Markdown from '@/components/Markdown/Markdown';
import Collapsible from '@/components/Collapsible/Collapsible';
import AiBadge from '@/components/AiBadge/AiBadge';
import VerifiedBadge from '@/components/VerifiedBadge/VerifiedBadge';
import styles from './page.module.css';

export default function NarratorPage({ params }: { params: { slug: string } }) {
  const slug = decodeURIComponent(params.slug);
  const { user, isMod } = useAuth();
  const [narrator, setNarrator] = useState<NarratorFull | null>(null);
  usePageTitle(narrator?.name);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setNarrator(null);
    (async () => {
      try {
        const n = await api<NarratorFull>(`/narrators/${encodeURIComponent(slug)}`);
        if (alive) {
          setNarrator(n);
          setCanEdit(n.can_edit);
        }
      } catch (e) {
        if (!alive) return;
        if (e instanceof ApiError && e.status === 404) {
          setError('Такого чтеца не существует, или его страница ещё не опубликована.');
        } else {
          setError(e instanceof Error ? e.message : 'Не удалось загрузить страницу чтеца.');
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className={styles.center}>
        <Spinner size={34} />
      </div>
    );
  }

  if (error || !narrator) {
    return (
      <div className={styles.center}>
        <EmptyState
          icon={MicOff}
          title="Чтец не найден"
          body={error ?? 'Не удалось загрузить страницу чтеца.'}
        />
      </div>
    );
  }

  const n = narrator;

  return (
    <div className={styles.page}>
      <div className={styles.banner} aria-hidden="true">
        {n.cover_url ? (
          <PhotoView src={n.cover_url}>
            <button type="button" className={styles.bannerBtn} aria-label="Увеличить баннер">
              <img src={n.cover_url} alt="" className={styles.bannerImg} />
            </button>
          </PhotoView>
        ) : (
          <div className={styles.bannerEmpty}>
            <span className={styles.bannerGlow} />
            <img src="/foxgirl_narrator.svg" className={styles.bannerFoxgirl} alt=""/>
          </div>
        )}
        <div className={styles.bannerShade} />
      </div>

      <header className={styles.head}>
        <div className={styles.avatar}>
          {n.avatar_url ? (
            <PhotoView src={n.avatar_url}>
              <button type="button" className={styles.avatarBtn} aria-label="Увеличить аватар">
                <img src={n.avatar_url} alt={n.name} className={styles.avatarImg} />
              </button>
            </PhotoView>
          ) : (
            <Mic2 size={40} className={styles.avatarIcon} />
          )}
        </div>

        <div className={styles.headMain}>
          <span className="eyebrow">Чтец</span>
          <h1 className={styles.name}>
            {n.name}
            {n.is_verified ? <VerifiedBadge /> : null}
            {n.is_ai ? <AiBadge title="Синтезированный голос" /> : null}
            {n.mod_status !== 'approved' ? <StatusBadge status={n.mod_status} /> : null}
            {canEdit ? (
              <Link href={`/narrator/${n.slug}/edit`} className={styles.editBtn} title="Редактировать">
                <Pencil size={16} />
              </Link>
            ) : null}
          </h1>
          <div className={styles.metaRow}>
            <span className={styles.metaItem}>{`Тайтлов: ${n.titles_count}`}</span>
            <span className={styles.metaDot} aria-hidden="true" />
            <span className={styles.metaItem}>{`Подписчиков: ${formatCount(n.subscribers_count)}`}</span>
            <span className={styles.metaDot} aria-hidden="true" />
            <span className={styles.metaItem}>{`на сайте с ${formatDate(n.created_at)}`}</span>
          </div>
          <SocialLinks urls={n.socials} />
        </div>

        <div className={styles.headActions}>
          <SubscribeButton
            narratorId={n.id}
            subscribed={n.my_subscription}
            count={n.subscribers_count}
          />
          <ReportButton targetType="narrator" targetId={n.id} />
        </div>
      </header>

      {n.bio ? (
        <div className={`glass-panel ${styles.bioPanel}`}>
          <span className="eyebrow">О себе</span>
          <div className={styles.bio}>
            <Collapsible maxHeight={300}>
              <Markdown source={n.bio} media="image" />
            </Collapsible>
          </div>
        </div>
      ) : null}

      <Section eyebrow="Каталог" title="Озвученные" accent="тайтлы">
        {n.titles.length > 0 ? (
          <CardGrid>
            {n.titles.map((tc) => (
              <TitleCardC key={tc.id} title={tc} />
            ))}
          </CardGrid>
        ) : (
          <EmptyState
            icon={BookOpen}
            title="Пока нет тайтлов"
            body="Этот чтец пока не опубликовал ни одной аудиокниги."
          />
        )}
      </Section>

      {isMod && n.admin_contact ? (
        <div className={`glass-panel ${styles.contactPanel}`}>
          <span className="eyebrow">Контакт для администрации</span>
          <p className={styles.contactText}>{n.admin_contact}</p>
          <p className={styles.contactNote}>
            Виден только модераторам и администраторам.
          </p>
        </div>
      ) : null}

      {isMod || n.is_verified ? (
        <Section eyebrow="Блог" title="Публичные" accent="записи">
          <NarratorPosts narratorId={n.id} canEdit={n.can_edit} />
        </Section>
      ) : null}

      <div className={styles.comments}>
        <CommentSection targetType="narrator" targetId={n.id} initialComments={n.comments} />
      </div>
    </div>
  );
}
