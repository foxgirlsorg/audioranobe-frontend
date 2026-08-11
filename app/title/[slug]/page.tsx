import { cookies } from 'next/headers';
import { API_URL } from '@/lib/api';
import type { TitleFull } from '@/lib/types';
import TitlePageClient from './TitlePageClient';

async function fetchTitleForViewer(slug: string): Promise<TitleFull | null> {
  try {
    const res = await fetch(`${API_URL}/titles/${encodeURIComponent(slug)}`, {
      headers: { cookie: cookies().toString() },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as TitleFull;
  } catch {
    return null;
  }
}

export default async function TitlePage({ params }: { params: { slug: string } }) {
  const initialTitle = await fetchTitleForViewer(params.slug);
  return <TitlePageClient key={params.slug} slug={params.slug} initialTitle={initialTitle} />;
}
