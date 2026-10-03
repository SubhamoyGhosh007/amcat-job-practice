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
| Speaking lab (SVAR) | `/app/speaking` | listen/read/repeat, 5/day free |
| Mock interview (7 parts, monitored) | `/app/interview` | gated start, fullscreen, tab-leave dialog, 1/day |
| Maths arena (40Q, 10×4 pages) | `/app/maths` | shadcn pagination, sheet + tricks + PDF, 1 per 4h free |
| Guides (SEO) | `/guides/*`, FAQ band, sitemap | original content only, never paraphrased |
| Auth/profile | `/login`, settings | username + avatar, TOTP 2FA + backup codes, pro tier flag |

Cross-cutting: leaving any live session (sidebar/logout/back/tab-close) **submits it as-is** — rest counts wrong, uses one session from the limit. `leaveGuard` in `src/stores/ui.ts`, enforced in `AppShell`.

## 3. AI provider chain (order matters)

Practice sets: **shared pool → Groq (tier model) → Gemini via VPS proxy → Zen → 120-Q offline bank** (`src/lib/generator.ts`, `src/data/bank.ts`).
Maths pages: **Groq → Gemini proxy** (`src/lib/mathGen.ts`).

- Free tier → `llama-3.1-8b-instant`. Pro → in-UI toggle: `llama-3.3-70b-versatile`, `openai/gpt-oss-120b`, `moonshotai/kimi-k2-instruct` (pick in localStorage).
- Needs `VITE_GROQ_API_KEY` (dashboard + local `.env`; free tier, no billing attached — it ships in the browser bundle).
- Verified 2026-10-03: `gemini-3.5-flash` + `gemini-3.6-flash` return 200; `gemini-3.8-flash` is RPD-starved (2/day free); `gemini-2.5-*` is **gated for new accounts** (generate 404s); `gemini-3-flash` doesn't exist. Re-verify IDs from the VPS before trusting any model name.
- Pollinations.ai was tested and **removed**: truncates long JSON (~77 chars) after ~47s. Do not re-add without re-testing a full 30Q prompt.

## 4. Quotas & tiers

Free: 5 sets, 5 speaking, 10 typing /day; 1 mock/day; 1 maths /4h. **Pro (`profiles.tier='pro'`) = unlimited everything + model toggle.** Grant via SQL or dashboard Table Editor. Checks run *before* effort; offline = grace mode. Maths quota is cloud (`math_sessions`) truth + local mirror.

## 5. Money track (AdSense)

Done: meta pack, JSON-LD (WebSite + EducationalApplication + FAQPage + per-guide Article), sitemap/robots, Search Console verified, sitemap submitted, 3 original guides with hand-drawn SVG graphics. Still needed: more indexed pages + traffic + backlinks, then AdSense application (verification tag → embed → deploy, same as Search Console flow).

## 6. Pending / watch list

- [ ] Run `math_sessions` SQL (README consolidated block) — cloud maths history + quota truth.
- [ ] Create Groq key, set `VITE_GROQ_API_KEY` (dashboard + local `.env`).
- [ ] Decide: Google Tier 1 billing (paise/month at this volume) vs living on Groq-free + bank.
- [ ] AdSense when traffic justifies it; share-image for link previews if wanted.
- [ ] VPS: keep `--workers 4`, `GEMINI_TIMEOUT=240`; `GEMINI_MODELS` must list every model the app sends or the sidecar 400s.

## 7. Agent conventions (how to work here)

- `npm run build` must pass (`tsc --noEmit` + vite). Commit + push `main`, then deploy via Antideploy API (tar excluding `.git`/`node_modules`, poll watch URL to `succeeded`). Never print the deploy token or any key.
- Never commit `.env`. `VITE_*` changes need a dashboard-secret update **plus** a rebuild to take effect.
- Local-first storage with best-effort cloud sync; never break offline mode.
- No paraphrased/copied content anywhere (AdSense rule). Graphics are hand-drawn SVG.
- Keep UI strings human (`src/lib/friendly.ts`) — raw ids, model names, and SQL talk never reach users.
- Test every fix against the real failure (VPS logs, browser console, Google AI Studio bars) before declaring done.
