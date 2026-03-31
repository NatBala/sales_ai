# Sales AI

Sales AI is a pnpm workspace monorepo for an AI-assisted sales workflow. It includes a React frontend, an Express API server, shared libraries, and agent flows for lead generation, scheduling, prep, live coaching, meeting support, and follow-up.

## Workspace Apps

- `artifacts/sales-hub`: React 19 + Vite frontend
- `artifacts/api-server`: Express 5 API server
- `lib/*`: shared packages for DB, API schemas, generated clients, auth, and AI integrations
- `scripts`: workspace utilities

## Main Product Areas

- `Lead Me`: lead generation
- `Schedule Me`: meeting scheduling and email drafting
- `Prep Me`: pre-meeting preparation
- `Coach Me`: practice scenarios, realtime coaching, and scorecards
- `Engage Me`: in-meeting support
- `Follow Me`: follow-up task generation

## Requirements

- Node.js 24
- pnpm 9+
- PostgreSQL optional

On Windows, use Git Bash or WSL for commands that rely on POSIX shell behavior.

## Environment

Create a root `.env` file:

```env
DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/sales_hub
AI_INTEGRATIONS_OPENAI_API_KEY=your-openai-api-key
AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1
PORT=8080
```

Notes:

- PostgreSQL is optional. The app falls back to in-memory storage if the database is unavailable.
- The frontend Vite config also requires `PORT`. Run the frontend in a separate shell with a different `PORT` value such as `4000`.

## Install

```bash
pnpm install
```

## Run Locally

Start the API server in one terminal:

```bash
export PORT=8080
export NODE_ENV=development
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/api-server run start
```

Start the frontend in a second terminal:

```bash
export PORT=4000
pnpm --filter @workspace/sales-hub run dev
```

Open `http://localhost:4000`.

The frontend proxies `/api` requests to the API server on `http://localhost:8080`, so both processes need to be running.

## Useful Commands

```bash
pnpm run typecheck
pnpm run build
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/sales-hub run typecheck
pnpm --filter @workspace/db run push
pnpm --filter @workspace/api-spec run codegen
```

## Project Structure

```text
Sales-Navigator/
├── artifacts/
│   ├── api-server/
│   ├── mockup-sandbox/
│   └── sales-hub/
├── lib/
├── scripts/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── tsconfig.json
```

## Development Notes

- Root `package.json` enforces `pnpm`.
- The API server defaults to in-memory behavior when a database is not reachable.
- If port `4000` is taken, run the frontend with another port and update the URL you open locally.
- Frontend changes hot reload. API server changes require rebuild and restart.
