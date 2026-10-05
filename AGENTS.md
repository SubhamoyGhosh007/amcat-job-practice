# AMCAT Practice — Project Plan

Free Concentrix AMCAT prep app for a friend, open to every aspirant.
Live: https://amcat-practice.antideploy.app · Repo: `SubhamoyGhosh007/amcat-job-practice` (branch `main`).

## 1. Architecture (do not redesign without asking)

- **Static Vite + React + TS SPA** (`G:\Projects\AMCAT`, `dist/` build). No backend in the repo — ever.
- **Supabase** (`zyvwfskdqzodfvbekeit`) = Auth (Google/GitHub/email) + Postgres with RLS. Anon/publishable key is public by design; RLS does the protecting.
- **VPS** (`pipertts.subhamoyghosh.me`, project `~/pipertts`, Caddy + uvicorn sidecar) = Piper TTS (`POST /speak`) + Gemini proxy (`POST /gemini`, key only in server env). Single uvicorn worker + blocking urllib → keep `--workers 4`; keep `GEMINI_TIMEOUT` ≥ 240 for big generations.
- **Hosting**: Antideploy app `2e15c3b6-8f4b-4b1c-8047-b7370da52c2a`, GitHub-connected. `VITE_*` bake at build time. `~/.antideploy/config.json` holds the deploy token (never print it, never commit it).

## 2. Feature map (all shipped)

| Area | Route | Notes |
|---|---|---|
| Practice sets (full-paper, grouped by section) | `/app` → `/app/instructions` → `/app/exam` → `/app/result` | 30Q, answer script + PDFs, difficulty + PYQ mode |
| Typing arena | `/app/typing` | WPM/acc/consistency, history, 10/day free |
| Speaking lab (SVAR) | `/app/speaking` | listen practice + recorded sessions (6 read + 6 repeat, fixed 45s/25s limits), one marks report per session (Whisper turbo + clarity/coverage/pace), report PDF, dashboard mirror |
| Mock interview (7 parts, monitored) | `/app/interview` | gated start, fullscreen, tab-leave dialog, 1/day |
| Maths arena (40Q, 10×4 pages) | `/app/maths` | shadcn pagination, sheet + tricks + PDF, 1 per 4h free |
| Guides (SEO) | `/guides/*`, FAQ band, sitemap | original content only, never paraphrased |
| Auth/profile | `/login`, settings | username + avatar, TOTP 2FA + backup codes, pro tier flag |

Cross-cutting: leaving any live session (sidebar/logout/back/tab-close) **submits it as-is** — rest counts wrong, uses one session from the limit. `leaveGuard` in `src/stores/ui.ts`, enforced in `AppShell`. Every session type (exam, mock, typing, speaking) must call `setLeaveGuard` when active and `setLeaveGuard(null)` on finish.

## 3. AI provider chain (order matters)

Practice sets: **shared pool → Groq (tier model) → Gemini via VPS proxy → Zen → 120-Q offline bank** (`src/lib/generator.ts`, `src/data/bank.ts`).
Maths pages: **Groq → Gemini proxy** (`src/lib/mathGen.ts`).

- Free + Pro → `openai/gpt-oss-120b` (verified 2026-10-03: the only Groq ID answering on this account; all llama/kimi IDs 404). Rotation machinery in `groq.ts` stays — if it ever dies, append the replacement ID. Model choice is backend-only — never show model pickers or model names in the UI.
- Needs `VITE_GROQ_API_KEY` (dashboard + local `.env`; free tier, no billing attached — it ships in the browser bundle).
- Verified 2026-10-03: `gemini-3.5-flash` + `gemini-3.6-flash` return 200; `gemini-3.8-flash` is RPD-starved (2/day free); `gemini-2.5-*` is **gated for new accounts** (generate 404s); `gemini-3-flash` doesn't exist. Re-verify IDs from the VPS before trusting any model name.
- Pollinations.ai was tested and **removed**: truncates long JSON (~77 chars) after ~47s. Do not re-add without re-testing a full 30Q prompt.

## 4. Quotas & tiers

