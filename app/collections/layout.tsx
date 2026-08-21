import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Коллекции — AudioRanobe',
  description: 'Тематические подборки озвученных ранобэ и аудиокниг на AudioRanobe.',
  alternates: { canonical: '/collections' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
