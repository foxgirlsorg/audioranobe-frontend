'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, RotateCcw, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errMsg, useToast } from '@/lib/toast';
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog';
import type { TrashKind } from '@/lib/types';
import styles from './DangerZone.module.css';

const LABELS: Record<TrashKind, string> = {
  title: 'тайтл',
  narrator: 'чтеца',
  author: 'автора',
  chapter: 'главу',
  comment: 'комментарий',
};

export default function DangerZone({
  kind,
  id,
  name,
  isDeleted = false,
  redirectTo,
  onChanged,
}: {
  kind: TrashKind;
  id: number;
  name: string;
  isDeleted?: boolean;
  redirectTo: string;
  onChanged?: () => void | Promise<void>;
}) {
  const { user, isMod } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { toast } = useToast();
  const router = useRouter();

  const [confirm, setConfirm] = useState<'delete' | 'purge' | null>(null);
  const [busy, setBusy] = useState(false);

  const label = LABELS[kind];
  const canDelete = kind === 'title' || kind === 'narrator' ? true : isMod;
  if (!canDelete && !isAdmin) return null;

  async function doDelete() {
    setBusy(true);
    try {
      const path =
        kind === 'title' || kind === 'narrator'
          ? `/panel/${kind}s/${id}`
          : `/mod/${kind}s/${id}`;
      const res = await api<{ applied?: boolean }>(path, { method: 'DELETE' });
      toast(
        res && res.applied === false
          ? 'Удаление отправлено на модерацию'
          : 'Удалено — восстановить можно через модерацию'
      );
      setConfirm(null);
      router.push(redirectTo);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function doRestore() {
    setBusy(true);
    try {
      await api(`/mod/trash/${kind}/${id}/restore`, { method: 'POST', body: {} });
      toast('Восстановлено');
      await onChanged?.();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function doPurge() {
    setBusy(true);
    try {
      await api(`/mod/trash/${kind}/${id}`, { method: 'DELETE' });
      toast('Удалено навсегда');
      setConfirm(null);
      router.push(redirectTo);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`glass-panel ${styles.zone}`}>
      <div className={styles.head}>
        <AlertTriangle size={16} className={styles.icon} />
        <span className={styles.title}>Опасная зона</span>
      </div>

      {isDeleted ? (
        <p className={styles.text}>
          {`Этот ${label} удалён. Он не виден в каталоге, но его можно восстановить.`}
        </p>
      ) : (
        <p className={styles.text}>
          {`Удаление убирает ${label} из каталога. Отменить это самостоятельно не получится — `}
          {'восстановление возможно только через модерацию.'}
        </p>
      )}

      <div className={styles.actions}>
        {isDeleted && isMod ? (
          <button type="button" className="btn" disabled={busy} onClick={() => void doRestore()}>
            <RotateCcw size={15} />
            Восстановить
          </button>
        ) : null}

        {!isDeleted && canDelete ? (
          <button
            type="button"
            className="btn btn-danger"
            disabled={busy}
            onClick={() => setConfirm('delete')}
          >
            <Trash2 size={15} />
            {`Удалить ${label}`}
          </button>
        ) : null}

        {isAdmin ? (
          <button
            type="button"
            className="btn btn-danger"
            disabled={busy}
            onClick={() => setConfirm('purge')}
            title="Стереть без возможности восстановления"
          >
            <Trash2 size={15} />
            Стереть навсегда
          </button>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirm === 'delete'}
        onClose={() => setConfirm(null)}
        onConfirm={() => void doDelete()}
        title={`Удалить ${label}?`}
        body={`«${name}» будет удалён без возможности вернуть его самостоятельно. Это действие необратимо.`}
        danger
      />

      <ConfirmDialog
        open={confirm === 'purge'}
        onClose={() => setConfirm(null)}
        onConfirm={() => void doPurge()}
        title="Стереть навсегда?"
        body={`«${name}» и все связанные файлы будут удалены из базы окончательно. Восстановить будет нечего.`}
        danger
      />
    </div>
  );
}
