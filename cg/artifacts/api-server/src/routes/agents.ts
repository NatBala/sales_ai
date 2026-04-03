import { Router, type IRouter, type Request, type Response } from "express";
import { clearAllInMemory } from "../store.js";
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
  advisorProfile: string; salesEngagement: string; salesNotes: string;
  rawRow: Record<string, string>;
}

interface CoachAdvisorContext {
  aumM?: number;
  salesAmt?: number;
  redemption?: number;
  fiOpportunities?: number;
  etfOpportunities?: number;
  alpha?: number;
  competitors?: string[];
  buyingUnit?: string;
  territory?: string;
  segment?: string;
  ratings?: number | null;
  advisorProfile?: string;
  salesEngagement?: string;
  salesNotes?: string;
  advisorRow?: Record<string, string>;
}

function buildCoachAdvisorSourceContext(
  advisorContext?: CoachAdvisorContext | null,
  matchedAdvisor?: AdvisorRow | null,
): CoachAdvisorContext | null {
  const merged: CoachAdvisorContext = {
    aumM: advisorContext?.aumM ?? matchedAdvisor?.aumM,
    salesAmt: advisorContext?.salesAmt ?? matchedAdvisor?.salesAmt,
    redemption: advisorContext?.redemption ?? matchedAdvisor?.redemption,
    fiOpportunities: advisorContext?.fiOpportunities ?? matchedAdvisor?.fiOpportunities,
    etfOpportunities: advisorContext?.etfOpportunities ?? matchedAdvisor?.etfOpportunities,
    alpha: advisorContext?.alpha ?? matchedAdvisor?.alpha,
    competitors: advisorContext?.competitors?.length ? advisorContext.competitors : matchedAdvisor?.competitors,
    buyingUnit: advisorContext?.buyingUnit ?? matchedAdvisor?.buyingUnit,
    territory: advisorContext?.territory ?? matchedAdvisor?.territory,
    segment: advisorContext?.segment ?? matchedAdvisor?.segment,
    ratings: advisorContext?.ratings ?? matchedAdvisor?.ratings,
    advisorProfile: advisorContext?.advisorProfile ?? matchedAdvisor?.advisorProfile,
    salesEngagement: advisorContext?.salesEngagement ?? matchedAdvisor?.salesEngagement,
    salesNotes: advisorContext?.salesNotes ?? matchedAdvisor?.salesNotes,
    advisorRow: advisorContext?.advisorRow ?? matchedAdvisor?.rawRow,
  };

  return Object.values(merged).some((value) => {
    if (Array.isArray(value)) return value.length > 0;
    return value !== undefined && value !== null && value !== "";
  }) ? merged : null;
}

function parseCSV(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQ = false;

  for (let i = 0; i < csv.length; i += 1) {
    const c = csv[i];

    if (c === "\"") {
      if (inQ && csv[i + 1] === "\"") {
        cur += "\"";
        i += 1;
      } else {
        inQ = !inQ;
      }
      continue;
    }

    if (c === "," && !inQ) {
      row.push(cur.trim());
      cur = "";
      continue;
    }

    if ((c === "\n" || c === "\r") && !inQ) {
      if (c === "\r" && csv[i + 1] === "\n") {
        i += 1;
      }
      row.push(cur.trim());
      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }
      row = [];
      cur = "";
      continue;
    }

    cur += c;
  }

  if (cur.length > 0 || row.length > 0) {
    row.push(cur.trim());
    if (row.some((value) => value.length > 0)) {
      rows.push(row);
    }
  }

  return rows;
}

const ADVISORS: AdvisorRow[] = (() => {
  try {
    const csvPath = join(__dirname, "advisors.csv");
    const csv = readFileSync(csvPath, "utf-8");
    const rows = parseCSV(csv);
    const headers = (rows[0] ?? []).map(h => h.trim());
    return rows.slice(1).map((vals) => {
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
        advisorProfile: o["Synthetic Advisor Profile"] ?? "",
        salesEngagement: o["Synthetic Sales Engagement"] ?? "",
        salesNotes: o["Synthetic Sales Notes"] ?? "",
        rawRow: o,
      };
    });
  } catch (err) {
    console.error("Failed to load advisors CSV:", err);
    return [];
  }
})();

const LEAD_ME_FIRMS = Array.from(new Set(ADVISORS.map(a => a.firm).filter(Boolean))).sort();
const LEAD_ME_COUNTIES = Array.from(
  new Set(
    ADVISORS
      .map(a => a.territory.split(" - ")[1]?.trim() ?? "")
      .filter(Boolean)
  )
).sort();
const LEAD_ME_SEGMENTS = Array.from(new Set(ADVISORS.map(a => a.segment).filter(Boolean))).sort();
const LEAD_ME_COMPETITOR_BRANDS = [
  "BlackRock",
  "CapitalGroup",
  "State Street",
  "Invesco",
  "Fidelity",
  "PIMCO",
  "JPMorgan",
] as const;

function findAdvisorDatasetRow(advisorName: string, advisorCompany: string): AdvisorRow | null {
  const normalizedName = advisorName.trim().toLowerCase();
  const normalizedCompany = advisorCompany.trim().toLowerCase().replace(/\s+/g, " ").trim();

  const exact = ADVISORS.find((advisor) =>
    advisor.name.trim().toLowerCase() === normalizedName &&
    advisor.firm.trim().toLowerCase().replace(/\s+/g, " ").trim() === normalizedCompany,
  );
  if (exact) return exact;

  const fuzzy = ADVISORS.find((advisor) => {
    const advisorNameNormalized = advisor.name.trim().toLowerCase();
    const advisorFirmNormalized = advisor.firm.trim().toLowerCase().replace(/\s+/g, " ").trim();
    return advisorNameNormalized === normalizedName && (
      advisorFirmNormalized.includes(normalizedCompany) ||
      normalizedCompany.includes(advisorFirmNormalized)
    );
  });
  if (fuzzy) return fuzzy;

  const nameMatches = ADVISORS.filter((advisor) => advisor.name.trim().toLowerCase() === normalizedName);
  return nameMatches.length === 1 ? nameMatches[0] : null;
}

const LEAD_ME_TRANSCRIPTION_PROMPT = `Transcribe a spoken lead-search query for Capital Group's advisor dataset.

The query should preserve exact dataset vocabulary and abbreviations.

Dataset schema fields the speaker may mention:
- Firm
- Segment
- Territory
- Buying Units
- AUM (Millions)
- Sales
- Redemption
- Competitor Mentions
- FI Opportunities ($)
- ETF Opportunities ($)
- Alpha ($)
- Advisor profile
- Sales notes
- Sales engagement

Valid firms in the dataset: ${LEAD_ME_FIRMS.join(", ")}.
Valid segments: ${LEAD_ME_SEGMENTS.join(", ")}.
Territory prefixes: XC and FC.
XC means Exclusive Channel. FC means Flexible Channel.
Territory county values include: ${LEAD_ME_COUNTIES.join(", ")}.
Buying Units use the exact format BU_<number>, such as BU_1, BU_9, BU_27, BU_78.

Important spoken mappings:
- "XC" -> XC
- "FC" -> FC
- "EJ" -> Edward Jones
- "MS" -> Morgan Stanley
- "ML", "Merrill", or "Merill" -> Merrill Lynch
- "Wells" -> Wells Fargo
- "UBS" -> UBS
- "high opportunity" -> high opportunity
- "ETF opportunity" -> ETF opportunity
- "fixed income opportunity" or "FI opportunity" -> FI opportunity
- "show the profile" or "advisor profile" -> advisor profile

Transcription rules:
- Prefer valid dataset values over phonetically similar words.
- Keep short codes uppercase.
- Keep county names, firm names, segments, and BU codes exact.
- Do not rewrite XC as other words.
- Do not rewrite EJ, MS, ML, or BU codes into generic text.
- If uncertain, choose the closest valid dataset term.

Example outputs:
- "XC EJ advisors in San Diego County" -> "XC Edward Jones advisors in San Diego County"
- "MS in XC with high ETF opportunity" -> "Morgan Stanley in XC with high ETF opportunity"
- "Wells FC Orange County segment A" -> "Wells Fargo FC Orange County segment A"
- "ML BU 27 Alameda County" -> "Merrill Lynch BU_27 Alameda County"
- "identify leads with high opportunity and show the profile" -> "identify leads with high opportunity and show the advisor profile"`;

