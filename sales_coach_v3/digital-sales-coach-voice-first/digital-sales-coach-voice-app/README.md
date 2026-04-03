# Digital Sales Coach

Voice-first advisor practice app built with FastAPI and a static front end.

The app lets a trainee:
- select an advisor persona
- start a live voice roleplay as the salesperson
- talk to an AI advisor in real time
- end the call and switch into coach mode
- review a scored report and download a shareable HTML scorecard

The current coaching language and UI use `VG Way` and `Vanguard` terminology.

## Overview

### Main flow

1. Select an advisor persona.
2. Choose topic and difficulty.
3. Click `Start live call`.
4. The app generates a fresh scenario and opens a realtime voice session.
5. The salesperson speaks first.
6. End the call or use `End call and coach me`.
7. The app generates a coaching report, plays spoken feedback, and offers an HTML report download.

### What the app includes

- persona-based live roleplay
- realtime voice conversation
- dynamic scenario generation
- transcript capture
- automatic or manual switch to coach mode
- section-by-section coaching across the `VG Way`
- downloadable standalone HTML scorecard

## Tech Stack

- Backend: FastAPI
- Front end: static HTML, CSS, vanilla JavaScript
- Realtime voice: OpenAI Realtime API via WebRTC relay endpoints
- Model-based features:
  - scenario generation
  - advisor behavior
  - end-of-call detection
  - coaching report generation
  - spoken coaching summary

## Project Structure

```text
digital-sales-coach-voice-app/
  app/
    main.py
    openai_api.py
    prompts.py
    schemas.py
    settings.py
    store.py
    knowledge.py
    knowledge/
      advisor_personas.json
      cg_way_playbook.json
      product_briefs.json
      capital_group_active_etf_models.md
    static/
      index.html
      styles.css
      app.js
      headshots/
  .env.example
  requirements.txt
  README.md
```

## Requirements

- Python 3.10+
- An OpenAI API key
- A browser with microphone access

## Run the App

### Windows PowerShell

```powershell
cd C:\Users\nbalasubramanian1\Desktop\experiments\sales_coach_v3\digital-sales-coach-voice-first\digital-sales-coach-voice-app
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:OPENAI_API_KEY="your_openai_key"
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Open:

```text
http://127.0.0.1:8000
```

### macOS / Linux

```bash
cd digital-sales-coach-voice-app
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export OPENAI_API_KEY="your_openai_key"
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

## Optional `.env` Setup

You can also create a local `.env` file based on `.env.example`.

Example:

```env
OPENAI_API_KEY=your_openai_key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_SCENARIO_MODEL=gpt-5.4
OPENAI_CHAT_MODEL=gpt-5.4
OPENAI_COACH_MODEL=gpt-5.4
OPENAI_END_DETECTOR_MODEL=gpt-5-mini
OPENAI_REALTIME_MODEL=gpt-realtime
OPENAI_REALTIME_VOICE=marin
APP_NAME=Digital Sales Coach
```

## Key API Endpoints

- `GET /api/health`
- `GET /api/catalog`
- `POST /api/scenarios`
- `POST /api/scenarios/{id}/realtime/offer`
- `POST /api/scenarios/{id}/should-end`
- `POST /api/scenarios/{id}/transcript`
- `POST /api/scenarios/{id}/evaluate`
- `POST /api/scenarios/{id}/evaluate/stream`

## Coaching Report Output

The app generates:

- overall assessment
- final score
- section scores
- stage-by-stage review
- evidence from the call
- rewrite examples
- missed discovery questions
- next-rep plan
- spoken coaching summary
- downloadable HTML scorecard

## Notes

- The trainee always plays the salesperson.
- The advisor speaks only after the trainee opens the call.
- Scenarios are generated dynamically, not from a hard-coded script.
- Data is stored in memory for this prototype.
- The browser must be allowed to use the microphone.
- If the UI looks stale after a code change, hard refresh the browser.

## Troubleshooting

### App opens but the topic or UI text looks outdated

Hard refresh the browser. If the backend is still serving old catalog values, restart `uvicorn`.

### Live call does not start

Check:
- `OPENAI_API_KEY` is set
- microphone permission is allowed
- `GET /api/health` returns `openai_configured: true`

### No voice or no reply from the advisor

Check:
- browser microphone access
- local audio device availability
- the realtime session finished connecting before you started speaking

## Current Default Topic

- `Vanguard Active ETF Models`
