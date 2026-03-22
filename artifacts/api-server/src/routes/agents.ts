import { Router, type IRouter, type Request, type Response } from "express";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { openai } from "@workspace/integrations-openai-ai-server";
import { speechToText, textToSpeech, ensureCompatibleFormat } from "@workspace/integrations-openai-ai-server/audio";
import {
  GenerateLeadsBody,
  GenerateEmailBody,
  GenerateMeetingPrepBody,
  GenerateCoachingPlanBody,
  GenerateEngagementIntelligenceBody,
  GenerateFollowUpTasksBody,
} from "@workspace/api-zod";

// ─── Advisor CSV dataset ──────────────────────────────────────────────────────
interface AdvisorRow {
  name: string; firm: string; segment: string; ratings: number | null;
  aumM: number; salesAmt: number; redemption: number; competitors: string[];
  buyingUnit: string; territory: string; fiOpportunities: number;
  etfOpportunities: number; alpha: number;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let cur = ""; let inQ = false;
  for (const c of line) {
    if (c === '"') { inQ = !inQ; }
    else if (c === ',' && !inQ) { result.push(cur); cur = ""; }
    else { cur += c; }
  }
  result.push(cur);
  return result;
}

const ADVISORS: AdvisorRow[] = (() => {
  try {
    const csvPath = join(__dirname, "../src/data/advisors.csv");
    const csv = readFileSync(csvPath, "utf-8");
    const lines = csv.trim().split("\n");
    const headers = parseCSVLine(lines[0]).map(h => h.trim());
    return lines.slice(1).map(line => {
      const vals = parseCSVLine(line);
      const o: Record<string, string> = {};
      headers.forEach((h, i) => { o[h] = (vals[i] ?? "").trim(); });
      return {
        name: o["Advisor Name"] ?? "",
        firm: o["Firm"] ?? "",
        segment: o["Segment"] ?? "",
        ratings: o["Ratings"] ? Number(o["Ratings"]) : null,
        aumM: Number(o["AUM (Millions)"]) || 0,
        salesAmt: Number(o["Sales"]) || 0,
        redemption: Number(o["Redemption"]) || 0,
        competitors: o["Competitor Mentions"]
          ? o["Competitor Mentions"].split(",").map((s: string) => s.trim()).filter(Boolean)
          : [],
        buyingUnit: o["Buying Units"] ?? "",
        territory: o["Territory"] ?? "",
        fiOpportunities: Number(o["FI Opportunities ($)"]) || 0,
        etfOpportunities: Number(o["ETF Opportunities ($)"]) || 0,
        alpha: Number(o["Alpha ($)"]) || 0,
      };
    });
  } catch (err) {
    console.error("Failed to load advisors CSV:", err);
    return [];
  }
})();

const router: IRouter = Router();

