import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { ensureCompatibleFormat, speechToText, textToSpeechStream } from "@workspace/integrations-openai-ai-server/audio";

const router = Router();

const AVAILABLE_SLOTS = [
  { label: "Monday Mar 23",    times: ["8:00 AM PT",  "2:00 PM PT"],  dateStr: "2026-03-23", timeStrs: ["08:00", "14:00"] },
  { label: "Tuesday Mar 24",   times: ["9:30 AM PT",  "3:00 PM PT"],  dateStr: "2026-03-24", timeStrs: ["09:30", "15:00"] },
  { label: "Wednesday Mar 25", times: ["9:00 AM PT",  "12:00 PM PT"], dateStr: "2026-03-25", timeStrs: ["09:00", "12:00"] },
  { label: "Thursday Mar 26",  times: ["10:00 AM PT", "4:30 PM PT"],  dateStr: "2026-03-26", timeStrs: ["10:00", "16:30"] },
  { label: "Friday Mar 27",    times: ["12:00 PM PT", "3:30 PM PT"],  dateStr: "2026-03-27", timeStrs: ["12:00", "15:30"] },
];

function buildSystemPrompt(opts: {
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
    opts.aumM            ? `AUM: $${opts.aumM.toFixed(1)}M`                                                    : null,
    opts.fiOpportunities ? `Fixed Income opportunity: $${(opts.fiOpportunities / 1000).toFixed(0)}K`           : null,
    opts.etfOpportunities? `ETF opportunity: $${(opts.etfOpportunities / 1000).toFixed(0)}K`                   : null,
    opts.alpha           ? `Alpha generated: $${(opts.alpha / 1000).toFixed(0)}K`                              : null,
    opts.territory       ? `Territory: ${opts.territory}`                                                       : null,
    opts.advisorSegment  ? `Advisor segment: ${opts.advisorSegment}`                                           : null,
    opts.competitors?.length ? `Current products: ${opts.competitors.slice(0, 3).join(", ")}`                  : null,
  ].filter(Boolean).join(". ");

  return `You are Maya, a Capital Group Digital Desk representative calling a financial advisor to book a 20–25 minute working session.

ADVISOR YOU ARE CALLING:
Name: ${opts.advisorName}
Firm: ${opts.advisorCompany}
${advisorCtx}

YOUR JOB:
1. Identify one live pain point in this advisor's practice.
2. Connect that pain point to one Capital Group conversation module.
3. Secure a 20–25 minute meeting with a Capital Group consultant or specialist.
4. When the advisor agrees to a time, say: "Perfect, I'm booking you for [DAY] at [TIME] for [TOPIC]. I'll send a calendar invite right away." Use those exact words to confirm.

CALL FLOW:
1. Permission opener — ask for 30 seconds: "Hi, this is Maya with Capital Group's advisor team. Did I catch you at a decent moment?"
2. Reason for the call — practical framing: "I'm not calling to pitch a fund. I'm calling to see if it makes sense to set up a short working session around one live issue in your practice."
3. Find one pain point — ask what's taking the most time: taxable clients, cash-heavy households, fixed income, concentrated positions, direct indexing, or practice efficiency.
4. Match the pain point to one Capital Group module — use one proof point, then ask a follow-up question.
5. Narrow the meeting — make it feel small: "Rather than a broad intro, we can keep this to 20 minutes on one topic."
6. Calendar close — offer two specific times from the available slots below.

AVAILABLE MEETING SLOTS (offer these — use Pacific Time):
${slotList}

BOOKING CONFIRMATION — when the advisor agrees to a specific time, you MUST say:
"Perfect, I'm booking you for [full day label] at [time] for [agreed topic]. I'll send a calendar invite right away."
For example: "Perfect, I'm booking you for Tuesday Mar 24 at 9:30 AM PT for fixed income models. I'll send a calendar invite right away."

STYLE RULES:
- Sound calm, human, and practical. Never pushy.
- Respect time — never monologue for more than 20–25 seconds without asking a question.
- Use plain English. No brochure language or buzzwords.
- Use one proof point per turn, then ask a question.
- Acknowledge objections before redirecting — agree first, then reframe.

CONVERSATION MODULES (use one, based on pain point):

ACTIVE MANAGEMENT HERITAGE: Capital Group manages approximately $2.6 trillion globally with a multi-portfolio manager system dating back to 1931. Meeting angle: research depth and long-term track record, not just a single fund.

PRACTICE EFFICIENCY (Advisor's Alpha): Advisor's Alpha covers portfolio construction, financial planning, and behavioral coaching. Model portfolios cost 80% less than industry average on average. Meeting angle: where automation creates time for client relationships.

PORTFOLIO DIAGNOSTICS: Capital Group's global research platform includes analysts based in local markets worldwide. Meeting angle: diagnostic review of fixed income and equity sleeves, not a replacement pitch.

ACTIVE FIXED INCOME: Capital Group Core Plus Income ETF (CGCP) offers a flexible multi-sector approach spanning investment grade, high yield, and global bonds. Meeting angle: where active bond management adds value over passive fixed income.

CAPITAL GROUP ETF LINEUP: CGCP (core plus bond), CGUS (U.S. equity), CGGR (growth), CGXU (international focus), CGDV (dividend value) — actively managed ETFs across key asset classes. Meeting angle: how active ETFs complement passive allocations.

OBJECTION HANDLING:
- "I already have other managers" → "This doesn't have to be a replacement conversation. Capital Group's consultants can review any portfolio — it doesn't have to be a replacement conversation."
- "We already use Capital Group" → "Then the meeting probably shouldn't be about the basics. The more useful angle may be the newer ETF lineup, fixed income strategies, or how they complement your existing allocations."
- "Send me something" → "Happy to. Let me put 20 minutes on the calendar first so the consultant comes prepared on your actual issue, and I'll send a short agenda."
- "Too busy" → "Understood. Let's make it smaller: one issue, 20 minutes, no broad overview."
- "I don't want a product pitch" → "That's fair. We can set the expectation: 20-minute working session on one live issue."

CORE CLOSE:
"Rather than a broad intro, we can keep this to 20 minutes on one issue that's actually live in your practice. I have [time A] or [time B]. Which is easier?"

WHAT NOT TO DO:
- Do not guarantee returns or tax outcomes
- Do not claim Capital Group is best for everyone
- Do not monologue — keep turns short and ask questions
- Do not repeat yourself

Today's date is March 22, 2026. You are making an outbound call to ${opts.advisorName} at ${opts.advisorCompany}.`;
}

