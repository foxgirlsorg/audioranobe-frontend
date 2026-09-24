import type { Metadata } from 'next';
import { fetchMeta } from '@/lib/serverFetch';
import { plainSummary } from '@/lib/format';
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

  const pageTitle = `${title.name} — аудиокнига | AudioRanobe`;
  const narrators = title.narrators?.length
    ? `, ${title.narrators.length > 1 ? 'читают' : 'читает'} ${title.narrators.map((n) => n.name).join(', ')}`
    : '';
  const summary = plainSummary(title.description);
  const description = `Слушать аудиокнигу «${title.name}» онлайн бесплатно${narrators}.${
    summary ? ` ${summary}` : ''
  }`.slice(0, 300);
  const images = title.cover_url ? [title.cover_url] : undefined;

  return {
    title: pageTitle,
    description,
    alternates: { canonical: `/title/${params.slug}` },
    openGraph: { title: pageTitle, description, images, type: 'book' },
    twitter: { card: images ? 'summary_large_image' : 'summary', title: pageTitle, description, images },
  };
}

export default function TitleLayout({ children }: { children: React.ReactNode }) {
  return children;
}
