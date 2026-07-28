'use client';

import Link from 'next/link';
import { Home } from 'lucide-react';
import styles from './not-found.module.css';

export default function NotFound() {
  return (
    <div className={styles.wrap}>
      <div className={styles.glow} aria-hidden="true" />
      <span className="eyebrow">{'потерялись в помехах'}</span>
      <h1 className={styles.code}>
        4<span className={styles.accent}>0</span>4
      </h1>
      <p className={styles.text}>
        {'Такой страницы нет — или модераторы её так и не одобрили.'}
      </p>
      <Link href="/" className="btn btn-primary">
        <Home />
        {'На главную'}
      </Link>
    </div>
  );
}
