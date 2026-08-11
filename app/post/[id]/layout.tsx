import type { Metadata } from 'next';
import { API_URL } from '@/lib/api';
import { plainSummary } from '@/lib/format';
import type { NarratorPost } from '@/lib/types';

async function fetchPost(id: string): Promise<NarratorPost | null> {
  try {
    const res = await fetch(`${API_URL}/posts/${encodeURIComponent(id)}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return (await res.json()) as NarratorPost;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const post = await fetchPost(params.id);
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
