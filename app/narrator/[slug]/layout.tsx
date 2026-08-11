import type { Metadata } from 'next';
import { API_URL } from '@/lib/api';
import { plainSummary } from '@/lib/format';
import type { NarratorFull } from '@/lib/types';

async function fetchNarrator(slug: string): Promise<NarratorFull | null> {
  try {
    const res = await fetch(`${API_URL}/narrators/${encodeURIComponent(slug)}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return (await res.json()) as NarratorFull;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const narrator = await fetchNarrator(params.slug);
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
