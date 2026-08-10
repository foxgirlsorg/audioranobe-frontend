# AudioRanobe site frontend
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

This repository contains the source code for the AudioRanobe frontend — a site for browsing, listening to and tracking voiced light novel and book translations.

The API powering the content is maintained in a separate repository: [foxgirlsorg/audioranobe-backend](https://github.com/foxgirlsorg/audioranobe-backend). Audio transcoding is handled by [foxgirlsorg/audioranobe-convertor](https://github.com/foxgirlsorg/audioranobe-convertor).

## 🛠️ Technical Overview

* **Framework:** [Next.js](https://nextjs.org/) 14 (App Router, `output: 'standalone'`)
* **Language:** [TypeScript](https://www.typescriptlang.org/)
* **Styling:** CSS Modules + a token-based global theme
* **API Client:** hand-rolled `fetch` wrapper (`lib/api.ts`) — no SDK, no data-fetching library
* **Markdown:** [marked](https://marked.js.org/) + [DOMPurify](https://github.com/cure53/DOMPurify)
* **Icons:** [Lucide](https://lucide.dev/) via `lucide-react`
* **Image Cropping:** [react-easy-crop](https://github.com/ValentinH/react-easy-crop)
* **Language:** Russian only — `<html lang="ru">`, no i18n layer

## 🚀 Local Development

### Prerequisites

* Node.js v20+
* A running instance of the [AudioRanobe backend](https://github.com/foxgirlsorg/audioranobe-backend)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/foxgirlsorg/audioranobe-frontend.git
   cd audioranobe-frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**

   Copy `.env.example` to `.env` and edit it:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8080/api
   FRONTEND_PORT=3000
   ```

   | Variable | Required | Description |
      |---|---|---|
   | `NEXT_PUBLIC_API_URL` | Yes | Backend API URL **as the browser sees it**, including `/api`. Falls back to `http://localhost:8080/api`. |
   | `FRONTEND_PORT` | No | Host port the container publishes. Defaults to `3000`. Compose only. |
   | `NEXT_DIST_DIR` | No | Build output directory. Defaults to `.next`. 

4. **Start the development server**
   ```bash
   npm run dev
   ```
   The site will be available at `http://localhost:3000`.

### ⚠️ `NEXT_PUBLIC_API_URL` is baked in at build time

It is inlined into the client bundle during `next build`, not read at runtime.
Changing it in `.env` and restarting the container does nothing — you have to
rebuild:

```bash
docker compose up --build
```

This is also why `docker-compose.yml` passes it as a **build arg** rather than
an environment variable, and why Compose refuses to start if it is unset.

### 🔌 CORS

The backend's `FRONTEND_ORIGIN` must list this frontend's origin, or every
request fails in the browser while working fine from curl. If the frontend is
served at `http://example.com:3001`, the backend needs
`FRONTEND_ORIGIN=http://example.com:3001`.


## 📦 Building & Deployment

```bash
npm run build
npm run start
```

Or via Docker — a three-stage build (deps → build → runner) that ships only the
Next.js standalone output and runs as the unprivileged `node` user:

```bash
docker compose up -d --build
```

## 📂 Project Structure

```text
app/                            # Next.js App Router
├── layout.tsx                  # Root layout — Auth › Toast › Player providers, chrome
├── page.tsx                    # Home — library widget, rows, latest titles
├── catalog/                    # Catalog with filters, sorting, infinite scroll
├── title/[slug]/               # Title page + chapter list; /edit for owners & staff
├── chapter/[id]/               # Chapter page (playback runs in the global player)
├── narrator/[slug]/            # Narrator profile; /edit for owners & staff
├── author/[id]/                # Author profile; /edit for staff
├── collections/                # User collections, list + detail
├── news/, post/[id]/           # Announcements and narrator posts
├── user/[id]/                  # Public user profile
├── me/                         # Settings, listening history, notifications, requests
├── auth/                       # login, register, verify, forgot, reset, setup,
│                               #   callback/[provider] for OAuth
├── mod/                        # Staff area — dashboard + 13 tools (see below)
├── legal/                      # rules, terms, privacy (the only server-rendered pages)
├── dmca/                       # DMCA complaint form
├── api-docs/                   # In-app REST API reference with live samples
├── globals.css                 # Theme tokens, layout primitives, shared classes
└── markdown.css                # Dark markdown theme for rendered user content
components/                     # ~55 UI components, one folder each with its CSS module
├── Player/                     # Docked player bar (the audio element lives in lib)
├── NavBar/, Footer/            # Site chrome
├── CommentSection/             # Threaded comments with Markdown
├── TitleContentManager/        # Volume/chapter management + uploads
├── ArchiveDownloadButton/      # Client-side ZIP export (see below)
├── ImageCropper/                # Avatar & artwork cropping (lightbox: react-photo-view, wired in app/layout.tsx)
├── MarkdownEditor/, Markdown/  # Authoring and rendering user content
├── Toast/                      # Toast presentation (state lives in lib/toast.tsx)
└── ...
lib/
├── api.ts                      # fetch wrapper, ApiError, bearer token storage
├── auth.tsx                    # Auth context, session bootstrap, isMod helper
├── player.tsx                  # Global audio player context (see below)
├── toast.tsx                   # Toast provider and queue
├── upload.ts                   # Resumable chunked uploads (see below)
├── zip.ts                      # Hand-rolled ZIP writer (see below)
├── types.ts                    # API response types — mirrors the backend contract
├── useInfiniteList.ts          # Cursor pagination hook used by every long list
├── usePageTitle.ts             # document.title for client-rendered pages
└── format.ts                   # Dates, durations, counts — all Russian
public/
├── favicon.svg                 # Logo
├── noise.svg                   # Grain texture overlay
├── foxgirl_user.svg            # Default user avatar
├── foxgirl_narrator.svg        # Default narrator avatar
└── fonts/                      # Inter (variable, + italic)
```

## 🏛️ Architecture

**Client-heavy by design.** 43 of the 45 pages are `'use client'` and fetch
through `lib/api.ts` in `useEffect`. The only server-rendered pages are
`legal/terms` and `legal/privacy`, which are static text.

The 35 `layout.tsx` files are the counterweight: they stay server components
and exist almost entirely to export `metadata`, since a client page cannot.
That is the pattern to follow when adding a route — page does the work,
layout carries the title.

There are no route handlers, no server actions, and no `next/image`; every
media URL arrives from the API as a `*_url` field and is rendered with a plain
`<img>` or `<audio>`. Auth is a bearer token in `localStorage`
(`audioranobe_token`), attached by the API wrapper on every request.

The visual language lives in `app/globals.css` as CSS custom properties — dark
surfaces (`--bg: #161616`), a coral accent (`--accent: #de6161`), glass panels
with `backdrop-filter`, and a fixed grain overlay. Components consume the
tokens through their own CSS module; nothing hardcodes a hex value it did not
have to.

## 🎧 The Audio Player

`lib/player.tsx` owns a single `HTMLAudioElement` created once and reused for
the life of the session. Mounting it in a component would restart playback on
every navigation, so it lives in a ref inside the provider and the docked
`components/Player` bar is only a view onto it.

What it carries beyond play/pause:

- Playback rate and volume, persisted to `localStorage` and reapplied to the
  element on every load
- A sleep timer — either a number of minutes or `'chapter'`, which stops at the
  end of the current file
- Buffered-range tracking for the progress bar
- Next/previous chapter navigation within the current title
- Listening position pushed to `PUT /me/progress/:id`, including a
  `keepalive` request on `beforeunload` so closing the tab does not lose the
  last few seconds
- A load sequence counter, so a chapter switched away from mid-load cannot win
  the race and start playing over its replacement

## 🗜️ Client-Side ZIP Export

`lib/zip.ts` is a ZIP writer written by hand, in about 160 lines, with its own
CRC-32 table and DOS timestamp packing.

**Why:** "Download the whole audiobook" needs one file. The alternative was
shipping a compression library to every visitor to concatenate MP3s that are
already compressed — so the archives are **stored, not deflated**. No
compression means no deflate implementation, and the writer collapses to
headers plus raw bytes.

It supports exactly what that use case requires: store-only entries, UTF-8
filenames, per-volume folders, and automatic `name-2.mp3` deduplication.
It does **not** support zip64, so archives are capped at 4 GB and 65,535
entries. `safeEntryName` strips the characters Windows rejects; `saveBlob`
handles the anchor-click download dance and revokes the object URL a minute
later.

`ArchiveDownloadButton` drives it: fetches each chapter from
`/download/chapters/:id`, adds it, and hands the finished blob to the browser.
Everything is held in memory, which is fine for an audiobook and would not be
for a video library.

## ⬆️ Resumable Uploads

`lib/upload.ts` uploads audio in chunks over `XMLHttpRequest` rather than
`fetch` — for the single reason that XHR reports upload progress and `fetch`
does not.

The backend hands back an upload session with its own `chunk_size` and a
`received` byte count, so an interrupted upload resumes from wherever the
server actually got to instead of starting over. Each chunk retries up to
three times with a 1.2 s delay before the whole upload gives up, and an
`AbortSignal` cancels cleanly at a chunk boundary.

## 🛡️ Moderation Area

`/mod` is a dashboard of live counters (pending requests, open reports, failed
jobs, user and content totals) linking into thirteen tools: moderation queue,
reports, users, usernames, authors, narrators, genres, forbidden words,
announcements, broadcast, DMCA, trash, and an audit log.

Visibility is driven by `isMod` from the auth context (`role` of `moderator`
or `admin`), which decides what the navigation offers. **The gate that matters
is the backend's** — these pages call staff endpoints and render whatever comes
back, so authorization is enforced server-side on every request rather than by
hiding a link.

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

Copyright © 2026 **foxgirls.org** . All rights reserved.
