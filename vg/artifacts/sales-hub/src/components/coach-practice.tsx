import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BookOpen, Loader2, Mic, MicOff, PhoneCall, PhoneOff, Radio, Square, Volume2, X } from "lucide-react";
import { useRealtimeCall } from "@/hooks/use-realtime-call";

export interface CoachScenario {
  title: string;
  salespersonBrief: string;
  startInstruction: string;
  visiblePersona: {
    personaType: string;
    name: string;
    firm: string;
    firmType: string;
    clients: string[];
    style: string[];
    headline: string;
  };
  trainerPreview: {
    personaName: string;
    primaryPainPoints: string[];
    likelyObjections: string[];
    bestFitAngle: string;
  };
  hiddenBrief: {
    personaId: string;
    personaName: string;
    advisorType: string;
    firm: string;
    tone: string;
    businessContext: string;
    currentApproach: string;
    objectives: string[];
    painPoints: string[];
    objections: string[];
    fitSignals: string[];
    redFlags: string[];
    liveCaseExamples: string[];
    successDefinition: string[];
    coachFocus: string[];
  };
  sourceContext?: {
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
  };
}

export interface ConversationTurn {
  role: "user" | "advisor";
  content: string;
}

interface TranscriptLine extends ConversationTurn {
  id: string;
  partial?: boolean;
}

interface LiveFeedback {
  snapshot?: string;
  currentScore?: number;
  strengths?: string[];
  improveNow?: Array<{
    title?: string;
    issue?: string;
    example?: string;
  }>;
  nextBestQuestion?: string;
  momentum?: string;
}

interface ShouldEndResult {
  shouldEnd?: boolean;
  confidence?: number;
  reason?: string;
}

interface RealtimeEvent {
  type: string;
  transcript?: string;
  delta?: string;
  error?: { message?: string };
}

const VG_WAY_STAGES = [
  {
    title: "Agenda",
    goal: "Open tightly and earn permission for the conversation.",
    goodLooksLike: "Thank the advisor, confirm time, align on the purpose, and make the call feel practical.",
  },
  {
    title: "Discovery",
    goal: "Surface real client needs and the advisor's current approach.",
    goodLooksLike: "Ask focused questions about book of business, client cases, constraints, and how they solve the issue today.",
  },
  {
    title: "Insights",
    goal: "Connect the idea to the advisor's actual problem.",
    goodLooksLike: "Share one relevant insight or product angle tied directly to what the advisor said, not a generic pitch.",
  },
  {
    title: "Practice Management",
    goal: "Make the conversation useful beyond product talk.",
    goodLooksLike: "Show how Vanguard can improve workflow, implementation, scalability, or client conversations.",
  },
  {
    title: "Summarize & Prioritize",
    goal: "Prove you heard the advisor and narrow the next move.",
    goodLooksLike: "Restate the main issue, the priority, and why the proposed path fits this advisor's practice.",
  },
  {
    title: "Close",
    goal: "Leave with a real next step.",
    goodLooksLike: "Agree on the next action, owner, and timing instead of ending with a vague follow-up.",
  },
] as const;

