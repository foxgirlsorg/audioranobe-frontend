import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Мои заявки — AudioRanobe',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
