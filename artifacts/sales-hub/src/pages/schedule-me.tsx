import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/layout";
import { useParams, useLocation, Link } from "wouter";
import { useLead } from "@/hooks/use-leads";
import { useAgentScheduleMe } from "@/hooks/use-agents";
import { useCreateMeeting } from "@/hooks/use-meetings";
import { useVoiceRecorder } from "@workspace/integrations-openai-ai-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Calendar, Mail, Send, User, Sparkles, Mic, Square, Volume2, Building2, MapPin, TrendingUp, Zap, ArrowLeft, ExternalLink, Clock, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface AdvisorData {
  aumM: number; salesAmt: number; redemption: number;
  fiOpportunities: number; etfOpportunities: number; alpha: number;
  competitors: string[]; buyingUnit: string; territory: string;
  segment: string; ratings: number | null;
}

function parseAdvisorData(assets: string): AdvisorData | null {
  try {
    const obj = JSON.parse(assets) as { __advisorData?: AdvisorData };
    return obj.__advisorData ?? null;
  } catch { return null; }
}

function fmt(n: number): string {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
}

const SEGMENT_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  A: { label: "Top Tier",   color: "text-emerald-300", bg: "bg-emerald-500/10", border: "border-emerald-500/25" },
  B: { label: "High Value", color: "text-blue-300",    bg: "bg-blue-500/10",    border: "border-blue-500/25" },
  C: { label: "Mid-Market", color: "text-sky-300",     bg: "bg-sky-500/10",     border: "border-sky-500/25" },
  D: { label: "Developing", color: "text-amber-300",   bg: "bg-amber-500/10",   border: "border-amber-500/25" },
  E: { label: "Emerging",   color: "text-violet-300",  bg: "bg-violet-500/10",  border: "border-violet-500/25" },
};

interface Slot { label: string; day: string; time: string; dateStr: string; timeStr: string; }

const AVAILABLE_SLOTS: Slot[] = [
  { label: "Mon", day: "Mar 23", time: "8:00 AM",  dateStr: "2026-03-23", timeStr: "08:00" },
  { label: "Mon", day: "Mar 23", time: "2:00 PM",  dateStr: "2026-03-23", timeStr: "14:00" },
  { label: "Tue", day: "Mar 24", time: "9:30 AM",  dateStr: "2026-03-24", timeStr: "09:30" },
  { label: "Tue", day: "Mar 24", time: "3:00 PM",  dateStr: "2026-03-24", timeStr: "15:00" },
  { label: "Wed", day: "Mar 25", time: "9:00 AM",  dateStr: "2026-03-25", timeStr: "09:00" },
  { label: "Wed", day: "Mar 25", time: "12:00 PM", dateStr: "2026-03-25", timeStr: "12:00" },
  { label: "Thu", day: "Mar 26", time: "10:00 AM", dateStr: "2026-03-26", timeStr: "10:00" },
  { label: "Thu", day: "Mar 26", time: "4:30 PM",  dateStr: "2026-03-26", timeStr: "16:30" },
  { label: "Fri", day: "Mar 27", time: "12:00 PM", dateStr: "2026-03-27", timeStr: "12:00" },
  { label: "Fri", day: "Mar 27", time: "3:30 PM",  dateStr: "2026-03-27", timeStr: "15:30" },
];

type VoicePhase = "idle" | "recording" | "processing" | "done" | "error";

