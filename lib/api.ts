// Thin fetch wrapper for the AudioRanobe PHP API.
// All frontend data access goes through api() — never construct storage URLs.

export const API_URL: string =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';

const TOKEN_KEY = 'audioranobe_token';

export class ApiError extends Error {
  status: number;
  /** Machine-readable error slug, when the backend sends one (e.g. 'forbidden_word'). */
  code?: string;
  /** For 'forbidden_word': the word that tripped the filter. */
  word?: string;
  /** For 'forbidden_word': dotted path of the offending request-body field. */
  field?: string;

  constructor(status: number, message: string, extra?: { code?: string; word?: string; field?: string }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = extra?.code;
    this.word = extra?.word;
    this.field = extra?.field;
  }
}

/** True when the request was rejected by the admin-configured word filter. */
export function isForbiddenWord(e: unknown): e is ApiError {
  return e instanceof ApiError && e.code === 'forbidden_word';
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(t: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (t) window.localStorage.setItem(TOKEN_KEY, t);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // storage unavailable (private mode etc.) — session-only auth then
  }
}

export interface ApiOptions {
  method?: string;
  body?: any;
  formData?: FormData;
  params?: Record<string, any>;
}

function buildQuery(params?: Record<string, any>): string {
  if (!params) return '';
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      for (const v of value) {
        if (v === undefined || v === null) continue;
        qs.append(key, String(v));
      }
    } else {
      qs.append(key, String(value));
    }
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export async function api<T = any>(path: string, opts: ApiOptions = {}): Promise<T> {
  const url = API_URL + path + buildQuery(opts.params);

  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let body: BodyInit | undefined;
  let method = opts.method;
  if (opts.formData) {
    body = opts.formData;
    method = method || 'POST';
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
    method = method || 'POST';
  } else {
    method = method || 'GET';
  }

  let res: Response;
  try {
    res = await fetch(url, { method, headers, body });
  } catch {
    throw new ApiError(0, 'Network error — could not reach the server');
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let data: any = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = undefined;
    }
  }

  if (!res.ok) {
    const message =
      data && typeof data.error === 'string' && data.error
        ? data.error
        : `Request failed (${res.status})`;
    throw new ApiError(res.status, message, {
      code: data && typeof data.code === 'string' ? data.code : undefined,
      word: data && typeof data.word === 'string' ? data.word : undefined,
      field: data && typeof data.field === 'string' ? data.field : undefined,
    });
  }

  return data as T;
}
