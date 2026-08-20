import type { Metadata } from 'next';
import { plainSummary } from '@/lib/format';
import { fetchMeta } from '@/lib/serverFetch';
import type { NarratorPost } from '@/lib/types';

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const post = await fetchMeta<NarratorPost>(`/posts/${encodeURIComponent(params.id)}`);
  if (post === null) {
    return { title: 'Запись не найдена — AudioRanobe' };
  }

  const author = post.narrator?.name;
  const pageTitle = `${post.title}${author ? ` — ${author}` : ''} — AudioRanobe`;
  const description = plainSummary(post.body) || `Запись чтеца на AudioRanobe.`;
  const images = post.narrator?.avatar_url ? [post.narrator.avatar_url] : undefined;

  return {
    title: pageTitle,
    description,
    alternates: { canonical: `/post/${params.id}` },
    openGraph: { title: pageTitle, description, images, type: 'article', publishedTime: post.created_at },
    twitter: { card: 'summary', title: pageTitle, description, images },
  };
}

export default function PostLayout({ children }: { children: React.ReactNode }) {
  return children;
}