function parseApiErrorMessage(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { error?: string; details?: string };
    if (parsed.details) return `${parsed.error ?? "Request failed"}: ${parsed.details}`;
    return parsed.error ?? raw;
  } catch {
    return raw;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function normalizeCoachScenario(input: unknown): CoachScenario {
  const scenario = asRecord(input) ?? {};
  const visiblePersona = asRecord(scenario.visiblePersona) ?? {};
  const trainerPreview = asRecord(scenario.trainerPreview) ?? {};
  const hiddenBrief = asRecord(scenario.hiddenBrief) ?? {};
  const sourceContext = asRecord(scenario.sourceContext);

  const normalizedVisiblePersona = {
    personaType: asString(visiblePersona.personaType, "Advisor Persona"),
    name: asString(visiblePersona.name, "Advisor"),
    firm: asString(visiblePersona.firm, ""),
    firmType: asString(visiblePersona.firmType, "Advisory Practice"),
    clients: asStringArray(visiblePersona.clients),
    style: asStringArray(visiblePersona.style),
    headline: asString(visiblePersona.headline, "No advisor headline provided."),
  };

  const normalizedTrainerPreview = {
    personaName: asString(trainerPreview.personaName, normalizedVisiblePersona.name),
    primaryPainPoints: asStringArray(trainerPreview.primaryPainPoints),
    likelyObjections: asStringArray(trainerPreview.likelyObjections),
    bestFitAngle: asString(
      trainerPreview.bestFitAngle,
      "Use discovery to isolate the advisor's real priority before offering one relevant idea.",
    ),
  };

  const normalizedHiddenBrief = {
    personaId: asString(hiddenBrief.personaId, ""),
    personaName: asString(hiddenBrief.personaName, normalizedVisiblePersona.name),
    advisorType: asString(hiddenBrief.advisorType, normalizedVisiblePersona.personaType),
    firm: asString(hiddenBrief.firm, normalizedVisiblePersona.firm),
    tone: asString(hiddenBrief.tone, "Professional and practical"),
    businessContext: asString(
      hiddenBrief.businessContext,
      "You manage client relationships and portfolio decisions for your practice.",
    ),
    currentApproach: asString(
      hiddenBrief.currentApproach,
      "You have an existing process and want practical, relevant ideas.",
    ),
    objectives: asStringArray(hiddenBrief.objectives),
    painPoints: asStringArray(hiddenBrief.painPoints),
    objections: asStringArray(hiddenBrief.objections),
    fitSignals: asStringArray(hiddenBrief.fitSignals),
    redFlags: asStringArray(hiddenBrief.redFlags),
    liveCaseExamples: asStringArray(hiddenBrief.liveCaseExamples),
    successDefinition: asStringArray(hiddenBrief.successDefinition),
    coachFocus: asStringArray(hiddenBrief.coachFocus),
  };

  const normalizedSourceContext = sourceContext
    ? {
        aumM: asNumber(sourceContext.aumM),
        salesAmt: asNumber(sourceContext.salesAmt),
        redemption: asNumber(sourceContext.redemption),
        fiOpportunities: asNumber(sourceContext.fiOpportunities),
        etfOpportunities: asNumber(sourceContext.etfOpportunities),
        alpha: asNumber(sourceContext.alpha),
        competitors: asStringArray(sourceContext.competitors),
        buyingUnit: asString(sourceContext.buyingUnit),
        territory: asString(sourceContext.territory),
        segment: asString(sourceContext.segment),
        ratings: sourceContext.ratings === null ? null : asNumber(sourceContext.ratings),
        advisorProfile: asString(sourceContext.advisorProfile),
        salesEngagement: asString(sourceContext.salesEngagement),
        salesNotes: asString(sourceContext.salesNotes),
        advisorRow: asRecord(sourceContext.advisorRow) as Record<string, string> | undefined,
      }
    : undefined;

  return {
    title: asString(scenario.title, "Coach Me Practice"),
    salespersonBrief: asString(
      scenario.salespersonBrief,
      "Review the advisor context, open with purpose, and earn the right to go deeper.",
    ),
    startInstruction: asString(
      scenario.startInstruction,
      "Start the call, confirm the purpose, and move into focused discovery.",
    ),
    visiblePersona: normalizedVisiblePersona,
    trainerPreview: normalizedTrainerPreview,
    hiddenBrief: normalizedHiddenBrief,
    sourceContext: normalizedSourceContext,
  };
}

interface Props {
  scenario: CoachScenario;
  meeting: { leadName: string; leadCompany: string; purpose: string };
  onScorecard: (transcript: ConversationTurn[]) => void;
  onBack: () => void;
}

function upsertTranscriptLine(
  prev: TranscriptLine[],
  role: ConversationTurn["role"],
  content: string,
  partial: boolean,
): TranscriptLine[] {
  const next = [...prev];
  const last = next[next.length - 1];

  if (last?.role === role && last.partial) {
    next[next.length - 1] = { ...last, content: `${last.content}${content}`, partial };
    return next;
  }

  next.push({
    id: crypto.randomUUID(),
    role,
    content,
    partial,
  });
  return next;
}

function finalizeTranscriptLine(
  prev: TranscriptLine[],
  role: ConversationTurn["role"],
  content: string,
): TranscriptLine[] {
  const next = [...prev];

  for (let i = next.length - 1; i >= 0; i -= 1) {
    if (next[i].role === role && next[i].partial) {
      next[i] = { ...next[i], content, partial: false };
      return next;
    }
  }

  next.push({
    id: crypto.randomUUID(),
    role,
    content,
    partial: false,
  });
  return next;
}

function sanitizeTranscript(lines: TranscriptLine[]): ConversationTurn[] {
  return lines
    .filter(line => !line.partial && line.content.trim())
    .map(({ role, content }) => ({ role, content }));
}

function normalizeRealtimeText(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function sanitizeTranscriptText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

function isPromptEchoTranscript(text: string): boolean {
  const normalized = normalizeRealtimeText(text);
  if (!normalized) return false;

  return (
    normalized.startsWith("financial advisor call") ||
    normalized.startsWith("financial advisor sales call") ||
    normalized.includes("terms may include") ||
    normalized.includes("vanguard advisor roleplay") ||
    normalized.includes("portfolio construction") ||
    normalized.includes("tax-aware investing") ||
    (normalized.includes("fixed income") && normalized.includes("etfs") && normalized.includes("fees"))
  );
}

export function CoachPractice({ scenario, meeting, onScorecard, onBack }: Props) {
  const normalizedScenario = useMemo(() => normalizeCoachScenario(scenario), [scenario]);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [sessionError, setSessionError] = useState("");
  const [sessionState, setSessionState] = useState<"idle" | "connecting" | "live" | "ended">("idle");
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [liveFeedback, setLiveFeedback] = useState<LiveFeedback | null>(null);
  const [isFeedbackLoading, setIsFeedbackLoading] = useState(false);
  const [showVgWay, setShowVgWay] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const feedbackRequestIdRef = useRef(0);
  const transcriptRef = useRef<TranscriptLine[]>([]);
  const endingRef = useRef(false);
  const advisorRespondingRef = useRef(false);

  const completedTranscript = useMemo(() => sanitizeTranscript(transcript), [transcript]);
  const visiblePersona = {
    name: normalizedScenario.visiblePersona.name,
    personaType: normalizedScenario.visiblePersona.personaType,
    firm: normalizedScenario.visiblePersona.firm,
    headline: normalizedScenario.visiblePersona.headline,
  };
  const trainerPreview = normalizedScenario.trainerPreview;
  const initials = visiblePersona.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  const applyTranscript = (next: TranscriptLine[]) => {
    transcriptRef.current = next;
    setTranscript(next);
  };

  const updatePartialTranscript = (
    role: ConversationTurn["role"],
    content: string,
  ) => {
    applyTranscript((() => {
      const next = [...transcriptRef.current];
      const last = next[next.length - 1];

      if (last?.role === role && last.partial) {
        next[next.length - 1] = { ...last, content, partial: true };
        return next;
      }

      next.push({
        id: crypto.randomUUID(),
        role,
        content,
        partial: true,
      });
      return next;
    })());
  };

  const {
    isMuted,
    startCall: startRealtimeCall,
    endCall: endRealtimeCall,
    sendRealtimeEvent,
    toggleMute,
  } = useRealtimeCall({
    playbackWorkletPath: `${import.meta.env.BASE_URL}audio-playback-worklet.js`,
    captureWorkletPath: `${import.meta.env.BASE_URL}audio-capture-worklet.js`,
    isTranscriptIgnored: isPromptEchoTranscript,
    onUserTranscriptDelta: (_delta, accumulated) => {
      updatePartialTranscript("user", accumulated);
    },
    onUserTranscript: (text) => {
      const transcriptText = sanitizeTranscriptText(text);
      if (!transcriptText) return;
      const next = finalizeTranscriptLine(transcriptRef.current, "user", transcriptText);
      applyTranscript(next);
      void maybeDetectEnd(sanitizeTranscript(next), transcriptText);
    },
    onAgentTranscriptDelta: (_delta, accumulated) => {
      advisorRespondingRef.current = true;
      updatePartialTranscript("advisor", accumulated);
    },
    onAgentResponseDone: (fullText) => {
      advisorRespondingRef.current = false;
      const transcriptText = sanitizeTranscriptText(fullText);
      if (!transcriptText) return;
      applyTranscript(finalizeTranscriptLine(transcriptRef.current, "advisor", transcriptText));
    },
    onRealtimeEvent: (event) => {
      switch (event.type) {
        case "input_audio_buffer.speech_started":
          setIsUserSpeaking(true);
          break;
        case "input_audio_buffer.speech_stopped":
          setIsUserSpeaking(false);
          break;
        case "response.done":
        case "response.completed":
        case "response.output_item.done":
          advisorRespondingRef.current = false;
          break;
        default:
          break;
      }
    },
    onError: (error) => {
      advisorRespondingRef.current = false;
      setSessionError(error.message || "Realtime session error.");
    },
    onConnectionStateChange: (state) => {
      if (state === "idle") {
        setSessionState("idle");
        return;
      }
      if (state === "connecting") {
        setSessionState("connecting");
        return;
      }
      if (state === "connected") {
        setSessionState("live");
        return;
      }
      setSessionState((prev) => (prev === "idle" ? prev : "ended"));
    },
  });

  const stopSession = () => {
    endRealtimeCall();
    setIsUserSpeaking(false);
    advisorRespondingRef.current = false;
    setSessionState(prev => (prev === "idle" ? prev : "ended"));
  };

  const finishRoleplay = () => {
    if (endingRef.current) return;
    endingRef.current = true;
    stopSession();
    onScorecard(sanitizeTranscript(transcriptRef.current));
  };

  const requestAdvisorResponse = () => {
    if (endingRef.current || advisorRespondingRef.current) {
      return;
    }

    advisorRespondingRef.current = true;
    sendRealtimeEvent({
      type: "response.create",
    });
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript, liveFeedback]);

  useEffect(() => () => {
    endRealtimeCall();
  }, []);

  useEffect(() => {
    if (completedTranscript.length < 2 || endingRef.current) return;

    const requestId = feedbackRequestIdRef.current + 1;
    feedbackRequestIdRef.current = requestId;

    const timeout = window.setTimeout(async () => {
      setIsFeedbackLoading(true);
      try {
        const res = await fetch("/api/agents/coach-me/live-feedback-v2", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scenario: normalizedScenario,
            meetingContext: {
              leadName: meeting.leadName,
              leadCompany: meeting.leadCompany,
              purpose: meeting.purpose,
            },
            transcript: completedTranscript,
          }),
        });

        if (!res.ok) throw new Error("Live feedback request failed");
        const data = await res.json() as LiveFeedback;
        if (feedbackRequestIdRef.current === requestId) {
          setLiveFeedback(data);
        }
      } catch (error) {
        console.error("Live coach feedback failed:", error);
      } finally {
        if (feedbackRequestIdRef.current === requestId) {
          setIsFeedbackLoading(false);
        }
      }
    }, 1400);

    return () => window.clearTimeout(timeout);
  }, [completedTranscript, meeting.leadCompany, meeting.leadName, meeting.purpose, normalizedScenario]);

  const maybeDetectEnd = async (nextTranscript: ConversationTurn[], latestUtterance: string) => {
    try {
      const res = await fetch("/api/agents/coach-me/should-end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario: normalizedScenario,
          transcript: nextTranscript,
          latestUtterance,
        }),
      });

      if (!res.ok) {
        requestAdvisorResponse();
        return;
      }
      const data = await res.json() as ShouldEndResult;
      if (data.shouldEnd && (data.confidence ?? 0) >= 70) {
        finishRoleplay();
      } else {
        requestAdvisorResponse();
      }
    } catch (error) {
      console.error("Coach should-end detection failed:", error);
      requestAdvisorResponse();
    }
  };

  const startSession = async () => {
    if (sessionState === "connecting" || sessionState === "live") return;

    endingRef.current = false;
    advisorRespondingRef.current = false;
    setSessionError("");
    setLiveFeedback(null);
    applyTranscript([]);
    setSessionState("connecting");

    try {
      await startRealtimeCall(
        {
          scenario: normalizedScenario,
          meeting,
        },
        {
          sessionPath: "/api/realtime/coach-session",
          initialResponse: null,
        },
      );
    } catch (error) {
      console.error("Failed to start coach realtime session:", error);
      setSessionError(
        error instanceof Error
          ? parseApiErrorMessage(error.message)
          : "Could not start realtime practice.",
      );
      endRealtimeCall();
      setSessionState("ended");
    }
  };

  const statusLabel = (() => {
    if (sessionError) return "Session error";
    if (sessionState === "connecting") return "Connecting to gpt-realtime";
    if (sessionState === "live") {
      if (isUserSpeaking) return "Listening to you";
      return "You lead the conversation";
    }
    if (sessionState === "ended") return "Session ended";
    return "Ready to start";
  })();

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center justify-between border-b border-white/5 bg-card/30 px-4 py-3.5 backdrop-blur-sm md:px-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              stopSession();
              onBack();
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 transition-colors hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4 text-white" />
          </button>
          <div>
            <h2 className="text-base font-bold leading-tight text-white md:text-lg">{normalizedScenario.title}</h2>
            <p className="hidden text-xs text-muted-foreground md:block">{meeting.purpose}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowVgWay(true)}
            className="gap-2 border-white/10 bg-background/40 text-white hover:bg-background/60"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Show VG Way</span>
            <span className="sm:hidden">VG Way</span>
          </Button>
          <Button
            onClick={finishRoleplay}
            disabled={completedTranscript.length < 2}
            size="sm"
            className="gap-2 bg-violet-600 text-white shadow-lg shadow-violet-500/20 hover:bg-violet-500"
          >
            <Square className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">End &amp; Get Scorecard</span>
            <span className="sm:hidden">Scorecard</span>
          </Button>
        </div>
      </div>

      <div className="grid flex-1 overflow-hidden lg:grid-cols-[300px_minmax(0,1fr)_360px]">
        <aside className="hidden overflow-y-auto border-r border-white/5 bg-card/20 p-5 lg:block">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/30 to-blue-500/30 text-xl font-bold text-white">
            {initials}
          </div>
          <div className="mb-5 text-center">
              <h3 className="font-bold text-white">{visiblePersona.name}</h3>
              <p className="mt-0.5 text-xs text-violet-400">{visiblePersona.personaType}</p>
              <p className="text-xs text-muted-foreground">{visiblePersona.firm}</p>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border border-white/5 bg-background/40 p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Salesperson Brief</p>
              <p className="text-xs leading-relaxed text-white/80">{normalizedScenario.salespersonBrief}</p>
            </div>
            <div className="rounded-xl border border-white/5 bg-background/40 p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Start Instruction</p>
              <p className="text-xs leading-relaxed text-emerald-200">{normalizedScenario.startInstruction}</p>
            </div>
            <div className="rounded-xl border border-white/5 bg-background/40 p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Advisor Headline</p>
              <p className="text-xs leading-relaxed text-white/80">{visiblePersona.headline}</p>
            </div>
            <div className="rounded-xl border border-white/5 bg-background/40 p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Trainer Preview</p>
              <p className="text-xs font-semibold text-white">{trainerPreview.bestFitAngle}</p>
              <div className="mt-3 space-y-2">
                {trainerPreview.primaryPainPoints.map((item, index) => (
                  <div key={index} className="text-xs text-white/70">{item}</div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-white/5 bg-background/40 p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Likely Objections</p>
              <div className="space-y-2">
                {trainerPreview.likelyObjections.map((item, index) => (
                  <div key={index} className="text-xs text-white/70">{item}</div>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col overflow-hidden border-r border-white/5">
          <div className="border-b border-white/5 bg-card/15 px-4 py-4 md:px-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${
                  sessionState === "live" ? "border-emerald-400/30 bg-emerald-400/10" : "border-white/10 bg-white/5"
                }`}>
                  <Radio className={`h-4 w-4 ${sessionState === "live" ? "text-emerald-300" : "text-white/60"}`} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{statusLabel}</p>
                  <p className="text-xs text-muted-foreground">
                    You start the call. The simulated advisor stays in character and responds in realtime.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {sessionState !== "live" ? (
                  <Button
                    onClick={startSession}
                    disabled={sessionState === "connecting"}
                    className="gap-2 bg-violet-600 text-white hover:bg-violet-500"
                  >
                    {sessionState === "connecting" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <PhoneCall className="h-4 w-4" />
                        Start Realtime Practice
                      </>
                    )}
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      onClick={toggleMute}
                      className="gap-2 border-white/10 bg-background/40 text-white hover:bg-background/60"
                    >
                      {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                      {isMuted ? "Unmute" : "Mute"}
                    </Button>
                    <Button
                      onClick={finishRoleplay}
                      className="gap-2 bg-rose-500 text-white hover:bg-rose-400"
                    >
                      <PhoneOff className="h-4 w-4" />
                      End Session
                    </Button>
                  </>
                )}
              </div>
            </div>

            {sessionError && (
              <div className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                {sessionError}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-5 md:px-6">
            {transcript.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-dashed border-white/8 bg-card/20 p-10 text-center">
                <Volume2 className="mb-4 h-10 w-10 text-violet-400/70" />
                <h3 className="mb-2 text-lg font-semibold text-white">
                  {sessionState === "idle" ? "Start the session to begin" : sessionState === "connecting" ? "Connecting…" : "Waiting for conversation…"}
                </h3>
                <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
                  The conversation will appear here in real time as you speak.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {transcript.map((line) => (
                  <div
                    key={line.id}
                    className={`flex items-start gap-3 ${line.role === "user" ? "flex-row-reverse" : ""}`}
                  >
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      line.role === "user"
                        ? "bg-violet-500/20 border border-violet-500/30 text-violet-300"
                        : "bg-blue-500/20 border border-blue-500/30 text-blue-300"
                    }`}>
                      {line.role === "user" ? "You" : initials}
                    </div>
                    <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      line.role === "user"
                        ? "bg-violet-500/15 border border-violet-500/20 text-white rounded-tr-sm"
                        : "bg-white/5 border border-white/8 text-white/90 rounded-tl-sm"
                    } ${line.partial ? "opacity-60" : ""}`}>
                      {line.content}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            )}
          </div>
        </div>

        <aside className="overflow-y-auto bg-card/10 p-4 md:p-5">
          <div className="space-y-4">
            <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300/80">Sales Coach Live</p>
                  <p className="text-sm font-semibold text-white">Realtime analysis</p>
                </div>
                {isFeedbackLoading && <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />}
              </div>

              {!liveFeedback ? (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  The coach will start analyzing once the call has enough transcript to evaluate.
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl border border-white/5 bg-background/40 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Momentum</p>
                      <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-xs font-semibold text-cyan-300">
                        {typeof liveFeedback.currentScore === "number" ? `${liveFeedback.currentScore}/100` : "--"}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-white">{liveFeedback.momentum ?? "Building context"}</p>
                    <p className="mt-2 text-sm leading-relaxed text-white/80">{liveFeedback.snapshot}</p>
                  </div>

                  <div className="rounded-xl border border-white/5 bg-background/40 p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">What is working</p>
                    <div className="space-y-2">
                      {(liveFeedback.strengths ?? []).map((strength, index) => (
                        <div key={index} className="text-sm leading-relaxed text-white/85">
                          {strength}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/5 bg-background/40 p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fix next turn</p>
                    <div className="space-y-3">
                      {(liveFeedback.improveNow ?? []).map((item, index) => (
                        <div key={index} className="rounded-xl border border-amber-400/10 bg-amber-400/5 p-3">
                          <p className="text-sm font-semibold text-white">{item.title}</p>
                          <p className="mt-1 text-sm leading-relaxed text-white/75">{item.issue}</p>
                          <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-amber-300/80">Example</p>
                          <p className="mt-1 text-sm leading-relaxed text-amber-100">{item.example}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/5 bg-background/40 p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Next Best Question</p>
                    <p className="text-sm leading-relaxed text-white/90">{liveFeedback.nextBestQuestion}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      <AnimatePresence>
        {showVgWay && (
          <>
            <motion.button
              type="button"
              aria-label="Close VG Way panel"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowVgWay(false)}
              className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ opacity: 0, x: 32 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 32 }}
              transition={{ duration: 0.2 }}
              className="absolute right-0 top-0 z-10 flex h-full w-full max-w-xl flex-col border-l border-white/10 bg-[linear-gradient(180deg,rgba(10,18,31,0.98),rgba(7,13,24,0.98))] shadow-2xl"
            >
              <div className="flex items-start justify-between border-b border-white/8 px-5 py-4 md:px-6">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-300/70">Framework</p>
                  <h3 className="mt-1 text-lg font-bold text-white">VG Way</h3>
                  <p className="mt-1 max-w-md text-sm leading-relaxed text-white/65">
                    Use this during the call to keep the conversation consultative, specific, and headed toward a real next step.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowVgWay(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-5 md:px-6">
                <div className="mb-5 rounded-2xl border border-cyan-400/15 bg-cyan-400/6 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300/80">What strong reps do</p>
                  <p className="mt-2 text-sm leading-relaxed text-white/80">
                    Lead the agenda, earn discovery, connect the idea to the advisor's actual problem, summarize crisply, and leave with a shared next step.
                  </p>
                </div>

                <div className="space-y-3">
                  {VG_WAY_STAGES.map((stage, index) => (
                    <div key={stage.title} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-violet-400/20 bg-violet-400/10 text-sm font-bold text-violet-200">
                          {index + 1}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{stage.title}</p>
                          <p className="text-xs text-white/55">{stage.goal}</p>
                        </div>
                      </div>
                      <div className="mt-3 rounded-xl border border-emerald-400/10 bg-emerald-400/5 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300/80">What Good Looks Like</p>
                        <p className="mt-1.5 text-sm leading-relaxed text-emerald-50">{stage.goodLooksLike}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
