import { cookies, headers } from 'next/headers';

// Headers for server-side fetches made on behalf of the visitor. Besides the
// auth cookie we forward the visitor's User-Agent and IP: the backend records
// both on the session row, and without them every SSR render would overwrite
// the real browser/IP with "node" and the host's address.
export function viewerHeaders(): Record<string, string> {
  const h = headers();
  const out: Record<string, string> = { cookie: cookies().toString() };

  const ua = h.get('user-agent');
  if (ua) out['user-agent'] = ua;

  // Our own proxy sets X-Forwarded-For; its first entry is the visitor.
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip');
  if (ip) out['x-forwarded-for'] = ip;

  return out;
}