Free: 5 sets, 5 speaking, 10 typing /day; 1 mock/day; 1 maths /4h. **Pro (`profiles.tier='pro'`) = unlimited everything.** Grant via SQL or dashboard Table Editor. Checks run *before* effort; offline = grace mode. Maths quota is cloud (`math_sessions`) truth + local mirror.

## 5. Question pool & shared bank design

**Token efficiency rule**: a set generated for one user is published to the shared pool and served to all other users of the **same tier** who have not yet attempted it. When every pooled set for that (difficulty, source, tier) is exhausted, a fresh AI set is generated and published back.

- `shared_sets` has a `tier TEXT CHECK (tier IN ('free','pro'))` column. Free pool and Pro pool are strictly separate — a free user never sees a pro-generated set and vice versa.
- `set_attempts` records per-user completions and is used to exclude already-seen sets via a **JS-side `Set` filter** (never send a `.not('id','in',…)` filter — odd ids 400 the query string).
- `times_used` must be incremented atomically via `rpc('increment_set_usage', { set_id })` — never a read-then-write UPDATE.
- `generator.ts` reads `useSession.getState().profile?.tier ?? 'free'` and passes it to both `fetchUnattempted` and `publishSet`.
- The second pass in `fetchUnattempted` (source fallback to `null`) must still respect the tier filter.

**Mock interview pool**: `mock_tests` table stores full test section JSON per tier. `mock_test_attempts` tracks per-user completions (UNIQUE constraint). `Interview.tsx` calls `fetchUnattemptedMockTest(userId, tier)` on mount and uses that test; falls back to the static `MOCK_TEST_01` if the table is empty, the user has attempted all tests, or the app is offline. Seed `MOCK_TEST_01` into the table on first deploy (INSERT ... ON CONFLICT DO NOTHING). When a future AI-generated mock is created, `publishMockTest` writes it to the pool.

## 6. Session leave-guard (universal — all session types)

Every live session — practice exam, mock interview, typing arena, speaking lab — MUST register a `leaveGuard`:

```ts
setLeaveGuard({ confirmLeave: () => finalizeSession() });
// On finish / submit:
setLeaveGuard(null);
```

The guard is consulted by:
- Sidebar `GuardedLink` (all nav clicks)
- `doLogout` in `AppShell`
- `beforeunload` (tab close / reload) — must set `e.returnValue = ''` for native browser dialog to appear
- Back-button `popstate` — push a history entry on session start, intercept popstate

Warning popup copy (consistent for all sessions):
> **Leave and submit?**
> Leaving now will submit this session as-is: unanswered items count as wrong, and it uses **1 session from your daily limit**.

Pages with `setLeaveGuard` wired up (all done — verify on sight, do not re-add):
- `src/pages/Interview.tsx` — gated start, finalize-saves on leave (uses daily slot)
- `src/pages/AdaptiveExam.tsx` — wire when `activeSet` is loaded; clear on finish
- `src/pages/MathPractice.tsx` — wire while answering; finalize saves the sheet
- `src/pages/Typing.tsx` — wire when the timer starts; clear on submit
- `src/pages/Svar.tsx` — wire when recordings exist unsubmitted; leave counts one voice session

## 7. Rate limiting

**VPS sidecar** (`/gemini`, `/speak`): sliding-window per `X-User-Id` header (sent from `tts.ts` `geminiViaProxy`):
- `/gemini` → 10 req / 60 s / user
- `/speak`  → 30 req / 60 s / user
Return HTTP 429 `{"error":"rate_limit"}` on excess; `tts.ts` already surfaces 429 to the caller.

**Client-side leaky bucket** (`src/lib/rateLimiter.ts` — new file): guard `generateSet()` and `generateMathPage()`. Capacity 5 tokens, refill 1 token / 10 s. Prevents rapid tab cycling from spamming AI calls before cloud quotas respond.

**Supabase quota bumps**: replace read-then-write in `bumpQuota` (`usage.ts`) with `rpc('increment_quota', { p_user_id, p_day, p_kind })` — single atomic round-trip, no race window.

## 8. UI error message rules

