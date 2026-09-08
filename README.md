# AudioRanobe site frontend
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **The official website for the AudioRanobe audiobook platform.**

This repository contains the source code for the AudioRanobe frontend — a site for browsing, listening to and tracking voiced light novel and book translations.

The API powering the content is maintained separately: [foxgirlsorg/audioranobe-backend](https://github.com/foxgirlsorg/audioranobe-backend). Audio transcoding is handled by [foxgirlsorg/audioranobe-convertor](https://github.com/foxgirlsorg/audioranobe-convertor).

## 🛠️ Technical Overview

* **Framework:** [Next.js](https://nextjs.org/) 14 (App Router, `output: 'standalone'`)
* **Language:** [TypeScript](https://www.typescriptlang.org/)
* **UI:** [React](https://react.dev/) 18
* **Styling:** CSS Modules + a token-based global theme ([devdark](https://github.com/devdarktheme))
* **Markdown:** [marked](https://marked.js.org/) + [DOMPurify](https://github.com/cure53/DOMPurify)
* **Icons:** [Lucide](https://lucide.dev/) via `lucide-react`
* **Image Cropping:** [react-easy-crop](https://github.com/ValentinH/react-easy-crop)
* **Localization:** Russian only — `<html lang="ru">`, no i18n layer
* **Containerization:** Docker + Docker Compose

## ✨ Highlights

* **Audio player** — persistent bottom bar with a full-screen mode, playback speed (0.5–3×), sleep timer, Media Session (lock-screen / headphone) controls, and progress saved server-side as you listen. Resumes the last-open chapter on return.
* **Catalog** — title grid with live search, filters and sorting; title pages with volumes, chapters and ratings.
* **Accounts** — auth (email + OAuth), profiles, library shelves, favorites, listening history, friends, direct messages.
* **Moderation panel** — `/mod/*` tools gated by the backend permission system: review queue, users, roles, narration, storage, backups, auth providers and captcha.

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

   Create a `.env` (or `.env.local`) at the project root:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8080/api
   FRONTEND_PORT=3000
   ```

   | Variable | Required | Description |
   |---|---|---|
   | `NEXT_PUBLIC_API_URL` | Yes | Backend API URL **as the browser sees it**, including `/api`. Defaults to `http://localhost:8080/api`. |
   | `FRONTEND_PORT` | No | Host port the container publishes. Defaults to `3000`. Compose only. |
   | `NEXT_DIST_DIR` | No | Build output directory. Defaults to `.next`. |

4. **Start the development server**
   ```bash
   npm run dev
   ```
   The site will be available at `http://localhost:3000`.

> ### ⚠️ `NEXT_PUBLIC_API_URL` is baked in at build time
> Like every `NEXT_PUBLIC_*` value, it is inlined into the client bundle during `next build`. Changing it requires a **rebuild**, not just a restart — set it before building the production image.

## 📦 Building & Deployment

```bash
npm run build
npm run start
```

Or with Docker:

```bash
docker compose up --build
```

## 📂 Project Structure

```text
app/                       # Next.js App Router pages & layouts
├── page.tsx               # Home
├── catalog/               # Browse: search, filters, sorting
├── title/[slug]/          # Title page + chapter list
├── chapter/[id]/          # Chapter (player target)
├── user/[id]/             # Profile: library, favorites, comments, collections, friends
├── auth/                  # Login, register, password reset, OAuth callback
├── me/                    # Own settings, chat, notifications, requests
└── mod/                   # Moderation panel (permission-gated)
components/                # Reusable UI (Player, Tabs, Select, CommentSection, …)
lib/
├── api.ts                 # fetch wrapper + X-Me viewer decoding
├── auth.tsx               # Auth context (login / register / session)
├── player.tsx             # Global audio player provider
└── config.tsx             # Public /config (feature flags, captcha, providers)
```

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

Copyright © 2026 **foxgirls.org**. All rights reserved.
