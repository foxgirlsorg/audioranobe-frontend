import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/me/',
        '/mod/',
        '/title/*/edit',
        '/narrator/*/edit',
        '/author/*/edit',
      ],
    },
  };
}
