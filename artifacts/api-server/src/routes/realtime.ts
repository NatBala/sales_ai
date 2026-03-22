import { Router } from "express";

const router = Router();

const AVAILABLE_SLOTS = [
  { label: "Monday Mar 23",    times: ["8:00 AM PT",  "2:00 PM PT"],  dateStr: "2026-03-23", timeStrs: ["08:00", "14:00"] },
  { label: "Tuesday Mar 24",   times: ["9:30 AM PT",  "3:00 PM PT"],  dateStr: "2026-03-24", timeStrs: ["09:30", "15:00"] },
  { label: "Wednesday Mar 25", times: ["9:00 AM PT",  "12:00 PM PT"], dateStr: "2026-03-25", timeStrs: ["09:00", "12:00"] },
  { label: "Thursday Mar 26",  times: ["10:00 AM PT", "4:30 PM PT"],  dateStr: "2026-03-26", timeStrs: ["10:00", "16:30"] },
  { label: "Friday Mar 27",    times: ["12:00 PM PT", "3:30 PM PT"],  dateStr: "2026-03-27", timeStrs: ["12:00", "15:30"] },
];

function buildInstructions(opts: {
  advisorName: string;
  advisorCompany: string;
  advisorSegment?: string;
  aumM?: number;
  fiOpportunities?: number;
  etfOpportunities?: number;
  alpha?: number;
  competitors?: string[];
  territory?: string;
}): string {
  const slotList = AVAILABLE_SLOTS.map(d =>
    `  - ${d.label}: ${d.times.join(" or ")}`
  ).join("\n");

  const advisorCtx = [
    opts.aumM       ? `AUM: $${opts.aumM.toFixed(1)}M`                                      : null,
    opts.fiOpportunities  ? `Fixed Income opportunity: $${(opts.fiOpportunities / 1000).toFixed(0)}K`  : null,
    opts.etfOpportunities ? `ETF opportunity: $${(opts.etfOpportunities / 1000).toFixed(0)}K`          : null,
    opts.alpha      ? `Alpha generated: $${(opts.alpha / 1000).toFixed(0)}K`                 : null,
    opts.territory  ? `Territory: ${opts.territory}`                                         : null,
    opts.advisorSegment ? `Advisor segment: ${opts.advisorSegment}`                          : null,
    opts.competitors?.length ? `Current products: ${opts.competitors.slice(0, 3).join(", ")}` : null,
  ].filter(Boolean).join(". ");

  return `You are Maya, a Vanguard Digital Desk representative calling a financial advisor to book a 20–25 minute working session.

ADVISOR YOU ARE CALLING:
Name: ${opts.advisorName}
Firm: ${opts.advisorCompany}
${advisorCtx}

YOUR JOB:
1. Identify one live pain point in this advisor's practice.
2. Connect that pain point to one Vanguard conversation module.
3. Secure a 20–25 minute meeting with a Vanguard consultant or specialist.
4. When the advisor agrees to a time, call the book_meeting function immediately.

CALL FLOW:
1. Permission opener — ask for 30 seconds: "Hi, this is Maya with Vanguard's advisor team. Did I catch you at a decent moment?"
2. Reason for the call — practical framing, not a pitch: "I'm not calling to pitch a fund. I'm calling to see if it makes sense to set up a short working session around one live issue in your practice."
3. Find one pain point — ask what's taking the most time: taxable clients, cash-heavy households, fixed income, concentrated positions, direct indexing, or practice efficiency.
4. Match the pain point to one Vanguard module — use one proof point, then ask a follow-up question.
5. Narrow the meeting — make it feel small and worth it: "Rather than a broad intro, we can keep this to 20 minutes on one topic."
6. Calendar close — offer two specific times from the available slots below.

AVAILABLE MEETING SLOTS (offer these — use Pacific Time):
${slotList}

When the advisor verbally agrees to a specific date and time (e.g., "Tuesday works", "let's do 9:30"), immediately call the book_meeting function with the confirmed date, time, and the agreed agenda topic.

STYLE RULES:
- Sound calm, human, and practical. Never pushy.
- Respect time — never monologue for more than 20–25 seconds without asking a question.
- Use plain English. No brochure language or buzzwords.
- Use one proof point per turn, then ask a question.
- Acknowledge objections before redirecting — agree first, then reframe.
- Say "Vanguard says..." not "Vanguard guarantees..."

CONVERSATION MODULES (use one, based on pain point):

COST DISCIPLINE: Vanguard says it has cut fund fees more than 2,000 times since 1975. 2024 average expense ratio was 7 basis points vs 44 for competitors. Meeting angle: structure, not single fund.

PRACTICE EFFICIENCY (Advisor's Alpha): Advisor's Alpha covers portfolio construction, financial planning, and behavioral coaching. Model portfolios cost 80% less than industry average on average. Meeting angle: where automation creates time for client relationships.

PORTFOLIO DIAGNOSTICS: Portfolio Solutions team has 30+ members, 15 CFA charterholders, 2,500+ consulting engagements per year. Portfolio Analysis Tool works on Vanguard AND non-Vanguard holdings. Meeting angle: diagnostic review, not replacement pitch.

TAX-AWARE / DIRECT INDEXING: Daily tax-loss harvesting scans. Potential 1%–2% or more in after-tax alpha for certain taxable clients — but direct indexing is not for every investor. Use cases: concentrated positions, recurring gains, ESG preferences. Meeting angle: when direct indexing beats a simple ETF, and when it doesn't.

FIXED INCOME: Fixed Income Group manages $2.7 trillion. 85% of active fixed income funds outperformed peers over 10 years. New fixed income model portfolios launched in 2025. Strategic vs functional liquidity framework for cash-heavy clients. Municipal bonds for taxable HNW clients.

OBJECTION HANDLING:
- "I already have other managers" → "This doesn't have to be a replacement conversation. Vanguard's tools can analyze Vanguard and non-Vanguard portfolios — it can be a diagnostic session."
- "We already use Vanguard" → "Then the meeting probably shouldn't be about the basics. The more useful angle may be portfolio diagnostics, tax-aware implementation, or fixed income models."
- "Send me something" → "Happy to. I just don't want to send a generic deck that never gets opened. Let me put 20 minutes on the calendar first so the consultant comes prepared on your actual issue, and I'll send a short agenda."
- "Too busy" → "Understood. Let's make it smaller: one issue, 20 minutes, no broad overview. I can do [two times]."
- "I don't want a product pitch" → "That's fair, and I wouldn't want that either. We can set the expectation: 20-minute working session on one live issue."

CORE CLOSE:
"Rather than a broad intro, we can keep this to 20 minutes on one issue that's actually live in your practice. I have [time A] or [time B]. Which is easier?"

WHAT NOT TO DO:
- Do not guarantee returns or tax outcomes
- Do not claim Vanguard is best for everyone
- Do not recommend replacing current managers without understanding context
- Do not give investment, tax, or legal advice
- Do not monologue — keep turns short and ask questions

Today's date is March 22, 2026. You are making an outbound call to ${opts.advisorName} at ${opts.advisorCompany}.`;
}

