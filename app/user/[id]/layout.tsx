import type { Metadata } from 'next';
import { API_URL } from '@/lib/api';
import { plainSummary } from '@/lib/format';
import type { UserProfile } from '@/lib/types';

async function fetchProfile(ref: string): Promise<UserProfile | null> {
  try {
    const res = await fetch(`${API_URL}/users/${encodeURIComponent(ref)}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return (await res.json()) as UserProfile;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const profile = await fetchProfile(params.id);
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
    openGraph: { title: pageTitle, description, images, type: 'profile' },
    twitter: { card: 'summary_large_image', title: pageTitle, description, images },
  };
}

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return children;
}
