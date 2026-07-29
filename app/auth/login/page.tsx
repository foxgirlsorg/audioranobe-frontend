'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogIn } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { errMsg } from '@/lib/toast';
import { ProviderSection } from '@/components/ProviderAuth';
import styles from './login.module.css';

function safeNext(raw: string | null): string {
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw;
  return '/';
}

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const router = useRouter();

  const [next, setNext] = useState('/');
  const [loginValue, setLoginValue] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ login?: string; password?: string }>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setNext(safeNext(new URLSearchParams(window.location.search).get('next')));
  }, []);

  // Already signed in — go back where the user came from.
  useEffect(() => {
    if (!loading && user) router.replace(next);
  }, [loading, user, next, router]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const errs: { login?: string; password?: string } = {};
    if (!loginValue.trim()) errs.login = 'Введите имя пользователя или email';
    if (!password) errs.password = 'Введите пароль';
    setErrors(errs);
    setFormError('');
    if (errs.login || errs.password) return;

    setSubmitting(true);
    try {
      await login(loginValue.trim(), password);
      router.replace(next);
    } catch (err) {
      setFormError(errMsg(err));
      setSubmitting(false);
    }
  }

  const registerHref =
    next !== '/' ? `/auth/register?next=${encodeURIComponent(next)}` : '/auth/register';

  return (
    <div className={styles.wrap}>
      <div className={styles.glowSpot} aria-hidden="true" />
      <div className={`glass-panel ${styles.card}`}>
        <span className={styles.topBar} aria-hidden="true" />
        <Link href="/" className={styles.logo}>
          AUDIO<span className={styles.logoAccent}>RANOBE</span>
        </Link>
        <span className="eyebrow">{'С возвращением'}</span>
        <h1 className={styles.title}>
          {'Вход'} <span className={styles.titleAccent}>{'в аккаунт'}</span>
        </h1>

        {formError ? (
          <div className={styles.formError} role="alert">
            {formError}
          </div>
        ) : null}

        <form onSubmit={onSubmit} noValidate>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="login">
              {'Имя пользователя или email'}
            </label>
            <input
              id="login"
              className={errors.login ? `input ${styles.inputError}` : 'input'}
              type="text"
              autoComplete="username"
              value={loginValue}
              onChange={(e) => {
                setLoginValue(e.target.value);
                if (errors.login) setErrors((p) => ({ ...p, login: undefined }));
              }}
              placeholder={'listener_01'}
              aria-invalid={!!errors.login}
            />
            {errors.login ? <div className={styles.fieldError}>{errors.login}</div> : null}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="password">
              {'Пароль'}
            </label>
            <input
              id="password"
              className={errors.password ? `input ${styles.inputError}` : 'input'}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
              }}
              placeholder={'••••••••'}
              aria-invalid={!!errors.password}
            />
            {errors.password ? <div className={styles.fieldError}>{errors.password}</div> : null}
          </div>

          <button type="submit" className={`btn btn-primary ${styles.submit}`} disabled={submitting}>
            <LogIn size={15} />
            {submitting ? 'Входим…' : 'Войти'}
          </button>
        </form>

        <ProviderSection mode="login" />

        <p className={styles.alt}>
          <Link href="/auth/forgot" className={styles.altLink}>
            {'Забыли пароль?'}
          </Link>
        </p>

        <p className={styles.alt}>
          {'Впервые у нас?'}{' '}
          <Link href={registerHref} className={styles.altLink}>
            {'Создать аккаунт'}
          </Link>
        </p>
      </div>
    </div>
  );
}
