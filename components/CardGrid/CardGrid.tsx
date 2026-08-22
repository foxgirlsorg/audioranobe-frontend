'use client';

import React from 'react';
import styles from './CardGrid.module.css';

export function CardGrid({
  children,
  fill = false,
  edgeToEdge = false,
}: {
  children: React.ReactNode;
  fill?: boolean;
  // Fixed-size cards, dynamic gaps: the grid always spans edge-to-edge (first
  // card flush left, last flush right) instead of leaving slack when the
  // row doesn't divide evenly, and never exceeds 6 columns regardless of
  // viewport. See CardGrid.module.css .gridEdge for how.
  edgeToEdge?: boolean;
}) {
  const few = edgeToEdge && React.Children.count(children) < 6;
  const cls = [
    styles.grid,
    fill ? styles.gridFill : '',
    edgeToEdge ? styles.gridEdge : '',
    few ? styles.gridFew : '',
  ]
    .filter(Boolean)
    .join(' ');
  return <div className={cls}>{children}</div>;
}

export default CardGrid;
