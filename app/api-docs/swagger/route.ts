/**
 * Swagger UI over the generated /openapi.json. A standalone HTML page (no app
 * shell) so Swagger's global CSS never touches the site's styles.
 */
const CDN = 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5';

const HTML = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Swagger — AudioRanobe API</title>
<link rel="stylesheet" href="${CDN}/swagger-ui.css">
<style>
  html { background: #161616; }
  body { margin: 0; }
  .bar { display: flex; align-items: center; gap: 16px; padding: 14px 20px; background: #161616;
    border-bottom: 1px solid rgba(255,255,255,.08); font: 600 13px system-ui, sans-serif; }
  .bar a { color: #de6161; text-decoration: none; }
  .bar span { color: #7b8087; }
  #ui { filter: invert(88%) hue-rotate(180deg); background: #fff; min-height: 100vh; }
  #ui img, #ui .microlight { filter: invert(100%) hue-rotate(180deg); }
</style>
</head>
<body>
<div class="bar"><a href="/api-docs">← AudioRanobe API</a><span>OpenAPI 3 · <a href="/openapi.json">openapi.json</a></span></div>
<div id="ui"></div>
<script src="${CDN}/swagger-ui-bundle.js"></script>
<script>
  SwaggerUIBundle({
    url: '/openapi.json',
    dom_id: '#ui',
    deepLinking: true,
    filter: true,
    tryItOutEnabled: true,
    displayRequestDuration: true,
    defaultModelsExpandDepth: -1,
  });
</script>
</body>
</html>`;

export function GET() {
  return new Response(HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
