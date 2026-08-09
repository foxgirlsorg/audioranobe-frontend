'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, ChevronRight, Copy } from 'lucide-react';
import JsonBlock from '@/components/JsonBlock/JsonBlock';
import { SAMPLES, SAMPLE_PATH, SAMPLE_QUERY } from './samples';
import { useResolveAuth } from '@/lib/useResolveAuth';
import styles from './page.module.css';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api';

type Param = { name: string; desc: string };
type Endpoint = {
  path: string;
  desc: string;
  params?: Param[];
  note?: string;
};
type Group = { title: string; endpoints: Endpoint[] };

const PAGING: Param[] = [
  { name: 'page', desc: 'Номер страницы, с 1. По умолчанию 1.' },
  { name: 'per_page', desc: 'Размер страницы. По умолчанию 24, максимум 100.' },
];

const GROUPS: Group[] = [
  {
    title: 'Сервис',
    endpoints: [
      {
        path: '/home',
        desc: 'Содержимое главной: объявления и подборки тайтлов (new_titles, popular, top_rated, recently_updated).',
      },
    ],
  },
  {
    title: 'Тайтлы',
    endpoints: [
      {
        path: '/titles',
        desc: 'Каталог.',
        params: [
          { name: 'q', desc: 'Поиск по названию тайтла и имени автора.' },
          { name: 'genre', desc: 'Слаг тега, например fantasy. Можно перечислить через запятую.' },
          { name: 'author', desc: 'Имя автора целиком, без учёта регистра.' },
          { name: 'year_from, year_to', desc: 'Год выпуска, целое число.' },
          {
            name: 'release_status',
            desc: 'ongoing | completed | abandoned | frozen.',
          },
          { name: 'min_rating', desc: 'Минимальная средняя оценка.' },
          {
            name: 'sort',
            desc: 'popular (по умолчанию) | rating | new | updated | az.',
          },
          ...PAGING,
        ],
      },
      {
        path: '/titles/{slug}',
        desc: 'Карточка тайтла целиком: описание, теги, чтецы, тома с главами, похожие тайтлы.',
        note: 'Вместо слага можно передать числовой id — это поддерживается намеренно.',
      },
      { path: '/titles/random', desc: 'Слаг случайного тайтла.' },
      {
        path: '/search/suggest',
        desc: 'Быстрые подсказки для строки поиска: до 5 тайтлов и 3 чтецов.',
        params: [{ name: 'q', desc: 'Запрос, минимум 2 символа. Короче — пустой результат.' }],
      },
      { path: '/genres', desc: 'Список тегов со счётчиком тайтлов.', params: [{ name: 'q', desc: 'Поиск по названию.' }, ...PAGING] },
    ],
  },
  {
    title: 'Главы и файлы',
    endpoints: [
      {
        path: '/chapters/{id}',
        desc: 'Данные для воспроизведения одной главы: audio_url, длительность, том, соседние главы.',
        note: '404, пока глава не одобрена и её аудио не готово.',
      },
      {
        path: '/download/chapters/{id}',
        desc: 'Сам аудиофайл (Opus) с заголовком Content-Disposition. Обычная ссылка для скачивания, авторизация не требуется.',
      },
    ],
  },
  {
    title: 'Чтецы и авторы',
    endpoints: [
      {
        path: '/narrators',
        desc: 'Список чтецов.',
        params: [{ name: 'q', desc: 'Поиск по имени.' }, ...PAGING],
      },
      {
        path: '/narrators/{slug}',
        desc: 'Страница чтеца: описание, ссылки, тайтлы.',
        note: 'Вместо слага принимается числовой id.',
      },
      {
        path: '/narrators/{id}/posts',
        desc: 'Посты чтеца.',
        params: PAGING,
      },
      { path: '/posts/{id}', desc: 'Один пост чтеца.' },
      {
        path: '/authors',
        desc: 'Список авторов.',
        params: [{ name: 'q', desc: 'Поиск по имени.' }, ...PAGING],
      },
      { path: '/authors/{id}', desc: 'Страница автора и его тайтлы.' },
    ],
  },
  {
    title: 'Подборки, объявления, комментарии',
    endpoints: [
      {
        path: '/collections',
        desc: 'Публичные подборки пользователей.',
        params: [
          { name: 'q', desc: 'Поиск по названию.' },
          { name: 'user', desc: 'Имя пользователя — вернёт только его публичные подборки.' },
          { name: 'sort', desc: 'new (по умолчанию) | popular.' },
          ...PAGING,
        ],
      },
      { path: '/collections/{id}', desc: 'Одна подборка с её тайтлами.' },
      { path: '/announcements', desc: 'Опубликованные новости.', params: PAGING },
      { path: '/announcements/{slug}', desc: 'Одна новость.' },
      {
        path: '/comments',
        desc: 'Комментарии к объекту, ответы вложены в родителя.',
        params: [
          { name: 'target_type', desc: 'Обязательный: title | narrator | post | announcement.' },
          { name: 'target_id', desc: 'Обязательный: id объекта.' },
          { name: 'sort', desc: 'new (по умолчанию) | old | top.' },
          ...PAGING,
        ],
      },
    ],
  },
  {
    title: 'Профили',
    endpoints: [
      { path: '/users/{id}', desc: 'Публичный профиль. Вместо id принимается имя пользователя.' },
      { path: '/users/{id}/library', desc: 'Библиотека пользователя.', params: PAGING },
      { path: '/users/{id}/favorites', desc: 'Избранное пользователя.', params: PAGING },
      { path: '/users/{id}/comments', desc: 'Комментарии пользователя.', params: PAGING },
    ],
  },

];

