'use client';

import styles from './Spinner.module.css';

/**
 * `inline` for a spinner sitting inside a button or a row. Without it the
 * wrapper is a full-width block with 2.5rem of vertical padding, which is right
 * for "this whole panel is loading" and stretches anything smaller.
 */
export function Spinner({ size = 28, inline = false }: { size?: number; inline?: boolean }) {
  return (
    <span
      className={inline ? styles.inline : styles.block}
      role="status"
      aria-label="Загрузка"
    >
      <span className={styles.ring} style={{ width: size, height: size }} />
    </span>
  );
}

export default Spinner;
