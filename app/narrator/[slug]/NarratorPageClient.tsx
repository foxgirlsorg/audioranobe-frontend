'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Mic2, MicOff, Pencil } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type { NarratorFull } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { formatCount, formatDate } from '@/lib/format';
import { usePageTitle } from '@/lib/usePageTitle';
import { SUPPORT_URL } from '@/lib/support';
import Skeleton from 'react-loading-skeleton';
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
import sectionStyles from "@/components/Section/Section.module.css";
import CatalogGridSkeleton from "@/components/CatalogGrid/CatalogGridSkeleton";

function SectionHeaderSkeleton({ eyebrowWidth = 140, titleWidth = 220 }) {
  return (
      <header className={sectionStyles.header}>
        <div className={sectionStyles.eyebrow}>
          <Skeleton width={eyebrowWidth} />
        </div>
        <h2 className={sectionStyles.title}>
          <Skeleton width={titleWidth} />
        </h2>
      </header>
  );
}

function NarratorPageSkeleton() {
  return (
    <div className={styles.page}>
      <div className={styles.profileHead}>
        <div className={styles.banner} aria-hidden="true">
          <Skeleton height="100%" style={{ display: 'block' }} />
        </div>
        <div className={styles.dock}>
          <div className={styles.dockAvatar}>
            <Skeleton circle width="100%" height="100%" />
          </div>
          <div className={styles.dockId}>
            <div className={styles.dockName}>
              <Skeleton width={220} height={28} />
            </div>
            <div className={styles.meta}>
              <Skeleton width={220} height={13} />
            </div>
          </div>
        </div>
      </div>
      <section className={sectionStyles.section}>
      <Skeleton width="100%" height={200} />
      </section>
      <section className={sectionStyles.section}>
        <SectionHeaderSkeleton eyebrowWidth={100} titleWidth={180} />
        <CatalogGridSkeleton count={12} />
      </section>
    </div>
  );
}

export default function NarratorPageClient({
  slug: rawSlug,
  initialNarrator,
}: {
  slug: string;
  initialNarrator: NarratorFull | null;
}) {
  const slug = decodeURIComponent(rawSlug);
  const { user, isMod } = useAuth();
  const [narrator, setNarrator] = useState<NarratorFull | null>(initialNarrator);
  usePageTitle(narrator?.name);
  const [loading, setLoading] = useState(initialNarrator === null);
  const [error, setError] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(initialNarrator?.can_edit ?? false);
  const skipInitialFetch = useRef(initialNarrator !== null);

  useEffect(() => {
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false;
      return;
    }
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

  const didUserRefetch = useRef(false);
  useEffect(() => {
    if (!user || didUserRefetch.current) return;
    didUserRefetch.current = true;
    api<NarratorFull>(`/narrators/${encodeURIComponent(slug)}`)
      .then((n) => {
        setNarrator(n);
        setCanEdit(n.can_edit);
      })
      .catch(() => {});
  }, [user, slug]);

  if (loading) {
    return <NarratorPageSkeleton />;
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
      <div className={styles.profileHead}>
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

        <div className={styles.dock}>
          <div className={styles.dockAvatar}>
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

          <div className={styles.dockId}>
            <div className={styles.dockName}>

              <h1 className={styles.dockNameH1}>{n.name}</h1>
              {n.is_verified ? <VerifiedBadge /> : null}
              {n.is_ai ? <AiBadge title="Синтезированный голос" /> : null}
              {n.mod_status !== 'approved' ? <StatusBadge status={n.mod_status} /> : null}
              {canEdit ? (
                <Link href={`/narrator/${n.slug}/edit`} className={styles.editBtn} title="Редактировать">
                  <Pencil size={16} />
                </Link>
              ) : null}
            </div>

            <div className={styles.meta}>
              <span className={styles.metaSub}>
                <span className={styles.metaNarrator}>Чтец</span>
                <span className={styles.metaItem}>{`Тайтлов: ${n.titles_count}`}</span>
                <span className={styles.metaItem}>{`Подписчиков: ${formatCount(n.subscribers_count)}`}</span>
                <span className={styles.metaJoined}>{`на сайте с ${formatDate(n.created_at)}`}</span>
              </span>
            </div>
          </div>

          <div className={styles.dockActions}>
            <SubscribeButton
              narratorId={n.id}
              subscribed={n.my_subscription}
              count={n.subscribers_count}
            />
            <ReportButton targetType="narrator" targetId={n.id} className={styles.reportBtn} compact={true} />
          </div>
        </div>
      </div>

      {!n.is_self && !n.is_ai && !canEdit ? (
        <div className={styles.claimBanner}>
          <Mic2 size={17} aria-hidden="true" className={styles.claimBannerIcon} />
          <div className={styles.claimBannerBody}>
            <strong>Это ваша страница чтеца?</strong>
            <span>
              Эта страница создана без участия чтеца. Если вы озвучиваете под этим
              именем — напишите в поддержку, и мы передадим страницу вам.
            </span>
          </div>
          <a
            href={SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.claimBannerBtn}
          >
            Связаться с поддержкой
          </a>
        </div>
      ) : null}

      {n.bio || (n.socials && n.socials.length > 0) ? (
        <div className={`glass-panel ${styles.aboutCard}`}>
          <div className={styles.aboutTop}>
            <span className="eyebrow">{n.bio ? 'О себе' : 'Ссылки'}</span>
            <div className={n.bio ? styles.linksHideMobile : undefined}>
              <SocialLinks urls={n.socials} />
            </div>
          </div>
          {n.bio ? (
            <div className={styles.bio}>
              <Collapsible maxHeight={300}>
                <Markdown source={n.bio} media="image" />
              </Collapsible>
              <div className={styles.linksShowMobile}>
                <SocialLinks urls={n.socials} />
              </div>
            </div>
          ) : null}
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
