'use client';

import Link from 'next/link';
import React from 'react';
import styles from './Footer.module.css';

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.brand}>
          <Link href="/" className={styles.logo}>
            AUDIO<span className={styles.logoAccent}>RANOBE</span>
          </Link>
          <p className={styles.tagline}>
            {'Аудиокниги от сообщества — их озвучивают, отмечают и советуют люди, которые действительно слушают.'}
          </p>
        </div>

        <nav className={styles.links} aria-label={'Подвал сайта'}>
          <Link href="/catalog" className={styles.link}>
            {'Каталог'}
          </Link>
          <Link href="/collections" className={styles.link}>
            {'Коллекции'}
          </Link>
          <Link href="/news" className={styles.link}>
            {'Новости'}
          </Link>
          <Link href="/legal/rules" className={styles.link}>
            {'Правила'}
          </Link>
          <Link href="/legal" className={styles.link}>
            {'Правовая информация'}
          </Link>
        </nav>

        <div className={styles.meta}>
          <span className={styles.copy}>{`© ${year} AudioRanobe`}</span>
          <span className={styles.copy}> · </span>
          <a
            href="https://foxgirls.org"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.copy}
          >
            Проект foxgirls.org
          </a>
          <span className={styles.copy}> · </span>
          <a
            href="mailto:support@audioranobe.com"
            className={styles.copy}
          >
            support@audioranobe.com
          </a>
        </div>

        <nav className={styles.legal} aria-label={'Правовая информация'}>
          <Link href="/legal/terms" className={styles.legalLink}>
            {'Условия'}
          </Link>
          <Link href="/legal/privacy" className={styles.legalLink}>
            {'Конфиденциальность'}
          </Link>
          <Link href="/dmca" className={styles.legalLink}>
            {'DMCA'}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
