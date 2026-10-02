# Concentrix AMCAT Practice

Minimal AMCAT-style practice app for the Concentrix hiring exam. Built for a friend to practise anytime.

- 4 sections, separately timed (like real AMCAT): English 8Q/8min, Quant 8Q/9min, Logical 7Q/8min, Customer-Service situational 7Q/7min — 30 questions total.
- AMCAT-like UI: top timer, section tabs, question palette (green/purple), mark for review, no back-navigation across sections.
- No video / no speaking module — written MCQ only.
- After finish: score + section breakdown + full **answer script with explanations**.
- **New set every attempt**: AI generates a fresh seeded set and avoids recent questions; offline bank fallback shuffles automatically.
- **Typing arena** (`/app/typing`): monkeytype-style — time (15/30/60s) and word (10/25/50) modes, live WPM/accuracy, Tab to restart, results with raw/consistency/character breakdown, every test saved to history with best/average.
- **Speaking & listening lab** (`/app/speaking`): SVAR-style — listen & answer with transcripts revealed, read-aloud with mic recording, repeat-after-me side-by-side. Runs on your self-hosted Piper TTS voice server (`VITE_TTS_URL` + `VITE_TTS_TOKEN`); read-aloud works without it. See "Voice server" below.
- **Mock interview** (`/app/interview`): full 7-part spoken exam — short answers, situations, read-aloud, repeat, 30s+60s extempore, spoken cloze, grammar correction. Once-only audio, per-answer timers, session history.
- **Landing page (Aceternity-style)**: dark spotlight hero with a playable demo question, exact-pattern cards, syllabus marquee, 3-step flow, answer-script preview, login band. No test without login.
- **Accounts (required, Clerk)**: login with Google, GitHub, Facebook or email; unique username + 1 of 16 avatars. Clerk merges same-email logins into one account, so history follows the person everywhere.
- **Score sheets**: every attempt auto-saves (browser always, cloud when logged in). **My sheets** page shows attempts/best/average trend, review, delete.
- **PDF downloads**: test report card + full Q&A sheet with explanations as notes (jsPDF, generated on-device).
- **Settings page**: username, avatar, linked logins, erase-local-data, logout.
- **Health check page**: plain-English status (account, score backup, questions) — no technical details.
- Login is mandatory for tests — logged-out visitors only see the landing page. Design guidance: `anthropics/skills@frontend-design` (installed under `.agents/skills/`).
- **App shell**: React Router (`/`, `/login`, `/app`, `/app/instructions`, `/app/exam`, `/app/result`, `/app/sheets`, `/app/settings`) with route guards — refreshing mid-exam safely returns to Practice. Global state in zustand (`session`, `exam`, `ui`); exam timer/answers stay local to the page. Shadcn-style collapsible sidebar (icons on desktop, drawer on mobile), Tailwind utilities available without the global reset.

## Question generation (.env, fixed models)

Copy `.env.example` to `.env` and fill in ONE key (`.env` is gitignored, never committed).
The app never asks for keys or models in the UI.

- `VITE_AI_PROVIDER=gemini` → Google AI Studio key (`aistudio.google.com`). **Use this for AI sets in the browser.** Model tries `VITE_GEMINI_MODEL` first, then falls back to `gemini-2.0-flash` automatically.
- `VITE_AI_PROVIDER=zen` → OpenCode Zen key — **server-side only**. Zen's API blocks browser origins (CORS), so in this app it always falls back to the offline bank. Keep it for agents/servers.
- `VITE_AI_PROVIDER=offline` (or empty key) → 40-question built-in bank, shuffled per set. Works with zero config. If a set ever shows source `offline-bank` unexpectedly, the AI call was blocked — check the provider note above.

Heads-up: Vite bakes `VITE_*` values into the browser bundle at build time, so treat the key as public — set a spend limit (Zen) / referrer restriction (Gemini).

## Backend setup: Clerk (auth) + Supabase (Postgres)

The app is 100% static — no server. Clerk owns identity (its publishable key is public by design); Supabase owns data (anon key is public; row access is enforced by RLS policies reading your Clerk user id out of the validated session JWT).

### All tables in one go (copy-paste into Supabase → SQL editor → Run)

