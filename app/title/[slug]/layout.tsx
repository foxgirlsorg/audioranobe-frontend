import type { Metadata } from 'next';
import { plainSummary } from '@/lib/format';
import { fetchMeta } from '@/lib/serverFetch';
import { API_URL } from '@/lib/api';
import type { TitleFull } from '@/lib/types';

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const title = await fetchMeta<TitleFull>(`/titles/${encodeURIComponent(params.slug)}`);
  if (title === null) {
    return { title: 'Тайтл не найден — AudioRanobe' };
  }

  const pageTitle = `${title.name} — AudioRanobe`;
  const description = plainSummary(title.description) || `Аудиокнига «${title.name}» на AudioRanobe.`;
  const images = title.cover_url ? [title.cover_url] : undefined;

  return {
    title: pageTitle,
    description,
    alternates: {
      canonical: `/title/${encodeURIComponent(params.slug)}`,
      types: { 'application/rss+xml': `${API_URL}/titles/${encodeURIComponent(params.slug)}/feed` },
    },
    openGraph: { title: pageTitle, description, images, type: 'book' },
    twitter: { card: 'summary_large_image', title: pageTitle, description, images },
  };
}

export default function TitleLayout({ children }: { children: React.ReactNode }) {
  return children;
}
