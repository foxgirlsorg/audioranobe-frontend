'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast, errMsg } from '@/lib/toast';
import type { Me } from '@/lib/types';
import Modal from '@/components/Modal/Modal';
import styles from './TotpSetupModal.module.css';

type Step = 'loading' | 'scan' | 'codes';

/** Enable-2FA flow: generate a secret, scan/confirm, then show emergency backup codes once. */
export function TotpSetupModal({
  open,
  onClose,
  onEnabled,
}: {
  open: boolean;
  onClose: () => void;
  onEnabled: (user: Me) => void;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('loading');
  const [secret, setSecret] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setStep('loading');
    setCode('');
    setCopiedSecret(false);
    setCopiedCodes(false);
    (async () => {
      try {
        const res = await api<{ secret: string; otpauth_url: string }>('/me/totp/setup', { method: 'POST' });
        const qr = await QRCode.toDataURL(res.otpauth_url, { margin: 1, width: 220 });
        if (!alive) return;
        setSecret(res.secret);
        setQrDataUrl(qr);
        setStep('scan');
      } catch (e) {
        if (!alive) return;
        toast(errMsg(e), 'error');
        onClose();
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function confirm() {
    if (busy || !code.trim()) return;
    setBusy(true);
    try {
      const res = await api<{ user: Me; backup_codes: string[] }>('/me/totp/confirm', {
        method: 'POST',
        body: { code: code.trim() },
      });
      setBackupCodes(res.backup_codes);
      setStep('codes');
      onEnabled(res.user);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  function copy(text: string, mark: (v: boolean) => void) {
    void navigator.clipboard?.writeText(text).then(() => {
      mark(true);
      setTimeout(() => mark(false), 1200);
    });
  }

  return (
    <Modal open={open} onClose={onClose} title={'Двухфакторная аутентификация'}>
      {step === 'loading' ? (
        <p className={styles.hint}>{'Готовим секрет…'}</p>
      ) : step === 'scan' ? (
        <div className={styles.body}>
          <p className={styles.hint}>
            {'Отсканируйте QR-код в приложении-аутентификаторе (Google Authenticator, Aegis и т.п.) или введите код вручную:'}
          </p>

          {qrDataUrl ? <img src={qrDataUrl} alt="QR-код для настройки 2FA" className={styles.qr} /> : null}

          <div className={styles.secretRow}>
            <code className={styles.secret}>{secret}</code>
            <button
              type="button"
              className={`btn btn-ghost ${styles.copyBtn}`}
              onClick={() => copy(secret, setCopiedSecret)}
              aria-label={'Скопировать секрет'}
            >
              {copiedSecret ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>

          <label className={styles.label} htmlFor="totp-setup-code">
            {'Код из приложения'}
          </label>
          <input
            id="totp-setup-code"
            className="input"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={'000000'}
            autoComplete="one-time-code"
            autoFocus
          />

          <div className={styles.actions}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              {'Отмена'}
            </button>
            <button type="button" className="btn btn-primary" disabled={busy || !code.trim()} onClick={confirm}>
              {busy ? 'Проверяем…' : 'Подтвердить'}
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.body}>
          <p className={styles.hint}>
            {'Двухфакторная аутентификация включена. Сохраните эти запасные коды в надёжном месте — каждый работает один раз и заменяет код из приложения, если вы потеряете доступ к нему. Больше они не будут показаны.'}
          </p>

          <div className={styles.codesGrid}>
            {backupCodes.map((c) => (
              <code key={c} className={styles.secret}>
                {c}
              </code>
            ))}
          </div>

          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => copy(backupCodes.join('\n'), setCopiedCodes)}
          >
            {copiedCodes ? <Check size={14} /> : <Copy size={14} />}
            {copiedCodes ? 'Скопировано' : 'Скопировать все'}
          </button>

          <div className={styles.actions}>
            <button type="button" className="btn btn-primary" onClick={onClose}>
              {'Готово'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default TotpSetupModal;
