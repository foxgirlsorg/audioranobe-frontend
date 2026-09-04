'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Eye, EyeOff, RotateCcw, Trash2 } from 'lucide-react';
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
  isHidden = false,
  redirectTo,
  onChanged,
}: {
  kind: TrashKind;
  id: number;
  name: string;
  isDeleted?: boolean;
  isHidden?: boolean;
  redirectTo: string;
  onChanged?: () => void | Promise<void>;
}) {
  const { isMod, can } = useAuth();
  const trashView = can(`trash.view.${kind}`);
  const canRestore = trashView && can('trash.restore');
  const canPurge = trashView && can('trash.purge');
  const canHide = kind === 'title' && can('titles.hide');
  const { toast } = useToast();
  const router = useRouter();

  const [confirm, setConfirm] = useState<'delete' | 'purge' | null>(null);
  const [busy, setBusy] = useState(false);

  const label = LABELS[kind];
  const canDelete = kind === 'title' || kind === 'narrator' ? true : isMod;
  if (!canDelete && !canRestore && !canPurge && !canHide) return null;

  async function doToggleHide() {
    setBusy(true);
    try {
      await api(`/titles/${id}/hide`, { method: 'POST' });
      toast(isHidden ? 'Тайтл снова виден всем' : 'Тайтл скрыт');
      await onChanged?.();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function doDelete() {
    setBusy(true);
    try {
      const path =
        kind === 'title' || kind === 'narrator'
          ? `/panel/${kind}s/${id}`
          : `/mod/${kind}s/${id}`;
      const res = await api<{ applied?: boolean }>(path, { method: 'DELETE' });
      // Never "…but it can be restored": the trash is an administrator's tool,
      // and telling the person deleting about it turns a final decision into a
      // reversible one in their head.
      toast(res && res.applied === false ? 'Удаление отправлено на модерацию' : 'Удалено');
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

      {isDeleted && (canRestore || canPurge) ? (
        <p className={styles.text}>
          {`Этот ${label} удалён и не виден на сайте. Восстановить его можно только отсюда или из корзины.`}
        </p>
      ) : isHidden && canHide ? (
        <p className={styles.text}>
          {`Этот ${label} скрыт: его не видно в каталоге, поиске и рекомендациях. Прямая ссылка тоже не работает ни у кого, кроме тех, у кого есть право «Просмотр скрытых тайтлов».`}
        </p>
      ) : (
        <p className={styles.text}>
          {`Этот ${label} исчезнет с сайта, из каталога и из списков пользователей. Отменить удаление нельзя.`}
        </p>
      )}

      <div className={styles.actions}>
        {isDeleted && canRestore ? (
          <button type="button" className="btn" disabled={busy} onClick={() => void doRestore()}>
            <RotateCcw size={15} />
            Восстановить
          </button>
        ) : null}

        {!isDeleted && canHide ? (
          <button type="button" className="btn" disabled={busy} onClick={() => void doToggleHide()}>
            {isHidden ? <Eye size={15} /> : <EyeOff size={15} />}
            {isHidden ? 'Показать' : 'Скрыть'}
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

        {canPurge ? (
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
        body={`«${name}» будет удалён безвозвратно. Отменить это действие нельзя.`}
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
