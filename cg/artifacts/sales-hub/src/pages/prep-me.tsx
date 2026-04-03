import { useEffect, useRef, useState } from "react";
import { Layout } from "@/components/layout";
import { useMeetings } from "@/hooks/use-meetings";
import { resolveApiUrl } from "@/lib/api-url";
import { useAgentPrepMe } from "@/hooks/use-agents";
import { useVoiceRecorder } from "@workspace/integrations-openai-ai-react";
import type { Meeting } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  FileText,
  Calendar as CalendarIcon,
  Users,
  ListChecks,
  MessageSquare,
  AlertCircle,
  ArrowRight,
  BrainCircuit,
  Building2,
  CalendarPlus,
  Download,
  Mail,
  Mic,
  MapPin,
  Square,
  TrendingDown,
  TrendingUp,
  Volume2,
  Radio,
  PhoneCall,
  PhoneOff,
  MicOff,
} from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useRealtimeCall } from "@/hooks/use-realtime-call";
import type { AgendaArticleSelection } from "@/hooks/use-realtime-call";

type VoicePhase = "idle" | "recording" | "processing" | "done" | "error";
type PrepViewMode = "brief" | "realtime";
type CallStatus = "idle" | "connecting" | "active" | "ended";

interface PrepResult {
  agenda: string[];
  talkingPoints: string[];
  clientBackground: string;
  keyObjections: string[];
}

interface TranscriptLine {
  id: string;
  speaker: "agent" | "user";
  text: string;
  partial?: boolean;
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

interface PrepLeadResponse {
  assets?: string;
  location?: string | null;
  aum?: string | null;
  reason?: string;
}

interface AgendaTopic {
  title: string;
  detail: string;
}

interface AgendaArticlePlaceholder {
  title: string;
  url: string;
  topic: string;
}

interface ArticleCatalogEntry extends AgendaArticleSelection {
  topic: string;
}

const AGENDA_TEAM_MEMBERS = [
  {
    name: "Nat",
    email: "nat@kpmg.com",
    phone: "231-415-6678",
    role: "Relationship Lead",
  },
];

const EMPTY_AGENDA_ARTICLE_SLOTS: AgendaArticlePlaceholder[] = Array.from({ length: 3 }, () => ({
  title: "",
  url: "",
  topic: "",
}));

const PREP_ARTICLE_CATALOG: ArticleCatalogEntry[] = [
  {
    title: "Fixed income in focus: Why bonds still belong in a diversified portfolio",
    url: "https://www.capitalgroup.com/advisor/insights/articles/fixed-income-diversification.html",
    topic: "Active fixed income",
  },
  {
    title: "Capital Group Core Plus Income ETF (CGCP): Active fixed income in an ETF wrapper",
    url: "https://www.capitalgroup.com/advisor/etfs/cgcp.html",
    topic: "Active fixed income",
  },
  {
    title: "Active vs. passive in fixed income: The case for active management",
    url: "https://www.capitalgroup.com/advisor/insights/articles/active-vs-passive-fixed-income.html",
    topic: "Active fixed income",
  },
  {
    title: "Navigating rate uncertainty: What rising yields mean for bond investors",
    url: "https://www.capitalgroup.com/advisor/insights/articles/rising-rates-bond-investors.html",
    topic: "Active fixed income",
  },
  {
    title: "Building a resilient portfolio with bonds",
    url: "https://www.capitalgroup.com/advisor/insights/articles/resilient-portfolio-bonds.html",
    topic: "Active fixed income",
  },
  {
    title: "Capital Group 2026 outlook: Navigating uncertainty with conviction",
    url: "https://www.capitalgroup.com/advisor/insights/articles/2026-investment-outlook.html",
    topic: "Market outlook",
  },
  {
    title: "U.S. economic outlook: Growth, employment, and inflation in 2025",
    url: "https://www.capitalgroup.com/advisor/insights/articles/us-economic-outlook-2025.html",
    topic: "Market outlook",
  },
  {
    title: "Trade shock response: Capital Group updates its economic forecast",
    url: "https://www.capitalgroup.com/advisor/insights/articles/trade-policy-economic-update.html",
    topic: "Market outlook",
  },
  {
    title: "Staying the course: Perspective for volatile markets",
    url: "https://www.capitalgroup.com/advisor/insights/articles/volatile-markets-perspective.html",
    topic: "Market outlook",
  },
  {
    title: "Federal Reserve policy shift: Implications for investors",
    url: "https://www.capitalgroup.com/advisor/insights/articles/fed-policy-shift-implications.html",
    topic: "Market outlook",
  },
  {
    title: "Portfolio rebalancing: When and how to rebalance",
    url: "https://www.capitalgroup.com/advisor/insights/articles/portfolio-rebalancing.html",
    topic: "Portfolio management",
  },
  {
    title: "The case for diversification in uncertain markets",
    url: "https://www.capitalgroup.com/advisor/insights/articles/diversification-uncertain-markets.html",
    topic: "Portfolio management",
  },
  {
    title: "Tax-smart investing: Asset location strategies",
    url: "https://www.capitalgroup.com/advisor/insights/articles/asset-location-tax-strategy.html",
    topic: "Portfolio management",
  },
  {
    title: "Choosing the right financial advisor: A guide for investors",
    url: "https://www.capitalgroup.com/advisor/insights/articles/choosing-financial-advisor.html",
    topic: "Portfolio management",
  },
  {
    title: "Simplifying your financial life: The case for account consolidation",
    url: "https://www.capitalgroup.com/advisor/insights/articles/account-consolidation.html",
    topic: "Portfolio management",
  },
];

const PREP_COMPETITOR_COMPARISON_PAIRS = [
  { vanguardFund: "CGCP", competitorFund: "BINC", label: "BINC vs CGCP" },
  { vanguardFund: "CGCP", competitorFund: "JAAA", label: "JAAA vs CGCP" },
  { vanguardFund: "CGUS", competitorFund: "IVV", label: "IVV vs CGUS" },
  { vanguardFund: "CGUS", competitorFund: "SCHX", label: "SCHX vs CGUS" },
  { vanguardFund: "CGGR", competitorFund: "IWF", label: "IWF vs CGGR" },
  { vanguardFund: "CGGR", competitorFund: "SCHG", label: "SCHG vs CGGR" },
  { vanguardFund: "CGXU", competitorFund: "IEFA", label: "IEFA vs CGXU" },
  { vanguardFund: "CGXU", competitorFund: "EFA", label: "EFA vs CGXU" },
  { vanguardFund: "CGDV", competitorFund: "SCHD", label: "SCHD vs CGDV" },
  { vanguardFund: "CGDV", competitorFund: "VIG", label: "VIG vs CGDV" },
] as const;

function parseLeadAdvisorData(assets?: string): PrepLeadAdvisorData | null {
  if (!assets) return null;

  try {
    const parsed = JSON.parse(assets) as { __advisorData?: PrepLeadAdvisorData };
    return parsed.__advisorData ?? null;
  } catch {
    return null;
  }
}

function appendTranscriptLine(
  prev: TranscriptLine[],
  speaker: "agent" | "user",
  text: string,
  partial: boolean,
): TranscriptLine[] {
  const trimmedText = text.replace(/\s+/g, " ").trim();
  if (!trimmedText) return prev;

  const lastLine = prev[prev.length - 1];
  if (lastLine?.speaker === speaker && lastLine.partial) {
    if (lastLine.text.trim() === trimmedText) return prev;
    const updated = [...prev];
    updated[updated.length - 1] = { ...lastLine, text: trimmedText, partial };
    return updated;
  }

  if (lastLine?.speaker === speaker && !lastLine.partial) {
    const lastText = lastLine.text.replace(/\s+/g, " ").trim().toLowerCase();
    const nextText = trimmedText.toLowerCase();
    if (
      lastText === nextText ||
      lastText.startsWith(nextText) ||
      nextText.startsWith(lastText)
    ) {
      if (partial) {
        const updated = [...prev];
        updated[updated.length - 1] = { ...lastLine, text: trimmedText, partial };
        return updated;
      }
      return prev;
    }
  }

  return [...prev, { id: crypto.randomUUID(), speaker, text: trimmedText, partial }];
}

function formatCompactMoney(value?: number, fallback = "N/A"): string {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) return fallback;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
  return `$${Math.round(value)}`;
}

