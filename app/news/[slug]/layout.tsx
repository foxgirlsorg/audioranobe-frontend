import type { Metadata } from 'next';
import { plainSummary } from '@/lib/format';
import { fetchMeta } from '@/lib/serverFetch';
import type { Announcement } from '@/lib/types';

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const item = await fetchMeta<Announcement>(`/announcements/${encodeURIComponent(params.slug)}`);
  if (item === null) {
    return { title: 'Новость не найдена — AudioRanobe' };
  }

  const pageTitle = `${item.title} — AudioRanobe`;
  const description = plainSummary(item.body) || `Новость на AudioRanobe.`;

  return {
    title: pageTitle,
    description,
    alternates: { canonical: `/news/${params.slug}` },
    openGraph: { title: pageTitle, description, type: 'article', publishedTime: item.created_at },
    twitter: { card: 'summary', title: pageTitle, description },
  };
}

export default function NewsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
