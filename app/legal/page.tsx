import Link from 'next/link';
import { ChevronRight, Shield, FileText, Copyright, BookText } from 'lucide-react';
import styles from './page.module.css';

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
      <h1 className={styles.title}>
        {'Правовая'} <span className={styles.titleAccent}>{'информация'}</span>
      </h1>
      <p className={styles.subtitle}>
        {'Политики и условия, регулирующие использование сервиса AudioRanobe.'}
      </p>

      <div className={styles.links}>
        {items.map((item) => (
          <Link key={item.href} href={item.href} className={styles.linkCard}>
            <div>
              <div className={styles.linkTitle}>
                <item.icon size={14} style={{ marginRight: 8, verticalAlign: -2 }} />
                {item.title}
              </div>
              <div className={styles.linkDesc}>{item.desc}</div>
            </div>
            <ChevronRight size={16} className={styles.linkArrow} />
          </Link>
        ))}
      </div>
    </div>
  );
}