function cleanTerritory(territory?: string): string {
  return (territory ?? "").replace(/^(XC|FC)\s*-\s*/i, "").trim();
}

function pickCompetitorComparisonPair(competitors?: string[]): (typeof PREP_COMPETITOR_COMPARISON_PAIRS)[number] {
  const joined = (competitors ?? []).join(" ").toUpperCase();

  const pairByTicker = PREP_COMPETITOR_COMPARISON_PAIRS.find((pair) =>
    joined.includes(pair.competitorFund),
  );
  if (pairByTicker) return pairByTicker;

  if (joined.includes("BLACKROCK")) return PREP_COMPETITOR_COMPARISON_PAIRS[0];
  if (joined.includes("SCHWAB")) return PREP_COMPETITOR_COMPARISON_PAIRS[3];
  if (joined.includes("ISHARES")) return PREP_COMPETITOR_COMPARISON_PAIRS[0];

  return PREP_COMPETITOR_COMPARISON_PAIRS[0];
}

function firstUsefulSnippet(text?: string): string {
  if (!text) return "";

  const parts = text
    .split("|")
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  for (const part of parts) {
    if (!/^(personal and general information|investment discussion|most recent follow-ups|client profile|sales engagement|vanguard opportunity focus|recent sales narrative|next action)$/i.test(part)) {
      return part;
    }
  }

  return parts[0] ?? "";
}

function buildAgendaTopics(meeting: Meeting, advisorData: PrepLeadAdvisorData | null, lead?: PrepLeadResponse | null): AgendaTopic[] {
  const topics: AgendaTopic[] = [];
  const topOpportunity =
    (advisorData?.etfOpportunities ?? 0) >= (advisorData?.fiOpportunities ?? 0)
      ? {
          title: "ETF Opportunity Review",
          detail: `Review ETF opportunity of ${formatCompactMoney(advisorData?.etfOpportunities)} and where Capital Group should lead.`,
        }
      : {
          title: "Fixed Income Opportunity Review",
          detail: `Review fixed income opportunity of ${formatCompactMoney(advisorData?.fiOpportunities)} and where Capital Group should lead.`,
        };

  topics.push({
    title: "Meeting Objective",
    detail: meeting.purpose,
  });

  if ((advisorData?.fiOpportunities ?? 0) > 0 || (advisorData?.etfOpportunities ?? 0) > 0) {
    topics.push(topOpportunity);
  }

  if (advisorData?.competitors?.length) {
    topics.push({
      title: "Competitive Positioning",
      detail: `Prepare differentiation against ${advisorData.competitors.slice(0, 2).join(" and ")} in the current book.`,
    });
  }

  return topics.slice(0, 4);
}

function applyAgendaArticleSelection(
  existing: AgendaArticlePlaceholder[],
  article: AgendaArticleSelection,
): AgendaArticlePlaceholder[] {
  const next = existing.map((item) => ({ ...item }));
  const normalizedTitle = article.title.trim().toLowerCase();
  const normalizedUrl = article.url.trim().toLowerCase();
  const entry: AgendaArticlePlaceholder = {
    title: article.title.trim(),
    url: article.url.trim(),
    topic: article.topic?.trim() || "Seismic article",
  };

  if (!entry.title || !entry.url) return next;

  const duplicateIndex = next.findIndex((item) =>
    (item.title && item.title.trim().toLowerCase() === normalizedTitle) ||
    (item.url && item.url.trim().toLowerCase() === normalizedUrl),
  );
  if (duplicateIndex >= 0) {
    next[duplicateIndex] = entry;
    return next;
  }

  const preferredIndex =
    typeof article.slot === "number" && article.slot >= 1 && article.slot <= next.length
      ? article.slot - 1
      : next.findIndex((item) => !item.title);

  const targetIndex = preferredIndex >= 0 ? preferredIndex : next.length - 1;
  next[targetIndex] = entry;
  return next;
}

function detectRecommendedArticles(text: string): ArticleCatalogEntry[] {
  const normalized = text.toLowerCase();
  return PREP_ARTICLE_CATALOG.filter((article) => normalized.includes(article.title.toLowerCase()));
}

