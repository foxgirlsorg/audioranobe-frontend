'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import JsonBlock from '@/components/JsonBlock/JsonBlock';
import Toggle from '@/components/Toggle/Toggle';
import type { Paginated, SearchSuggest, TitleCard, TitleFull } from '@/lib/types';
import styles from './page.module.css';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api';
const HEIGHT = 460;
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://audioranobe.com').replace(/\/$/, '');

type Hit = SearchSuggest['titles'][number];

export default function EmbedBuilder() {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [title, setTitle] = useState<TitleFull | null>(null);
  const [version, setVersion] = useState(0);
  const [volumeId, setVolumeId] = useState(0);
  const [failed, setFailed] = useState(false);
  const [light, setLight] = useState(false);

  const pick = async (id: number) => {
    setFailed(false);
    try {
      const res = await fetch(`${API_BASE}/titles/${id}`, { credentials: 'omit' });
      if (!res.ok) throw new Error();
      const t: TitleFull = await res.json();
      setTitle(t);
      setVersion(0);
      setVolumeId((t.volumes.find((v) => v.chapters.length > 0) ?? t.volumes[0])?.id ?? 0);
      setQuery('');
      setHits([]);
    } catch {
      setFailed(true);
    }
  };

  // ponytail: random pick among the 100 most popular titles that have chapters.
  useEffect(() => {
    fetch(`${API_BASE}/titles?per_page=100`, { credentials: 'omit' })
      .then((r) => r.json())
      .then((d: Paginated<TitleCard>) => {
        const voiced = d.items.filter((t) => t.chapters_count > 0);
        if (voiced.length > 0) void pick(voiced[Math.floor(Math.random() * voiced.length)].id);
      })
      .catch(() => setFailed(true));
  }, []);

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
        .then((d: SearchSuggest) => setHits(d.titles ?? []))
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  const src =
    title && volumeId
      ? `${SITE}/embed?title=${title.id}&volume=${volumeId}${version ? `&version=${version}` : ''}${light ? '&theme=light' : ''}`
      : null;
  const code = src
    ? [
        '<iframe',
        `  src="${src}"`,
        '  width="100%"',
        `  height="${HEIGHT}"`,
        '  style="border:0;max-width:640px"',
        '  loading="lazy"',
        `  title="${title!.name.replace(/"/g, '&quot;')} — AudioRanobe"`,
        '></iframe>',
      ].join('\n')
    : '';

  return (
    <section id="embed" className={`glass-panel ${styles.embed}`}>
      <h2 className={styles.panelTitle}>{'Виджет плеера'}</h2>
      <p className={styles.noteTop}>
        {'Встройте плеер одного тома на свой сайт. В виджете видны все главы тома, а слушать можно первые 10 — дальше слушатель переходит на AudioRanobe.'}
      </p>

      <div className={styles.embedGrid}>
        <div className={styles.embedSettings}>
          <div className={styles.embedField}>
            <span className={styles.fieldName}>{'Тайтл'}</span>
            <div className={styles.search}>
              <Search size={14} className={styles.searchIcon} />
              <input
                className={`${styles.fieldInput} ${styles.searchInput}`}
                value={query}
                placeholder={title ? `#${title.id} · ${title.name}` : 'Найдите тайтл…'}
                spellCheck={false}
                autoComplete="off"
                aria-label={'Поиск тайтла'}
                onChange={(e) => setQuery(e.target.value)}
              />
              {hits.length > 0 ? (
                <ul className={styles.hits}>
                  {hits.map((h) => (
                    <li key={h.id}>
                      <button type="button" className={styles.hit} onClick={() => void pick(h.id)}>
                        {h.cover_thumb_url ?? h.cover_url ? (
                          <img src={(h.cover_thumb_url ?? h.cover_url) as string} alt="" className={styles.hitCover} />
                        ) : null}
                        <span className={styles.hitText}>
                          <span className={styles.hitName}>{h.name}</span>
                          <span className={styles.hitAuthor}>{`#${h.id}${h.author ? ` · ${h.author.name}` : ''}`}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>

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

          <Toggle checked={light} onChange={setLight} label={'Светлая тема'} />

          {failed ? <p className={styles.statusErr}>{'Не удалось загрузить тайтл.'}</p> : null}
          {title && (title.is_nsfw || title.has_sensitive_genre) ? (
            <p className={styles.epNote}>
              {'Тайтл 18+ или с чувствительным тегом: без входа его не слушают, поэтому в виджете главы ведут на сайт.'}
            </p>
          ) : null}
          {title && title.volumes.length === 0 ? <p className={styles.note}>{'У тайтла пока нет томов.'}</p> : null}

          {src ? <JsonBlock code={code} /> : null}
        </div>

        <div className={`${styles.previewBox} ${light ? styles.previewLight : ''}`} style={{ height: HEIGHT }}>
          {src ? <iframe key={src} src={src} title={'Предпросмотр виджета'} className={styles.preview} /> : null}
        </div>
      </div>
    </section>
  );
}
