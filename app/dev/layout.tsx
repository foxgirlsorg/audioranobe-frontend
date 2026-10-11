import type { Metadata } from 'next';
import DevTabs from './DevTabs';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Для разработчиков — AudioRanobe',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.wrap}>
      <span className="eyebrow">{'Для разработчиков'}</span>
      <DevTabs />
      {children}
    </div>
  );
}