export default function ScheduleMe() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { data: lead, isLoading: leadLoading } = useLead(id!);
  const { mutate: generateEmail, isPending: isGenerating, data: generated } = useAgentScheduleMe();
  const { mutate: createMeeting, isPending: isCreating } = useCreateMeeting();
  const { toast } = useToast();

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [context, setContext] = useState("");
  const [hasGenerated, setHasGenerated] = useState(false);

  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  const [voiceMode, setVoiceMode] = useState(false);
  const [voicePhase, setVoicePhase] = useState<VoicePhase>("idle");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const { state: recorderState, startRecording, stopRecording } = useVoiceRecorder();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (generated && !hasGenerated) {
      setSubject(generated.subject);
      setBody(generated.body);
      if (generated.scheduledTime) {
        try {
          const d = new Date(generated.scheduledTime);
          setDate(format(d, "yyyy-MM-dd"));
          setTime(format(d, "HH:mm"));
        } catch(e) {}
      }
      setHasGenerated(true);
    }
  }, [generated, hasGenerated]);

  const handleGenerate = () => {
    if (!lead) return;
    setHasGenerated(false);
    generateEmail({
      data: {
        leadId: lead.id,
        leadName: lead.name,
        leadCompany: lead.company,
        leadTitle: lead.title,
        context: context || undefined
      }
    });
  };

  const handleVoiceDraft = async () => {
    if (!lead) return;

    if (recorderState === "idle" || recorderState === "stopped") {
      try {
        setVoicePhase("recording");
        setVoiceTranscript("");
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
        try {
          const res = await fetch("/api/agents/schedule-me/voice", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              audio: base64,
              leadName: lead.name,
              leadCompany: lead.company,
              leadTitle: lead.title,
            }),
          });

          if (!res.ok) throw new Error("Voice generation failed");

          const data = await res.json();
          setVoiceTranscript(data.transcript ?? "");
          setContext(data.transcript ?? "");

          if (data.subject) {
            setSubject(data.subject);
            setHasGenerated(true);
          }
          if (data.body) setBody(data.body);

          if (data.audioBase64) {
            const audio = new Audio(`data:audio/mp3;base64,${data.audioBase64}`);
            audioRef.current = audio;
            audio.play().catch(() => {});
          }

          setVoicePhase("done");
        } catch (err) {
          setVoicePhase("error");
          toast({ title: "Voice Error", description: "Could not process your voice input.", variant: "destructive" });
        }
      };
    }
  };

  const handleSchedule = () => {
    if (!lead || !date || !time) {
      toast({ title: "Error", description: "Please select a date and time.", variant: "destructive" });
      return;
    }

    const scheduledAt = new Date(`${date}T${time}`).toISOString();

    createMeeting({
      data: {
        leadId: lead.id,
        leadName: lead.name,
        leadCompany: lead.company,
        scheduledAt,
        purpose: "Initial Outreach Call",
        emailSubject: subject,
        emailBody: body
      }
    }, {
      onSuccess: () => {
        toast({ title: "Meeting Scheduled!", description: "The outreach email has been queued." });
        setLocation("/prep-me");
      }
    });
  };

  if (leadLoading) {
    return <Layout><div className="flex justify-center p-24"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></Layout>;
  }

  if (!lead) {
    return <Layout><div className="text-center p-24 text-white">Lead not found. Please select a lead first.</div></Layout>;
  }

  const isRecording = recorderState === "recording";
  const isProcessing = voicePhase === "processing";
  const advisor = parseAdvisorData(lead.assets ?? "");
  const seg = advisor ? (SEGMENT_CONFIG[advisor.segment] ?? SEGMENT_CONFIG.C) : null;

  return (
    <Layout>
      <div className="space-y-6 max-w-5xl mx-auto pb-12">

        {/* Back nav */}
        <Link href="/leads" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Pipeline
        </Link>

        {/* ── Advisor Card (top, always first) ───────────────────────────── */}
        <Card className="bg-card/50 border-teal-400/20 overflow-hidden relative"
          style={{ borderTop: "3px solid rgba(45,212,191,0.5)" }}>
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ background: "radial-gradient(ellipse at top left, #2dd4bf, transparent 60%)" }} />
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-5 items-start">
              {/* Avatar */}
              <div className="w-14 h-14 rounded-2xl bg-teal-400/10 border border-teal-400/25 flex items-center justify-center shrink-0">
                <span className="text-2xl font-bold text-teal-400">{lead.name[0]}</span>
              </div>

              {/* Name + details */}
              <div className="flex-1 min-w-0 space-y-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2.5 mb-1">
                    <p className="text-[11px] uppercase tracking-widest text-teal-400/70 font-semibold">Scheduling with</p>
                  </div>
                  <h2 className="text-2xl font-display font-bold text-white">{lead.name}</h2>
                  <div className="flex flex-wrap items-center gap-3 mt-1.5">
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Building2 className="w-3.5 h-3.5 text-teal-400/60" /> {lead.company}
                    </span>
                    {lead.location && (
                      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="w-3.5 h-3.5 text-teal-400/60" /> {lead.location}
                      </span>
                    )}
                    {seg && advisor && (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${seg.bg} ${seg.border} ${seg.color}`}>
                        Seg {advisor.segment} · {seg.label}
                      </span>
                    )}
                  </div>
                </div>

                {/* Metrics row */}
                {advisor && (
                  <div className="flex flex-wrap gap-3">
                    {[
                      { icon: TrendingUp, label: "AUM",   value: `$${advisor.aumM.toFixed(1)}M`, color: "text-blue-400" },
                      { icon: Zap,        label: "Alpha",  value: fmt(advisor.alpha),              color: "text-violet-400" },
                      { icon: Calendar,   label: "FI Opp", value: fmt(advisor.fiOpportunities),   color: "text-teal-400" },
                      { icon: Calendar,   label: "ETF Opp",value: fmt(advisor.etfOpportunities),  color: "text-purple-400" },
                    ].map((m, i) => (
                      <div key={i} className="flex items-center gap-2 bg-white/4 border border-white/8 rounded-xl px-3 py-2">
                        <m.icon className={`w-3.5 h-3.5 ${m.color}`} />
                        <div className="text-xs">
                          <span className="text-muted-foreground">{m.label}: </span>
                          <span className={`font-bold ${m.color}`}>{m.value}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Fit score + profile link */}
              <div className="flex flex-col items-center gap-2 shrink-0">
                <div className="bg-primary/10 border border-primary/25 rounded-2xl px-5 py-3 text-center">
                  <p className="text-3xl font-bold text-white">{lead.score}</p>
                  <p className="text-[10px] text-primary uppercase tracking-wider font-semibold">Fit Score</p>
                </div>
                <Button asChild variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-white w-full">
                  <Link href={`/leads/${lead.id}`}>
                    <ExternalLink className="w-3 h-3 mr-1" /> Full Profile
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Page header */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-teal-400/10 border border-teal-400/20 flex items-center justify-center">
            <Calendar className="w-6 h-6 text-teal-400" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-white">Schedule Me</h1>
            <p className="text-muted-foreground">Draft outreach and schedule a meeting.</p>
          </div>
        </div>

        <div className="grid md:grid-cols-[1fr_350px] gap-8">
          {/* Main Email Area */}
          <div className="space-y-6">
            <Card className="bg-card/40 border-white/5">
              <CardHeader className="border-b border-white/5 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2 text-white">
                      <Sparkles className="w-5 h-5 text-primary" /> AI Draft Generation
                    </CardTitle>
                    <CardDescription className="mt-1">Type context or use your voice to draft.</CardDescription>
                  </div>
                  <div className="flex items-center gap-1 bg-background/50 rounded-lg p-1 border border-white/10">
                    <button
                      onClick={() => { setVoiceMode(false); setVoicePhase("idle"); }}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                        !voiceMode ? "bg-primary text-white shadow" : "text-muted-foreground hover:text-white"
                      )}
                    >
                      <Mail className="w-3.5 h-3.5" /> Text
                    </button>
                    <button
                      onClick={() => setVoiceMode(true)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                        voiceMode ? "bg-teal-500 text-white shadow" : "text-muted-foreground hover:text-white"
                      )}
                    >
                      <Mic className="w-3.5 h-3.5" /> Voice
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                {!voiceMode ? (
                  <div className="flex gap-4">
                    <Input
                      placeholder="e.g. Mention their recent Series B, suggest next Tuesday..."
                      value={context}
                      onChange={e => setContext(e.target.value)}
                      className="bg-background border-white/10 text-white"
                    />
                    <Button
                      onClick={handleGenerate}
                      disabled={isGenerating}
                      className="shrink-0"
                    >
                      {isGenerating ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Sparkles className="w-4 h-4 mr-2"/>}
                      Generate Draft
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Voice Prompt */}
                    <div className="flex flex-col items-center gap-6 py-6">
                      {voicePhase === "idle" || voicePhase === "done" || voicePhase === "error" ? (
                        <div className="text-center space-y-2">
                          <p className="text-sm text-muted-foreground">
                            {voicePhase === "done"
                              ? "Draft generated! Tap mic to record again."
                              : "Speak your outreach context — mention key topics, timing, or angle."}
                          </p>
                        </div>
                      ) : null}

                      <button
                        onClick={handleVoiceDraft}
                        disabled={isProcessing}
                        className={cn(
                          "relative w-24 h-24 rounded-full flex items-center justify-center transition-all focus:outline-none",
                          isRecording
                            ? "bg-red-500 shadow-[0_0_0_12px_rgba(239,68,68,0.15),0_0_0_24px_rgba(239,68,68,0.07)] animate-pulse"
                            : isProcessing
                            ? "bg-teal-500/20 border-2 border-teal-500/30 cursor-wait"
                            : voicePhase === "done"
                            ? "bg-teal-500/20 border-2 border-teal-500/40 hover:bg-teal-500/30"
                            : "bg-teal-500/10 border-2 border-teal-500/30 hover:bg-teal-500/20 hover:border-teal-500/50"
                        )}
                      >
                        {isProcessing ? (
                          <Loader2 className="w-9 h-9 text-teal-400 animate-spin" />
                        ) : isRecording ? (
                          <Square className="w-9 h-9 text-white fill-white" />
                        ) : voicePhase === "done" ? (
                          <Volume2 className="w-9 h-9 text-teal-400" />
                        ) : (
                          <Mic className="w-9 h-9 text-teal-400" />
                        )}
                      </button>

                      <p className="text-sm font-medium text-center">
                        {isRecording ? (
                          <span className="text-red-400 flex items-center gap-2">
                            <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse" /> Recording — tap to stop
                          </span>
                        ) : isProcessing ? (
                          <span className="text-teal-400">Transcribing & drafting email…</span>
                        ) : voicePhase === "done" ? (
                          <span className="text-teal-400 flex items-center gap-2">
                            <Volume2 className="w-4 h-4" /> Email drafted & read back
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Tap to start recording</span>
                        )}
                      </p>
                    </div>

                    {/* Transcript */}
                    {voiceTranscript && (
                      <div className="bg-teal-500/5 border border-teal-500/15 rounded-xl p-4">
                        <p className="text-xs text-teal-400 uppercase tracking-wider font-medium mb-2">Your voice context</p>
                        <p className="text-sm text-white/80 leading-relaxed italic">"{voiceTranscript}"</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="glass-panel border-white/10 shadow-2xl">
              <CardHeader className="bg-background/50 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-muted-foreground">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">To: {lead.name} &lt;{lead.email || 'unknown@email.com'}&gt;</div>
                    <div className="text-xs text-muted-foreground">{lead.title} at {lead.company}</div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Subject</label>
                  <Input
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    placeholder="Email subject..."
                    className="text-lg font-medium border-0 border-b border-white/10 rounded-none px-0 focus-visible:ring-0 bg-transparent text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Message Body</label>
                  <Textarea
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    placeholder="Email body will appear here..."
                    className="min-h-[300px] resize-none bg-transparent border-0 px-0 focus-visible:ring-0 text-white/90 text-base leading-relaxed"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar Scheduling */}
          <div className="space-y-6">
            <Card className="bg-card/40 border-white/5 sticky top-24">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-teal-400" /> Meeting Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">

                {/* ── Available Slots ── */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-3.5 h-3.5 text-teal-400" />
                    <p className="text-xs font-semibold uppercase tracking-wider text-teal-400">Available Slots</p>
                    <span className="ml-auto text-[10px] text-muted-foreground">Mar 23–27</span>
                  </div>

                  {/* Group by day */}
                  {(["Mon", "Tue", "Wed", "Thu", "Fri"] as const).map(day => {
                    const daySlots = AVAILABLE_SLOTS.filter(s => s.label === day);
                    const dayLabel = daySlots[0];
                    return (
                      <div key={day} className="mb-3 last:mb-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5">
                          {day} · {dayLabel?.day}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {daySlots.map(slot => {
                            const isSelected = selectedSlot?.dateStr === slot.dateStr && selectedSlot?.timeStr === slot.timeStr;
                            return (
                              <button
                                key={`${slot.dateStr}-${slot.timeStr}`}
                                onClick={() => {
                                  setSelectedSlot(slot);
                                  setDate(slot.dateStr);
                                  setTime(slot.timeStr);
                                }}
                                className={cn(
                                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                                  isSelected
                                    ? "bg-teal-500/20 border-teal-400/50 text-teal-300"
                                    : "bg-white/4 border-white/10 text-white/70 hover:bg-white/8 hover:border-white/20 hover:text-white"
                                )}
                              >
                                {isSelected && <CheckCircle2 className="w-3 h-3 text-teal-400" />}
                                <Clock className={cn("w-3 h-3", isSelected ? "text-teal-400" : "text-muted-foreground")} />
                                {slot.time}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-white/5 pt-4 space-y-4">
                  <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold">Or pick manually</p>
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">Date</label>
                    <Input
                      type="date"
                      value={date}
                      onChange={e => { setDate(e.target.value); setSelectedSlot(null); }}
                      className="bg-background/50 border-white/10 text-white [color-scheme:dark]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">Time</label>
                    <Input
                      type="time"
                      value={time}
                      onChange={e => { setTime(e.target.value); setSelectedSlot(null); }}
                      className="bg-background/50 border-white/10 text-white [color-scheme:dark]"
                    />
                  </div>
                </div>

                {/* Selected slot summary */}
                {selectedSlot && (
                  <div className="flex items-center gap-2 bg-teal-500/8 border border-teal-500/20 rounded-xl px-3 py-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                    <p className="text-xs text-teal-300 font-medium">
                      {selectedSlot.label} {selectedSlot.day} at {selectedSlot.time} selected
                    </p>
                  </div>
                )}

                <div className="pt-2 border-t border-white/5">
                  <Button
                    onClick={handleSchedule}
                    disabled={isCreating || !subject || !body}
                    className="w-full h-12 text-base font-semibold shadow-lg shadow-primary/20"
                  >
                    {isCreating ? <Loader2 className="w-5 h-5 animate-spin mr-2"/> : <Send className="w-5 h-5 mr-2"/>}
                    Send & Schedule
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

        </div>
      </div>
    </Layout>
  );
}