const LEAD_ME_TRANSCRIPT_NORMALIZATION_PROMPT = `You are correcting a spoken lead-search query for Capital Group's advisor dataset.
Return only the corrected transcript text.

Your job:
- Normalize the query so it matches the advisor dataset schema and valid values.
- Preserve the user's intended filters and ranking intent.
- Correct firm aliases, territory/channel terms, county names, segment labels, and opportunity phrases.
- Make the corrected transcript clear by grounding it in dataset column names with values.
- Use only schema columns and the values those columns can take. Do not invent advisor names or person-level entities.
- Prefer explicit labeled phrasing such as:
  - "Firm: Edward Jones"
  - "Territory: XC - Cook County"
  - "Segment: A"
  - "Buying Units: BU_27"
  - "Competitor Mentions: BlackRock"
  - "Prioritize high Sales and high Alpha"
  - "Prioritize high FI Opportunities"
- Keep the corrected transcript concise enough to display in the Lead Me query box.

Dataset fields the user may be filtering on:
- Firm
- Segment
- Territory
- Buying Units
- AUM (Millions)
- Sales
- Redemption
- Competitor Mentions
- FI Opportunities ($)
- ETF Opportunities ($)
- Alpha ($)

Valid firms: ${LEAD_ME_FIRMS.join(", ")}.
Valid segments: ${LEAD_ME_SEGMENTS.join(", ")}.
Valid county values: ${LEAD_ME_COUNTIES.join(", ")}.
Valid channel prefixes: XC and FC.
Valid competitor brands: ${LEAD_ME_COMPETITOR_BRANDS.join(", ")}.
Buying Units use BU_<number> format such as BU_1, BU_9, BU_27, BU_78.

Important spoken mappings:
- EJ => Edward Jones
- MS => Morgan Stanley
- ML, Merrill, or Merill => Merrill Lynch
- Wells => Wells Fargo
- XC => XC
- FC => FC
- Cooks County => Cook County
- Cooks => Cook County

Normalization rules:
1. Prefer exact dataset values over phonetic spellings.
2. Keep short dataset codes uppercase.
3. Preserve filter intent like high opportunity, high ETF opportunity, high fixed income opportunity, high alpha, top rated, or largest AUM.
4. If the user asks for advisor profiles or profile details, preserve that wording.
5. If multiple filters are present, keep all of them in the corrected output.
6. If the transcript is noisy, still preserve at least the firm name if one is clear.
7. Whenever possible, rewrite the transcript using the dataset column names and grounded values rather than vague prose.
8. Use exact schema wording where possible:
   - Firm
   - Territory
   - Segment
   - Buying Units
   - Sales
   - Alpha
   - FI Opportunities
   - ETF Opportunities
   - AUM
   - Competitor Mentions
9. Do not use advisor names, personal details, or free-form profile text in the correction layer unless the user clearly said an advisor name and you are certain it is correct. Prefer column-based filters instead.
10. Do not output JSON. Output only corrected query text.

Examples:
- "generate leads for EJ with high sales alpha from xc cooks county who have fixed income opportunity from segment A"
  => "Generate leads with Firm: Edward Jones, Territory: XC - Cook County, Segment: A, prioritize high Sales, high Alpha, and high FI Opportunities"
- "find ms in xc with high etf opp and profile"
  => "Find advisors with Firm: Morgan Stanley, Territory: XC, prioritize high ETF Opportunities, and show advisor profile"
- "wells orange county high opportunity"
  => "Find advisors with Firm: Wells Fargo, Territory: Orange County, and prioritize high total opportunity"`;

function postProcessLeadTranscript(text: string): string {
  let corrected = text;

  const replaceAll = (pattern: RegExp, value: string) => {
    corrected = corrected.replace(pattern, value);
  };

  replaceAll(/\bEJ\b/gi, "Edward Jones");
  replaceAll(/\bMS\b/gi, "Morgan Stanley");
  replaceAll(/\bML\b/gi, "Merrill Lynch");
  replaceAll(/\bMerill\b/gi, "Merrill");
  replaceAll(/\bWells\b/gi, "Wells Fargo");
  replaceAll(/\bX\s*C\b/gi, "XC");
  replaceAll(/\bF\s*C\b/gi, "FC");

  for (const county of LEAD_ME_COUNTIES) {
    const baseCounty = county.replace(/\s+County$/i, "");
    replaceAll(new RegExp(`\\b${baseCounty}s?\\s+County\\b`, "gi"), county);
    replaceAll(new RegExp(`\\b(?:XC|Exi|Exclusive|NC|N\\s*C)\\s*${baseCounty}s?\\s*County\\b`, "gi"), `XC ${county}`);
    replaceAll(new RegExp(`\\b(?:FC|Flexible|F\\s*C)\\s*${baseCounty}s?\\s*County\\b`, "gi"), `FC ${county}`);
  }

  replaceAll(/\bhigh sales alpha\b/gi, "high sales and high alpha");
  replaceAll(/\bfixed income opp\b/gi, "fixed income opportunity");
  replaceAll(/\betf opp\b/gi, "ETF opportunity");
  replaceAll(/\s+/g, " ");

  const firmMatch = LEAD_ME_FIRMS.find((firm) => corrected.toLowerCase().includes(firm.toLowerCase()));
  const segmentMatch = corrected.match(/\bsegment\s*:?\s*([A-E])\b/i)?.[1]?.toUpperCase()
    ?? corrected.match(/\b([A-E])\b/)?.[1]?.toUpperCase();
  const territoryMatch = LEAD_ME_COUNTIES.find((county) => corrected.toLowerCase().includes(county.toLowerCase()));
  const hasXC = /\bXC\b/i.test(corrected);
  const hasFC = /\bFC\b/i.test(corrected);
  const wantsSales = /\bsales\b/i.test(corrected);
  const wantsAlpha = /\balpha\b/i.test(corrected);
  const wantsFi = /\bfixed income opportunity\b|\bfi opportunities?\b|\bfi opportunity\b/i.test(corrected);
  const wantsEtf = /\betf opportunities?\b|\betf opportunity\b/i.test(corrected);
  const wantsProfile = /\badvisor profile\b|\bshow advisor profile\b|\bprofile details\b/i.test(corrected);

  const labeledParts: string[] = [];
  if (firmMatch) labeledParts.push(`Firm: ${firmMatch}`);
  if (territoryMatch || hasXC || hasFC) {
    const territoryPrefix = hasXC ? "XC - " : hasFC ? "FC - " : "";
    labeledParts.push(`Territory: ${territoryPrefix}${territoryMatch ?? ""}`.trim());
  }
  if (segmentMatch && LEAD_ME_SEGMENTS.includes(segmentMatch)) labeledParts.push(`Segment: ${segmentMatch}`);

  const priorities: string[] = [];
  if (wantsSales) priorities.push("high Sales");
  if (wantsAlpha) priorities.push("high Alpha");
  if (wantsFi) priorities.push("high FI Opportunities");
  if (wantsEtf) priorities.push("high ETF Opportunities");
  if (priorities.length > 0) labeledParts.push(`Prioritize ${priorities.join(", ")}`);
  if (wantsProfile) labeledParts.push("Show advisor profile");

  return (labeledParts.length > 0 ? labeledParts.join(", ") : corrected).trim();
}

const router: IRouter = Router();

// ─── Reset leads + meetings ───────────────────────────────────────────────────
router.post("/agents/reset-leads", async (_req: Request, res: Response) => {
  clearAllInMemory();
  try {
    const { db, leadsTable } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");
    await db.delete(leadsTable).where(eq(leadsTable.userId, "demo-user"));
  } catch {
    // DB unavailable
  }
  res.json({ success: true });
});

router.post("/agents/reset-meetings", async (_req: Request, res: Response) => {
  clearAllInMemory();
  try {
    const { db, meetingsTable } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");
    await db.delete(meetingsTable).where(eq(meetingsTable.userId, "demo-user"));
  } catch {
    // DB unavailable
  }
  res.json({ success: true });
});

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

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }

  return [];
}

function joinStringArray(value: unknown, fallback: string): string {
  const items = readStringArray(value);
  return items.length > 0 ? items.join(", ") : fallback;
}

function readInteger(value: unknown, fallback: number, min?: number, max?: number): number {
  const raw = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(raw)) return fallback;
  const rounded = Math.round(raw);
  const lowerBounded = typeof min === "number" ? Math.max(min, rounded) : rounded;
  return typeof max === "number" ? Math.min(max, lowerBounded) : lowerBounded;
}

