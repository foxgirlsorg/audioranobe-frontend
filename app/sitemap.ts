import type { MetadataRoute } from 'next';
import { API_URL } from '@/lib/api';

export const revalidate = 3600;

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://audioranobe.com').replace(/\/$/, '');

interface Listed {
  id?: number;
  slug?: string;
  updated_at?: string | null;
  created_at?: string | null;
}

async function listAll(path: string, extraParams = '', maxPages = 500): Promise<Listed[]> {
  const out: Listed[] = [];
  const perPage = 100;
  for (let page = 1; page <= maxPages; page++) {
    let items: Listed[] = [];
    let total = Infinity;
    try {
      const res = await fetch(`${API_URL}${path}?page=${page}&per_page=${perPage}${extraParams}`, {
        next: { revalidate: 3600 },
      });
      if (!res.ok) break;
      const data = await res.json();
      items = Array.isArray(data?.items) ? data.items : [];
      if (typeof data?.total === 'number') total = data.total;
    } catch {
      break;
    }
    if (items.length === 0) break;
    out.push(...items);
    if (out.length >= total) break;
  }
  return out;
}

function lastmod(row: Listed): Date | undefined {
  const iso = row.updated_at || row.created_at;
  if (!iso) return undefined;
  const d = new Date(iso.replace(' ', 'T'));
  return isNaN(d.getTime()) ? undefined : d;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [titles, narrators, authors, collections, news] = await Promise.all([
    listAll('/titles', '&include_hidden=1'),
    listAll('/narrators'),
    listAll('/authors'),
    listAll('/collections'),
    listAll('/announcements'),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/catalog`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/collections`, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${SITE_URL}/news`, changeFrequency: 'weekly', priority: 0.6 },
  ];

  const entries: MetadataRoute.Sitemap = [
    ...titles
      .filter((t) => t.slug)
      .map((t) => ({
        url: `${SITE_URL}/title/${encodeURIComponent(t.slug!)}`,
        lastModified: lastmod(t),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      })),
    ...narrators
      .filter((n) => n.slug)
      .map((n) => ({
        url: `${SITE_URL}/narrator/${encodeURIComponent(n.slug!)}`,
        lastModified: lastmod(n),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      })),
    ...authors
      .filter((a) => a.id != null)
      .map((a) => ({
        url: `${SITE_URL}/author/${a.id}`,
        changeFrequency: 'monthly' as const,
        priority: 0.5,
      })),
    ...collections
      .filter((c) => c.id != null)
      .map((c) => ({
        url: `${SITE_URL}/collections/${c.id}`,
        lastModified: lastmod(c),
        changeFrequency: 'weekly' as const,
        priority: 0.5,
      })),
    ...news
      .filter((a) => a.slug)
      .map((a) => ({
        url: `${SITE_URL}/news/${encodeURIComponent(a.slug!)}`,
        lastModified: lastmod(a),
        changeFrequency: 'monthly' as const,
        priority: 0.5,
      })),
  ];

  return [...staticPages, ...entries];
}