function parseAIJson(content: string): Record<string, unknown> {
  const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) ?? content.match(/({[\s\S]*})/);
  const raw = jsonMatch ? jsonMatch[1] : content;
  try {
    const parsed: unknown = JSON.parse(raw.trim());
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

// ─── Parsed filter schema ─────────────────────────────────────────────────────
interface ParsedFilters {
  firms: string[];          // ["Edward Jones", "UBS"]
  segments: string[];       // ["A", "B"]
  counties: string[];       // ["Cook County", "Los Angeles County"]
  channels: string[];       // ["XC"] or ["FC"]
  aumMin: number | null;    // in millions
  aumMax: number | null;    // in millions
  netFlow: "positive" | "negative" | null;
  fiOppMin: number | null;  // in dollars
  etfOppMin: number | null; // in dollars
  alphaMin: number | null;  // in dollars
  ratingsMin: number | null;
  competitors: string[];    // brand names like "BlackRock", "Vanguard"
  totalOppMin: number | null;
}

const emptyFilters = (): ParsedFilters => ({
  firms: [], segments: [], counties: [], channels: [],
  aumMin: null, aumMax: null, netFlow: null,
  fiOppMin: null, etfOppMin: null, alphaMin: null,
  ratingsMin: null, competitors: [], totalOppMin: null,
});

async function parseQueryFilters(query: string): Promise<ParsedFilters> {
  try {
    const resp = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 400,
      messages: [
        {
          role: "system",
          content: `You parse natural language queries about financial advisors into structured filters.

Dataset schema:
- Firms: Edward Jones, Merrill Lynch, Morgan Stanley, UBS, Wells Fargo
- Segments: A (Top Tier), B (High Value), C (Mid-Market), D (Developing), E (Emerging)
- Channels: XC (Exclusive Channel), FC (Flexible Channel)
- Counties: Cook County, Los Angeles County, Maricopa County, Harris County, Dallas County, Miami-Dade County, Orange County, San Diego County, Clark County, King County, Broward County, Alameda County, Tarrant County, Santa Clara County, Wayne County
- AUM in millions (typical range: $10M–$100M)
- FI/ETF Opportunities and Alpha in dollars
- Competitors (brands held by advisors): BlackRock, CapitalGroup, State Street, Invesco, Fidelity, PIMCO, JPMorgan

Return ONLY a JSON object with these exact keys. Use empty arrays [] and null for fields not mentioned:
{"firms":[],"segments":[],"counties":[],"channels":[],"aumMin":null,"aumMax":null,"netFlow":null,"fiOppMin":null,"etfOppMin":null,"alphaMin":null,"ratingsMin":null,"competitors":[],"totalOppMin":null}`,
        },
        { role: "user", content: query },
      ],
    });
    const raw = resp.choices[0]?.message?.content ?? "{}";
    const obj = parseAIJson(raw);
    return {
      firms: Array.isArray(obj.firms) ? (obj.firms as string[]) : [],
      segments: Array.isArray(obj.segments) ? (obj.segments as string[]) : [],
      counties: Array.isArray(obj.counties) ? (obj.counties as string[]) : [],
      channels: Array.isArray(obj.channels) ? (obj.channels as string[]) : [],
      aumMin: typeof obj.aumMin === "number" ? obj.aumMin : null,
      aumMax: typeof obj.aumMax === "number" ? obj.aumMax : null,
      netFlow: obj.netFlow === "positive" || obj.netFlow === "negative" ? obj.netFlow : null,
      fiOppMin: typeof obj.fiOppMin === "number" ? obj.fiOppMin : null,
      etfOppMin: typeof obj.etfOppMin === "number" ? obj.etfOppMin : null,
      alphaMin: typeof obj.alphaMin === "number" ? obj.alphaMin : null,
      ratingsMin: typeof obj.ratingsMin === "number" ? obj.ratingsMin : null,
      competitors: Array.isArray(obj.competitors) ? (obj.competitors as string[]) : [],
      totalOppMin: typeof obj.totalOppMin === "number" ? obj.totalOppMin : null,
    };
  } catch {
    return emptyFilters();
  }
}

function applyFilters(advisors: AdvisorRow[], f: ParsedFilters): AdvisorRow[] {
  return advisors.filter(a => {
    if (f.firms.length && !f.firms.some(firm => a.firm.toLowerCase().includes(firm.toLowerCase()))) return false;
    if (f.segments.length && !f.segments.includes(a.segment)) return false;

    const parts = a.territory.split(" - ");
    const channel = (parts[0] ?? "").trim();
    const county = (parts[1] ?? "").trim().toLowerCase();

    if (f.channels.length && !f.channels.includes(channel)) return false;
    if (f.counties.length && !f.counties.some(c => county.includes(c.toLowerCase().replace(" county", "")))) return false;

    if (f.aumMin !== null && a.aumM < f.aumMin) return false;
    if (f.aumMax !== null && a.aumM > f.aumMax) return false;
    if (f.netFlow === "positive" && a.salesAmt <= a.redemption) return false;
    if (f.netFlow === "negative" && a.salesAmt > a.redemption) return false;
    if (f.fiOppMin !== null && a.fiOpportunities < f.fiOppMin) return false;
    if (f.etfOppMin !== null && a.etfOpportunities < f.etfOppMin) return false;
    if (f.alphaMin !== null && a.alpha < f.alphaMin) return false;
    if (f.ratingsMin !== null && (a.ratings === null || a.ratings < f.ratingsMin)) return false;
    if (f.competitors.length) {
      const comps = a.competitors.join(",").toLowerCase();
      if (!f.competitors.some(c => comps.includes(c.toLowerCase()))) return false;
    }
    if (f.totalOppMin !== null && (a.fiOpportunities + a.etfOpportunities) < f.totalOppMin) return false;
    return true;
  });
}

