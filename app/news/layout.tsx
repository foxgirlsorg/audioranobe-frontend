import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Новости — AudioRanobe',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
