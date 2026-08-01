import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Журнал действий — модерация — AudioRanobe',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
