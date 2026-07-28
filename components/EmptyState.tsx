'use client';

import React from 'react';
import styles from './EmptyState.module.css';

type IconInput =
  | React.ReactNode
  | React.ComponentType<{ size?: number | string; className?: string }>;

function renderIcon(icon: IconInput): React.ReactNode {
  if (icon == null) return null;
  if (React.isValidElement(icon)) return icon;
  if (
    typeof icon === 'function' ||
    (typeof icon === 'object' && icon !== null && '$$typeof' in (icon as object))
  ) {
    const Cmp = icon as React.ComponentType<{ size?: number | string }>;
    return <Cmp size={28} />;
  }
  return icon as React.ReactNode;
}

export function EmptyState({
  icon,
  title,
  body,
}: {
  icon?: IconInput;
  title: string;
  body?: string;
}) {
  const iconNode = renderIcon(icon);
  return (
    <div className={styles.wrap}>
      {iconNode ? <div className={styles.icon}>{iconNode}</div> : null}
      <div className={styles.title}>{title}</div>
      {body ? <div className={styles.body}>{body}</div> : null}
    </div>
  );
}

export default EmptyState;
