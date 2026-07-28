'use client';

import React from 'react';
import Modal from '@/components/Modal';
import styles from './ConfirmDialog.module.css';

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  danger = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className={styles.body}>{body}</div>
      <div className={styles.actions}>
        <button type="button" className={styles.cancel} onClick={onClose}>
          Отмена
        </button>
        <button
          type="button"
          className={danger ? `${styles.confirm} ${styles.danger}` : styles.confirm}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          Подтвердить
        </button>
      </div>
    </Modal>
  );
}

export default ConfirmDialog;
