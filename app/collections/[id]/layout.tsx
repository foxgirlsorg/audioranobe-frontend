import type { Metadata } from 'next';
import { plainSummary } from '@/lib/format';
import { fetchMeta } from '@/lib/serverFetch';
import type { CollectionFull } from '@/lib/types';

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const collection = await fetchMeta<CollectionFull>(`/collections/${encodeURIComponent(params.id)}`);
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
