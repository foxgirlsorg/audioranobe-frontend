
export const API_URL: string =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';

export class ApiError extends Error {
  status: number;
  code?: string;
  word?: string;
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

export function isForbiddenWord(e: unknown): e is ApiError {
  return e instanceof ApiError && e.code === 'forbidden_word';
}

export interface ApiOptions {
  method?: string;
  body?: any;
  formData?: FormData;
  params?: Record<string, any>;
}

// The backend piggybacks the current user onto every response as an X-Me header
// (base64 Me JSON, empty when signed out) so the app learns auth state from
// normal traffic instead of probing /me. AuthProvider registers here.
//
// lastMeHeader guards against a feedback loop: every call notifying the
// listener triggers a React state update, which can re-render components
// whose effects depend on the user and fire more API calls — each carrying
// its own X-Me — amplifying into a flood that exhausts the browser's
// connection pool. The header is a byte-stable encoding of the same user
// data, so a plain string compare is enough to only notify on an actual
// change (sign-in, sign-out, or a profile edit), not on every response.
type ViewerListener = (me: unknown | null) => void;
let viewerListener: ViewerListener | null = null;
let lastMeHeader: string | null = null;

export function onViewer(fn: ViewerListener | null): void {
  viewerListener = fn;
}

function decodeViewer(header: string): unknown | null {
  if (header === '') return null;
  try {
    const bytes = Uint8Array.from(atob(header), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
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
    // credentials:'include' sends and stores the HttpOnly auth cookie, which is
    // the whole session now — no token is read or held in JS. The backend
    // slides the session forward by re-setting the cookie (Auth::maybeRenew).
    res = await fetch(url, { method, headers, body, credentials: 'include' });
  } catch {
    throw new ApiError(0, 'Network error — could not reach the server');
  }

  // Learn who's signed in from ordinary responses. Auth endpoints set their own
  // user state (and their X-Me reflects the pre-action session), so skip them.
  if (!path.startsWith('/auth/')) {
    const meHeader = res.headers.get('X-Me');
    if (meHeader !== null && meHeader !== lastMeHeader) {
      lastMeHeader = meHeader;
      viewerListener?.(decodeViewer(meHeader));
    }
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
