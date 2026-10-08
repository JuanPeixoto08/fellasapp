# fellasapp

A private, invite-only social network for a group of friends. One TypeScript codebase runs on the web, as an installable PWA and as an Android app, backed by Supabase (PostgreSQL).

**Live:** [fellasapp.pages.dev](https://fellasapp.pages.dev) (invite only) · [Versão em português](README.pt-BR.md)

## Features

- **Feed and posts:** up to 4 photos, #tags, locations, polls, emoji reactions, comments with images, pinned posts.
- **Stories** that expire after 24 hours, with views and reactions.
- **Music and film:** live "now playing" from Last.fm, and posts with a member's own Letterboxd reviews.
- **Notifications** with unread badges, an ideas board with up/down votes, member profiles with banners and badges.
- **Invites:** single-use invite links managed by admins; nobody gets in without one.
- **Fellas Games:** a 3D blackjack table (Three.js) with credits, where every rule runs on the server.
- Light and dark themes, a desktop layout with a sidebar, and a phone layout with a bottom tab bar.

## Stack

| Layer | Tech |
| --- | --- |
| App | Expo 57, React Native 0.86, React 19, Expo Router, TypeScript (strict) |
| Backend | Supabase: PostgreSQL, row-level security, RPC functions, triggers, Realtime, Storage, Edge Functions (Deno) |
| Media | Cloudinary (stories), Supabase Storage (post and comment images) |
| Games | Vite + Three.js, game logic in PostgreSQL |
| Hosting | Cloudflare Pages (static SPA + PWA), Android app as a Trusted Web Activity |
| CI/CD | GitHub Actions: typecheck, tests, build and deploy on every push to `main`; weekly encrypted database backup |
| Tests | Jest + Testing Library (React Native), Vitest + PGlite (games) |

## How it's built

- **Security in the database.** Every table has row-level security, so a member can only read and write what the policies allow, whatever the client sends. Derived data (tags, place keys, poll counts) is computed by triggers, and multi-step actions (pinning a post, every game move) go through RPC functions.
- **Server-authoritative games.** Shuffling, dealing, payouts and credits run in PostgreSQL functions, never in the browser. The game tests run the real migrations in PGlite (Postgres compiled to WebAssembly).
- **Edge Functions** fetch a member's Letterboxd reviews and manage story media on Cloudinary, including the 24-hour cleanup.
- **One codebase, three targets.** The web build is a static SPA with client-side routing. Installed clients (PWA and Android) check for a new deploy on launch and on resume, and reload themselves, unless a post is being written.
- **Design system.** All colors, spacing, type and radii come from tokens in `lib/theme.ts`, and screens use shared components from `components/ui`.
- **Versioned migrations.** Every schema change is a numbered, idempotent SQL migration in `supabase/migrations`.

## Quality

- About 1,000 automated tests for the app and about 90 for the games, plus a strict TypeScript typecheck.
- The deploy workflow refuses to publish if the typecheck or any test fails.

## Project structure

```
app/                 screens and routes (Expo Router)
components/          UI: feed, profile, stories, shell, and the shared design system in ui/
lib/                 data access, stores, theme tokens, integrations (Last.fm, Letterboxd)
supabase/migrations  numbered SQL migrations (schema, RLS, triggers, RPCs)
supabase/functions   Edge Functions (Deno)
games/               Fellas Games (Vite + Three.js), deployed under /games/
__tests__/           app tests
```

## Running locally

```bash
npm install
cp .env.example .env   # fill in the variables below
npx expo start         # then: w (web), a (Android) or i (iOS)
```

| Variable | Description |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) key |
| `EXPO_PUBLIC_LASTFM_API_KEY` | Last.fm API key (music features) |
| `EXPO_PUBLIC_DEV_FAKE_LOGIN` | `1` skips login with a fake user, to browse the UI without a Supabase project (dev only) |

`.env` is gitignored; never commit keys. Database setup is in [supabase/README.md](supabase/README.md).

| Command | What it does |
| --- | --- |
| `npm test` | app tests |
| `npx tsc --noEmit` | typecheck |
| `npm run build:web` | static web build in `dist/` |
| `npm test --prefix games` | game rules against the real migrations |

## Credits

Reaction emoji: [Twemoji](https://github.com/jdecked/twemoji) (graphics under CC-BY 4.0). Logo traced from [Monocraft](https://github.com/IdreesInc/Monocraft) (SIL Open Font License 1.1).