function resolveAgendaAddRequest(
  utterance: string,
  recommendations: ArticleCatalogEntry[],
): ArticleCatalogEntry[] {
  const normalized = utterance.toLowerCase();
  const directMatches = PREP_ARTICLE_CATALOG.filter((article) => normalized.includes(article.title.toLowerCase()));

  if (directMatches.length) return directMatches;
  if (!recommendations.length) return [];

  if (/\b(all|them|those|articles)\b/.test(normalized)) {
    return recommendations;
  }
  if (/\b(second|2nd|two)\b/.test(normalized)) {
    return recommendations[1] ? [recommendations[1]] : [];
  }
  if (/\b(third|3rd|three)\b/.test(normalized)) {
    return recommendations[2] ? [recommendations[2]] : [];
  }
  if (/\b(first|1st|one|it)\b/.test(normalized)) {
    return recommendations[0] ? [recommendations[0]] : [];
  }

  return recommendations[0] ? [recommendations[0]] : [];
}

function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function buildAgendaText(
  meeting: Meeting,
  lead: PrepLeadResponse | null,
  advisorData: PrepLeadAdvisorData | null,
  topics: AgendaTopic[],
  agendaArticles: AgendaArticlePlaceholder[],
): string {
  const activeAgendaArticles = agendaArticles.filter((article) => article.title && article.url);
  const lines = [
    `Advisor: ${meeting.leadName}`,
    `Firm: ${meeting.leadCompany}`,
    `Location: ${lead?.location || cleanTerritory(advisorData?.territory) || "N/A"}`,
    `Meeting Date: ${format(new Date(meeting.scheduledAt), "MMMM d, yyyy 'at' h:mm a")}`,
    `Meeting Objective: ${meeting.purpose}`,
    "",
    "Advisor Snapshot",
    `- Segment: ${advisorData?.segment || "N/A"}`,
    `- Buying Unit: ${advisorData?.buyingUnit || "N/A"}`,
    `- Territory: ${advisorData?.territory || lead?.location || "N/A"}`,
    "",
    "Assets Overview",
    `- AUM: ${formatCompactMoney((advisorData?.aumM ?? 0) * 1_000_000, lead?.aum ?? "N/A")}`,
    `- Sales: ${formatCompactMoney(advisorData?.salesAmt)}`,
    `- Redemptions: ${formatCompactMoney(advisorData?.redemption)}`,
    "",
    "Topics For Discussion",
    ...topics.map((topic) => `- ${topic.title}: ${topic.detail}`),
    "",
    "Team Members",
    ...AGENDA_TEAM_MEMBERS.map((member) => `- ${member.name} | ${member.role} | ${member.email} | ${member.phone}`),
  ];

  if (activeAgendaArticles.length) {
    lines.splice(
      lines.length - (2 + AGENDA_TEAM_MEMBERS.length),
      0,
      "",
      "Articles To Share",
      ...activeAgendaArticles.map((article) => `- ${article.title} | ${article.url}`),
    );
  }

  return lines.join("\n");
}

function formatIcsDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

