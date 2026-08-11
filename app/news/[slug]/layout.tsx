import type { Metadata } from 'next';
import { API_URL } from '@/lib/api';
import { plainSummary } from '@/lib/format';
import type { Announcement } from '@/lib/types';

async function fetchAnnouncement(slug: string): Promise<Announcement | null> {
  try {
    const res = await fetch(`${API_URL}/announcements/${encodeURIComponent(slug)}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return (await res.json()) as Announcement;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const item = await fetchAnnouncement(params.slug);
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
