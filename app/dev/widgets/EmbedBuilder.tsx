'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import JsonBlock from '@/components/JsonBlock/JsonBlock';
import Toggle from '@/components/Toggle/Toggle';
import { ruPlural } from '@/lib/format';
import type { NarratorCard, Paginated, SearchSuggest, TitleCard, TitleFull } from '@/lib/types';
import styles from '../page.module.css';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api';
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://audioranobe.com').replace(/\/$/, '');

type Kind = 'volume' | 'narrator' | 'collection';
type Pick = { id: number; name: string; image: string | null };
type CollectionCard = { id: number; name: string; items_count: number; cover_urls: string[] };

const KINDS: { kind: Kind; label: string; height: number; field: string; about: string }[] = [
  {
    kind: 'volume',
    label: 'Плеер тома',
    height: 460,
    field: 'Тайтл',
    about: 'Плеер одного тома: видны все главы, слушать можно первые 9 — дальше слушатель переходит на AudioRanobe.',
  },
  {
    kind: 'narrator',
    label: 'Чтец',
    height: 200,
    field: 'Чтец',
    about: 'Карточка чтеца: аватар, имя и статистика — тайтлы, подписчики и часы озвучки.',
  },
  {
    kind: 'collection',
    label: 'Подборка',
    height: 460,
    field: 'Подборка',
    about: 'Подборка целиком: название, автор и список тайтлов со ссылками на сайт.',
  },
];

const getJson = <T,>(path: string): Promise<T> =>
  fetch(`${API_BASE}${path}`, { credentials: 'omit' }).then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.json() as Promise<T>;
  });

const random = <T,>(xs: T[]): T | undefined => xs[Math.floor(Math.random() * xs.length)];

