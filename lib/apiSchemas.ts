/**
 * OpenAPI response schemas for the endpoints in apiDocsGroups.ts, as an
 * anonymous caller sees them. Account-specific fields (my_*, can_*, …) are
 * deliberately left out.
 */

type Schema = Record<string, unknown>;

const str: Schema = { type: 'string' };
const int: Schema = { type: 'integer' };
const num: Schema = { type: 'number' };
const bool: Schema = { type: 'boolean' };
const ts: Schema = { type: 'integer', description: 'Unix-время, секунды.' };
const url: Schema = { type: 'string', format: 'uri', nullable: true };
const n = (s: Schema): Schema => ({ ...s, nullable: true });
const arr = (items: Schema): Schema => ({ type: 'array', items });
const ref = (name: string): Schema => ({ $ref: `#/components/schemas/${name}` });
const obj = (properties: Record<string, Schema>): Schema => ({ type: 'object', properties });
const enumOf = (...values: string[]): Schema => ({ type: 'string', enum: values });

export const paged = (item: Schema): Schema =>
  obj({ items: arr(item), page: int, per_page: int, total: int });

const ratingDistribution: Schema = {
  type: 'object',
  description: 'Число оценок по каждому баллу, ключи "1".."10".',
  additionalProperties: int,
};

export const SCHEMAS: Record<string, Schema> = {
  Error: obj({ error: str }),
  AuthorBrief: obj({ id: int, slug: str, name: str }),
  Genre: obj({ id: int, slug: str, name: str, is_sensitive: bool }),
  GenreCount: obj({ id: int, slug: str, name: str, titles_count: int, is_sensitive: bool }),
  TitleCard: obj({
    id: int,
    slug: str,
    name: str,
    author: n(ref('AuthorBrief')),
    year: n(int),
    cover_url: url,
    cover_thumb_url: url,
    release_status: enumOf('ongoing', 'completed', 'abandoned', 'frozen'),
    country: enumOf('china', 'korea', 'japan', 'other'),
    avg_rating: n(num),
    rating_count: int,
    listens: int,
    updated_at: ts,
    chapters_count: int,
    genres: arr(ref('Genre')),
    is_nsfw: bool,
    is_ai: bool,
    has_sensitive_genre: bool,
  }),
  NarratorCard: obj({
    id: int,
    slug: str,
    name: str,
    avatar_url: url,
    titles_count: int,
    is_ai: bool,
    is_verified: bool,
  }),
  ChapterRow: obj({
    id: int,
    volume_id: int,
    number: num,
    number_end: n(num),
    name: str,
    duration_seconds: num,
    audio_status: str,
    narrators: arr(obj({ id: int, slug: str, name: str })),
  }),
  Volume: obj({
    id: int,
    number: num,
    name: str,
    cover_url: url,
    cover_thumb_url: url,
    chapters: arr(ref('ChapterRow')),
  }),
  TitleVersion: obj({
    id: int,
    name: str,
    sort: int,
    standalone_volume_ids: arr(int),
  }),
  TitleFull: {
    allOf: [
      ref('TitleCard'),
      obj({
        alt_names: arr(str),
        description: { type: 'string', description: 'Markdown.' },
        bg_url: url,
        views_count: int,
        translator: str,
        created_at: ts,
        favorites_count: int,
        volume_label: { type: 'string', description: 'Слово вместо «Том», например «Арка».' },
        volume_label_plural: str,
        rating_distribution: ratingDistribution,
        narrators: arr({ allOf: [ref('NarratorCard'), obj({ narration_status: str })] }),
        similar: arr(ref('TitleCard')),
        volumes: arr(ref('Volume')),
        version_name: { type: 'string', description: 'Название основной версии озвучки.' },
        versions: arr(ref('TitleVersion')),
        alt_chapters: {
          type: 'object',
          description: 'Главы альтернативных версий озвучки по id версии.',
          additionalProperties: arr(ref('ChapterRow')),
        },
        comments: paged(ref('Comment')),
      }),
    ],
  },
  ChapterPlay: obj({
    id: int,
    number: num,
    number_end: n(num),
    name: str,
    duration_seconds: num,
    audio_url: { type: 'string', format: 'uri', description: 'Аудио (Opus) с поддержкой Range.' },
    volume: obj({ id: int, number: num, name: str, cover_url: url, cover_thumb_url: url }),
    title: obj({ id: int, slug: str, name: str, cover_url: url, volume_label: str }),
    prev_id: n(int),
    next_id: n(int),
    narrator: n(obj({ id: int, slug: str, name: str })),
  }),
  NarratorFull: {
    allOf: [
      ref('NarratorCard'),
      obj({
        bio: { type: 'string', description: 'Markdown.' },
        socials: arr(str),
        cover_url: url,
        created_at: ts,
        titles: arr(ref('TitleCard')),
        subscribers_count: int,
        seconds_narrated: int,
        comments: paged(ref('Comment')),
      }),
    ],
  },
  PollOption: obj({ id: int, text: str, percent: n(num) }),
  Poll: obj({
    id: int,
    title: str,
    options: arr(ref('PollOption')),
    total_votes: n(int),
    closes_at: n(ts),
    closed_at: n(ts),
    is_closed: bool,
  }),
  NarratorPost: obj({
    id: int,
    narrator: n(obj({ id: int, slug: str, name: str, avatar_url: url })),
    title: str,
    body: { type: 'string', description: 'Markdown.' },
    created_at: ts,
    updated_at: n(ts),
    poll: n(ref('Poll')),
    comments_count: { type: 'integer', description: 'Только в списке постов.' },
  }),
  AuthorCard: obj({ id: int, slug: str, name: str, titles_count: int }),
  AuthorFull: obj({
    id: int,
    slug: str,
    name: str,
    bio: str,
    links: arr(str),
    titles: arr(ref('TitleCard')),
    titles_count: int,
    created_at: ts,
  }),
  UserBrief: obj({
    id: int,
    username: str,
    display_name: str,
    avatar_url: url,
    role: str,
  }),
  CollectionCard: obj({
    id: int,
    name: str,
    description: str,
    user: ref('UserBrief'),
    items_count: int,
    likes_count: int,
    cover_urls: arr(str),
    created_at: ts,
    updated_at: ts,
  }),
  CollectionFull: {
    allOf: [
      ref('CollectionCard'),
      obj({ items: arr(obj({ position: int, note: str, title: ref('TitleCard') })) }),
    ],
  },
  Announcement: obj({
    id: int,
    slug: str,
    title: str,
    body: { type: 'string', description: 'Markdown.' },
    author: n(obj({ id: int, username: str })),
    created_at: ts,
    poll: n(ref('Poll')),
  }),
  AnnouncementFull: {
    allOf: [ref('Announcement'), obj({ comments: paged(ref('Comment')) })],
  },
  Comment: obj({
    id: int,
    user: n(ref('UserBrief')),
    narrator: n(obj({ id: int, slug: str, name: str, avatar_url: url, is_verified: bool })),
    target_type: enumOf('title', 'narrator', 'post', 'announcement'),
    target_id: int,
    parent_id: n(int),
    body: str,
    score: int,
    is_deleted: bool,
    created_at: ts,
    updated_at: n(ts),
  }),
  UserComment: {
    allOf: [ref('Comment'), obj({ target: obj({ type: str, id: int, name: str, link: str }) })],
  },
  UserProfile: obj({
    user: obj({
      id: int,
      username: str,
      display_name: str,
      bio: str,
      socials: arr(str),
      avatar_url: url,
      cover_url: url,
      role: str,
      role_name: str,
      created_at: ts,
    }),
    stats: obj({
      planning: int,
      in_progress: int,
      completed: int,
      dropped: int,
      comments: int,
      favorites: int,
      seconds_listened: int,
    }),
  }),
  LibraryItem: obj({
    title: ref('TitleCard'),
    status: enumOf('planning', 'in_progress', 'completed', 'dropped'),
    rating: n(int),
    is_favorite: bool,
    updated_at: ts,
  }),
};