```sql
create table if not exists profiles (
  id text primary key,
  email text not null default '',
  username text not null,
  username_lower text not null unique,
  avatar_id int not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists sheets (
  id text primary key,
  user_id text not null,
  email text not null default '',
  username text not null default '',
  set_id text not null,
  source text not null default '',
  difficulty text not null default 'medium',
  origin text not null default 'offline',
  created_at timestamptz not null default now(),
  total int not null, correct int not null, pct int not null,
  sections jsonb not null default '{}',
  answers jsonb not null default '{}',
  questions jsonb not null default '[]'
);
create index if not exists sheets_user_idx on sheets(user_id);
alter table profiles enable row level security;
alter table sheets enable row level security;
drop policy if exists "own_profile_read" on profiles;
drop policy if exists "own_profile_write" on profiles;
drop policy if exists "own_sheets_read" on sheets;
drop policy if exists "own_sheets_write" on sheets;
drop policy if exists "own_sheets_delete" on sheets;
create policy "own_profile_read" on profiles for select to authenticated using (true);
create policy "own_profile_write" on profiles for all to authenticated
  using ((auth.jwt() ->> 'sub') = id) with check ((auth.jwt() ->> 'sub') = id);
create policy "own_sheets_read" on sheets for select to authenticated
  using ((auth.jwt() ->> 'sub') = user_id);
create policy "own_sheets_write" on sheets for insert to authenticated
  with check ((auth.jwt() ->> 'sub') = user_id);
create policy "own_sheets_delete" on sheets for delete to authenticated
  using ((auth.jwt() ->> 'sub') = user_id);
create table if not exists typing_tests (
  id text primary key,
  user_id text not null,
  created_at timestamptz not null default now(),
  mode text not null,
  amount int not null,
  duration_sec numeric not null,
  wpm int not null, raw int not null, acc int not null, consistency int not null,
  c_correct int not null, c_incorrect int not null, c_extra int not null, c_missed int not null
);
create index if not exists typing_user_idx on typing_tests(user_id);
alter table typing_tests enable row level security;
drop policy if exists "own_typing_read" on typing_tests;
drop policy if exists "own_typing_write" on typing_tests;
drop policy if exists "own_typing_delete" on typing_tests;
create policy "own_typing_read" on typing_tests for select to authenticated
  using ((auth.jwt() ->> 'sub') = user_id);
create policy "own_typing_write" on typing_tests for insert to authenticated
  with check ((auth.jwt() ->> 'sub') = user_id);
create policy "own_typing_delete" on typing_tests for delete to authenticated
  using ((auth.jwt() ->> 'sub') = user_id);
create table if not exists shared_sets (
  id text primary key,
  created_by text not null default '',
  created_at timestamptz not null default now(),
  difficulty text not null default 'medium',
  source text not null default 'ai',
  questions jsonb not null default '[]',
  times_used int not null default 0
);
create index if not exists shared_sets_lookup_idx on shared_sets(difficulty, source, times_used);
alter table shared_sets enable row level security;
drop policy if exists "pool_read" on shared_sets;
drop policy if exists "pool_write" on shared_sets;
create policy "pool_read" on shared_sets for select to authenticated using (true);
create policy "pool_write" on shared_sets for all to authenticated using (true) with check (true);
create table if not exists set_attempts (
  id text primary key,
  user_id text not null,
  set_id text not null,
  created_at timestamptz not null default now(),
  correct int not null, total int not null, pct int not null,
  unique(user_id, set_id)
);
alter table set_attempts enable row level security;
drop policy if exists "own_attempts" on set_attempts;
create policy "own_attempts" on set_attempts for all to authenticated
  using ((auth.jwt() ->> 'sub') = user_id) with check ((auth.jwt() ->> 'sub') = user_id);
```

If your `sheets` table predates the difficulty columns, run these two lines as well:

```sql
alter table sheets add column if not exists difficulty text not null default 'medium';
alter table sheets add column if not exists origin text not null default 'offline';
```

(The per-feature breakdowns further below document what each table is for.)

