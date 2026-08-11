import { cookies } from 'next/headers';
import { API_URL } from '@/lib/api';
import { plainSummary } from '@/lib/format';
import type { TitleFull } from '@/lib/types';
import TitlePageClient from './TitlePageClient';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://audioranobe.com').replace(/\/$/, '');

async function fetchTitleForViewer(slug: string): Promise<TitleFull | null> {
  try {
    const res = await fetch(`${API_URL}/titles/${encodeURIComponent(slug)}`, {
      headers: { cookie: cookies().toString() },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as TitleFull;
  } catch {
    return null;
  }
}

function titleJsonLd(title: TitleFull) {
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Audiobook',
    name: title.name,
    url: `${SITE_URL}/title/${encodeURIComponent(title.slug)}`,
    inLanguage: 'ru',
  };
  const description = plainSummary(title.description);
  if (description) ld.description = description;
  if (title.cover_url) ld.image = title.cover_url;
  if (title.author) ld.author = { '@type': 'Person', name: title.author.name };
  if (title.narrators?.length) {
    ld.readBy = title.narrators.map((n) => ({ '@type': 'Person', name: n.name }));
  }
  if (title.avg_rating != null && title.rating_count > 0) {
    ld.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: title.avg_rating,
      ratingCount: title.rating_count,
      bestRating: 10,
      worstRating: 1,
    };
  }
  return ld;
}

export default async function TitlePage({ params }: { params: { slug: string } }) {
  const initialTitle = await fetchTitleForViewer(params.slug);
  return (
    <>
      {initialTitle ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(titleJsonLd(initialTitle)) }}
        />
      ) : null}
      <TitlePageClient key={params.slug} slug={params.slug} initialTitle={initialTitle} />
    </>
  );
}