function normalizeScorecard(raw: Record<string, unknown>) {
  const cgWayScores = typeof raw.cgWayScores === "object" && raw.cgWayScores !== null
    ? raw.cgWayScores as Record<string, unknown>
    : {};

  const stageFeedbackRaw = Array.isArray(raw.stageFeedback) ? raw.stageFeedback : [];
  const strengthsRaw = Array.isArray(raw.strengths) ? raw.strengths : [];
  const missesRaw = Array.isArray(raw.misses) ? raw.misses : [];
  const rewriteExamplesRaw = Array.isArray(raw.rewriteExamples) ? raw.rewriteExamples : [];

  const stageOrder = ["Agenda", "Discovery", "Insights", "Practice Management", "Summarize & Prioritize", "Close"] as const;

  const normalizedStageFeedback = stageOrder.map((stage, index) => {
    const match = stageFeedbackRaw.find((item) => (
      typeof item === "object" &&
      item !== null &&
      readString((item as Record<string, unknown>).stage) === stage
    )) as Record<string, unknown> | undefined;

    return {
      stage,
      score: readInteger(match?.score, 3, 1, 5),
      assessment: readString(match?.assessment, "Partial execution with room to tighten this stage."),
      evidence: readString(match?.evidence, "Transcript evidence was limited or incomplete."),
      improvementExample: readString(match?.improvementExample, "Use a shorter, more specific line tied to the advisor's stated need."),
    };
  });

  return {
    overallAssessment: readString(raw.overallAssessment, "This was a mixed practice call with opportunities to tighten discovery, prioritization, and close."),
    finalScore: readInteger(raw.finalScore, 64, 0, 100),
    coachVerdict: readString(raw.coachVerdict, "Mixed execution"),
    coachModeSummary: readString(raw.coachModeSummary, "You created some forward motion, but the next step is to tighten agenda control, deepen discovery, and land a clearer close tied to the advisor's business problem."),
    topPriorityFix: readString(raw.topPriorityFix, "Slow down after the opening and earn the right to recommend anything by getting to the advisor's real client and practice constraints first."),
    cgWayScores: {
      agenda: readInteger(cgWayScores.agenda, 3, 1, 5),
      discovery: readInteger(cgWayScores.discovery, 3, 1, 5),
      insights: readInteger(cgWayScores.insights, 3, 1, 5),
      practiceManagement: readInteger(cgWayScores.practiceManagement, 3, 1, 5),
      summarizePrioritize: readInteger(cgWayScores.summarizePrioritize, 3, 1, 5),
      close: readInteger(cgWayScores.close, 3, 1, 5),
    },
    stageFeedback: normalizedStageFeedback,
    strengths: strengthsRaw.slice(0, 2).map((item, index) => {
      const entry = typeof item === "object" && item !== null ? item as Record<string, unknown> : {};
      return {
        title: readString(entry.title, index === 0 ? "You created some engagement" : "You showed relevant intent"),
        whyItWorked: readString(entry.whyItWorked, "This helped keep the conversation moving and gave the advisor something concrete to react to."),
        evidence: readString(entry.evidence, "There was at least one moment where the advisor continued the discussion rather than shutting it down."),
      };
    }).concat(Array.from({ length: Math.max(0, 2 - strengthsRaw.length) }, (_, index) => ({
      title: index === 0 ? "You created some engagement" : "You showed relevant intent",
      whyItWorked: "This gave the conversation some momentum even if execution was uneven.",
      evidence: "The transcript contained signals of rep effort, but the strongest examples were limited.",
    }))),
    misses: missesRaw.slice(0, 2).map((item, index) => {
      const entry = typeof item === "object" && item !== null ? item as Record<string, unknown> : {};
      return {
        title: readString(entry.title, index === 0 ? "Discovery could go deeper" : "The close needs more precision"),
        whyItMattered: readString(entry.whyItMattered, "Without this, the conversation stays generic and harder to advance."),
        evidence: readString(entry.evidence, "The transcript did not show a strong enough example here."),
        fix: readString(entry.fix, "Use a shorter question or summary tied directly to the advisor's stated priorities."),
      };
    }).concat(Array.from({ length: Math.max(0, 2 - missesRaw.length) }, (_, index) => ({
      title: index === 0 ? "Discovery could go deeper" : "The close needs more precision",
      whyItMattered: "This gap made it harder to earn a specific next step.",
      evidence: "The transcript did not show enough specificity at this point in the call.",
      fix: "Ask one sharper diagnostic question, then summarize what you heard before proposing a next step.",
    }))),
    rewriteExamples: rewriteExamplesRaw.slice(0, 2).map((item, index) => {
      const entry = typeof item === "object" && item !== null ? item as Record<string, unknown> : {};
      return {
        moment: readString(entry.moment, index === 0 ? "Opening" : "Late-stage advance"),
        issue: readString(entry.issue, "The phrasing could be tighter and more specific to the advisor's context."),
        betterExample: readString(entry.betterExample, "Let me make sure I have your priorities right before I suggest a next step."),
      };
    }).concat(Array.from({ length: Math.max(0, 2 - rewriteExamplesRaw.length) }, (_, index) => ({
      moment: index === 0 ? "Opening" : "Late-stage advance",
      issue: "The line was not specific enough to the advisor's business problem.",
      betterExample: "Before I go further, can I confirm what matters most in how you're positioning this with clients today?",
    }))),
    missedDiscoveryQuestions: readStringArray(raw.missedDiscoveryQuestions).slice(0, 3).concat(
      Array.from({ length: Math.max(0, 3 - readStringArray(raw.missedDiscoveryQuestions).slice(0, 3).length) }, (_, index) => (
        index === 0
          ? "How are you currently positioning this with clients today?"
          : index === 1
            ? "What client situations are creating the most friction right now?"
            : "What would make a next meeting worth your time?"
      )),
    ),
    nextRepPlan: readStringArray(raw.nextRepPlan).slice(0, 3).concat(
      Array.from({ length: Math.max(0, 3 - readStringArray(raw.nextRepPlan).slice(0, 3).length) }, (_, index) => (
        index === 0
          ? "Open with a tighter agenda and explicit time check."
          : index === 1
            ? "Ask for one live case before recommending an idea."
            : "Close with a specific owner, deliverable, and timing."
      )),
    ),
  };
}

function normalizeFollowUpAnalysis(raw: Record<string, unknown>) {
  const itemsRaw = Array.isArray(raw.items) ? raw.items : [];
  const normalizedItems = itemsRaw.map((item) => {
    const entry = typeof item === "object" && item !== null ? item as Record<string, unknown> : {};
    const title = readString(entry.title, "");
    if (!title) return null;

    const tags = readStringArray(entry.tags).slice(0, 3);

    return {
      title,
      actionType: readString(entry.actionType, "Follow-up"),
      tags: tags.length > 0 ? tags : ["Follow-up"],
      owner: readString(entry.owner, "Salesperson"),
      dueTiming: readString(entry.dueTiming, "No explicit deadline captured"),
      rationale: readString(entry.rationale, "Derived from the meeting recap and stated next steps."),
    };
  }).filter(Boolean) as Array<{
    title: string;
    actionType: string;
    tags: string[];
    owner: string;
    dueTiming: string;
    rationale: string;
  }>;

  const fallbackTasks = readStringArray(raw.tasks);
  const tasks = normalizedItems.length > 0
    ? normalizedItems.map((item) => item.title)
    : (fallbackTasks.length > 0 ? fallbackTasks : [
      "Send the promised follow-up materials.",
      "Confirm the next meeting or touchpoint.",
      "Document the advisor's main request and owner.",
    ]);

  const tagsFromItems = normalizedItems.flatMap((item) => item.tags);
  const tags = Array.from(new Set([
    ...readStringArray(raw.tags),
    ...tagsFromItems,
  ])).slice(0, 10);

  return {
    summary: readString(
      raw.summary,
      "The meeting recap suggests a few concrete follow-ups, but the notes still need a tighter owner and timing structure.",
    ),
    tasks,
    tags: tags.length > 0 ? tags : ["Follow-up"],
    items: normalizedItems,
  };
}

const FOLLOW_ME_TRANSCRIPT_NORMALIZATION_PROMPT = `You are transcribing audio about Capital Group investing products and services.
Return only the corrected transcript.

Normalization rules:
1. Prefer the official Capital Group spelling for products, funds, ETFs, accounts, services, and benchmarks when the spoken audio plausibly matches a known Capital Group term.
2. Preserve uppercase tickers and acronyms exactly: examples include CGCP, CGUS, CGGR, CGXU, CGDV, ETF, IRA, RMD, NAV, APY, FDIC, CFP, and S&P.
3. Preserve numerals and punctuation inside official names when they are part of the product name or plan type: examples include 529, 403(b), SEP-IRA, 401(k).
4. Normalize common spoken variants to the official term when context is clearly about Capital Group investing. Examples: 'C G' or 'CG' -> 'Capital Group'; 'five twenty nine' -> '529'; 'four oh three b' -> '403(b)'; 'sep ira' -> 'SEP-IRA'; 'C G C P' -> 'CGCP'; 'C G U S' -> 'CGUS'; 'C G G R' -> 'CGGR'; 'C G X U' -> 'CGXU'; 'C G D V' -> 'CGDV'.
5. Do not rewrite official product names into generic English phrases. Keep 'Core Plus Income', 'Growth ETF', 'International Focus', 'Dividend Value' exactly as spoken.
6. Do not hallucinate a ticker, product, or tool that is not strongly supported by the audio. If the fund family is clear but the ticker is not, keep the fund name and omit the ticker.
7. If a common English word conflicts with a known Capital Group term, prefer the Capital Group term only when the surrounding context is clearly investing, advice, retirement, taxes, accounts, or portfolio management.
8. In meeting-recap context, if the speaker says 'CG' while referring to products, materials, outlook, funds, comparisons, webinars, or follow-up actions, normalize it to 'Capital Group', not the letters 'CG'.

Capital Group glossary:
ETF lineup:
CGCP; Capital Group Core Plus Income ETF; CGUS; Capital Group U.S. Equity ETF; CGGR; Capital Group Growth ETF; CGXU; Capital Group International Focus ETF; CGDV; Capital Group Dividend Value ETF; CGBL; Capital Group Core Bond ETF; CGIE; Capital Group International Equity ETF; CGGO; Capital Group Global Growth Equity ETF; CGSD; Capital Group Short Duration Income ETF; CGDG; Capital Group Dividend Growers ETF

American Funds (mutual funds):
Growth Fund of America; Capital World Growth and Income Fund; American Balanced Fund; The Income Fund of America; Capital Income Builder; American Funds Target Date Retirement Series; EuroPacific Growth Fund; New Perspective Fund; American High-Income Trust; Bond Fund of America

Finance terms:
ETF; NAV; SEC yield; RMD; APY; FDIC; REIT; IRA; Roth IRA; Traditional IRA; SEP-IRA; 401(k); 403(b); 529; CFP; AUM; alpha; expense ratio; distribution yield

If the audio contains partial names, prefer the closest official Capital Group match from the glossary above.
Output only the final transcript text with no commentary.`;

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
  competitors: string[];    // brand names like "BlackRock", "Fidelity"
  totalOppMin: number | null;
}

