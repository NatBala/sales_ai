import { Router, type Request, type Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

type Firm = "VG" | "CG";

interface IntentContext {
  currentPage?: string;
  selectedLeadCount?: number;
  selectedLeadNames?: string[];
  hasMeeting?: boolean;
  meetingName?: string;
}

interface IntentResult {
  action: "find_leads" | "schedule" | "prep" | "coach" | "engage" | "follow" | "general";
  query?: string;
  targetAdvisor?: string;
  message: string;
}

const SYSTEM_PROMPT = `You are Maya, an AI sales assistant for a financial advisor sales platform.
Your job is to understand what the sales rep wants to do and return a structured intent.

The platform has these 6 agents:
1. Lead Me — finds and scores financial advisors (needs a search query)
2. Schedule Me — books meetings with selected advisors (needs selected leads)
3. Prep Me — prepares the rep for upcoming meetings (needs a scheduled meeting)
4. Coach Me — roleplay practice before meetings (needs a scheduled meeting)
5. Engage Me — product engagement tools for live meetings (needs a scheduled meeting)
6. Follow Me — post-meeting debrief and action items (needs a scheduled meeting)

Respond ONLY with valid JSON matching this schema:
{
  "action": "find_leads" | "schedule" | "prep" | "coach" | "engage" | "follow" | "general",
  "query": "string (only for find_leads — the refined natural language search query for the advisor dataset)",
  "targetAdvisor": "string (the advisor/person name mentioned by the rep, if any — first and/or last name as spoken, e.g. 'John', 'Matthew Hernandez', 'Danielle'. Omit if no specific advisor is named.)",
  "message": "string (1-2 sentences Maya says back to the rep — conversational, energetic, action-oriented)"
}

Rules:
- If the rep mentions finding/searching/showing advisors, firms, territories, segments → action: "find_leads"
- If the rep mentions scheduling/booking/calling meetings, the calendar, "schedule with" → action: "schedule"
- If the rep mentions preparing/prep/brief/research for a meeting → action: "prep"
- If the rep mentions practicing/coaching/roleplay → action: "coach"
- If the rep mentions engaging/presenting/product/ETFs in the meeting → action: "engage"
- If the rep mentions follow-up/debrief/action items/tasks after the meeting → action: "follow"
- For find_leads, extract and enhance the search query from the rep's words. Preserve firm names, territories, filters exactly as mentioned.
- For targetAdvisor, extract any person name the rep mentions. Even a first name alone is fine. Omit the field entirely if no name is mentioned.
- For message: be brief, confident, and human. Use the rep's context (selected leads, meetings) to personalize.
- Never include markdown in the message.`;

router.post("/agents/maya/intent", async (req: Request, res: Response) => {
  try {
    const {
      transcript,
      firm = "CG",
      context = {},
    } = req.body as {
      transcript: string;
      firm?: Firm;
      context?: IntentContext;
    };

    if (!transcript?.trim()) {
      return res.status(400).json({ error: "Missing transcript" });
    }

    const firmLabel = firm === "VG" ? "Vanguard" : "Capital Group";
    const ctx = context;

    const userMsg = [
      `Sales rep says: "${transcript}"`,
      `Current page: ${ctx.currentPage ?? "unknown"}`,
      ctx.selectedLeadCount ? `Selected advisors: ${ctx.selectedLeadCount}${ctx.selectedLeadNames?.length ? ` (${ctx.selectedLeadNames.slice(0, 3).join(", ")}${ctx.selectedLeadNames.length > 3 ? "…" : ""})` : ""}` : "",
      ctx.hasMeeting ? `Active meeting: ${ctx.meetingName ?? "yes"}` : "",
      `Firm: ${firmLabel}`,
    ].filter(Boolean).join("\n");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMsg },
      ],
      temperature: 0.3,
      max_tokens: 300,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let result: IntentResult;

    try {
      result = JSON.parse(raw) as IntentResult;
    } catch {
      result = { action: "general", message: "I heard you — let me help with that." };
    }

    if (!result.action) result.action = "general";
    if (!result.message) result.message = "On it!";

    return res.json(result);
  } catch (err) {
    console.error("Maya intent error:", err);
    const msg = err instanceof Error ? err.message : "Intent parsing failed";
    return res.status(500).json({ error: msg });
  }
});

export default router;
