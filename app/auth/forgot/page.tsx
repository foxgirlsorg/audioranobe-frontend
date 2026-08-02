'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import { api } from '@/lib/api';
import { errMsg } from '@/lib/toast';
import { useToast } from '@/lib/toast';
import styles from '../login/login.module.css';

export default function ForgotPage() {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const em = email.trim();
    if (!em) {
      setError('Введите email');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await api('/auth/forgot', { body: { email: em } });
      setSent(true);
    } catch (err) {
      toast(errMsg(err), 'error');
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className={styles.wrap}>
        <div className={styles.glowSpot} aria-hidden="true" />
        <div className={`glass-panel ${styles.card}`}>
          <span className={styles.topBar} aria-hidden="true" />

          <span className="eyebrow">{'Проверьте почту'}</span>
          <h1 className={styles.title}>
            {'Письмо'} <span className={styles.titleAccent}>{'отправлено'}</span>
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            {'Письмо с инструкциями отправлено на указанный адрес. Если письмо не приходит, проверьте папку «Спам».'}
          </p>
          <p className={styles.alt}>
            <Link href="/auth/login" className={styles.altLink}>
              {'Вернуться ко входу'}
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.glowSpot} aria-hidden="true" />
      <div className={`glass-panel ${styles.card}`}>
        <span className={styles.topBar} aria-hidden="true" />

        <span className="eyebrow">{'Восстановление доступа'}</span>
        <h1 className={styles.title}>
          {'Забыли'} <span className={styles.titleAccent}>{'пароль?'}</span>
        </h1>

        {error ? (
          <div className={styles.formError} role="alert">
            {error}
          </div>
        ) : null}

        <form onSubmit={onSubmit} noValidate>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="email">
              {'Email'}
            </label>
            <input
              id="email"
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError('');
              }}
              placeholder={'you@example.com'}
            />
          </div>

          <button type="submit" className={`btn btn-primary ${styles.submit}`} disabled={submitting}>
            <Mail size={15} />
            {submitting ? 'Отправляем…' : 'Отправить инструкции'}
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
