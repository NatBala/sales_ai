# Sales AI Hub

## Overview

A unified web application for salespeople featuring 5 AI-powered agents in a pipeline. Built as a pnpm workspace monorepo using TypeScript.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (artifacts/sales-hub, previewPath `/`)
- **Backend**: Express 5 (artifacts/api-server, port 8080)
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: Replit Auth (OIDC PKCE) via `@workspace/replit-auth-web`
- **AI**: OpenAI via Replit AI Integrations (`@workspace/integrations-openai-ai-server`), model `gpt-5.2`
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Routing**: wouter (not react-router)
- **UI**: shadcn/ui components, dark navy/teal theme, framer-motion animations

## AI Agents Pipeline

1. **Lead Me** (`/lead-me`) — Natural language lead generation using AI
2. **Schedule Me** (`/schedule-me/:id`) — AI email drafting & meeting scheduling for a lead
3. **Prep Me** (`/prep-me`) — AI meeting preparation briefs
4. **Engage Me** (`/engage-me`) — Real-time in-meeting intelligence & objection handling
5. **Follow Me** (`/follow-me`) — Post-meeting AI task generation & task management

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server (port 8080)
│   ├── sales-hub/          # React+Vite frontend (previewPath /)
│   └── mockup-sandbox/     # Component preview server
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   ├── db/                 # Drizzle ORM schema + DB connection
│   ├── replit-auth-web/    # useAuth hook (browser OIDC auth state)
│   ├── integrations-openai-ai-server/  # OpenAI client via Replit integrations
│   └── integrations-openai-ai-react/   # React hooks for AI operations
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Database Schema

- `users` — Authenticated users (from Replit Auth)
- `sessions` — Express session storage
- `leads` — Generated/saved leads with name, company, title, score, assets, etc.
- `meetings` — Scheduled meetings linked to leads, with email/prep/notes fields
- `tasks` — Post-meeting action items linked to meetings

## API Routes

All routes mounted under `/api`. Auth endpoints use Replit OIDC.

- `GET /api/healthz` — Health check
- `GET /api/auth/user` — Get current user (or `{user: null}`)
- `GET /api/login` — Begin login flow
- `GET /api/login/callback` — Login callback
- `POST /api/logout` — Logout
- `GET /api/leads` — List user's leads
- `POST /api/leads` — Save a lead
- `GET /api/leads/:id` — Get lead detail
- `GET /api/meetings` — List user's meetings
- `POST /api/meetings` — Create meeting
- `GET /api/meetings/:id` — Get meeting
- `PATCH /api/meetings/:id` — Update meeting
- `GET /api/meetings/:id/tasks` — List tasks
- `POST /api/meetings/:id/tasks` — Create task
- `PATCH /api/tasks/:id/complete` — Mark task complete
- `POST /api/agents/lead-me` — AI lead generation
- `POST /api/agents/schedule-me` — AI email drafting
- `POST /api/agents/prep-me` — AI meeting prep brief
- `POST /api/agents/engage-me` — AI real-time engagement intelligence
- `POST /api/agents/follow-me` — AI follow-up task generation

## Frontend Pages

- `/login` — Login landing page with agent pipeline preview
- `/` — Dashboard with 5 agent cards
- `/leads` — Leads list
- `/leads/:id` — Lead profile detail
- `/lead-me` — AI lead generation interface
- `/schedule-me/:id` — AI email drafting & meeting scheduling
- `/prep-me` — Meeting preparation
- `/engage-me` — Real-time meeting intelligence
- `/follow-me` — Post-meeting task management

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from the root** — run `pnpm run typecheck`
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array

## Key Commands

- `pnpm install` — Install all dependencies
- `pnpm --filter @workspace/db run push` — Push database schema
- `pnpm --filter @workspace/api-spec run codegen` — Regenerate API client from OpenAPI spec
- `pnpm --filter @workspace/api-server run dev` — Run API server
- `pnpm --filter @workspace/sales-hub run dev` — Run frontend
- `pnpm run typecheck` — Full TypeScript type check
