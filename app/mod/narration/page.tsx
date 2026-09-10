'use client';

import { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { api } from '@/lib/api';
import { errMsg, useToast } from '@/lib/toast';
import type { ModNarratorList, NarrationSettings } from '@/lib/types';
import { ModShell, ErrorPanel } from '../modnav';
import Select from '@/components/Select/Select';
import Toggle from '@/components/Toggle/Toggle';
import Spinner from '@/components/Spinner/Spinner';
import styles from './page.module.css';

const VOICES = ['xenia', 'baya', 'kseniya', 'aidar', 'eugene', 'random'];
const RATES = ['48000', '24000', '8000'];

export default function NarrationSettingsPage() {
  return (
    <ModShell title="Настройки озвучки" perm="narration.manage">
      <NarrationSettingsInner />
    </ModShell>
  );
}

function NarrationSettingsInner() {
  const { toast } = useToast();
  const [cfg, setCfg] = useState<NarrationSettings | null>(null);
  const [narrators, setNarrators] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [token, setToken] = useState('');
  const [clearToken, setClearToken] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    Promise.all([
      api<NarrationSettings>('/admin/narration-settings'),
      api<ModNarratorList>('/mod/narrators', { params: { status: 'approved', per_page: 100 } }),
    ])
      .then(([settings, list]) => {
        if (!alive) return;
        setCfg(settings);
        setNarrators(list.items.map((n) => ({ value: String(n.id), label: n.name })));
      })
      .catch((e) => {
        if (alive) setError(errMsg(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [nonce]);

  const patch = (p: Partial<NarrationSettings>) => setCfg((c) => (c ? { ...c, ...p } : c));

  const save = async () => {
    if (!cfg || saving) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        enabled: cfg.enabled,
        narrator_id: cfg.narrator_id,
        speaker: cfg.speaker,
        sample_rate: cfg.sample_rate,
        batch_size: cfg.batch_size,
        batch_threshold: cfg.batch_threshold,
        poll_interval_minutes: cfg.poll_interval_minutes,
      };
      if (clearToken) body.rl_token = '';
      else if (token.trim() !== '') body.rl_token = token.trim();

      const next = await api<NarrationSettings>('/admin/narration-settings', {
        method: 'PUT',
        body,
      });
      setCfg(next);
      setToken('');
      setClearToken(false);
      toast('Настройки сохранены', 'ok');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.center}>
        <Spinner />
      </div>
    );
  }
  if (error || !cfg) {
    return <ErrorPanel message={error ?? 'Не удалось загрузить настройки'} onRetry={() => setNonce((n) => n + 1)} />;
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.lead}>
        Импорт книг из внешнего каталога и их ИИ-озвучка. Чтец, голос и токен применяются
        ко всем заказанным озвучкам.
      </p>

      <div className={`glass-panel ${styles.panel}`}>
        <Toggle
          checked={cfg.enabled}
          onChange={(on) => patch({ enabled: on })}
          label="Приём заказов озвучки"
          hint="Показывать книги из внешнего каталога в поиске и разрешить заказывать озвучку"
        />

        <div className={styles.field}>
          <label className={styles.label} htmlFor="narr-narrator">
            Чтец для озвучки
          </label>
          <Select
            id="narr-narrator"
            block
            value={cfg.narrator_id ? String(cfg.narrator_id) : ''}
            placeholder="— выберите чтеца —"
            options={narrators}
            onChange={(v) => patch({ narrator_id: v ? Number(v) : null })}
          />
          <span className={styles.hint}>Аудио заказанных озвучек привязывается к этому чтецу.</span>
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="narr-voice">
              Голос Silero
            </label>
            <Select
              id="narr-voice"
              block
              value={cfg.speaker}
              options={VOICES.map((v) => ({ value: v, label: v }))}
              onChange={(v) => patch({ speaker: v })}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="narr-rate">
              Частота дискретизации
            </label>
            <Select
              id="narr-rate"
              block
              value={String(cfg.sample_rate)}
              options={RATES.map((r) => ({ value: r, label: `${r} Гц` }))}
              onChange={(v) => patch({ sample_rate: Number(v) })}
            />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="narr-batch">
              Размер партии
            </label>
            <input
              id="narr-batch"
              type="number"
              className="input"
              min={1}
              max={200}
              value={cfg.batch_size}
              onChange={(e) => patch({ batch_size: Number(e.target.value) })}
            />
            <span className={styles.hint}>Сколько глав ставить в очередь за раз.</span>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="narr-threshold">
              Порог догрузки
            </label>
            <input
              id="narr-threshold"
              type="number"
              className="input"
              min={0}
              max={cfg.batch_size}
              value={cfg.batch_threshold}
              onChange={(e) => patch({ batch_threshold: Number(e.target.value) })}
            />
            <span className={styles.hint}>За сколько глав до конца ставить следующую партию.</span>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="narr-poll">
              Интервал опроса, мин
            </label>
            <input
              id="narr-poll"
              type="number"
              className="input"
              min={5}
              max={1440}
              value={cfg.poll_interval_minutes}
              onChange={(e) => patch({ poll_interval_minutes: Number(e.target.value) })}
            />
            <span className={styles.hint}>Как часто проверять новые главы у продолжающихся тайтлов.</span>
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="narr-token">
            Токен источника
          </label>
          <input
            id="narr-token"
            type="password"
            className="input"
            autoComplete="off"
            placeholder={cfg.has_token ? '•••••••• (задан) — оставьте пустым, чтобы не менять' : 'Bearer-токен для закрытых глав'}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            disabled={clearToken}
          />
          {cfg.has_token ? (
            <label className={styles.clearRow}>
              <input
                type="checkbox"
                checked={clearToken}
                onChange={(e) => setClearToken(e.target.checked)}
              />
              Удалить сохранённый токен
            </label>
          ) : null}
          <span className={styles.hint}>Нужен только для закрытых/возрастных глав. Хранится на сервере.</span>
        </div>

        <div className={styles.actions}>
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? <Loader2 size={15} className={styles.spin} /> : <Save size={15} />}
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
