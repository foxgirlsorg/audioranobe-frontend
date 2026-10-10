import { API_DOCS_GROUPS } from '@/lib/apiDocsGroups';
import { RESPONSES, SCHEMAS } from '@/lib/apiSchemas';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://audioranobe.com/api';

/**
 * Minimal OpenAPI 3.0 description of exactly the endpoints listed on
 * /dev (the human-readable page) — generated from the same data so the
 * two can never drift apart. Every one of them is a public, unauthenticated GET.
 */
const ERROR_RESPONSE = {
  description: 'Ошибка',
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
};

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
            '200':
              ep.path === '/download/chapters/{id}'
                ? { description: 'Аудиофайл', content: { 'audio/ogg': { schema: { type: 'string', format: 'binary' } } } }
                : {
                    description: 'OK',
                    ...(RESPONSES[ep.path] ? { content: { 'application/json': { schema: RESPONSES[ep.path] } } } : {}),
                  },
            ...(pathParams.length > 0 ? { '404': ERROR_RESPONSE } : {}),
            ...(ep.params?.length ? { '400': ERROR_RESPONSE } : {}),
          },
        },
      };
    }
  }

  return {
    openapi: '3.0.3',
    info: {
      title: 'AudioRanobe API',
      description: 'Публичное read-only API. Смотрите /dev для интерактивных примеров.',
      version: '1.0.0',
    },
    servers: [{ url: API_BASE }],
    paths,
    components: { schemas: SCHEMAS },
  };
}

export function GET() {
  return Response.json(buildSpec());
}
