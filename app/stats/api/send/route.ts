import { NextRequest } from 'next/server';

const umamiServer = (process.env.NEXT_PUBLIC_UMAMI_SERVER_URL || 'https://cloud.umami.is').replace(/\/$/, '');

export async function POST(request: NextRequest) {
  const body = await request.text();

  const ip =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '';

  const country = request.headers.get('x-vercel-ip-country') || '';
  const region = request.headers.get('x-vercel-ip-country-region') || '';
  const city = request.headers.get('x-vercel-ip-city') || '';

  const response = await fetch(`${umamiServer}/api/send`, {
    method: 'POST',
    headers: {
      'Content-Type': request.headers.get('Content-Type') || 'application/json',
      'User-Agent': request.headers.get('User-Agent') || '',

      'X-Forwarded-For': ip,
      ...(ip ? { 'CF-Connecting-IP': ip } : {}),

      ...(country ? { 'CF-IPCountry': country } : {}),
      ...(region ? { 'CF-Region': region } : {}),
      ...(city ? { 'CF-IPCity': city } : {}),
    },
    body,
  });

  return new Response(response.body, {
    status: response.status,
    headers: {
      'Content-Type': response.headers.get('Content-Type') || 'application/json',
    },
  });
}
