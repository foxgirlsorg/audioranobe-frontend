/**
 * Response samples for the public API reference.
 *
 * Every shape here was captured from a live backend with no Authorization
 * header — field names, types and nulls are what the API actually returns.
 * Values are illustrative and arrays are trimmed to one element, with the
 * remainder marked by an `// …` comment, so the blocks stay readable. That
 * makes the text intentionally not valid JSON; JsonBlock tokenizes rather
 * than parses for exactly this reason.
 */

/** Reused: one TitleCard, as it appears in every paginated title list. */
const TITLE_CARD = `{
      "id": 2,
      "slug": "tet1",
      "name": "Тет 1",
      "author": { "id": 1, "slug": "test", "name": "Автор" },
      "year": 2024,
      "cover_url": "https://cdn.example/covers/t2.jpg",
      "release_status": "ongoing",
      "avg_rating": 8.4,
      "rating_count": 37,
      "listens": 1284,
      "genres": [
        { "id": 1, "slug": "fantasy", "name": "Fantasy", "is_sensitive": false }
      ],
      "is_nsfw": false,
      "has_sensitive_genre": false,
      "is_restricted": false,
      "is_deleted": false
    }`;

const PAGE_TAIL = `  "page": 1,
  "per_page": 24,
  "total": 137
}`;