**1. Clerk** (clerk.com → create application):
- API keys → copy the **publishable key** → `VITE_CLERK_PUBLISHABLE_KEY`.
- User & authentication → Email: on. Social connections: enable Google, GitHub, Facebook (paste each provider's OAuth client ID/secret — create those in Google Cloud / GitHub / Meta consoles).
- Paths/redirects: add `http://localhost:5173` and your antideploy URL as allowed origins/redirects.

**2. Supabase** (supabase.com → create project):
- Project Settings → API → copy **Project URL** (`VITE_SUPABASE_URL`) and the **publishable key** (`sb_publishable_...`, into `VITE_SUPABASE_ANON_KEY`). Legacy anon keys die end of 2026 — use publishable now. The **secret** key (`sb_secret_...`) must never enter the app.
- SQL editor → run this once (tables + row security so users only touch their own rows):

```sql
create table if not exists profiles (
  id text primary key,
  email text not null default '',
  username text not null,
  username_lower text not null unique,
  avatar_id int not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists sheets (
  id text primary key,
  user_id text not null,
  email text not null default '',
  username text not null default '',
  set_id text not null,
  source text not null default '',
  created_at timestamptz not null default now(),
  total int not null, correct int not null, pct int not null,
  sections jsonb not null default '{}',
  answers jsonb not null default '{}',
  questions jsonb not null default '[]'
);
create index if not exists sheets_user_idx on sheets(user_id);
alter table profiles enable row level security;
alter table sheets enable row level security;
drop policy if exists "own_profile_read" on profiles;
drop policy if exists "own_profile_write" on profiles;
drop policy if exists "own_sheets_read" on sheets;
drop policy if exists "own_sheets_write" on sheets;
drop policy if exists "own_sheets_delete" on sheets;
create policy "own_profile_read" on profiles for select to authenticated using (true);
create policy "own_profile_write" on profiles for all to authenticated
  using ((auth.jwt() ->> 'sub') = id) with check ((auth.jwt() ->> 'sub') = id);
create policy "own_sheets_read" on sheets for select to authenticated
  using ((auth.jwt() ->> 'sub') = user_id);
create policy "own_sheets_write" on sheets for insert to authenticated
  with check ((auth.jwt() ->> 'sub') = user_id);
create policy "own_sheets_delete" on sheets for delete to authenticated
  using ((auth.jwt() ->> 'sub') = user_id);
```

### Typing tests table (for the typing arena history)

```sql
create table if not exists typing_tests (
  id text primary key,
  user_id text not null,
  created_at timestamptz not null default now(),
  mode text not null,
  amount int not null,
  duration_sec numeric not null,
  wpm int not null, raw int not null, acc int not null, consistency int not null,
  c_correct int not null, c_incorrect int not null, c_extra int not null, c_missed int not null
);
create index if not exists typing_user_idx on typing_tests(user_id);
alter table typing_tests enable row level security;
drop policy if exists "own_typing_read" on typing_tests;
drop policy if exists "own_typing_write" on typing_tests;
drop policy if exists "own_typing_delete" on typing_tests;
create policy "own_typing_read" on typing_tests for select to authenticated
  using ((auth.jwt() ->> 'sub') = user_id);
create policy "own_typing_write" on typing_tests for insert to authenticated
  with check ((auth.jwt() ->> 'sub') = user_id);
create policy "own_typing_delete" on typing_tests for delete to authenticated
  using ((auth.jwt() ->> 'sub') = user_id);
```

### Shared question pool (difficulty + PYQ modes)

Generated sets are published here; each learner is served a set they have **not** attempted yet, and a fresh AI set is generated + shared when the pool runs dry for that combo:

```sql
create table if not exists shared_sets (
  id text primary key,
  created_by text not null default '',
  created_at timestamptz not null default now(),
  difficulty text not null default 'medium',
  source text not null default 'ai',
  questions jsonb not null default '[]',
  times_used int not null default 0
);
create index if not exists shared_sets_lookup_idx on shared_sets(difficulty, source, times_used);
alter table shared_sets enable row level security;
drop policy if exists "pool_read" on shared_sets;
drop policy if exists "pool_write" on shared_sets;
create policy "pool_read" on shared_sets for select to authenticated using (true);
create policy "pool_write" on shared_sets for all to authenticated using (true) with check (true);
create table if not exists set_attempts (
  id text primary key,
  user_id text not null,
  set_id text not null,
  created_at timestamptz not null default now(),
  correct int not null, total int not null, pct int not null,
  unique(user_id, set_id)
);
alter table set_attempts enable row level security;
drop policy if exists "own_attempts" on set_attempts;
create policy "own_attempts" on set_attempts for all to authenticated
  using ((auth.jwt() ->> 'sub') = user_id) with check ((auth.jwt() ->> 'sub') = user_id);
```

Notes: difficulty (easy/medium/hard) only reshapes the AI prompt mix; **PYQ mode serves recalled previous-year questions** (models can't browse from a static page — a live-search upgrade would need a search-API key later). Downloads (report + Q&A PDFs with explanations) work for every mode and stamp difficulty + origin.

- Supabase → Authentication → Third-Party Auth → **Add new Clerk connection** with your Clerk domain (`https://<...>.clerk.accounts.dev` from Clerk's API keys page), then complete Clerk's **Connect with Supabase** page (it adds the claim Supabase validates to your session tokens). No extra code or token template is needed — the app uses the standard login token.
- Rebuild + redeploy with the three `VITE_*` values set.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build   # outputs dist/
```

## Voice server (self-hosted Piper TTS, for the speaking lab)

The app speaks through your own VPS — no vendor, no per-word billing:

1. On the VPS, run `rhasspy/wyoming-piper` in Docker for the voice models, plus a tiny FastAPI sidecar (`tts_server.py`) exposing `GET /health`, `GET /voices`, `POST /speak` (WAV bytes, `X-TTS-Token` header, 3000-char cap).
2. Put Caddy in front for automatic HTTPS (`reverse_proxy tts:8000`), firewall to 80/443, and keep Piper off public ports.
3. In the app: `VITE_TTS_URL=https://pipertts.yourdomain.com` + `VITE_TTS_TOKEN` (same token as the server). Sentence audio is cached per text, so repeats are instant.

## Deploy on antideploy.com (static, ~1 min)

This is a pure static Vite site — ideal for Antideploy (no Dockerfile, no env vars, no DB):

1. Option A — dashboard upload: open antideploy.com dashboard → Upload folder → pick this project folder (or the `dist/` output). Antideploy detects Vite/static, builds, gives you `https://yourapp.antideploy.com`.
2. Option B — GitHub: push this folder to a repo → Antideploy dashboard → Repositories → connect repo. Every push redeploys.
3. Set the same `VITE_*` values as secrets/env vars in the antideploy dashboard BEFORE building, so the deployed build bakes in your key (`.env` itself is gitignored and won't be in the repo).

Docs: `https://antideploy.com/docs/quickstart` and contract `https://antideploy.com/llms.txt`.
