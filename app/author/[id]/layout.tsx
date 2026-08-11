import type { Metadata } from 'next';
import { API_URL } from '@/lib/api';
import { plainSummary } from '@/lib/format';
import type { AuthorFull } from '@/lib/types';

async function fetchAuthor(ref: string): Promise<AuthorFull | null> {
  try {
    const res = await fetch(`${API_URL}/authors/${encodeURIComponent(ref)}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return (await res.json()) as AuthorFull;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const author = await fetchAuthor(params.id);
  if (author === null) {
    return { title: 'Автор не найден — AudioRanobe' };
  }

  const pageTitle = `${author.name} — AudioRanobe`;
  const description = plainSummary(author.bio) || `Аудиокниги автора ${author.name} на AudioRanobe.`;

  return {
    title: pageTitle,
    description,
    alternates: { canonical: `/author/${params.id}` },
    openGraph: { title: pageTitle, description, type: 'profile' },
    twitter: { card: 'summary', title: pageTitle, description },
  };
}

export default function AuthorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
