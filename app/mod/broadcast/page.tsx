'use client';

import { useEffect, useState } from 'react';
import { Radio, Send, X } from 'lucide-react';
import { api } from '@/lib/api';
import { errMsg, useToast } from '@/lib/toast';
import { useAuth } from '@/lib/auth';
import type { Me, Paginated, SearchSuggest } from '@/lib/types';
import Spinner from '@/components/Spinner';
import { ModShell, splitHeading } from '@/app/mod/modnav';
import styles from './page.module.css';

type Audience = 'all' | 'user' | 'narrator_subs' | 'title_followers';

const AUDIENCES: { key: Audience; name: string; desc: string }[] = [
  { key: 'all', name: 'Все пользователи', desc: 'Все, у кого есть аккаунт' },
  { key: 'user', name: 'Конкретный пользователь', desc: 'Один человек — по нику' },
  {
    key: 'narrator_subs',
    name: 'Подписчики чтеца',
    desc: 'Все, кто подписан на чтеца',
  },
  {
    key: 'title_followers',
    name: 'Подписчики тайтла',
    desc: 'Все, у кого тайтл в библиотеке',
  },
];

interface Picked {
  id: number;
  name: string;
}

function SelectedChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <div className={styles.selected}>
      <span className={styles.selectedName}>{label}</span>
      <button
        type="button"
        className={styles.clearBtn}
        onClick={onClear}
        aria-label={'Сбросить выбор'}
      >
        <X size={13} />
      </button>
    </div>
  );
}

