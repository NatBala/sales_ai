# Sales AI Hub — Agent Reference

> This document describes the six sequential AI agents that power the **Sales AI Hub** for Vanguard salespeople. Each agent covers a distinct phase of the financial advisor sales cycle — from discovering the right prospects to closing the loop after a meeting. They are designed to be used in order, each building on the output of the previous one.

---

## The Pipeline at a Glance

```
Lead Me → Schedule Me → Prep Me → Coach Me → Engage Me → Follow Me
```

Every agent has a dedicated backend route (`POST /api/agents/<name>`), its own AI model invocation, and a purpose-built UI page. All agents run as stateless API calls — they receive context in the request body and return structured JSON that the frontend renders.

---

## Agent 1 — Lead Me

**Purpose:** Discover and score the highest-value financial advisors to target next.

### What It Does

Lead Me is the top of the pipeline. It acts as an intelligent search engine over the advisor database, combining natural language query parsing with AI-powered fit scoring. A salesperson types a free-text query like *"find RIA firms over $200M in Cook County with a fixed income gap"* and Lead Me:

1. **Parses the query** into structured filters (territory, AUM range, segment, opportunity type) using GPT.
2. **Retrieves candidates** from the PostgreSQL database based on those filters.
3. **Scores and ranks** up to 8 best-matching advisors on a 0–100 fit scale, with explanations for each score.
4. **Returns a ranked list** with advisor details, AUM, opportunity sizes (FI and ETF), alpha generated, competitors used, and a prioritized segment label (A through E).

### AI Behavior

The scoring model is instructed to act as a *sales intelligence AI for Vanguard financial services salespeople*. It understands segment taxonomy (A = top tier, B = high value, C = mid-market, D/E = developing/emerging), channel type (XC = exclusive channel, FC = flexible channel), and financial advisor practice characteristics.

### Key Outputs

- **Ranked advisors** (up to 8) with fit scores and score rationale
- **Segment labels** (A–E) and channel type (XC/FC)
- **Opportunity data**: AUM, alpha generated, fixed income opportunity ($), ETF opportunity ($)
- **Competitor landscape**: current products used by the advisor
- **Territory and location metadata**

### UI Features

- Natural language search bar with voice input support (speech-to-text via Whisper)
- Animated result cards with color-coded segment badges
- AUM and opportunity size at a glance
- One-click navigation into any lead's Schedule Me workflow

---

## Agent 2 — Schedule Me

**Purpose:** Draft a personalized outreach email or run a live AI phone call to book a meeting with the advisor.

This agent has two distinct modes — **Email** and **Voice Call** — both aimed at securing a 20–25 minute working session with the target advisor.

---

### Mode A: Email Drafting

**What It Does**

Given an advisor's name, firm, title, and optional context, Schedule Me writes a warm, personal 3-paragraph outreach email (~150–180 words) that sounds like it came from a real person, not a template.

**AI Behavior**

The model is instructed to write as *a senior Vanguard financial sales representative with an existing relationship with the advisor*. It is explicitly forbidden from using salesy language ("excited to share", "reach out", "synergy") or bullet points. The output must flow as natural prose.

**Email Structure:**
1. **Opening paragraph** — References a recent interaction; expresses genuine interest in the advisor's strategy.
2. **Market insight paragraph** — Delivers a timely, data-backed market observation (interest rates, ETF flows, fixed income spreads) and connects it to a specific Vanguard product opportunity.
3. **Close** — Proposes a meeting next week with a soft, specific ask.

**Key Outputs**
- `subject`: A conversational, non-click-baity subject line
- `body`: The full 3-paragraph email starting with "Dear [FirstName],"
- Full edit-in-place UI: the salesperson can read, edit, copy, or book directly

---

### Mode B: Voice Call (Maya)

**What It Does**

The salesperson initiates a turn-based AI phone call powered by **Maya**, Vanguard's Digital Desk representative. Maya conducts a realistic outbound call to the advisor, working through a structured call flow to identify a pain point and book a meeting.

