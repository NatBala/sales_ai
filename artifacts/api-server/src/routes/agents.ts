import { Router, type IRouter, type Request, type Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
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

export default router;
