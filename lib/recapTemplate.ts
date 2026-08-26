import type { Recap } from '@/lib/types';

/** Tokens an admin can drop into the yearly card HTML, with a short hint. */
export const RECAP_TOKENS: [string, string][] = [
  ['{{display_name}}', 'имя пользователя'],
  ['{{handle}}', '@ник'],
  ['{{year}}', 'год'],
  ['{{total_hours}}', 'часов прослушано'],
  ['{{total_minutes}}', 'минут прослушано'],
  ['{{total_seconds}}', 'секунд прослушано'],
  ['{{files_count}}', 'глав дослушано'],
  ['{{titles_count}}', 'тайтлов'],
  ['{{books_finished}}', 'тайтлов целиком'],
  ['{{active_days}}', 'дней с прослушиванием'],
  ['{{top_title}}', 'тайтл №1'],
  ['{{top_narrator}}', 'чтец №1'],
  ['{{top_titles}}', 'список топ-тайтлов (ol.recap-top-titles)'],
  ['{{top_narrators}}', 'список топ-чтецов (ul.recap-top-narrators)'],
];

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function topTitlesHtml(recap: Recap): string {
  if (recap.top_titles.length === 0) return '';
  const items = recap.top_titles
    .map(
      (t, i) =>
        `<li><span class="rank">${i + 1}</span><span class="name">${esc(t.name)}</span>` +
        `<span class="time">${Math.max(1, Math.round(t.seconds / 60))} мин</span></li>`
    )
    .join('');
  return `<ol class="recap-top-titles">${items}</ol>`;
}

function topNarratorsHtml(recap: Recap): string {
  if (recap.top_narrators.length === 0) return '';
  const items = recap.top_narrators.map((n) => `<li>${esc(n.name)}</li>`).join('');
  return `<ul class="recap-top-narrators">${items}</ul>`;
}

/** Substitute {{token}} holes in an admin's HTML template with a user's stats. */
export function fillTemplate(html: string, recap: Recap): string {
  const hours = Math.floor(recap.total_seconds / 3600);
  const minutes = Math.floor(recap.total_seconds / 60);
  const map: Record<string, string> = {
    display_name: esc(recap.display_name || recap.username),
    handle: esc(recap.username ? `@${recap.username}` : ''),
    year: esc(recap.period_label),
    total_hours: String(hours),
    total_minutes: String(minutes),
    total_seconds: String(recap.total_seconds),
    files_count: String(recap.files_count),
    titles_count: String(recap.titles_count),
    books_finished: String(recap.books_finished),
    active_days: String(recap.active_days),
    top_title: esc(recap.top_titles[0]?.name ?? '—'),
    top_narrator: esc(recap.top_narrators[0]?.name ?? '—'),
    top_titles: topTitlesHtml(recap),
    top_narrators: topNarratorsHtml(recap),
  };
  return html.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, key: string) =>
    key in map ? map[key] : m
  );
}

/** Realistic stand-in so the admin editor can preview without real data. */
export const SAMPLE_RECAP: Recap = {
  scope: 'year',
  period_label: String(new Date().getFullYear()),
  username: 'kitsune',
  display_name: 'Кицунэ',
  total_seconds: 187 * 3600 + 20 * 60,
  files_count: 642,
  titles_count: 37,
  books_finished: 12,
  active_days: 148,
  top_titles: [
    { slug: 'a', name: 'Восхождение в тени', cover_url: null, seconds: 42 * 3600 },
    { slug: 'b', name: 'Реинкарнация безработного', cover_url: null, seconds: 31 * 3600 },
    { slug: 'c', name: 'Магическая академия', cover_url: null, seconds: 24 * 3600 },
    { slug: 'd', name: 'Повелитель тайн', cover_url: null, seconds: 18 * 3600 },
    { slug: 'e', name: 'Курс на север', cover_url: null, seconds: 9 * 3600 },
  ],
  top_narrators: [
    { id: 1, slug: 'n1', name: 'Алекс Ветров', seconds: 61 * 3600 },
    { id: 2, slug: 'n2', name: 'Мария Ли', seconds: 40 * 3600 },
    { id: 3, slug: 'n3', name: 'Игорь Ким', seconds: 22 * 3600 },
  ],
};
