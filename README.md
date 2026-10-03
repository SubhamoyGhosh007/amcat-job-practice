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
- **Accounts (Supabase Auth)**: login with Google, GitHub or email; unique username + 1 of 16 avatars. Same verified email across providers stays on one account, so history follows the person everywhere.
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

## Backend setup: Supabase (auth + Postgres)

The app is 100% static — no server. Supabase handles both identity and data: the publishable key is public by design, and row access is enforced by RLS policies reading your user id out of the validated session JWT. No other backend exists.

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
create table if not exists mock_runs (
  id text primary key,
  user_id text not null,
  day text not null,
  created_at timestamptz not null default now(),
  answers int not null default 0,
  duration_sec int not null default 0,
  unique(user_id, day)
);
alter table mock_runs enable row level security;
drop policy if exists "own_mock_runs" on mock_runs;
create policy "own_mock_runs" on mock_runs for all to authenticated
  using ((auth.jwt() ->> 'sub') = user_id) with check ((auth.jwt() ->> 'sub') = user_id);
```

### Backup codes + daily quotas (2FA recovery, free-tier limits)

Needs `pgcrypto` for salted hashes. Clients can insert/delete their own code rows
but can NEVER update them — burns happen only inside the function, and wrong
guesses are throttled per email:

```sql
create extension if not exists pgcrypto;
create table if not exists mfa_recovery_codes (
  id text primary key,
  user_id text not null,
  salt text not null,
  code_hash text not null,
  used boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists mfa_codes_user_idx on mfa_recovery_codes(user_id);
alter table mfa_recovery_codes enable row level security;
drop policy if exists "own_codes_read" on mfa_recovery_codes;
drop policy if exists "own_codes_write" on mfa_recovery_codes;
drop policy if exists "own_codes_delete" on mfa_recovery_codes;
create policy "own_codes_read" on mfa_recovery_codes for select to authenticated
  using ((auth.jwt() ->> 'sub') = user_id);
create policy "own_codes_write" on mfa_recovery_codes for insert to authenticated
  with check ((auth.jwt() ->> 'sub') = user_id);
create policy "own_codes_delete" on mfa_recovery_codes for delete to authenticated
  using ((auth.jwt() ->> 'sub') = user_id);
create table if not exists recovery_attempts (
  email text primary key,
  fails int not null default 0,
  window_start timestamptz not null default now()
);
alter table recovery_attempts enable row level security;
create or replace function redeem_recovery_code(p_email text, p_code text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_uid text;
  v_code text := upper(regexp_replace(p_code, '[^A-Za-z0-9]', '', 'g'));
  r record;
  v_fails int := 0;
begin
  select fails into v_fails from recovery_attempts
    where email = lower(p_email) and window_start > now() - interval '1 hour';
  if coalesce(v_fails, 0) >= 20 then return false; end if;

  select id::text into v_uid from auth.users where lower(email) = lower(p_email) limit 1;
  if v_uid is null then
    insert into recovery_attempts(email, fails, window_start) values (lower(p_email), 1, now())
    on conflict (email) do update set fails = recovery_attempts.fails + 1,
      window_start = case when recovery_attempts.window_start < now() - interval '1 hour'
        then now() else recovery_attempts.window_start end;
    return false;
  end if;

  for r in select id, salt, code_hash from mfa_recovery_codes
    where user_id = v_uid and used = false loop
    if r.code_hash = encode(digest(r.salt || ':' || v_code, 'sha256'), 'hex') then
      update mfa_recovery_codes set used = true where id = r.id;
      delete from recovery_attempts where email = lower(p_email);
      return true;
    end if;
  end loop;

  insert into recovery_attempts(email, fails, window_start) values (lower(p_email), 1, now())
  on conflict (email) do update set fails = recovery_attempts.fails + 1,
    window_start = case when recovery_attempts.window_start < now() - interval '1 hour'
      then now() else recovery_attempts.window_start end;
  return false;
end; $$;
grant execute on function redeem_recovery_code(text, text) to anon, authenticated;

create table if not exists daily_usage (
  user_id text not null,
  day text not null,
  sets int not null default 0,
  speaking int not null default 0,
  typing int not null default 0,
  primary key (user_id, day)
);
alter table daily_usage enable row level security;
drop policy if exists "own_usage" on daily_usage;
create policy "own_usage" on daily_usage for all to authenticated
  using ((auth.jwt() ->> 'sub') = user_id) with check ((auth.jwt() ->> 'sub') = user_id);
```

Free-tier quotas live in `FREE_QUOTAS` (`src/lib/usage.ts`): 5 sets, 5 speaking sessions,
10 typing tests per day, 1 mock interview (via `mock_runs`). Checks run *before*
effort starts; offline mode is grace mode. The paywall later swaps these per tier. the difficulty columns, run these two lines as well:

```sql
alter table sheets add column if not exists difficulty text not null default 'medium';
alter table sheets add column if not exists origin text not null default 'offline';
```

(The per-feature breakdowns further below document what each table is for.)

**1. Supabase Auth** (supabase.com → your project → Authentication):
- Providers → Email: on. Turn **Confirm email OFF** while friend-testing so register logs straight in (turn it back on for strangers).
- Providers → Google and GitHub: on (paste each OAuth client ID/secret — create those in Google Cloud / GitHub consoles, with redirect URL `https://zyvwfskdqzodfvbekeit.supabase.co/auth/v1/callback`).
- URL Configuration → Site URL: your antideploy URL; add `http://localhost:5173` and the live URL to Redirect URLs.

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

- No third-party auth setup needed: the app signs in directly against Supabase, so session tokens validate natively and RLS just works.
- Rebuild + redeploy with the three `VITE_*` values set.

### Pro tier (granting unlimited access)

Free limits live in `FREE_QUOTAS` (`src/lib/usage.ts`): 5 sets, 5 voice sessions, 10 typing tests, 1 mock/day. Pro bypasses every daily gate. Granting it is one DB flag — no code, no deploy, no payment provider needed yet:

```sql
alter table profiles add column if not exists tier text not null default 'free';
-- grant:
update profiles set tier = 'pro' where username_lower = 'their_username';
-- revoke:
update profiles set tier = 'free' where username_lower = 'their_username';
```

(Easiest without SQL: Supabase dashboard → Table Editor → `profiles` → find the user → set `tier` to `pro`.) The app reads the flag at login and shows a PRO badge in Practice + Settings; mock lock and all quotas lift automatically. Rows without the column read as `free`, so nothing breaks before/after the migration. A real paywall later just moves users between tiers — the checks already read from one place.

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