export const SAMPLES: Record<string, string> = {
  '/config': `{
  "email_verification": false
}`,

  '/home': `{
  "announcements": [
    {
      "id": 1,
      "slug": "release-notes",
      "title": "Обновление каталога",
      "body": "…",
      "author": { "id": 1, "username": "admin" },
      "is_published": true,
      "is_hidden": false,
      "created_at": "2026-07-27 21:48:38.537303+00"
    }
  ],
  "continue": [],
  "new_titles": [
    ${TITLE_CARD.trim()}
  ],
  "popular": [],
  "top_rated": [],
  "recently_updated": []
}`,

  '/titles': `{
  "items": [
    ${TITLE_CARD.trim()}
  ],
${PAGE_TAIL}`,

  '/titles/{slug}': `{
  "id": 2,
  "slug": "tet1",
  "name": "Тет 1",
  "alt_names": ["Tet One"],
  "author": { "id": 1, "slug": "test", "name": "Автор" },
  "description": "Описание тайтла.",
  "year": 2024,
  "cover_url": "https://cdn.example/covers/t2.jpg",
  "bg_url": null,
  "release_status": "ongoing",
  "avg_rating": 8.4,
  "rating_count": 37,
  "rating_distribution": { "1": 0, "2": 1, "8": 12, "10": 9 },
  "listens": 1284,
  "views_count": 5310,
  "favorites_count": 204,
  "genres": [
    { "id": 1, "slug": "fantasy", "name": "Fantasy", "is_sensitive": false }
  ],
  "narrators": [
    {
      "id": 1, "slug": "fwa", "name": "FWA",
      "avatar_url": null, "titles_count": 2,
      "is_deleted": false, "narration_status": "ongoing"
    }
  ],
  "volumes": [
    {
      "id": 1, "number": 1, "name": "Том 1",
      "chapters": [
        {
          "id": 2,
          "volume_id": 1,
          "number": 1,
          "name": "Пролог",
          "duration_seconds": 742.5,
          "audio_status": "ready",
          "mod_status": "approved",
          "my_position": null,
          "narrators": [{ "id": 1, "slug": "fwa", "name": "FWA" }],
          "is_deleted": false
        }
      ]
    }
  ],
  "similar": [],
  "is_nsfw": false,
  "has_sensitive_genre": false,
  "is_restricted": false,
  "is_deleted": false,
  "mod_status": "approved",
  "my_favorite": false,
  "my_rating": null,
  "my_library": null,
  "can_edit": false,
  "created_at": "2026-07-27 21:48:38.537303+00",
  "updated_at": "2026-07-28 10:12:04.221900+00"
}
// my_favorite, my_rating, my_library и my_position без входа всегда null/false.
// У тайтла 18+ audio_status подменяется на "restricted".`,

  '/titles/random': `{
  "slug": "tet1"
}`,

  '/search/suggest': `{
  "titles": [
    {
      "id": 2, "slug": "tet1", "name": "Тет 1",
      "author": { "id": 1, "slug": "test", "name": "Автор" },
      "cover_url": null
    }
  ],
  "narrators": [
    { "id": 2, "slug": "test", "name": "Тест", "avatar_url": null }
  ]
}`,

  '/genres': `{
  "items": [
    { "id": 1, "slug": "fantasy", "name": "Fantasy", "titles_count": 42, "is_sensitive": false }
  ],
${PAGE_TAIL}`,

  '/chapters/{id}': `{
  "id": 3,
  "number": 1,
  "name": "Пролог",
  "duration_seconds": 742.5,
  "audio_url": "https://cdn.example/audio/t2/c3-1753650000.opus",
  "my_position": null,
  "volume": { "id": 1, "number": 1, "name": "Том 1" },
  "title": {
    "id": 2, "slug": "tet1", "name": "Тет 1",
    "cover_url": "https://cdn.example/covers/t2.jpg"
  },
  "prev_id": null,
  "next_id": 4
}`,

  '/download/chapters/{id}': `HTTP/1.1 200 OK
Content-Type: audio/ogg
Content-Length: 2973184
Content-Disposition: attachment; filename="01-prolog.opus"
Access-Control-Expose-Headers: Content-Length, Content-Disposition

// Тело ответа — сам файл, а не JSON.`,

  '/narrators': `{
  "items": [
    {
      "id": 1, "slug": "fwa", "name": "FWA",
      "avatar_url": null, "titles_count": 2, "is_deleted": false
    }
  ],
${PAGE_TAIL}`,

  '/narrators/{slug}': `{
  "id": 1,
  "slug": "fwa",
  "name": "FWA",
  "bio": "Команда озвучки.",
  "avatar_url": null,
  "cover_url": null,
  "socials": ["https://example.com/fwa"],
  "titles_count": 2,
  "titles": [
    ${TITLE_CARD.trim()}
  ],
  "is_self": false,
  "admin_contact": null,
  "mod_status": "approved",
  "is_deleted": false,
  "created_at": "2026-07-27 21:48:38.537303+00"
}
// admin_contact без прав администратора всегда null.`,

  '/narrators/{id}/posts': `{
  "items": [
    {
      "id": 1,
      "narrator": { "id": 1, "slug": "fwa", "name": "FWA", "avatar_url": null },
      "title": "Новая глава",
      "body": "Текст поста в markdown.",
      "is_hidden": false,
      "created_at": "2026-07-27 21:48:38.537303+00",
      "updated_at": "2026-07-27 21:48:38.537303+00"
    }
  ],
${PAGE_TAIL}`,

  '/posts/{id}': `{
  "id": 1,
  "narrator": { "id": 1, "slug": "fwa", "name": "FWA", "avatar_url": null },
  "title": "Новая глава",
  "body": "Текст поста в markdown.",
  "is_hidden": false,
  "created_at": "2026-07-27 21:48:38.537303+00",
  "updated_at": "2026-07-27 21:48:38.537303+00"
}`,

  '/authors': `{
  "items": [
    { "id": 1, "slug": "test", "name": "Автор", "titles_count": 3 }
  ],
${PAGE_TAIL}`,

  '/authors/{id}': `{
  "id": 1,
  "slug": "test",
  "name": "Автор",
  "bio": "",
  "links": [],
  "titles": [
    ${TITLE_CARD.trim()}
  ],
  "created_at": "2026-07-27 21:48:38.537303+00",
  "can_edit": false
}`,

  '/collections': `{
  "items": [
    {
      "id": 1,
      "name": "Любимое фэнтези",
      "description": "Подборка",
      "is_public": true,
      "user": { "id": 1, "username": "admin", "avatar_url": null },
      "items_count": 12,
      "likes_count": 4,
      "cover_urls": ["https://cdn.example/covers/t2.jpg"],
      "created_at": "2026-07-27 21:51:09.866397+00",
      "updated_at": "2026-07-27 21:51:30.262257+00"
    }
  ],
${PAGE_TAIL}`,

  '/collections/{id}': `{
  "id": 1,
  "name": "Любимое фэнтези",
  "description": "Подборка",
  "is_public": true,
  "user": { "id": 1, "username": "admin", "avatar_url": null },
  "items_count": 12,
  "likes_count": 4,
  "cover_urls": [],
  "my_like": false,
  "items": [
    {
      "position": 0,
      "note": "Начать отсюда",
      "title": ${TITLE_CARD.trim()}
    }
  ],
  "created_at": "2026-07-27 21:51:09.866397+00",
  "updated_at": "2026-07-27 21:51:30.262257+00"
}`,

  '/announcements': `{
  "items": [
    {
      "id": 1,
      "slug": "release-notes",
      "title": "Обновление каталога",
      "body": "Текст новости в markdown.",
      "author": { "id": 1, "username": "admin" },
      "is_published": true,
      "is_hidden": false,
      "created_at": "2026-07-27 21:48:38.537303+00"
    }
  ],
${PAGE_TAIL}`,

  '/announcements/{slug}': `{
  "id": 1,
  "slug": "release-notes",
  "title": "Обновление каталога",
  "body": "Текст новости в markdown.",
  "author": { "id": 1, "username": "admin" },
  "is_published": true,
  "is_hidden": false,
  "created_at": "2026-07-27 21:48:38.537303+00"
}`,

  '/comments': `{
  "items": [
    {
      "id": 8,
      "user": { "id": 1, "username": "admin", "avatar_url": null },
      "target_type": "title",
      "target_id": 2,
      "parent_id": null,
      "body": "Отличная озвучка.",
      "score": 5,
      "my_vote": 0,
      "is_deleted": false,
      "edited_by_staff": false,
      "created_at": "2026-07-28 09:14:00.120000+00",
      "updated_at": "2026-07-28 09:14:00.120000+00",
      "replies": []
    }
  ],
${PAGE_TAIL}
// my_vote без входа всегда 0. Ответы вложены в поле replies родителя.`,

  '/users/{id}': `{
  "user": {
    "id": 1,
    "username": "admin",
    "bio": "",
    "socials": [],
    "avatar_url": null,
    "cover_url": null,
    "role": "admin",
    "created_at": "2026-07-26 18:02:11.004000+00"
  },
  "stats": {
    "planning": 3,
    "in_progress": 5,
    "completed": 12,
    "dropped": 1,
    "comments": 24,
    "favorites": 9
  }
}`,

  '/users/{id}/library': `{
  "items": [
    {
      "title": ${TITLE_CARD.trim()},
      "status": "in_progress",
      "note": "",
      "updated_at": "2026-07-28 09:14:00.120000+00"
    }
  ],
${PAGE_TAIL}`,

  '/users/{id}/favorites': `{
  "items": [
    ${TITLE_CARD.trim()}
  ],
${PAGE_TAIL}`,

  '/users/{id}/comments': `{
  "items": [
    {
      "id": 8,
      "user": { "id": 1, "username": "admin", "avatar_url": null },
      "target_type": "title",
      "target_id": 2,
      "parent_id": null,
      "body": "Отличная озвучка.",
      "score": 5,
      "my_vote": 0,
      "is_deleted": false,
      "edited_by_staff": false,
      "target": { "name": "Тет 1", "link": "/title/tet1" },
      "created_at": "2026-07-28 09:14:00.120000+00",
      "updated_at": "2026-07-28 09:14:00.120000+00"
    }
  ],
${PAGE_TAIL}`,

  '/legal/rules': `{
  "type": "rules",
  "title": "Rules",
  "body": "# Правила\\n\\nТекст в markdown."
}`,

  '/legal/{type}': `{
  "type": "terms",
  "title": "Terms of Service",
  "body": "# Условия использования\\n\\nТекст в markdown."
}`,
};

