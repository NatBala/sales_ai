import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout";
import { resolveApiUrl } from "@/lib/api-url";
import { useMeetings } from "@/hooks/use-meetings";
import { useCreateTask } from "@/hooks/use-tasks";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useRealtimeCall } from "@/hooks/use-realtime-call";
import {
  CheckSquare,
  Loader2,
  Mic,
  MicOff,
  Radio,
  Sparkles,
  Tag,
} from "lucide-react";

interface FollowUpItem {
  title: string;
  actionType: string;
  tags: string[];
  owner: string;
  dueTiming: string;
  rationale: string;
}

interface FollowUpAnalysis {
  summary: string;
  tasks: string[];
  tags: string[];
  items: FollowUpItem[];
}

function mergeTranscript(existing: string, addition: string): string {
  const next = addition.trim();
  if (!next) return existing;
  if (!existing.trim()) return next;
  return `${existing.trim()}\n${next}`;
}

function encodeTaskDescription(item: FollowUpItem): string {
  const tags = item.tags.length > 0 ? `[${item.tags.join(" | ")}] ` : "";
  return `${tags}${item.title}`;
}

function parseTaskDescription(description: string): { tags: string[]; body: string } {
  const match = description.match(/^\[(.+?)\]\s*(.+)$/);
  if (!match) {
    return { tags: [], body: description };
  }

  return {
    tags: match[1].split("|").map((item) => item.trim()).filter(Boolean),
    body: match[2].trim(),
  };
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

function emptyAnalysis(): FollowUpAnalysis {
  return {
    summary: "",
    tasks: [],
    tags: [],
    items: [],
  };
}

export default function FollowMe() {
  const { data: meetingsData } = useMeetings();
  const { toast } = useToast();
  const mayaLeadIdRef = useRef(sessionStorage.getItem("maya_follow_lead"));
  if (mayaLeadIdRef.current) sessionStorage.removeItem("maya_follow_lead");
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);

  useEffect(() => {
    const leadId = mayaLeadIdRef.current;
    if (!leadId || !meetingsData?.meetings) return;
    const meeting = meetingsData.meetings.find(m => m.leadId === leadId || m.id === leadId);
    if (meeting) setSelectedMeetingId(meeting.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingsData]);
  const [notes, setNotes] = useState("");
  const [analysis, setAnalysis] = useState<FollowUpAnalysis | null>(null);
  const [partialUtterance, setPartialUtterance] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzingLive, setIsAnalyzingLive] = useState(false);
  const [isNormalizingTranscript, setIsNormalizingTranscript] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [sessionError, setSessionError] = useState("");
  const [sessionState, setSessionState] = useState<"idle" | "connecting" | "live" | "ended">("idle");

  const liveAnalysisRequestIdRef = useRef(0);
  const transcriptNormalizationRequestIdRef = useRef(0);

  const meetings = meetingsData?.meetings || [];
  const selectedMeeting = meetings.find((m) => m.id === selectedMeetingId);

  const { mutate: createTask } = useCreateTask(selectedMeetingId || "");

  const liveAnalysis = analysis ?? emptyAnalysis();
  const transcriptPreview = partialUtterance.trim()
    ? mergeTranscript(notes, partialUtterance)
    : notes;
  const isUserSpeaking = partialUtterance.trim().length > 0;

  const statusLabel = useMemo(() => {
    if (sessionError) return "Session error";
    if (sessionState === "connecting") return "Connecting live dictation";
    if (sessionState === "live") {
      return isUserSpeaking ? "Listening to your recap" : "Waiting for your next note";
    }
    if (sessionState === "ended") return "Dictation ended";
    return "Ready for live dictation";
  }, [isUserSpeaking, sessionError, sessionState]);

  const {
    startCall: startRealtimeCall,
    endCall: endRealtimeCall,
  } = useRealtimeCall({
    playbackWorkletPath: `${import.meta.env.BASE_URL}audio-playback-worklet.js`,
    captureWorkletPath: `${import.meta.env.BASE_URL}audio-capture-worklet.js`,
    onUserTranscriptDelta: (_delta, accumulated) => {
      setPartialUtterance(accumulated);
    },
    onUserTranscript: (transcript) => {
      const cleanedTranscript = transcript.trim();
      if (!cleanedTranscript) return;

      setPartialUtterance("");
      const requestId = transcriptNormalizationRequestIdRef.current + 1;
      transcriptNormalizationRequestIdRef.current = requestId;
      setIsNormalizingTranscript(true);

      void (async () => {
        try {
          const res = await fetch(resolveApiUrl("/api/agents/follow-me/normalize-transcript"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transcript: cleanedTranscript }),
          });

          if (!res.ok) {
            const errorText = await res.text();
            throw new Error(parseRequestError(errorText || "Failed to normalize transcript"));
          }

          const data = await res.json() as { correctedTranscript?: string };
          const correctedTranscript = (data.correctedTranscript ?? cleanedTranscript).trim();
          if (transcriptNormalizationRequestIdRef.current === requestId) {
            setNotes((prev) => mergeTranscript(prev, correctedTranscript));
          }
        } catch (error) {
          console.error("Failed to normalize Follow Me transcript:", error);
          if (transcriptNormalizationRequestIdRef.current === requestId) {
            setNotes((prev) => mergeTranscript(prev, cleanedTranscript));
          }
        } finally {
          if (transcriptNormalizationRequestIdRef.current === requestId) {
            setIsNormalizingTranscript(false);
          }
        }
      })();
    },
    onError: (error) => {
      setSessionError(error.message || "Realtime transcription error.");
    },
    onConnectionStateChange: (state) => {
      if (state === "connecting") {
        setSessionState("connecting");
      } else if (state === "connected") {
        setSessionState("live");
      } else if (state === "disconnected" || state === "error") {
        setSessionState("ended");
      }
    },
  });

  const stopSession = () => {
    endRealtimeCall();
    setPartialUtterance("");
    setSessionState((prev) => (prev === "idle" ? prev : "ended"));
  };

  useEffect(() => () => {
    stopSession();
  }, []);

  useEffect(() => {
    stopSession();
    setNotes("");
    setPartialUtterance("");
    setAnalysis(null);
    setAnalysisError("");
    setSessionError("");
    setSessionState("idle");
  }, [selectedMeetingId]);

  useEffect(() => {
    if (!selectedMeeting || !notes.trim()) {
      return;
    }

    const requestId = liveAnalysisRequestIdRef.current + 1;
    liveAnalysisRequestIdRef.current = requestId;

    const timeout = window.setTimeout(async () => {
      setIsAnalyzingLive(true);
      try {
        const res = await fetch(resolveApiUrl("/api/agents/follow-me/live"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leadName: selectedMeeting.leadName,
            leadCompany: selectedMeeting.leadCompany,
            meetingNotes: notes,
          }),
        });

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(parseRequestError(errorText || "Failed to analyze live notes"));
        }

        const data = await res.json() as FollowUpAnalysis;
        if (liveAnalysisRequestIdRef.current === requestId) {
          setAnalysis(data);
          setAnalysisError("");
        }
      } catch (error) {
        if (liveAnalysisRequestIdRef.current === requestId) {
          setAnalysisError(error instanceof Error ? error.message : "Failed to analyze live notes");
        }
      } finally {
        if (liveAnalysisRequestIdRef.current === requestId) {
          setIsAnalyzingLive(false);
        }
      }
    }, 1200);

    return () => window.clearTimeout(timeout);
  }, [notes, selectedMeeting]);

  const startListening = async () => {
    if (!selectedMeeting || sessionState === "connecting" || sessionState === "live") return;

    setSessionError("");
    setPartialUtterance("");
    setSessionState("connecting");
    await startRealtimeCall(
      {
        leadName: selectedMeeting.leadName,
        leadCompany: selectedMeeting.leadCompany,
        purpose: selectedMeeting.purpose,
      },
      {
        sessionPath: "/api/realtime/follow-me-session",
        initialResponse: null,
      },
    );
  };

  const handleGenerate = async () => {
    if (!selectedMeeting || !notes.trim()) return;

    setIsGenerating(true);
    setAnalysisError("");

    try {
      const res = await fetch(resolveApiUrl("/api/agents/follow-me"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingId: selectedMeeting.id,
          leadName: selectedMeeting.leadName,
          leadCompany: selectedMeeting.leadCompany,
          meetingNotes: notes,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(parseRequestError(errorText || "Failed to extract action items"));
      }

      const data = await res.json() as FollowUpAnalysis;
      setAnalysis(data);
    } catch (error) {
      console.error("Follow Me generation failed:", error);
      setAnalysisError(error instanceof Error ? error.message : "Failed to extract action items");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveAITasks = () => {
    if (!selectedMeetingId || !analysis) return;

    const itemsToSave = analysis.items.length > 0
      ? analysis.items.map((item) => encodeTaskDescription(item))
      : analysis.tasks;

    itemsToSave.forEach((description) => {
      createTask({ id: selectedMeetingId, data: { description } });
    });

    toast({
      title: "Tasks synced",
      description: "Follow-up items and tags were added to the tracker.",
    });
  };

  return (
    <Layout>
      <div className="mx-auto max-w-6xl space-y-8 pb-12">
        <div className="mb-8 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/10">
            <CheckSquare className="h-6 w-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-white">My Follow up</h1>
            <p className="text-muted-foreground">Dictate the meeting recap live and extract tagged follow-up items as you talk.</p>
          </div>
        </div>

        <div className="grid items-start gap-8 lg:grid-cols-[300px_1fr]">
          <Card className="sticky top-24 bg-card/40 border-white/5">
            <CardHeader className="border-b border-white/5 pb-3">
              <CardTitle className="text-lg text-white">Recent Meetings</CardTitle>
            </CardHeader>
            <div className="max-h-[600px] space-y-1 overflow-y-auto p-2">
              {meetings.map((meeting) => (
                <button
                  key={meeting.id}
                  onClick={() => setSelectedMeetingId(meeting.id)}
                  className={`w-full rounded-lg border p-3 text-left transition-all ${
                    selectedMeetingId === meeting.id
                      ? "border-amber-500/30 bg-amber-500/10"
                      : "border-transparent bg-transparent hover:bg-white/5"
                  }`}
                >
                  <div className={`font-medium ${selectedMeetingId === meeting.id ? "text-amber-400" : "text-white"}`}>
                    {meeting.leadName}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{meeting.purpose}</div>
                </button>
              ))}
            </div>
          </Card>

          {!selectedMeeting ? (
            <div className="flex h-[420px] flex-col items-center justify-center rounded-3xl border border-dashed border-white/5 bg-card/20 p-12 text-center">
              <CheckSquare className="mb-4 h-16 w-16 text-muted-foreground/20" />
              <p className="text-lg text-muted-foreground">Select a meeting to capture a recap and turn it into tagged follow-up work.</p>
            </div>
          ) : (
            <div className="space-y-6 min-w-0">
              <Card className="border-white/5 bg-card/40">
                <CardHeader className="border-b border-white/5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <CardTitle className="text-lg text-white">Meeting Recap Capture</CardTitle>
                      <CardDescription>
                        Dictate the recap in your own words. My Follow up will transcribe it live and classify the follow-up asks.
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                        sessionState === "live" ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200" : "border-white/10 bg-white/5 text-white/70"
                      }`}>
                        <Radio className="h-3.5 w-3.5" />
                        {statusLabel}
                      </div>
                      {sessionState !== "live" ? (
                        <Button
                          onClick={startListening}
                          className="gap-2 bg-amber-500 text-white hover:bg-amber-600"
                        >
                          {sessionState === "connecting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                          Start Dictation
                        </Button>
                      ) : (
                        <Button
                          onClick={stopSession}
                          variant="outline"
                          className="gap-2 border-white/10 bg-background/40 text-white hover:bg-background/60"
                        >
                          <MicOff className="h-4 w-4" />
                          Stop Dictation
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-5">
                  {sessionError && (
                    <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
                      {sessionError}
                    </div>
                  )}

                  <Textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Dictate or type notes like: send market outlook email, share active-vs-index fund comparison, invite advisor to practice management webinar..."
                    className="min-h-[180px] resize-y border-white/10 bg-background/50 text-white"
                  />

                  <div className="rounded-2xl border border-white/5 bg-background/35 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Live Transcript Preview</p>
                      <div className="flex items-center gap-2">
                        {isNormalizingTranscript && <span className="text-[11px] font-semibold text-amber-200">Correcting transcript</span>}
                        {(isAnalyzingLive || isNormalizingTranscript) && <Loader2 className="h-4 w-4 animate-spin text-amber-300" />}
                      </div>
                    </div>
                    <p className="min-h-[56px] whitespace-pre-wrap text-sm leading-relaxed text-white/80">
                      {transcriptPreview || "Start dictation or type notes to see the captured recap here."}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      onClick={handleGenerate}
                      disabled={isGenerating || !notes.trim()}
                      className="gap-2 bg-amber-500 text-white hover:bg-amber-600"
                    >
                      {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      Extract Follow-Up Items
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Live extraction updates as the transcript grows. Use the button for a final pass.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {analysisError && (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  {analysisError}
                </div>
              )}

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="border-amber-500/15 bg-amber-500/5">
                  <CardHeader className="border-b border-amber-500/10">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-lg text-amber-300">
                          <Sparkles className="h-5 w-5" /> Extracted Follow-Ups
                        </CardTitle>
                        <CardDescription>Tagged action items built from the dictated recap.</CardDescription>
                      </div>
                      <Button
                        size="sm"
                        onClick={handleSaveAITasks}
                        disabled={!analysis || (analysis.items.length === 0 && analysis.tasks.length === 0)}
                        variant="outline"
                        className="border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
                      >
                        Assign follow up tasks
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5 pt-5">
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-300/70">Summary</p>
                      <p className="text-sm leading-relaxed text-white/80">
                        {liveAnalysis.summary || "The live summary will appear here once notes are captured."}
                      </p>
                    </div>

                    <div>
                      <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-300/70">
                        <Tag className="h-3.5 w-3.5" /> Tags
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {liveAnalysis.tags.length > 0 ? liveAnalysis.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-100"
                          >
                            {tag}
                          </span>
                        )) : (
                          <span className="text-sm text-muted-foreground">Tags will populate once a clear action item is detected.</span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      {liveAnalysis.items.length > 0 ? liveAnalysis.items.map((item) => (
                        <div key={`${item.title}-${item.owner}`} className="rounded-2xl border border-white/8 bg-background/35 p-4">
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div className="space-y-2">
                              <p className="text-sm font-semibold text-white">{item.title}</p>
                              <div className="flex flex-wrap gap-2">
                                {item.tags.map((tag) => (
                                  <span
                                    key={`${item.title}-${tag}`}
                                    className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-white/80"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-200">
                              {item.actionType}
                            </span>
                          </div>
                          <div className="mt-3 grid gap-3 text-xs text-white/65 md:grid-cols-2">
                            <div>
                              <p className="mb-1 font-semibold uppercase tracking-wider text-muted-foreground">Owner</p>
                              <p>{item.owner}</p>
                            </div>
                            <div>
                              <p className="mb-1 font-semibold uppercase tracking-wider text-muted-foreground">Timing</p>
                              <p>{item.dueTiming}</p>
                            </div>
                          </div>
                          <p className="mt-3 text-sm leading-relaxed text-white/72">{item.rationale}</p>
                        </div>
                      )) : (
                        <div className="rounded-2xl border border-dashed border-white/8 bg-background/25 p-6 text-sm text-muted-foreground">
                          Dictate the recap and My Follow up will infer items like market outlook email, fund comparison follow-up, or webinar invite.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