function urlFor(path: string): string {
  const concrete = SAMPLE_PATH[path] ?? path;
  return `${API_BASE}${concrete}${SAMPLE_QUERY[path] ?? ''}`;
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={styles.copy}
      aria-label={'Скопировать'}
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        });
      }}
    >
      {done ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

export default function ApiDocsPage() {
  useResolveAuth();
  return (
    <div className={styles.wrap}>
      <span className="eyebrow">{'Для разработчиков'}</span>
      <h1 className={styles.title}>
        {'документация'} <span className={styles.titleAccent}>{'API'}</span>
      </h1>


      <section className={`glass-panel ${styles.panel}`}>
        <h2 className={styles.panelTitle}>{'Базовый адрес'}</h2>
        <div className={styles.codeRow}>
          <code className={styles.code}>{API_BASE}</code>
          <CopyButton text={API_BASE} />
        </div>
        <p className={styles.note}>
          {'Ответы — JSON в UTF-8; ошибки приходят как {"error": "текст"} с соответствующим HTTP-статусом.'}
        </p>
        <p className={styles.note}>
          {'Все эндпоинты ниже — публичные GET: авторизация не нужна, запросы можно слать с любого домена.'}
        </p>

        <h2 className={styles.panelTitle}>{'Пример запроса'}</h2>
        <div className={styles.codeRow}>
          <code className={styles.code}>{`${API_BASE}/titles?sort=new&per_page=5`}</code>
          <CopyButton text={`${API_BASE}/titles?sort=new&per_page=5`} />
        </div>
      </section>

      {GROUPS.map((group) => (
        <section key={group.title} className={styles.group}>
          <h2 className={styles.groupTitle}>{group.title}</h2>
          <div className={styles.endpoints}>
            {group.endpoints.map((ep) => (
              <article key={ep.path} className={`glass-panel ${styles.endpoint}`}>
                <div className={styles.epHead}>
                  <span className={styles.method}>{'GET'}</span>
                  <code className={styles.epPath}>{ep.path}</code>
                  <CopyButton text={API_BASE + ep.path} />
                </div>
                <p className={styles.epDesc}>{ep.desc}</p>
                {ep.params ? (
                  <dl className={styles.params}>
                    {ep.params.map((param) => (
                      <div key={param.name} className={styles.param}>
                        <dt className={styles.paramName}>{param.name}</dt>
                        <dd className={styles.paramDesc}>{param.desc}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
                {ep.note ? <p className={styles.epNote}>{ep.note}</p> : null}
                {SAMPLES[ep.path] ? (
                  <details className={styles.sample}>
                    <summary className={styles.sampleToggle}>
                      <ChevronRight size={13} className={styles.sampleChev} />
                      {'Пример ответа'}
                    </summary>
                    <div className={styles.sampleBody}>
                      <div className={styles.codeRow}>
                        <code className={styles.code}>{urlFor(ep.path)}</code>
                        <CopyButton text={urlFor(ep.path)} />
                      </div>
                      <JsonBlock code={SAMPLES[ep.path]} />
                    </div>
                  </details>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ))}

    </div>
  );
}
