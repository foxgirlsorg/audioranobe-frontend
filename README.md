# AudioRanobe Frontend

Next.js 14 frontend for the AudioRanobe audiobook platform.
Runs on its own server, connects to the backend over HTTP.

## Quick start

```bash
cp .env.example .env    # set NEXT_PUBLIC_API_URL
docker compose up --build
```

- Frontend: http://localhost:3000

**Important**: `NEXT_PUBLIC_API_URL` is baked into the client bundle at build time. After
changing it, you must rebuild the container (`docker compose up --build`).

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | yes | Backend API URL as seen by the browser (e.g. `http://185.241.151.50:8082/api`) |
| `FRONTEND_PORT` | no | Port to expose (default: 3000) |

## Verifying a change

```bash
npm run build:check
```

Type-checks and builds into `.next-build` instead of `.next`. Use this rather than
`npm run build` while a dev server is running: a plain build overwrites `.next`, and dev then
loads the production runtime out of it and dies (on Windows it fails earlier, with `EPERM` on
`.next/trace`).

## CORS

The backend's `FRONTEND_ORIGIN` must include this frontend's URL. For example, if the
frontend is at `http://185.241.151.50:3001`, set `FRONTEND_ORIGIN=http://185.241.151.50:3001`
on the backend.

## Stack

- Next.js 14 (App Router), TypeScript, plain CSS modules
- Icons: lucide-react
- Russian is the only language

## Architecture

- **Client-heavy**: every page is `'use client'` and fetches via `lib/api.ts`.
- No server components, no `next/image`, no route handlers.
- All media URLs come from the API (`*_url` fields).
