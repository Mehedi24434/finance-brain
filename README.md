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

## Telegram bot

The bot delivers daily briefings, urgent-email alerts, and accepts
voice quick-capture from your phone.

### One-time setup

1. Create a bot via [@BotFather](https://t.me/BotFather), copy the
   token, then chat with [@userinfobot](https://t.me/userinfobot) to get
   your numeric user id.
2. Set these env vars (locally in `.env.local`, on Vercel as project env):
   - `TELEGRAM_BOT_TOKEN` — from BotFather
   - `TELEGRAM_USER_ID` — your numeric Telegram user id
   - `TELEGRAM_WEBHOOK_SECRET` — any ~32-char random string
   - `OPENAI_API_KEY` — for Whisper voice transcription
   - `NEXT_PUBLIC_APP_URL` — your https Vercel domain (or ngrok URL for
     local dev)
3. Register the webhook against your deployed URL:
   ```
   pnpm register-telegram
   ```
   This calls Telegram's `setWebhook` to route updates to
   `${NEXT_PUBLIC_APP_URL}/api/webhooks/telegram/${TELEGRAM_WEBHOOK_SECRET}`.
4. Open the app's **Settings → Integrations → Telegram**, click
   **Link Telegram**. (This writes `TELEGRAM_USER_ID` into
   `executive_profile.telegram_user_id` — it's the gate that allows the
   app to send outbound messages.)

To remove the webhook later: `pnpm delete-telegram-webhook`.

### Commands

- `/briefing` — generate and send today's exec briefing
- `/capture <text>` — quick-capture a task (no parsing)
- `/help` — full command list

Free-form text and voice messages are interpreted via Claude
(`extract_tasks`). Voice notes go through OpenAI Whisper first; if
transcription fails, the original audio URL is saved on a stub task.

### Where messages come from

- **`/api/briefing`** with `{ deliver: true }` → sends the
  `executive_summary` to your chat.
- **`/api/inbox/[id]/triage`** for items classified as `urgent` with
  `finance_risk=true` → sends an immediate alert with sender/subject.

The outbound `sendMessage` is gated on the DB column being set, so
nothing leaks until you've explicitly clicked **Link Telegram**.

## Project layout

```
app/
  (auth)/login/                       – sign-in / sign-up card
  (app)/                              – authenticated shell
    page.tsx                          – Dashboard
    inbox/, tasks/, memory/           – list pages
    tasks/[id]/                       – task detail
    settings/                         – Profile / Integrations / Demo controls
  api/
    tasks/, followups/                – CRUD + per-item actions
    inbox/[id]/triage                 – Claude triage of one item
    inbox/triage-all                  – batch triage
    briefing                          – GET today / POST generate
    settings/profile, integrations/   – profile + integration toggles
    webhooks/telegram/[secret]        – Telegram webhook entry
components/
  ui/                                 – shadcn primitives
  shell/                              – AppShell, Sidebar, TopBar, QuickCapture
  dashboard/                          – panels, ItemCard, FilterChips, …
lib/
  supabase/                           – browser + server + service clients
  panels.ts                           – open-set, severity, score, formatters
  prompts.ts                          – Claude task definitions
  claude.ts                           – callClaude + persistent context loader
  triage.ts                           – triageInboxItem helper
  briefing-service.ts                 – generateBriefing helper
  telegram.ts                         – sendMessage + handleUpdate
  telegram-auth.ts                    – env-gated user check
scripts/
  register-telegram-webhook.ts        – tsx one-off setWebhook helper
proxy.ts                              – session refresh + auth gate for (app)/*
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
