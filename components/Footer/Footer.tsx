'use client';

import Link from 'next/link';
import React from 'react';
import { Mail } from 'lucide-react';
import { TelegramIcon } from '@/components/SocialLinks/brands';
import { SUPPORT_EMAIL, SUPPORT_BOT, SUPPORT_CHANNEL } from '@/lib/support';
import styles from './Footer.module.css';

const NAV = [
  { href: '/catalog', label: 'Каталог' },
  { href: '/collections', label: 'Коллекции' },
  { href: '/news', label: 'Новости' },
  { href: '/api-docs', label: 'API' },
];

const LEGAL = [
  { href: '/legal/rules', label: 'Правила' },
  { href: '/legal/terms', label: 'Условия' },
  { href: '/legal/privacy', label: 'Конфиденциальность' },
  { href: '/dmca', label: 'DMCA' },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.brand}>
          <Link href="/" className={styles.logo}>
            AUDIO<span className={styles.logoAccent}>RANOBE</span>
          </Link>
          <p className={styles.disclaimer}>
            {
              'Все материалы размещены пользователями предоставлены, исключительно для бесплатного ознакомления. Мы не владеем размещённым контентом и не несём за него ответственности.'
            }
          </p>
        </div>

        <div className={styles.cols}>
          <nav className={styles.col} aria-label={'Разделы сайта'}>
            <span className={styles.colTitle}>{'Сайт'}</span>
            {NAV.map((l) => (
              <Link key={l.href} href={l.href} className={styles.link}>
                {l.label}
              </Link>
            ))}
          </nav>

          <nav className={styles.col} aria-label={'Документы'}>
            <span className={styles.colTitle}>{'Документы'}</span>
            {LEGAL.map((l) => (
              <Link key={l.href} href={l.href} className={styles.link}>
                {l.label}
              </Link>
            ))}
          </nav>

          <div className={styles.col}>
            <span className={styles.colTitle}>{'Связь'}</span>
            <a href={`mailto:${SUPPORT_EMAIL}`} className={styles.contact}>
              <Mail size={14} />
              {SUPPORT_EMAIL}
            </a>
            <a
              href={SUPPORT_BOT}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.contact}
            >
              <TelegramIcon size={14} />
              {'Поддержка'}
            </a>
            <a
              href={SUPPORT_CHANNEL}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.contact}
            >
              <TelegramIcon size={14} />
              {'Канал'}
            </a>
          </div>
        </div>
      </div>

      <div className={`container ${styles.bottom}`}>
        <span className={styles.copy}>{`© ${year} AudioRanobe`}</span>
        <a
          href="https://foxgirls.org"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.copyLink}
        >
          foxgirls.org
        </a>
      </div>
    </footer>
  );
}
