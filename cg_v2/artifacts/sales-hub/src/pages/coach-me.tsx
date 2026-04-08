import { useEffect, useRef, useState } from "react";
import { Layout } from "@/components/layout";
import { useMeetings } from "@/hooks/use-meetings";
import { resolveApiUrl } from "@/lib/api-url";
import type { Meeting } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  BookOpen,
  BrainCircuit,
  Calendar as CalendarIcon,
  Users,
  Lightbulb,
  MessageCircle,
  Mic2,
  Trophy,
  ArrowRight,
  Activity,
  ChevronDown,
  ChevronUp,
  UserCircle,
  Sparkles,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { CoachPractice, normalizeCoachScenario, type CoachScenario, type ConversationTurn } from "@/components/coach-practice";
import { CoachScorecard, type ScorecardData } from "@/components/coach-scorecard";

type View = "plan" | "practice" | "scorecard";
type CoachMode = "scheduled" | "prospects";

const COACH_ME_PROSPECTS_URL = "https://coachme-vg.azurewebsites.net/";

const VG_WAY_STAGES = [
  {
    title: "Agenda",
    guidance: "Thank them, time check, and align on the purpose before you go anywhere else.",
  },
  {
    title: "Discovery",
    guidance: "Get to the advisor's client context, current approach, constraints, and one live case.",
  },
  {
    title: "Insights",
    guidance: "Tie one idea directly to what the advisor said instead of giving a generic pitch.",
  },
  {
    title: "Practice Management",
    guidance: "Show how Capital Group helps workflow, implementation, scalability, or client communication.",
  },
  {
    title: "Summarize & Prioritize",
    guidance: "Play back the real issue and narrow the next move to the highest-priority need.",
  },
  {
    title: "Close",
    guidance: "Land a real next step with owner, timing, and a practical reason to continue.",
  },
] as const;

interface CoachingPlanData {
  coachingTips: string[];
  objections: { objection: string; suggestedResponse: string }[];
  openingPitches: string[];
  winThemes: string[];
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

interface CoachLeadResponse {
  title?: string | null;
  assets?: string;
}

function emptyCoachingPlanData(): CoachingPlanData {
  return {
    coachingTips: [],
    objections: [],
    openingPitches: [],
    winThemes: [],
  };
}

function decodeJsonString(value: string): string {
  try {
    return JSON.parse(`"${value}"`) as string;
  } catch {
    return value
      .replace(/\\"/g, "\"")
      .replace(/\\n/g, "\n")
      .replace(/\\\\/g, "\\");
  }
}

function extractArraySection(content: string, key: keyof CoachingPlanData): string {
  const keyIndex = content.indexOf(`"${key}"`);
  if (keyIndex === -1) return "";

  const start = content.indexOf("[", keyIndex);
  if (start === -1) return "";

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < content.length; i++) {
    const char = content[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "[") depth++;
    if (char === "]") {
      depth--;
      if (depth === 0) {
        return content.slice(start, i + 1);
      }
    }
  }

  return content.slice(start);
}

function extractStringArray(content: string, key: "coachingTips" | "openingPitches" | "winThemes"): string[] {
  const section = extractArraySection(content, key);
  if (!section) return [];

  const matches = section.matchAll(/"((?:\\.|[^"\\])*)"/g);
  return Array.from(matches, (match) => decodeJsonString(match[1]));
}

function extractObjections(content: string): CoachingPlanData["objections"] {
  const section = extractArraySection(content, "objections");
  if (!section) return [];

  const matches = section.matchAll(
    /"objection"\s*:\s*"((?:\\.|[^"\\])*)"\s*,\s*"suggestedResponse"\s*:\s*"((?:\\.|[^"\\])*)"/g,
  );

  return Array.from(matches, (match) => ({
    objection: decodeJsonString(match[1]),
    suggestedResponse: decodeJsonString(match[2]),
  }));
}

function parseStreamingCoachPlan(content: string): CoachingPlanData {
  return {
    coachingTips: extractStringArray(content, "coachingTips"),
    openingPitches: extractStringArray(content, "openingPitches"),
    winThemes: extractStringArray(content, "winThemes"),
    objections: extractObjections(content),
  };
}

function parseLeadAdvisorData(assets?: string): CoachAdvisorContext | null {
  if (!assets) return null;

  try {
    const parsed = JSON.parse(assets) as { __advisorData?: CoachAdvisorContext };
    return parsed.__advisorData ?? null;
  } catch {
    return null;
  }
}

function parseRequestError(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { error?: string; details?: string };
    if (parsed.details) return `${parsed.error ?? "Request failed"}: ${parsed.details}`;
    return parsed.error ?? raw;
  } catch {
    return raw;
  }
}

