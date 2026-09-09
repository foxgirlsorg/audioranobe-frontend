'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogIn } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useEnsureConfig } from '@/lib/config';
import { LIMITS } from '@/lib/limits';
import { errMsg } from '@/lib/toast';
import { ApiError } from '@/lib/api';
import { ProviderSection } from '@/components/ProviderAuth/ProviderAuth';
import Captcha from '@/components/Captcha/Captcha';
import { useResolveAuth } from '@/lib/useResolveAuth';
import styles from './login.module.css';

function safeNext(raw: string | null): string {
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw;
  return '/';
}

export default function LoginPage() {
  useResolveAuth();
  const { user, loading, login } = useAuth();
  const config = useEnsureConfig();
  const router = useRouter();

  const [next, setNext] = useState('/');
  const [loginValue, setLoginValue] = useState('');
  const [password, setPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaNonce, setCaptchaNonce] = useState(0);
  const [errors, setErrors] = useState<{ login?: string; password?: string }>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [needsTotp, setNeedsTotp] = useState(false);
  const [totpCode, setTotpCode] = useState('');

  useEffect(() => {
    setNext(safeNext(new URLSearchParams(window.location.search).get('next')));
  }, []);

  useEffect(() => {
    if (!loading && user) router.replace(next);
  }, [loading, user, next, router]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (needsTotp) {
      if (!totpCode.trim()) {
        setFormError('Введите код из приложения');
        return;
      }
      setFormError('');
      setSubmitting(true);
      try {
        await login(loginValue.trim(), password, captchaToken, totpCode.trim());
        router.replace(next);
      } catch (err) {
        setFormError(errMsg(err));
        setTotpCode('');
        setSubmitting(false);
      }
      return;
    }

    const errs: { login?: string; password?: string } = {};
    if (!loginValue.trim()) errs.login = 'Введите имя пользователя или email';
    if (!password) errs.password = 'Введите пароль';
    setErrors(errs);
    setFormError('');
    if (errs.login || errs.password) return;
    if (config?.captcha.enabled && !captchaToken) {
      setFormError('Подтвердите, что вы не робот');
      return;
    }

    setSubmitting(true);
    try {
      await login(loginValue.trim(), password, captchaToken);
      router.replace(next);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'totp_required') {
        setNeedsTotp(true);
        setFormError('');
        setSubmitting(false);
        return;
      }
      setFormError(errMsg(err));
      setCaptchaToken('');
      setCaptchaNonce((n) => n + 1);
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
        <h1 className={styles.title}>
          {'Вход'} <span className={styles.titleAccent}>{'в аккаунт'}</span>
        </h1>

        {formError ? (
          <div className={styles.formError} role="alert">
            {formError}
          </div>
        ) : null}

        <form onSubmit={onSubmit} noValidate>
          {needsTotp ? (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="totp">
                {'Код из приложения-аутентификатора'}
              </label>
              <input
                id="totp"
                className="input"
                type="text"
                autoComplete="one-time-code"
                maxLength={9}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                placeholder={'000000'}
                autoFocus
              />
              <p className={styles.fieldHint}>
                {'Нет доступа к приложению? Введите один из запасных кодов вместо этого.'}
              </p>
            </div>
          ) : (
            <>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="login">
                  {'Имя пользователя или email'}
                </label>
                <input
                  id="login"
                  className={errors.login ? `input ${styles.inputError}` : 'input'}
                  type="text"
                  autoComplete="username"
                  maxLength={LIMITS.email}
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
                  maxLength={LIMITS.password}
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

              <Captcha key={captchaNonce} onToken={setCaptchaToken} />
            </>
          )}

          <button type="submit" className={`btn btn-primary ${styles.submit}`} disabled={submitting}>
            <LogIn size={15} />
            {submitting ? 'Входим…' : 'Войти'}
          </button>
        </form>

        {needsTotp ? (
          <p className={styles.alt}>
            <button
              type="button"
              className={styles.altLink}
              style={{ background: 'none', border: 0, padding: 0, font: 'inherit', cursor: 'pointer' }}
              onClick={() => {
                setNeedsTotp(false);
                setTotpCode('');
                setFormError('');
              }}
            >
              {'Назад'}
            </button>
          </p>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}
