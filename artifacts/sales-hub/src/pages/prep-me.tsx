import { useState, useRef } from "react";
import { Layout } from "@/components/layout";
import { useMeetings } from "@/hooks/use-meetings";
import { useAgentPrepMe } from "@/hooks/use-agents";
import { useVoiceRecorder } from "@workspace/integrations-openai-ai-react";
import type { Meeting } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, Calendar as CalendarIcon, Users, ListChecks, MessageSquare, AlertCircle, ArrowRight, BrainCircuit, Mic, Square, Volume2 } from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type VoicePhase = "idle" | "recording" | "processing" | "done" | "error";

interface PrepResult {
  agenda: string[];
  talkingPoints: string[];
  clientBackground: string;
  keyObjections: string[];
}

export default function PrepMe() {
  const { data: meetingsData, isLoading: meetingsLoading } = useMeetings();
  const { mutate: generatePrep, isPending, data: hookPrepData } = useAgentPrepMe();
  const { toast } = useToast();

  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [voicePrepData, setVoicePrepData] = useState<PrepResult | null>(null);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voicePhase, setVoicePhase] = useState<VoicePhase>("idle");

  const { state: recorderState, startRecording, stopRecording } = useVoiceRecorder();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const meetings = meetingsData?.meetings?.filter(m => m.status === "scheduled") || [];
  const selectedMeeting = meetings.find(m => m.id === selectedMeetingId);

  const prepData = voicePrepData ?? (hookPrepData as PrepResult | undefined);

  const handleManualGenerate = (meeting: Meeting) => {
    setSelectedMeetingId(meeting.id);
    setVoicePrepData(null);
    generatePrep({
      data: {
        meetingId: meeting.id,
        leadName: meeting.leadName,
        leadCompany: meeting.leadCompany,
        meetingDate: meeting.scheduledAt,
        meetingPurpose: meeting.purpose
      }
    });
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
    } else if (recorderState === "recording") {
      const blob = await stopRecording();
      setVoicePhase("processing");

      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(",")[1];

        const meetingsList = meetings.map(m => ({
          id: m.id,
          leadName: m.leadName,
          leadCompany: m.leadCompany,
          scheduledAt: m.scheduledAt,
          purpose: m.purpose,
        }));

        try {
          const res = await fetch("/api/agents/prep-me/voice", {
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
    }
  };

  const isRecording = recorderState === "recording";
  const isProcessing = voicePhase === "processing";

  return (
    <Layout>
      <div className="space-y-8 max-w-6xl mx-auto pb-12">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-indigo-400/10 border border-indigo-400/20 flex items-center justify-center">
            <FileText className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-white">Prep Me</h1>
            <p className="text-muted-foreground">Generate comprehensive briefs for upcoming meetings.</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-[350px_1fr] gap-8 items-start">

          {/* Upcoming Meetings List + Voice */}
          <div className="space-y-4 sticky top-24">

            {/* Voice Prep Card */}
            <Card className="bg-indigo-500/5 border border-indigo-500/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-indigo-300 flex items-center gap-2 uppercase tracking-wider">
                  <Mic className="w-4 h-4" /> Voice Prep
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Say a client name to auto-prep — e.g. <span className="text-indigo-300 italic">"Prep me for Miguel, focus on ESG"</span>
                </p>

                <div className="flex flex-col items-center gap-4 py-2">
                  <button
                    onClick={handleVoicePrep}
                    disabled={isProcessing || meetingsLoading}
                    className={cn(
                      "relative w-16 h-16 rounded-full flex items-center justify-center transition-all focus:outline-none",
                      isRecording
                        ? "bg-red-500 shadow-[0_0_0_8px_rgba(239,68,68,0.15),0_0_0_16px_rgba(239,68,68,0.07)] animate-pulse"
                        : isProcessing
                        ? "bg-indigo-500/20 border-2 border-indigo-500/30 cursor-wait"
                        : voicePhase === "done"
                        ? "bg-indigo-500/20 border-2 border-indigo-500/40 hover:bg-indigo-500/30"
                        : "bg-indigo-500/10 border-2 border-indigo-500/30 hover:bg-indigo-500/20 hover:border-indigo-500/50"
                    )}
                  >
                    {isProcessing ? (
                      <Loader2 className="w-7 h-7 text-indigo-400 animate-spin" />
                    ) : isRecording ? (
                      <Square className="w-7 h-7 text-white fill-white" />
                    ) : voicePhase === "done" ? (
                      <Volume2 className="w-7 h-7 text-indigo-400" />
                    ) : (
                      <Mic className="w-7 h-7 text-indigo-400" />
                    )}
                  </button>

                  <p className="text-xs text-center">
                    {isRecording ? (
                      <span className="text-red-400 flex items-center gap-1.5 justify-center">
                        <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" /> Recording — tap to stop
                      </span>
                    ) : isProcessing ? (
                      <span className="text-indigo-400">Transcribing & generating…</span>
                    ) : voicePhase === "done" ? (
                      <span className="text-indigo-400">Brief ready!</span>
                    ) : (
                      <span className="text-muted-foreground">Tap mic to start</span>
                    )}
                  </p>
                </div>

                {voiceTranscript && (
                  <div className="bg-indigo-500/5 border border-indigo-500/15 rounded-lg p-3">
                    <p className="text-xs text-indigo-400 mb-1 font-medium">Heard:</p>
                    <p className="text-xs text-white/70 italic">"{voiceTranscript}"</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Meetings List */}
            <Card className="bg-card/40 border-white/5">
              <CardHeader>
                <CardTitle className="text-base text-white">Or tap a meeting</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {meetingsLoading ? (
                  <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                ) : meetings.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-8">No scheduled meetings found.</div>
                ) : (
                  meetings.map(meeting => (
                    <button
                      key={meeting.id}
                      onClick={() => handleManualGenerate(meeting)}
                      className={cn(
                        "w-full text-left p-4 rounded-xl border transition-all",
                        selectedMeetingId === meeting.id
                          ? "bg-indigo-500/10 border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.15)]"
                          : "bg-background/50 border-white/5 hover:border-white/15 hover:bg-secondary/50"
                      )}
                    >
                      <div className="font-semibold text-white mb-1">{meeting.leadName}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-1.5 mb-2">
                        <Users className="w-3.5 h-3.5" /> {meeting.leadCompany}
                      </div>
                      <div className="text-xs font-medium text-indigo-400 bg-indigo-400/10 inline-flex items-center px-2 py-1 rounded-md">
                        <CalendarIcon className="w-3 h-3 mr-1.5" />
                        {format(new Date(meeting.scheduledAt), "MMM d, h:mm a")}
                      </div>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Prep Content Area */}
          <div className="min-h-[500px]">
            {(isPending && !voicePrepData) ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-card/20 rounded-3xl border border-white/5 border-dashed">
                <Loader2 className="w-12 h-12 text-indigo-400 animate-spin mb-6" />
                <h3 className="text-xl font-semibold text-white mb-2">Synthesizing Brief...</h3>
                <p className="text-muted-foreground max-w-sm">Analyzing CRM data, recent news, and financial profiles to build your battle plan.</p>
              </div>
            ) : !prepData ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-card/20 rounded-3xl border border-white/5 border-dashed">
                <FileText className="w-16 h-16 text-muted-foreground/20 mb-4" />
                <p className="text-muted-foreground text-lg mb-3">Select a meeting or use your voice to generate a prep brief.</p>
                <p className="text-sm text-muted-foreground/60">Try: "Prep me for [client name], focus on [topic]"</p>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between bg-card/40 border border-white/5 p-6 rounded-2xl">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-2xl font-bold text-white">Brief: {selectedMeeting?.leadName}</h2>
                        {voicePrepData && (
                          <span className="text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Volume2 className="w-3 h-3" /> Voice generated
                          </span>
                        )}
                      </div>
                      <p className="text-muted-foreground">{selectedMeeting?.purpose}</p>
                    </div>
                    <Button variant="outline" className="border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10">
                      Export PDF
                    </Button>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Background */}
                    <Card className="bg-card/40 border-white/5 md:col-span-2">
                      <CardHeader className="border-b border-white/5 bg-background/30 pb-4">
                        <CardTitle className="text-lg flex items-center gap-2 text-white">
                          <Users className="w-5 h-5 text-indigo-400" /> Client Background
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <p className="text-white/80 leading-relaxed text-[15px]">{prepData.clientBackground}</p>
                      </CardContent>
                    </Card>

                    {/* Agenda */}
                    <Card className="bg-card/40 border-white/5">
                      <CardHeader className="border-b border-white/5 bg-background/30 pb-4">
                        <CardTitle className="text-lg flex items-center gap-2 text-white">
                          <ListChecks className="w-5 h-5 text-teal-400" /> Proposed Agenda
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <ul className="space-y-3">
                          {prepData.agenda.map((item, i) => (
                            <li key={i} className="flex gap-3 text-white/80">
                              <span className="shrink-0 w-6 h-6 rounded-full bg-teal-400/10 text-teal-400 flex items-center justify-center text-xs font-bold">{i+1}</span>
                              <span className="mt-0.5">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>

                    {/* Talking Points */}
                    <Card className="bg-card/40 border-white/5">
                      <CardHeader className="border-b border-white/5 bg-background/30 pb-4">
                        <CardTitle className="text-lg flex items-center gap-2 text-white">
                          <MessageSquare className="w-5 h-5 text-blue-400" /> Key Talking Points
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <ul className="space-y-3 list-disc pl-5">
                          {prepData.talkingPoints.map((item, i) => (
                            <li key={i} className="text-white/80 leading-relaxed pl-1 marker:text-blue-400">{item}</li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>

                    {/* Objections */}
                    <Card className="bg-card/40 border-white/5 md:col-span-2 border-l-4 border-l-rose-500">
                      <CardHeader className="border-b border-white/5 bg-background/30 pb-4">
                        <CardTitle className="text-lg flex items-center gap-2 text-white">
                          <AlertCircle className="w-5 h-5 text-rose-500" /> Anticipated Objections
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <div className="grid md:grid-cols-2 gap-4">
                          {prepData.keyObjections.map((item, i) => (
                            <div key={i} className="bg-rose-500/5 border border-rose-500/10 rounded-xl p-4 text-white/80 text-sm leading-relaxed">
                              {item}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                  </div>

                  {/* Next Step CTA */}
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="flex items-center justify-between gap-4 bg-violet-500/5 border border-violet-500/25 rounded-2xl p-5"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-violet-400/10 border border-violet-400/20 flex items-center justify-center shrink-0">
                        <BrainCircuit className="w-5 h-5 text-violet-400" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Next Step</p>
                        <p className="text-sm font-semibold text-white">Coach Me — Practice objections and sharpen your pitch</p>
                      </div>
                    </div>
                    <Button asChild className="shrink-0 bg-violet-500 hover:bg-violet-400 text-white shadow-lg shadow-violet-500/20">
                      <Link href="/coach-me">
                        Launch <ArrowRight className="w-4 h-4 ml-1.5" />
                      </Link>
                    </Button>
                  </motion.div>

                </motion.div>
              </AnimatePresence>
            )}
          </div>

        </div>
      </div>
    </Layout>
  );
}
