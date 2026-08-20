import type { Metadata } from 'next';
import { plainSummary } from '@/lib/format';
import { fetchMeta } from '@/lib/serverFetch';
import type { NarratorFull } from '@/lib/types';

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const narrator = await fetchMeta<NarratorFull>(`/narrators/${encodeURIComponent(params.slug)}`);
  if (narrator === null) {
    return { title: 'Чтец не найден — AudioRanobe' };
  }

  const pageTitle = `${narrator.name} — AudioRanobe`;
  const description = plainSummary(narrator.bio) || `Профиль чтеца ${narrator.name} на AudioRanobe.`;
  const images = narrator.avatar_url ? [narrator.avatar_url] : undefined;

  return {
    title: pageTitle,
    description,
    alternates: { canonical: `/narrator/${encodeURIComponent(params.slug)}` },
    openGraph: { title: pageTitle, description, images, type: 'profile' },
    twitter: { card: 'summary_large_image', title: pageTitle, description, images },
  };
}

export default function NarratorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
