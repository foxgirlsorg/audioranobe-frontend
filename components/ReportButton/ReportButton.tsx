'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { Flag } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast, errMsg } from '@/lib/toast';
import Modal from '@/components/Modal/Modal';
import styles from './ReportButton.module.css';

const MAX_REASON = 1000;

export function ReportButton({
  targetType,
  targetId,
  compact = false,
}: {
  targetType: string;
  targetId: number;
  compact?: boolean;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  function openModal() {
    if (!user) {
      toast('Войдите, чтобы пожаловаться на контент', 'error');
      return;
    }
    setReason('');
    setOpen(true);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const r = reason.trim();
    if (!r) {
      toast('Опишите проблему', 'error');
      return;
    }
    if (r.length > MAX_REASON) {
      toast(`Причина слишком длинная (максимум ${MAX_REASON} символов)`, 'error');
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      await api('/reports', {
        method: 'POST',
        body: { target_type: targetType, target_id: targetId, reason: r },
      });
      setOpen(false);
      toast('Жалоба отправлена. Спасибо, что помогаете поддерживать чистоту AudioRanobe.', 'ok');
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={compact ? `${styles.btn} ${styles.btnCompact}` : styles.btn}
        onClick={openModal}
        title={'Пожаловаться модераторам'}
      >
        <Flag size={13} />
        <span>{'Жалоба'}</span>
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={'Жалоба на контент'}>
        <form onSubmit={submit} className={styles.form}>
          <p className={styles.hint}>
            {'Расскажите модераторам, что не так. Жалобы анонимны для других пользователей.'}
          </p>
          <textarea
            className={styles.textarea}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={MAX_REASON}
            rows={4}
            placeholder={'В чём проблема?'}
            autoFocus
          />
          <div className={styles.row}>
            <span className={styles.counter}>
              {reason.length}/{MAX_REASON}
            </span>
            <button type="submit" className={styles.submit} disabled={busy}>
              {busy ? 'Отправка…' : 'Отправить жалобу'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export default ReportButton;
