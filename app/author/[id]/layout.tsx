import type { Metadata } from 'next';
import { plainSummary } from '@/lib/format';
import { fetchMeta } from '@/lib/serverFetch';
import type { AuthorFull } from '@/lib/types';

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const author = await fetchMeta<AuthorFull>(`/authors/${encodeURIComponent(params.id)}`);
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