type LeadSortBy =
  | "semantic"
  | "totalOpportunity"
  | "fiOpportunity"
  | "etfOpportunity"
  | "alpha"
  | "aum"
  | "ratings"
  | "netPositiveFlow"
  | "netNegativeFlow";

interface LeadSearchIntent {
  filters: ParsedFilters;
  sortBy: LeadSortBy;
  showAdvisorProfile: boolean;
}

const emptyFilters = (): ParsedFilters => ({
  firms: [], segments: [], counties: [], channels: [],
  aumMin: null, aumMax: null, netFlow: null,
  fiOppMin: null, etfOppMin: null, alphaMin: null,
  ratingsMin: null, competitors: [], totalOppMin: null,
});

function normalizeLeadIntent(query: string, intent: LeadSearchIntent): LeadSearchIntent {
  const next: LeadSearchIntent = {
    filters: {
      ...intent.filters,
      firms: [...intent.filters.firms],
      segments: [...intent.filters.segments],
      counties: [...intent.filters.counties],
      channels: [...intent.filters.channels],
      competitors: [...intent.filters.competitors],
    },
    sortBy: intent.sortBy,
    showAdvisorProfile: intent.showAdvisorProfile,
  };

  const lower = query.toLowerCase();
  const addUnique = (target: string[], value: string) => {
    if (!target.some((entry) => entry.toLowerCase() === value.toLowerCase())) {
      target.push(value);
    }
  };

  const firmMatchers: Array<{ value: string; pattern: RegExp }> = [
    { value: "Edward Jones", pattern: /\b(edward jones|ej)\b/i },
    { value: "Merrill Lynch", pattern: /\b(merrill lynch|merrill|merill|ml)\b/i },
    { value: "Morgan Stanley", pattern: /\b(morgan stanley|ms)\b/i },
    { value: "UBS", pattern: /\bubs\b/i },
    { value: "Wells Fargo", pattern: /\b(wells fargo|wells)\b/i },
  ];

  firmMatchers.forEach(({ value, pattern }) => {
    if (pattern.test(query)) addUnique(next.filters.firms, value);
  });

  const segmentMatch = query.match(/\b(?:segment|seg)\s*([A-E])\b/i);
  if (segmentMatch?.[1]) addUnique(next.filters.segments, segmentMatch[1].toUpperCase());

  if (/\bxc\b|\bexclusive channel\b/i.test(query)) addUnique(next.filters.channels, "XC");
  if (/\bfc\b|\bflexible channel\b/i.test(query)) addUnique(next.filters.channels, "FC");

  LEAD_ME_COUNTIES.forEach((county) => {
    const countyLower = county.toLowerCase();
    const shortCounty = countyLower.replace(/\s+county$/, "");
    if (lower.includes(countyLower) || lower.includes(shortCounty)) {
      addUnique(next.filters.counties, county);
    }
  });

  LEAD_ME_COMPETITOR_BRANDS.forEach((brand) => {
    if (lower.includes(brand.toLowerCase())) {
      addUnique(next.filters.competitors, brand);
    }
  });

  const wantsRank = /\b(high|highest|top|largest|biggest|best|sort|rank|prioriti[sz]e)\b/.test(lower);
  const mentionsOpportunity = /\b(opportunity|opportunities|opp)\b/.test(lower);

  if (/(advisor profile|show (?:me )?the profile|show profile|profile details|profile context|advisor details|advisor background|show me more about)/i.test(query)) {
    next.showAdvisorProfile = true;
  }

  if (wantsRank) {
    if (/(fixed income|fi)\s+(opportunity|opportunities|opp)|\b(fi|fixed income)\b.*\b(high|highest|top|largest|best)\b|\b(high|highest|top|largest|best)\b.*\b(fi|fixed income)\b/i.test(query)) {
      next.sortBy = "fiOpportunity";
    } else if (/etf\s+(opportunity|opportunities|opp)|\betf\b.*\b(high|highest|top|largest|best)\b|\b(high|highest|top|largest|best)\b.*\betf\b/i.test(query)) {
      next.sortBy = "etfOpportunity";
    } else if (/\balpha\b/i.test(query)) {
      next.sortBy = "alpha";
    } else if (/\baum\b/i.test(query)) {
      next.sortBy = "aum";
    } else if (/\b(rating|ratings|rated)\b/i.test(query)) {
      next.sortBy = "ratings";
    } else if (/\bpositive net flow\b|\bnet buyer\b|\bnet buyers\b|\bpositive flows?\b/i.test(query)) {
      next.sortBy = "netPositiveFlow";
      next.filters.netFlow = "positive";
    } else if (/\bnegative net flow\b|\bnet seller\b|\bnet sellers\b|\boutflows?\b/i.test(query)) {
      next.sortBy = "netNegativeFlow";
      next.filters.netFlow = "negative";
    } else if (mentionsOpportunity) {
      next.sortBy = "totalOpportunity";
    }
  }

  return next;
}

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

async function parseLeadSearchIntent(query: string): Promise<LeadSearchIntent> {
  try {
    const resp = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 650,
      messages: [
        {
          role: "system",
          content: `You parse natural language queries about Capital Group advisor leads into structured filters and ranking intent.

Dataset schema:
- Firms: Edward Jones, Merrill Lynch, Morgan Stanley, UBS, Wells Fargo
- Segments: A (Top Tier), B (High Value), C (Mid-Market), D (Developing), E (Emerging)
- Channels: XC (Exclusive Channel), FC (Flexible Channel)
- Counties: Cook County, Los Angeles County, Maricopa County, Harris County, Dallas County, Miami-Dade County, Orange County, San Diego County, Clark County, King County, Broward County, Alameda County, Tarrant County, Santa Clara County, Wayne County
- AUM in millions
- FI/ETF opportunities and alpha in dollars
- Competitors: BlackRock, CapitalGroup, State Street, Invesco, Fidelity, PIMCO, JPMorgan

Important parsing rules:
- Ground parsing to schema columns and valid values. Focus on Firm, Segment, Territory, Buying Units, AUM, Sales, Redemption, Competitor Mentions, FI Opportunities, ETF Opportunities, and Alpha.
- Do not infer advisor names or person-level entities unless the user clearly gave one and it is needed.
- Map spoken aliases to exact dataset values:
  - EJ => Edward Jones
  - MS => Morgan Stanley
  - ML, Merrill, or Merill => Merrill Lynch
  - Wells => Wells Fargo
  - XC => XC
  - FC => FC
- Always extract every explicit filter condition the user gave if it maps to the dataset: firm, segment, county, channel, competitor, AUM threshold, ratings threshold, FI opportunity threshold, ETF opportunity threshold, alpha threshold, positive flow, negative flow, and total opportunity threshold.
- Treat county mentions such as Harris, Cook, Orange, San Diego, and Alameda as territory filters when the phrasing implies geography.
- Capture explicit numeric thresholds only when the user states a minimum or maximum.
- If the user asks for high opportunity, highest opportunity, top opportunity, or largest opportunity without specifying FI or ETF, set sortBy to "totalOpportunity".
- If the user asks for high FI opportunity, set sortBy to "fiOpportunity".
- If the user asks for high ETF opportunity, set sortBy to "etfOpportunity".
- If the user asks for high alpha, largest AUM, or top rated, set sortBy accordingly.
- If the user asks for advisor profile, advisor details, advisor background, or to show the profile, set showAdvisorProfile to true.
- If the user asks to identify leads with high opportunity, top opportunity, or best opportunity, set sortBy appropriately and set showAdvisorProfile to true.
- "High opportunity" means prioritize the combined FI opportunity plus ETF opportunity unless the user explicitly narrows to FI or ETF.
- If the user asks for "best leads" with opportunity language, still preserve all explicit firm, geography, segment, channel, competitor, AUM, and rating filters.
- Prefer exact dataset values and do not invent new firms, channels, segments, counties, or competitor brands.

Examples:
- "EJ advisors in XC Harris County with high opportunity" => firms:["Edward Jones"], channels:["XC"], counties:["Harris County"], sortBy:"totalOpportunity"
- "MS segment A with high ETF opportunity" => firms:["Morgan Stanley"], segments:["A"], sortBy:"etfOpportunity"
- "show me Wells profiles in Orange County" => firms:["Wells Fargo"], counties:["Orange County"], showAdvisorProfile:true
- "identify leads with high opportunity in XC Edward Jones and show the profile" => firms:["Edward Jones"], channels:["XC"], sortBy:"totalOpportunity", showAdvisorProfile:true

Return ONLY a JSON object with these exact keys:
{"firms":[],"segments":[],"counties":[],"channels":[],"aumMin":null,"aumMax":null,"netFlow":null,"fiOppMin":null,"etfOppMin":null,"alphaMin":null,"ratingsMin":null,"competitors":[],"totalOppMin":null,"sortBy":"semantic","showAdvisorProfile":false}`,
        },
        { role: "user", content: query },
      ],
    });

    const raw = resp.choices[0]?.message?.content ?? "{}";
    const obj = parseAIJson(raw);

    return normalizeLeadIntent(query, {
      filters: {
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
      },
      sortBy: (
        obj.sortBy === "totalOpportunity" ||
        obj.sortBy === "fiOpportunity" ||
        obj.sortBy === "etfOpportunity" ||
        obj.sortBy === "alpha" ||
        obj.sortBy === "aum" ||
        obj.sortBy === "ratings" ||
        obj.sortBy === "netPositiveFlow" ||
        obj.sortBy === "netNegativeFlow"
      ) ? obj.sortBy : "semantic",
      showAdvisorProfile: obj.showAdvisorProfile === true,
    });
  } catch {
    return normalizeLeadIntent(query, {
      filters: emptyFilters(),
      sortBy: "semantic",
      showAdvisorProfile: false,
    });
  }
}