export default function CoachMe() {
  const { data: meetingsData, isLoading: meetingsLoading } = useMeetings();
  const mayaLeadIdRef = useRef(sessionStorage.getItem("maya_coach_lead"));
  if (mayaLeadIdRef.current) sessionStorage.removeItem("maya_coach_lead");
  const mayaAutoGeneratedRef = useRef(false);
  const [coachMode, setCoachMode] = useState<CoachMode>("scheduled");
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [focusArea, setFocusArea] = useState("");
  const [expandedObjection, setExpandedObjection] = useState<number | null>(null);
  const [coachData, setCoachData] = useState<CoachingPlanData | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [streamingPreview, setStreamingPreview] = useState("");

  const [view, setView] = useState<View>("plan");
  const [scenario, setScenario] = useState<CoachScenario | null>(null);
  const [isGeneratingScenario, setIsGeneratingScenario] = useState(false);
  const [practiceTranscript, setPracticeTranscript] = useState<ConversationTurn[]>([]);
  const [scorecard, setScorecard] = useState<ScorecardData | null>(null);
  const [isScorecardLoading, setIsScorecardLoading] = useState(false);
  const [scorecardPreview, setScorecardPreview] = useState("");
  const [scorecardError, setScorecardError] = useState("");
  const [prospectsFrameKey, setProspectsFrameKey] = useState(0);
  const [isProspectsLoading, setIsProspectsLoading] = useState(true);
  const coachStreamAbortRef = useRef<AbortController | null>(null);
  const scorecardPreviewAbortRef = useRef<AbortController | null>(null);

  const meetings = meetingsData?.meetings?.filter(m => m.status === "scheduled") || [];
  const selectedMeeting = meetings.find(m => m.id === selectedMeetingId);
  const streamingCoachData = streamingPreview
    ? parseStreamingCoachPlan(streamingPreview)
    : emptyCoachingPlanData();
  const hasStreamingDraft = (
    streamingCoachData.coachingTips.length > 0 ||
    streamingCoachData.objections.length > 0 ||
    streamingCoachData.openingPitches.length > 0 ||
    streamingCoachData.winThemes.length > 0
  );
  const displayedCoachData = coachData ?? (hasStreamingDraft ? streamingCoachData : null);

  useEffect(() => () => {
    coachStreamAbortRef.current?.abort();
    scorecardPreviewAbortRef.current?.abort();
  }, []);

  const handleGenerate = async (meeting: Meeting) => {
    coachStreamAbortRef.current?.abort();
    const controller = new AbortController();
    coachStreamAbortRef.current = controller;

    setSelectedMeetingId(meeting.id);
    setExpandedObjection(null);
    setView("plan");
    setScenario(null);
    setScorecard(null);
    setScorecardPreview("");
    setScorecardError("");
    setCoachData(null);
    setStreamingPreview("");
    setIsPending(true);

    try {
      const res = await fetch(resolveApiUrl("/api/agents/coach-me/stream"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingId: meeting.id,
          leadName: meeting.leadName,
          leadCompany: meeting.leadCompany,
          meetingPurpose: meeting.purpose,
          focusArea: focusArea || undefined,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error("Failed to generate coaching plan");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const event of events) {
          const line = event.split("\n").find(part => part.startsWith("data: "));
          if (!line) continue;

          const rawPayload = line.slice(6).trim();
          if (!rawPayload || rawPayload === "[DONE]") continue;

          const payload = JSON.parse(rawPayload) as {
            type?: "delta" | "done" | "error";
            content?: string;
            data?: CoachingPlanData;
            error?: string;
          };

          if (payload.type === "error") {
            throw new Error(payload.error || "Failed to generate coaching plan");
          }

          if (payload.content) {
            setStreamingPreview(payload.content);
          }

          if (payload.type === "done" && payload.data) {
            setCoachData(payload.data);
            setStreamingPreview("");
          }
        }
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error("Coach plan streaming failed:", error);
        setCoachData(null);
      }
    } finally {
      if (coachStreamAbortRef.current === controller) {
        coachStreamAbortRef.current = null;
      }
      setIsPending(false);
    }
  };

  // Auto-select and generate coaching plan when Maya navigates here
  useEffect(() => {
    const leadId = mayaLeadIdRef.current;
    if (!leadId || mayaAutoGeneratedRef.current || !meetingsData?.meetings) return;
    const meeting = meetingsData.meetings.find(m => m.leadId === leadId || m.id === leadId);
    if (!meeting) return;
    mayaAutoGeneratedRef.current = true;
    void handleGenerate(meeting);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingsData]);

  const handleStartPractice = async () => {
    if (!selectedMeeting) return;
    setIsGeneratingScenario(true);
    try {
      let advisorContext: CoachAdvisorContext | null = null;
      let leadTitle: string | undefined;

      if (selectedMeeting.leadId) {
        try {
          const leadRes = await fetch(resolveApiUrl(`/api/leads/${selectedMeeting.leadId}`));
          if (leadRes.ok) {
            const lead = await leadRes.json() as CoachLeadResponse;
            advisorContext = parseLeadAdvisorData(lead.assets);
            leadTitle = lead.title ?? undefined;
          }
        } catch (error) {
          console.warn("Coach Me lead context fetch failed:", error);
        }
      }

      const res = await fetch(resolveApiUrl("/api/agents/coach-me/scenario"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadName: selectedMeeting.leadName,
          leadCompany: selectedMeeting.leadCompany,
          leadTitle,
          meetingPurpose: selectedMeeting.purpose,
          focusArea: focusArea || undefined,
          advisorContext,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const nextScenario: CoachScenario = normalizeCoachScenario(await res.json());
      setScenario(nextScenario);
      setPracticeTranscript([]);
      setScorecardError("");
      setView("practice");
    } catch {
    } finally {
      setIsGeneratingScenario(false);
    }
  };

  const streamScorecardPreview = async (scenarioToScore: CoachScenario, transcript: ConversationTurn[]) => {
    scorecardPreviewAbortRef.current?.abort();
    const controller = new AbortController();
    scorecardPreviewAbortRef.current = controller;
    setScorecardPreview("");

    try {
      const res = await fetch(resolveApiUrl("/api/agents/coach-me/preview-stream"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario: scenarioToScore,
          transcript,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error("Failed to stream scorecard preview");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const event of events) {
          const line = event.split("\n").find(part => part.startsWith("data: "));
          if (!line) continue;

          const rawPayload = line.slice(6).trim();
          if (!rawPayload || rawPayload === "[DONE]") continue;

          const payload = JSON.parse(rawPayload) as {
            type?: "delta" | "done" | "error";
            content?: string;
            error?: string;
          };

          if (payload.type === "error") {
            throw new Error(payload.error || "Failed to stream coach preview");
          }

          if (payload.content) {
            setScorecardPreview(payload.content);
          }
        }
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error("Coach preview streaming failed:", error);
      }
    } finally {
      if (scorecardPreviewAbortRef.current === controller) {
        scorecardPreviewAbortRef.current = null;
      }
    }
  };

  const handleScorecardRequest = async (transcript: ConversationTurn[]) => {
    if (!scenario || !selectedMeeting) return;
    setPracticeTranscript(transcript);
    setIsScorecardLoading(true);
    setView("plan");
    setScorecardPreview("");
    setScorecardError("");

    try {
      void streamScorecardPreview(scenario, transcript);

      const res = await fetch(resolveApiUrl("/api/agents/coach-me/scorecard-v2"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario,
          meetingContext: {
            leadName: selectedMeeting.leadName,
            leadCompany: selectedMeeting.leadCompany,
            purpose: selectedMeeting.purpose,
          },
          transcript,
        }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(parseRequestError(errorText || "Failed to generate scorecard"));
      }
      const sc: ScorecardData = await res.json();
      setScorecard(sc);
      setView("scorecard");
    } catch (error) {
      console.error("Scorecard generation failed:", error);
      setScorecardError(error instanceof Error ? error.message : "Failed to generate scorecard");
      setView("plan");
    } finally {
      scorecardPreviewAbortRef.current?.abort();
      setIsScorecardLoading(false);
    }
  };

  const handleRetry = () => {
    setView("plan");
    setScorecard(null);
    setScorecardPreview("");
    setScorecardError("");
  };

  if (view === "practice" && scenario && selectedMeeting) {
    return (
      <CoachPractice
        scenario={scenario}
        meeting={{ leadName: selectedMeeting.leadName, leadCompany: selectedMeeting.leadCompany, purpose: selectedMeeting.purpose }}
        onScorecard={handleScorecardRequest}
        onBack={() => setView("plan")}
      />
    );
  }

  return (
    <Layout>
      <div className="space-y-8 max-w-6xl mx-auto pb-12">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-violet-400/10 border border-violet-400/20 flex items-center justify-center">
            <BrainCircuit className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-white">My Coach</h1>
            <p className="text-muted-foreground">Practice scheduled advisors or jump into the prospects coaching workspace.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={() => setCoachMode("scheduled")}
            className={coachMode === "scheduled"
              ? "bg-violet-600 hover:bg-violet-500 text-white"
              : "bg-white/5 text-white hover:bg-white/10 border border-white/10"}
          >
            Scheduled Advisors
          </Button>
          <Button
            type="button"
            onClick={() => setCoachMode("prospects")}
            className={coachMode === "prospects"
              ? "bg-violet-600 hover:bg-violet-500 text-white"
              : "bg-white/5 text-white hover:bg-white/10 border border-white/10"}
          >
            Prospects
          </Button>
        </div>

        {coachMode === "prospects" ? (
          <div className="space-y-3">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm font-semibold text-muted-foreground tracking-wide uppercase">Prospects Workspace</h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-3 text-xs text-muted-foreground hover:text-white hover:bg-white/5 gap-1.5"
                  onClick={() => {
                    setIsProspectsLoading(true);
                    setProspectsFrameKey((current) => current + 1);
                  }}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Reload
                </Button>
                <Button asChild size="sm" className="h-8 px-3 text-xs bg-violet-600 hover:bg-violet-500 text-white gap-1.5">
                  <a href={COACH_ME_PROSPECTS_URL} target="_blank" rel="noreferrer">
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open in new tab
                  </a>
                </Button>
              </div>
            </div>

            {/* iframe container */}
            <div className="relative overflow-hidden rounded-2xl border border-white/8 shadow-2xl min-h-[82vh]">
              {isProspectsLoading && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#08111f]">
                  <Loader2 className="w-7 h-7 text-violet-400 animate-spin" />
                  <p className="text-xs text-muted-foreground">Loading workspace...</p>
                </div>
              )}
              <iframe
                key={prospectsFrameKey}
                src={COACH_ME_PROSPECTS_URL}
                title="My Coach Prospects"
                className="border-0 block"
                allow="microphone; camera; autoplay; clipboard-read; clipboard-write; fullscreen; display-capture"
                style={{
                  width: "133.33%",
                  height: "109.33vh",
                  transform: "scale(0.75)",
                  transformOrigin: "top left",
                }}
                onLoad={() => setIsProspectsLoading(false)}
              />
            </div>
          </div>
        ) : (

        <div className="grid lg:grid-cols-[340px_1fr] gap-8 items-start">

          {/* Meeting Selection + Focus */}
          <div className="space-y-4">
            <Card className="bg-card/40 border-white/5 sticky top-24">
              <CardHeader>
                <CardTitle className="text-lg text-white">Upcoming Calls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {meetingsLoading ? (
                  <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                ) : meetings.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-8">No scheduled meetings. Schedule one first.</div>
                ) : (
                  meetings.map(meeting => (
                    <button
                      key={meeting.id}
                      onClick={() => handleGenerate(meeting)}
                      className={`w-full text-left p-4 rounded-xl border transition-all ${
                        selectedMeetingId === meeting.id
                          ? "bg-violet-500/10 border-violet-500/30 shadow-[0_0_15px_rgba(139,92,246,0.15)]"
                          : "bg-background/50 border-white/5 hover:border-white/15 hover:bg-secondary/50"
                      }`}
                    >
                      <div className="font-semibold text-white mb-1">{meeting.leadName}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-1.5 mb-2">
                        <Users className="w-3.5 h-3.5" /> {meeting.leadCompany}
                      </div>
                      <div className="text-xs font-medium text-violet-400 bg-violet-400/10 inline-flex items-center px-2 py-1 rounded-md">
                        <CalendarIcon className="w-3 h-3 mr-1.5" />
                        {format(new Date(meeting.scheduledAt), "MMM d, h:mm a")}
                      </div>
                    </button>
                  ))
                )}

                {meetings.length > 0 && (
                  <div className="pt-2 border-t border-white/5 space-y-2">
                    <label className="text-sm text-muted-foreground">Focus Area (optional)</label>
                    <Input
                      value={focusArea}
                      onChange={e => setFocusArea(e.target.value)}
                      placeholder="e.g. Overcoming fee objections..."
                      className="bg-background/50 border-white/10 text-white text-sm"
                    />
                    <p className="text-xs text-muted-foreground">Select a meeting above to generate your coaching plan.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Main Content Area */}
          <div className="min-h-[500px]">
            {/* Scorecard loading state */}
            {isScorecardLoading && (
              <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-card/20 rounded-3xl border border-white/5 border-dashed">
                <Trophy className="w-12 h-12 text-violet-400 animate-pulse mb-6" />
                <h3 className="text-xl font-semibold text-white mb-2">Generating Your Scorecard...</h3>
                <p className="text-muted-foreground max-w-sm">
                  Evaluating your practice session against the CG Way and building a compact report with examples.
                </p>
                {scorecardPreview && (
                  <div className="mt-6 max-w-3xl rounded-2xl border border-white/8 bg-background/40 p-5 text-left">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-violet-300/75">Live Coach Preview</p>
                    <div className="max-h-[360px] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-white/80">
                      {scorecardPreview}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Scorecard View */}
            {!isScorecardLoading && view === "scorecard" && scorecard && scenario && selectedMeeting && (
              <CoachScorecard
                scorecard={scorecard}
                scenario={scenario}
                meeting={{ leadName: selectedMeeting.leadName, leadCompany: selectedMeeting.leadCompany, purpose: selectedMeeting.purpose }}
                onRetry={handleRetry}
              />
            )}

            {/* Plan View */}
            {!isScorecardLoading && view === "plan" && (
              <>
                {scorecardError && (
                  <div className="mb-6 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                    {scorecardError}
                  </div>
                )}
                {isPending && !displayedCoachData ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-card/20 rounded-3xl border border-white/5 border-dashed">
                    <BrainCircuit className="w-12 h-12 text-violet-400 animate-pulse mb-6" />
                    <h3 className="text-xl font-semibold text-white mb-2">Building Your Game Plan...</h3>
                    <p className="text-muted-foreground max-w-sm">Analyzing the client profile and starting your tile-by-tile coaching plan.</p>
                  </div>
                ) : !displayedCoachData ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-card/20 rounded-3xl border border-white/5 border-dashed">
                    <BrainCircuit className="w-16 h-16 text-muted-foreground/20 mb-4" />
                    <p className="text-muted-foreground text-lg">Select a meeting to generate your coaching plan.</p>
                  </div>
                ) : (
                  <AnimatePresence mode="wait">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-6"
                    >
                      {/* Header bar */}
                      <div className="flex items-center justify-between bg-card/40 border border-white/5 p-6 rounded-2xl">
                        <div>
                          <h2 className="text-2xl font-bold text-white mb-1">Coaching Plan: {selectedMeeting?.leadName}</h2>
                          <p className="text-muted-foreground">{selectedMeeting?.purpose} — {selectedMeeting?.leadCompany}</p>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                          <Trophy className="w-6 h-6 text-violet-400" />
                        </div>
                      </div>

                      {isPending && (
                        <div className="flex items-center gap-3 rounded-2xl border border-violet-500/15 bg-violet-500/5 px-4 py-3">
                          <Loader2 className="w-4 h-4 text-violet-300 animate-spin" />
                          <p className="text-sm text-violet-100/85">Streaming your coaching plan into the tiles as it generates.</p>
                        </div>
                      )}

                      <Card className="bg-card/40 border-white/5">
                        <CardHeader className="border-b border-white/5 bg-background/30 pb-4">
                          <CardTitle className="text-lg flex items-center gap-2 text-white">
                            <BookOpen className="w-5 h-5 text-cyan-400" /> CG Way
                            <span className="text-xs font-normal text-muted-foreground ml-1">- The framework to run the call</span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-5">
                          <div className="mb-4 rounded-xl border border-cyan-500/15 bg-cyan-500/5 p-4">
                            <p className="text-sm leading-relaxed text-white/80">
                              Use this as your operating system during the call: lead the opening, earn discovery, connect the idea to the advisor's real issue, and leave with a clear next step.
                            </p>
                          </div>
                          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {VG_WAY_STAGES.map((stage, index) => (
                              <motion.div
                                key={stage.title}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="rounded-xl border border-white/6 bg-background/40 p-4"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-cyan-400/20 bg-cyan-400/10 text-xs font-bold text-cyan-300">
                                    {index + 1}
                                  </span>
                                  <p className="text-sm font-semibold text-white">{stage.title}</p>
                                </div>
                                <p className="mt-3 text-sm leading-relaxed text-white/75">{stage.guidance}</p>
                              </motion.div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Win Themes */}
                      <Card className="bg-card/40 border-white/5">
                        <CardHeader className="border-b border-white/5 bg-background/30 pb-4">
                          <CardTitle className="text-lg flex items-center gap-2 text-white">
                            <Trophy className="w-5 h-5 text-violet-400" /> Win Themes
                            <span className="text-xs font-normal text-muted-foreground ml-1">— Core value propositions to drive home</span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-5">
                          <div className="grid sm:grid-cols-2 gap-3">
                            {displayedCoachData.winThemes.map((theme, i) => (
                              <motion.div
                                key={i}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: i * 0.08 }}
                                className="bg-violet-500/5 border border-violet-500/15 rounded-xl p-4 text-white/85 text-sm leading-relaxed"
                              >
                                <span className="font-bold text-violet-400 mr-2">{i + 1}.</span>
                                {theme}
                              </motion.div>
                            ))}
                            {isPending && displayedCoachData.winThemes.length === 0 && (
                              <div className="sm:col-span-2 text-sm text-muted-foreground">Waiting for win themes...</div>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Opening Pitches */}
                      <Card className="bg-card/40 border-white/5">
                        <CardHeader className="border-b border-white/5 bg-background/30 pb-4">
                          <CardTitle className="text-lg flex items-center gap-2 text-white">
                            <Mic2 className="w-5 h-5 text-blue-400" /> Opening Pitches
                            <span className="text-xs font-normal text-muted-foreground ml-1">— 3 variations for the first 60 seconds</span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-5 space-y-4">
                          {displayedCoachData.openingPitches.map((pitch, i) => {
                            const labels = ["Confident", "Consultative", "Value-First"];
                            const colors = ["text-blue-400 bg-blue-400/10 border-blue-400/20", "text-sky-400 bg-sky-400/10 border-sky-400/20", "text-cyan-400 bg-cyan-400/10 border-cyan-400/20"];
                            return (
                              <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.1 }}
                                className="bg-background/50 border border-white/5 rounded-xl p-4 space-y-2"
                              >
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${colors[i] || "text-white"}`}>
                                  {labels[i] || `Version ${i + 1}`}
                                </span>
                                <p className="text-white/80 text-sm leading-relaxed pt-1">{pitch}</p>
                              </motion.div>
                            );
                          })}
                          {isPending && displayedCoachData.openingPitches.length === 0 && (
                            <div className="text-sm text-muted-foreground">Waiting for opening pitches...</div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Coaching Tips */}
                      <Card className="bg-card/40 border-white/5">
                        <CardHeader className="border-b border-white/5 bg-background/30 pb-4">
                          <CardTitle className="text-lg flex items-center gap-2 text-white">
                            <Lightbulb className="w-5 h-5 text-amber-400" /> Strategic Coaching Tips
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-5">
                          <ul className="space-y-3">
                            {displayedCoachData.coachingTips.map((tip, i) => (
                              <motion.li
                                key={i}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.08 }}
                                className="flex gap-3 text-white/80"
                              >
                                <span className="shrink-0 w-6 h-6 rounded-full bg-amber-400/10 text-amber-400 flex items-center justify-center text-xs font-bold mt-0.5">
                                  {i + 1}
                                </span>
                                <span className="leading-relaxed">{tip}</span>
                              </motion.li>
                            ))}
                            {isPending && displayedCoachData.coachingTips.length === 0 && (
                              <li className="text-sm text-muted-foreground">Waiting for coaching tips...</li>
                            )}
                          </ul>
                        </CardContent>
                      </Card>

                      {/* Objection Handling */}
                      <Card className="bg-card/40 border-white/5 border-l-4 border-l-violet-500">
                        <CardHeader className="border-b border-white/5 bg-background/30 pb-4">
                          <CardTitle className="text-lg flex items-center gap-2 text-white">
                            <MessageCircle className="w-5 h-5 text-violet-400" /> Objection Handling
                            <span className="text-xs font-normal text-muted-foreground ml-1">— Tap each to reveal the ideal response</span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-5 space-y-3">
                          {displayedCoachData.objections.map((obj, i) => (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.08 }}
                              className="rounded-xl border border-white/8 overflow-hidden"
                            >
                              <button
                                onClick={() => setExpandedObjection(expandedObjection === i ? null : i)}
                                className="w-full flex items-center justify-between p-4 bg-background/40 hover:bg-background/60 transition-colors text-left"
                              >
                                <div className="flex items-start gap-3">
                                  <span className="shrink-0 text-violet-400 font-bold text-sm mt-0.5">Q{i + 1}</span>
                                  <span className="text-white/90 font-medium text-sm leading-relaxed">&ldquo;{obj.objection}&rdquo;</span>
                                </div>
                                {expandedObjection === i ? (
                                  <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0 ml-3" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 ml-3" />
                                )}
                              </button>
                              <AnimatePresence>
                                {expandedObjection === i && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                  >
                                    <div className="p-4 pt-3 bg-violet-500/5 border-t border-violet-500/10">
                                      <p className="text-xs font-semibold text-violet-400 uppercase tracking-wider mb-2">Suggested Response</p>
                                      <p className="text-white/80 text-sm leading-relaxed">{obj.suggestedResponse}</p>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </motion.div>
                          ))}
                          {isPending && displayedCoachData.objections.length === 0 && (
                            <div className="text-sm text-muted-foreground">Waiting for objections...</div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Practice with Realtime Persona CTA */}
                      <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="relative overflow-hidden rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-500/8 to-blue-500/5 p-6"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-violet-600/5 to-transparent pointer-events-none" />
                        <div className="relative flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center shrink-0">
                              <UserCircle className="w-6 h-6 text-violet-400" />
                            </div>
                            <div>
                              <p className="text-xs text-violet-300/70 uppercase tracking-wider font-semibold mb-0.5">Ready to Practice?</p>
                              <p className="text-white font-bold">Simulate the Selected Advisor Live</p>
                              <p className="text-sm text-muted-foreground mt-0.5">
                                Run a realtime roleplay with the selected advisor scenario, get live coaching during the call, and finish with a concise scorecard.
                              </p>
                            </div>
                          </div>
                          <Button
                            onClick={handleStartPractice}
                            disabled={isGeneratingScenario}
                            className="shrink-0 bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-500/25 gap-2"
                          >
                            {isGeneratingScenario ? (
                              <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                            ) : (
                              <><Sparkles className="w-4 h-4" /> Start Realtime Practice</>
                            )}
                          </Button>
                        </div>
                      </motion.div>

                      {/* Next Step CTA */}
                      <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="flex items-center justify-between gap-4 bg-rose-500/5 border border-rose-500/25 rounded-2xl p-5"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-rose-400/10 border border-rose-400/20 flex items-center justify-center shrink-0">
                            <Activity className="w-5 h-5 text-rose-400" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Next Step</p>
                            <p className="text-sm font-semibold text-white">My Engage — Real-time meeting intelligence</p>
                          </div>
                        </div>
                        <Button asChild className="shrink-0 bg-rose-500 hover:bg-rose-400 text-white shadow-lg shadow-rose-500/20">
                          <Link href="/engage-me">
                            Enter Meeting <ArrowRight className="w-4 h-4 ml-1.5" />
                          </Link>
                        </Button>
                      </motion.div>

                    </motion.div>
                  </AnimatePresence>
                )}
              </>
            )}
          </div>
        </div>
        )}
      </div>
    </Layout>
  );
}
