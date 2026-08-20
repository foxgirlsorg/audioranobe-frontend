import type { Metadata } from 'next';
import { plainSummary } from '@/lib/format';
import { fetchMeta } from '@/lib/serverFetch';
import type { UserProfile } from '@/lib/types';

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const profile = await fetchMeta<UserProfile>(`/users/${encodeURIComponent(params.id)}`);
  if (profile === null) {
    return { title: 'Пользователь не найден — AudioRanobe' };
  }

  const { user } = profile;
  const name = user.display_name || user.username;
  const pageTitle = `${name} — AudioRanobe`;
  const description = plainSummary(user.bio) || `Профиль пользователя ${user.username} на AudioRanobe.`;
  const images = user.avatar_url ? [user.avatar_url] : undefined;

  return {
    title: pageTitle,
    description,
    alternates: { canonical: `/user/${encodeURIComponent(params.id)}` },
    openGraph: { title: pageTitle, description, images, type: 'profile' },
    twitter: { card: 'summary_large_image', title: pageTitle, description, images },
  };
}

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return children;
}