- **Never** show raw `error.message`, Supabase codes (`PGRST*`), table names, model IDs, SQL, or stack traces in the UI.
- All user-visible error strings go through `src/lib/friendly.ts`.
- `console.warn` / `console.info` is fine for developer debugging — never pipe them into `useState` or JSX.
- Required `friendly.ts` entries (add if missing): quota exceeded, AI generation failed, network error, session expired, camera blocked, mic blocked, rate limited.
- In `generator.ts` the `console.warn` that prints provider name + raw error is fine for dev — but the error surfaced to the UI (e.g., in a banner) must be a friendly string only.

## 9. Money track (AdSense)

Done: meta pack, JSON-LD (WebSite + EducationalApplication + FAQPage + per-guide Article), sitemap/robots, Search Console verified, sitemap submitted, 3 original guides with hand-drawn SVG graphics. Still needed: more indexed pages + traffic + backlinks, then AdSense application (verification tag → embed → deploy, same as Search Console flow).

## 10. Pending / watch list

- [ ] Run schema SQL block below (Supabase dashboard → SQL editor, once): `shared_sets.tier` column + index, `increment_set_usage` RPC, `increment_quota` RPC, `mock_tests` + `mock_test_attempts` tables, RLS policies. Code already uses all of them with pre-SQL fallbacks, so the app works before and after.
- [ ] Seed `MOCK_TEST_01` into `mock_tests` — automatic: the app self-seeds per tier on first pool miss. No action needed unless you want it pre-seeded.
- [x] Fix critical bugs A1–A7 — done 2026-10-03: native-array `.not('id','in',doneIds)` (A1), string-aware `extractJson` in `genUtils.ts` (A3), atomic `times_used` via RPC w/ fallback, tier-separated pool w/ fallback, mock pool w/ static fallback, client leaky bucket, `increment_quota` RPC w/ fallback, `friendly.ts` error strings everywhere, `e.returnValue=''` in `beforeunload`.
- [x] Wire `setLeaveGuard` in `AdaptiveExam.tsx`, `Typing.tsx`, `Svar.tsx` (+ `MathPractice.tsx`) — done, finalize-submits on leave.
- [x] Add `e.returnValue = ''` to `beforeunload` handler in `AppShell.tsx` — done.
- [ ] Create Groq key, set `VITE_GROQ_API_KEY` (dashboard + local `.env`).
- [x] Sliding-window rate limiter on VPS sidecar (`~/pipertts`) — done 2026-10-03: `check_rate_limit` per `X-User-Id` (`/gemini` 10/60s, `/speak` 30/60s, 429 `rate_limit`); app sends the header; CORS allows it. Rebuild with `--build` after any `.py` edit (code is baked into the image).
- [ ] Decide: Google Tier 1 billing (paise/month at this volume) vs living on Groq-free + bank.
- [ ] AdSense when traffic justifies it; share-image for link previews if wanted.
- [ ] VPS: keep `--workers 4`, `GEMINI_TIMEOUT=240`; `GEMINI_MODELS` must list every model the app sends or the sidecar 400s.

## 11. Agent conventions (how to work here)

- `npm run build` must pass (`tsc --noEmit` + vite). Commit + push `main`, then deploy via Antideploy API (tar excluding `.git`/`node_modules`, poll watch URL to `succeeded`). Never print the deploy token or any key.
- Never commit `.env`. `VITE_*` changes need a dashboard-secret update **plus** a rebuild to take effect.
- Local-first storage with best-effort cloud sync; never break offline mode.
- No paraphrased/copied content anywhere (AdSense rule). Graphics are hand-drawn SVG.
- Keep UI strings human (`src/lib/friendly.ts`) — raw ids, model names, and SQL talk never reach users.
- Test every fix against the real failure (VPS logs, browser console, Google AI Studio bars) before declaring done.
- When fixing any Supabase write that needs atomicity (counters, quotas), use an RPC — never read-then-write.
- `extractJson()` in `generator.ts` is the canonical JSON extractor — import it in `mathGen.ts`; do not duplicate.
- Shared utilities (`uid`, `shuffle`, `recentAvoid`, `rememberAvoid`) must live in `src/lib/genUtils.ts` — not copy-pasted per file.
- Supabase exclusion filters (`.not(x,'in',…)`) are banned — filter in JS instead.