function buildAdvisorLead(a: AdvisorRow, l: { score: number; reason: string; reasoning: string }) {
  return {
    name: a.name,
    company: a.firm,
    title: "Financial Advisor",
    score: Math.round(Number(l.score) || 0),
    reason: l.reason ?? "",
    reasoning: l.reasoning ?? "",
    assets: JSON.stringify({
      __advisorData: {
        aumM: a.aumM, salesAmt: a.salesAmt, redemption: a.redemption,
        fiOpportunities: a.fiOpportunities, etfOpportunities: a.etfOpportunities,
        alpha: a.alpha, competitors: a.competitors, buyingUnit: a.buyingUnit,
        territory: a.territory, segment: a.segment, ratings: a.ratings,
      },
    }),
    sales: `Sales: $${a.salesAmt.toLocaleString()} | Redemption: $${a.redemption.toLocaleString()}`,
    email: null, phone: null, linkedIn: null,
    location: a.territory.replace(/^(XC|FC)\s*-\s*/i, ""),
    industry: "Financial Services",
    aum: `$${a.aumM.toFixed(1)}M`,
  };
}

router.post("/agents/lead-me", async (req: Request, res: Response) => {
  const parsed = GenerateLeadsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request" }); return; }
  const { query } = parsed.data;

  try {
    // ── Step 1: Parse query into structured filters (fast call) ──
    const parsedFilters = await parseQueryFilters(query);

    // ── Step 2: Programmatic pre-filtering ──
    const filtered = applyFilters(ADVISORS, parsedFilters);
    const workingSet = filtered.length >= 8 ? filtered : ADVISORS; // fallback to all if too few

    // ── Step 3: AI scoring of the filtered set ──
    const dataset = workingSet.map((a, i) =>
      `${i}|${a.name}|${a.firm}|seg:${a.segment}|AUM:$${a.aumM.toFixed(1)}M|${a.territory}|comps:${a.competitors.slice(0, 2).join(";")}|FI:$${(a.fiOpportunities / 1e6).toFixed(1)}M|ETF:$${(a.etfOpportunities / 1e6).toFixed(1)}M|alpha:$${(a.alpha / 1000).toFixed(0)}K`
    ).join("\n");

    const scoreResp = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 4096,
      messages: [
        {
          role: "system",
          content: `You are a sales intelligence AI for Vanguard financial services salespeople. Select the 8 best-matching advisors from the dataset and score their fit 0-100. Segments: A=top tier, B=high value, C=mid-market, D=developing, E=emerging. XC=exclusive channel, FC=flexible channel. Return valid JSON only.`,
        },
        {
          role: "user",
          content: `Query: "${query}"

Pre-filtered advisor dataset (idx|name|firm|segment|AUM|territory|competitors|FI-opp|ETF-opp|alpha):
${dataset}

Return JSON: {"leads":[{"idx":0,"score":85,"reason":"1-2 sentence fit reason","reasoning":"3-4 sentence deep analysis of opportunity and why this advisor matches"}]}
Select exactly 8 (or all if fewer). Sort by score descending.`,
        },
      ],
    });

    const content = scoreResp.choices[0]?.message?.content ?? "{}";
    const aiData = parseAIJson(content);
    const aiLeads = Array.isArray(aiData.leads)
      ? (aiData.leads as Array<{ idx: number; score: number; reason: string; reasoning: string }>)
      : [];

    const leads = aiLeads.map(l => {
      const a = workingSet[l.idx];
      return a ? buildAdvisorLead(a, l) : null;
    }).filter(Boolean);

    res.json({
      leads,
      parsedFilters,
      filteredCount: filtered.length,
      totalCount: ADVISORS.length,
      usedFallback: filtered.length < 8,
    });
  } catch (err) {
    req.log.error({ err }, "Lead generation failed");
    res.status(500).json({ error: "Failed to generate leads" });
  }
});

