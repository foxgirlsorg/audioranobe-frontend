'use client';

import { useEffect, useState } from 'react';
import { Loader2, Save, Plus, Pencil, Trash2, PlayCircle, FlaskConical, RefreshCw, Download, RotateCcw } from 'lucide-react';
import { api, API_URL } from '@/lib/api';
import { uploadInChunks } from '@/lib/upload';
import { errMsg, useToast } from '@/lib/toast';
import type { BackupDestination, BackupDestType, BackupRestorePoint, BackupRunItem, BackupSchedule, BackupSettings } from '@/lib/types';
import { ModShell, ErrorPanel } from '../modnav';
import Select from '@/components/Select/Select';
import Toggle from '@/components/Toggle/Toggle';
import Modal from '@/components/Modal/Modal';
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog';
import Spinner from '@/components/Spinner/Spinner';
import styles from './page.module.css';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const DEST_TYPES: { value: BackupDestType; label: string }[] = [
  { value: 's3', label: 'S3' },
  { value: 'r2', label: 'Cloudflare R2' },
  { value: 'webdav', label: 'WebDAV' },
  { value: 'local', label: 'Локальный путь' },
];

function destLabel(t: BackupDestType): string {
  return DEST_TYPES.find((x) => x.value === t)?.label ?? t;
}

function emptyDestination(): BackupDestination {
  return { id: '', label: '', type: 's3', path: '', headers: [], db_keep: 7, files_keep: 7 };
}

