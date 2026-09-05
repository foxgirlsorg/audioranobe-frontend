/**
 * RFC 9727 API catalog — lets automated tooling discover the public API
 * documented at /api-docs without hand-configuration. One entry, matching the
 * one public API this site exposes.
 */
const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://audioranobe.com').replace(/\/$/, '');
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? `${SITE}/api`;

export function GET() {
  const body = {
    linkset: [
      {
        anchor: API_BASE,
        'service-desc': [{ href: `${SITE}/openapi.json`, type: 'application/json' }],
        'service-doc': [{ href: `${SITE}/api-docs`, type: 'text/html' }],
      },
    ],
  };
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/linkset+json' },
  });
}
