import type { Metadata } from 'next';
import { API_URL } from '@/lib/api';
import { plainSummary } from '@/lib/format';
import type { TitleFull } from '@/lib/types';

async function fetchTitle(slug: string): Promise<TitleFull | null> {
  try {
    const res = await fetch(`${API_URL}/titles/${encodeURIComponent(slug)}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return (await res.json()) as TitleFull;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const title = await fetchTitle(params.slug);
  if (title === null) {
    return { title: 'Тайтл не найден — AudioRanobe' };
  }

  const pageTitle = `${title.name} — AudioRanobe`;
  const description = plainSummary(title.description) || `Аудиокнига «${title.name}» на AudioRanobe.`;
  const images = title.cover_url ? [title.cover_url] : undefined;

  return {
    title: pageTitle,
    description,
    openGraph: { title: pageTitle, description, images, type: 'book' },
    twitter: { card: 'summary_large_image', title: pageTitle, description, images },
  };
}

export default function TitleLayout({ children }: { children: React.ReactNode }) {
  return children;
}