function humanSize(n: number | null): string {
  if (n === null) return '—';
  const units = ['Б', 'КБ', 'МБ', 'ГБ'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(1)} ${units[i]}`;
}

function fmtDate(s: string | null): string {
  if (!s) return '—';
  return new Date(s).toLocaleString('ru-RU');
}

export default function BackupPage() {
  return (
    <ModShell title="Бэкапы" perm="backup.manage">
      <BackupInner />
    </ModShell>
  );
}

function ScheduleCard({
  title,
  sched,
  running,
  onChange,
  onRunNow,
}: {
  title: string;
  sched: BackupSchedule;
  running: boolean;
  onChange: (s: BackupSchedule) => void;
  onRunNow: () => void;
}) {
  return (
    <div className={`glass-panel ${styles.panel}`}>
      <div className={styles.scheduleHead}>
        <h4 className={styles.scheduleTitle}>{title}</h4>
        <button type="button" className="btn btn-ghost" onClick={onRunNow} disabled={running}>
          {running ? <Loader2 size={14} className={styles.spin} /> : <PlayCircle size={14} />}
          Запустить сейчас
        </button>
      </div>
      <Toggle checked={sched.enabled} onChange={(on) => onChange({ ...sched, enabled: on })} label="По расписанию" />
      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label}>Частота</label>
          <Select
            block
            value={sched.frequency}
            options={[
              { value: 'daily', label: 'Каждый день' },
              { value: 'weekly', label: 'Раз в неделю' },
              { value: 'interval', label: 'Раз в N дней' },
            ]}
            onChange={(v) => onChange({ ...sched, frequency: v as BackupSchedule['frequency'] })}
          />
        </div>
        {sched.frequency === 'weekly' ? (
          <div className={styles.field}>
            <label className={styles.label}>День недели</label>
            <Select
              block
              value={String(sched.weekday)}
              options={WEEKDAYS.map((d, i) => ({ value: String(i), label: d }))}
              onChange={(v) => onChange({ ...sched, weekday: Number(v) })}
            />
          </div>
        ) : null}
        {sched.frequency === 'interval' ? (
          <div className={styles.field}>
            <label className={styles.label}>Каждые N дней</label>
            <input
              type="number"
              className="input"
              min={1}
              max={365}
              value={sched.interval_days}
              onChange={(e) => onChange({ ...sched, interval_days: Number(e.target.value) })}
            />
          </div>
        ) : null}
        <div className={styles.field}>
          <label className={styles.label}>Время (UTC)</label>
          <div className={styles.timeRow}>
            <input
              type="number"
              className="input"
              min={0}
              max={23}
              value={sched.hour}
              onChange={(e) => onChange({ ...sched, hour: Number(e.target.value) })}
            />
            <span>:</span>
            <input
              type="number"
              className="input"
              min={0}
              max={59}
              value={sched.minute}
              onChange={(e) => onChange({ ...sched, minute: Number(e.target.value) })}
            />
          </div>
        </div>
      </div>
      <span className={styles.hint}>Последний запуск: {fmtDate(sched.last_run_at)}</span>
    </div>
  );
}

function destFields(d: BackupDestination, setD: (d: BackupDestination) => void) {
  switch (d.type) {
    case 's3':
    case 'r2':
      return (
        <>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Bucket</span>
            <input className="input" value={d.bucket ?? ''} onChange={(e) => setD({ ...d, bucket: e.target.value })} />
          </label>
          {d.type === 'r2' ? (
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Account ID</span>
              <input className="input" value={d.account_id ?? ''} onChange={(e) => setD({ ...d, account_id: e.target.value })} />
            </label>
          ) : (
            <>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Region</span>
                <input className="input" value={d.region ?? 'auto'} onChange={(e) => setD({ ...d, region: e.target.value })} />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Endpoint (опционально)</span>
                <input className="input" value={d.endpoint ?? ''} onChange={(e) => setD({ ...d, endpoint: e.target.value })} />
              </label>
            </>
          )}
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Access Key ID</span>
            <input className="input" value={d.access_key_id ?? ''} onChange={(e) => setD({ ...d, access_key_id: e.target.value })} />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Secret Access Key</span>
            <input
              type="password"
              autoComplete="off"
              className="input"
              value={d.secret_access_key ?? ''}
              onChange={(e) => setD({ ...d, secret_access_key: e.target.value })}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Папка в бакете (опционально)</span>
            <input className="input" value={d.path} onChange={(e) => setD({ ...d, path: e.target.value })} />
          </label>
        </>
      );
    case 'webdav':
      return (
        <>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>URL (например, ваш домен Cloudflare Tunnel)</span>
            <input className="input" value={d.url ?? ''} onChange={(e) => setD({ ...d, url: e.target.value })} />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Логин</span>
            <input className="input" value={d.username ?? ''} onChange={(e) => setD({ ...d, username: e.target.value })} />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Пароль</span>
            <input
              type="password"
              autoComplete="off"
              className="input"
              value={d.password ?? ''}
              onChange={(e) => setD({ ...d, password: e.target.value })}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Заголовки Cloudflare Access (опционально)</span>
            <div className={styles.headerRow}>
              <input
                className="input"
                placeholder="CF-Access-Client-Id"
                value={d.headers?.[0]?.key ?? ''}
                onChange={(e) =>
                  setD({ ...d, headers: [{ key: e.target.value, value: d.headers?.[0]?.value ?? '' }, d.headers?.[1] ?? { key: '', value: '' }] })
                }
              />
              <input
                className="input"
                placeholder="значение"
                value={d.headers?.[0]?.value ?? ''}
                onChange={(e) =>
                  setD({ ...d, headers: [{ key: d.headers?.[0]?.key ?? '', value: e.target.value }, d.headers?.[1] ?? { key: '', value: '' }] })
                }
              />
            </div>
            <div className={styles.headerRow}>
              <input
                className="input"
                placeholder="CF-Access-Client-Secret"
                value={d.headers?.[1]?.key ?? ''}
                onChange={(e) =>
                  setD({ ...d, headers: [d.headers?.[0] ?? { key: '', value: '' }, { key: e.target.value, value: d.headers?.[1]?.value ?? '' }] })
                }
              />
              <input
                className="input"
                placeholder="значение"
                value={d.headers?.[1]?.value ?? ''}
                onChange={(e) =>
                  setD({ ...d, headers: [d.headers?.[0] ?? { key: '', value: '' }, { key: d.headers?.[1]?.key ?? '', value: e.target.value }] })
                }
              />
            </div>
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Подпапка (опционально)</span>
            <input className="input" value={d.path} onChange={(e) => setD({ ...d, path: e.target.value })} />
          </label>
        </>
      );
    case 'local':
      return (
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Путь в контейнере</span>
          <input className="input" value={d.path} onChange={(e) => setD({ ...d, path: e.target.value })} placeholder="/var/backups" />
        </label>
      );
  }
}

function BackupInner() {
  const { toast } = useToast();
  const [cfg, setCfg] = useState<BackupSettings | null>(null);
  const [history, setHistory] = useState<BackupRunItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState<'db' | 'files' | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [draft, setDraft] = useState<BackupDestination | null>(null);
  const [toDelete, setToDelete] = useState<BackupDestination | null>(null);
  const [syncDest, setSyncDest] = useState<BackupDestination | null>(null);
  const [syncPassword, setSyncPassword] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [nonce, setNonce] = useState(0);

  const [exporting, setExporting] = useState<'db' | 'files' | null>(null);
  const [rsType, setRsType] = useState<'db' | 'files'>('db');
  const [rsSource, setRsSource] = useState<'destination' | 'upload'>('destination');
  const [rsDestId, setRsDestId] = useState('');
  const [rsPoints, setRsPoints] = useState<BackupRestorePoint[]>([]);
  const [rsPointsLoading, setRsPointsLoading] = useState(false);
  const [rsName, setRsName] = useState('');
  const [rsFile, setRsFile] = useState<File | null>(null);
  const [rsPassword, setRsPassword] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [rsConfirm, setRsConfirm] = useState(false);
  const [rsPhase, setRsPhase] = useState<'uploading' | 'processing' | null>(null);
  const [rsProgress, setRsProgress] = useState<number | null>(null); // upload %, null = indeterminate

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    Promise.all([
      api<BackupSettings>('/admin/backup/settings'),
      api<{ items: BackupRunItem[] }>('/admin/backup/history', { params: { per_page: 20 } }),
    ])
      .then(([settings, hist]) => {
        if (!alive) return;
        setCfg(settings);
        setHistory(hist.items);
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

  const save = async () => {
    if (!cfg || saving) return;
    setSaving(true);
    try {
      const next = await api<BackupSettings>('/admin/backup/settings', { method: 'PUT', body: cfg });
      setCfg(next);
      toast('Настройки сохранены', 'ok');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const runNow = async (type: 'db' | 'files') => {
    setRunning(type);
    try {
      const r = await api<{ ok: boolean; error?: string }>('/admin/backup/run', { method: 'POST', body: { type } });
      if (r.ok) toast('Бэкап запущен и завершён успешно', 'ok');
      else toast(r.error ?? 'Бэкап завершился с ошибкой', 'error');
      setNonce((n) => n + 1);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setRunning(null);
    }
  };

  const testDestination = async (d: BackupDestination) => {
    setTesting(d.id || 'draft');
    try {
      const r = await api<{ ok: boolean; error?: string }>('/admin/backup/test', { method: 'POST', body: { destination: d } });
      if (r.ok) toast('Соединение успешно', 'ok');
      else toast(r.error ?? 'Не удалось подключиться', 'error');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setTesting(null);
    }
  };

  const runSync = async () => {
    if (!syncDest || !syncPassword || syncing) return;
    setSyncing(true);
    try {
      const r = await api<{ ok: boolean; error?: string }>('/admin/backup/sync', {
        method: 'POST',
        body: { id: syncDest.id, password: syncPassword },
      });
      if (r.ok) {
        toast('Синхронизация завершена', 'ok');
        setSyncDest(null);
        setSyncPassword('');
        setNonce((n) => n + 1);
      } else {
        toast(r.error ?? 'Синхронизация не удалась', 'error');
      }
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setSyncing(false);
    }
  };

  const doExport = async (type: 'db' | 'files') => {
    setExporting(type);
    try {
      const { token } = await api<{ token: string }>('/admin/backup/export-token', { method: 'POST', body: { type } });
      // Stream the download via a plain GET navigation; the token authorizes it.
      window.location.href = `${API_URL}/admin/backup/export?token=${encodeURIComponent(token)}`;
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setExporting(null);
    }
  };

  const loadPoints = async (destId: string, type: 'db' | 'files') => {
    if (!destId) {
      setRsPoints([]);
      setRsName('');
      return;
    }
    setRsPointsLoading(true);
    try {
      const r = await api<{ items: BackupRestorePoint[]; error?: string }>('/admin/backup/list', {
        params: { dest_id: destId, type },
      });
      setRsPoints(r.items);
      setRsName(r.items[0]?.name ?? '');
    } catch (e) {
      toast(errMsg(e), 'error');
      setRsPoints([]);
      setRsName('');
    } finally {
      setRsPointsLoading(false);
    }
  };

  useEffect(() => {
    if (rsSource === 'destination') void loadPoints(rsDestId, rsType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rsDestId, rsType, rsSource]);

  const doRestore = async () => {
    if (rsSource === 'upload' && !rsFile) return;
    setRestoring(true);
    setRsProgress(rsSource === 'upload' ? 0 : null);
    setRsPhase(rsSource === 'upload' ? 'uploading' : 'processing');
    try {
      let r: { ok: boolean; error?: string };
      if (rsSource === 'upload') {
        // Chunk the archive up (dodges the proxy body cap), then restore from
        // the assembled upload. Chunk PUTs drive the % bar; once uploaded, the
        // server-side extract runs as an indeterminate "processing" phase.
        const uploadId = await uploadInChunks(rsFile as File, (frac) => setRsProgress(Math.round(frac * 100)), undefined, 'backup');
        setRsProgress(null);
        setRsPhase('processing');
        r = await api<{ ok: boolean; error?: string }>('/admin/backup/restore', {
          method: 'POST',
          body: { type: rsType, upload_id: uploadId, password: rsPassword },
        });
      } else {
        r = await api<{ ok: boolean; error?: string }>('/admin/backup/restore', {
          method: 'POST',
          body: { type: rsType, dest_id: rsDestId, name: rsName, password: rsPassword },
        });
      }
      if (r.ok) {
        toast(rsType === 'db' ? 'База данных восстановлена' : 'Медиафайлы восстановлены', 'ok');
        setRsPassword('');
        setRsFile(null);
        setNonce((n) => n + 1);
      } else {
        toast(r.error ?? 'Не удалось восстановить', 'error');
      }
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setRestoring(false);
      setRsConfirm(false);
      setRsPhase(null);
      setRsProgress(null);
    }
  };

  const saveDestination = () => {
    if (!cfg || !draft) return;
    const exists = cfg.destinations.some((d) => d.id === draft.id);
    const withId = draft.id ? draft : { ...draft, id: Math.random().toString(36).slice(2) };
    const destinations = exists
      ? cfg.destinations.map((d) => (d.id === withId.id ? withId : d))
      : [...cfg.destinations, withId];
    setCfg({ ...cfg, destinations });
    setDraft(null);
  };

  const removeDestination = (d: BackupDestination) => {
    if (!cfg) return;
    setCfg({ ...cfg, destinations: cfg.destinations.filter((x) => x.id !== d.id) });
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
        Резервное копирование базы данных и медиафайлов по отдельным расписаниям, с загрузкой в один или несколько
        мест хранения. Время расписания — по UTC; проверка идёт каждые 20 минут.
      </p>

      <ScheduleCard
        title="Бэкап БД"
        sched={cfg.db}
        running={running === 'db'}
        onChange={(s) => setCfg({ ...cfg, db: s })}
        onRunNow={() => runNow('db')}
      />
      <ScheduleCard
        title="Бэкап файлов"
        sched={cfg.files}
        running={running === 'files'}
        onChange={(s) => setCfg({ ...cfg, files: s })}
        onRunNow={() => runNow('files')}
      />

      <div className={`glass-panel ${styles.panel}`}>
        <h4 className={styles.scheduleTitle}>Скачать бэкап</h4>
        <span className={styles.hint}>
          Создаёт свежий бэкап и отдаёт его прямо в браузер. Файлы стримятся на лету — на диске сервера ничего не
          сохраняется.
        </span>
        <div className={styles.actions}>
          <button type="button" className="btn btn-ghost" disabled={exporting !== null} onClick={() => doExport('db')}>
            {exporting === 'db' ? <Loader2 size={15} className={styles.spin} /> : <Download size={15} />}
            Скачать БД
          </button>
          <button type="button" className="btn btn-ghost" disabled={exporting !== null} onClick={() => doExport('files')}>
            {exporting === 'files' ? <Loader2 size={15} className={styles.spin} /> : <Download size={15} />}
            Скачать файлы
          </button>
        </div>
      </div>

      <div className={`glass-panel ${styles.panel}`}>
        <div className={styles.scheduleHead}>
          <h4 className={styles.scheduleTitle}>Места хранения</h4>
          <button type="button" className="btn btn-ghost" onClick={() => setDraft(emptyDestination())}>
            <Plus size={14} /> Добавить
          </button>
        </div>
        {cfg.destinations.length === 0 ? (
          <span className={styles.hint}>Ничего не настроено — бэкап будет создан, но никуда не загружен.</span>
        ) : (
          <div className={styles.destTable}>
            {cfg.destinations.map((d) => (
              <div key={d.id} className={styles.destRow}>
                <div className={styles.destInfo}>
                  <span className={styles.destLabel}>{d.label || destLabel(d.type)}</span>
                  <span className={styles.destType}>
                    {destLabel(d.type)}
                    {d.mirror ? ' · копия файлов' : ''}
                  </span>
                </div>
                <div className={styles.destActions}>
                  {d.mirror && (d.type === 's3' || d.type === 'r2') ? (
                    <button
                      type="button"
                      className={`btn btn-ghost ${styles.smallBtn}`}
                      onClick={() => {
                        setSyncPassword('');
                        setSyncDest(d);
                      }}
                      title="Синхронизировать (с удалением)"
                    >
                      <RefreshCw size={13} /> Синхр.
                    </button>
                  ) : null}
                  <button type="button" className={`btn btn-ghost ${styles.smallBtn}`} onClick={() => testDestination(d)} disabled={testing === d.id}>
                    {testing === d.id ? <Loader2 size={13} className={styles.spin} /> : <FlaskConical size={13} />}
                    Проверить
                  </button>
                  <button type="button" className={`btn btn-ghost ${styles.smallBtn}`} onClick={() => setDraft(d)}>
                    <Pencil size={13} />
                  </button>
                  <button type="button" className={`btn btn-ghost ${styles.smallBtn}`} onClick={() => setToDelete(d)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={`glass-panel ${styles.panel}`}>
        <Toggle
          checked={cfg.notify_on_success}
          onChange={(on) => setCfg({ ...cfg, notify_on_success: on })}
          label="Уведомлять об успешных бэкапах"
          hint="Об ошибках уведомление приходит всегда"
        />
      </div>

      <div className={styles.actions}>
        <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? <Loader2 size={15} className={styles.spin} /> : <Save size={15} />}
          Сохранить
        </button>
      </div>

      <div className={`glass-panel ${styles.panel}`}>
        <h4 className={styles.scheduleTitle}>История</h4>
        {history.length === 0 ? (
          <span className={styles.hint}>Бэкапов ещё не было.</span>
        ) : (
          <div className={styles.historyTable}>
            {history.map((r) => (
              <div key={r.id} className={styles.historyRow}>
                <span className={styles.historyType}>{r.type === 'db' ? 'БД' : 'Файлы'}</span>
                <span className={`${styles.historyStatus} ${styles[`status_${r.status}`]}`}>
                  {r.status === 'success' ? 'успешно' : r.status === 'failed' ? 'ошибка' : 'выполняется'}
                </span>
                <span className={styles.historyDest}>{r.destination || '—'}</span>
                <span className={styles.historySize}>{humanSize(r.size_bytes)}</span>
                <span className={styles.historyDate}>{fmtDate(r.started_at)}</span>
                {r.error ? <span className={styles.historyError}>{r.error}</span> : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={`glass-panel ${styles.panel}`}>
        <h4 className={styles.scheduleTitle}>Восстановление</h4>
        <span className={styles.hint}>
          Перезаписывает текущие данные из выбранного бэкапа. Действие необратимо — требуется пароль аккаунта. Файл
          проверяется перед восстановлением.
        </span>
        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label}>Что восстановить</label>
            <Select
              block
              value={rsType}
              options={[
                { value: 'db', label: 'База данных' },
                { value: 'files', label: 'Медиафайлы' },
              ]}
              onChange={(v) => setRsType(v as 'db' | 'files')}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Источник</label>
            <Select
              block
              value={rsSource}
              options={[
                { value: 'destination', label: 'Из места хранения' },
                { value: 'upload', label: 'Загрузить файл' },
              ]}
              onChange={(v) => setRsSource(v as 'destination' | 'upload')}
            />
          </div>
        </div>

        {rsSource === 'destination' ? (
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Место хранения</label>
              <Select
                block
                value={rsDestId}
                options={cfg.destinations.map((d) => ({ value: d.id, label: d.label || destLabel(d.type) }))}
                onChange={setRsDestId}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Точка восстановления</label>
              <Select
                block
                value={rsName}
                options={rsPoints.map((p) => ({ value: p.name, label: p.at || p.name }))}
                onChange={setRsName}
              />
              {rsDestId && !rsPointsLoading && rsPoints.length === 0 ? (
                <span className={styles.hint}>Здесь нет подходящих бэкапов.</span>
              ) : null}
            </div>
          </div>
        ) : (
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Файл бэкапа (.sql.gz или .tar.gz)</span>
            <input className="input" type="file" accept=".gz" onChange={(e) => setRsFile(e.target.files?.[0] ?? null)} />
          </label>
        )}

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Пароль аккаунта</span>
          <input
            className="input"
            type="password"
            value={rsPassword}
            onChange={(e) => setRsPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>

        <div className={styles.actions}>
          <button
            type="button"
            className="btn btn-danger"
            disabled={restoring || !rsPassword || (rsSource === 'upload' ? !rsFile : !rsName)}
            onClick={() => setRsConfirm(true)}
          >
            {restoring ? <Loader2 size={15} className={styles.spin} /> : <RotateCcw size={15} />}
            Восстановить
          </button>
        </div>

        {rsPhase ? (
          <div className={styles.progress}>
            <div className={styles.progressTrack}>
              <div
                className={rsProgress === null ? styles.progressFillIndet : styles.progressFill}
                style={rsProgress === null ? undefined : { width: `${rsProgress}%` }}
              />
            </div>
            <span className={styles.progressLabel}>
              {rsPhase === 'uploading' && rsProgress !== null
                ? `Загрузка файла… ${rsProgress}%`
                : 'Восстановление на сервере…'}
            </span>
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={rsConfirm}
        onClose={() => setRsConfirm(false)}
        onConfirm={() => void doRestore()}
        title="Восстановить из бэкапа"
        body={`Текущие ${rsType === 'db' ? 'данные базы' : 'медиафайлы'} будут перезаписаны. Это необратимо. Продолжить?`}
        danger
      />

      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? 'Изменение места хранения' : 'Новое место хранения'}>
        {draft ? (
          <div className={styles.editor}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Название</span>
              <input className="input" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="Домашний сервер" />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Тип</span>
              <Select
                block
                value={draft.type}
                options={DEST_TYPES}
                onChange={(v) => setDraft({ ...emptyDestination(), id: draft.id, label: draft.label, type: v as BackupDestType })}
              />
            </label>
            {destFields(draft, setDraft)}
            <Toggle
              checked={!!draft.mirror}
              onChange={(on) => setDraft({ ...draft, mirror: on })}
              label="Копировать файлы напрямую вместо архива"
              hint="Только для бэкапа файлов: копирует медиатеку как есть, пропуская уже загруженные файлы, вместо одного .tar.gz"
            />
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Подпапка для бэкапов БД (опционально)</span>
              <input
                className="input"
                value={draft.db_path ?? ''}
                onChange={(e) => setDraft({ ...draft, db_path: e.target.value })}
                placeholder="db"
              />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Подпапка для бэкапов файлов (опционально)</span>
              <input
                className="input"
                value={draft.files_path ?? ''}
                onChange={(e) => setDraft({ ...draft, files_path: e.target.value })}
                placeholder="files"
              />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Хранить бэкапов БД</span>
              <input
                type="number"
                className="input"
                min={1}
                max={365}
                value={draft.db_keep}
                onChange={(e) => setDraft({ ...draft, db_keep: Number(e.target.value) })}
              />
            </label>
            {!draft.mirror ? (
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Хранить бэкапов файлов</span>
                <input
                  type="number"
                  className="input"
                  min={1}
                  max={365}
                  value={draft.files_keep ?? 7}
                  onChange={(e) => setDraft({ ...draft, files_keep: Number(e.target.value) })}
                />
              </label>
            ) : null}
            <div className={styles.editorActions}>
              <button type="button" className="btn btn-ghost" onClick={() => testDestination(draft)} disabled={testing === (draft.id || 'draft')}>
                {testing === (draft.id || 'draft') ? <Loader2 size={14} className={styles.spin} /> : <FlaskConical size={14} />}
                Проверить
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setDraft(null)}>
                Отмена
              </button>
              <button type="button" className="btn btn-primary" onClick={saveDestination}>
                {draft.id ? 'Сохранить' : 'Добавить'}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) removeDestination(toDelete);
        }}
        title="Удалить место хранения"
        body={toDelete ? `Удалить «${toDelete.label || toDelete.type}»?` : ''}
        danger
      />

      <Modal
        open={!!syncDest}
        onClose={() => {
          if (!syncing) setSyncDest(null);
        }}
        title="Синхронизация с удалением"
      >
        {syncDest ? (
          <div className={styles.editor}>
            <p className={styles.hint}>
              Точное зеркало «{syncDest.label || syncDest.type}» с прод-сервером: файлы, удалённые
              с сервера, будут <b>безвозвратно удалены</b> и из этого места хранения. Обычный бэкап
              так не делает. Для подтверждения введите пароль аккаунта.
            </p>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Пароль</span>
              <input
                type="password"
                autoComplete="current-password"
                className="input"
                value={syncPassword}
                onChange={(e) => setSyncPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void runSync();
                }}
              />
            </label>
            <div className={styles.editorActions}>
              <button type="button" className="btn btn-ghost" onClick={() => setSyncDest(null)} disabled={syncing}>
                Отмена
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => void runSync()}
                disabled={syncing || syncPassword === ''}
              >
                {syncing ? <Loader2 size={14} className={styles.spin} /> : <RefreshCw size={14} />}
                Синхронизировать
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