interface HistoryEntry {
  role: "user" | "assistant";
  text: string;
}

interface BookingDetection {
  detected: boolean;
  dayLabel?: string;
  timeLabel?: string;
  dateStr?: string;
  timeStr?: string;
  agendaTopic?: string;
}

function detectBooking(text: string): BookingDetection {
  const lower = text.toLowerCase();

  if (!lower.includes("booking you for") && !lower.includes("booked you for")) {
    return { detected: false };
  }

  let dateStr = "";
  let timeStr = "";
  let dayLabel = "";
  let timeLabel = "";

  for (const slot of AVAILABLE_SLOTS) {
    const slotLabel = slot.label.toLowerCase();
    if (lower.includes(slotLabel)) {
      dayLabel = slot.label;
      for (let i = 0; i < slot.times.length; i++) {
        if (lower.includes(slot.times[i].toLowerCase())) {
          timeLabel = slot.times[i];
          dateStr = slot.dateStr;
          timeStr = slot.timeStrs[i];
          break;
        }
      }
      if (!timeLabel) {
        timeLabel = slot.times[0];
        dateStr = slot.dateStr;
        timeStr = slot.timeStrs[0];
      }
      break;
    }
  }

  const topicMatch = text.match(/booking you for .+? at .+? for (.+?)[.\n]/i) ||
                     text.match(/booking you for .+? at .+? for (.+?)$/i);
  const agendaTopic = topicMatch?.[1]?.trim() || "Capital Group working session";

  return {
    detected: true,
    dayLabel: dayLabel || "Tuesday Mar 24",
    timeLabel: timeLabel || "9:30 AM PT",
    dateStr: dateStr || "2026-03-24",
    timeStr: timeStr || "09:30",
    agendaTopic,
  };
}

router.post("/voice/maya-turn", async (req, res) => {
  try {
    const {
      audio: audioBase64,
      history = [],
      isOpener = false,
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
      audio?: string;
      history?: HistoryEntry[];
      isOpener?: boolean;
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

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const sendEvent = (event: Record<string, unknown>) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    const systemPrompt = buildSystemPrompt({
      advisorName, advisorCompany, advisorSegment, aumM,
      fiOpportunities, etfOpportunities, alpha, competitors, territory,
    });

    let userText = "";

    if (!isOpener && audioBase64) {
      const audioBuffer = Buffer.from(audioBase64, "base64");
      const { buffer: wavBuffer, format } = await ensureCompatibleFormat(audioBuffer);
      userText = await speechToText(wavBuffer, format);
      sendEvent({ type: "user_transcript", data: userText });
    }

    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: systemPrompt },
    ];

    for (const h of history) {
      messages.push({ role: h.role, content: h.text });
    }

    if (!isOpener && userText) {
      messages.push({ role: "user", content: userText });
    }

    if (isOpener) {
      messages.push({
        role: "user",
        content: "[The advisor picked up the phone. Start the call with your permission opener — keep it to 1–2 sentences.]",
      });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      messages,
      max_completion_tokens: 200,
    });

    const mayaText = completion.choices[0]?.message?.content ?? "";

    const booking = detectBooking(mayaText);

    const audioStream = await textToSpeechStream(mayaText, "alloy");

    let fullTranscript = "";
    for await (const chunk of audioStream) {
      sendEvent({ type: "audio", data: chunk });
    }

    fullTranscript = mayaText;
    sendEvent({ type: "transcript", data: fullTranscript });

    if (booking.detected) {
      sendEvent({
        type: "book_meeting",
        date: booking.dateStr,
        time: booking.timeStr,
        agendaTopic: booking.agendaTopic,
        dayLabel: booking.dayLabel,
        timeLabel: booking.timeLabel,
      });
    }

    sendEvent({ done: true });
    res.end();
  } catch (err) {
    console.error("Voice maya-turn error:", err);
    const msg = err instanceof Error ? err.message : "Internal error";
    res.write(`data: ${JSON.stringify({ type: "error", error: msg })}\n\n`);
    res.end();
  }
});

// ─── POST /voice/transcribe ───────────────────────────────────────────────────
// Accepts a raw audio base64 blob, returns a Whisper transcript.
// Used by Ask Maya voice commands (MediaRecorder → Whisper).
router.post("/voice/transcribe", async (req: Request, res: Response) => {
  try {
    const { audio } = req.body as { audio?: string };
    if (!audio) return res.status(400).json({ error: "Missing audio field" });

    const audioBuffer = Buffer.from(audio, "base64");
    if (audioBuffer.byteLength < 100) {
      return res.json({ transcript: "" });
    }

    const transcript = await speechToText(audioBuffer, "webm");
    return res.json({ transcript: transcript.trim() });
  } catch (err) {
    console.error("Transcribe error:", err);
    const msg = err instanceof Error ? err.message : "Transcription failed";
    return res.status(500).json({ error: msg });
  }
});

export { AVAILABLE_SLOTS };
export default router;
