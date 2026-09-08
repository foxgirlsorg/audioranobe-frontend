'use client';

import { useEffect, useState } from 'react';
import { Save, Loader2, Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { errMsg, useToast } from '@/lib/toast';
import type { AuthProviderConfig, AuthProviderType } from '@/lib/types';
import Spinner from '@/components/Spinner/Spinner';
import Toggle from '@/components/Toggle/Toggle';
import Modal from '@/components/Modal/Modal';
import AddCard from '@/components/AddCard/AddCard';
import { ModShell, ErrorPanel, splitHeading } from '@/app/mod/modnav';
import styles from './page.module.css';

const BUILTIN_TYPES: AuthProviderType[] = ['google', 'discord', 'telegram'];
const MAP_FIELDS: { key: string; label: string; def: string }[] = [
  { key: 'id', label: 'ID пользователя', def: 'sub' },
  { key: 'email', label: 'Email', def: 'email' },
  { key: 'email_verified', label: 'Email подтверждён', def: 'email_verified' },
  { key: 'username', label: 'Логин', def: 'preferred_username' },
  { key: 'display_name', label: 'Отображаемое имя', def: 'name' },
  { key: 'avatar', label: 'Аватар', def: 'picture' },
];

function typeLabel(t: AuthProviderType): string {
  return t === 'oauth2' ? 'OAuth2' : t.charAt(0).toUpperCase() + t.slice(1);
}

/** The redirect URI to register with the provider — backend value, or a live
 *  preview from the chosen id for a not-yet-saved provider. */
function callbackUrl(p: AuthProviderConfig): string {
  if (p.redirect_uri) return p.redirect_uri;
  if (!p.id || typeof window === 'undefined') return '';
  return `${window.location.origin}/auth/callback/${p.id}`;
}

function blank(type: AuthProviderType): AuthProviderConfig {
  const builtin = type !== 'oauth2';
  return {
    id: builtin ? type : '',
    type,
    name: builtin ? typeLabel(type) : '',
    enabled: false,
    builtin,
    redirect_uri: '',
    icon_svg: '',
    client_id: '',
    has_secret: false,
    authorize_url: '',
    token_url: '',
    userinfo_url: '',
    scope: builtin ? '' : 'openid email profile',
    trust_email: false,
    map: {},
  };
}

function AuthContent() {
  const { toast } = useToast();
  const [providers, setProviders] = useState<AuthProviderConfig[] | null>(null);
  const [secrets, setSecrets] = useState<Record<number, string>>({});
  const [persisted, setPersisted] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState<number | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [pw, setPw] = useState('');
  const [prompt, setPrompt] = useState<{ kind: 'save' | 'delete'; i: number } | null>(null);

  useEffect(() => {
    let alive = true;
    api<{ providers: AuthProviderConfig[] }>('/admin/auth/providers')
      .then((d) => {
        if (alive) {
          setProviders(d.providers);
          setPersisted(new Set(d.providers.map((p) => p.id)));
          setError('');
        }
      })
      .catch((e) => {
        if (alive) setError(errMsg(e));
      });
    return () => {
      alive = false;
    };
  }, [reload]);

  if (error) return <ErrorPanel message={error} onRetry={() => setReload((n) => n + 1)} />;
  if (!providers) {
    return (
      <div className={styles.loading}>
        <Spinner />
      </div>
    );
  }

  const patch = (i: number, p: Partial<AuthProviderConfig>) =>
    setProviders((prev) => (prev ? prev.map((x, j) => (j === i ? { ...x, ...p } : x)) : prev));
  const patchMap = (i: number, key: string, val: string) =>
    setProviders((prev) => (prev ? prev.map((x, j) => (j === i ? { ...x, map: { ...x.map, [key]: val } } : x)) : prev));
  const toggleOpen = (i: number) =>
    setOpen((prev) => {
      const n = new Set(prev);
      n.has(i) ? n.delete(i) : n.add(i);
      return n;
    });

  const payload = (p: AuthProviderConfig, i: number) => {
    const out: Record<string, unknown> = {
      id: p.id,
      type: p.type,
      name: p.name,
      enabled: p.enabled,
      icon_svg: p.icon_svg,
      client_id: p.client_id,
    };
    if (secrets[i]) out.client_secret = secrets[i];
    if (!p.builtin) {
      out.authorize_url = p.authorize_url;
      out.token_url = p.token_url;
      out.userinfo_url = p.userinfo_url;
      out.scope = p.scope;
      out.trust_email = p.trust_email;
      out.map = p.map;
    }
    return out;
  };

  // Enable switch — autosaves for a persisted provider, local-only for a new one.
  const onToggle = async (i: number, enabled: boolean) => {
    const p = providers[i];
    patch(i, { enabled });
    if (!persisted.has(p.id)) return;
    try {
      await api(`/admin/auth/providers/${p.id}/toggle`, { method: 'POST', body: { enabled } });
    } catch (e) {
      patch(i, { enabled: !enabled });
      toast(errMsg(e), 'error');
    }
  };

  const doSave = async (i: number, password: string) => {
    const p = providers[i];
    setBusy(i);
    try {
      const d = await api<{ provider: AuthProviderConfig }>(`/admin/auth/providers/${p.id}`, {
        method: 'PUT',
        body: { provider: payload(p, i), password },
      });
      setProviders((prev) => (prev ? prev.map((x, j) => (j === i ? d.provider : x)) : prev));
      setPersisted((prev) => new Set(prev).add(d.provider.id));
      setSecrets((s) => ({ ...s, [i]: '' }));
      toast('Провайдер сохранён', 'ok');
      setPrompt(null);
      setPw('');
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setBusy(null);
  };

  const doDelete = async (i: number, password: string) => {
    const p = providers[i];
    setBusy(i);
    try {
      if (persisted.has(p.id)) {
        await api(`/admin/auth/providers/${p.id}`, { method: 'DELETE', body: { password } });
      }
      setProviders((prev) => (prev ? prev.filter((_, j) => j !== i) : prev));
      setOpen(new Set());
      toast('Провайдер удалён', 'ok');
      setPrompt(null);
      setPw('');
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setBusy(null);
  };

  const removeClicked = (i: number) => {
    // A never-saved provider is dropped straight away; a saved one needs a password.
    if (!persisted.has(providers[i].id)) {
      setProviders((prev) => (prev ? prev.filter((_, j) => j !== i) : prev));
      setOpen(new Set());
    } else {
      setPw('');
      setPrompt({ kind: 'delete', i });
    }
  };

  const usedBuiltins = new Set(providers.filter((p) => p.builtin).map((p) => p.type));
  const addOptions: AuthProviderType[] = ['oauth2', ...BUILTIN_TYPES.filter((t) => !usedBuiltins.has(t))];

  const add = (type: AuthProviderType) => {
    setProviders((prev) => [...(prev ?? []), blank(type)]);
    setOpen((prev) => new Set(prev).add(providers.length));
    setChoosing(false);
  };
  const onAddClick = () => {
    if (addOptions.length === 1) add(addOptions[0]);
    else setChoosing(true);
  };

  const confirmPrompt = () => {
    if (!prompt) return;
    if (prompt.kind === 'save') void doSave(prompt.i, pw);
    else void doDelete(prompt.i, pw);
  };

  return (
    <>
      <p className={styles.hint}>
        {
          'Провайдеры входа, которые видит окно входа/регистрации. Встроенные (Google, Discord, Telegram) используют свои готовые эндпоинты — задайте только ключи и иконку. Переключатель сохраняется сразу; изменение ключей и удаление требуют пароль.'
        }
      </p>

      <div className={styles.list}>
        {providers.map((p, i) => {
          const isOpen = open.has(i);
          return (
            <div key={i} className={`glass-panel ${styles.row}`}>
              <div className={styles.head} onClick={() => toggleOpen(i)}>
                {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <span className={styles.iconPreview} dangerouslySetInnerHTML={{ __html: p.icon_svg }} />
                <span className={styles.name}>{p.name || p.id || 'новый провайдер'}</span>
                <span className={styles.badge}>{typeLabel(p.type)}</span>
                <span className={styles.spacer} />
                <span onClick={(e) => e.stopPropagation()} className={styles.switch}>
                  <Toggle checked={p.enabled} onChange={(on) => void onToggle(i, on)} label={''} />
                </span>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeClicked(i);
                  }}
                  title={'Удалить'}
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {isOpen ? (
                <div className={styles.body}>
                  {callbackUrl(p) ? (
                    <label className={styles.field}>
                      <span className={styles.label}>{'Callback URL — укажите в консоли провайдера'}</span>
                      <input
                        className="input"
                        readOnly
                        value={callbackUrl(p)}
                        onFocus={(e) => e.currentTarget.select()}
                      />
                    </label>
                  ) : null}

                  <div className={styles.grid2}>
                    {!p.builtin ? (
                      <label className={styles.field}>
                        <span className={styles.label}>{'ID (slug)'}</span>
                        <input className="input" value={p.id} onChange={(e) => patch(i, { id: e.target.value })} placeholder="github" />
                      </label>
                    ) : null}
                    <label className={styles.field}>
                      <span className={styles.label}>{'Название'}</span>
                      <input className="input" value={p.name} onChange={(e) => patch(i, { name: e.target.value })} />
                    </label>
                  </div>

                  <div className={styles.iconRow}>
                    <span className={styles.iconBig} dangerouslySetInnerHTML={{ __html: p.icon_svg }} />
                    <label className={styles.field} style={{ flex: 1 }}>
                      <span className={styles.label}>{'SVG-иконка'}</span>
                      <textarea
                        className="input"
                        value={p.icon_svg}
                        onChange={(e) => patch(i, { icon_svg: e.target.value })}
                        placeholder={p.builtin ? 'пусто — использовать встроенную иконку' : '<svg>…</svg>'}
                      />
                    </label>
                  </div>

                  <div className={styles.grid2}>
                    <label className={styles.field}>
                      <span className={styles.label}>{'Client ID'}</span>
                      <input className="input" value={p.client_id} onChange={(e) => patch(i, { client_id: e.target.value })} />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.label}>{'Client Secret'}</span>
                      <input
                        className="input"
                        type="password"
                        value={secrets[i] ?? ''}
                        onChange={(e) => setSecrets((s) => ({ ...s, [i]: e.target.value }))}
                        placeholder={p.has_secret ? 'сохранён — оставьте пустым' : ''}
                      />
                    </label>
                  </div>

                  {!p.builtin ? (
                    <>
                      <div className={styles.subhead}>{'Эндпоинты'}</div>
                      <label className={styles.field}>
                        <span className={styles.label}>{'Authorize URL'}</span>
                        <input className="input" value={p.authorize_url} onChange={(e) => patch(i, { authorize_url: e.target.value })} placeholder="https://…/authorize" />
                      </label>
                      <div className={styles.grid2}>
                        <label className={styles.field}>
                          <span className={styles.label}>{'Token URL'}</span>
                          <input className="input" value={p.token_url} onChange={(e) => patch(i, { token_url: e.target.value })} placeholder="https://…/token" />
                        </label>
                        <label className={styles.field}>
                          <span className={styles.label}>{'Userinfo URL'}</span>
                          <input className="input" value={p.userinfo_url} onChange={(e) => patch(i, { userinfo_url: e.target.value })} placeholder="https://…/userinfo" />
                        </label>
                      </div>
                      <div className={styles.grid2}>
                        <label className={styles.field}>
                          <span className={styles.label}>{'Scope'}</span>
                          <input className="input" value={p.scope} onChange={(e) => patch(i, { scope: e.target.value })} placeholder="openid email profile" />
                        </label>
                      </div>
                      <Toggle
                        checked={p.trust_email}
                        onChange={(on) => patch(i, { trust_email: on })}
                        label={'Считать email подтверждённым'}
                        hint={'Как у Google — доверять адресу этого провайдера'}
                      />

                      <div className={styles.subhead}>{'Сопоставление полей профиля (JSON userinfo)'}</div>
                      <div className={styles.grid2}>
                        {MAP_FIELDS.map((f) => (
                          <label key={f.key} className={styles.field}>
                            <span className={styles.label}>{f.label}</span>
                            <input
                              className="input"
                              value={p.map[f.key] ?? ''}
                              onChange={(e) => patchMap(i, f.key, e.target.value)}
                              placeholder={f.def}
                            />
                          </label>
                        ))}
                      </div>
                    </>
                  ) : null}

                  <div className={styles.rowActions}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busy === i}
                      onClick={() => {
                        setPw('');
                        setPrompt({ kind: 'save', i });
                      }}
                    >
                      {busy === i ? <Loader2 size={15} className={styles.spin} /> : <Save size={15} />}
                      {'Сохранить'}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {choosing ? (
        <div className={`glass-panel ${styles.chooser}`}>
          <span className={styles.label}>{'Тип нового провайдера'}</span>
          <div className={styles.chooserBtns}>
            {addOptions.map((t) => (
              <button key={t} type="button" className="btn btn-ghost" onClick={() => add(t)}>
                {typeLabel(t)}
              </button>
            ))}
            <button type="button" className="btn btn-ghost" onClick={() => setChoosing(false)}>
              {'Отмена'}
            </button>
          </div>
        </div>
      ) : (
        <AddCard icon={Plus} label={'Добавить провайдер'} onClick={onAddClick} className={styles.add} />
      )}

      <Modal
        open={!!prompt}
        onClose={() => {
          setPrompt(null);
          setPw('');
        }}
        title={prompt?.kind === 'delete' ? 'Удаление провайдера' : 'Сохранение провайдера'}
      >
        <div className={styles.pwBox}>
          <p className={styles.hint}>
            {prompt?.kind === 'delete'
              ? 'Введите пароль аккаунта, чтобы удалить провайдера.'
              : 'Введите пароль аккаунта, чтобы сохранить изменения ключей.'}
          </p>
          <input
            className="input"
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoComplete="current-password"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && pw) confirmPrompt();
            }}
          />
          <div className={styles.pwActions}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setPrompt(null);
                setPw('');
              }}
            >
              {'Отмена'}
            </button>
            <button
              type="button"
              className={prompt?.kind === 'delete' ? 'btn btn-danger' : 'btn btn-primary'}
              disabled={!pw || busy !== null}
              onClick={confirmPrompt}
            >
              {prompt?.kind === 'delete' ? 'Удалить' : 'Сохранить'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default function ModAuthPage() {
  const h = splitHeading('Способы входа');
  return (
    <ModShell title={h.title} accent={h.accent} perm="auth.manage">
      <AuthContent />
    </ModShell>
  );
}
