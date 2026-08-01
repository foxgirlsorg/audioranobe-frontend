'use client';

import React from 'react';
import styles from './CardGrid.module.css';

export function CardGrid({ children }: { children: React.ReactNode }) {
  return <div className={styles.grid}>{children}</div>;
}

export default CardGrid;
