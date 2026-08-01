'use client';

import React, { useId } from 'react';
import styles from './Toggle.module.css';

export default function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled = false,
  id,
  className = '',
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: React.ReactNode;
  hint?: React.ReactNode;
  disabled?: boolean;
  id?: string;
  className?: string;
}) {
  const auto = useId();
  const inputId = id ?? auto;

  return (
    <label
      className={[styles.wrap, disabled ? styles.disabled : '', className]
        .filter(Boolean)
        .join(' ')}
      htmlFor={inputId}
    >
      <input
        id={inputId}
        type="checkbox"
        className={styles.input}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className={styles.switch} aria-hidden="true" />
      {label != null ? (
        <span className={styles.text}>
          <span className={styles.label}>{label}</span>
          {hint != null ? <span className={styles.hint}>{hint}</span> : null}
        </span>
      ) : null}
    </label>
  );
}
