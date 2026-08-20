import type { Metadata } from 'next';
import { fetchMeta } from '@/lib/serverFetch';
import type { ChapterPlay } from '@/lib/types';

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const chapter = await fetchMeta<ChapterPlay>(`/chapters/${encodeURIComponent(params.id)}`);
  if (chapter === null) {
    return { title: 'Глава не найдена — AudioRanobe' };
  }

  const chapterLabel = chapter.name || `Глава ${chapter.number}`;
  const pageTitle = `${chapterLabel} — ${chapter.title.name} — AudioRanobe`;
  const narrator = chapter.narrator?.name;
  const description = `Слушать «${chapterLabel}» из аудиокниги «${chapter.title.name}»${
    narrator ? `, читает ${narrator}` : ''
  } на AudioRanobe.`;
  const images = chapter.title.cover_url ? [chapter.title.cover_url] : undefined;

  return {
    title: pageTitle,
    description,
    alternates: { canonical: `/chapter/${params.id}` },
    openGraph: { title: pageTitle, description, images, type: 'music.song' },
    twitter: { card: images ? 'summary_large_image' : 'summary', title: pageTitle, description, images },
  };
}

export default function ChapterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
