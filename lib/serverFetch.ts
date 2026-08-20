import { API_URL } from '@/lib/api';

/**
 * Server-side metadata fetch shared by every entity's layout.tsx
 * generateMetadata(): GET a resource, 60s revalidate, null on any failure
 * (404, network error, etc.) so callers can fall back to a "not found" title.
 */
export async function fetchMeta<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
