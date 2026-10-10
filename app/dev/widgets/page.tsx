import type { Metadata } from 'next';
import EmbedBuilder from './EmbedBuilder';
import styles from '../page.module.css';

export const metadata: Metadata = {
  title: 'Виджеты — AudioRanobe',
};

export default function WidgetsPage() {
  return (
    <>
      <header className={styles.hero}>
        <h1 className={styles.title}>
          {'Виджеты'} <span className={styles.titleAccent}>{'AudioRanobe'}</span>
        </h1>
        <p className={styles.subtitle}>
          {'Встройте плеер тома, карточку чтеца или подборку на свой сайт: выберите тип, настройте и скопируйте код.'}
        </p>
      </header>
      <EmbedBuilder />
    </>
  );
}