function getLeadSortValue(advisor: AdvisorRow, sortBy: LeadSortBy): number {
  switch (sortBy) {
    case "totalOpportunity":
      return advisor.fiOpportunities + advisor.etfOpportunities;
    case "fiOpportunity":
      return advisor.fiOpportunities;
    case "etfOpportunity":
      return advisor.etfOpportunities;
    case "alpha":
      return advisor.alpha;
    case "aum":
      return advisor.aumM;
    case "ratings":
      return advisor.ratings ?? -1;
    case "netPositiveFlow":
      return advisor.salesAmt - advisor.redemption;
    case "netNegativeFlow":
      return advisor.redemption - advisor.salesAmt;
    case "semantic":
    default:
      return 0;
  }
}

function sortAdvisorsForIntent(advisors: AdvisorRow[], sortBy: LeadSortBy): AdvisorRow[] {
  if (sortBy === "semantic") return advisors;

  return [...advisors].sort((left, right) => {
    const primary = getLeadSortValue(right, sortBy) - getLeadSortValue(left, sortBy);
    if (primary !== 0) return primary;

    const totalOpportunityDelta =
      (right.fiOpportunities + right.etfOpportunities) - (left.fiOpportunities + left.etfOpportunities);
    if (totalOpportunityDelta !== 0) return totalOpportunityDelta;

    const alphaDelta = right.alpha - left.alpha;
    if (alphaDelta !== 0) return alphaDelta;

    const aumDelta = right.aumM - left.aumM;
    if (aumDelta !== 0) return aumDelta;

    return (right.ratings ?? -1) - (left.ratings ?? -1);
  });
}

function normalizeTerritoryLabel(value: string): string {
  return value.replace(/^(XC|FC)\s*-\s*/i, "").trim();
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
        territory: normalizeTerritoryLabel(a.territory), segment: a.segment, ratings: a.ratings,
        advisorProfile: a.advisorProfile, salesEngagement: a.salesEngagement, salesNotes: a.salesNotes,
        advisorRow: {
          ...a.rawRow,
          Territory: normalizeTerritoryLabel(a.rawRow.Territory ?? a.territory),
        },
      },
    }),
    sales: a.salesEngagement || `Sales: $${a.salesAmt.toLocaleString()} | Redemption: $${a.redemption.toLocaleString()}`,
    email: null, phone: null, linkedIn: null,
    location: normalizeTerritoryLabel(a.territory),
    industry: "Financial Services",
    aum: `$${a.aumM.toFixed(1)}M`,
  };
}

function buildDeterministicLeadFallback(
  advisors: AdvisorRow[],
  filters: ParsedFilters,
  sortBy: LeadSortBy,
): Array<{ idx: number; score: number; reason: string; reasoning: string }> {
  return advisors.slice(0, 8).map((advisor, idx) => {
    const matchedFilters: string[] = [];

    if (filters.firms.length && filters.firms.some((firm) => advisor.firm.toLowerCase().includes(firm.toLowerCase()))) {
      matchedFilters.push(advisor.firm);
    }
    if (filters.segments.length && filters.segments.includes(advisor.segment)) {
      matchedFilters.push(`segment ${advisor.segment}`);
    }
    if (filters.channels.length && filters.channels.some((channel) => advisor.territory.startsWith(channel))) {
      matchedFilters.push(advisor.territory.split(" - ")[0] ?? advisor.territory);
    }
    if (filters.counties.length && filters.counties.some((county) => advisor.territory.toLowerCase().includes(county.toLowerCase().replace(" county", "")))) {
      matchedFilters.push(advisor.territory.split(" - ")[1] ?? advisor.territory);
    }

    const totalOpportunity = advisor.fiOpportunities + advisor.etfOpportunities;
    const primaryReason = (() => {
      switch (sortBy) {
        case "fiOpportunity":
          return `high fixed income opportunity at $${advisor.fiOpportunities.toLocaleString()}`;
        case "etfOpportunity":
          return `high ETF opportunity at $${advisor.etfOpportunities.toLocaleString()}`;
        case "alpha":
          return `strong alpha potential at $${advisor.alpha.toLocaleString()}`;
        case "aum":
          return `large book size at $${advisor.aumM.toFixed(1)}M AUM`;
        case "ratings":
          return `strong internal rating of ${advisor.ratings ?? "N/A"}/10`;
        case "netPositiveFlow":
          return `positive net flow of $${(advisor.salesAmt - advisor.redemption).toLocaleString()}`;
        case "netNegativeFlow":
          return `meaningful outflow signal of $${(advisor.redemption - advisor.salesAmt).toLocaleString()}`;
        case "totalOpportunity":
          return `combined opportunity of $${totalOpportunity.toLocaleString()}`;
        case "semantic":
        default:
          return `fit across firm, territory, and opportunity data`;
      }
    })();

    const reason = matchedFilters.length > 0
      ? `${advisor.name} matches ${matchedFilters.join(", ")} and has ${primaryReason}.`
      : `${advisor.name} stands out for ${primaryReason}.`;

    const reasoning = [
      `${advisor.name} at ${advisor.firm} is in ${advisor.territory} with segment ${advisor.segment}.`,
      `The book shows $${advisor.aumM.toFixed(1)}M AUM, $${advisor.fiOpportunities.toLocaleString()} in FI opportunity, $${advisor.etfOpportunities.toLocaleString()} in ETF opportunity, and $${advisor.alpha.toLocaleString()} in alpha potential.`,
      advisor.salesNotes || advisor.advisorProfile || advisor.salesEngagement || `${advisor.buyingUnit} is the current buying unit context.`,
    ].join(" ");

    const rawScore = (() => {
      switch (sortBy) {
        case "fiOpportunity":
        case "etfOpportunity":
        case "alpha":
        case "aum":
        case "ratings":
        case "netPositiveFlow":
        case "netNegativeFlow":
        case "totalOpportunity":
          return 90 - idx * 3;
        case "semantic":
        default:
          return 84 - idx * 2;
      }
    })();

    return {
      idx,
      score: Math.max(65, rawScore),
      reason,
      reasoning,
    };
  });
}

