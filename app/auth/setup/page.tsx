'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserCog } from 'lucide-react';
import { api } from '@/lib/api';
import { errMsg, useToast } from '@/lib/toast';
import { useAuth } from '@/lib/auth';
import type { Me } from '@/lib/types';
import Spinner from '@/components/Spinner/Spinner';
import styles from './page.module.css';

const USERNAME_RE = /^[A-Za-z0-9_]{3,30}$/;

export default function AuthSetupPage() {
  const { user, loading, refresh } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/auth/login');
      return;
    }
    if (!user.needs_setup) {
      router.replace('/');
      return;
    }
    if (!seeded) {
      setSeeded(true);
      setDisplayName(user.display_name || '');
    }
  }, [loading, user, router, seeded]);

  if (loading || !user || !user.needs_setup) {
    return (
      <div className={styles.center}>
        <Spinner />
      </div>
    );
  }

  const usernameOk = USERNAME_RE.test(username);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!usernameOk) {
      toast('Логин: 3-30 символов, только латиница, цифры и подчёркивание', 'error');
      return;
    }
    setSaving(true);
    try {
      await api<Me>('/me/setup', {
        method: 'POST',
        body: { username, display_name: displayName },
      });
      await refresh();
      toast('Профиль настроен', 'ok');
      router.replace('/');
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={`glass-panel ${styles.panel}`}>
        <div className={styles.head}>
          <UserCog size={18} className={styles.icon} aria-hidden="true" />
          <div>
            <span className="eyebrow">{'Почти готово'}</span>
            <h1 className={styles.title}>
              {'Настройте '}
              <span className={styles.titleAccent}>{'профиль'}</span>
            </h1>
          </div>
        </div>

        <p className={styles.intro}>
          {'Вы вошли через сторонний сервис. Осталось выбрать логин — он будет адресом вашей страницы и по нему вас смогут упомянуть в комментариях.'}
        </p>

        <form onSubmit={submit} noValidate>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="setup-username">
              {'Логин'}
            </label>
            <input
              id="setup-username"
              className="input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={'my_login'}
              autoComplete="username"
              autoFocus
            />
            <p className={styles.hint}>
              {'3-30 символов: латиница, цифры и подчёркивание. Уникален, его видно в адресе '}
              <code className={styles.code}>/user/{username || 'my_login'}</code>
              {' и в упоминаниях @'}
              {username || 'my_login'}
              {'.'}
            </p>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="setup-display">
              {'Отображаемое имя'}
            </label>
            <input
              id="setup-display"
              className="input"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={'Как вас показывать'}
              maxLength={40}
            />
            <p className={styles.hint}>
              {'Любые символы, до 40 знаков. Можно оставить пустым — тогда будет показан логин.'}
            </p>
          </div>

          <button
            type="submit"
            className={`btn btn-primary ${styles.submit}`}
            disabled={saving || !usernameOk}
          >
            {saving ? 'Сохраняем…' : 'Продолжить'}
          </button>
        </form>
      </div>
    </div>
  );
}