**AI Behavior (Maya's Persona)**

Maya is instructed to:

- Sound *calm, human, and practical — never pushy*
- Follow a 6-step call flow: Permission Opener → Reason for the Call → Pain Point Discovery → Module Match → Narrow the Meeting → Calendar Close
- Never monologue for more than 20–25 seconds without asking a question
- Offer two specific time slots from the available weekly calendar (Mon–Fri, Mar 23–27)
- Call the `book_meeting` function the moment the advisor verbally agrees to a time

**Conversation Modules** (Maya selects one based on pain point detected):
- Cost Discipline (expense ratio story)
- Practice Efficiency / Advisor's Alpha
- Portfolio Diagnostics
- Tax-Aware / Direct Indexing
- Fixed Income (FI Group, model portfolios)

**Objection Handling** (built into the system prompt):
- "I already have other managers" → reframe as a diagnostic, not a replacement
- "We already use Vanguard" → shift to diagnostics, tax, or FI models
- "Send me something" → decline the email-first trap, push for a calendar slot
- "Too busy" → make it smaller: one issue, 20 minutes

**Technical Architecture**

Maya runs as a turn-based push-to-talk session (not streaming WebRTC). Each turn:
1. Salesperson holds the mic button and speaks as the "advisor"
2. Audio is sent to `POST /api/voice/maya-turn` with conversation history
3. Backend runs Whisper STT on the audio, then GPT generates Maya's response, then TTS converts it back to audio
4. SSE stream returns `audio`, `user_transcript`, `transcript`, `book_meeting`, and `done` events
5. Maya's audio plays back through an AudioWorklet pipeline

**Key Outputs**
- Live conversation transcript (both sides)
- Booking confirmation: `{leadName, leadCompany, dayLabel, timeLabel, agendaTopic}`
- Booking triggers the confirmation overlay and creates a DB record via `POST /api/meetings`

---

## Agent 3 — Prep Me

**Purpose:** Generate comprehensive meeting preparation materials before the advisor conversation.

### What It Does

Once a meeting is scheduled, Prep Me transforms the advisor's name, firm, meeting date, and purpose into a full pre-meeting briefing package. It covers everything the salesperson needs to walk into the meeting prepared: background, agenda, talking points, and objection readiness.

### AI Behavior

The model acts as a *meeting preparation AI for financial services sales professionals*. It is instructed to be comprehensive, actionable, and specific — not generic. Every output element is tailored to the advisor's firm context and the declared meeting purpose.

### Key Outputs

- **Client Background**: 2–3 sentence contextual summary of the advisor's firm, business situation, and recent developments
- **Meeting Agenda**: 4–6 ordered agenda items (e.g., "Review current fixed income allocation → Introduce Vanguard FI model portfolios → Discuss direct indexing fit for HNW clients")
- **Talking Points**: 5–7 specific conversation starters and value propositions tailored to the advisor
- **Key Objections**: 3–5 anticipated objections with scripted responses

### UI Features

- Context input form: meeting purpose, date, and optional additional notes
- Rendered output cards for agenda, talking points, background, and objections
- Quick-navigate to Coach Me for pre-call practice

---

## Agent 4 — Coach Me

**Purpose:** Prepare the salesperson with targeted coaching, then let them practice the conversation with an AI-powered advisor persona before the real meeting.

This is the most sophisticated agent in the pipeline. It has three sub-components: **Coaching Plan**, **Roleplay Session**, and **Scorecard**.

---

### Sub-component A: Coaching Plan

**What It Does**

Before practice, Coach Me generates a strategic pre-meeting coaching brief tailored to the specific advisor and meeting purpose.

**AI Behavior**

Modeled as an *elite sales coach for Vanguard financial services professionals*. Outputs strategic advice — not generic tips — about how to handle this particular client relationship.

**Key Outputs**
- **Coaching Tips** (4–6): Strategic advice specific to this advisor and meeting context
- **Objections with Scripted Responses** (4–5): Each includes the exact phrasing the advisor might use and a 2–3 sentence recommended response
- **Opening Pitch Variations** (3): Three distinct 60-second openers — confident, consultative, and value-first — giving the salesperson options to choose from based on how the advisor opens
- **Win Themes** (3–4): Core value propositions to weave throughout the conversation

---

### Sub-component B: Roleplay Session (Persona Chat)

**What It Does**

The salesperson practices their pitch against a dynamically generated AI advisor persona — a realistic character with a name, firm, AUM range, communication style, and specific skeptical concerns.

**Persona Generation**

A separate AI call (`POST /api/agents/coach-me/persona`) creates the advisor persona. The generated persona includes:
- Name, role, company, firm type (RIA / Wirehouse / Family Office / Pension / Insurance)
- AUM range (realistic for the firm type)
- Personality description (2 sentences on communication style and decision-making)
- 3 specific skeptical concerns or objections they'll raise
- Communication style (Analytical / Skeptical / Collaborative / Assertive / Inquisitive)
- Opening line (first thing they say to start the meeting, in character)

**Roleplay Loop**

The salesperson speaks (via microphone); the audio is transcribed using Whisper STT, sent to GPT with the full persona system prompt and conversation history, and the advisor's response is synthesized back to audio using TTS (Nova voice). The loop continues until the salesperson ends the session.

**Persona Rules (Enforced in the System Prompt)**
- Stay firmly in character — never break character or acknowledge being AI
- Ask realistic, challenging questions; be appropriately skeptical
- Push back on vague or unsubstantiated claims
- Keep responses to 2–4 sentences maximum
- Reward good answers, press harder on weak ones

---

### Sub-component C: Scorecard

**What It Does**

After the roleplay session ends, the salesperson's performance is graded against the **Vanguard "VG Way" Professional Engagement Framework** — a 6-stage structured sales methodology.

**VG Way Stages (each scored 0–5):**
1. **Agenda** — Did the salesperson set a clear, collaborative agenda?
2. **Discovery** — Did they uncover the advisor's real situation and priorities?
3. **Insights** — Did they share relevant, data-backed insights?
4. **Practice Management** — Did they connect the conversation to the advisor's practice needs?
5. **Summarize & Prioritize** — Did they recaps clearly and focus on what matters?
6. **Close** — Did they advance toward a specific next step?

**Key Scorecard Outputs**
- **Overall Score** (0–100) with a verdict label (e.g., "Strong Start", "Needs Work", "Excellent")
- **2–3 sentence summary** of overall performance, with specific citations from the transcript
- **Top Priority Fix** — the single most important change for next time
- **Per-stage scores** with assessment, evidence (direct quote), and a "better example" rewrite
- **3 Focus Areas** ranked by priority, each with: what was said, what should have been said
- **2–3 Strengths** — specific things the salesperson did well

---

## Agent 5 — Engage Me

**Purpose:** Surface relevant Vanguard ETF data on screen in real time during the live advisor meeting.

### What It Does

Engage Me is a **silent AI listener** that activates during the actual meeting. The salesperson holds down a capture button while the conversation is happening; when they release, the audio clip is analyzed. If any of the five core Vanguard ETFs are mentioned, the relevant data panel appears on screen instantly — ready to share or reference.

### ETF Coverage

| Ticker | Fund Name | Trigger Keywords |
|--------|-----------|------------------|
| **BND** | Total Bond Market ETF | bonds, bond market, fixed income, aggregate bond, total bond |
| **VTI** | Total Stock Market ETF | total stock, total market, broad U.S. equity, domestic equity |
| **VOO** | S&P 500 ETF | S&P 500, large cap, five hundred |
| **VXUS** | Total International Stock ETF | international, global, ex-US, developed markets, emerging markets |
| **VNQ** | Real Estate ETF | real estate, REIT, property |

### Data Type Detection

The agent also detects *what* the advisor is asking about and loads the appropriate panel:

| Data Type | Trigger Phrases |
|-----------|-----------------|
| **Overview** | expense ratio, cost, fee, yield, price, general fund mention |
| **Holdings** | top holdings, biggest positions, what does it hold |
| **Performance** | how has it performed, returns, year to date, YTD |
| **Composition** | sectors, sector breakdown, exposure, allocation, geography |
| **Stats** | P/E, P/B, market cap, volatility, standard deviation |

### AI Behavior

The analyze call (`POST /api/realtime/analyze`) uses:
1. **Whisper STT** — transcribes the audio clip
2. **GPT-4.1 with function calling** — calls `show_fund_data(ticker, dataType, insight)` when an ETF is detected; does nothing if no ETF is mentioned
3. Returns `{detected: {ticker, dataType, insight}, transcript}` to the frontend

The AI is instructed to be fast and decisive — it calls the function immediately when it detects a fund, without waiting for more context.

### Technical Architecture

Runs as a turn-based push-to-talk session:
- Salesperson holds the "Hold to Capture" button
- `useVoiceRecorder` records the audio clip via `MediaRecorder`
- On release, the clip is base64-encoded and posted to `/api/realtime/analyze`
- Response triggers animated panel swap in the UI

### UI Features

- **Live data panels**: Overview, Holdings, Performance, Composition, Stats — each with rich visualizations (bar charts, performance bars, composition breakdowns)
- **History sidebar**: Last 8 triggered panels, clickable to re-display
- **Fund quick-nav**: Right-side panel with fund buttons for instant manual access
- **Manual override bar**: Force any fund + data type combination without voice
- **Session transcript**: Shows the last recognized phrase below the manual bar
- **Amber hint**: "No ETF detected" message if the clip had no recognizable fund mention

---

## Agent 6 — Follow Me

**Purpose:** Convert meeting notes into structured follow-up tasks and generate a warm post-meeting email to maintain momentum.

### What It Does

After the meeting, Follow Me closes the loop. The salesperson enters free-form meeting notes (what was discussed, what was agreed, outstanding items), and the agent returns a fully structured action plan plus a ready-to-send follow-up email.

### AI Behavior

The follow-up task generator is instructed as a *follow-up task generation AI for financial services sales professionals*. It analyzes meeting notes and extracts actionable tasks with urgency categorization (High / Medium / Low).

The follow-up email writer uses the same voice as Schedule Me — *a senior Vanguard representative writing to someone they know* — but now grounded in what actually happened in the meeting.

### Key Outputs

**Task Generation** (`POST /api/agents/follow-me`):
- **Structured tasks** with title, description, due date, priority level, and category (e.g., "Send materials", "Internal escalation", "Calendar invite")
- Tasks are organized by urgency and saved to the database linked to the meeting record

**Follow-Up Email** (`POST /api/agents/follow-me/email`):
- Personalized email referencing what was discussed in the meeting
- Warm, specific, non-template tone — identical style rules to Schedule Me
- Includes a subject line and full prose body

**Voice-Dictated Email Option**:
- The salesperson can dictate notes verbally instead of typing
- Audio is transcribed via Whisper, then the AI drafts the follow-up email from the voice transcript
- Route: `POST /api/agents/follow-me/voice-email`

### UI Features

- Meeting notes input (free text or voice dictation)
- Generated task list with priority badges (High / Medium / Low) and due dates
- Follow-up email preview with edit, copy, and send options
- Link back to the advisor's full profile for reference

---

## Shared Infrastructure

### AI Model
All six agents use **GPT-5.2** (via Replit's OpenAI proxy at `AI_INTEGRATIONS_OPENAI_BASE_URL`). Coach Me persona chat uses a 256-token limit for fast, conversational responses; all other agents use up to 8,192 tokens for thorough outputs.

### Voice Pipeline
Three agents (Schedule Me Voice, Coach Me Roleplay, Engage Me) use the shared voice stack:
- **STT**: OpenAI Whisper (via `speechToText()` in `@workspace/integrations-openai-ai-server/audio`)
- **TTS**: OpenAI TTS with "alloy" (Maya) or "nova" (Coach Me advisor persona) voices
- **Audio format normalization**: `ensureCompatibleFormat()` handles WebM/MP4/AAC → WAV conversion
- **Playback**: `AudioWorkletProcessor` (`audio-playback-worklet.js`) for low-latency PCM16 playback in the browser

### Database
All leads and meetings are stored in **PostgreSQL** via `DATABASE_URL`. The `DEMO_USER_ID = "demo-user"` constant is used across all routes — there is no authentication in demo mode.

### Data Flow Between Agents

```
Lead Me          →  advisorId, leadName, leadCompany, AUM data
  ↓
Schedule Me      →  meetingId (booked meeting record in DB)
  ↓
Prep Me          →  prep materials (shown in context of the meeting)
  ↓
Coach Me         →  scorecard results (not persisted, shown in session)
  ↓
Engage Me        →  fund panels triggered during live meeting
  ↓
Follow Me        →  tasks + follow-up email (tasks saved to DB under meetingId)
```

---

## File Reference

| Agent | Frontend Page | Backend Route(s) |
|-------|---------------|-----------------|
| Lead Me | `src/pages/lead-me.tsx` | `POST /api/agents/lead-me` |
| Schedule Me (Email) | `src/pages/schedule-me.tsx` | `POST /api/agents/schedule-me` |
| Schedule Me (Voice) | `src/pages/schedule-me.tsx` | `POST /api/voice/maya-turn` |
| Prep Me | `src/pages/prep-me.tsx` | `POST /api/agents/prep-me` |
| Coach Me (Plan) | `src/pages/coach-me.tsx` | `POST /api/agents/coach-me` |
| Coach Me (Roleplay) | `src/pages/coach-me.tsx` | `POST /api/agents/coach-me/persona` + `/persona-chat` |
| Coach Me (Scorecard) | `src/pages/coach-me.tsx` | `POST /api/agents/coach-me/scorecard` |
| Engage Me | `src/pages/engage-me.tsx` | `POST /api/realtime/analyze` |
| Follow Me | `src/pages/follow-me.tsx` | `POST /api/agents/follow-me` |

All routes live in `artifacts/api-server/src/routes/`.
