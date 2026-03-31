import { Router } from "express";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { openai } from "@workspace/integrations-openai-ai-server";
import { ensureCompatibleFormat, speechToText } from "@workspace/integrations-openai-ai-server/audio";

const router = Router();

function buildOpenAIRealtimeUrl(baseUrl: string, path: string): string {
  return new URL(path.replace(/^\//, ""), `${baseUrl}/`).toString();
}

function mapRealtimeAudioFormatToLegacy(type: unknown): string | undefined {
  if (type === "audio/pcm") return "pcm16";
  return undefined;
}

function normalizeRealtimeSessionPayload(sessionPayload: Record<string, unknown>): Record<string, unknown> {
  const audio = sessionPayload.audio as {
    input?: {
      format?: { type?: unknown };
      noise_reduction?: unknown;
      turn_detection?: unknown;
      transcription?: unknown;
    };
    output?: {
      format?: { type?: unknown };
      voice?: unknown;
    };
  } | undefined;

  const explicitModalities = Array.isArray(sessionPayload.output_modalities)
    ? sessionPayload.output_modalities
    : Array.isArray(sessionPayload.modalities)
    ? sessionPayload.modalities
    : undefined;
  const normalizedModalities = explicitModalities;

  const normalizedInputAudio = audio?.input
    ? Object.fromEntries(
        Object.entries({
          format: audio.input.format,
          noise_reduction: audio.input.noise_reduction,
          turn_detection: audio.input.turn_detection,
          transcription: audio.input.transcription,
        }).filter(([, value]) => value !== undefined),
      )
    : undefined;

  const normalizedOutputAudio = audio?.output
    ? Object.fromEntries(
        Object.entries({
          format: audio.output.format,
          voice: audio.output.voice,
        }).filter(([, value]) => value !== undefined),
      )
    : undefined;

  const normalizedAudio = normalizedInputAudio || normalizedOutputAudio
    ? Object.fromEntries(
        Object.entries({
          input: normalizedInputAudio,
          output: normalizedOutputAudio,
        }).filter(([, value]) => value !== undefined),
      )
    : undefined;

  const normalized: Record<string, unknown> = {
    type: sessionPayload.type ?? "realtime",
    model: sessionPayload.model,
    instructions: sessionPayload.instructions,
    output_modalities: normalizedModalities ?? (audio?.output ? ["audio"] : ["text"]),
    audio: normalizedAudio,
    tools: sessionPayload.tools,
    tool_choice: sessionPayload.tool_choice,
    temperature: sessionPayload.temperature,
    include: sessionPayload.include,
    max_output_tokens: sessionPayload.max_output_tokens ?? sessionPayload.max_response_output_tokens,
  };

  return Object.fromEntries(
    Object.entries(normalized).filter(([, value]) => value !== undefined),
  );
}

async function createOpenAIRealtimeCall(offerSdp: string, sessionPayload: Record<string, unknown>) {
  const baseUrl = (process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? "";
  const model = typeof sessionPayload.model === "string" && sessionPayload.model.trim()
    ? sessionPayload.model
    : "gpt-realtime";
  const normalizedPayload = normalizeRealtimeSessionPayload({
    ...sessionPayload,
    model,
  });

  const form = new FormData();
  form.set("sdp", new Blob([offerSdp], { type: "application/sdp" }), "offer.sdp");
  form.set("session", new Blob([JSON.stringify(normalizedPayload)], { type: "application/json" }), "session.json");

  const response = await fetch(buildOpenAIRealtimeUrl(baseUrl, "realtime/calls"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(errText || `OpenAI realtime call creation failed: ${response.status}`);
  }

  const answerSdp = await response.text();
  const location = response.headers.get("Location");
  const callId = location?.split("/").pop() ?? null;

  return {
    answerSdp,
    callId,
  };
}

async function createOpenAIRealtimeClientSecret(sessionPayload: Record<string, unknown>) {
  const baseUrl = (process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? "";
  const model = typeof sessionPayload.model === "string" && sessionPayload.model.trim()
    ? sessionPayload.model
    : "gpt-realtime";
  const normalizedPayload = normalizeRealtimeSessionPayload({
    ...sessionPayload,
    model,
  });

  const response = await fetch(buildOpenAIRealtimeUrl(baseUrl, "realtime/client_secrets"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      expires_after: {
        anchor: "created_at",
        seconds: 600,
      },
      session: normalizedPayload,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(errText || `OpenAI realtime client secret creation failed: ${response.status}`);
  }

  const payload = await response.json() as {
    value?: string;
    client_secret?: {
      value?: string;
    };
  };
  const ephemeralKey = payload.value ?? payload.client_secret?.value;

  if (!ephemeralKey) {
    throw new Error("OpenAI realtime client secret missing from response");
  }

  return {
    ephemeralKey,
    webrtcUrl: buildOpenAIRealtimeUrl(baseUrl, "realtime/calls"),
  };
}

async function exchangeOpenAIRealtimeOffer(
  offerSdp: string,
  session: {
    ephemeralKey: string;
    webrtcUrl: string;
  },
) {
  const response = await fetch(session.webrtcUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.ephemeralKey}`,
      "Content-Type": "application/sdp",
    },
    body: offerSdp,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(errText || `OpenAI realtime offer exchange failed: ${response.status}`);
  }

  const answerSdp = await response.text();
  if (!answerSdp) {
    throw new Error("OpenAI realtime answer SDP missing from offer exchange");
  }

  return {
    answerSdp,
  };
}

async function createOpenAIRealtimeSession(offerSdp: string, sessionPayload: Record<string, unknown>) {
  try {
    const clientSecretSession = await createOpenAIRealtimeClientSecret(sessionPayload);

    try {
      return await exchangeOpenAIRealtimeOffer(offerSdp, clientSecretSession);
    } catch (offerExchangeError) {
      console.warn("Realtime server-side offer exchange failed; returning client secret flow to browser.", offerExchangeError);
      return clientSecretSession;
    }
  } catch (clientSecretError) {
    console.warn("Realtime client secret bootstrap failed; falling back to direct call flow.", clientSecretError);

    try {
      return await createOpenAIRealtimeCall(offerSdp, sessionPayload);
    } catch (callError) {
      const clientSecretMessage = clientSecretError instanceof Error ? clientSecretError.message : String(clientSecretError);
      const callMessage = callError instanceof Error ? callError.message : String(callError);
      throw new Error(
        `Realtime bootstrap failed. Client secret error: ${clientSecretMessage}. Direct call fallback error: ${callMessage}`,
      );
    }
  }
}

const AVAILABLE_SLOTS = [
  { label: "Wednesday Mar 25", times: ["9:00 AM PT",  "12:00 PM PT"], dateStr: "2026-03-25", timeStrs: ["09:00", "12:00"] },
];

const SCHEDULE_ME_TRANSCRIPTION_PROMPT = [
  "Vanguard scheduling call",
  "advisor names",
  "firm names",
  "weekdays",
  "calendar times",
  "Pacific Time",
  "fixed income",
  "ETFs",
  "direct indexing",
  "portfolio diagnostics",
  "advisor alpha",
].join(", ");

const LEAD_ME_REALTIME_TRANSCRIPTION_PROMPT = [
  "Vanguard advisor lead search",
  "dictation for structured advisor search filters",
  "advisor names",
  "firm names",
  "territory county names",
  "XC means Exclusive Channel",
  "FC means Flexible Channel",
  "EJ means Edward Jones",
  "MS means Morgan Stanley",
  "ML means Merrill Lynch",
  "Wells means Wells Fargo",
  "UBS means UBS",
  "GS means Goldman Sachs",
  "MFS means MFS",
  "segment A B C D E",
  "buying units",
  "buying unit patterns like BU 27",
  "fixed income opportunity",
  "ETF opportunity",
  "alpha",
  "AUM",
  "ratings from 1 to 10",
  "competitor names",
  "counties such as Cook County, Orange County, Harris County, Alameda County, San Diego County",
].join(", ");

function loadScheduleMeAsset(fileName: string, fallback: string): string {
  const candidatePaths = [
    resolve(process.cwd(), "attached_assets", fileName),
    resolve(__dirname, "../../../../attached_assets", fileName),
    resolve(__dirname, "../../../attached_assets", fileName),
  ];

  const assetPath = candidatePaths.find((candidate) => existsSync(candidate));
  if (!assetPath) {
    return fallback;
  }

  return readFileSync(assetPath, "utf8").trim();
}

const SCHEDULE_ME_PROMPT_TEMPLATE_BASE = loadScheduleMeAsset(
  "Pasted-You-are-a-Vanguard-Digital-Desk-representative-calling-_1774138630117.txt",
  [
    "You are a Vanguard Scheduling AI assistant calling a financial advisor.",
    "Your job is to identify one pain point, connect it to a Vanguard topic, and book a 20-25 minute meeting.",
  ].join("\n"),
);

const SCHEDULE_ME_SCHEDULING_GUARDRAILS = [
  "Scheduling role guardrails:",
  "- You are a scheduling assistant first. Your primary objective is to book time on the calendar.",
  "- If the advisor asks side questions, answer briefly and naturally, then guide the conversation back to scheduling.",
  "- Do not keep mentioning fixed income, ETFs, funds, products, or market topics unless the advisor directly asks.",
  "- Do not sound like a product specialist or salesperson giving a pitch. Sound like a realistic scheduling coordinator for Vanguard.",
  "- Keep answers short, conversational, and credible. After answering, move back to confirming availability and booking a meeting.",
  "- If the advisor is curious why you are calling, give a concise business reason for the outreach, then ask for a time.",
  "- If the advisor is not ready to engage on content, stop discussing content and focus only on scheduling.",
  "- Avoid repeating the same Vanguard value proposition. Vary the language and stay grounded in arranging a short meeting.",
].join("\n");

const SCHEDULE_ME_PROMPT_TEMPLATE = [
  SCHEDULE_ME_PROMPT_TEMPLATE_BASE,
  SCHEDULE_ME_SCHEDULING_GUARDRAILS,
].join("\n\n");

const SCHEDULE_ME_CORPUS = loadScheduleMeAsset(
  "Pasted--Vanguard-Advisor-Meeting-Booking-Voice-Agent-Corpus-Bu_1774138612131.txt",
  "",
);

const PREP_ME_ARTICLE_CORPUS = [
  "Active fixed income",
  "- Fixed income remains key to long-term diversification | URL: https://investor.vanguard.com/investor-resources-education/article/fixed-income-remains-key-to-long-term-diversification | Summary: Vanguard's fixed-income team explains how it positioned portfolios during tariff-driven volatility and why high-quality bonds still matter as portfolio ballast.",
  "- Vanguard launches new short duration bond ETF | URL: https://investor.vanguard.com/investor-resources-education/news/vanguard-launches-new-short-duration-bond-etf | Summary: Introduces VSDB, an actively managed short-duration bond ETF aimed at current income and lower price volatility, with a multi-sector approach.",
  "- Index funds vs. actively managed funds | URL: https://investor.vanguard.com/investor-resources-education/understanding-investment-types/index-funds-vs-actively-managed-funds | Summary: A broad active-vs-index comparison that includes Vanguard's active bond discussion and recent benchmark-outperformance figures for active bond managers.",
  "- What higher rates for longer could mean for bondholders | URL: https://investor.vanguard.com/investor-resources-education/article/what-higher-rates-for-longer-could-mean-for-bondholders | Summary: Explains why painful bond-price declines after rate hikes can still improve the long-run outlook for fixed income through higher starting yields.",
  "- How bonds can strengthen your portfolio | URL: https://investor.vanguard.com/investor-resources-education/article/how-bonds-can-strengthen-portfolio | Summary: A practical fixed-income piece on how bonds can reduce volatility, help with inflation protection versus cash, and fit into diversified portfolios via funds or ETFs.",
  "",
  "Market outlook",
  "- AI exuberance: Economic upside, stock market downside | URL: https://investor.vanguard.com/investor-resources-education/article/ai-exuberance-economic-upside-stock-market-downside | Summary: Vanguard's 2026 outlook piece linking AI-driven productivity optimism to growth forecasts, frothy markets, and key downside risks.",
  "- Beyond the landing: Our economic outlook for 2025 | URL: https://investor.vanguard.com/investor-resources-education/article/beyond-landing-our-economic-outlook-2025 | Summary: Reviews whether strong U.S. growth, full employment, and moderating inflation can continue into 2025, with supply-side strength and tariff risk in view.",
  "- Amid turbulence, a new economic outlook | URL: https://investor.vanguard.com/investor-resources-education/article/amid-turbulence-a-new-economic-outlook | Summary: A short update to Vanguard's U.S. forecast after the April 2025 trade shock, emphasizing weaker growth, higher inflation, and rising recession risk.",
  "- Looking toward the future during periods of volatility | URL: https://investor.vanguard.com/investor-resources-education/article/looking-toward-the-future-during-periods-of-volatility | Summary: A broader market-volatility package on trade shocks, diversification, staying the course, and Vanguard's view of the road ahead.",
  "- A new day for Federal Reserve policy | URL: https://investor.vanguard.com/investor-resources-education/article/a-new-day-for-federal-reserve-policy | Summary: Covers the Fed's easing shift, what it could mean for growth and inflation, and how Vanguard was thinking about duration and credit in bond portfolios.",
  "",
  "Wealth / portfolio management",
  "- Rebalancing your portfolio | URL: https://investor.vanguard.com/investor-resources-education/portfolio-management/rebalancing-your-portfolio | Summary: Explains why portfolios drift, the main rebalancing methods, and how to rebalance in a more tax-aware way.",
  "- Diversifying your portfolio | URL: https://investor.vanguard.com/investor-resources-education/portfolio-management/diversifying-your-portfolio | Summary: A straightforward guide to diversification, correlation, and spreading risk across asset classes, regions, and sectors.",
  "- Asset location can lead to lower taxes | URL: https://investor.vanguard.com/investor-resources-education/article/asset-location-can-lead-to-lower-taxes | Summary: Shows how placing different assets in taxable, tax-deferred, and tax-free accounts can improve after-tax outcomes over time.",
  "- How to choose a financial advisor | URL: https://investor.vanguard.com/investor-resources-education/article/how-to-choose-a-financial-advisor | Summary: A good framework for deciding when you need an advisor, what services to compare, and which advisor type may fit your situation.",
  "- Account consolidation: Streamline your finances | URL: https://investor.vanguard.com/investor-resources-education/article/account-consolidation | Summary: Covers how consolidating accounts can simplify tracking, portfolio oversight, retirement planning, and estate administration.",
].join("\n");

const PREP_ME_COMPETITOR_TALKING_POINTS = [
  "Vanguard ETF competitor talking points",
  "S&P 500 competitors for VOO",
  "IVV vs VOO",
  "- Cost is a tie. IVV and VOO both charge 0.03%, so there is no fee advantage either way on a core S&P 500 sleeve.",
  "- VOO has bigger ETF scale. VOO's ETF share class was about $872.4B in assets as of February 28, 2026, versus IVV at about $676.8B as of March 20, 2026. That supports a massive scale, widely adopted core holding pitch.",
  "- Exposure is essentially the same conversation. IVV tracks the S&P 500 with 503 holdings; VOO also tracks the S&P 500 and had 504 stocks in Vanguard's profile. The sales angle is not uniqueness of exposure, but Vanguard scale plus platform fit.",
  "SPYM vs VOO",
  "- SPYM is cheaper on headline fee. SPYM charges 0.02% versus VOO at 0.03%. That is only 1 bp, or roughly $10 per year per $100,000 invested.",
  "- VOO is dramatically larger. VOO's ETF assets were about $872.4B, while SPYM was about $114.1B. For many advisors, that helps frame VOO as the larger core-beta franchise.",
  "- Both are plain-vanilla S&P 500 exposures. SPYM seeks the S&P 500 Index and reported 504 holdings, so the Vanguard pitch should be price-competitive, huge scale, trusted core allocation, not different exposure.",
  "Total U.S. market competitors for VTI",
  "ITOT vs VTI",
  "- Fee tie again. ITOT and VTI both charge 0.03%, so cost is not the differentiator.",
  "- VTI is much larger. VTI's ETF share class was about $586.3B as of February 28, 2026, versus ITOT at about $78.6B as of March 20, 2026. That supports a flagship total-market building block message.",
  "- VTI offers very broad domestic reach. Vanguard describes VTI as covering more than 3,500 U.S. stocks; ITOT reported 2,491 holdings. Index construction differs, but the advisor takeaway is that VTI remains one of the broadest single-ticket U.S. equity allocations.",
  "SCHB vs VTI",
  "- No fee advantage for Schwab here. SCHB and VTI are both at 0.03%.",
  "- VTI has far more asset depth. VTI's ETF assets were about $586.3B versus SCHB at about $36.7B. That is a strong scale talking point for advisors standardizing on a core U.S. beta position.",
  "- VTI is broader in stock count. Vanguard says VTI covers more than 3,500 domestic stocks; SCHB listed 2,408 holdings. The simple pitch: VTI gives advisors broader U.S. market coverage in one trade.",
  "Developed ex-U.S. competitors for VEA",
  "IEFA vs VEA",
  "- VEA has a real fee advantage. VEA charges 0.03% versus IEFA at 0.07%, a gap of 4 bps, or about $40 per year per $100,000 invested.",
  "- VEA is also larger. VEA's ETF share class was about $222.0B as of February 28, 2026, versus IEFA at about $163.4B as of March 20, 2026.",
  "- Both are core developed-markets tools, but VEA wins on cost. VEA tracks the FTSE Developed All Cap ex US Index and had about 3,900 stocks; IEFA tracks the MSCI EAFE IMI Index with 2,630 holdings. The advisor message is: similar portfolio role, but Vanguard is meaningfully cheaper.",
  "SCHF vs VEA",
  "- Fees are tied. SCHF and VEA both charge 0.03%.",
  "- VEA is much larger. VEA's ETF assets were about $222.0B versus SCHF at about $57.0B.",
  "- VEA is broader by holdings. VEA reported roughly 3,900 stocks, while SCHF reported 1,489 holdings. Both fill the same developed ex-U.S. core slot, but VEA supports a broader-coverage argument.",
  "U.S. growth competitors for VUG",
  "IWF vs VUG",
  "- This is one of Vanguard's strongest cost wins. VUG charges 0.03% versus IWF at 0.18%. That is a 15 bp gap, or roughly $150 per year per $100,000 invested.",
  "- VUG is also larger. VUG's ETF share class was about $196.3B as of February 28, 2026, versus IWF at about $111.9B as of March 20, 2026.",
  "- Use cost and scale, not same index language. VUG had 151 stocks in Vanguard's profile, while IWF reported 388 holdings, reflecting different index methodologies. The clean sales line is: If you want a large-cap growth allocation, Vanguard delivers it at a much lower fee.",
  "SCHG vs VUG",
  "- VUG is still cheaper. VUG is 0.03% and SCHG is 0.04%, so Vanguard saves 1 bp, about $10 per year per $100,000.",
  "- VUG has much larger asset scale. VUG's ETF assets were about $196.3B, while SCHG was about $48.4B.",
  "- Both are growth tools, but Vanguard has the pricing edge. SCHG reported 198 holdings versus VUG's 151, again due to different indexes. The advisor-friendly takeaway is simple: Vanguard gives you a flagship growth sleeve at slightly lower cost and far larger scale.",
  "U.S. value competitors for VTV",
  "IWD vs VTV",
  "- Another major Vanguard fee win. VTV charges 0.03% versus IWD at 0.18%, a 15 bp difference, or roughly $150 per year per $100,000.",
  "- VTV is materially larger. VTV's ETF share class was about $173.5B as of February 28, 2026, versus IWD at about $68.5B as of March 20, 2026.",
  "- Position VTV as the lower-cost value building block. VTV had 312 stocks in Vanguard's profile, while IWD reported 867 holdings because the indexes differ. The strongest sales point is lower fee plus flagship scale, not identical portfolio construction.",
  "SCHV vs VTV",
  "- VTV is cheaper. VTV is 0.03% and SCHV is 0.04%, so Vanguard saves 1 bp, around $10 per year per $100,000 invested.",
  "- VTV is far larger. VTV's ETF assets were about $173.5B versus SCHV at about $14.7B.",
  "- Both serve the large-cap value role, but Vanguard has the cleaner price-and-scale story. SCHV reported 558 holdings versus VTV's 312, reflecting different index methodologies. For an advisor conversation, the simple line is VTV is the lower-cost flagship value option.",
].join("\n");

interface PrepAdvisorRow {
  name: string;
  firm: string;
  row: Record<string, string>;
}

interface PrepLeadAdvisorData {
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

function parseAdvisorCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i];

    if (char === "\"") {
      if (inQuotes && csv[i + 1] === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current.trim());
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && csv[i + 1] === "\n") {
        i += 1;
      }
      row.push(current.trim());
      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current.trim());
    if (row.some((value) => value.length > 0)) {
      rows.push(row);
    }
  }

  return rows;
}

const PREP_ADVISORS: PrepAdvisorRow[] = (() => {
  try {
    const csvPathCandidates = [
      resolve(process.cwd(), "artifacts/api-server/src/data/advisors.csv"),
      resolve(__dirname, "../data/advisors.csv"),
      resolve(__dirname, "../../src/data/advisors.csv"),
    ];
    const csvPath = csvPathCandidates.find((candidate) => existsSync(candidate));
    if (!csvPath) {
      throw new Error(`Could not locate advisors.csv in: ${csvPathCandidates.join(", ")}`);
    }
    const csv = readFileSync(csvPath, "utf8");
    const rows = parseAdvisorCsv(csv);
    const headers = (rows[0] ?? []).map((header) => header.trim());

    return rows.slice(1).map((values) => {
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = (values[index] ?? "").trim();
      });

      return {
        name: row["Advisor Name"] ?? "",
        firm: row["Firm"] ?? "",
        row,
      };
    });
  } catch (err) {
    console.error("Failed to load Prep Me advisor CSV:", err);
    return [];
  }
})();

function parsePrepLeadAdvisorData(leadAssets?: string): PrepLeadAdvisorData | null {
  if (!leadAssets) return null;

  try {
    const parsed = JSON.parse(leadAssets) as { __advisorData?: PrepLeadAdvisorData };
    return parsed.__advisorData ?? null;
  } catch {
    return null;
  }
}

function buildPrepTranscriptionPrompt(parts: Array<string | undefined>, maxLength = 1000): string {
  const cleanedParts = parts
    .map((part) => (part ?? "").replace(/\s+/g, " ").trim())
    .filter(Boolean);

  let prompt = "";
  for (const part of cleanedParts) {
    const next = prompt ? `${prompt}, ${part}` : part;
    if (next.length > maxLength) break;
    prompt = next;
  }

  return prompt;
}

function findPrepAdvisorRow(advisorName: string, advisorCompany: string): PrepAdvisorRow | null {
  const normalizedName = advisorName.trim().toLowerCase();
  const normalizedCompany = advisorCompany.trim().toLowerCase();
  const exactMatch = PREP_ADVISORS.find((advisor) =>
    advisor.name.trim().toLowerCase() === normalizedName &&
    advisor.firm.trim().toLowerCase() === normalizedCompany,
  );
  if (exactMatch) return exactMatch;

  const companyNormalized = normalizedCompany.replace(/\s+/g, " ").trim();
  const fuzzyCompanyMatch = PREP_ADVISORS.find((advisor) => {
    const advisorNameNormalized = advisor.name.trim().toLowerCase();
    const advisorFirmNormalized = advisor.firm.trim().toLowerCase().replace(/\s+/g, " ").trim();
    return advisorNameNormalized === normalizedName && (
      advisorFirmNormalized.includes(companyNormalized) ||
      companyNormalized.includes(advisorFirmNormalized)
    );
  });
  if (fuzzyCompanyMatch) return fuzzyCompanyMatch;

  const nameMatches = PREP_ADVISORS.filter((advisor) =>
    advisor.name.trim().toLowerCase() === normalizedName,
  );
  return nameMatches.length === 1 ? nameMatches[0] : null;
}

function buildPrepMeInstructions(opts: {
  advisorName: string;
  advisorCompany: string;
  meetingPurpose?: string;
  advisorRow: PrepAdvisorRow | null;
  leadAdvisorData?: PrepLeadAdvisorData | null;
}): string {
  const rowJson = opts.advisorRow
    ? JSON.stringify(opts.advisorRow.row)
    : opts.leadAdvisorData?.advisorRow
    ? JSON.stringify(opts.leadAdvisorData.advisorRow)
    : "No matching advisor row was found in the dataset.";

  const leadContextJson = opts.leadAdvisorData
    ? JSON.stringify({
        aumM: opts.leadAdvisorData.aumM,
        salesAmt: opts.leadAdvisorData.salesAmt,
        redemption: opts.leadAdvisorData.redemption,
        fiOpportunities: opts.leadAdvisorData.fiOpportunities,
        etfOpportunities: opts.leadAdvisorData.etfOpportunities,
        alpha: opts.leadAdvisorData.alpha,
        competitors: opts.leadAdvisorData.competitors,
        buyingUnit: opts.leadAdvisorData.buyingUnit,
        territory: opts.leadAdvisorData.territory,
        segment: opts.leadAdvisorData.segment,
        ratings: opts.leadAdvisorData.ratings,
        advisorProfile: opts.leadAdvisorData.advisorProfile,
        salesEngagement: opts.leadAdvisorData.salesEngagement,
        salesNotes: opts.leadAdvisorData.salesNotes,
      })
    : "No structured lead context was provided.";

  return `You are Prep Me, a Vanguard voice prep assistant helping a salesperson prepare for a meeting with a financial advisor.

Your role:
- Answer questions about this advisor using the advisor context below.
- Be concise, spoken, and practical.
- Speak only in English.
- Even if the salesperson uses another language, respond only in English.
- If a requested fact is not present in the advisor context, say it is not available in the record.
- You may do simple arithmetic or comparisons from the row values, but do not invent new facts.
- Use sales notes, profile, engagement context, territory, segment, competitor mentions, AUM, flows, and opportunity fields when relevant.
- Use the full advisor row, not just one field. Pull from sales notes, advisor profile, sales engagement, family and personal details, meeting preferences, portfolio orientation, AUM, sales, redemptions, net flows, competitors, buying unit, territory, segment, ratings, FI opportunity, ETF opportunity, and alpha whenever relevant.
- When helpful, summarize the most important takeaways for how the salesperson should approach this advisor.
- Prefer the full advisor dataset row when available. If the row is missing but structured lead context is present, answer from that structured lead context instead.
- Treat the advisor dataset as the only source of truth for advisor facts. Do not generalize beyond it.
- If asked "what data do you have" or "what can you tell me", summarize the important available columns before answering in detail.
- If asked about personal interests, family details, education, or preferences, quote or paraphrase only the matching field from the advisor record. Do not infer broader themes from product interest or portfolio orientation.
- Keep answers short, usually 1 to 3 sentences. Do not repeat yourself.
- You also have access to a bounded Vanguard article corpus below. Use only that article corpus when the salesperson asks for articles, content, or reading material.
- You also have a bounded Vanguard ETF competitor talking points knowledge base below.
- Use that knowledge base when the salesperson asks about competitor products, competitor funds in the book, or how to compare Vanguard ETFs versus competitor ETFs.
- When comparing funds, anchor on the bounded facts only: fee, asset scale, holdings breadth, and clean advisor-facing positioning.
- Do not invent competitor comparisons beyond the tickers covered in the bounded talking points.
- If a comparison is not covered in the bounded talking points, say you do not have that specific comparison in the knowledge base.
- If the salesperson asks for articles related to a topic such as market outlook, active fixed income, or portfolio management, identify the top 3 most relevant articles from the corpus.
- In live conversation, do not read URLs, summaries, or metadata aloud unless the user explicitly asks for them. Just say there are top articles available and speak only the article titles.
- Do not invent article titles or refer to any content outside this corpus.
- If the salesperson asks you to add, save, include, or put an article on the agenda, you must call the add_agenda_article function with the exact article title and URL from the bounded corpus.
- If the salesperson says "add this", "add them", "put those on the agenda", or similar after you have just listed articles, interpret that as a request to add the articles you just recommended.
- If the salesperson asks to add multiple articles, call add_agenda_article once per article.
- After calling the function, keep the spoken response short, for example: "Added to the agenda."

Advisor name: ${opts.advisorName}
Firm: ${opts.advisorCompany}
Meeting purpose: ${opts.meetingPurpose || "General advisor preparation"}

Full advisor dataset row:
${rowJson}

Structured lead context from the app:
${leadContextJson}

Bounded Vanguard article corpus:
${PREP_ME_ARTICLE_CORPUS}

Bounded Vanguard ETF competitor talking points:
${PREP_ME_COMPETITOR_TALKING_POINTS}

When the conversation starts, give a short opener like:
"I'm ready. Ask me anything about ${opts.advisorName}, and I'll answer from the advisor record."`;
}

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
- Speak only in English.
- Even if the advisor speaks another language, continue in English.
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

function buildScheduleMeInstructions(opts: {
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
  const slotList = AVAILABLE_SLOTS.map((d) => `- ${d.label}: ${d.times.join(" or ")}`).join("\n");

  const advisorCtx = [
    opts.aumM ? `- AUM: $${opts.aumM.toFixed(1)}M` : null,
    opts.fiOpportunities ? `- Fixed Income opportunity: $${(opts.fiOpportunities / 1000).toFixed(0)}K` : null,
    opts.etfOpportunities ? `- ETF opportunity: $${(opts.etfOpportunities / 1000).toFixed(0)}K` : null,
    opts.alpha ? `- Alpha generated: $${(opts.alpha / 1000).toFixed(0)}K` : null,
    opts.territory ? `- Territory: ${opts.territory}` : null,
    opts.advisorSegment ? `- Advisor segment: ${opts.advisorSegment}` : null,
    opts.competitors?.length ? `- Current products: ${opts.competitors.slice(0, 3).join(", ")}` : null,
  ].filter(Boolean).join("\n");

  return [
    "IDENTITY OVERRIDE:",
    '- Always introduce yourself in the first sentence as "Maya, the Vanguard Scheduling AI assistant."',
    "- Keep that identity consistent throughout the call.",
    "- Speak only in English.",
    "- Even if the advisor speaks another language, continue in English.",
    "- Do not introduce yourself as only a generic Vanguard representative or salesperson.",
    '- Never refer to a meeting as being with "your Vanguard salesperson" or "your Vanguard sales person."',
    '- When referring to a Vanguard follow-up meeting, say "our Vanguard consultant," "our Vanguard specialist," or "someone from our Vanguard team."',
    "- Speak as part of Vanguard's team using first-person plural phrasing like our team, our consultant, and our specialist where appropriate.",
    "",
    "PRIMARY SYSTEM PROMPT:",
    SCHEDULE_ME_PROMPT_TEMPLATE,
    "",
    "OPENING REQUIREMENT:",
    'Your first live sentence should closely follow: "Hi, this is Maya, the Vanguard Scheduling AI assistant with Vanguard. Did I catch you with 30 seconds?"',
    '- If the advisor says they have a moment, immediately explain the reason for the call: say Vanguard saw they had been on Vanguard fund pages and you wanted to understand what they were looking into and whether our team could help.',
    '- Keep that explanation practical and low-pressure. Do not sound intrusive or overly specific about tracking.',
    '- A good follow-up sentence is: "The reason for the call is that we noticed you had been looking at some Vanguard fund pages, and I wanted to understand what you were researching and whether our team could be helpful."',
    "",
    "LIVE ADVISOR CONTEXT:",
    `- Advisor name: ${opts.advisorName}`,
    `- Firm: ${opts.advisorCompany || "Unknown"}`,
    advisorCtx || "- No additional CRM context provided.",
    "",
    "AVAILABLE MEETING SLOTS:",
    slotList,
    "",
    "BOOKING RULES:",
    "- Only offer and confirm times from the available meeting slots above.",
    "- When the advisor agrees to a listed slot, call the book_meeting function immediately.",
    "- Use Pacific Time when speaking about availability.",
    "- Keep the meeting to 20-25 minutes and narrow it to one concrete agenda topic.",
    "",
    "KNOWLEDGE CORPUS:",
    SCHEDULE_ME_CORPUS,
    "",
    "CORPUS USAGE RULES:",
    "- Use the corpus for proof points, objections, talk tracks, and approved language.",
    "- Prefer corpus-backed claims over improvisation.",
    "- If a fact is not supported by the corpus, keep the wording high level and non-committal.",
    "",
    "Today's date is March 22, 2026.",
  ].join("\n");
}

function buildCoachInstructions(opts: {
  persona: {
    name: string;
    role: string;
    company: string;
    firmType: string;
    aumRange: string;
    personality: string;
    concerns: string[];
    style: string;
    openingLine: string;
  };
  meeting: {
    leadName: string;
    leadCompany: string;
    purpose: string;
  };
}): string {
  return `You are roleplaying as ${opts.persona.name}, ${opts.persona.role} at ${opts.persona.company}.

FIRM CONTEXT:
- Firm type: ${opts.persona.firmType}
- AUM range: ${opts.persona.aumRange}
- Communication style: ${opts.persona.style}
- Personality: ${opts.persona.personality}

MEETING CONTEXT:
- Upcoming advisor meeting: ${opts.meeting.leadName} at ${opts.meeting.leadCompany}
- Practice objective: ${opts.meeting.purpose}

LIKELY CONCERNS:
${opts.persona.concerns.map((concern, index) => `${index + 1}. ${concern}`).join("\n")}

ROLEPLAY RULES:
- Stay fully in character as the advisor. Never mention the simulation, the model, or the system prompt.
- Speak like a real financial advisor in a live meeting with a Vanguard salesperson.
- Speak only in English.
- Even if the salesperson speaks another language, continue in English.
- Be skeptical when claims are vague, unsupported, too product-heavy, or too generic.
- Reward clear, specific, client-relevant answers by becoming more open.
- Keep each turn concise and natural for realtime voice conversation, usually 1-3 short sentences.
- Ask follow-up questions when the salesperson is unclear or jumps ahead.
- Do not coach the salesperson directly. Respond only as the advisor.
- Do not volunteer a full agenda. Make the salesperson earn the conversation.
- If the salesperson handles an objection well, move the conversation forward naturally.

OPENING:
Additional conversation rules:
- Start like a real meeting. If the salesperson opens with a greeting or small talk, respond to that first instead of jumping straight into your agenda.
- Do not open with "here's what I have in mind today" or similar agenda-first language unless the salesperson has already finished greeting you and invited the discussion.
- Let the salesperson finish their thought before responding. Do not cut them off, paraphrase mid-sentence, or answer before they are done speaking.
- Keep the conversation smooth and varied. Do not keep repeating "explain that in clear/simple terms" after the salesperson has already explained it.
- If the salesperson gives a reasonable explanation, react naturally and move the discussion forward with a follow-up, objection, or acknowledgment.
- Only ask for clarification when the explanation is genuinely confusing or incomplete. Do not use the same clarification request more than once in a row.
- Avoid sounding like you are interpreting or summarizing every user turn. Respond like a real advisor in a live conversation.

Your first line should closely follow this opener in your own natural cadence: "${opts.persona.openingLine}"`;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asStringArray(value: unknown): string[] {
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

function joinOrFallback(value: unknown, fallback: string): string {
  const items = asStringArray(value);
  return items.length > 0 ? items.join(", ") : fallback;
}

function formatCoachSourceContext(sourceContext?: Record<string, unknown>): string {
  if (!sourceContext) {
    return "No additional raw advisor source context was provided.";
  }

  const advisorRow = sourceContext.advisorRow;
  const advisorProfile = asString(sourceContext.advisorProfile, "No advisor profile provided.");
  const salesEngagement = asString(sourceContext.salesEngagement, "No sales engagement notes provided.");
  const salesNotes = asString(sourceContext.salesNotes, "No sales notes provided.");
  const structuredContext = {
    aumM: sourceContext.aumM,
    salesAmt: sourceContext.salesAmt,
    redemption: sourceContext.redemption,
    fiOpportunities: sourceContext.fiOpportunities,
    etfOpportunities: sourceContext.etfOpportunities,
    alpha: sourceContext.alpha,
    competitors: Array.isArray(sourceContext.competitors) ? sourceContext.competitors : [],
    buyingUnit: sourceContext.buyingUnit,
    territory: sourceContext.territory,
    segment: sourceContext.segment,
    ratings: sourceContext.ratings,
  };

  return [
    "Structured advisor source context:",
    JSON.stringify(structuredContext, null, 2),
    "",
    "Advisor profile:",
    advisorProfile,
    "",
    "Sales engagement context:",
    salesEngagement,
    "",
    "Sales notes:",
    salesNotes,
    "",
    "Matched advisor row:",
    advisorRow && typeof advisorRow === "object"
      ? JSON.stringify(advisorRow, null, 2)
      : "No matched advisor row was attached.",
  ].join("\n");
}

function buildCoachScenarioInstructions(
  hiddenBrief: Record<string, unknown>,
  sourceContext?: Record<string, unknown>,
): string {
  const personaName = asString(hiddenBrief.personaName, "the advisor");
  const firm = asString(hiddenBrief.firm, "their firm");
  const rawSourceContext = formatCoachSourceContext(sourceContext);

  return `You are ${personaName}, a financial advisor at ${firm}.
Advisor type: ${asString(hiddenBrief.advisorType, "Financial Advisor")}.
Tone: ${asString(hiddenBrief.tone, "professional and practical")}.
Business context: ${asString(hiddenBrief.businessContext, "You manage client relationships and portfolio decisions for your practice.")}.
Current approach: ${asString(hiddenBrief.currentApproach, "You have an existing approach and want ideas only if they are relevant and practical.")}.
Objectives: ${joinOrFallback(hiddenBrief.objectives, "Protect client outcomes, improve implementation, and use your time efficiently.")}.
Pain points: ${joinOrFallback(hiddenBrief.painPoints, "You need practical ideas tied to real client situations and portfolio decisions.")}.
Likely objections: ${joinOrFallback(hiddenBrief.objections, "Push back on generic claims, premature product pitches, and anything not tied to your clients.")}.
Fit signals: ${joinOrFallback(hiddenBrief.fitSignals, "Respond well to specific discovery, practical examples, and clear prioritization.")}.
Red flags: ${joinOrFallback(hiddenBrief.redFlags, "Tune out when the rep skips discovery, over-talks, or gives generic product pitches.")}.
Live case examples you may reference when appropriate: ${joinOrFallback(hiddenBrief.liveCaseExamples, "Use one realistic client situation only after the salesperson earns it with good discovery.")}.
Success definition for this call: ${joinOrFallback(hiddenBrief.successDefinition, "A strong call earns a practical next step with clear ownership and timing.")}.
Topics the coach is evaluating in the rep: ${joinOrFallback(hiddenBrief.coachFocus, "agenda, discovery, insight relevance, practical next steps, summary, and close")}.

RAW ADVISOR SOURCE CONTEXT:
${rawSourceContext}

You are on a live phone call with a salesperson practicing the VG Way.
Stay fully in character as the advisor.
Speak only in English.
Even if the salesperson speaks another language, continue in English.
The salesperson starts the conversation. Do not speak first unless they directly check whether you are there.
Do not give feedback or mention the VG Way during the call.
Be conversational, concise, and realistic for a live advisor call.
Keep most responses to 1-4 short sentences.
The salesperson owns the agenda, discovery questions, recommendations, summary, and close. You do not own those parts of the call.
Do not monologue, do not over-explain, and do not help the rep by volunteering the structure of the conversation.
Do not behave like the salesperson or wholesaler.
Do not ask broad lead-in questions such as "what's on your mind", "how can I help", "what did you want to discuss", or "tell me about your offering".
Do not ask the rep for their agenda. Do not ask what they want to discuss.
Desired call flow:
1. Salesperson gives a brief greeting and opening.
2. You respond as the advisor with a short acknowledgement plus 1-2 concrete concerns you are hearing from clients or dealing with in portfolios or practice management.
3. The salesperson then continues with questions, ideas, products, and recommendations.
On the opening turn after the salesperson greets you, do not bounce the conversation back with a generic question. Instead, briefly state what is top of mind for you or your clients right now.
Your first substantive response should usually include one specific issue such as client cash positioning, short-duration bonds, fixed income allocation, tax-aware investing, ETF implementation, model portfolios, fees, or practice efficiency, as long as it fits the advisor brief.
Use the raw advisor source context directly when shaping what is top of mind, what products or competitors are already in the book, how large the practice is, where the best ETF or fixed-income opportunity is, and what relationship history or notes should influence your tone.
If sales notes, advisor profile, sales engagement, AUM, ETF opportunity, FI opportunity, competitors, territory, buying unit, or ratings are present, let them influence the specifics of your responses instead of falling back to generic advisor behavior.
When the raw advisor source context contains a concrete detail, prefer that detail over a generic hidden-brief summary.
Treat the raw advisor source context and matched advisor row as the most specific ground truth for this simulated advisor.
Use sales notes, advisor profile, and sales engagement to make the advisor feel like a real person with existing context, preferences, and relationship history.
If the notes suggest communication style, prior interactions, product familiarity, service expectations, or practice priorities, let those cues subtly shape the advisor's wording and attitude.
Be personable and natural, but not chatty. A real advisor can sound warm, busy, practical, skeptical, or familiar depending on the notes.
Do not dump biography or read back the notes. Use them implicitly to shape how the advisor talks.
If the rep asks what is top of mind, what clients are dealing with, or what you are focused on, answer directly with one or two specific concerns from your practice or clients.
On the first response after the salesperson greets you, sound like a real advisor picking up a call, not like a scripted training bot.
Avoid canned transitions such as "let's jump into the discussion", "let's dive in", "let's get right into it", "go ahead", or "what do you have for me today".
Instead, briefly acknowledge the rep in a natural way and then mention one concrete concern, client question, or practice issue that fits the notes and advisor context.
Good opening shape: brief acknowledgement plus a specific concern. Bad opening shape: generic handoff language or asking the rep to drive the whole call immediately.
Your job is to react as the advisor by answering, clarifying your situation, pushing back, or asking a short follow-up only when needed to evaluate the rep's idea.
Any question you ask should be brief and advisor-like, not a discovery sequence that takes over the meeting.
Reveal detail only when the salesperson earns it with relevant discovery.
If the rep asks vague questions, answer briefly and leave room for follow-up.
If the rep moves too quickly into product or pitch mode, raise a practical objection naturally.
If the rep summarizes well, prioritizes clearly, and earns the right to advance, become more collaborative and specific.
If the salesperson clearly ends the call, stop the roleplay rather than reopening the conversation.`;
}

router.post("/realtime/session", async (req, res) => {
  try {
    const {
      offerSdp,
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
      offerSdp?: string;
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

    if (!offerSdp) {
      return res.status(400).json({ error: "offerSdp is required" });
    }

    const instructions = buildScheduleMeInstructions({
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

    const sessionPayload = {
      type: "realtime",
      model: "gpt-realtime",
      instructions,
      audio: {
        input: {
          format: {
            type: "audio/pcm",
            rate: 24000,
          },
          noise_reduction: {
            type: "near_field",
          },
          turn_detection: {
            type: "server_vad",
            silence_duration_ms: 500,
            threshold: 0.45,
            prefix_padding_ms: 300,
            create_response: true,
            interrupt_response: true,
          },
          transcription: {
            model: "whisper-1",
            language: "en",
            prompt: SCHEDULE_ME_TRANSCRIPTION_PROMPT,
          },
        },
        output: {
          format: {
            type: "audio/pcm",
            rate: 24000,
          },
          voice: "alloy",
        },
      },
      include: ["item.input_audio_transcription.logprobs"],
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
    };

    const realtimeSession = await createOpenAIRealtimeSession(offerSdp, sessionPayload);

    return res.json({
      ...realtimeSession,
      availableSlots: AVAILABLE_SLOTS,
    });
  } catch (err) {
    console.error("Realtime session error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/realtime/prep-session", async (req, res) => {
  try {
    const {
      offerSdp,
      advisorName = "the advisor",
      advisorCompany = "",
      meetingPurpose = "",
      leadAssets,
    } = req.body as {
      offerSdp?: string;
      advisorName?: string;
      advisorCompany?: string;
      meetingPurpose?: string;
      leadAssets?: string;
    };

    if (!offerSdp) {
      return res.status(400).json({ error: "offerSdp is required" });
    }

    const advisorRow = findPrepAdvisorRow(advisorName, advisorCompany);
    const leadAdvisorData = parsePrepLeadAdvisorData(leadAssets);
    const instructions = buildPrepMeInstructions({
      advisorName,
      advisorCompany,
      meetingPurpose,
      advisorRow,
      leadAdvisorData,
    });

    const sessionPayload = {
      type: "realtime",
      model: "gpt-realtime",
      instructions,
      audio: {
        input: {
          format: {
            type: "audio/pcm",
            rate: 24000,
          },
          noise_reduction: {
            type: "near_field",
          },
          turn_detection: {
            type: "server_vad",
            silence_duration_ms: 450,
            threshold: 0.45,
            prefix_padding_ms: 250,
            create_response: true,
            interrupt_response: true,
          },
          transcription: {
            model: "whisper-1",
            language: "en",
            prompt: buildPrepTranscriptionPrompt([
              advisorName,
              advisorCompany,
              meetingPurpose,
              "market outlook",
              "active fixed income",
              "portfolio management articles",
              advisorRow?.row["Territory"] ?? leadAdvisorData?.territory ?? "",
              advisorRow?.row["Buying Units"] ?? leadAdvisorData?.buyingUnit ?? "",
              advisorRow?.row["Segment"] ?? leadAdvisorData?.segment ?? "",
              advisorRow?.row["Synthetic Sales Notes"] ?? leadAdvisorData?.salesNotes ?? "",
            ]),
          },
        },
        output: {
          format: {
            type: "audio/pcm",
            rate: 24000,
          },
          voice: "alloy",
        },
      },
      include: ["item.input_audio_transcription.logprobs"],
      tools: [
        {
          type: "function",
          name: "add_agenda_article",
          description:
            "Add a Seismic/Vanguard article to one of the left-side agenda placeholders in Prep Me.",
          parameters: {
            type: "object",
            properties: {
              title: {
                type: "string",
                description: "Exact article title from the bounded Vanguard article corpus.",
              },
              url: {
                type: "string",
                description: "Exact article URL from the bounded Vanguard article corpus.",
              },
              topic: {
                type: "string",
                description: "High-level topic label such as market outlook, active fixed income, or portfolio management.",
              },
              slot: {
                type: "integer",
                description: "Optional placeholder slot number from 1 to 3.",
              },
            },
            required: ["title", "url"],
          },
        },
      ],
      tool_choice: "auto",
    };

    const realtimeSession = await createOpenAIRealtimeSession(offerSdp, sessionPayload);

    return res.json(realtimeSession);
  } catch (err) {
    console.error("Prep realtime session error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/realtime/coach-session", async (req, res) => {
  try {
    const {
      offerSdp,
      persona,
      scenario,
      meeting,
    } = req.body as {
      offerSdp?: string;
      persona?: {
        name: string;
        role: string;
        company: string;
        firmType: string;
        aumRange: string;
        personality: string;
        concerns: string[];
        style: string;
        openingLine: string;
      };
      scenario?: {
        hiddenBrief: Record<string, unknown>;
        sourceContext?: Record<string, unknown>;
      };
      meeting?: {
        leadName: string;
        leadCompany: string;
        purpose: string;
      };
    };

    if (!offerSdp || (!persona && !scenario) || !meeting) {
      return res.status(400).json({ error: "offerSdp, scenario or persona, and meeting are required" });
    }
    const sessionPayload = {
      type: "realtime",
      model: "gpt-realtime",
      output_modalities: ["audio"],
      instructions: `${
        scenario
          ? buildCoachScenarioInstructions(scenario.hiddenBrief, scenario.sourceContext)
          : buildCoachInstructions({ persona: persona!, meeting })
      }

Conversation flow rules:
- Wait for the salesperson to finish speaking before you respond.
- Treat greetings and pleasantries like a normal conversation. Acknowledge them before moving into business topics.
- Do not jump directly into your agenda at the start of the conversation.
- Do not repeatedly ask the salesperson to restate or simplify the same point after they have already answered.
- Vary your responses naturally and move the conversation forward once a question has been answered.`,
      audio: {
        input: {
          turn_detection: {
            type: "server_vad",
            silence_duration_ms: 1100,
            threshold: 0.55,
            prefix_padding_ms: 350,
            create_response: false,
            interrupt_response: false,
          },
          transcription: {
            model: "gpt-4o-mini-transcribe",
            language: "en",
            prompt: "Financial advisor sales call.",
          },
        },
        output: {
          voice: "alloy",
        },
      },
    };

    const realtimeSession = await createOpenAIRealtimeSession(offerSdp, sessionPayload);

    return res.json(realtimeSession);
  } catch (err) {
    console.error("Coach session error:", err);
    return res.status(500).json({
      error: "Internal server error",
      details: err instanceof Error ? err.message : "Unknown coach session error",
    });
  }
});

// ─── Engage Me: Turn-based audio analyze ─────────────────────────────────────

router.post("/realtime/analyze", async (req, res) => {
  try {
    const { audio } = req.body as { audio?: string };
    if (!audio) return res.status(400).json({ error: "audio required" });

    const audioBuffer = Buffer.from(audio, "base64");
    const { buffer: wavBuffer, format } = await ensureCompatibleFormat(audioBuffer);
    const transcript = await speechToText(wavBuffer, format);

    if (!transcript.trim()) {
      return res.json({ detected: null, transcript: "" });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        {
          role: "system",
          content: `You are a silent assistant listening to a financial sales meeting. Detect whether any Vanguard ETF was mentioned.

ETF detection:
- BND = bonds / bond market / fixed income / aggregate bond / total bond
- VTI = total stock / total market / broad U.S. equity / domestic equity
- VOO = S&P 500 / large cap / five hundred / S and P
- VXUS = international / global / ex-US / developed markets / emerging markets / foreign
- VNQ = real estate / REIT / property / real estate investment trust

Data type detection:
- "top holdings" / "biggest positions" / "holdings" / "what does it hold" → dataType: "holdings"
- "how has it performed" / "returns" / "performance" / "year to date" / "ytd" → dataType: "performance"
- "sectors" / "sector breakdown" / "exposure" / "allocation" / "composition" / "geography" → dataType: "composition"
- "expense ratio" / "cost" / "fee" / "yield" / "price" / general fund mention → dataType: "overview"
- "P/E" / "P/B" / "market cap" / "volatility" / "metrics" / "stats" → dataType: "stats"

If a fund is mentioned without a specific data type, default to "overview".
If NO fund is clearly mentioned, call show_fund_data with ticker null.`,
        },
        { role: "user", content: transcript },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "show_fund_data",
            description: "Called when a Vanguard ETF is detected in the conversation",
            parameters: {
              type: "object" as const,
              properties: {
                ticker: {
                  type: "string",
                  enum: ["BND", "VTI", "VOO", "VXUS", "VNQ"],
                  description: "The ETF ticker detected, or omit if none detected",
                },
                dataType: {
                  type: "string",
                  enum: ["overview", "holdings", "performance", "composition", "stats"],
                  description: "Type of data being asked about",
                },
                insight: {
                  type: "string",
                  description: "One-sentence contextual insight about the fund data",
                },
              },
              required: ["dataType", "insight"],
            },
          },
        },
      ],
      tool_choice: "auto",
    });

    const toolCall = completion.choices[0]?.message?.tool_calls?.[0];
    if (toolCall && "function" in toolCall && toolCall.function.name === "show_fund_data") {
      const args = JSON.parse(toolCall.function.arguments) as {
        ticker?: string; dataType: string; insight: string;
      };
      if (args.ticker) {
        return res.json({ detected: args, transcript });
      }
    }

    return res.json({ detected: null, transcript });
  } catch (err) {
    console.error("Engage analyze error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Engage Me session (legacy WebRTC — kept for reference) ───────────────────

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

router.post("/realtime/engage-session", async (req, res) => {
  try {
    const {
      offerSdp,
      advisorName = "the advisor",
      advisorCompany = "",
    } = req.body as {
      offerSdp?: string;
      advisorName?: string;
      advisorCompany?: string;
    };

    if (!offerSdp) {
      return res.status(400).json({ error: "offerSdp is required" });
    }

    const sessionPayload = {
      type: "realtime",
      model: "gpt-realtime",
      output_modalities: ["text"],
      instructions: `${ENGAGE_SYSTEM_PROMPT}

Current meeting context: The Vanguard salesperson is speaking with ${advisorName}${advisorCompany ? ` at ${advisorCompany}` : ""}.`,
      audio: {
        input: {
          turn_detection: {
            type: "server_vad",
            threshold: 0.45,
            prefix_padding_ms: 250,
            silence_duration_ms: 450,
            create_response: true,
            interrupt_response: true,
          },
          transcription: {
            model: "gpt-4o-mini-transcribe",
            language: "en",
            prompt: "ETF names to listen for: BND, VTI, VOO, VXUS, VNQ. Common request types: holdings, performance, composition, overview, stats.",
          },
        },
      },
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
    };

    const realtimeSession = await createOpenAIRealtimeSession(offerSdp, sessionPayload);

    return res.json(realtimeSession);
  } catch (err) {
    console.error("Engage session error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/realtime/lead-me-session", async (req, res) => {
  try {
    const { offerSdp } = req.body as { offerSdp?: string };

    if (!offerSdp) {
      return res.status(400).json({ error: "offerSdp is required" });
    }

    const sessionPayload = {
      type: "realtime",
      model: "gpt-realtime",
      output_modalities: ["text"],
      instructions: `You are a silent realtime transcription session for Lead Me.
Do not act like an assistant and do not answer the user.
The application only wants live speech transcription so it can populate the advisor lead-search query box in realtime.
Focus on accurate transcription of advisor dataset vocabulary, firm abbreviations, county names, buying units, and opportunity terms.`,
      audio: {
        input: {
          turn_detection: {
            type: "server_vad",
            threshold: 0.45,
            prefix_padding_ms: 300,
            silence_duration_ms: 450,
            create_response: true,
            interrupt_response: false,
          },
          transcription: {
            model: "gpt-4o-mini-transcribe",
            language: "en",
            prompt: LEAD_ME_REALTIME_TRANSCRIPTION_PROMPT,
          },
        },
      },
    };

    const realtimeSession = await createOpenAIRealtimeSession(offerSdp, sessionPayload);

    return res.json(realtimeSession);
  } catch (err) {
    console.error("Lead Me session error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/realtime/follow-me-session", async (req, res) => {
  try {
    const {
      offerSdp,
      leadName = "the advisor",
      leadCompany = "",
      purpose = "",
    } = req.body as {
      offerSdp?: string;
      leadName?: string;
      leadCompany?: string;
      purpose?: string;
    };

    if (!offerSdp) {
      return res.status(400).json({ error: "offerSdp is required" });
    }

    const sessionPayload = {
      type: "realtime",
      model: "gpt-realtime",
      output_modalities: ["text"],
      instructions: `You are a silent transcription session for a salesperson dictating a meeting recap after speaking with ${leadName}${leadCompany ? ` at ${leadCompany}` : ""}.
Do not act like an assistant and do not generate advice or replies on your own.
The application only wants live speech transcription so it can extract follow-up tasks and tags.
If a response is ever requested, stay minimal and neutral.`,
      audio: {
        input: {
          turn_detection: {
            type: "server_vad",
            threshold: 0.45,
            prefix_padding_ms: 250,
            silence_duration_ms: 450,
            create_response: true,
            interrupt_response: false,
          },
          transcription: {
            model: "gpt-4o-mini-transcribe",
            language: "en",
            prompt: "Vanguard investing products and services. If the speaker says VG or V G in a meeting recap, interpret it as Vanguard when context is about products, materials, outlook, funds, webinars, or follow-up actions. Preserve official terms such as Vanguard Digital Advisor, Vanguard Personal Advisor, Roth IRA, Traditional IRA, SEP-IRA, 403(b), Individual 401(k), UGMA/UTMA, 529 account, CRSP, FTSE, Admiral Shares, Investor Shares, ETF, NAV, SEC yield, RMD, APY, FDIC, REIT, VOO, VTI, VTSAX, BND, VBTLX, VXUS, VTIAX, VT, VMFXX, VTINX, VTTHX, VSVNX, VASIX, VSMGX, VWELX, VWINX, VPMCX, VNQ, VUG, VTV, VIG. Likely follow-up phrases include market outlook email, fund comparison, webinar invite, practice management, action items, next steps, owner, due date.",
          },
        },
      },
    };

    const realtimeSession = await createOpenAIRealtimeSession(offerSdp, sessionPayload);

    return res.json(realtimeSession);
  } catch (err) {
    console.error("Follow Me session error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
