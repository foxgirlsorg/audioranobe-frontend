'use client';

import { useEffect, useState } from 'react';
import { Save, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { errMsg, useToast } from '@/lib/toast';
import type { StorageSettings } from '@/lib/types';
import Spinner from '@/components/Spinner/Spinner';
import Select from '@/components/Select/Select';
import { ModShell, ErrorPanel, splitHeading } from '@/app/mod/modnav';
import styles from './page.module.css';

function StorageContent() {
  const { toast } = useToast();
  const [cfg, setCfg] = useState<StorageSettings | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [saving, setSaving] = useState(false);
  const [secret, setSecret] = useState(''); // new secret — never prefilled from the server

  useEffect(() => {
    let alive = true;
    api<StorageSettings>('/admin/storage/settings')
      .then((d) => {
        if (alive) {
          setCfg(d);
          setError('');
          setSecret('');
        }
      })
      .catch((e) => {
        if (alive) setError(errMsg(e));
      });
    return () => {
      alive = false;
    };
  }, [reload]);

  if (error) {
    return <ErrorPanel message={error} onRetry={() => setReload((n) => n + 1)} />;
  }
  if (!cfg) {
    return (
      <div className={styles.loading}>
        <Spinner />
      </div>
    );
  }

  const set = (patch: Partial<StorageSettings>) => setCfg({ ...cfg, ...patch });
  const isS3 = cfg.driver === 's3';

  const save = async () => {
    setSaving(true);
    try {
      const body: Record<string, string> = {
        driver: cfg.driver,
        s3_account_id: cfg.s3_account_id,
        s3_bucket: cfg.s3_bucket,
        s3_access_key_id: cfg.s3_access_key_id,
        s3_public_url: cfg.s3_public_url,
        s3_endpoint: cfg.s3_endpoint,
        s3_region: cfg.s3_region,
      };
      if (secret) body.s3_secret_access_key = secret;
      const next = await api<StorageSettings>('/admin/storage/settings', { method: 'PUT', body });
      setCfg(next);
      setSecret('');
      toast('Настройки хранилища сохранены', 'ok');
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setSaving(false);
  };

  return (
    <>
      <p className={styles.hint}>
        {
          'Переключение хранилища поверх .env. Смена хранилища не переносит уже загруженные файлы — меняется только то, куда пишутся новые.'
        }
      </p>

      <div className={`glass-panel ${styles.panel}`}>
        <div className={styles.statusRow}>
          <span className={styles.badge}>
            {`Сейчас активно: ${cfg.effective_driver === 's3' ? 'S3-совместимое' : 'Локальное хранилище'}`}
          </span>
        </div>

        <label className={styles.field}>
          <span className={styles.label}>{'Драйвер'}</span>
          <Select
            block
            value={cfg.driver}
            options={[
              { value: '', label: `Как в .env (${cfg.env_driver === 's3' ? 'S3' : 'локальное'})` },
              { value: 'local', label: 'Локальное хранилище' },
              { value: 's3', label: 'S3-совместимое (AWS S3 / R2 / MinIO / B2 …)' },
            ]}
            onChange={(v) => set({ driver: v as '' | 'local' | 's3' })}
          />
        </label>

        {isS3 ? (
          <div className={styles.s3}>
            <label className={styles.field}>
              <span className={styles.label}>{'Endpoint'}</span>
              <input
                className="input"
                value={cfg.s3_endpoint}
                onChange={(e) => set({ s3_endpoint: e.target.value })}
                placeholder="https://s3.eu-central-1.amazonaws.com (пусто — R2 по Account ID / AWS по региону)"
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>{'Bucket'}</span>
              <input className="input" value={cfg.s3_bucket} onChange={(e) => set({ s3_bucket: e.target.value })} />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>{'Access Key ID'}</span>
              <input className="input" value={cfg.s3_access_key_id} onChange={(e) => set({ s3_access_key_id: e.target.value })} />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>{'Secret Access Key'}</span>
              <input
                className="input"
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                autoComplete="off"
                placeholder={cfg.has_secret ? 'Сохранён — оставьте пустым, чтобы не менять' : ''}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>{'Регион'}</span>
              <input className="input" value={cfg.s3_region} onChange={(e) => set({ s3_region: e.target.value })} placeholder="auto" />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>{'Account ID (только Cloudflare R2)'}</span>
              <input className="input" value={cfg.s3_account_id} onChange={(e) => set({ s3_account_id: e.target.value })} />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>{'Публичный URL (для аудио)'}</span>
              <input
                className="input"
                value={cfg.s3_public_url}
                onChange={(e) => set({ s3_public_url: e.target.value })}
                placeholder="https://media.example.com"
              />
            </label>
          </div>
        ) : null}

        <div className={styles.actions}>
          <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void save()}>
            {saving ? <Loader2 size={15} className={styles.spin} /> : <Save size={15} />}
            {'Сохранить'}
          </button>
        </div>
      </div>
    </>
  );
}

export default function ModStoragePage() {
  const h = splitHeading('Хранилище файлов');
  return (
    <ModShell title={h.title} accent={h.accent} perm="storage.manage">
      <StorageContent />
    </ModShell>
  );
}
