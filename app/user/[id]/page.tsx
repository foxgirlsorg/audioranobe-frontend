import { cookies } from 'next/headers';
import { API_URL } from '@/lib/api';
import type { UserProfile } from '@/lib/types';
import UserPageClient from './UserPageClient';

async function fetchProfileForViewer(ref: string): Promise<UserProfile | null> {
  try {
    const res = await fetch(`${API_URL}/users/${encodeURIComponent(ref)}`, {
      headers: { cookie: cookies().toString() },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as UserProfile;
  } catch {
    return null;
  }
}

export default async function UserPage({ params }: { params: { id: string } }) {
  const initialProfile = await fetchProfileForViewer(params.id);
  return <UserPageClient key={params.id} id={params.id} initialProfile={initialProfile} />;
}
