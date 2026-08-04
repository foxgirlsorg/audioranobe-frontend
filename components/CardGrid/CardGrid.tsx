'use client';

import React from 'react';
import styles from './CardGrid.module.css';

export function CardGrid({
  children,
  fill = false,
}: {
  children: React.ReactNode;
  fill?: boolean;
}) {
  return <div className={fill ? `${styles.grid} ${styles.gridFill}` : styles.grid}>{children}</div>;
}

export default CardGrid;