export default function EmbedBuilder() {
  const [kind, setKind] = useState<Kind>('volume');
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<(Pick & { sub: string })[]>([]);
  const [title, setTitle] = useState<TitleFull | null>(null);
  const [version, setVersion] = useState(0);
  const [volumeId, setVolumeId] = useState(0);
  const [narrator, setNarrator] = useState<Pick | null>(null);
  const [collection, setCollection] = useState<Pick | null>(null);
  const [failed, setFailed] = useState(false);
  const [light, setLight] = useState(false);

  const meta = KINDS.find((k) => k.kind === kind)!;

  const pickTitle = async (id: number) => {
    setFailed(false);
    try {
      const t = await getJson<TitleFull>(`/titles/${id}`);
      setTitle(t);
      setVersion(0);
      setVolumeId((t.volumes.find((v) => v.chapters.length > 0) ?? t.volumes[0])?.id ?? 0);
    } catch {
      setFailed(true);
    }
  };

  const choose = (h: Pick) => {
    setQuery('');
    setHits([]);
    if (kind === 'volume') void pickTitle(h.id);
    else if (kind === 'narrator') setNarrator(h);
    else setCollection(h);
  };

  // ponytail: defaults are a random pick among the first 100 non-empty entries of each list.
  useEffect(() => {
    if (kind === 'volume' && !title) {
      getJson<Paginated<TitleCard>>('/titles?per_page=100')
        .then((d) => {
          const t = random(d.items.filter((x) => x.chapters_count > 0));
          if (t) void pickTitle(t.id);
        })
        .catch(() => setFailed(true));
    } else if (kind === 'narrator' && !narrator) {
      getJson<Paginated<NarratorCard>>('/narrators?per_page=100')
        .then((d) => {
          const n = random(d.items.filter((x) => x.titles_count > 0));
          if (n) setNarrator({ id: n.id, name: n.name, image: n.avatar_thumb_url ?? n.avatar_url });
        })
        .catch(() => setFailed(true));
    } else if (kind === 'collection' && !collection) {
      getJson<Paginated<CollectionCard>>('/collections?sort=popular&per_page=100')
        .then((d) => {
          const c = random(d.items.filter((x) => x.items_count > 0));
          if (c) setCollection({ id: c.id, name: c.name, image: c.cover_urls[0] ?? null });
        })
        .catch(() => setFailed(true));
    }
  }, [kind]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`${API_BASE}/search/suggest?q=${encodeURIComponent(q)}`, { credentials: 'omit', signal: ctrl.signal })
        .then((r) => r.json())
        .then((d: SearchSuggest) => {
          if (kind === 'volume') {
            setHits(
              (d.titles ?? []).map((h) => ({
                id: h.id,
                name: h.name,
                image: h.cover_thumb_url ?? h.cover_url,
                sub: `#${h.id}${h.author ? ` · ${h.author.name}` : ''}`,
              }))
            );
          } else if (kind === 'narrator') {
            setHits((d.narrators ?? []).map((h) => ({ id: h.id, name: h.name, image: h.avatar_url, sub: `#${h.id}` })));
          } else {
            setHits(
              (d.collections ?? []).map((h) => ({ id: h.id, name: h.name, image: null, sub: `#${h.id} · ${h.items_count} ${ruPlural(h.items_count, ['тайтл', 'тайтла', 'тайтлов'])}` }))
            );
          }
        })
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, kind]);

  const current: Pick | null =
    kind === 'volume'
      ? title && { id: title.id, name: title.name, image: title.cover_thumb_url }
      : kind === 'narrator'
        ? narrator
        : collection;

  const theme = light ? '&theme=light' : '';
  let src: string | null = null;
  if (kind === 'volume' && title && volumeId) {
    src = `${SITE}/embed?title=${title.id}&volume=${volumeId}${version ? `&version=${version}` : ''}${theme}`;
  } else if (kind !== 'volume' && current) {
    src = `${SITE}/embed?type=${kind}&id=${current.id}${theme}`;
  }
  const code = src
    ? [
        '<iframe',
        `  src="${src}"`,
        '  width="100%"',
        `  height="${meta.height}"`,
        '  style="border:0;max-width:640px"',
        '  loading="lazy"',
        `  title="${current!.name.replace(/"/g, '&quot;')} — AudioRanobe"`,
        '></iframe>',
      ].join('\n')
    : '';

  return (
    <section className={`glass-panel ${styles.embed}`}>
      <div className={styles.typeSwitch} role="tablist" aria-label={'Тип виджета'}>
        {KINDS.map((k) => (
          <button
            key={k.kind}
            type="button"
            role="tab"
            aria-selected={kind === k.kind}
            className={kind === k.kind ? `${styles.typeBtn} ${styles.typeBtnActive}` : styles.typeBtn}
            onClick={() => {
              setKind(k.kind);
              setQuery('');
              setFailed(false);
            }}
          >
            {k.label}
          </button>
        ))}
      </div>
      <p className={`${styles.noteTop} ${styles.panelGap}`}>{meta.about}</p>

      <div className={styles.embedGrid}>
        <div className={styles.embedSettings}>
          <div className={styles.embedField}>
            <span className={styles.fieldName}>{meta.field}</span>
            <div className={styles.search}>
              <Search size={14} className={styles.searchIcon} />
              <input
                className={`${styles.fieldInput} ${styles.searchInput}`}
                value={query}
                placeholder={current ? `#${current.id} · ${current.name}` : 'Поиск…'}
                spellCheck={false}
                autoComplete="off"
                aria-label={`Поиск: ${meta.field}`}
                onChange={(e) => setQuery(e.target.value)}
              />
              {hits.length > 0 ? (
                <ul className={styles.hits}>
                  {hits.map((h) => (
                    <li key={h.id}>
                      <button type="button" className={styles.hit} onClick={() => choose(h)}>
                        {h.image ? <img src={h.image} alt="" className={styles.hitCover} /> : null}
                        <span className={styles.hitText}>
                          <span className={styles.hitName}>{h.name}</span>
                          <span className={styles.hitAuthor}>{h.sub}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>

          {kind === 'volume' ? (
            <>
              <label className={styles.embedField}>
                <span className={styles.fieldName}>{'Озвучка'}</span>
                <select
                  className={styles.fieldInput}
                  value={version}
                  disabled={!title || title.versions.length === 0}
                  onChange={(e) => setVersion(Number(e.target.value))}
                >
                  <option value={0}>{title?.version_name ?? 'Основная'}</option>
                  {title?.versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.embedField}>
                <span className={styles.fieldName}>{title?.volume_label ?? 'Том'}</span>
                <select
                  className={styles.fieldInput}
                  value={volumeId}
                  disabled={!title || title.volumes.length === 0}
                  onChange={(e) => setVolumeId(Number(e.target.value))}
                >
                  {title?.volumes.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name || `${title.volume_label} ${v.number}`}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}

          <Toggle checked={light} onChange={setLight} label={'Светлая тема'} />

          {failed ? <p className={styles.statusErr}>{'Не удалось загрузить данные.'}</p> : null}
          {kind === 'volume' && title && (title.is_nsfw || title.has_sensitive_genre) ? (
            <p className={styles.epNote}>
              {'Тайтл 18+ или с чувствительным тегом: без входа его не слушают, поэтому в виджете главы ведут на сайт.'}
            </p>
          ) : null}
          {kind === 'volume' && title && title.volumes.length === 0 ? (
            <p className={styles.note}>{'У тайтла пока нет томов.'}</p>
          ) : null}

          {src ? <JsonBlock code={code} /> : null}
        </div>

        <div className={`${styles.previewBox} ${light ? styles.previewLight : ''}`} style={{ height: meta.height }}>
          {src ? <iframe key={src} src={src} title={'Предпросмотр виджета'} className={styles.preview} /> : null}
        </div>
      </div>
    </section>
  );
}
