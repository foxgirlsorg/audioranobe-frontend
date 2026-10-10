/**
 * Embeddable widgets: /embed?title={id}&volume={id}&version={id} (volume player),
 * /embed?type=narrator&id={id}, /embed?type=collection&id={id}; all take &theme=light.
 * A standalone page (no site chrome) meant for third-party iframes; the UI
 * lives in public/embed/widget.{js,css}. Configured on /dev/widgets.
 * Umami counts views under the "widget" tag; the embedding page shows up as the referrer.
 */
const V = Date.now().toString(36);
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api';
const UMAMI_ID = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
const UMAMI_DOMAINS = process.env.NEXT_PUBLIC_UMAMI_DOMAINS;

const page = (light: boolean) => `<!doctype html>
<html lang="ru"${light ? ' class="light"' : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>AudioRanobe</title>
<link rel="stylesheet" href="/embed/widget.css?v=${V}">
</head>
<body>
<div id="app" class="ar"><div class="ar-state">Загрузка…</div></div>
<script>window.AR_API = ${JSON.stringify(API_BASE)};</script>
<script src="/embed/widget.js?v=${V}"></script>
${UMAMI_ID ? `<script defer src="/stats/script.js" data-website-id="${UMAMI_ID}" data-host-url="/stats"${UMAMI_DOMAINS ? ` data-domains="${UMAMI_DOMAINS}"` : ''} data-tag="widget"></script>
` : ''}</body>
</html>`;

export function GET(req: Request) {
  const light = new URL(req.url).searchParams.get('theme') === 'light';
  return new Response(page(light), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      'Content-Security-Policy': 'frame-ancestors *',
    },
  });
}