export default function PrepMe() {
  const { data: meetingsData, isLoading: meetingsLoading } = useMeetings();
  const { mutate: generatePrep, isPending, data: hookPrepData } = useAgentPrepMe();
  const { toast } = useToast();

  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [voicePrepData, setVoicePrepData] = useState<PrepResult | null>(null);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voicePhase, setVoicePhase] = useState<VoicePhase>("idle");
  const [viewMode, setViewMode] = useState<PrepViewMode>("brief");
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [realtimeTranscript, setRealtimeTranscript] = useState<TranscriptLine[]>([]);
  const [selectedLead, setSelectedLead] = useState<PrepLeadResponse | null>(null);
  const [agendaArticles, setAgendaArticles] = useState<AgendaArticlePlaceholder[]>(() => EMPTY_AGENDA_ARTICLE_SLOTS.map((item) => ({ ...item })));
  const [recommendedArticles, setRecommendedArticles] = useState<ArticleCatalogEntry[]>([]);
  const realtimeTranscriptEndRef = useRef<HTMLDivElement | null>(null);

  const { state: recorderState, startRecording, stopRecording } = useVoiceRecorder();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const {
    agentSpeaking,
    isMuted,
    startCall: startRealtimeCall,
    endCall: endRealtimeCall,
    toggleMute,
  } = useRealtimeCall({
    playbackWorkletPath: `${import.meta.env.BASE_URL}audio-playback-worklet.js`,
    captureWorkletPath: `${import.meta.env.BASE_URL}audio-capture-worklet.js`,
    onUserTranscriptDelta: (_delta, accumulated) => {
      setRealtimeTranscript((prev) => appendTranscriptLine(prev, "user", accumulated, true));
    },
    onUserTranscript: (text) => {
      setRealtimeTranscript((prev) => appendTranscriptLine(prev, "user", text, false));
      if (/\b(add|include|put|save)\b/.test(text.toLowerCase()) && /\bagenda\b/.test(text.toLowerCase())) {
        const toAdd = resolveAgendaAddRequest(text, recommendedArticles);
        if (toAdd.length) {
          setAgendaArticles((prev) => {
            let next = prev;
            for (const article of toAdd) {
              next = applyAgendaArticleSelection(next, article);
            }
            return next;
          });
          toast({
            title: "Agenda updated",
            description:
              toAdd.length === 1
                ? `Added "${toAdd[0].title}" to the agenda.`
                : `Added ${toAdd.length} articles to the agenda.`,
          });
        }
      }
    },
    onAgentTranscriptDelta: (_delta, accumulated) => {
      setRealtimeTranscript((prev) => appendTranscriptLine(prev, "agent", accumulated, true));
    },
    onAgentResponseDone: (text) => {
      setRealtimeTranscript((prev) => appendTranscriptLine(prev, "agent", text, false));
      const detected = detectRecommendedArticles(text);
      if (detected.length) {
        setRecommendedArticles(detected);
      }
    },
    onAgendaArticleAdded: (article) => {
      setAgendaArticles((prev) => applyAgendaArticleSelection(prev, article));
      toast({
        title: "Agenda updated",
        description: `Added "${article.title}" to the agenda.`,
      });
    },
    onError: (error) => {
      console.error("Prep realtime error:", error);
      toast({ title: "My Prep call error", description: error.message, variant: "destructive" });
    },
    onConnectionStateChange: (state) => {
      if (state === "connecting") setCallStatus("connecting");
      else if (state === "connected") setCallStatus("active");
      else if (state === "disconnected" || state === "error") setCallStatus("ended");
    },
  });

  const allScheduled = meetingsData?.meetings?.filter((m) => m.status === "scheduled") || [];
  const byLead = new Map<string, Meeting>();
  for (const meeting of allScheduled) {
    const existing = byLead.get(meeting.leadId);
    if (!existing || new Date(meeting.scheduledAt) < new Date(existing.scheduledAt)) {
      byLead.set(meeting.leadId, meeting);
    }
  }

  const meetings = Array.from(byLead.values()).sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
  );
  const selectedMeeting = meetings.find((meeting) => meeting.id === selectedMeetingId);
  const selectedAdvisorData = parseLeadAdvisorData(selectedLead?.assets);
  const agendaTopics = (selectedMeeting ? buildAgendaTopics(selectedMeeting, selectedAdvisorData, selectedLead) : []).map((topic) => (
    topic.title === "Competitive Positioning"
      ? {
          ...topic,
          detail: topic.detail
            ? topic.detail.replace(
                /^Prepare differentiation/i,
                `Use ${pickCompetitorComparisonPair(selectedAdvisorData?.competitors).label} talking points and differentiate`,
              )
            : `Use ${pickCompetitorComparisonPair(selectedAdvisorData?.competitors).label} talking points for competitive positioning.`,
        }
      : topic
  ));
  const activeAgendaArticles = agendaArticles.filter((article) => article.title && article.url);
  const prepData = voicePrepData ?? (hookPrepData as PrepResult | undefined);
  const isRecording = recorderState === "recording";
  const isProcessing = voicePhase === "processing";

  useEffect(() => {
    realtimeTranscriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [realtimeTranscript]);

  useEffect(() => {
    setAgendaArticles(EMPTY_AGENDA_ARTICLE_SLOTS.map((item) => ({ ...item })));
    setRecommendedArticles([]);
  }, [selectedMeetingId]);

  useEffect(() => {
    if (!selectedMeeting?.leadId) {
      setSelectedLead(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch(resolveApiUrl(`/api/leads/${selectedMeeting.leadId}`));
        if (!response.ok) {
          if (!cancelled) setSelectedLead(null);
          return;
        }

        const lead = await response.json() as PrepLeadResponse;
        if (!cancelled) setSelectedLead(lead);
      } catch {
        if (!cancelled) setSelectedLead(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedMeeting?.leadId]);

  const handleManualGenerate = (meeting: Meeting) => {
    setSelectedMeetingId(meeting.id);
    setVoicePrepData(null);
    generatePrep({
      data: {
        meetingId: meeting.id,
        leadName: meeting.leadName,
        leadCompany: meeting.leadCompany,
        meetingDate: meeting.scheduledAt,
        meetingPurpose: meeting.purpose,
      },
    });
  };

  const handleMeetingSelect = (meeting: Meeting) => {
    if (viewMode === "brief") {
      handleManualGenerate(meeting);
      return;
    }
    setSelectedMeetingId(meeting.id);
  };

  const handleViewModeChange = (nextMode: PrepViewMode) => {
    if (nextMode === viewMode) return;
    if (viewMode === "realtime") {
      endRealtimeCall();
      setCallStatus("idle");
    }
    setViewMode(nextMode);
  };

  const handleStartRealtime = async () => {
    if (!selectedMeeting) return;

    setRealtimeTranscript([]);
    setCallStatus("connecting");

    let leadAssets: string | undefined;
    try {
      const leadRes = await fetch(resolveApiUrl(`/api/leads/${selectedMeeting.leadId}`));
      if (leadRes.ok) {
        const lead = await leadRes.json() as PrepLeadResponse;
        const advisorData = parseLeadAdvisorData(lead.assets);
        leadAssets = advisorData ? lead.assets : undefined;
      }
    } catch (error) {
      console.warn("Prep Me lead context fetch failed:", error);
    }

    await startRealtimeCall(
      {
        advisorName: selectedMeeting.leadName,
        advisorCompany: selectedMeeting.leadCompany,
        meetingPurpose: selectedMeeting.purpose,
        leadAssets,
      },
      {
        sessionPath: "/api/realtime/prep-session",
        initialResponse: {
          output_modalities: ["text", "audio"],
          instructions: `Greet the salesperson briefly, say you're ready to answer any question about ${selectedMeeting.leadName}, and keep the opener to 1-2 sentences.`,
        },
      },
    );
  };

  const handleEndRealtime = () => {
    endRealtimeCall();
    setCallStatus("ended");
  };

  const handleVoicePrep = async () => {
    if (recorderState === "idle" || recorderState === "stopped") {
      try {
        setVoicePhase("recording");
        setVoiceTranscript("");
        setVoicePrepData(null);
        await startRecording();
      } catch {
        setVoicePhase("error");
        toast({ title: "Microphone error", description: "Could not access your microphone.", variant: "destructive" });
      }
      return;
    }

    if (recorderState !== "recording") return;

    const blob = await stopRecording();
    setVoicePhase("processing");

    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(",")[1];
      const meetingsList = meetings.map((meeting) => ({
        id: meeting.id,
        leadName: meeting.leadName,
        leadCompany: meeting.leadCompany,
        scheduledAt: meeting.scheduledAt,
        purpose: meeting.purpose,
      }));

      try {
        const res = await fetch(resolveApiUrl("/api/agents/prep-me/voice"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audio: base64, meetings: meetingsList }),
        });
        if (!res.ok) throw new Error("Voice prep failed");

        const data = await res.json();
        setVoiceTranscript(data.transcript ?? "");
        if (data.matchedMeetingId) {
          setSelectedMeetingId(data.matchedMeetingId);
          setVoicePrepData({
            agenda: data.agenda ?? [],
            talkingPoints: data.talkingPoints ?? [],
            clientBackground: data.clientBackground ?? "",
            keyObjections: data.keyObjections ?? [],
          });
        } else {
          toast({
            title: "No matching meeting found",
            description: "Try saying the client's name more clearly, or tap a meeting manually.",
            variant: "destructive",
          });
        }

        if (data.audioBase64) {
          const audio = new Audio(`data:audio/mp3;base64,${data.audioBase64}`);
          audioRef.current = audio;
          audio.play().catch(() => {});
        }

        setVoicePhase("done");
      } catch {
        setVoicePhase("error");
        toast({ title: "Voice Error", description: "Could not process your voice request.", variant: "destructive" });
      }
    };
  };

  const handleEmailAgenda = () => {
    if (!selectedMeeting) return;

    const subject = encodeURIComponent(`Prep Agenda: ${selectedMeeting.leadName} - ${selectedMeeting.leadCompany}`);
    const body = encodeURIComponent(buildAgendaText(selectedMeeting, selectedLead, selectedAdvisorData, agendaTopics, agendaArticles));
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleDownloadAgenda = () => {
    if (!selectedMeeting) return;

    const agendaText = buildAgendaText(selectedMeeting, selectedLead, selectedAdvisorData, agendaTopics, agendaArticles);
    const filename = `${selectedMeeting.leadName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-agenda.txt`;
    downloadFile(filename, agendaText, "text/plain;charset=utf-8");
  };

  const handleAddToCalendar = () => {
    if (!selectedMeeting) return;

    const start = new Date(selectedMeeting.scheduledAt);
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    const description = buildAgendaText(selectedMeeting, selectedLead, selectedAdvisorData, agendaTopics, agendaArticles)
      .replace(/\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
    const location = (selectedLead?.location || cleanTerritory(selectedAdvisorData?.territory) || "TBD")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
    const summary = `My Prep: ${selectedMeeting.leadName} - ${selectedMeeting.leadCompany}`;
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Sales Navigator//Prep Me Agenda//EN",
      "BEGIN:VEVENT",
      `UID:${selectedMeeting.id}@sales-navigator`,
      `DTSTAMP:${formatIcsDate(new Date())}`,
      `DTSTART:${formatIcsDate(start)}`,
      `DTEND:${formatIcsDate(end)}`,
      `SUMMARY:${summary}`,
      `LOCATION:${location}`,
      `DESCRIPTION:${description}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const filename = `${selectedMeeting.leadName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-agenda.ics`;
    downloadFile(filename, ics, "text/calendar;charset=utf-8");
  };

  return (
    <Layout>
      <div className="mx-auto max-w-6xl space-y-8 pb-12">
        <div className="mb-8 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-indigo-400/20 bg-indigo-400/10">
            <FileText className="h-6 w-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-white">My Prep</h1>
            <p className="text-muted-foreground">Generate comprehensive briefs for upcoming meetings.</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant={viewMode === "brief" ? "default" : "outline"}
            className={cn(
              "gap-2",
              viewMode === "brief"
                ? "bg-indigo-500 text-white hover:bg-indigo-400"
                : "border-white/10 text-white hover:bg-white/5",
            )}
            onClick={() => handleViewModeChange("brief")}
          >
            <FileText className="h-4 w-4" />
            Brief
          </Button>
          <Button
            variant={viewMode === "realtime" ? "default" : "outline"}
            className={cn(
              "gap-2",
              viewMode === "realtime"
                ? "bg-indigo-500 text-white hover:bg-indigo-400"
                : "border-white/10 text-white hover:bg-white/5",
            )}
            onClick={() => handleViewModeChange("realtime")}
          >
            <Radio className="h-4 w-4" />
            Realtime Agent
          </Button>
        </div>

        <div className="grid items-start gap-8 lg:grid-cols-[350px_1fr]">
          <div className="sticky top-24 space-y-4">
            {viewMode === "brief" ? (
              <Card className="border border-indigo-500/20 bg-indigo-500/5">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-indigo-300">
                    <Mic className="h-4 w-4" /> Voice Prep
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Say a client name to auto-prep, e.g. <span className="italic text-indigo-300">"Prep me for Miguel, focus on ESG"</span>
                  </p>

                  <div className="flex flex-col items-center gap-4 py-2">
                    <button
                      onClick={handleVoicePrep}
                      disabled={isProcessing || meetingsLoading}
                      className={cn(
                        "relative flex h-16 w-16 items-center justify-center rounded-full transition-all focus:outline-none",
                        isRecording
                          ? "animate-pulse bg-red-500 shadow-[0_0_0_8px_rgba(239,68,68,0.15),0_0_0_16px_rgba(239,68,68,0.07)]"
                          : isProcessing
                          ? "cursor-wait border-2 border-indigo-500/30 bg-indigo-500/20"
                          : voicePhase === "done"
                          ? "border-2 border-indigo-500/40 bg-indigo-500/20 hover:bg-indigo-500/30"
                          : "border-2 border-indigo-500/30 bg-indigo-500/10 hover:border-indigo-500/50 hover:bg-indigo-500/20"
                      )}
                    >
                      {isProcessing ? (
                        <Loader2 className="h-7 w-7 animate-spin text-indigo-400" />
                      ) : isRecording ? (
                        <Square className="h-7 w-7 fill-white text-white" />
                      ) : voicePhase === "done" ? (
                        <Volume2 className="h-7 w-7 text-indigo-400" />
                      ) : (
                        <Mic className="h-7 w-7 text-indigo-400" />
                      )}
                    </button>

                    <p className="text-center text-xs">
                      {isRecording ? (
                        <span className="flex items-center justify-center gap-1.5 text-red-400">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" /> Recording, tap to stop
                        </span>
                      ) : isProcessing ? (
                        <span className="text-indigo-400">Transcribing and generating...</span>
                      ) : voicePhase === "done" ? (
                        <span className="text-indigo-400">Brief ready</span>
                      ) : (
                        <span className="text-muted-foreground">Tap mic to start</span>
                      )}
                    </p>
                  </div>

                  {voiceTranscript ? (
                    <div className="rounded-lg border border-indigo-500/15 bg-indigo-500/5 p-3">
                      <p className="mb-1 text-xs font-medium text-indigo-400">Heard:</p>
                      <p className="text-xs italic text-white/70">"{voiceTranscript}"</p>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ) : selectedMeeting ? (
              <Card className="overflow-hidden border border-red-950/20 bg-[#fff9f7] text-slate-900 shadow-[0_20px_60px_rgba(80,0,0,0.18)]">
                <div
                  className="border-b border-red-950/10 px-5 py-5 text-white"
                  style={{
                    background:
                      "radial-gradient(circle at 12px 12px, rgba(255,255,255,0.08) 2px, transparent 2px), linear-gradient(135deg, #7f0d0d 0%, #991b1b 55%, #b91c1c 100%)",
                    backgroundSize: "24px 24px, auto",
                  }}
                >
                  <div className="space-y-1">
                    <h2 className="text-3xl font-display font-bold leading-tight">{selectedMeeting.leadName}</h2>
                    <p className="text-lg font-semibold text-white/95">{selectedMeeting.leadCompany}</p>
                  </div>
                  <div className="mt-4 space-y-2 text-sm text-white/85">
                    <div className="flex items-start gap-2">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{selectedLead?.location || cleanTerritory(selectedAdvisorData?.territory) || "Location not available"}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CalendarIcon className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{format(new Date(selectedMeeting.scheduledAt), "MMMM d, yyyy 'at' h:mm a")}</span>
                    </div>
                  </div>
                </div>

                <CardContent className="space-y-5 p-5">
                  <div>
                    <p className="text-sm font-semibold text-red-900">Meeting Objective</p>
                    <div className="mt-2 rounded-xl border border-red-100 bg-white px-4 py-3 text-sm leading-relaxed text-slate-700 shadow-sm">
                      {selectedMeeting.purpose}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-red-900">Advisor Snapshot</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg border border-red-100 bg-white p-3 shadow-sm">
                        <div className="flex items-center gap-2 font-semibold text-slate-800">
                          <Building2 className="h-3.5 w-3.5 text-red-700" />
                          Segment
                        </div>
                        <p className="mt-1 text-slate-600">{selectedAdvisorData?.segment || "N/A"}</p>
                      </div>
                      <div className="rounded-lg border border-red-100 bg-white p-3 shadow-sm">
                        <div className="flex items-center gap-2 font-semibold text-slate-800">
                          <Users className="h-3.5 w-3.5 text-red-700" />
                          Buying Unit
                        </div>
                        <p className="mt-1 text-slate-600">{selectedAdvisorData?.buyingUnit || "N/A"}</p>
                      </div>
                      <div className="col-span-2 rounded-lg border border-red-100 bg-white p-3 shadow-sm">
                        <div className="flex items-center gap-2 font-semibold text-slate-800">
                          <MapPin className="h-3.5 w-3.5 text-red-700" />
                          Territory
                        </div>
                        <p className="mt-1 text-slate-600">{selectedAdvisorData?.territory || selectedLead?.location || "N/A"}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-red-900">Assets Overview</p>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg bg-gradient-to-br from-red-900 to-red-700 px-2 py-3 text-white shadow-sm">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-white/75">AUM</p>
                        <p className="mt-1 text-base font-bold">{formatCompactMoney((selectedAdvisorData?.aumM ?? 0) * 1_000_000, selectedLead?.aum ?? "N/A")}</p>
                      </div>
                      <div className="rounded-lg bg-gradient-to-br from-red-900 to-red-700 px-2 py-3 text-white shadow-sm">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-white/75">Sales</p>
                        <p className="mt-1 text-base font-bold">{formatCompactMoney(selectedAdvisorData?.salesAmt)}</p>
                      </div>
                      <div className="rounded-lg bg-gradient-to-br from-red-900 to-red-700 px-2 py-3 text-white shadow-sm">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-white/75">Redemptions</p>
                        <p className="mt-1 text-base font-bold">{formatCompactMoney(selectedAdvisorData?.redemption)}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-red-900">Topics For Discussion</p>
                    <div className="mt-2 space-y-3 border-t border-red-100 pt-3">
                      {agendaTopics.length ? (
                        agendaTopics.map((topic, index) => (
                          <div key={`${topic.title}-${index}`} className="flex gap-3">
                            <div className="pt-1 text-red-700">
                              {index === 1 ? <TrendingUp className="h-4 w-4" /> : index === 2 ? <TrendingDown className="h-4 w-4" /> : <span className="block h-2 w-2 rounded-full bg-red-700" />}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-800">{topic.title}</p>
                              <p className="text-xs leading-relaxed text-slate-600">{topic.detail}</p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs leading-relaxed text-slate-600">
                          Select a meeting to load advisor context and discussion topics.
                        </p>
                      )}
                    </div>
                  </div>

                  {activeAgendaArticles.length ? (
                    <div>
                      <p className="text-sm font-semibold text-red-900">Articles To Share</p>
                      <div className="mt-2 space-y-3 border-t border-red-100 pt-3">
                        {activeAgendaArticles.map((article) => (
                          <div
                            key={`${article.title}-${article.url}`}
                            className="rounded-xl border border-red-100 bg-white p-3 shadow-sm"
                          >
                            <p className="text-sm font-semibold text-slate-800">{article.title}</p>
                            <p className="mt-1 text-xs text-slate-500">{article.topic || "Seismic article"}</p>
                            <a
                              href={article.url}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-2 inline-block text-xs font-medium text-red-700 underline-offset-2 hover:underline"
                            >
                              {article.url}
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div>
                    <p className="text-sm font-semibold text-red-900">Team Members</p>
                    <div className="mt-2 space-y-3 border-t border-red-100 pt-3">
                      {AGENDA_TEAM_MEMBERS.map((member) => (
                        <div
                          key={member.email}
                          className="rounded-xl border border-red-100 bg-white p-4 shadow-sm"
                        >
                          <p className="text-sm font-semibold text-slate-800">{member.name}</p>
                          <p className="text-xs text-slate-500">{member.role}</p>
                          <div className="mt-2 space-y-1 text-xs text-slate-600">
                            <p>{member.email}</p>
                            <p>{member.phone}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                    {callStatus === "active"
                      ? "Realtime prep is live. Use the transcript on the right while this agenda stays pinned."
                      : "Agenda ready. Start the realtime session when you want live Q&A."}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border border-indigo-500/20 bg-indigo-500/5">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-indigo-300">
                    <Radio className="h-4 w-4" /> Realtime Prep Agent
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Select a meeting, then ask anything about the advisor. My Prep answers from the full dataset row, including sales notes, profile, engagement context, AUM, opportunities, and territory details.
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-white/80">
                      Ask about fit, flows, segment, territory, competitor mentions, or what angle to lead with.
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-white/80">
                      Use follow-ups like "What is the key sales note?" or "How should I position Capital Group?"
                    </div>
                  </div>
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                    Choose a meeting below to load advisor context
                  </div>
                </CardContent>
              </Card>
            )}

            {viewMode === "realtime" && selectedMeeting ? (
              <Card className="border border-white/10 bg-card/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold uppercase tracking-wider text-white/80">
                    Agenda Options
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    type="button"
                    onClick={handleEmailAgenda}
                    className="h-auto w-full justify-start gap-2 rounded-xl px-4 py-3 text-left whitespace-normal bg-red-700 text-white hover:bg-red-600"
                  >
                    <Mail className="h-4 w-4 shrink-0" />
                    Email Agenda
                  </Button>
                  <Button
                    type="button"
                    onClick={handleAddToCalendar}
                    variant="outline"
                    className="h-auto w-full justify-start gap-2 rounded-xl px-4 py-3 text-left whitespace-normal border-red-200 bg-white text-red-800 hover:bg-red-50"
                  >
                    <CalendarPlus className="h-4 w-4 shrink-0" />
                    Add To Calendar
                  </Button>
                  <Button
                    type="button"
                    onClick={handleDownloadAgenda}
                    variant="outline"
                    className="h-auto w-full justify-start gap-2 rounded-xl px-4 py-3 text-left whitespace-normal border-red-200 bg-white text-red-800 hover:bg-red-50"
                  >
                    <Download className="h-4 w-4 shrink-0" />
                    Download Agenda
                  </Button>
                </CardContent>
              </Card>
            ) : null}

            <Card className="border-white/5 bg-card/40">
              <CardHeader>
                <CardTitle className="text-base text-white">
                  {viewMode === "brief" ? "Or tap a meeting" : "Select an advisor meeting"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {meetingsLoading ? (
                  <div className="flex justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : meetings.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">No scheduled meetings found.</div>
                ) : (
                  meetings.map((meeting) => (
                    <button
                      key={meeting.id}
                      onClick={() => handleMeetingSelect(meeting)}
                      className={cn(
                        "w-full rounded-xl border p-4 text-left transition-all",
                        selectedMeetingId === meeting.id
                          ? "border-indigo-500/30 bg-indigo-500/10 shadow-[0_0_15px_rgba(99,102,241,0.15)]"
                          : "border-white/5 bg-background/50 hover:border-white/15 hover:bg-secondary/50",
                      )}
                    >
                      <div className="mb-1 font-semibold text-white">{meeting.leadName}</div>
                      <div className="mb-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Users className="h-3.5 w-3.5" /> {meeting.leadCompany}
                      </div>
                      <div className="inline-flex items-center rounded-md bg-indigo-400/10 px-2 py-1 text-xs font-medium text-indigo-400">
                        <CalendarIcon className="mr-1.5 h-3 w-3" />
                        {format(new Date(meeting.scheduledAt), "MMM d, h:mm a")}
                      </div>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
          <div className="min-h-[500px]">
            {viewMode === "brief" ? (
              isPending && !voicePrepData ? (
                <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-white/5 border-dashed bg-card/20 p-12 text-center">
                  <Loader2 className="mb-6 h-12 w-12 animate-spin text-indigo-400" />
                  <h3 className="mb-2 text-xl font-semibold text-white">Synthesizing Brief...</h3>
                  <p className="max-w-sm text-muted-foreground">
                    Analyzing CRM data, recent news, and financial profiles to build your battle plan.
                  </p>
                </div>
              ) : !prepData ? (
                <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-white/5 border-dashed bg-card/20 p-12 text-center">
                  <FileText className="mb-4 h-16 w-16 text-muted-foreground/20" />
                  <p className="mb-3 text-lg text-muted-foreground">Select a meeting or use your voice to generate a prep brief.</p>
                  <p className="text-sm text-muted-foreground/60">Try: "Prep me for [client name], focus on [topic]"</p>
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-card/40 p-6">
                      <div>
                        <div className="mb-1 flex items-center gap-2">
                          <h2 className="text-2xl font-bold text-white">Brief: {selectedMeeting?.leadName}</h2>
                          {voicePrepData ? (
                            <span className="flex items-center gap-1 rounded-full border border-indigo-500/30 bg-indigo-500/20 px-2 py-0.5 text-xs text-indigo-300">
                              <Volume2 className="h-3 w-3" /> Voice generated
                            </span>
                          ) : null}
                        </div>
                        <p className="text-muted-foreground">{selectedMeeting?.purpose}</p>
                      </div>
                      <Button variant="outline" className="border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10">
                        Export PDF
                      </Button>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                      <Card className="border-white/5 bg-card/40 md:col-span-2">
                        <CardHeader className="border-b border-white/5 bg-background/30 pb-4">
                          <CardTitle className="flex items-center gap-2 text-lg text-white">
                            <Users className="h-5 w-5 text-indigo-400" /> Client Background
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                          <p className="text-[15px] leading-relaxed text-white/80">{prepData.clientBackground}</p>
                        </CardContent>
                      </Card>

                      <Card className="border-white/5 bg-card/40">
                        <CardHeader className="border-b border-white/5 bg-background/30 pb-4">
                          <CardTitle className="flex items-center gap-2 text-lg text-white">
                            <ListChecks className="h-5 w-5 text-teal-400" /> Proposed Agenda
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                          <ul className="space-y-3">
                            {prepData.agenda.map((item, index) => (
                              <li key={index} className="flex gap-3 text-white/80">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-400/10 text-xs font-bold text-teal-400">
                                  {index + 1}
                                </span>
                                <span className="mt-0.5">{item}</span>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>

                      <Card className="border-white/5 bg-card/40">
                        <CardHeader className="border-b border-white/5 bg-background/30 pb-4">
                          <CardTitle className="flex items-center gap-2 text-lg text-white">
                            <MessageSquare className="h-5 w-5 text-blue-400" /> Key Talking Points
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                          <ul className="list-disc space-y-3 pl-5">
                            {prepData.talkingPoints.map((item, index) => (
                              <li key={index} className="pl-1 leading-relaxed text-white/80 marker:text-blue-400">
                                {item}
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>

                      <Card className="border-white/5 border-l-4 border-l-rose-500 bg-card/40 md:col-span-2">
                        <CardHeader className="border-b border-white/5 bg-background/30 pb-4">
                          <CardTitle className="flex items-center gap-2 text-lg text-white">
                            <AlertCircle className="h-5 w-5 text-rose-500" /> Anticipated Objections
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                          <div className="grid gap-4 md:grid-cols-2">
                            {prepData.keyObjections.map((item, index) => (
                              <div
                                key={index}
                                className="rounded-xl border border-rose-500/10 bg-rose-500/5 p-4 text-sm leading-relaxed text-white/80"
                              >
                                {item}
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <motion.div
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      className="flex items-center justify-between gap-4 rounded-2xl border border-violet-500/25 bg-violet-500/5 p-5"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-400/10">
                          <BrainCircuit className="h-5 w-5 text-violet-400" />
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Next Step</p>
                          <p className="text-sm font-semibold text-white">My Coach - Practice objections and sharpen your pitch</p>
                        </div>
                      </div>
                      <Button asChild className="shrink-0 bg-violet-500 text-white shadow-lg shadow-violet-500/20 hover:bg-violet-400">
                        <Link href="/coach-me">
                          Launch <ArrowRight className="ml-1.5 h-4 w-4" />
                        </Link>
                      </Button>
                    </motion.div>
                  </motion.div>
                </AnimatePresence>
              )
            ) : !selectedMeeting ? (
              <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-white/5 border-dashed bg-card/20 p-12 text-center">
                <Radio className="mb-4 h-16 w-16 text-muted-foreground/20" />
                <p className="mb-3 text-lg text-muted-foreground">Select a meeting to start the realtime prep agent.</p>
                <p className="text-sm text-muted-foreground/60">
                  The agent will load the advisor&apos;s full dataset row and answer live questions.
                </p>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <Card className="overflow-hidden border-white/5 bg-card/40">
                  <CardHeader className="border-b border-white/5 bg-background/30">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-xl text-white">
                          <PhoneCall className="h-5 w-5 text-indigo-400" />
                          My Prep Realtime
                        </CardTitle>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Live advisor intelligence for {selectedMeeting.leadName} at {selectedMeeting.leadCompany}
                        </p>
                        <p className="mt-1 text-sm text-white/70">{selectedMeeting.purpose}</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <div
                          className={cn(
                            "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium",
                            callStatus === "active"
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                              : callStatus === "connecting"
                              ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                              : "border-white/10 bg-white/5 text-white/70",
                          )}
                        >
                          <span
                            className={cn(
                              "h-2 w-2 rounded-full",
                              callStatus === "active"
                                ? "bg-emerald-400"
                                : callStatus === "connecting"
                                ? "animate-pulse bg-amber-400"
                                : "bg-white/30",
                            )}
                          />
                          {callStatus === "active"
                            ? agentSpeaking ? "Agent speaking" : "Live and listening"
                            : callStatus === "connecting"
                            ? "Connecting"
                            : callStatus === "ended"
                            ? "Call ended"
                            : "Ready"}
                        </div>

                        {callStatus === "active" || callStatus === "connecting" ? (
                          <>
                            <Button
                              variant="outline"
                              className="border-white/10 text-white hover:bg-white/5"
                              onClick={toggleMute}
                            >
                              {isMuted ? <MicOff className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
                              {isMuted ? "Unmute" : "Mute"}
                            </Button>
                            <Button className="bg-rose-500 text-white hover:bg-rose-400" onClick={handleEndRealtime}>
                              <PhoneOff className="mr-2 h-4 w-4" />
                              End Session
                            </Button>
                          </>
                        ) : (
                          <Button className="bg-indigo-500 text-white hover:bg-indigo-400" onClick={handleStartRealtime}>
                            <PhoneCall className="mr-2 h-4 w-4" />
                            Start Realtime Prep
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Ask About</p>
                        <p className="mt-2 text-sm leading-relaxed text-white/80">
                          Sales notes, competitor usage, AUM, flows, opportunities, buying unit, territory, segment, or profile context.
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Recommended Prompts</p>
                        <p className="mt-2 text-sm leading-relaxed text-white/80">
                          "What is the most important sales note?" "How should I position Capital Group?" "What competitors are already in the book?"
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Data Scope</p>
                        <p className="mt-2 text-sm leading-relaxed text-white/80">
                          This agent is grounded on the full advisor dataset row, so answers should stay specific to the selected advisor record.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-white/5 bg-card/40">
                  <CardHeader className="border-b border-white/5 bg-background/30">
                    <CardTitle className="flex items-center gap-2 text-lg text-white">
                      <MessageSquare className="h-5 w-5 text-indigo-400" />
                      Live Transcript
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="max-h-[560px] min-h-[360px] overflow-y-auto p-6">
                      {realtimeTranscript.length === 0 ? (
                        <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
                          <Radio className="mb-4 h-12 w-12 text-muted-foreground/20" />
                          <p className="text-base text-muted-foreground">Start the realtime prep session to begin the conversation.</p>
                          <p className="mt-2 max-w-lg text-sm text-muted-foreground/70">
                            Ask about advisor fit, sales notes, segment, territory, competitor mentions, or what angle the salesperson should lead with.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {realtimeTranscript.map((line) => (
                            <div
                              key={line.id}
                              className={cn("flex", line.speaker === "user" ? "justify-end" : "justify-start")}
                            >
                              <div
                                className={cn(
                                  "max-w-[85%] rounded-2xl border px-4 py-3 text-sm leading-relaxed shadow-sm",
                                  line.speaker === "user"
                                    ? "border-indigo-500/20 bg-indigo-500/15 text-white"
                                    : "border-emerald-500/20 bg-emerald-500/10 text-white/90",
                                )}
                              >
                                <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.18em] text-white/45">
                                  {line.speaker === "user" ? "You" : "My Prep"}
                                </div>
                                <p>
                                  {line.text}
                                  {line.partial ? (
                                    <span className="ml-1 inline-block h-4 w-2 animate-pulse rounded-sm bg-white/40 align-[-2px]" />
                                  ) : null}
                                </p>
                              </div>
                            </div>
                          ))}
                          <div ref={realtimeTranscriptEndRef} />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