router.post("/agents/lead-me", async (req: Request, res: Response) => {
  const parsed = GenerateLeadsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request" }); return; }
  const { query } = parsed.data;

  try {
    // ── Step 1: Parse query into structured filters (fast call) ──
    const leadSearchIntent = await parseLeadSearchIntent(query);
    const { filters: parsedFilters, sortBy, showAdvisorProfile } = leadSearchIntent;
    const shouldSurfaceAdvisorProfile =
      showAdvisorProfile ||
      sortBy === "totalOpportunity" ||
      sortBy === "fiOpportunity" ||
      sortBy === "etfOpportunity";

    // ── Step 2: Programmatic pre-filtering ──
    const filtered = applyFilters(ADVISORS, parsedFilters);
    const firmFallbackSet = parsedFilters.firms.length > 0
      ? ADVISORS.filter((advisor) =>
          parsedFilters.firms.some((firm) =>
            advisor.firm.toLowerCase().includes(firm.toLowerCase()),
          ),
        )
      : [];
    const workingSet = filtered.length >= 8
      ? filtered
      : firmFallbackSet.length > 0
        ? firmFallbackSet
        : ADVISORS; // fallback to firm matches or all if too few
    const rankedWorkingSet = sortAdvisorsForIntent(workingSet, sortBy);
    const candidateSet = sortBy === "semantic"
      ? rankedWorkingSet
      : rankedWorkingSet.slice(0, Math.min(12, rankedWorkingSet.length));

    // ── Step 3: AI scoring of the filtered set ──
    const dataset = candidateSet.map((a, i) =>
      `${i}|${a.name}|${a.firm}|seg:${a.segment}|AUM:$${a.aumM.toFixed(1)}M|${a.territory}|buying-unit:${a.buyingUnit}|comps:${a.competitors.slice(0, 2).join(";")}|FI:$${(a.fiOpportunities / 1e6).toFixed(1)}M|ETF:$${(a.etfOpportunities / 1e6).toFixed(1)}M|total-opp:$${((a.fiOpportunities + a.etfOpportunities) / 1e6).toFixed(1)}M|alpha:$${(a.alpha / 1000).toFixed(0)}K|profile:${a.advisorProfile.slice(0, 180).replace(/\s+/g, " ")}`
    ).join("\n");

    let aiLeads: Array<{ idx: number; score: number; reason: string; reasoning: string }> = [];

    try {
      const scoreResp = await openai.chat.completions.create({
        model: "gpt-5.2",
        max_completion_tokens: 4096,
        messages: [
          {
            role: "system",
            content: `You are a sales intelligence AI for Capital Group financial services salespeople. Match advisors to the query, explain the fit, and keep reasoning grounded in the provided advisor data. Segments: A=top tier, B=high value, C=mid-market, D=developing, E=emerging. XC=exclusive channel, FC=flexible channel. Return valid JSON only.`,
          },
          {
            role: "user",
            content: `Query: "${query}"
Ranking mode: ${sortBy}
Show advisor profile details in reasoning: ${shouldSurfaceAdvisorProfile ? "yes" : "no"}

Pre-filtered advisor dataset (idx|name|firm|segment|AUM|territory|competitors|FI-opp|ETF-opp|alpha):
${dataset}

Return JSON: {"leads":[{"idx":0,"score":85,"reason":"1-2 sentence fit reason","reasoning":"3-4 sentence analysis using the advisor data"}]}

Instructions:
- Respect all extracted filters.
- If ranking mode is "semantic", select the best 8 matches and sort by score descending.
- If ranking mode is not "semantic", the dataset is already pre-ranked by that requested feature. Prefer the earliest rows and return up to 8 advisors in dataset order.
- For high-opportunity style queries, emphasize FI opportunity, ETF opportunity, total opportunity, alpha, AUM, and fit to the requested firm, territory, or segment.
- If profile details were requested, mention relevant advisor profile context in the reasoning.
- Reasons should mention why the advisor fits the requested filters and why the opportunity is attractive.
- Do not invent data that is not in the row.`,
          },
        ],
      });

      const content = scoreResp.choices[0]?.message?.content ?? "{}";
      const aiData = parseAIJson(content);
      aiLeads = Array.isArray(aiData.leads)
        ? (aiData.leads as Array<{ idx: number; score: number; reason: string; reasoning: string }>)
        : [];
    } catch (error) {
      req.log.warn({ err: error }, "Lead Me AI scoring fallback triggered");
    }

    if (aiLeads.length === 0) {
      aiLeads = buildDeterministicLeadFallback(candidateSet, parsedFilters, sortBy);
    }

    const leads = aiLeads.map(l => {
      const a = candidateSet[l.idx];
      return a ? buildAdvisorLead(a, l) : null;
    }).filter(Boolean);

    res.json({
      leads,
      parsedFilters,
      rankingMode: sortBy,
      showAdvisorProfile: shouldSurfaceAdvisorProfile,
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
    const text = await speechToText(buffer, format, {
      model: "whisper-1",
      language: "en",
      prompt: LEAD_ME_TRANSCRIPTION_PROMPT,
    });

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
          content: `You are a senior Capital Group financial sales representative writing warm, personal follow-up emails to financial advisors. Your emails read like they were written by a real person who has an existing relationship with the advisor — not a marketing template. Always respond with valid JSON only.`,
        },
        {
          role: "user",
          content: `Write a personal outreach email to a financial advisor to set up a meeting. The email must follow this exact structure and style:

STRUCTURE (3 paragraphs, ~150-180 words total):
1. Opening paragraph: Start with "Dear ${firstName}," on its own line. Then begin the body (no line break after the greeting). Open warmly — reference a recent meeting or conversation. Mention you've been thinking about their investment strategy or portfolio. One or two sentences.
2. Market insight paragraph: Share a specific, relevant market insight or data point tied to current conditions (interest rates, inflation, Fed policy, ETF flows, fixed income spreads — make it feel timely and data-driven). Connect this insight to a specific Capital Group product opportunity (e.g. core bond funds, active ETFs, short-duration fixed income). 2-3 sentences with at least one real-sounding statistic.
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

router.post("/agents/coach-me/stream", async (req: Request, res: Response) => {
  const parsed = GenerateCoachingPlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const { leadName, leadCompany, meetingPurpose, focusArea } = parsed.data;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-5.2",
      stream: true,
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

    let content = "";

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? "";
      if (!delta) continue;

      content += delta;
      res.write(`data: ${JSON.stringify({ type: "delta", delta, content })}\n\n`);
    }

    const data = parseAIJson(content);
    res.write(`data: ${JSON.stringify({ type: "done", data, content })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    req.log.error({ err }, "Streaming coaching plan generation failed");
    res.write(`data: ${JSON.stringify({ type: "error", error: "Failed to generate coaching plan" })}\n\n`);
    res.end();
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

async function generateCoachScenario(input: {
  leadName: string;
  leadCompany: string;
  leadTitle?: string;
  meetingPurpose: string;
  focusArea?: string;
  advisorContext?: CoachAdvisorContext | null;
}) {
  const matchedAdvisor = findAdvisorDatasetRow(input.leadName, input.leadCompany);
  const advisorContextJson = input.advisorContext
    ? JSON.stringify(input.advisorContext, null, 2)
    : "No structured advisor context was provided from the app.";
  const matchedAdvisorJson = matchedAdvisor
    ? JSON.stringify({
        aumM: matchedAdvisor.aumM,
        salesAmt: matchedAdvisor.salesAmt,
        redemption: matchedAdvisor.redemption,
        fiOpportunities: matchedAdvisor.fiOpportunities,
        etfOpportunities: matchedAdvisor.etfOpportunities,
        alpha: matchedAdvisor.alpha,
        competitors: matchedAdvisor.competitors,
        buyingUnit: matchedAdvisor.buyingUnit,
        territory: matchedAdvisor.territory,
        segment: matchedAdvisor.segment,
        ratings: matchedAdvisor.ratings,
        advisorProfile: matchedAdvisor.advisorProfile,
        salesEngagement: matchedAdvisor.salesEngagement,
        salesNotes: matchedAdvisor.salesNotes,
        advisorRow: matchedAdvisor.rawRow,
      }, null, 2)
    : "No advisor dataset row matched this advisor name and firm.";

  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 2200,
    messages: [
      {
        role: "system",
        content: `You design live Capital Group sales practice scenarios from a selected real advisor meeting.
Do not write a script. Build a concise scenario brief that a live voice roleplay can improvise from in realtime.
The selected advisor remains the advisor being simulated. Do not invent a different advisor identity, different firm, or multiple persona options.
The advisor should feel realistic, reveal information only when earned, ask practical questions, and raise objections naturally.
Make the scenario easy to evaluate against the VG Way while keeping the visible fields tight enough for a prep screen.
Use the structured advisor context and dataset row when available so the persona reflects real sales notes, AUM, opportunity size, competitor usage, territory, segment, and engagement context.
Prefer real advisor signals over generic invented traits.
Always respond with valid JSON only.`,
      },
      {
        role: "user",
        content: `Generate one live coaching scenario for Coach Me.

Selected advisor:
- Name: ${input.leadName}
- Firm: ${input.leadCompany}
- Title: ${input.leadTitle || "Financial Advisor"}
- Meeting purpose: ${input.meetingPurpose}
- Optional rep focus area: ${input.focusArea || "General meeting preparation"}

Constraints:
- The salesperson is the trainee and speaks first.
- The advisor should not open with a long monologue.
- The visible persona must match the selected advisor, not a fictional replacement.
- The hidden brief must be rich enough for a realistic realtime call.
- Include 2-4 realistic objections and at least 2 live-case examples.
- Make the scenario strongly evaluable against the VG Way.
- Keep all fields concise and practical.
- Do not create alternate personas, extra advisor variants, or a catalog structure.
- Make the trainer preview useful for the rep before the call, not a generic summary.
- If AUM, ETF opportunity, FI opportunity, sales notes, advisor profile, sales engagement, competitors, territory, or segment are available, use them to make the advisor more realistic.
- If sales notes indicate relationship history or product preferences, reflect that in current approach, objections, fit signals, and live-case examples.

Structured advisor context from the app:
${advisorContextJson}

Matched advisor dataset row:
${matchedAdvisorJson}

Return JSON with exactly these fields:
- title: string
- salespersonBrief: string
- startInstruction: string
- visiblePersona: object with personaType, name, firm, firmType, clients, style, headline
- trainerPreview: object with personaName, primaryPainPoints, likelyObjections, bestFitAngle
- hiddenBrief: object with personaId, personaName, advisorType, firm, tone, businessContext, currentApproach, objectives, painPoints, objections, fitSignals, redFlags, liveCaseExamples, successDefinition, coachFocus`,
      },
    ],
  });

  const scenario = parseAIJson(response.choices[0]?.message?.content ?? "{}");
  const sourceContext = buildCoachAdvisorSourceContext(input.advisorContext, matchedAdvisor);
  return sourceContext ? { ...scenario, sourceContext } : scenario;
}

router.post("/agents/coach-me/scenario", async (req: Request, res: Response) => {
  const { leadName, leadCompany, leadTitle, meetingPurpose, focusArea, advisorContext } = req.body as {
    leadName: string;
    leadCompany: string;
    leadTitle?: string;
    meetingPurpose: string;
    focusArea?: string;
    advisorContext?: CoachAdvisorContext | null;
  };

  try {
    return res.json(await generateCoachScenario({
      leadName,
      leadCompany,
      leadTitle,
      meetingPurpose,
      focusArea,
      advisorContext,
    }));
  } catch (err) {
    req.log.error({ err }, "Coach scenario generation failed");
    return res.status(500).json({ error: "Failed to generate coach scenario" });
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

router.post("/agents/coach-me/live-feedback", async (req: Request, res: Response) => {
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
      max_completion_tokens: 2048,
      messages: [
        {
          role: "system",
          content: `You are a live sales coach observing a Capital Group practice conversation in progress.
Return concise, practical coaching that the salesperson can use on the very next turn.
Always respond with valid JSON only.`,
        },
        {
          role: "user",
          content: `Analyze this in-progress sales roleplay.

Advisor Persona: ${persona.name}, ${persona.role} at ${persona.company} (${persona.firmType})
Meeting Purpose: ${meetingContext.purpose}
Advisor Concerns: ${persona.concerns.join(", ")}

TRANSCRIPT SO FAR:
${transcriptText}

Return a JSON object with these exact fields:
- snapshot: string (1-2 sentences summarizing how the call is going right now)
- currentScore: number (0-100 estimate based only on the conversation so far)
- strengths: string[] (exactly 2 short bullets about what is working)
- improveNow: array of exactly 2 objects, each with:
  - title: string
  - issue: string
  - example: string (a concrete line the salesperson could say next)
- nextBestQuestion: string (one strong next question to ask immediately)
- momentum: string (one short phrase, e.g. "Building trust", "Stalling in discovery", "Too product-heavy")

Be specific. Quote or infer from what was actually said. Keep every field concise enough for a live coaching panel.`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    return res.json(parseAIJson(content));
  } catch (err) {
    req.log.error({ err }, "Live coach feedback generation failed");
    return res.status(500).json({ error: "Failed to generate live coach feedback" });
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
          content: `You are an elite sales coach evaluating financial services sales conversations against the Capital Group "CG Way" Professional Engagement Framework. Be rigorous and specific. Always respond with valid JSON only.`,
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

router.post("/agents/coach-me/should-end", async (req: Request, res: Response) => {
  const { scenario, transcript, latestUtterance } = req.body as {
    scenario: {
      hiddenBrief: {
        personaName: string;
        advisorType: string;
        firm: string;
        tone: string;
      };
    };
    transcript: { role: "user" | "advisor"; content: string }[];
    latestUtterance: string;
  };

  try {
    const transcriptText = transcript
      .map(t => `${t.role.toUpperCase()}: ${t.content}`)
      .join("\n");

    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 256,
      messages: [
        {
          role: "system",
          content: `You classify whether the salesperson just ended a mock phone call.
Return true only when the latest utterance clearly signals that the call is ending now.
Examples that should usually count as ending:
- okay the conversation is over
- the call is ended
- let's wrap here
- that's all I needed today, thanks for your time
- great, I'll let you go
- we can end here
Examples that should usually NOT count as ending:
- mentioning the word call in another context
- asking how to end a client call
- saying thanks in the middle of the conversation without wrapping up
- asking for a follow-up next week as part of the call
Always respond with valid JSON only.`,
        },
        {
          role: "user",
          content: `Advisor context:
- Persona: ${scenario.hiddenBrief.personaName}
- Type: ${scenario.hiddenBrief.advisorType}
- Firm: ${scenario.hiddenBrief.firm}
- Tone: ${scenario.hiddenBrief.tone}

Transcript so far:
${transcriptText || "(no transcript yet)"}

Latest salesperson utterance:
${latestUtterance}

Return JSON with:
- shouldEnd: boolean
- confidence: integer 0-100
- reason: string`,
        },
      ],
    });

    return res.json(parseAIJson(response.choices[0]?.message?.content ?? "{}"));
  } catch (err) {
    req.log.error({ err }, "Coach should-end detection failed");
    return res.status(500).json({ error: "Failed to classify call ending" });
  }
});

router.post("/agents/coach-me/live-feedback-v2", async (req: Request, res: Response) => {
  const { scenario, meetingContext, transcript } = req.body as {
    scenario: {
      hiddenBrief: Record<string, unknown>;
    };
    meetingContext: { leadName: string; leadCompany: string; purpose: string };
    transcript: { role: "user" | "advisor"; content: string }[];
  };

  try {
    const brief = scenario.hiddenBrief;
    const personaName = readString(brief.personaName, "the advisor");
    const transcriptText = transcript
      .map(t => `${t.role === "user" ? "SALESPERSON" : `ADVISOR (${personaName})`}: ${t.content}`)
      .join("\n\n");

    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 2048,
      messages: [
        {
          role: "system",
          content: `You are a live digital sales coach observing a Capital Group-style roleplay in progress.
Evaluate the salesperson only.
Use the advisor brief and transcript as evidence.
Return concise, practical coaching for the very next turn.
Keep it tight enough for a narrow live side panel.
Always respond with valid JSON only.`,
        },
        {
          role: "user",
          content: `Analyze this in-progress sales roleplay.

Advisor Persona: ${personaName}, ${readString(brief.advisorType, "Financial Advisor")} at ${readString(brief.firm, meetingContext.leadCompany)}
Meeting Purpose: ${meetingContext.purpose}
Advisor Pain Points: ${joinStringArray(brief.painPoints, "Need clearer client context and relevant implementation ideas")}
Likely Objections: ${joinStringArray(brief.objections, "Pushes back on generic or premature product pitches")}
Coach Focus: ${joinStringArray(brief.coachFocus, "agenda, discovery, insight relevance, summary, close")}

TRANSCRIPT SO FAR:
${transcriptText}

Return a JSON object with these exact fields:
- snapshot: string
- currentScore: number
- strengths: string[] (exactly 2)
- improveNow: array of exactly 2 objects, each with title, issue, example
- nextBestQuestion: string
- momentum: string

Be specific. Quote or infer from what was actually said.
Keep snapshot to at most 2 short sentences.
Keep each strength to 1 sentence.
Keep each improveNow issue to 1 short sentence and each example to 1 line the rep could say next.
Keep momentum to 2-4 words.
Keep every field short enough for a live coaching panel.`,
        },
      ],
    });

    return res.json(parseAIJson(response.choices[0]?.message?.content ?? "{}"));
  } catch (err) {
    req.log.error({ err }, "Live coach feedback v2 generation failed");
    return res.status(500).json({ error: "Failed to generate live coach feedback" });
  }
});

router.post("/agents/coach-me/preview-stream", async (req: Request, res: Response) => {
  const { scenario, transcript } = req.body as {
    scenario: {
      hiddenBrief: Record<string, unknown>;
    };
    transcript: { role: "user" | "advisor"; content: string }[];
  };

  const transcriptText = transcript
    .map(t => `${t.role.toUpperCase()}: ${t.content}`)
    .join("\n");

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-5.2",
      stream: true,
      max_completion_tokens: 1200,
      messages: [
        {
          role: "system",
          content: `You are a digital sales coach giving live post-call feedback on a Capital Group-style roleplay.
Do not produce the full scored report.
Do not use JSON.
Write in short sections in this exact order:
1. Overall take
2. Top priority fix
3. Quick section notes
4. Immediate next rep

For quick section notes, touch each VG Way stage briefly:
- Agenda
- Discovery
- Insights
- Practice Management
- Summarize & Prioritize
- Close

Keep the total response tight and high-signal so it fits comfortably on a short loading panel.
Target roughly 140-220 words total.`,
        },
        {
          role: "user",
          content: `Scenario context:
${JSON.stringify(scenario.hiddenBrief, null, 2)}

Transcript:
${transcriptText || "(no transcript yet)"}

Stream the coaching preview now.`,
        },
      ],
    });

    let content = "";

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? "";
      if (!delta) continue;
      content += delta;
      res.write(`data: ${JSON.stringify({ type: "delta", delta, content })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ type: "done", content })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    req.log.error({ err }, "Coach preview stream failed");
    res.write(`data: ${JSON.stringify({ type: "error", error: "Failed to stream coach preview" })}\n\n`);
    res.end();
  }
});

router.post("/agents/coach-me/scorecard-v2", async (req: Request, res: Response) => {
  const { scenario, meetingContext, transcript } = req.body as {
    scenario: {
      hiddenBrief: Record<string, unknown>;
    };
    meetingContext: { leadName: string; leadCompany: string; purpose: string };
    transcript: { role: "user" | "advisor"; content: string }[];
  };

  try {
    const brief = scenario.hiddenBrief;
    const personaName = readString(brief.personaName, "the advisor");
    const transcriptText = transcript
      .map(t => `${t.role === "user" ? "SALESPERSON" : `ADVISOR (${personaName})`}: ${t.content}`)
      .join("\n\n");

    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 3200,
      messages: [
        {
          role: "system",
          content: `You are a digital sales coach grading a Capital Group-style roleplay against the CG Way.
Evaluate the salesperson only. Use the transcript as evidence.
Be direct, specific, concise, and useful. Avoid generic praise.
Tie your evaluation to the stages: Agenda, Discovery, Insights, Practice Management, Summarize & Prioritize, Close.
Use these VG Way expectations:
- Strong openings use thank you, time check, and a clear agenda with the advisor.
- Discovery should identify needs, framework, book of business, and ideally a live case.
- Insights should connect directly to the advisor's real business problem.
- Practice management should improve workflow, implementation, or scalability rather than dumping products.
- Summaries should rephrase the advisor's need and prioritize next steps.
- Closing should create shared agreement with a real next step, owner, and timing.
- Bad habits include weak agenda, shallow questions, too many words, no summary, and no close.

Scoring rules:
- 5 means excellent and complete.
- 3 means mixed or partial.
- 1 means weak or missing.

Keep the full report concise enough to fit roughly two pages in an application UI.
Prioritize evidence and concrete examples over long explanation.
Always respond with valid JSON only.`,
        },
        {
          role: "user",
          content: `Evaluate this sales roleplay conversation.

SCENARIO CONTEXT:
- Persona: ${personaName}
- Advisor type: ${readString(brief.advisorType, "Financial Advisor")}
- Firm: ${readString(brief.firm, meetingContext.leadCompany)}
- Tone: ${readString(brief.tone, "professional and practical")}
- Business context: ${readString(brief.businessContext, "The advisor wants relevant, realistic discussion tied to actual clients and implementation needs.")}
- Current approach: ${readString(brief.currentApproach, "The advisor already has an approach and wants ideas only if they are relevant and practical.")}
- Objectives: ${joinStringArray(brief.objectives, "Protect client outcomes, improve implementation, and use time efficiently")}
- Pain points: ${joinStringArray(brief.painPoints, "Need clearer client context and practical, usable ideas")}
- Objections: ${joinStringArray(brief.objections, "Pushes back on generic or premature product pitches")}
- Fit signals: ${joinStringArray(brief.fitSignals, "Responds well to specific discovery, prioritization, and practical next steps")}
- Red flags: ${joinStringArray(brief.redFlags, "Tunes out when discovery is shallow or the rep over-talks")}
- Live case examples: ${joinStringArray(brief.liveCaseExamples, "Use a realistic client case only when the rep earns it with good questions")}
- Success definition: ${joinStringArray(brief.successDefinition, "A strong call earns a specific next step with owner and timing")}
- Coach focus: ${joinStringArray(brief.coachFocus, "agenda, discovery, insights, practice management, summary, close")}

MEETING CONTEXT:
Meeting Purpose: ${meetingContext.purpose}

TRANSCRIPT:
${transcriptText}

Return a JSON scorecard with these exact fields:
- overallAssessment: string
- finalScore: integer 0-100
- coachVerdict: string
- coachModeSummary: string
- topPriorityFix: string
- cgWayScores: object with integer 1-5 scores for agenda, discovery, insights, practiceManagement, summarizePrioritize, close
- stageFeedback: array of exactly 6 objects, one for each stage "Agenda", "Discovery", "Insights", "Practice Management", "Summarize & Prioritize", "Close", each with stage, score, assessment, evidence, improvementExample
- strengths: array of exactly 2 objects, each with title, whyItWorked, evidence
- misses: array of exactly 2 objects, each with title, whyItMattered, evidence, fix
- rewriteExamples: array of exactly 2 objects, each with moment, issue, betterExample
- missedDiscoveryQuestions: array of exactly 3 strings
- nextRepPlan: array of exactly 3 strings

Keep every field concise and evidence-based.
Additional brevity rules:
- overallAssessment: max 2 sentences
- coachVerdict: max 5 words
- coachModeSummary: around 90-140 words
- topPriorityFix: max 2 sentences
- each stage assessment, evidence, and improvementExample: max 1 sentence each
- each strengths/misses/rewriteExamples field: max 1 sentence per property
- each missedDiscoveryQuestions and nextRepPlan item: max 18 words`,
        },
      ],
    });

    return res.json(normalizeScorecard(parseAIJson(response.choices[0]?.message?.content ?? "{}")));
  } catch (err) {
    req.log.error({ err }, "Scorecard v2 generation failed");
    return res.status(500).json({ error: "Failed to generate scorecard" });
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
You analyze meeting notes and spoken meeting recaps to extract clear, actionable follow-up tasks with appropriate urgency.
Your job is to identify concrete action items, classify them, and tag them based on the actual call to action.
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
- tags: Array of 4-10 short tags that describe the follow-up themes and calls to action
- items: Array of 4-8 objects with:
  - title: string
  - actionType: string
  - tags: string[] (1-3 tags per item)
  - owner: string
  - dueTiming: string
  - rationale: string

Tag examples:
- Email
- Market Outlook
- Fund Comparison
- Webinar Invite
- Practice Management
- Product Follow-Up
- Deck
- Research
- Scheduling
- Client Case

Tasks should be prioritized (most urgent first), specific to what was discussed, and tied to the actual ask or promised next step.`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    const data = normalizeFollowUpAnalysis(parseAIJson(content));
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Follow-up task generation failed");
    res.status(500).json({ error: "Failed to generate follow-up tasks" });
  }
});

router.post("/agents/follow-me/live", async (req: Request, res: Response) => {
  const { leadName, leadCompany, meetingNotes } = req.body as {
    leadName?: string;
    leadCompany?: string;
    meetingNotes?: string;
  };

  if (!leadName || !leadCompany || !meetingNotes?.trim()) {
    res.status(400).json({ error: "leadName, leadCompany, and meetingNotes are required" });
    return;
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 2200,
      messages: [
        {
          role: "system",
          content: `You are a live follow-up extraction AI for financial services sales professionals.
The user is dictating a meeting debrief.
Extract concrete follow-up actions and label them with short tags based on the actual call to action.
Keep the output compact and update-friendly.
Always respond with valid JSON only.`,
        },
        {
          role: "user",
          content: `Analyze this live dictated meeting recap.
Client: ${leadName} at ${leadCompany}
Meeting recap transcript:
${meetingNotes}

Return JSON with:
- summary: string
- tasks: string[]
- tags: string[]
- items: array of up to 6 objects, each with title, actionType, tags, owner, dueTiming, rationale

Prioritize explicit next steps such as sending materials, sharing comparisons, following up by email, or inviting the advisor to another event.
If the transcript is still partial, infer only what is clearly supported.`,
        },
      ],
    });

    return res.json(normalizeFollowUpAnalysis(parseAIJson(response.choices[0]?.message?.content ?? "{}")));
  } catch (err) {
    req.log.error({ err }, "Live follow-up extraction failed");
    return res.status(500).json({ error: "Failed to analyze follow-up transcript" });
  }
});

router.post("/agents/follow-me/normalize-transcript", async (req: Request, res: Response) => {
  const { transcript } = req.body as { transcript?: string };

  if (!transcript?.trim()) {
    return res.status(400).json({ error: "transcript is required" });
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 800,
      messages: [
        {
          role: "system",
          content: FOLLOW_ME_TRANSCRIPT_NORMALIZATION_PROMPT,
        },
        {
          role: "user",
          content: transcript,
        },
      ],
    });

    const correctedTranscript = postProcessLeadTranscript(
      (response.choices[0]?.message?.content ?? "").trim() || transcript.trim(),
    );
    return res.json({
      correctedTranscript,
    });
  } catch (err) {
    req.log.error({ err }, "Follow Me transcript normalization failed");
    return res.status(500).json({ error: "Failed to normalize follow-up transcript" });
  }
});

router.post("/agents/lead-me/normalize-transcript", async (req: Request, res: Response) => {
  const { transcript } = req.body as { transcript?: string };

  if (!transcript?.trim()) {
    return res.status(400).json({ error: "transcript is required" });
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 600,
      messages: [
        {
          role: "system",
          content: LEAD_ME_TRANSCRIPT_NORMALIZATION_PROMPT,
        },
        {
          role: "user",
          content: transcript,
        },
      ],
    });

    const correctedTranscript = (response.choices[0]?.message?.content ?? "").trim();
    return res.json({
      correctedTranscript: correctedTranscript || transcript.trim(),
    });
  } catch (err) {
    req.log.error({ err }, "Lead Me transcript normalization failed");
    return res.status(500).json({ error: "Failed to normalize lead transcript" });
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
          content: `You are a senior Capital Group financial sales representative writing warm, personal follow-up emails to financial advisors. Your emails read like they were written by a real person who has an existing relationship with the advisor — not a marketing template. Always respond with valid JSON only.`,
        },
        {
          role: "user",
          content: `Write a personal outreach email to a financial advisor. The salesperson recorded these voice instructions: "${transcript}". Use those as your talking points.

The email must follow this exact structure:
1. Opening: "Dear ${voiceFirstName}," then warm opening referencing a recent conversation. 1-2 sentences.
2. Market insight: A specific, data-driven insight tied to current market conditions (rates, Fed policy, inflation, ETF flows). Connect to a Capital Group product relevant to their situation. Include at least one real-sounding statistic. 2-3 sentences.
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
