'use client';

import { useState } from 'react';
import { Loader2, type LucideIcon } from 'lucide-react';
import styles from './AddCard.module.css';

/**
 * A dashed "add" button styled like the row/card it adds to.
 * `variant="row"` (default) is a wide horizontal bar; `variant="tile"` is a
 * vertical tile for a grid of cards (icon above label).
 */
export default function AddCard({
  icon: Icon,
  label,
  onClick,
  disabled,
  loading,
  onDropFile,
  variant = 'row',
  className,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Enables drag&drop of a single file onto the card. Omit to disable it. */
  onDropFile?: (file: File) => void;
  variant?: 'row' | 'tile';
  className?: string;
}) {
  const [hover, setHover] = useState(false);

  return (
    <button
      type="button"
      className={[
        styles.addCard,
        variant === 'tile' ? styles.tile : styles.row,
        hover ? styles.hover : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      disabled={disabled}
      onClick={onClick}
      onDragOver={
        onDropFile
          ? (e) => {
              e.preventDefault();
              setHover(true);
            }
          : undefined
      }
      onDragLeave={onDropFile ? () => setHover(false) : undefined}
      onDrop={
        onDropFile
          ? (e) => {
              e.preventDefault();
              setHover(false);
              const f = e.dataTransfer.files?.[0] ?? null;
              if (f) onDropFile(f);
            }
          : undefined
      }
    >
      {loading ? <Loader2 size={20} className={styles.spin} /> : <Icon size={20} />}
      {label}
    </button>
  );
}