router.post("/agents/lead-me/transcribe", async (req: Request, res: Response) => {
  const { audioBase64, mimeType } = req.body as { audioBase64: string; mimeType?: string };

  if (!audioBase64) {
    res.status(400).json({ error: "No audio provided" });
    return;
  }

  try {
    const buf = Buffer.from(audioBase64, "base64");
    const { buffer, format } = await ensureCompatibleFormat(buf);
    const text = await speechToText(buffer, format);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const words = text.trim().split(/\s+/);
    for (let i = 0; i < words.length; i++) {
      const delta = (i === 0 ? "" : " ") + words[i];
      res.write(`data: ${JSON.stringify({ delta })}\n\n`);
      await new Promise(r => setTimeout(r, 35));
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    req.log.error({ err }, "Lead Me transcription failed");
    if (!res.headersSent) {
      res.status(500).json({ error: "Transcription failed" });
    } else {
      res.write(`data: ${JSON.stringify({ error: "Transcription failed" })}\n\n`);
      res.end();
    }
  }
});

router.post("/agents/schedule-me", async (req: Request, res: Response) => {
  const parsed = GenerateEmailBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const { leadName, leadCompany, leadTitle, context } = parsed.data;
  const firstName = leadName.split(" ")[0];

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: [
        {
          role: "system",
          content: `You are a senior Vanguard financial sales representative writing warm, personal follow-up emails to financial advisors. Your emails read like they were written by a real person who has an existing relationship with the advisor — not a marketing template. Always respond with valid JSON only.`,
        },
        {
          role: "user",
          content: `Write a personal outreach email to a financial advisor to set up a meeting. The email must follow this exact structure and style:

STRUCTURE (3 paragraphs, ~150-180 words total):
1. Opening paragraph: Start with "Dear ${firstName}," on its own line. Then begin the body (no line break after the greeting). Open warmly — reference a recent meeting or conversation. Mention you've been thinking about their investment strategy or portfolio. One or two sentences.
2. Market insight paragraph: Share a specific, relevant market insight or data point tied to current conditions (interest rates, inflation, Fed policy, ETF flows, fixed income spreads — make it feel timely and data-driven). Connect this insight to a specific Vanguard product opportunity (e.g. core bond funds, active ETFs, short-duration fixed income). 2-3 sentences with at least one real-sounding statistic.
3. Close: Express genuine enthusiasm about the opportunity for their practice. Propose meeting next week with a soft ask ("Could we set up a time..."). End warmly. 2 sentences.

Advisor details:
Full name: ${leadName}
First name: ${firstName}
Firm: ${leadCompany}
Title: ${leadTitle}
Context / talking points: ${context || "General portfolio discussion around fixed income and active ETF opportunities."}

STYLE RULES:
- Use first name only in the greeting: "Dear ${firstName},"
- DO NOT use salesy language ("excited to share", "reach out", "touch base", "synergy")
- DO NOT use bullet points or headers — flowing prose only
- Sound like a real person writing to a colleague they know, not a template
- Subject line: conversational, specific, not click-baity (e.g. "Following up on our conversation" or "Quick thought on [specific topic]")

Return a JSON object with:
- subject: string (conversational subject line)
- body: string (the full 3-paragraph email, starting with "Dear ${firstName},")
- scheduledTime: null`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    const data = parseAIJson(content);
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Email generation failed");
    res.status(500).json({ error: "Failed to generate email" });
  }
});

router.post("/agents/prep-me", async (req: Request, res: Response) => {
  const parsed = GenerateMeetingPrepBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const { leadName, leadCompany, meetingDate, meetingPurpose, additionalContext } = parsed.data;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: [
        {
          role: "system",
          content: `You are a meeting preparation AI for financial services sales professionals.
You create comprehensive, actionable meeting prep materials that help salespeople have more effective client conversations.
Always respond with valid JSON only.`,
        },
        {
          role: "user",
          content: `Create meeting preparation materials for:
Client: ${leadName} at ${leadCompany}
Meeting Date: ${meetingDate}
Purpose: ${meetingPurpose}
Additional Context: ${additionalContext || "None"}

Return a JSON object with:
- agenda: Array of 4-6 agenda items (strings) in order
- talkingPoints: Array of 5-7 key talking points (strings) specific to this client
- clientBackground: Paragraph about the client/company (2-3 sentences covering business context, recent developments, financial situation)
- keyObjections: Array of 3-5 likely objections the client might raise and how to address them (strings)

Make everything specific, actionable, and relevant to a financial services sales context.`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    const data = parseAIJson(content);
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Meeting prep generation failed");
    res.status(500).json({ error: "Failed to generate prep materials" });
  }
});

router.post("/agents/coach-me", async (req: Request, res: Response) => {
  const parsed = GenerateCoachingPlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const { leadName, leadCompany, meetingPurpose, focusArea } = parsed.data;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: [
        {
          role: "system",
          content: `You are an elite sales coach for financial services professionals at Vanguard. 
Your job is to prepare salespeople with targeted coaching before their client meetings.
You provide practical, specific, and actionable coaching materials. Always respond with valid JSON only.`,
        },
        {
          role: "user",
          content: `Create a pre-meeting coaching plan for this upcoming meeting:
Client: ${leadName} at ${leadCompany}
Meeting Purpose: ${meetingPurpose}
Focus Area: ${focusArea || "General meeting preparation"}

Return a JSON object with:
- coachingTips: Array of 4-6 specific coaching tips tailored to this client and meeting (strings). These should be strategic advice about how to handle this particular client.
- objections: Array of 4-5 likely objections this client will raise. Each item is an object with:
  - objection: The exact phrasing the client might use (string)
  - suggestedResponse: A concise, effective response the salesperson should give (string, 2-3 sentences)
- openingPitches: Array of 3 alternative opening pitch variations for the first 60 seconds of the call. Each should be distinct in tone (confident, consultative, value-first) (strings)
- winThemes: Array of 3-4 core value propositions or "win themes" to weave throughout the conversation specific to this client's likely needs (strings)

Make everything specific to a financial services / investment management context.`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    const data = parseAIJson(content);
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Coaching plan generation failed");
    res.status(500).json({ error: "Failed to generate coaching plan" });
  }
});

router.post("/agents/coach-me/persona", async (req: Request, res: Response) => {
  const { leadName, leadCompany, leadTitle, meetingPurpose } = req.body as {
    leadName: string; leadCompany: string; leadTitle?: string; meetingPurpose: string;
  };

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 1024,
      messages: [
        { role: "system", content: "You are a persona generator for sales training simulations. Generate realistic financial advisor personas. Always respond with valid JSON only." },
        {
          role: "user",
          content: `Generate a realistic financial advisor persona for a Vanguard practice session.
Meeting context: "${meetingPurpose}"
Lead: ${leadName} at ${leadCompany}${leadTitle ? `, ${leadTitle}` : ""}

Return JSON with:
- name: string (realistic full name — NOT the same as "${leadName}", create a different name)
- role: string (specific job title matching the advisor type)
- company: string (use "${leadCompany}")
- firmType: string (e.g. "Registered Investment Advisor", "Wirehouse", "Family Office", "Pension Fund", "Insurance")
- aumRange: string (e.g. "$450M–$600M" realistic for firm type)
- personality: string (2-sentence description of communication style and decision-making approach — should be realistic and specific)
- concerns: string[] (exactly 3 specific skeptical questions or objections they would raise in this meeting)
- style: string (exactly one of: "Analytical", "Skeptical", "Collaborative", "Assertive", "Inquisitive")
- openingLine: string (the first thing this advisor would say to open the meeting — 1–2 sentences, in first person, stay in character)`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    res.json(parseAIJson(content));
  } catch (err) {
    req.log.error({ err }, "Persona generation failed");
    res.status(500).json({ error: "Failed to generate persona" });
  }
});

router.post("/agents/coach-me/persona-chat", async (req: Request, res: Response) => {
  const { persona, history, audioBase64, mimeType } = req.body as {
    persona: { name: string; role: string; company: string; firmType: string; aumRange: string; personality: string; concerns: string[]; style: string; openingLine: string };
    history: { role: "user" | "advisor"; content: string }[];
    audioBase64?: string | null;
    mimeType?: string;
  };

  try {
    let userTranscript = "";

    if (audioBase64) {
      const format: "webm" | "mp3" | "wav" =
        mimeType?.includes("mp4") || mimeType?.includes("aac") ? "mp3" : "webm";
      const buf = Buffer.from(audioBase64, "base64");
      userTranscript = await speechToText(buf, format);
    }

    const systemPrompt = `You are playing the role of ${persona.name}, ${persona.role} at ${persona.company} (${persona.firmType}).
AUM Range: ${persona.aumRange}.
Personality: ${persona.personality}
Your key concerns: ${persona.concerns.join("; ")}.
Communication style: ${persona.style}.

You are in a sales roleplay practice session. A Vanguard salesperson is practicing their pitch with you.
Rules:
- Stay firmly in character as this advisor. Never break character.
- Ask realistic, challenging questions. Be appropriately skeptical.
- Push back on vague or unsubstantiated claims.
- Keep responses concise: 2–4 sentences maximum.
- React authentically to what the salesperson says — reward good answers, press on weak ones.
- Do NOT mention you are an AI or that this is a simulation.`;

    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: systemPrompt },
    ];

    for (const turn of history) {
      messages.push({ role: turn.role === "user" ? "user" : "assistant", content: turn.content });
    }

    if (userTranscript) {
      messages.push({ role: "user", content: userTranscript });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 256,
      messages,
    });

    const advisorResponse = response.choices[0]?.message?.content ?? "";
    const audioBase64Out = await textToSpeech(advisorResponse, "nova");

    res.json({ userTranscript, advisorResponse, audioBase64: audioBase64Out });
  } catch (err) {
    req.log.error({ err }, "Persona chat failed");
    res.status(500).json({ error: "Failed to process persona chat" });
  }
});

router.post("/agents/coach-me/scorecard", async (req: Request, res: Response) => {
  const { persona, meetingContext, transcript } = req.body as {
    persona: { name: string; role: string; company: string; firmType: string; personality: string; concerns: string[] };
    meetingContext: { leadName: string; leadCompany: string; purpose: string };
    transcript: { role: "user" | "advisor"; content: string }[];
  };

  try {
    const transcriptText = transcript
      .map(t => `${t.role === "user" ? "SALESPERSON" : `ADVISOR (${persona.name})`}: ${t.content}`)
      .join("\n\n");

    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 4096,
      messages: [
        {
          role: "system",
          content: `You are an elite sales coach evaluating financial services sales conversations against the Vanguard "VG Way" Professional Engagement Framework. Be rigorous and specific. Always respond with valid JSON only.`,
        },
        {
          role: "user",
          content: `Evaluate this sales roleplay conversation against the 6-stage VG Way framework.

Advisor Persona: ${persona.name}, ${persona.role} at ${persona.company} (${persona.firmType})
Meeting Purpose: ${meetingContext.purpose}
Advisor Key Concerns: ${persona.concerns.join(", ")}

TRANSCRIPT:
${transcriptText}

Return a JSON scorecard with these exact fields:
- overallScore: number 0–100
- overallVerdict: string (e.g. "Strong Start", "Needs Work", "Mixed Performance", "Excellent", "Below Standard")
- summary: string (2–3 sentences on overall performance — be specific, cite what happened)
- topPriorityFix: string (the single most important change for next time — 1–2 sentences, specific and actionable)
- stages: array of exactly 6 objects for the VG Way stages, each with:
  - name: string (MUST be one of: "Agenda", "Discovery", "Insights", "Practice Management", "Summarize & Prioritize", "Close")
  - score: number 0–5 (be rigorous — if skipped or weak, score 0–2)
  - assessment: string (1–2 sentences, specific to what happened in this conversation)
  - evidence: string (direct quote or specific observation from the transcript)
  - betterExample: string (concrete alternative phrasing the salesperson could use — start with a direct quote)
- focusAreas: array of exactly 3 objects ranked by priority, each with:
  - rank: number (1, 2, or 3)
  - title: string (short descriptive label for this gap)
  - issue: string (1–2 sentences describing the gap)
  - youSaid: string (short example of what was actually said — use a direct quote if possible)
  - betterExample: string (how to say it better — be specific, not generic)
- strengths: string[] (exactly 2–3 things the salesperson did well — be specific)

Score rigorously. If a stage was skipped or poorly done, score it 0–1.`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    res.json(parseAIJson(content));
  } catch (err) {
    req.log.error({ err }, "Scorecard generation failed");
    res.status(500).json({ error: "Failed to generate scorecard" });
  }
});

router.post("/agents/engage-me", async (req: Request, res: Response) => {
  const parsed = GenerateEngagementIntelligenceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const { leadName, leadCompany, currentTopic, conversationContext } = parsed.data;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: [
        {
          role: "system",
          content: `You are a real-time meeting intelligence AI for financial services sales professionals.
You provide instant, relevant suggestions to help salespeople navigate conversations more effectively.
Be concise and actionable. Always respond with valid JSON only.`,
        },
        {
          role: "user",
          content: `Provide real-time intelligence for this in-meeting situation:
Client: ${leadName} at ${leadCompany}
Current Topic: ${currentTopic}
Conversation Context: ${conversationContext || "Early in the meeting"}

Return a JSON object with:
- suggestions: Array of 3-4 specific conversation suggestions or questions to ask right now (strings)
- quickFacts: Array of 3-4 relevant facts about the client/company/topic to reference (strings)
- nextSteps: Array of 2-3 recommended next steps to steer toward by end of meeting (strings)

Keep everything brief and immediately actionable for a live meeting.`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    const data = parseAIJson(content);
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Engagement intelligence generation failed");
    res.status(500).json({ error: "Failed to generate engagement intelligence" });
  }
});

router.post("/agents/follow-me", async (req: Request, res: Response) => {
  const parsed = GenerateFollowUpTasksBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const { leadName, leadCompany, meetingNotes } = parsed.data;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: [
        {
          role: "system",
          content: `You are a follow-up task generation AI for financial services sales professionals.
You analyze meeting notes and extract clear, actionable follow-up tasks with appropriate urgency.
Always respond with valid JSON only.`,
        },
        {
          role: "user",
          content: `Generate follow-up tasks from this meeting:
Client: ${leadName} at ${leadCompany}
Meeting Notes: ${meetingNotes}

Return a JSON object with:
- tasks: Array of 4-8 specific follow-up tasks extracted from the notes (strings). Each task should be a clear action item starting with a verb (e.g., "Send proposal for...", "Schedule follow-up call on...", "Share research report about...")
- summary: A 2-3 sentence summary of the meeting and key outcomes

Tasks should be prioritized (most urgent first) and specific to what was discussed.`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    const data = parseAIJson(content);
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Follow-up task generation failed");
    res.status(500).json({ error: "Failed to generate follow-up tasks" });
  }
});

router.post("/agents/schedule-me/voice", async (req: Request, res: Response) => {
  const { audio, leadName, leadCompany, leadTitle } = req.body as {
    audio: string;
    leadName: string;
    leadCompany: string;
    leadTitle: string;
  };

  if (!audio || !leadName || !leadCompany) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const voiceFirstName = leadName.split(" ")[0];

  try {
    const audioBuffer = Buffer.from(audio, "base64");
    const { buffer, format } = await ensureCompatibleFormat(audioBuffer);
    const transcript = await speechToText(buffer, format);

    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: [
        {
          role: "system",
          content: `You are a senior Vanguard financial sales representative writing warm, personal follow-up emails to financial advisors. Your emails read like they were written by a real person who has an existing relationship with the advisor — not a marketing template. Always respond with valid JSON only.`,
        },
        {
          role: "user",
          content: `Write a personal outreach email to a financial advisor. The salesperson recorded these voice instructions: "${transcript}". Use those as your talking points.

The email must follow this exact structure:
1. Opening: "Dear ${voiceFirstName}," then warm opening referencing a recent conversation. 1-2 sentences.
2. Market insight: A specific, data-driven insight tied to current market conditions (rates, Fed policy, inflation, ETF flows). Connect to a Vanguard product relevant to their situation. Include at least one real-sounding statistic. 2-3 sentences.
3. Close: Soft ask to meet next week ("Could we set up a time…"). Warm sign-off. 2 sentences.

Advisor: ${leadName}, ${leadTitle || "Financial Advisor"} at ${leadCompany}

STYLE: Personal, flowing prose. No bullets. No salesy language. First name greeting only. ~150-180 words total.

Return JSON: { subject: string, body: string (starts "Dear ${voiceFirstName},"), scheduledTime: null }`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    const emailData = parseAIJson(content);

    const ttsText = `Draft ready. Subject: ${emailData.subject || "your outreach email"}. The email has been filled in below — review and edit before sending.`;
    const ttsBuffer = await textToSpeech(ttsText, "nova", "mp3");

    res.json({
      transcript,
      subject: emailData.subject,
      body: emailData.body,
      scheduledTime: emailData.scheduledTime ?? null,
      audioBase64: ttsBuffer.toString("base64"),
    });
  } catch (err) {
    req.log.error({ err }, "Voice schedule-me generation failed");
    res.status(500).json({ error: "Failed to generate email from voice" });
  }
});

router.post("/agents/prep-me/voice", async (req: Request, res: Response) => {
  const { audio, meetings } = req.body as {
    audio: string;
    meetings: Array<{ id: string; leadName: string; leadCompany: string; scheduledAt: string; purpose: string }>;
  };

  if (!audio) {
    res.status(400).json({ error: "No audio provided" });
    return;
  }

  try {
    const audioBuffer = Buffer.from(audio, "base64");
    const { buffer, format } = await ensureCompatibleFormat(audioBuffer);
    const transcript = await speechToText(buffer, format);

    const meetingList = meetings ?? [];
    let matchedMeeting = meetingList[0];

    if (meetingList.length > 0 && transcript) {
      const lower = transcript.toLowerCase();
      const found = meetingList.find((m) => {
        const nameParts = m.leadName.toLowerCase().split(" ");
        return (
          nameParts.some((part) => lower.includes(part)) ||
          lower.includes(m.leadCompany.toLowerCase())
        );
      });
      if (found) matchedMeeting = found;
    }

    if (!matchedMeeting) {
      res.json({ transcript, matchedMeetingId: null });
      return;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: [
        {
          role: "system",
          content: `You are a meeting preparation AI for financial services sales professionals.
You create comprehensive, actionable meeting prep materials. Always respond with valid JSON only.`,
        },
        {
          role: "user",
          content: `Create meeting preparation materials for:
Client: ${matchedMeeting.leadName} at ${matchedMeeting.leadCompany}
Meeting Date: ${matchedMeeting.scheduledAt}
Purpose: ${matchedMeeting.purpose}
Voice Request: "${transcript}"

Return a JSON object with:
- agenda: Array of 4-6 agenda items (strings) in order
- talkingPoints: Array of 5-7 key talking points (strings) specific to this client
- clientBackground: Paragraph about the client/company (2-3 sentences)
- keyObjections: Array of 3-5 likely objections the client might raise (strings)

Incorporate any focus areas from the voice request. Make everything specific and actionable for a financial services sales context.`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    const prepData = parseAIJson(content);

    const agendaCount = Array.isArray(prepData.agenda) ? (prepData.agenda as unknown[]).length : 0;
    const pointsCount = Array.isArray(prepData.talkingPoints) ? (prepData.talkingPoints as unknown[]).length : 0;
    const firstPoint = Array.isArray(prepData.talkingPoints) && prepData.talkingPoints.length > 0
      ? String(prepData.talkingPoints[0])
      : "";
    const ttsText = `Brief ready for ${matchedMeeting.leadName}. ${agendaCount} agenda items and ${pointsCount} talking points prepared.${firstPoint ? ` Leading with: ${firstPoint}` : ""}`;
    const ttsBuffer = await textToSpeech(ttsText, "nova", "mp3");

    res.json({
      transcript,
      matchedMeetingId: matchedMeeting.id,
      ...prepData,
      audioBase64: ttsBuffer.toString("base64"),
    });
  } catch (err) {
    req.log.error({ err }, "Voice prep-me generation failed");
    res.status(500).json({ error: "Failed to generate prep from voice" });
  }
});

export default router;
