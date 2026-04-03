# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies (must use pnpm)
pnpm install

# Build everything
pnpm run build

# TypeScript typecheck only
pnpm run typecheck

# Build & start API server (port 8080)
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/api-server run start

# Frontend dev server (port 4000 — must differ from API port)
PORT=4000 pnpm --filter @workspace/sales-hub run dev

# Push DB schema migrations
pnpm --filter @workspace/db run push

# Regenerate OpenAPI client from spec
pnpm --filter @workspace/api-spec run codegen

# Component preview sandbox
pnpm --filter @workspace/mockup-sandbox run dev
```

## Environment

Root `.env` file is required:
```
DATABASE_URL=postgresql://...
AI_INTEGRATIONS_OPENAI_API_KEY=sk-...
AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1
PORT=8080
```

The frontend Vite config reads `PORT` from the environment to set its own port, so **always start the frontend with an explicit `PORT=4000`** to avoid colliding with the API server. The frontend proxies `/api` → `http://localhost:8080`.

PostgreSQL is optional — all routes fall back to in-memory storage when the DB is unreachable.

## Architecture

This is a pnpm monorepo with a clear `lib/` vs `artifacts/` split:

- **`artifacts/api-server`** — Express 5 backend (ESM, built with esbuild → `dist/index.mjs`)
- **`artifacts/sales-hub`** — React 19 + Vite frontend
- **`artifacts/mockup-sandbox`** — Component sandbox (dev-only)
- **`lib/db`** — Drizzle ORM schema + PostgreSQL client (`leads`, `meetings`, `tasks`, `sessions` tables)
- **`lib/api-spec`** — OpenAPI spec; source of truth for route shapes
- **`lib/api-zod`** — Zod types auto-generated from the spec
- **`lib/api-client-react`** — Typed fetch client generated from spec, used in frontend
- **`lib/integrations-openai-ai-server`** — Node.js OpenAI wrapper: `speechToText()`, `textToSpeech()`, the `openai` client
- **`lib/integrations-openai-ai-react`** — Browser audio hooks: `useVoiceRecorder`, `useAudioPlayback`, `useVoiceStream`
- **`lib/replit-auth-web`** — OIDC auth context/hooks for the frontend

## Agent Pipeline

Six agents cover the full sales cycle in order:

```
Lead Me → Schedule Me → Prep Me → Coach Me → Engage Me → Follow Me
```

Every agent is **stateless**: the frontend sends full context in the request body; the backend calls GPT and returns structured JSON. All use **GPT** via Replit's OpenAI proxy (`AI_INTEGRATIONS_OPENAI_BASE_URL`).

| Agent | Route | Key I/O |
|---|---|---|
| Lead Me | `POST /api/agents/lead-me` | NL query → ranked advisor list (up to 8) with fit scores |
| Schedule Me (email) | `POST /api/agents/schedule-me` | Advisor context → `{ subject, body }` |
| Schedule Me (voice/Maya) | `POST /api/voice/maya-turn` | Audio blob → Whisper STT → GPT → TTS audio stream |
| Prep Me | `POST /api/agents/prep-me` | Advisor + meeting context → `{ background, agenda[], talkingPoints[], keyObjections[] }` |
| Coach Me | `POST /api/agents/coach-me` | Advisor context → coaching plan; sub-routes for persona, roleplay chat, scorecard |
| Engage Me | `POST /api/realtime/analyze` | Audio clip → Whisper STT → GPT function call → ETF ticker + insight |
| Follow Me | `POST /api/agents/follow-me` | Meeting notes → tasks + follow-up email |

Coach Me has four sub-flows: `/coach-me` (plan), `/coach-me/persona` (generate persona), `/coach-me/persona-chat` (roleplay turn), `/coach-me/scorecard` (evaluate against 6 VG Way stages).

Engage Me monitors 5 Vanguard ETFs (BND, VTI, VOO, VXUS, VNQ) and uses GPT function calling (`show_fund_data`) to surface data panels.

## Backend Key Files

- `artifacts/api-server/src/app.ts` — Express app setup (middleware, CORS, auth chain, route mount)
- `artifacts/api-server/src/routes/agents.ts` — All 6 agent route handlers + advisor CSV data
- `artifacts/api-server/src/routes/voice.ts` — Maya push-to-talk session
- `artifacts/api-server/src/routes/realtime.ts` — Engage Me ETF detection (SSE streaming)
- `artifacts/api-server/build.mjs` — esbuild config (bundles to single ESM file, excludes native/cloud deps)

The advisor database is a CSV string embedded directly in `agents.ts`, parsed on each request.

## Frontend Key Files

- `artifacts/sales-hub/src/hooks/use-agents.ts` — All agent API call hooks
- `artifacts/sales-hub/src/hooks/use-leads.ts` / `use-meetings.ts` — TanStack Query CRUD hooks
- `artifacts/sales-hub/src/pages/` — One page per agent + dashboard, leads list, lead profile
- Routing via **wouter** (not React Router); routes defined in `App.tsx`

## Voice Pipeline

Voice is push-to-talk (not WebRTC streaming). Each turn:
1. Browser records via `MediaRecorder` API (`useVoiceRecorder`)
2. Audio sent as base64-encoded blob to backend
3. Backend: Whisper STT → GPT → TTS
4. Response: SSE stream with base64 audio chunks + transcript events
5. Browser decodes PCM16 and plays via AudioWorklet (`useAudioPlayback`)

## Demo Mode

Auth is stubbed — all data is stored under a hardcoded `DEMO_USER_ID = "demo-user"`. No real OIDC enforcement in the route handlers.

## TypeScript

All packages extend `tsconfig.base.json` (ES2022, strict, bundler module resolution). The root `tsconfig.json` uses project references for the `lib/` packages. Run `pnpm run typecheck` to check libs and artifacts together.
