import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Объявления — модерация — AudioRanobe',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
