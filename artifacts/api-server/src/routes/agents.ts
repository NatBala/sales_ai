import { Router, type IRouter, type Request, type Response } from "express";
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

router.post("/agents/lead-me", async (req: Request, res: Response) => {
  const parsed = GenerateLeadsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const { query } = parsed.data;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: [
        {
          role: "system",
          content: `You are a sales intelligence AI that generates realistic, high-quality leads for financial services sales professionals. 
Generate leads that match the query with realistic data. Each lead should have a fit score (0-100) and detailed information.
Always respond with valid JSON only.`,
        },
        {
          role: "user",
          content: `Generate 8 high-quality leads matching this query: "${query}"
          
Return a JSON object with a "leads" array. Each lead must have:
- name: Full name (string)
- company: Company name (string)
- title: Job title (string)
- score: Fit score 0-100 (number)
- reason: Brief reason why this lead is a good fit (string, 1-2 sentences)
- assets: Financial assets/portfolio overview (string, 2-3 sentences about their portfolio, AUM, investment style)
- sales: Sales history/relationship info (string, 2-3 sentences about past interactions, deals, or relationship potential)
- reasoning: Detailed AI reasoning for fit (string, 3-4 sentences about why this lead matches the query and potential value)
- email: Professional email (string or null)
- phone: Phone number (string or null)
- linkedIn: LinkedIn URL (string or null)
- location: City, State (string or null)
- industry: Industry sector (string or null)
- aum: Assets Under Management if applicable (string or null)

Make the data realistic and varied. High scores (85+) for top matches, 70-84 for good matches.`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    const data = parseAIJson(content);
    res.json(data);
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

  const format: "webm" | "mp3" | "wav" =
    mimeType?.includes("mp4") || mimeType?.includes("aac") ? "mp3" : "webm";

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    const buf = Buffer.from(audioBase64, "base64");
    const stream = await speechToTextStream(buf, format);

    for await (const delta of stream) {
      res.write(`data: ${JSON.stringify({ delta })}\n\n`);
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    req.log.error({ err }, "Lead Me transcription failed");
    res.write(`data: ${JSON.stringify({ error: "Transcription failed" })}\n\n`);
    res.end();
  }
});

router.post("/agents/schedule-me", async (req: Request, res: Response) => {
  const parsed = GenerateEmailBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const { leadName, leadCompany, leadTitle, context } = parsed.data;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: [
        {
          role: "system",
          content: `You are an expert sales communication AI that crafts highly personalized, professional outreach emails for financial services sales professionals.
Your emails are concise, value-focused, and avoid generic language. Always respond with valid JSON only.`,
        },
        {
          role: "user",
          content: `Generate a personalized outreach email for:
Name: ${leadName}
Company: ${leadCompany}
Title: ${leadTitle}
Additional Context: ${context || "No additional context provided"}

Return a JSON object with:
- subject: Email subject line (compelling, personalized)
- body: Full email body (professional, 150-200 words, personalized to their role/company, clear value proposition, specific call to action for a 30-minute call)
- scheduledTime: null (the user will pick the time)

The email should feel hand-written, not templated. Reference their role and company specifically.`,
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
          content: `You are an elite sales coach for financial services professionals at Capital Group. 
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
          content: `Generate a realistic financial advisor persona for a Capital Group practice session.
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

You are in a sales roleplay practice session. A Capital Group salesperson is practicing their pitch with you.
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
          content: `You are an elite sales coach evaluating financial services sales conversations against the Capital Group "VG Way" Professional Engagement Framework. Be rigorous and specific. Always respond with valid JSON only.`,
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
          content: `You are an expert sales communication AI that crafts highly personalized, professional outreach emails for financial services sales professionals.
Your emails are concise, value-focused, and avoid generic language. Always respond with valid JSON only.`,
        },
        {
          role: "user",
          content: `Generate a personalized outreach email for:
Name: ${leadName}
Company: ${leadCompany}
Title: ${leadTitle || "Executive"}
Salesperson's voice instructions: "${transcript}"

Return a JSON object with:
- subject: Email subject line (compelling, personalized)
- body: Full email body (professional, 150-200 words, personalized to their role/company, clear value proposition, specific call to action for a 30-minute call)
- scheduledTime: null

Incorporate the voice instructions naturally. The email should feel hand-written, not templated.`,
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
