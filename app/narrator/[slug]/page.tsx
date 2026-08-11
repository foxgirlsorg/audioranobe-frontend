import { cookies } from 'next/headers';
import { API_URL } from '@/lib/api';
import type { NarratorFull } from '@/lib/types';
import NarratorPageClient from './NarratorPageClient';

async function fetchNarratorForViewer(slug: string): Promise<NarratorFull | null> {
  try {
    const res = await fetch(`${API_URL}/narrators/${encodeURIComponent(slug)}`, {
      headers: { cookie: cookies().toString() },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as NarratorFull;
  } catch {
    return null;
  }
}

export default async function NarratorPage({ params }: { params: { slug: string } }) {
  const initialNarrator = await fetchNarratorForViewer(params.slug);
  return <NarratorPageClient key={params.slug} slug={params.slug} initialNarrator={initialNarrator} />;
}
