import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, Shield, FileText, Copyright, BookText } from 'lucide-react';
import styles from './legal.module.css';

export const metadata: Metadata = {
  title: 'Правовая информация — AudioRanobe',
};

const items = [
  {
    href: '/legal/privacy',
    icon: Shield,
    title: 'Политика конфиденциальности',
    desc: 'Как мы собираем и используем ваши данные',
  },
  {
    href: '/legal/terms',
    icon: FileText,
    title: 'Условия использования',
    desc: 'Правила и ответственность при использовании сервиса',
  },
  {
    href: '/dmca',
    icon: Copyright,
    title: 'Политика DMCA',
    desc: 'Процедура подачи жалоб на авторские права',
  },
  {
    href: '/legal/rules',
    icon: BookText,
    title: 'Правила',
    desc: 'Правила загрузки, правила чтецов и общие правила',
  },
];

export default function LegalPage() {
  return (
    <div className={styles.wrap}>
      <span className="eyebrow">{'Документы'}</span>
      <h1 className={styles.title}>
        {'Правовая'} <span className={styles.titleAccent}>{'информация'}</span>
      </h1>
      <p className={styles.subtitle}>
        {'Политики и условия, регулирующие использование сервиса AudioRanobe.'}
      </p>

      <div className={styles.links}>
        {items.map((item) => (
          <Link key={item.href} href={item.href} className={styles.linkCard}>
            <span className={styles.linkIcon}>
              <item.icon size={17} />
            </span>
            <span className={styles.linkText}>
              <span className={styles.linkTitle}>{item.title}</span>
              <span className={styles.linkDesc}>{item.desc}</span>
            </span>
            <ChevronRight size={16} className={styles.linkArrow} />
          </Link>
        ))}
      </div>
    </div>
  );
}
