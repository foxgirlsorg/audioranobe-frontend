import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Новости — AudioRanobe',
  description: 'Новости и объявления проекта AudioRanobe: релизы озвучек, обновления сайта и анонсы.',
  alternates: { canonical: '/news' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
