'use client';

import styles from './StatusBadge.module.css';

type Tone = 'amber' | 'green' | 'red' | 'blue' | 'gray';

const TONES: Record<string, Tone> = {
  pending: 'amber',
  approved: 'green',
  rejected: 'red',
  queued: 'blue',
  processing: 'blue',
  ready: 'green',
  error: 'red',
  none: 'gray',
  done: 'green',
  open: 'amber',
  resolved: 'green',
  dismissed: 'gray',
  ongoing: 'blue',
  completed: 'green',
  abandoned: 'red',
  frozen: 'gray',
};

const LABELS: Record<string, string> = {
  pending: 'на проверке',
  approved: 'одобрено',
  rejected: 'отклонено',
  queued: 'в очереди',
  processing: 'обработка',
  ready: 'готово',
  error: 'ошибка',
  none: 'нет',
  done: 'готово',
  open: 'открыто',
  resolved: 'решено',
  dismissed: 'отклонено',
  ongoing: 'продолжается',
  completed: 'завершён',
  abandoned: 'заброшен',
  frozen: 'заморожен',
};

export function StatusBadge({ status }: { status: string }) {
  if (status === 'restricted') {
    return null;
  }

  const tone: Tone = TONES[status] ?? 'gray';
  const label = LABELS[status];

  return (
      <span className={`${styles.badge} ${styles[tone]}`}>
      {label ?? status.replace(/_/g, ' ')}
    </span>
  );
}

export default StatusBadge;
