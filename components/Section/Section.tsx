'use client';

import React from 'react';
import styles from './Section.module.css';

export function Section({
  eyebrow,
  title,
  accent,
  children,
}: {
  eyebrow?: string;
  title: string;
  accent?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className={styles.section}>
      <header className={styles.header}>
        {eyebrow ? (
          <div className={styles.eyebrow}>
            <span className={styles.eyebrowBar} aria-hidden="true" />
            {eyebrow}
          </div>
        ) : null}
        <h2 className={styles.title}>
          {title}
          {accent ? <span className={styles.accent}> {accent}</span> : null}
        </h2>
      </header>
      {children}
    </section>
  );
}

export default Section;
