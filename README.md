# Finance Brain

AI-powered finance operations assistant. Single-user demo built around an
existing Supabase schema (project `qadfaxhbqyfrtjeujmub`) with eleven
manufacturing-flavored tables and ~107 rows of seed data.

## Stack

- Next.js 16 App Router (TypeScript) — installed via `create-next-app@latest`
  on 2026-05-21. The original spec referenced "Next.js 15"; Next 16 is the
  current default and is App Router compatible.
- Tailwind v4 (CSS-based theming in `app/globals.css` — no
  `tailwind.config.ts` anymore).
- shadcn/ui (`base-nova` preset, Lucide icons, `sonner` for toasts).
- Supabase (`@supabase/ssr` for cookie-based auth, service-role client for
  data access from server routes).
- Anthropic SDK (`@anthropic-ai/sdk`), `@vercel/functions` for
  `waitUntil`, `zod`, `date-fns`.

## Setup

1. Copy `.env.local.example` to `.env.local` and fill in the Supabase
   anon key, service-role key, and Anthropic API key.
2. In the Supabase dashboard:
   - Authentication → Providers → Email: toggle **Confirm email OFF**.
   - Authentication → URL Configuration: set Site URL to
     `http://localhost:3000` and allow `http://localhost:3000/**` in the
     redirect allowlist. Add the production domain after deploying.
3. Run the ADDITIONS SQL block from the project spec in the Supabase SQL
   editor before signing in (adds `briefing_time`, `amount_usd`, AI
   triage fields, the `briefings` / `integrations` / `audit_log` tables,
   and tags the seed data).
4. `pnpm install`
5. `pnpm dev`

## Voice input

The quick-capture input in the top bar has a mic icon that uses the
**Web Speech API** (`SpeechRecognition` / `webkitSpeechRecognition`).
Fully browser-native — no transcription API needed.

- Works in: Chrome, Edge, Safari.
- Firefox: the mic button is disabled and the tooltip suggests Chrome.

Click the mic to start, the icon pulses red while recording, click again
to stop. Interim results stream into the input as you speak; press
Enter to submit.

## Project layout

```
app/
  (auth)/login/          – sign-in / sign-up card
  (app)/                 – authenticated shell (Sidebar + TopBar)
    page.tsx             – Dashboard
    inbox/page.tsx       – Inbox placeholder
    tasks/page.tsx       – Tasks placeholder
    memory/page.tsx      – Memory placeholder
    settings/            – Tabs: Profile, Integrations, Demo controls
  api/
    tasks/route.ts       – GET list / POST create
    settings/profile/    – PATCH single executive_profile row
components/
  ui/                    – shadcn primitives
  shell/                 – AppShell, Sidebar, TopBar, QuickCapture (+ mic)
lib/
  supabase.ts            – browser, server (SSR), and service-role clients
  utils.ts               – `cn` helper from shadcn
middleware.ts            – session refresh + auth gate for (app)/*
```

## Auth model

- Single user. The single `executive_profile` row exists and is shared by
  every server route — no per-user join.
- Supabase Auth handles `auth.users`, but the app does not provision a
  separate profile row on sign-up.
- All data reads/writes go through the service-role client in server
  routes. The anon key is used only for auth flows in the browser.

## Notes

- RLS is intentionally disabled on public tables; Supabase's linter will
  flag this and the warning is expected for the demo lifecycle.
- The dashboard / inbox / tasks / memory pages are deliberately bare —
  Sessions 2–8 fill them in.
