'use client';

import { useEffect, useState } from 'react';
import { Save, Loader2, Plus, Trash2, Heart, Link2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { errMsg, useToast } from '@/lib/toast';
import { PERIOD_LABEL, type GoalPeriod } from '@/lib/donate';
import Spinner from '@/components/Spinner/Spinner';
import Toggle from '@/components/Toggle/Toggle';
import Select from '@/components/Select/Select';
import { ModShell } from '@/app/mod/modnav';
import styles from './page.module.css';

interface ServiceCfg {
  url: string;
  auto: boolean;
  blog?: string;
  has_token: boolean;
}
interface Cfg {
  kofi: ServiceCfg;
  boosty: ServiceCfg;
  badge_min_cents: number;
  badge_slug: string;
  badges: { slug: string; name: string }[];
  goal: { enabled: boolean; target_cents: number; period: GoalPeriod; title: string };
}
interface Row {
  id: number;
  service: string;
  amount: number;
  currency: string;
  donor_name: string;
  message: string;
  manual: boolean;
  user: { id: number; username: string } | null;
  created_at: number;
}

const SERVICE_LABEL: Record<string, string> = { kofi: 'Ko-fi', boosty: 'Boosty', other: 'Другое' };

function Content() {
  const { toast } = useToast();
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [kofiTok, setKofiTok] = useState('');
  const [boostyTok, setBoostyTok] = useState('');
  const [saving, setSaving] = useState(false);

  const [rows, setRows] = useState<Row[]>([]);
  const [add, setAdd] = useState({ service: 'kofi', amount: '', currency: 'USD', donor_name: '', message: '' });
  const [adding, setAdding] = useState(false);
  const [linkInput, setLinkInput] = useState<Record<number, string>>({});

  const loadList = () =>
    api<{ items: Row[] }>('/admin/donations/list')
      .then((d) => setRows(d.items))
      .catch((e) => toast(errMsg(e), 'error'));

  useEffect(() => {
    api<Cfg>('/admin/donations')
      .then(setCfg)
      .catch((e) => toast(errMsg(e), 'error'));
    void loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!cfg) {
    return (
      <div className={styles.loading}>
        <Spinner />
      </div>
    );
  }

  const patchKofi = (p: Partial<ServiceCfg>) => setCfg({ ...cfg, kofi: { ...cfg.kofi, ...p } });
  const patchBoosty = (p: Partial<ServiceCfg>) => setCfg({ ...cfg, boosty: { ...cfg.boosty, ...p } });
  const patchGoal = (p: Partial<Cfg['goal']>) => setCfg({ ...cfg, goal: { ...cfg.goal, ...p } });

  const save = async () => {
    setSaving(true);
    try {
      const d = await api<Cfg>('/admin/donations', {
        method: 'PUT',
        body: {
          kofi: { url: cfg.kofi.url, auto: cfg.kofi.auto, ...(kofiTok ? { token: kofiTok } : {}) },
          boosty: {
            url: cfg.boosty.url,
            auto: cfg.boosty.auto,
            blog: cfg.boosty.blog ?? '',
            ...(boostyTok ? { token: boostyTok } : {}),
          },
          badge_min_cents: cfg.badge_min_cents,
          badge_slug: cfg.badge_slug,
          goal: cfg.goal,
        },
      });
      setCfg(d);
      setKofiTok('');
      setBoostyTok('');
      toast('Сохранено', 'ok');
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setSaving(false);
  };

  const submitAdd = async () => {
    setAdding(true);
    try {
      await api('/admin/donations', {
        method: 'POST',
        body: {
          service: add.service,
          amount: Number(add.amount),
          currency: add.currency,
          donor_name: add.donor_name,
          message: add.message,
        },
      });
      setAdd({ service: 'kofi', amount: '', currency: 'USD', donor_name: '', message: '' });
      toast('Пожертвование добавлено', 'ok');
      void loadList();
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setAdding(false);
  };

  const del = async (id: number) => {
    try {
      await api(`/admin/donations/${id}`, { method: 'DELETE' });
      setRows((r) => r.filter((x) => x.id !== id));
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  const link = async (id: number, username: string) => {
    try {
      const updated = await api<Row>(`/admin/donations/${id}/link`, { method: 'POST', body: { username } });
      setRows((r) => r.map((x) => (x.id === id ? updated : x)));
      setLinkInput((m) => ({ ...m, [id]: '' }));
      toast(username ? 'Привязано' : 'Отвязано', 'ok');
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  const webhookUrl =
    (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api') + '/webhooks/kofi';

  return (
    <div className={styles.wrap}>
      <div className={`glass-panel ${styles.section}`}>
        <div className={styles.head}>
          <Heart size={16} aria-hidden="true" />
          <span className={styles.name}>{'Ko-fi'}</span>
          <span className={styles.spacer} />
          <span className={styles.autoLabel}>{'Автотрекинг'}</span>
          <Toggle checked={cfg.kofi.auto} onChange={(on) => patchKofi({ auto: on })} label={''} />
        </div>
        <div className={styles.grid2}>
          <label className={styles.field}>
            <span className={styles.label}>{'Ссылка (ko-fi.com/…)'}</span>
            <input
              className="input"
              value={cfg.kofi.url}
              onChange={(e) => patchKofi({ url: e.target.value })}
              placeholder="https://ko-fi.com/yourname"
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>{'Verification token (для вебхука)'}</span>
            <input
              className="input"
              type="password"
              value={kofiTok}
              onChange={(e) => setKofiTok(e.target.value)}
              placeholder={cfg.kofi.has_token ? 'сохранён — оставьте пустым' : ''}
            />
          </label>
        </div>
        <p className={styles.hint}>
          {'Вебхук для Ko-fi (укажите в настройках Ko-fi → Webhooks): '}
          <code className={styles.code}>{webhookUrl}</code>
        </p>
      </div>

      <div className={`glass-panel ${styles.section}`}>
        <div className={styles.head}>
          <Heart size={16} aria-hidden="true" />
          <span className={styles.name}>{'Boosty'}</span>
          <span className={styles.spacer} />
          <span className={styles.autoLabel}>{'Автотрекинг'}</span>
          <Toggle checked={cfg.boosty.auto} onChange={(on) => patchBoosty({ auto: on })} label={''} />
        </div>
        <div className={styles.grid2}>
          <label className={styles.field}>
            <span className={styles.label}>{'Ссылка (boosty.to/…)'}</span>
            <input
              className="input"
              value={cfg.boosty.url}
              onChange={(e) => patchBoosty({ url: e.target.value })}
              placeholder="https://boosty.to/yourname"
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>{'Имя блога (для автотрекинга)'}</span>
            <input
              className="input"
              value={cfg.boosty.blog ?? ''}
              onChange={(e) => patchBoosty({ blog: e.target.value })}
              placeholder="yourname"
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>{'Bearer token (из сессии Boosty)'}</span>
            <input
              className="input"
              type="password"
              value={boostyTok}
              onChange={(e) => setBoostyTok(e.target.value)}
              placeholder={cfg.boosty.has_token ? 'сохранён — оставьте пустым' : ''}
            />
          </label>
        </div>
        <p className={styles.hint}>
          {'У Boosty нет официального API — автотрекинг работает через неофициальный запрос и может ломаться при смене токена. Ручное внесение ниже надёжнее.'}
        </p>
      </div>

      <div className={`glass-panel ${styles.section}`}>
        <div className={styles.head}>
          <span className={styles.name}>{'Бейдж и цель сбора'}</span>
        </div>
        <div className={styles.grid2}>
          <label className={styles.field}>
            <span className={styles.label}>{'Бейдж за пожертвование'}</span>
            <Select
              block
              value={cfg.badge_slug}
              options={[
                { value: '', label: 'Не выдавать' },
                ...cfg.badges.map((b) => ({ value: b.slug, label: b.name })),
              ]}
              onChange={(v) => setCfg({ ...cfg, badge_slug: v })}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>{'Минимум для бейджа, $'}</span>
            <input
              className="input"
              type="number"
              min={0}
              step="0.01"
              value={cfg.badge_min_cents / 100}
              onChange={(e) => setCfg({ ...cfg, badge_min_cents: Math.round(Number(e.target.value) * 100) })}
            />
          </label>
        </div>

        <div className={styles.head} style={{ marginTop: 8 }}>
          <span className={styles.autoLabel}>{'Показывать цель в футере'}</span>
          <Toggle checked={cfg.goal.enabled} onChange={(on) => patchGoal({ enabled: on })} label={''} />
        </div>
        <div className={styles.grid2}>
          <label className={styles.field}>
            <span className={styles.label}>{'Название цели'}</span>
            <input
              className="input"
              value={cfg.goal.title}
              onChange={(e) => patchGoal({ title: e.target.value })}
              placeholder="Серверы на месяц"
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>{'Цель, $'}</span>
            <input
              className="input"
              type="number"
              min={0}
              step="1"
              value={cfg.goal.target_cents / 100}
              onChange={(e) => patchGoal({ target_cents: Math.round(Number(e.target.value) * 100) })}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>{'Период'}</span>
            <Select
              block
              value={cfg.goal.period}
              options={(['once', 'weekly', 'monthly'] as GoalPeriod[]).map((p) => ({
                value: p,
                label: p === 'once' ? 'Разовый' : PERIOD_LABEL[p],
              }))}
              onChange={(v) => patchGoal({ period: v as GoalPeriod })}
            />
          </label>
        </div>
      </div>

      <div className={styles.saveRow}>
        <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void save()}>
          {saving ? <Loader2 size={15} className={styles.spin} /> : <Save size={15} />}
          {'Сохранить настройки'}
        </button>
      </div>

      <div className={`glass-panel ${styles.section}`}>
        <div className={styles.head}>
          <Plus size={16} aria-hidden="true" />
          <span className={styles.name}>{'Внести вручную'}</span>
        </div>
        <div className={styles.grid2}>
          <label className={styles.field}>
            <span className={styles.label}>{'Сервис'}</span>
            <Select
              block
              value={add.service}
              options={[
                { value: 'kofi', label: 'Ko-fi' },
                { value: 'boosty', label: 'Boosty' },
                { value: 'other', label: 'Другое' },
              ]}
              onChange={(v) => setAdd({ ...add, service: v })}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>{'Сумма'}</span>
            <input
              className="input"
              type="number"
              min={0}
              step="0.01"
              value={add.amount}
              onChange={(e) => setAdd({ ...add, amount: e.target.value })}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>{'Валюта'}</span>
            <input
              className="input"
              value={add.currency}
              onChange={(e) => setAdd({ ...add, currency: e.target.value.toUpperCase() })}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>{'Имя донатера'}</span>
            <input
              className="input"
              value={add.donor_name}
              onChange={(e) => setAdd({ ...add, donor_name: e.target.value })}
            />
          </label>
        </div>
        <label className={styles.field}>
          <span className={styles.label}>{'Комментарий (ник для привязки к аккаунту)'}</span>
          <input
            className="input"
            value={add.message}
            onChange={(e) => setAdd({ ...add, message: e.target.value })}
            placeholder="ник на сайте"
          />
        </label>
        <div className={styles.saveRow}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={adding || !add.amount}
            onClick={() => void submitAdd()}
          >
            {adding ? <Loader2 size={15} className={styles.spin} /> : <Plus size={15} />}
            {'Добавить'}
          </button>
        </div>
      </div>

      <div className={`glass-panel ${styles.section}`}>
        <div className={styles.head}>
          <span className={styles.name}>{'Последние пожертвования'}</span>
        </div>
        {rows.length === 0 ? (
          <p className={styles.hint}>{'Пока пусто.'}</p>
        ) : (
          <div className={styles.list}>
            {rows.map((r) => (
              <div key={r.id} className={styles.item}>
                <span className={styles.itemService}>{SERVICE_LABEL[r.service] ?? r.service}</span>
                <span className={styles.itemAmount}>
                  {r.amount} {r.currency}
                </span>
                <span className={styles.itemWho}>{r.donor_name || '—'}</span>
                {r.user ? (
                  <span className={styles.linkWrap}>
                    <span className={styles.itemLinked}>@{r.user.username}</span>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      title={'Отвязать'}
                      onClick={() => void link(r.id, '')}
                    >
                      <X size={13} />
                    </button>
                  </span>
                ) : (
                  <span className={styles.linkForm}>
                    <input
                      className="input"
                      placeholder={'привязать к нику'}
                      value={linkInput[r.id] ?? ''}
                      onChange={(e) => setLinkInput((m) => ({ ...m, [r.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        const v = (linkInput[r.id] ?? '').trim();
                        if (e.key === 'Enter' && v) void link(r.id, v);
                      }}
                    />
                    <button
                      type="button"
                      className={styles.iconBtn}
                      title={'Привязать'}
                      disabled={!(linkInput[r.id] ?? '').trim()}
                      onClick={() => void link(r.id, (linkInput[r.id] ?? '').trim())}
                    >
                      <Link2 size={14} />
                    </button>
                  </span>
                )}
                {!r.manual ? <span className={styles.itemAuto}>{'авто'}</span> : null}
                <button type="button" className={styles.iconBtn} onClick={() => void del(r.id)} title={'Удалить'}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DonationsModPage() {
  return (
    <ModShell title="Пожертвования" perm="donations.manage">
      <Content />
    </ModShell>
  );
}
