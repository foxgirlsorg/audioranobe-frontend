'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { errMsg } from '@/lib/toast';
import { ProviderSection } from '@/components/ProviderAuth';
import styles from './register.module.css';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function safeNext(raw: string | null): string {
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw;
  return '/';
}

interface FieldErrors {
  username?: string;
  email?: string;
  password?: string;
  confirm?: string;
  terms?: string;
}

export default function RegisterPage() {
  const { user, loading, register } = useAuth();
  const router = useRouter();

  const [next, setNext] = useState('/');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setNext(safeNext(new URLSearchParams(window.location.search).get('next')));
  }, []);

  // Already signed in — no need to register.
  useEffect(() => {
    if (!loading && user) router.replace(next);
  }, [loading, user, next, router]);

  function clearError(key: keyof FieldErrors) {
    setErrors((p) => (p[key] ? { ...p, [key]: undefined } : p));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const errs: FieldErrors = {};
    const u = username.trim();
    const em = email.trim();
    if (!USERNAME_RE.test(u)) {
      errs.username = '3–30 символов: только латинские буквы, цифры и подчёркивания';
    }
    if (!EMAIL_RE.test(em)) {
      errs.email = 'Введите корректный email';
    }
    if (password.length < 8) {
      errs.password = 'Минимум 8 символов';
    }
    if (confirm !== password) {
      errs.confirm = 'Пароли не совпадают';
    }
    if (!acceptTerms) {
      errs.terms = 'Примите условия использования и политику конфиденциальности';
    }
    setErrors(errs);
    setFormError('');
    if (errs.username || errs.email || errs.password || errs.confirm || errs.terms) return;

    setSubmitting(true);
    try {
      await register(u, em, password, acceptTerms);
      router.replace(next);
    } catch (err) {
      setFormError(errMsg(err));
      setSubmitting(false);
    }
  }

  const loginHref = next !== '/' ? `/auth/login?next=${encodeURIComponent(next)}` : '/auth/login';

  return (
    <div className={styles.wrap}>
      <div className={styles.glowSpot} aria-hidden="true" />
      <div className={`glass-panel ${styles.card}`}>
        <span className={styles.topBar} aria-hidden="true" />
        <Link href="/" className={styles.logo}>
          AUDIO<span className={styles.logoAccent}>RANOBE</span>
        </Link>
        <span className="eyebrow">{'Присоединяйтесь к библиотеке'}</span>
        <h1 className={styles.title}>
          {'Создать'} <span className={styles.titleAccent}>{'аккаунт'}</span>
        </h1>

        {formError ? (
          <div className={styles.formError} role="alert">
            {formError}
          </div>
        ) : null}

        <form onSubmit={onSubmit} noValidate>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="username">
              {'Имя пользователя'}
            </label>
            <input
              id="username"
              className={errors.username ? `input ${styles.inputError}` : 'input'}
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                clearError('username');
              }}
              placeholder={'listener_01'}
              aria-invalid={!!errors.username}
            />
            {errors.username ? (
              <div className={styles.fieldError}>{errors.username}</div>
            ) : (
              <div className={styles.hint}>{'Латинские буквы, цифры и подчёркивания, 3–30 символов'}</div>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="email">
              {'Email'}
            </label>
            <input
              id="email"
              className={errors.email ? `input ${styles.inputError}` : 'input'}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearError('email');
              }}
              placeholder={'you@example.com'}
              aria-invalid={!!errors.email}
            />
            {errors.email ? <div className={styles.fieldError}>{errors.email}</div> : null}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="password">
              {'Пароль'}
            </label>
            <input
              id="password"
              className={errors.password ? `input ${styles.inputError}` : 'input'}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearError('password');
              }}
              placeholder={'Минимум 8 символов'}
              aria-invalid={!!errors.password}
            />
            {errors.password ? <div className={styles.fieldError}>{errors.password}</div> : null}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="confirm">
              {'Повторите пароль'}
            </label>
            <input
              id="confirm"
              className={errors.confirm ? `input ${styles.inputError}` : 'input'}
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                clearError('confirm');
              }}
              placeholder={'••••••••'}
              aria-invalid={!!errors.confirm}
            />
            {errors.confirm ? <div className={styles.fieldError}>{errors.confirm}</div> : null}
          </div>

          <div className={styles.field}>
            <label className={styles.termsRow}>
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => {
                  setAcceptTerms(e.target.checked);
                  clearError('terms');
                }}
                aria-invalid={!!errors.terms}
              />
              <span>
                {'Я принимаю '}
                <Link href="/legal/terms" target="_blank" className={styles.altLink}>
                  {'условия использования'}
                </Link>
                {' и '}
                <Link href="/legal/privacy" target="_blank" className={styles.altLink}>
                  {'политику конфиденциальности'}
                </Link>
              </span>
            </label>
            {errors.terms ? <div className={styles.fieldError}>{errors.terms}</div> : null}
          </div>

          <button type="submit" className={`btn btn-primary ${styles.submit}`} disabled={submitting}>
            <UserPlus size={15} />
            {submitting ? 'Создаём аккаунт…' : 'Создать аккаунт'}
          </button>
        </form>

        <ProviderSection mode="login" />

        <p className={styles.alt}>
          {'Уже есть аккаунт?'}{' '}
          <Link href={loginHref} className={styles.altLink}>
            {'Войти'}
          </Link>
        </p>
      </div>
    </div>
  );
}
