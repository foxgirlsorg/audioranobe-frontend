import type { Metadata } from 'next';
import { API_URL } from '@/lib/api';
import { plainSummary } from '@/lib/format';
import type { CollectionFull } from '@/lib/types';

async function fetchCollection(id: string): Promise<CollectionFull | null> {
  try {
    const res = await fetch(`${API_URL}/collections/${encodeURIComponent(id)}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return (await res.json()) as CollectionFull;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const collection = await fetchCollection(params.id);
  if (collection === null) {
    return { title: 'Коллекция не найдена — AudioRanobe' };
  }

  const pageTitle = `${collection.name} — AudioRanobe`;
  const description = plainSummary(collection.description) || `Коллекция «${collection.name}» на AudioRanobe.`;
  const images = collection.cover_urls?.length ? [collection.cover_urls[0]] : undefined;

  return {
    title: pageTitle,
    description,
    alternates: { canonical: `/collections/${params.id}` },
    openGraph: { title: pageTitle, description, images, type: 'website' },
    twitter: { card: images ? 'summary_large_image' : 'summary', title: pageTitle, description, images },
  };
}

export default function CollectionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
