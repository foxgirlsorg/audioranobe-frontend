'use client';

import styles from './Spinner.module.css';

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
