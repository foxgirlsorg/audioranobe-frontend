/* Response samples for the public API reference. The `//` notes make the text
   intentionally invalid JSON — JsonBlock tokenizes rather than parses. */

const TITLE_CARD = `{
      "id": 2,                       // id тайтла
      "slug": "podnyatie-urovnya-v-odinochku",  // адрес страницы
      "name": "Поднятие уровня в одиночку",
      "author": { "id": 1, "slug": "chu-gong", "name": "Чу Гун" },
      "year": 2016,                  // год выпуска, может быть null
      "cover_url": "https://cdn.example/covers/2.jpg",  // обложка 2:3, может быть null
      "release_status": "completed", // ongoing | completed | abandoned | frozen
      "avg_rating": 9.1,             // средняя оценка 1–10, null если оценок нет
      "rating_count": 372,           // сколько людей оценило
      "listens": 18420,              // прослушиваний глав
      "genres": [
        { "id": 1, "slug": "fantasy", "name": "Фэнтези", "is_sensitive": false }
      ],
      "is_nsfw": false,              // отметка 18+
      "has_sensitive_genre": false,  // есть тег, помеченный для скрытия
      "is_restricted": true,         // контент нужно скрывать
      "is_deleted": false
    }`;

const PAGE_TAIL = `  "page": 1,        // текущая страница
  "per_page": 24,   // размер страницы
  "total": 137      // всего элементов, не страниц
}`;

