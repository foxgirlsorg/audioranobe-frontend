import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Коллекции — AudioRanobe',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
