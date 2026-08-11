'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserPlus, Check } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { LIMITS } from '@/lib/limits';
import { errMsg } from '@/lib/toast';
import { ProviderSection } from '@/components/ProviderAuth/ProviderAuth';
import { useResolveAuth } from '@/lib/useResolveAuth';
import styles from './register.module.css';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_DISPLAY_NAME = 40;

function safeNext(raw: string | null): string {
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw;
  return '/';
}

interface FieldErrors {
  username?: string;
  displayName?: string;
  email?: string;
  password?: string;
  confirm?: string;
  terms?: string;
}

export default function RegisterPage() {
  useResolveAuth();
  const { user, loading, register } = useAuth();
  const router = useRouter();

  const [next, setNext] = useState('/');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [emailTaken, setEmailTaken] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setNext(safeNext(new URLSearchParams(window.location.search).get('next')));
  }, []);

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
    const dn = displayName.trim().replace(/\s+/g, ' ');
    const em = email.trim();
    if (!USERNAME_RE.test(u)) {
      errs.username = '3–30 символов: только латинские буквы, цифры и подчёркивания';
    }
    if (dn.length > MAX_DISPLAY_NAME) {
      errs.displayName = `Не длиннее ${MAX_DISPLAY_NAME} символов`;
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
    if (Object.values(errs).some(Boolean)) return;

    setSubmitting(true);
    try {
      await register(u, em, password, acceptTerms, dn);
      router.replace(next);
    } catch (err) {
      const msg = errMsg(err);
      setFormError(msg);
      setEmailTaken(/уже зарегистрирован|уже заняты/.test(msg));
      setSubmitting(false);
    }
  }

  const loginHref = next !== '/' ? `/auth/login?next=${encodeURIComponent(next)}` : '/auth/login';

  return (
    <div className={styles.wrap}>
      <div className={styles.glowSpot} aria-hidden="true" />
      <div className={`glass-panel ${styles.card}`}>
        <span className={styles.topBar} aria-hidden="true" />
        <h1 className={styles.title}>
          {'Создать'} <span className={styles.titleAccent}>{'аккаунт'}</span>
        </h1>

        {formError ? (
          <div className={styles.formError} role="alert">
            {formError}
            {emailTaken ? (
              <>
                {' '}
                <Link href={loginHref} className={styles.altLink}>
                  {'Войти'}
                </Link>
              </>
            ) : null}
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
              maxLength={LIMITS.username}
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                clearError('username');
              }}
              placeholder={'iloveranobe228'}
              aria-invalid={!!errors.username}
            />
            {errors.username ? (
              <div className={styles.fieldError}>{errors.username}</div>
            ) : (
              <div className={styles.hint}>{'Латинские буквы, цифры и подчёркивания, 3–30 символов'}</div>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="display-name">
              {'Никнейм'}
            </label>
            <input
              id="display-name"
              className={errors.displayName ? `input ${styles.inputError}` : 'input'}
              type="text"
              autoComplete="nickname"
              maxLength={MAX_DISPLAY_NAME}
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                clearError('displayName');
              }}
              placeholder={'Как вас называть'}
              aria-invalid={!!errors.displayName}
            />
            {errors.displayName ? (
              <div className={styles.fieldError}>{errors.displayName}</div>
            ) : (
              <div className={styles.hint}>
                {'Отображается вместо имени пользователя. Можно оставить пустым и задать позже'}
              </div>
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
              maxLength={LIMITS.email}
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
              maxLength={LIMITS.password}
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
              maxLength={LIMITS.password}
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
              <span className={styles.checkbox} aria-hidden="true">
                <Check size={13} strokeWidth={3} />
              </span>
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
