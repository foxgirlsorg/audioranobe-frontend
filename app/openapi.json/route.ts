import { API_DOCS_GROUPS } from '@/lib/apiDocsGroups';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://audioranobe.com/api';

/**
 * Minimal OpenAPI 3.0 description of exactly the endpoints listed on
 * /api-docs (the human-readable page) — generated from the same data so the
 * two can never drift apart. Every one of them is a public, unauthenticated GET.
 */
function buildSpec() {
  const paths: Record<string, unknown> = {};

  for (const group of API_DOCS_GROUPS) {
    for (const ep of group.endpoints) {
      const pathParams = [...ep.path.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
      const parameters = [
        ...pathParams.map((name) => ({
          name,
          in: 'path',
          required: true,
          schema: { type: 'string' },
        })),
        ...(ep.params ?? []).map((p) => ({
          name: p.name,
          in: 'query',
          required: false,
          description: p.desc,
          schema: { type: 'string' },
        })),
      ];

      paths[ep.path] = {
        get: {
          tags: [group.title],
          summary: ep.desc,
          ...(ep.note ? { description: ep.note } : {}),
          ...(parameters.length > 0 ? { parameters } : {}),
          responses: {
            '200': { description: 'OK' },
          },
        },
      };
    }
  }

  return {
    openapi: '3.0.3',
    info: {
      title: 'AudioRanobe API',
      description: 'Публичное read-only API. Смотрите /api-docs для интерактивных примеров.',
      version: '1.0.0',
    },
    servers: [{ url: API_BASE }],
    paths,
  };
}

export function GET() {
  return Response.json(buildSpec());
}
