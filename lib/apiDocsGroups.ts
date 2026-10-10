/**
 * The public API surface documented at /dev — single source of truth
 * shared with the generated OpenAPI spec (/openapi.json) so the two can never
 * drift apart. Every endpoint here is a public, unauthenticated GET.
 */

export type Param = { name: string; desc: string };
export type Endpoint = {
  path: string;
  desc: string;
  params?: Param[];
  note?: string;
};
export type Group = { title: string; endpoints: Endpoint[] };

export const PAGING: Param[] = [
  { name: 'page', desc: 'Номер страницы, с 1. По умолчанию 1.' },
  { name: 'per_page', desc: 'Размер страницы. По умолчанию 24, максимум 100.' },
];

export const API_DOCS_GROUPS: Group[] = [
  {
    title: 'Сервис',
    endpoints: [
      {
        path: '/home',
        desc: 'Содержимое главной: объявления, новые тайтлы (new_titles), баннеры (banners) и каталог (catalog).',
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
          { name: 'q', desc: 'Поиск по названию, альтернативным названиям и имени автора.' },
          { name: 'genre', desc: 'Слаг тега, например fantasy. Можно перечислить через запятую — тогда тайтл должен иметь все теги.' },
          { name: 'author', desc: 'Имя автора целиком, без учёта регистра.' },
          { name: 'year_from', desc: 'Год выпуска от, целое число.' },
          { name: 'year_to', desc: 'Год выпуска до, целое число.' },
          {
            name: 'release_status',
            desc: 'ongoing | completed | abandoned | frozen.',
          },
          { name: 'country', desc: 'china | korea | japan | other.' },
          { name: 'min_rating', desc: 'Минимальная средняя оценка, 0–10.' },
          { name: 'finished', desc: '1 — только завершённые и полностью озвученные.' },
          { name: 'hide_ai', desc: '1 — скрыть тайтлы с синтезированной озвучкой.' },
          {
            name: 'sort',
            desc: 'popular (по умолчанию) | rating | new | updated | az | chapters.',
          },
          { name: 'order', desc: 'desc (по умолчанию) | asc — обратный порядок сортировки.' },
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
        desc: 'Быстрые подсказки для строки поиска: тайтлы, чтецы, авторы и подборки.',
        params: [{ name: 'q', desc: 'Запрос, минимум 2 символа. Короче — пустой результат.' }],
        note: 'Кроме локальных результатов может вернуть external — книги источника, для которых можно заказать озвучку.',
      },
      {
        path: '/genres',
        desc: 'Список тегов со счётчиком тайтлов.',
        params: [
          { name: 'q', desc: 'Поиск по названию.' },
          { name: 'page', desc: 'Номер страницы, с 1. По умолчанию 1.' },
          { name: 'per_page', desc: 'Размер страницы. По умолчанию 24, максимум 2000 — весь список за один запрос.' },
        ],
      },
    ],
  },
  {
    title: 'Главы и файлы',
    endpoints: [
      {
        path: '/chapters/{id}',
        desc: 'Данные для воспроизведения одной главы: audio_url, длительность, том, соседние главы.',
        note: '404, пока глава не одобрена и её аудио не готово. Для тайтлов 18+ и с чувствительными тегами — 401: такие главы слушают только на сайте после входа.',
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
      { path: '/authors/{id}', desc: 'Страница автора и его тайтлы.', note: 'Вместо id принимается слаг.' },
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
      { path: '/users/{id}', desc: 'Публичный профиль. Вместо id во всех адресах профиля принимается имя пользователя.' },
      {
        path: '/users/{id}/library',
        desc: 'Библиотека пользователя.',
        params: [{ name: 'status', desc: 'planning | in_progress | completed | dropped.' }, ...PAGING],
      },
      { path: '/users/{id}/favorites', desc: 'Избранное пользователя.', params: PAGING },
      { path: '/users/{id}/comments', desc: 'Комментарии пользователя.', params: PAGING },
    ],
  },
];
