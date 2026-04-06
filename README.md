# Sales AI Hub

AI-powered sales platform for financial services, built for Vanguard and Capital Group advisor teams. Six sequential AI agents cover the full sales cycle from lead discovery to follow-up, with Ask Maya — a voice assistant that navigates the entire pipeline hands-free.

## Agent Pipeline

```
Lead Me → Schedule Me → Prep Me → Coach Me → Engage Me → Follow Me
```

| Agent | What it does |
|---|---|
| Lead Me | Natural language search across the advisor dataset — returns ranked leads with fit scores |
| Schedule Me | Drafts outreach emails and runs AI voice calls (Maya) to book meetings |
| Prep Me | Generates meeting background, agenda, talking points, and objection prep |
| Coach Me | Live roleplay practice against AI advisor personas with scorecard grading |
| Engage Me | Real-time ETF detection during live meetings — surfaces data panels on voice trigger |
| Follow Me | Converts meeting notes into tasks and a follow-up email draft |
| Ask Maya | Voice assistant — speak a command to search leads, navigate agents, or prep for a meeting |

## Deployments

All deployed URLs for CG, VG, Email Me, Sales Coach, and landing pages are in `links.txt`.

## Repository Structure

```
salesai_app/
├── cg_v2/                  # Capital Group codebase (pnpm monorepo) — active
│   ├── artifacts/
│   │   ├── api-server/     # Express 5 backend (ESM)
│   │   └── sales-hub/      # React 19 + Vite frontend
│   └── lib/                # Shared packages (DB, API spec, AI integrations)
├── vg/                     # Vanguard codebase (same structure as cg_v2/)
├── sales_coach_v3/         # Digital Sales Coach (Python/FastAPI + voice roleplay)
├── salesai_landing_cg/     # Capital Group landing page (React + Vite)
├── salesai_landing_vg/     # Vanguard landing page (React + Vite)
└── links.txt               # All deployed URLs at a glance
```

## Tech Stack

**Frontend:** React 19, Vite, TanStack Query, Tailwind CSS, wouter
**Backend:** Express 5 (ESM), esbuild, Drizzle ORM
**Sales Coach:** Python 3.10, FastAPI, Gunicorn + Uvicorn
**AI:** OpenAI GPT (chat, realtime, Whisper STT, TTS)
**Infrastructure:** Azure App Service, Azure Static Web Apps, PostgreSQL
**Monorepo:** pnpm workspaces

## Local Development

### VG / CG Apps

```bash
# From vg/ or cg_v2/ directory
pnpm install

# Start API server (port 8080)
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/api-server run start

# Start frontend (port 4000)
PORT=4000 pnpm --filter @workspace/sales-hub run dev
```

Root `.env` required:
```
DATABASE_URL=postgresql://...
AI_INTEGRATIONS_OPENAI_API_KEY=sk-...
AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1
PORT=8080
```

### Sales Coach

```bash
cd sales_coach_v3/digital-sales-coach-voice-first/digital-sales-coach-voice-app
python -m venv .venv && source .venv/bin/activate   # or .\.venv\Scripts\Activate.ps1 on Windows
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

## Deployment

Each subfolder has a `deployment.txt` with full step-by-step Azure deploy instructions.

## Repositories

See `links.txt` for repository links.
