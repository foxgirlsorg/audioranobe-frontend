'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { KeyRound } from 'lucide-react';
import { api } from '@/lib/api';
import { errMsg } from '@/lib/toast';
import { useToast } from '@/lib/toast';
import { useResolveAuth } from '@/lib/useResolveAuth';
import styles from '../login/login.module.css';

export default function ResetPage() {
  useResolveAuth();
  const { toast } = useToast();
  const [token, setToken] = useState('');
  const [tokenRead, setTokenRead] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirm?: string }>({});
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!tokenRead) {
    if (typeof window !== 'undefined' && !tokenRead) {
      const params = new URLSearchParams(window.location.search);
      const t = params.get('token');
      if (t) {
        setToken(t);
        setTokenRead(true);
      } else {
        setTokenRead(true);
      }
    }
    return (
      <div className={styles.wrap}>
        <div className={styles.glowSpot} aria-hidden="true" />
        <div className={`glass-panel ${styles.card}`}>
          <span className={styles.topBar} aria-hidden="true" />

          <span className="eyebrow">{'Загрузка'}</span>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className={styles.wrap}>
        <div className={styles.glowSpot} aria-hidden="true" />
        <div className={`glass-panel ${styles.card}`}>
          <span className={styles.topBar} aria-hidden="true" />

          <h1 className={styles.title}>
            {'Неверная'} <span className={styles.titleAccent}>{'ссылка'}</span>
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            {'Ссылка для сброса пароля недействительна или устарела. Запросите новую ссылку для восстановления.'}
          </p>
          <p className={styles.alt}>
            <Link href="/auth/forgot" className={styles.altLink}>
              {'Получить новую ссылку'}
            </Link>
          </p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className={styles.wrap}>
        <div className={styles.glowSpot} aria-hidden="true" />
        <div className={`glass-panel ${styles.card}`}>
          <span className={styles.topBar} aria-hidden="true" />

          <h1 className={styles.title}>
            {'Пароль'} <span className={styles.titleAccent}>{'обновлён'}</span>
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            {'Пароль успешно изменён. Теперь вы можете войти с новым паролем.'}
          </p>
          <p className={styles.alt}>
            <Link href="/auth/login" className={styles.altLink}>
              {'Войти в аккаунт'}
            </Link>
          </p>
        </div>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const errs: { password?: string; confirm?: string } = {};
    if (password.length < 8) errs.password = 'Минимум 8 символов';
    if (confirm !== password) errs.confirm = 'Пароли не совпадают';
    setFieldErrors(errs);
    setError('');
    if (errs.password || errs.confirm) return;

    setSubmitting(true);
    try {
      await api('/auth/reset', { body: { token, password } });
      setSuccess(true);
    } catch (err) {
      setError(errMsg(err));
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.glowSpot} aria-hidden="true" />
      <div className={`glass-panel ${styles.card}`}>
        <span className={styles.topBar} aria-hidden="true" />

        <h1 className={styles.title}>
          {'Сбросить'} <span className={styles.titleAccent}>{'пароль'}</span>
        </h1>

        {error ? (
          <div className={styles.formError} role="alert">
            {error}
          </div>
        ) : null}

        <form onSubmit={onSubmit} noValidate>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="password">
              {'Новый пароль'}
            </label>
            <input
              id="password"
              className={fieldErrors.password ? `input ${styles.inputError}` : 'input'}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined }));
              }}
              placeholder={'Минимум 8 символов'}
              aria-invalid={!!fieldErrors.password}
            />
            {fieldErrors.password ? (
              <div className={styles.fieldError}>{fieldErrors.password}</div>
            ) : null}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="confirm">
              {'Повторите пароль'}
            </label>
            <input
              id="confirm"
              className={fieldErrors.confirm ? `input ${styles.inputError}` : 'input'}
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                if (fieldErrors.confirm) setFieldErrors((p) => ({ ...p, confirm: undefined }));
              }}
              placeholder={'••••••••'}
              aria-invalid={!!fieldErrors.confirm}
            />
            {fieldErrors.confirm ? (
              <div className={styles.fieldError}>{fieldErrors.confirm}</div>
            ) : null}
          </div>

          <button type="submit" className={`btn btn-primary ${styles.submit}`} disabled={submitting}>
            <KeyRound size={15} />
            {submitting ? 'Сохраняем…' : 'Установить пароль'}
          </button>
        </form>

        <p className={styles.alt}>
          <Link href="/auth/login" className={styles.altLink}>
            {'Вернуться ко входу'}
          </Link>
        </p>
      </div>
    </div>
  );
}
