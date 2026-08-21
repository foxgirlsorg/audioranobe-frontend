import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Каталог — AudioRanobe',
  description: 'Каталог озвученных ранобэ и аудиокниг на AudioRanobe — ищите по автору, чтецу, жанру и статусу.',
  alternates: { canonical: '/catalog' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