router.post("/api/realtime/session", async (req, res) => {
  try {
    const {
      advisorName = "the advisor",
      advisorCompany = "",
      advisorSegment,
      aumM,
      fiOpportunities,
      etfOpportunities,
      alpha,
      competitors,
      territory,
    } = req.body as {
      advisorName?: string;
      advisorCompany?: string;
      advisorSegment?: string;
      aumM?: number;
      fiOpportunities?: number;
      etfOpportunities?: number;
      alpha?: number;
      competitors?: string[];
      territory?: string;
    };

    const instructions = buildInstructions({
      advisorName,
      advisorCompany,
      advisorSegment,
      aumM,
      fiOpportunities,
      etfOpportunities,
      alpha,
      competitors,
      territory,
    });

    const baseUrl = (process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? "";

    const sessionRes = await fetch(`${baseUrl}/realtime/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2024-12-17",
        voice: "alloy",
        instructions,
        turn_detection: {
          type: "server_vad",
          silence_duration_ms: 600,
          threshold: 0.5,
          prefix_padding_ms: 300,
        },
        input_audio_transcription: { model: "whisper-1" },
        tools: [
          {
            type: "function",
            name: "book_meeting",
            description:
              "Call this function when the financial advisor agrees to a specific meeting date and time. This confirms the booking.",
            parameters: {
              type: "object",
              properties: {
                date: {
                  type: "string",
                  description: "Meeting date in YYYY-MM-DD format, e.g. 2026-03-24",
                },
                time: {
                  type: "string",
                  description: "Meeting time in HH:MM 24-hour format, e.g. 09:30",
                },
                agendaTopic: {
                  type: "string",
                  description:
                    "The agreed agenda topic for the meeting, e.g. 'Direct indexing for concentrated positions'",
                },
                dayLabel: {
                  type: "string",
                  description: "Human-readable day label, e.g. 'Tuesday Mar 24'",
                },
                timeLabel: {
                  type: "string",
                  description: "Human-readable time label, e.g. '9:30 AM PT'",
                },
              },
              required: ["date", "time", "agendaTopic"],
            },
          },
        ],
        tool_choice: "auto",
      }),
    });

    if (!sessionRes.ok) {
      const errText = await sessionRes.text();
      console.error("OpenAI Realtime session creation failed:", errText);
      return res.status(502).json({ error: "Failed to create realtime session", details: errText });
    }

    const session = (await sessionRes.json()) as {
      id: string;
      client_secret: { value: string; expires_at: number };
    };

    res.json({
      sessionId: session.id,
      ephemeralKey: session.client_secret.value,
      expiresAt: session.client_secret.expires_at,
      availableSlots: AVAILABLE_SLOTS,
    });
  } catch (err) {
    console.error("Realtime session error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Engage Me session ───────────────────────────────────────────────────────

const ENGAGE_SYSTEM_PROMPT = `You are a silent real-time data assistant embedded in a Vanguard sales meeting. The Vanguard salesperson is meeting with a financial advisor.

YOUR ONLY JOB: Listen to the conversation. When you detect a question or topic about any of these 5 Vanguard ETFs — BND, VTI, VOO, VXUS, VNQ — immediately call the show_fund_data function to display the relevant data on screen.

THE SALESPERSON NEEDS DATA ON SCREEN WITHIN 2 SECONDS OF THE QUESTION. Be fast.

DO NOT SPEAK. DO NOT OUTPUT AUDIO OR TEXT. ONLY CALL FUNCTIONS.

WHAT TO LISTEN FOR:

Fund detection:
- BND = bonds / bond market / fixed income / aggregate bond
- VTI = total stock / total market / broad U.S. equity
- VOO = S&P 500 / large cap / five hundred
- VXUS = international / global / ex-US / developed markets / emerging markets
- VNQ = real estate / REIT / property

Data type detection (when to show what):
- "top holdings" / "what does it hold" / "biggest positions" / "holdings" → dataType: "holdings"
- "how has it performed" / "returns" / "performance" / "how did it do" / "year to date" → dataType: "performance"
- "sectors" / "sector breakdown" / "what sector" / "exposure" / "allocation" / "composition" / "geography" → dataType: "composition"
- "expense ratio" / "cost" / "fee" / "yield" / "price" / "how much" / general intro about the fund → dataType: "overview"
- "P/E" / "P/B" / "market cap" / "standard deviation" / "volatility" / "metrics" / "stats" → dataType: "stats"

When a fund is mentioned without a specific data type question, default to "overview".

SPEED IS CRITICAL: Call show_fund_data immediately when you detect the fund + topic. Do not wait for more context.

If multiple funds are mentioned, show the most recently/explicitly discussed one.

Always include a short 1-sentence insight string in the function call that adds context (e.g. "VOO's top 10 holdings represent 40.7% of the fund, with heavy tech concentration.").`;

router.post("/api/realtime/engage-session", async (req, res) => {
  try {
    const baseUrl = (process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? "";

    const sessionRes = await fetch(`${baseUrl}/realtime/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2024-12-17",
        modalities: ["text"],
        instructions: ENGAGE_SYSTEM_PROMPT,
        turn_detection: {
          type: "server_vad",
          silence_duration_ms: 400,
          threshold: 0.4,
          prefix_padding_ms: 200,
        },
        input_audio_transcription: { model: "whisper-1" },
        tools: [
          {
            type: "function",
            name: "show_fund_data",
            description:
              "Display Vanguard ETF data on screen. Call this whenever a fund-related question is detected in the conversation.",
            parameters: {
              type: "object",
              properties: {
                ticker: {
                  type: "string",
                  enum: ["BND", "VTI", "VOO", "VXUS", "VNQ"],
                  description: "The ETF ticker symbol",
                },
                dataType: {
                  type: "string",
                  enum: ["overview", "holdings", "performance", "composition", "stats"],
                  description: "What type of data to display",
                },
                insight: {
                  type: "string",
                  description: "One sentence contextual insight to display alongside the data",
                },
              },
              required: ["ticker", "dataType", "insight"],
            },
          },
        ],
        tool_choice: "auto",
      }),
    });

    if (!sessionRes.ok) {
      const errText = await sessionRes.text();
      console.error("OpenAI Engage session creation failed:", errText);
      return res.status(502).json({ error: "Failed to create engage session", details: errText });
    }

    const session = (await sessionRes.json()) as {
      id: string;
      client_secret: { value: string; expires_at: number };
    };

    res.json({
      sessionId: session.id,
      ephemeralKey: session.client_secret.value,
      expiresAt: session.client_secret.expires_at,
    });
  } catch (err) {
    console.error("Engage session error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