/** Query strings used in the curl line, where a bare path would be useless. */
export const SAMPLE_QUERY: Record<string, string> = {
  '/titles': '?sort=new&genre=fantasy&per_page=1',
  '/search/suggest': '?q=тет',
  '/genres': '?q=fan',
  '/narrators': '?q=fwa',
  '/authors': '?per_page=1',
  '/collections': '?sort=popular',
  '/comments': '?target_type=title&target_id=2&sort=top',
  '/users/{id}/library': '?page=1',
};

/** Path params replaced with a concrete value in the curl line. */
export const SAMPLE_PATH: Record<string, string> = {
  '/titles/{slug}': '/titles/tet1',
  '/chapters/{id}': '/chapters/3',
  '/download/chapters/{id}': '/download/chapters/3',
  '/narrators/{slug}': '/narrators/fwa',
  '/narrators/{id}/posts': '/narrators/1/posts',
  '/posts/{id}': '/posts/1',
  '/authors/{id}': '/authors/1',
  '/collections/{id}': '/collections/1',
  '/announcements/{slug}': '/announcements/release-notes',
  '/users/{id}': '/users/1',
  '/users/{id}/library': '/users/1/library',
  '/users/{id}/favorites': '/users/1/favorites',
  '/users/{id}/comments': '/users/1/comments',
  '/legal/{type}': '/legal/terms',
};