function UserPicker({
  picked,
  onPick,
}: {
  picked: Picked | null;
  onPick: (v: Picked | null) => void;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Me[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 1) {
      setResults([]);
      setSearching(false);
      return;
    }
    let alive = true;
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await api<Paginated<Me>>('/mod/users', {
          params: { q: query, per_page: 8 },
        });
        if (alive) setResults(res.items);
      } catch {
        if (alive) setResults([]);
      }
      if (alive) setSearching(false);
    }, 300);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [q]);

  if (picked) return <SelectedChip label={`@${picked.name}`} onClear={() => onPick(null)} />;

  return (
    <div className={styles.picker}>
      <input
        className="input"
        type="search"
        placeholder={'Поиск по нику…'}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label={'Поиск по нику'}
      />
      {searching ? (
        <div className={styles.searching}>
          <Spinner size={16} inline />
        </div>
      ) : null}
      {results.length > 0 ? (
        <div className={styles.results}>
          {results.map((u) => (
            <button
              key={u.id}
              type="button"
              className={styles.resultBtn}
              onClick={() => onPick({ id: u.id, name: u.username })}
            >
              <span className={styles.resultName}>{u.username}</span>
              <span className={styles.resultSub}>{u.email}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SuggestPicker({
  kind,
  picked,
  onPick,
}: {
  kind: 'narrator' | 'title';
  picked: Picked | null;
  onPick: (v: Picked | null) => void;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<{ id: number; name: string; sub: string }[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    let alive = true;
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await api<SearchSuggest>('/search/suggest', { params: { q: query } });
        if (alive) {
          setResults(
            kind === 'narrator'
              ? res.narrators.map((n) => ({ id: n.id, name: n.name, sub: 'narrator' }))
              : res.titles.map((tt) => ({ id: tt.id, name: tt.name, sub: tt.author?.name ?? '' }))
          );
        }
      } catch {
        if (alive) setResults([]);
      }
      if (alive) setSearching(false);
    }, 300);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [q, kind]);

  if (picked) return <SelectedChip label={picked.name} onClear={() => onPick(null)} />;

  return (
    <div className={styles.picker}>
      <input
        className="input"
        type="search"
        placeholder={kind === 'narrator' ? 'Поиск чтецов…' : 'Поиск тайтлов…'}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label={kind === 'narrator' ? 'Поиск чтецов' : 'Поиск тайтлов'}
      />
      {searching ? (
        <div className={styles.searching}>
          <Spinner size={16} inline />
        </div>
      ) : null}
      {results.length > 0 ? (
        <div className={styles.results}>
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              className={styles.resultBtn}
              onClick={() => onPick({ id: r.id, name: r.name })}
            >
              <span className={styles.resultName}>{r.name}</span>
              {r.sub ? (
                <span className={styles.resultSub}>
                  {kind === 'narrator' ? 'чтец' : r.sub}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function BroadcastContent() {
  const { toast } = useToast();
  const { user } = useAuth();
  // A site-wide send is admin-only; moderators may only target a specific user
  // or the subscribers of one narrator/title.
  const isAdmin = user?.role === 'admin';
  const audiences = isAdmin ? AUDIENCES : AUDIENCES.filter((a) => a.key !== 'all');
  const [audience, setAudience] = useState<Audience>(isAdmin ? 'all' : 'user');
  const [pickedUser, setPickedUser] = useState<Picked | null>(null);
  const [pickedNarrator, setPickedNarrator] = useState<Picked | null>(null);
  const [pickedTitle, setPickedTitle] = useState<Picked | null>(null);
  const [body, setBody] = useState('');
  const [link, setLink] = useState('');
  const [sending, setSending] = useState(false);

  const targetPicked =
    audience === 'all' ||
    (audience === 'user' && !!pickedUser) ||
    (audience === 'narrator_subs' && !!pickedNarrator) ||
    (audience === 'title_followers' && !!pickedTitle);

  const audienceDesc = (() => {
    switch (audience) {
      case 'all':
        return 'всем пользователям';
      case 'user':
        return pickedUser ? `@${pickedUser.name}` : 'выбранному пользователю';
      case 'narrator_subs':
        return pickedNarrator
          ? `подписчикам чтеца „${pickedNarrator.name}"`
          : 'подписчикам выбранного чтеца';
      case 'title_followers':
        return pickedTitle
          ? `подписчикам тайтла „${pickedTitle.name}"`
          : 'подписчикам выбранного тайтла';
    }
  })();

  const send = async () => {
    if (!body.trim()) {
      toast('Сначала напишите текст уведомления', 'error');
      return;
    }
    if (!targetPicked) {
      toast('Выберите цель для этой аудитории', 'error');
      return;
    }
    setSending(true);
    try {
      const payload: Record<string, unknown> = { audience, body: body.trim() };
      if (link.trim()) payload.link = link.trim();
      if (audience === 'user' && pickedUser) payload.user_id = pickedUser.id;
      if (audience === 'narrator_subs' && pickedNarrator)
        payload.narrator_id = pickedNarrator.id;
      if (audience === 'title_followers' && pickedTitle) payload.title_id = pickedTitle.id;
      const res = await api<{ sent: number }>('/mod/notifications', {
        method: 'POST',
        body: payload,
      });
      toast(`Отправлено пользователям: ${res.sent}`);
      setBody('');
      setLink('');
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setSending(false);
  };

  return (
    <div className={`glass-panel ${styles.panel}`}>
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{'Аудитория'}</legend>
        <div className={styles.radios}>
          {audiences.map((a) => (
            <label
              key={a.key}
              className={
                audience === a.key ? `${styles.radio} ${styles.radioActive}` : styles.radio
              }
            >
              <input
                type="radio"
                name="audience"
                value={a.key}
                checked={audience === a.key}
                onChange={() => setAudience(a.key)}
              />
              <span className={styles.radioText}>
                <span className={styles.radioName}>{a.name}</span>
                <span className={styles.radioDesc}>{a.desc}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {audience === 'user' ? (
        <div className={styles.pickerBlock}>
          <span className={styles.blockLabel}>{'Получатель'}</span>
          <UserPicker picked={pickedUser} onPick={setPickedUser} />
        </div>
      ) : null}
      {audience === 'narrator_subs' ? (
        <div className={styles.pickerBlock}>
          <span className={styles.blockLabel}>{'Чтец'}</span>
          <SuggestPicker kind="narrator" picked={pickedNarrator} onPick={setPickedNarrator} />
        </div>
      ) : null}
      {audience === 'title_followers' ? (
        <div className={styles.pickerBlock}>
          <span className={styles.blockLabel}>{'Название'}</span>
          <SuggestPicker kind="title" picked={pickedTitle} onPick={setPickedTitle} />
        </div>
      ) : null}

      <div className={styles.pickerBlock}>
        <span className={styles.blockLabel}>{'Сообщение'}</span>
        <textarea
          className="textarea"
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={'Что вы хотите им сказать?'}
          maxLength={2000}
        />
      </div>

      <div className={styles.pickerBlock}>
        <span className={styles.blockLabel}>{'Ссылка (необязательно)'}</span>
        <input
          className="input"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="/title/some-slug"
        />
      </div>

      <p className={styles.preview}>
        <Radio size={14} aria-hidden="true" />
        {`Будет отправлено системным уведомлением ${audienceDesc ?? ''}.`}
      </p>

      <div className={styles.sendRow}>
        <button
          type="button"
          className="btn btn-primary"
          disabled={sending || !body.trim() || !targetPicked}
          onClick={send}
        >
          <Send size={14} /> {sending ? 'Отправка…' : 'Отправить рассылку'}
        </button>
      </div>
    </div>
  );
}

export default function ModBroadcastPage() {
  const h = splitHeading('Системная рассылка');
  return (
    <ModShell title={h.title} accent={h.accent}>
      <BroadcastContent />
    </ModShell>
  );
}
