'use client';

import { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { api } from '@/lib/api';
import { errMsg, useToast } from '@/lib/toast';
import type { SiteLinks } from '@/lib/config';
import Spinner from '@/components/Spinner/Spinner';
import { ModShell, ErrorPanel } from '@/app/mod/modnav';
import styles from './page.module.css';

const FIELDS: { key: keyof SiteLinks; label: string; placeholder: string }[] = [
  { key: 'support_email', label: 'Почта поддержки', placeholder: 'support@example.com' },
  { key: 'support_bot', label: 'Telegram поддержки', placeholder: 'https://t.me/…' },
  { key: 'support_channel', label: 'Telegram-канал', placeholder: 'https://t.me/…' },
  { key: 'org_url', label: 'Сайт внизу футера', placeholder: 'https://foxgirls.org' },
  { key: 'fdroid_url', label: 'Приложение в F-Droid', placeholder: 'https://f-droid.org/packages/…' },
  { key: 'apk_url', label: 'Прямая ссылка на APK', placeholder: 'https://…/app.apk' },
];

function Content() {
  const { toast } = useToast();
  const [links, setLinks] = useState<SiteLinks | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<SiteLinks>('/mod/links')
      .then(setLinks)
      .catch((e) => setError(errMsg(e)));
  }, []);

  const save = async () => {
    if (!links) return;
    setSaving(true);
    try {
      setLinks(await api<SiteLinks>('/mod/links', { method: 'PUT', body: links }));
      toast('Ссылки сохранены', 'ok');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (error) return <ErrorPanel message={error} />;
  if (!links) {
    return (
      <div className={styles.loading}>
        <Spinner />
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.lead}>
        Внешние ссылки в футере сайта. Пустое поле скрывает ссылку. Карточки приложения появляются в футере, только
        когда задана ссылка на F-Droid или APK. На сайте изменения видны в течение нескольких минут.
      </p>
      <div className={`glass-panel ${styles.section}`}>
        <div className={styles.grid}>
          {FIELDS.map((f) => (
            <label key={f.key} className={styles.field}>
              <span className={styles.label}>{f.label}</span>
              <input
                className="input"
                value={links[f.key]}
                placeholder={f.placeholder}
                onChange={(e) => setLinks({ ...links, [f.key]: e.target.value })}
              />
            </label>
          ))}
        </div>
      </div>
      <div>
        <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void save()}>
          {saving ? <Loader2 size={15} className={styles.spin} /> : <Save size={15} />}
          {'Сохранить'}
        </button>
      </div>
    </div>
  );
}

export default function LinksModPage() {
  return (
    <ModShell title="Ссылки" perm="site.links">
      <Content />
    </ModShell>
  );
}