export const SAMPLES: Record<string, string> = {
  '/home': `{
  "announcements": [           // новости, закреплённые вверху главной
    {
      "id": 1,
      "slug": "release-notes",
      "title": "Обновление каталога",
      "body": "…",             // markdown
      "author": { "id": 1, "username": "admin" },
      "is_published": true,
      "is_hidden": false,
      "created_at": "2026-07-27 21:48:38.537303+00"
    }
  ],
  "continue": [],              // «продолжить слушать» — привязано к аккаунту
  "new_titles": [              // недавно добавленные
    ${TITLE_CARD.trim()}
  ],
  "popular": [],               // по числу прослушиваний
  "top_rated": [],             // по средней оценке
  "recently_updated": []       // по дате последней главы
}`,

  '/titles': `{
  "items": [
    ${TITLE_CARD.trim()}
  ],
${PAGE_TAIL}`,

  '/titles/{slug}': `{
  "id": 2,
  "slug": "podnyatie-urovnya-v-odinochku",
  "name": "Поднятие уровня в одиночку",
  "alt_names": ["Solo Leveling", "나 혼자만 레벨업"],  // альтернативные названия
  "author": { "id": 1, "slug": "chu-gong", "name": "Чу Гун" },
  "description": "Описание тайтла в markdown.",
  "year": 2016,
  "cover_url": "https://cdn.example/covers/2.jpg",   // обложка 2:3
  "bg_url": "https://cdn.example/bg/2.jpg",          // фоновый баннер 3:1, может быть null
  "release_status": "completed",
  "avg_rating": 9.1,
  "rating_count": 372,
  "rating_distribution": { "1": 2, "8": 44, "9": 121, "10": 168 },  // оценка → сколько раз поставлена
  "listens": 18420,
  "views_count": 53100,        // открытий страницы тайтла
  "favorites_count": 2041,     // добавлений в избранное
  "genres": [
    { "id": 1, "slug": "fantasy", "name": "Фэнтези", "is_sensitive": false }
  ],
  "narrators": [
    {
      "id": 1,
      "slug": "adrenalin28",
      "name": "adrenalin28",
      "avatar_url": null,
      "titles_count": 14,          // сколько тайтлов озвучил
      "is_deleted": false,
      "narration_status": "completed"  // статус этой озвучки, отдельно от статуса тайтла
    }
  ],
  "volumes": [
    {
      "id": 1,
      "number": 1,
      "name": "Том 1",
      "chapters": [
        {
          "id": 2,
          "volume_id": 1,
          "number": 1,               // дробный: 4.1 — вставка между 4 и 5
          "name": "Пролог",
          "duration_seconds": 742.5,
          "audio_status": "ready",   // ready | processing | failed | restricted
          "mod_status": "approved",
          "my_position": null,       // позиция прослушивания в секундах
          "narrators": [{ "id": 1, "slug": "adrenalin28", "name": "adrenalin28" }],
          "is_deleted": false
        }
      ]
    }
  ],
  "similar": [],                 // похожие тайтлы, тот же вид что и в /titles
  "is_nsfw": false,
  "has_sensitive_genre": false,
  "is_restricted": false,
  "is_deleted": false,
  "mod_status": "approved",
  "my_favorite": false,          // в избранном у вызывающего
  "my_rating": null,             // его оценка
  "my_library": null,            // planning | in_progress | completed | dropped
  "can_edit": false,             // есть ли права на редактирование
  "created_at": "2026-07-27 21:48:38.537303+00",
  "updated_at": "2026-07-28 10:12:04.221900+00"
}`,

  '/titles/random': `{
  "slug": "podnyatie-urovnya-v-odinochku"   // подставьте в /titles/{slug}
}`,

  '/search/suggest': `{
  "titles": [                    // до 5 совпадений
    {
      "id": 2,
      "slug": "podnyatie-urovnya-v-odinochku",
      "name": "Поднятие уровня в одиночку",
      "author": { "id": 1, "slug": "chu-gong", "name": "Чу Гун" },
      "cover_url": "https://cdn.example/covers/2.jpg"
    }
  ],
  "narrators": [                 // до 3 совпадений
    { "id": 1, "slug": "adrenalin28", "name": "adrenalin28", "avatar_url": null }
  ]
}`,

  '/genres': `{
  "items": [
    {
      "id": 1,
      "slug": "fantasy",         // значение для ?genre=
      "name": "Фэнтези",
      "titles_count": 42,
      "is_sensitive": false      // тег помечен чувствительным
    }
  ],
${PAGE_TAIL}`,

  '/chapters/{id}': `{
  "id": 3,
  "number": 1,
  "name": "Пролог",
  "duration_seconds": 742.5,
  "audio_url": "https://cdn.example/audio/2/c3-1753650000.opus",  // прямая ссылка на файл
  "my_position": null,           // позиция прослушивания в секундах
  "volume": { "id": 1, "number": 1, "name": "Том 1" },
  "title": {
    "id": 2,
    "slug": "podnyatie-urovnya-v-odinochku",
    "name": "Поднятие уровня в одиночку",
    "cover_url": "https://cdn.example/covers/2.jpg"
  },
  "prev_id": null,               // предыдущая глава, null если первая
  "next_id": 4                   // следующая глава, null если последняя
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
      "id": 1,
      "slug": "adrenalin28",
      "name": "adrenalin28",
      "avatar_url": null,
      "titles_count": 14,
      "is_deleted": false
    }
  ],
${PAGE_TAIL}`,

  '/narrators/{slug}': `{
  "id": 1,
  "slug": "adrenalin28",
  "name": "adrenalin28",
  "bio": "Описание чтеца в markdown.",
  "avatar_url": null,
  "cover_url": null,             // баннер профиля 3:1
  "socials": ["https://boosty.to/adrenalin28"],  // до 10 ссылок
  "is_ai": false,                // синтезированный голос
  "is_verified": false,          // подтверждённый чтец
  "titles_count": 14,
  "titles": [
    ${TITLE_CARD.trim()}
  ],
  "is_self": false,              // чтец озвучивает сам себя, а не команда
  "admin_contact": null,         // виден только администраторам и команде
  "mod_status": "approved",
  "is_deleted": false,
  "created_at": "2026-07-27 21:48:38.537303+00"
}`,

  '/narrators/{id}/posts': `{
  "items": [
    {
      "id": 1,
      "narrator": { "id": 1, "slug": "adrenalin28", "name": "adrenalin28", "avatar_url": null },
      "title": "Финал озвучен",
      "body": "Текст поста в markdown.",
      "is_hidden": false,
      "created_at": "2026-07-27 21:48:38.537303+00",
      "updated_at": "2026-07-27 21:48:38.537303+00"
    }
  ],
${PAGE_TAIL}`,

  '/posts/{id}': `{
  "id": 1,
  "narrator": { "id": 1, "slug": "adrenalin28", "name": "adrenalin28", "avatar_url": null },
  "title": "Финал озвучен",
  "body": "Текст поста в markdown.",
  "is_hidden": false,
  "created_at": "2026-07-27 21:48:38.537303+00",
  "updated_at": "2026-07-27 21:48:38.537303+00"
}`,

  '/authors': `{
  "items": [
    { "id": 1, "slug": "chu-gong", "name": "Чу Гун", "titles_count": 3 }
  ],
${PAGE_TAIL}`,

  '/authors/{id}': `{
  "id": 1,
  "slug": "chu-gong",
  "name": "Чу Гун",
  "bio": "Биография в markdown.",
  "links": [],                   // ссылки на автора
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
      "description": "Описание подборки",
      "is_public": true,
      "user": { "id": 1, "username": "admin", "avatar_url": null },  // автор подборки
      "items_count": 12,
      "likes_count": 4,
      "cover_urls": ["https://cdn.example/covers/2.jpg"],  // до 4 обложек для превью
      "created_at": "2026-07-27 21:51:09.866397+00",
      "updated_at": "2026-07-27 21:51:30.262257+00"
    }
  ],
${PAGE_TAIL}`,

  '/collections/{id}': `{
  "id": 1,
  "name": "Любимое фэнтези",
  "description": "Описание подборки",
  "is_public": true,
  "user": { "id": 1, "username": "admin", "avatar_url": null },
  "items_count": 12,
  "likes_count": 4,
  "cover_urls": [],
  "my_like": false,              // лайк вызывающего
  "items": [
    {
      "position": 0,             // порядок, задан автором подборки
      "note": "Начать отсюда",   // заметка автора к этому тайтлу
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
      "user": { "id": 1, "username": "admin", "avatar_url": null },  // null у удалённого аккаунта
      "target_type": "title",    // к чему комментарий
      "target_id": 2,
      "parent_id": null,         // id родителя, null у корневого
      "body": "Отличная озвучка.",
      "score": 5,                // сумма голосов «за» минус «против»
      "my_vote": 0,              // голос вызывающего: 1, 0 или -1
      "is_deleted": false,       // удалённые остаются в дереве, но без текста
      "edited_by_staff": false,  // текст правил модератор, а не автор
      "created_at": "2026-07-28 09:14:00.120000+00",
      "updated_at": "2026-07-28 09:14:00.120000+00",
      "replies": []              // ответы вложены сюда
    }
  ],
${PAGE_TAIL}`,

  '/users/{id}': `{
  "user": {
    "id": 1,
    "username": "admin",         // логин, он же адрес страницы
    "display_name": "Админ",     // отображаемое имя, пусто — показывается логин
    "bio": "",
    "socials": [],
    "avatar_url": null,
    "cover_url": null,
    "role": "admin",             // user | moderator | admin
    "created_at": "2026-07-26 18:02:11.004000+00"
  },
  "stats": {                     // счётчики для вкладок профиля
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
      "status": "in_progress",   // planning | in_progress | completed | dropped
      "note": "",                // заметка владельца полки
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
      "target": {                // куда ведёт комментарий
        "name": "Поднятие уровня в одиночку",
        "link": "/title/podnyatie-urovnya-v-odinochku"
      },
      "created_at": "2026-07-28 09:14:00.120000+00",
      "updated_at": "2026-07-28 09:14:00.120000+00"
    }
  ],
${PAGE_TAIL}`,

  '/legal/rules': `{
  "type": "rules",
  "title": "Правила",
  "body": "# Правила\\n\\nТекст в markdown."
}`,

  '/legal/{type}': `{
  "type": "terms",
  "title": "Условия использования",
  "body": "# Условия использования\\n\\nТекст в markdown."
}`,
};

export const SAMPLE_QUERY: Record<string, string> = {
  '/titles': '?sort=new&genre=fantasy&per_page=1',
  '/search/suggest': '?q=поднятие',
  '/genres': '?q=фэн',
  '/narrators': '?q=adrenalin',
  '/authors': '?per_page=1',
  '/collections': '?sort=popular',
  '/comments': '?target_type=title&target_id=2&sort=top',
  '/users/{id}/library': '?page=1',
};

export const SAMPLE_PATH: Record<string, string> = {
  '/titles/{slug}': '/titles/podnyatie-urovnya-v-odinochku',
  '/chapters/{id}': '/chapters/3',
  '/download/chapters/{id}': '/download/chapters/3',
  '/narrators/{slug}': '/narrators/adrenalin28',
  '/narrators/{id}/posts': '/narrators/1/posts',
  '/posts/{id}': '/posts/1',
  '/authors/{id}': '/authors/1',
  '/collections/{id}': '/collections/1',
  '/announcements/{slug}': '/announcements/release-notes',
  '/users/{id}': '/users/1',
  '/users/{id}/library': '/users/1/library',
  '/users/{id}/favorites': '/users/1/favorites',
  '/users/{id}/comments': '/users/1/comments',
};
