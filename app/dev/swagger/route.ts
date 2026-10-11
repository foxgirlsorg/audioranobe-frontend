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
  :root { color-scheme: dark; --bg: #161616; --panel: #1a1a1d; --raised: #232326; --line: rgba(255,255,255,.08);
    --line-strong: rgba(255,255,255,.16); --text: #e8e8e8; --muted: #a6acb2; --dim: #7b8087; --accent: #de6161; --ok: #58a878; }
  html, body { margin: 0; background: var(--bg); color: var(--text); }
  .bar { display: flex; align-items: center; gap: 16px; padding: 14px 20px; border-bottom: 1px solid var(--line);
    font: 600 13px system-ui, sans-serif; }
  .bar a { color: var(--accent); text-decoration: none; }
  .bar span { color: var(--dim); }
  .swagger-ui, .swagger-ui .info .title, .swagger-ui .info li, .swagger-ui .info p, .swagger-ui .info table,
  .swagger-ui .opblock-tag, .swagger-ui .opblock .opblock-summary-description, .swagger-ui .opblock .opblock-summary-path,
  .swagger-ui .opblock .opblock-summary-path a, .swagger-ui .opblock-description-wrapper p, .swagger-ui .opblock-section-header h4,
  .swagger-ui .opblock-section-header > label, .swagger-ui .parameter__name, .swagger-ui .parameter__type,
  .swagger-ui table thead tr th, .swagger-ui table thead tr td, .swagger-ui .response-col_status,
  .swagger-ui .response-col_links, .swagger-ui .responses-inner h4, .swagger-ui .responses-inner h5,
  .swagger-ui .model-title, .swagger-ui .model, .swagger-ui .tab li, .swagger-ui label, .swagger-ui .markdown p,
  .swagger-ui .renderedMarkdown p, .swagger-ui section.models h4, .swagger-ui .model-toggle:after,
  .swagger-ui .servers-title, .swagger-ui .servers > label { color: var(--text); }
  .swagger-ui .parameter__in, .swagger-ui .parameter__extension, .swagger-ui .opblock-description-wrapper,
  .swagger-ui .response-col_description, .swagger-ui .model .property.primitive, .swagger-ui .info .base-url { color: var(--muted); }
  .swagger-ui .prop-type { color: #7f9dba; }
  .swagger-ui .prop-format { color: var(--dim); }
  .swagger-ui a, .swagger-ui .info a { color: var(--accent); }
  .swagger-ui .opblock-tag { border-bottom: 1px solid var(--line); }
  .swagger-ui .opblock-tag:hover { background: rgba(255,255,255,.02); }
  .swagger-ui .opblock { border-radius: 10px; box-shadow: none; }
  .swagger-ui .opblock.opblock-get { background: rgba(222,97,97,.05); border-color: rgba(222,97,97,.35); }
  .swagger-ui .opblock.opblock-get .opblock-summary { border-color: rgba(222,97,97,.35); }
  .swagger-ui .opblock.opblock-get .opblock-summary-method { background: var(--accent); }
  .swagger-ui .opblock.opblock-get .tab-header .tab-item.active h4 span:after { background: var(--accent); }
  .swagger-ui .opblock .opblock-section-header { background: var(--panel); box-shadow: none; }
  .swagger-ui .opblock-body pre.microlight, .swagger-ui .highlight-code > .microlight { border-radius: 8px; }
  .swagger-ui input[type=text], .swagger-ui input[type=search], .swagger-ui select, .swagger-ui textarea,
  .swagger-ui .filter .operation-filter-input { background: var(--panel); color: var(--text); border: 1px solid var(--line-strong); }
  .swagger-ui select { background-image: none; }
  .swagger-ui .btn { color: var(--text); border-color: var(--line-strong); background: transparent; box-shadow: none; }
  .swagger-ui .btn.execute { background: var(--accent); border-color: var(--accent); color: #fff; }
  .swagger-ui .btn.cancel { border-color: var(--accent); color: var(--accent); }
  .swagger-ui .scheme-container { background: var(--bg); box-shadow: none; border-bottom: 1px solid var(--line); }
  .swagger-ui section.models { border-color: var(--line); }
  .swagger-ui section.models .model-container { background: var(--panel); }
  .swagger-ui section.models .model-container:hover { background: var(--raised); }
  .swagger-ui .model-box { background: rgba(255,255,255,.03); }
  .swagger-ui table.model tr.property-row td { border-color: var(--line); }
  .swagger-ui .responses-table .response, .swagger-ui table tbody tr td { border-color: var(--line); }
  .swagger-ui .response-control-media-type__accept-message { color: var(--ok); }
  .swagger-ui .parameter__name.required span, .swagger-ui .parameter__name.required:after { color: var(--accent); }
  .swagger-ui .copy-to-clipboard { background: var(--raised); }
  .swagger-ui svg:not(:root) { fill: var(--muted); }
  .swagger-ui .opblock-summary-control:focus, .swagger-ui .btn:focus { outline-color: var(--accent); }
  .swagger-ui .loading-container .loading:after { color: var(--text); }
</style>
</head>
<body>
<div class="bar"><a href="/dev">← AudioRanobe API</a><span>OpenAPI 3 · <a href="/openapi.json">openapi.json</a></span></div>
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
    syntaxHighlight: { activated: true, theme: 'monokai' },
  });
</script>
</body>
</html>`;

export function GET() {
  return new Response(HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