/** 200-response schema per documented path. */
export const RESPONSES: Record<string, Schema> = {
  '/home': obj({
    announcements: arr(ref('Announcement')),
    new_titles: arr(ref('TitleCard')),
    banners: arr(obj({})),
    catalog: obj({ items: arr(ref('TitleCard')), total: int }),
  }),
  '/titles': paged(ref('TitleCard')),
  '/titles/{slug}': ref('TitleFull'),
  '/titles/random': obj({ slug: str }),
  '/search/suggest': obj({
    titles: arr(obj({ id: int, slug: str, name: str, author: n(ref('AuthorBrief')), cover_url: url, cover_thumb_url: url })),
    narrators: arr(obj({ id: int, slug: str, name: str, avatar_url: url })),
    authors: arr(ref('AuthorCard')),
    collections: arr(obj({ id: int, name: str, items_count: int })),
    external: arr(obj({ ref: str, name: str, cover_url: url, year: n(int), status: str })),
  }),
  '/genres': paged(ref('GenreCount')),
  '/chapters/{id}': ref('ChapterPlay'),
  '/narrators': paged(ref('NarratorCard')),
  '/narrators/{slug}': ref('NarratorFull'),
  '/narrators/{id}/posts': paged(ref('NarratorPost')),
  '/posts/{id}': { allOf: [ref('NarratorPost'), obj({ comments: paged(ref('Comment')) })] },
  '/authors': paged(ref('AuthorCard')),
  '/authors/{id}': ref('AuthorFull'),
  '/collections': paged(ref('CollectionCard')),
  '/collections/{id}': ref('CollectionFull'),
  '/announcements': paged(ref('Announcement')),
  '/announcements/{slug}': ref('AnnouncementFull'),
  '/comments': paged(ref('Comment')),
  '/users/{id}': ref('UserProfile'),
  '/users/{id}/library': paged(ref('LibraryItem')),
  '/users/{id}/favorites': paged(ref('TitleCard')),
  '/users/{id}/comments': paged(ref('UserComment')),
};
