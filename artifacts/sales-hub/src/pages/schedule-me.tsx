import { useState, useEffect, useRef, useCallback } from "react";
import { Layout } from "@/components/layout";
import { useParams, useLocation, Link } from "wouter";
import { useLead } from "@/hooks/use-leads";
import { useCreateMeeting } from "@/hooks/use-meetings";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2, ArrowLeft, Building2, MapPin, TrendingUp, Zap,
  Calendar, ExternalLink, PhoneCall, PhoneOff, Mic, MicOff,
  CheckCircle2, Sparkles, Volume2, Radio, SquareActivity,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

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

type CallStatus = "idle" | "connecting" | "live" | "ended";
type Speaker = "agent" | "user";

interface TranscriptLine {
  id: string;
  speaker: Speaker;
  text: string;
  partial?: boolean;
}

interface BookingProposal {
  date: string;
  time: string;
  dayLabel: string;
  timeLabel: string;
  agendaTopic: string;
}

function WaveformBars({ active, color = "teal" }: { active: boolean; color?: string }) {
  const barCount = 12;
  return (
    <div className="flex items-center gap-[3px] h-10">
      {Array.from({ length: barCount }).map((_, i) => (
        <motion.div
          key={i}
          className={`w-1.5 rounded-full bg-${color}-400`}
          animate={active ? {
            scaleY: [0.2, 1, 0.3, 0.8, 0.15, 0.9, 0.4, 1],
            opacity: [0.5, 1, 0.6, 1, 0.5, 1, 0.7, 1],
          } : { scaleY: 0.2, opacity: 0.3 }}
          transition={active ? {
            duration: 1.2 + (i % 4) * 0.15,
            repeat: Infinity,
            repeatType: "mirror",
            ease: "easeInOut",
            delay: i * 0.07,
          } : { duration: 0.3 }}
          style={{ height: 40, transformOrigin: "center" }}
        />
      ))}
    </div>
  );
}

function PulsingRing({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <>
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          className="absolute inset-0 rounded-full border-2 border-teal-400/30"
          initial={{ scale: 1, opacity: 0.6 }}
          animate={{ scale: 1.8 + i * 0.4, opacity: 0 }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: i * 0.6,
            ease: "easeOut",
          }}
        />
      ))}
    </>
  );
}

function CallTimer({ startTime }: { startTime: Date | null }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startTime) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  return <span className="font-mono text-sm text-teal-300">{mm}:{ss}</span>;
}

export default function ScheduleMe() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { data: lead, isLoading: leadLoading } = useLead(id!);
  const { mutate: createMeeting, isPending: isCreating } = useCreateMeeting();
  const { toast } = useToast();

  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [booking, setBooking] = useState<BookingProposal | null>(null);
  const [callStartTime, setCallStartTime] = useState<Date | null>(null);
  const [statusText, setStatusText] = useState("Ready to connect");

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const agentItemIdRef = useRef<string | null>(null);

  const advisor = lead ? parseAdvisorData(lead.assets ?? "") : null;
  const seg = advisor ? (SEGMENT_CONFIG[advisor.segment] ?? SEGMENT_CONFIG.C) : null;

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  const addTranscriptLine = useCallback((speaker: Speaker, text: string, partial = false, itemId?: string) => {
    setTranscript(prev => {
      if (partial && itemId) {
        const existingIdx = prev.findIndex(l => l.id === itemId);
        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = { ...updated[existingIdx], text, partial };
          return updated;
        }
        return [...prev, { id: itemId ?? crypto.randomUUID(), speaker, text, partial }];
      }
      if (itemId) {
        const existingIdx = prev.findIndex(l => l.id === itemId);
        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = { id: itemId, speaker, text, partial: false };
          return updated;
        }
      }
      return [...prev, { id: itemId ?? crypto.randomUUID(), speaker, text, partial }];
    });
  }, []);

  const handleRealtimeEvent = useCallback((event: Record<string, unknown>) => {
    const type = event.type as string;

    if (type === "session.created" || type === "session.updated") {
      setCallStatus("live");
      setCallStartTime(new Date());
      setStatusText("Live call");
    }

    if (type === "response.audio.delta") {
      setAgentSpeaking(true);
    }

    if (type === "response.audio.done" || type === "response.done") {
      setAgentSpeaking(false);
    }

    if (type === "input_audio_buffer.speech_started") {
      setUserSpeaking(true);
    }

    if (type === "input_audio_buffer.speech_stopped") {
      setUserSpeaking(false);
    }

    if (type === "response.audio_transcript.delta") {
      const itemId = event.item_id as string;
      const delta = event.delta as string;
      agentItemIdRef.current = itemId;
      setTranscript(prev => {
        const existingIdx = prev.findIndex(l => l.id === itemId);
        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = {
            ...updated[existingIdx],
            text: (updated[existingIdx].text ?? "") + delta,
            partial: true,
          };
          return updated;
        }
        return [...prev, { id: itemId, speaker: "agent", text: delta, partial: true }];
      });
    }

    if (type === "response.audio_transcript.done") {
      const itemId = event.item_id as string;
      const transcript = event.transcript as string;
      setTranscript(prev => {
        const idx = prev.findIndex(l => l.id === itemId);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], text: transcript, partial: false };
          return updated;
        }
        return [...prev, { id: itemId, speaker: "agent", text: transcript, partial: false }];
      });
    }

    if (type === "conversation.item.input_audio_transcription.completed") {
      const itemId = event.item_id as string;
      const transcriptText = event.transcript as string;
      if (transcriptText?.trim()) {
        addTranscriptLine("user", transcriptText.trim(), false, itemId);
      }
    }

    if (type === "response.function_call_arguments.done") {
      const name = event.name as string;
      if (name === "book_meeting") {
        try {
          const args = JSON.parse(event.arguments as string) as {
            date: string; time: string; agendaTopic: string;
            dayLabel?: string; timeLabel?: string;
          };
          setBooking({
            date: args.date,
            time: args.time,
            agendaTopic: args.agendaTopic,
            dayLabel: args.dayLabel ?? args.date,
            timeLabel: args.timeLabel ?? args.time,
          });
          const callId = event.call_id as string;
          if (dcRef.current?.readyState === "open") {
            dcRef.current.send(JSON.stringify({
              type: "conversation.item.create",
              item: {
                type: "function_call_output",
                call_id: callId,
                output: JSON.stringify({ success: true, message: "Meeting booked successfully." }),
              },
            }));
            dcRef.current.send(JSON.stringify({ type: "response.create" }));
          }
        } catch { /* ignore */ }
      }
    }
  }, [addTranscriptLine]);

  const startCall = async () => {
    if (!lead) return;
    setCallStatus("connecting");
    setStatusText("Connecting to Maya...");
    setTranscript([]);
    setBooking(null);

    try {
      const res = await fetch("/api/realtime/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          advisorName: lead.name,
          advisorCompany: lead.company,
          advisorSegment: advisor?.segment,
          aumM: advisor?.aumM,
          fiOpportunities: advisor?.fiOpportunities,
          etfOpportunities: advisor?.etfOpportunities,
          alpha: advisor?.alpha,
          competitors: advisor?.competitors,
          territory: advisor?.territory,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? "Session creation failed");
      }

      const { ephemeralKey } = await res.json() as { ephemeralKey: string };

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      const audioEl = document.createElement("audio");
      audioEl.autoplay = true;
      audioElRef.current = audioEl;

      pc.ontrack = (e) => {
        audioEl.srcObject = e.streams[0];
      };

      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;

      dc.onopen = () => {
        setStatusText("Connected — Maya is speaking...");
      };

      dc.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data as string) as Record<string, unknown>;
          handleRealtimeEvent(event);
        } catch { /* ignore */ }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") {
          setCallStatus("ended");
          setStatusText("Call ended");
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpRes = await fetch(
        "https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${ephemeralKey}`,
            "Content-Type": "application/sdp",
          },
          body: offer.sdp,
        }
      );

      if (!sdpRes.ok) {
        throw new Error("WebRTC SDP exchange failed: " + await sdpRes.text());
      }

      const answerSdp = await sdpRes.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

    } catch (err) {
      console.error("Call start failed:", err);
      setCallStatus("idle");
      setStatusText("Ready to connect");
      toast({
        title: "Connection failed",
        description: err instanceof Error ? err.message : "Could not start the call. Please try again.",
        variant: "destructive",
      });
    }
  };

  const endCall = () => {
    dcRef.current?.close();
    pcRef.current?.close();
    pcRef.current = null;
    dcRef.current = null;
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    if (audioElRef.current) {
      audioElRef.current.srcObject = null;
    }
    setCallStatus("ended");
    setAgentSpeaking(false);
    setUserSpeaking(false);
    setStatusText("Call ended");
  };

  const toggleMute = () => {
    if (!localStreamRef.current) return;
    const enabled = !isMuted;
    localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = enabled; });
    setIsMuted(!enabled);
  };

  const handleConfirmBooking = () => {
    if (!lead || !booking) return;
    const scheduledAt = new Date(`${booking.date}T${booking.time}`).toISOString();
    createMeeting({
      data: {
        leadId: lead.id,
        leadName: lead.name,
        leadCompany: lead.company,
        scheduledAt,
        purpose: booking.agendaTopic,
        emailSubject: `Vanguard working session: ${booking.agendaTopic}`,
        emailBody: `Hi ${lead.name.split(" ")[0]},\n\nThanks for taking the call. I've placed a 20-minute meeting on the calendar for ${booking.dayLabel} at ${booking.timeLabel}.\n\nAgenda: ${booking.agendaTopic}\n\nThe goal is to keep this practical and specific to your current priorities.\n\nBest,\nMaya\nVanguard Advisor Team`,
      },
    }, {
      onSuccess: () => {
        toast({ title: "Meeting confirmed!", description: `Booked for ${booking.dayLabel} at ${booking.timeLabel}.` });
        setLocation("/prep-me");
      },
    });
  };

  if (leadLoading) {
    return <Layout><div className="flex justify-center p-24"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></Layout>;
  }

  if (!lead) {
    return <Layout><div className="text-center p-24 text-white">Lead not found. Please select a lead first.</div></Layout>;
  }

  return (
    <Layout>
      <div className="space-y-6 max-w-5xl mx-auto pb-12">

        <Link href="/leads" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Pipeline
        </Link>

        {/* Advisor Card */}
        <Card className="bg-card/50 border-teal-400/20 overflow-hidden relative"
          style={{ borderTop: "3px solid rgba(45,212,191,0.5)" }}>
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ background: "radial-gradient(ellipse at top left, #2dd4bf, transparent 60%)" }} />
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-5 items-start">
              <div className="w-14 h-14 rounded-2xl bg-teal-400/10 border border-teal-400/25 flex items-center justify-center shrink-0">
                <span className="text-2xl font-bold text-teal-400">{lead.name[0]}</span>
              </div>
              <div className="flex-1 min-w-0 space-y-3">
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-teal-400/70 font-semibold mb-1">Scheduling call with</p>
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
                {advisor && (
                  <div className="flex flex-wrap gap-3">
                    {[
                      { icon: TrendingUp, label: "AUM",     value: `$${advisor.aumM.toFixed(1)}M`, color: "text-blue-400" },
                      { icon: Zap,        label: "Alpha",   value: fmt(advisor.alpha),              color: "text-violet-400" },
                      { icon: Calendar,   label: "FI Opp",  value: fmt(advisor.fiOpportunities),    color: "text-teal-400" },
                      { icon: Calendar,   label: "ETF Opp", value: fmt(advisor.etfOpportunities),   color: "text-purple-400" },
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
            <Radio className="w-6 h-6 text-teal-400" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-white">Schedule Me</h1>
            <p className="text-muted-foreground">AI voice agent — Maya will call this advisor and book the meeting.</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">

          {/* ── Call Interface ─────────────────────────────────────── */}
          <div className="space-y-4">

            {/* Main call card */}
            <div className="relative rounded-3xl overflow-hidden border border-white/8 bg-gradient-to-br from-[#0a1628] via-[#0d1f3c] to-[#071224]"
              style={{ minHeight: 420 }}>

              {/* Background glow effects */}
              <div className="absolute inset-0 pointer-events-none">
                <div className={cn(
                  "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full blur-3xl transition-all duration-1000",
                  callStatus === "live"
                    ? agentSpeaking ? "bg-teal-500/10 scale-125" : "bg-blue-500/8"
                    : "bg-slate-500/5"
                )} />
              </div>

              <div className="relative flex flex-col items-center justify-center p-10 gap-8">

                {/* Maya Avatar */}
                <div className="relative flex flex-col items-center gap-6">
                  <div className="relative">
                    <PulsingRing active={callStatus === "live" && agentSpeaking} />
                    <motion.div
                      className={cn(
                        "w-28 h-28 rounded-full flex items-center justify-center relative z-10 transition-all duration-500",
                        callStatus === "live"
                          ? "shadow-[0_0_40px_rgba(45,212,191,0.3)] border-2 border-teal-400/50"
                          : callStatus === "connecting"
                          ? "border-2 border-teal-400/30 animate-pulse"
                          : "border-2 border-white/10"
                      )}
                      style={{
                        background: callStatus === "live"
                          ? "radial-gradient(circle at 30% 30%, #1e4a6e, #0a1a2e)"
                          : "radial-gradient(circle at 30% 30%, #1a2540, #0a1020)",
                      }}
                      animate={callStatus === "live" && agentSpeaking ? { scale: [1, 1.04, 1] } : {}}
                      transition={{ duration: 0.8, repeat: Infinity }}
                    >
                      <div className="text-center">
                        <div className="text-3xl font-bold text-teal-300">M</div>
                        <div className="text-[9px] text-teal-400/70 font-semibold tracking-wider uppercase mt-0.5">Maya</div>
                      </div>
                      {callStatus === "live" && (
                        <motion.div
                          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-[#0a1628] flex items-center justify-center"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                        >
                          <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                        </motion.div>
                      )}
                    </motion.div>
                  </div>

                  <div className="text-center">
                    <p className="text-white font-semibold text-lg">Maya</p>
                    <p className="text-teal-400/80 text-sm">Vanguard Digital Desk</p>
                  </div>
                </div>

                {/* Waveform */}
                <div className="flex flex-col items-center gap-3">
                  <AnimatePresence mode="wait">
                    {callStatus === "live" ? (
                      <motion.div
                        key="waveform"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="flex flex-col items-center gap-2"
                      >
                        <WaveformBars active={agentSpeaking} color="teal" />
                        <p className="text-xs text-muted-foreground">
                          {agentSpeaking ? (
                            <span className="text-teal-300 flex items-center gap-1.5">
                              <Volume2 className="w-3.5 h-3.5" /> Maya is speaking
                            </span>
                          ) : userSpeaking ? (
                            <span className="text-blue-300 flex items-center gap-1.5">
                              <Mic className="w-3.5 h-3.5" /> You are speaking
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60">Listening...</span>
                          )}
                        </p>
                      </motion.div>
                    ) : callStatus === "connecting" ? (
                      <motion.div
                        key="connecting"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center gap-3"
                      >
                        <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
                        <p className="text-sm text-teal-400 animate-pulse">Initializing voice agent...</p>
                      </motion.div>
                    ) : callStatus === "ended" ? (
                      <motion.div
                        key="ended"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center gap-2"
                      >
                        <SquareActivity className="w-8 h-8 text-muted-foreground/40" />
                        <p className="text-sm text-muted-foreground">Call ended</p>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="idle"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center gap-2"
                      >
                        <div className="flex items-center gap-2 text-sm text-muted-foreground/60">
                          <Sparkles className="w-4 h-4 text-teal-400/40" />
                          Ready to place call
                        </div>
                        <p className="text-xs text-muted-foreground/40 text-center max-w-[240px]">
                          Maya will identify a pain point, match it to a Vanguard module, and close a calendar slot.
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Status bar */}
                {callStatus === "live" && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 bg-white/4 border border-white/8 rounded-full px-4 py-2"
                  >
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs text-white/70 font-medium">Live</span>
                    <span className="text-white/20">·</span>
                    <CallTimer startTime={callStartTime} />
                  </motion.div>
                )}

                {/* Call controls */}
                <div className="flex items-center gap-5 mt-2">
                  {callStatus === "idle" || callStatus === "ended" ? (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={startCall}
                      className="flex items-center gap-3 px-8 py-4 rounded-2xl font-semibold text-white text-base shadow-xl transition-all
                        bg-gradient-to-br from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500
                        shadow-teal-500/30 hover:shadow-teal-400/40"
                    >
                      <PhoneCall className="w-5 h-5" />
                      {callStatus === "ended" ? "Call Again" : "Start Voice Call"}
                    </motion.button>
                  ) : callStatus === "connecting" ? (
                    <div className="flex items-center gap-3 px-8 py-4 rounded-2xl font-semibold text-white/50 bg-white/5 border border-white/8 cursor-wait">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Connecting...
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={toggleMute}
                        className={cn(
                          "w-14 h-14 rounded-full flex items-center justify-center border-2 transition-all",
                          isMuted
                            ? "bg-rose-500/20 border-rose-500/40 text-rose-400"
                            : "bg-white/6 border-white/15 text-white/70 hover:border-white/30"
                        )}
                      >
                        {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={endCall}
                        className="flex items-center gap-2.5 px-6 py-3.5 rounded-2xl font-semibold text-white text-sm
                          bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-600/30 transition-all"
                      >
                        <PhoneOff className="w-4 h-4" />
                        End Call
                      </motion.button>
                    </div>
                  )}
                </div>

                {/* How it works — idle only */}
                {callStatus === "idle" && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="grid grid-cols-3 gap-3 w-full mt-2 max-w-md"
                  >
                    {[
                      { step: "1", label: "Finds pain point", desc: "Asks about practice challenges" },
                      { step: "2", label: "Matches module", desc: "Connects to Vanguard value prop" },
                      { step: "3", label: "Books slot", desc: "Offers two times and confirms" },
                    ].map(s => (
                      <div key={s.step} className="flex flex-col items-center gap-1.5 text-center bg-white/3 border border-white/6 rounded-xl p-3">
                        <div className="w-6 h-6 rounded-full bg-teal-500/20 text-teal-400 text-xs font-bold flex items-center justify-center">
                          {s.step}
                        </div>
                        <p className="text-[11px] font-semibold text-white/80">{s.label}</p>
                        <p className="text-[10px] text-muted-foreground/60 leading-tight">{s.desc}</p>
                      </div>
                    ))}
                  </motion.div>
                )}
              </div>
            </div>

            {/* Booking confirmation */}
            <AnimatePresence>
              {booking && (
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="relative overflow-hidden rounded-2xl border border-teal-400/30 bg-gradient-to-br from-teal-500/10 to-teal-600/5 p-6"
                >
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-teal-400/0 via-teal-400/80 to-teal-400/0" />
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-teal-400/15 border border-teal-400/30 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-6 h-6 text-teal-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-teal-400 uppercase tracking-wider font-semibold mb-1">Maya agreed a time</p>
                      <p className="text-lg font-bold text-white mb-0.5">{booking.dayLabel} at {booking.timeLabel}</p>
                      <p className="text-sm text-white/60 mb-4">Agenda: {booking.agendaTopic}</p>
                      <Button
                        onClick={handleConfirmBooking}
                        disabled={isCreating}
                        className="bg-teal-500 hover:bg-teal-400 text-white shadow-lg shadow-teal-500/25 font-semibold"
                      >
                        {isCreating
                          ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Confirming...</>
                          : <><CheckCircle2 className="w-4 h-4 mr-2" /> Confirm Booking</>
                        }
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Live Transcript ──────────────────────────────────────── */}
          <div className="sticky top-24">
            <div className="rounded-2xl border border-white/8 bg-card/30 overflow-hidden flex flex-col"
              style={{ height: 480 }}>
              <div className="flex items-center gap-3 px-5 py-4 border-b border-white/8 bg-background/30 shrink-0">
                <div className={cn(
                  "w-2 h-2 rounded-full transition-colors duration-300",
                  callStatus === "live" ? "bg-emerald-400 animate-pulse" : "bg-white/15"
                )} />
                <p className="text-sm font-semibold text-white">Live Transcript</p>
                {callStatus === "live" && (
                  <span className="ml-auto text-[10px] text-muted-foreground/60 uppercase tracking-wider">Real-time</span>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-white/10">
                {transcript.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center gap-3">
                    <PhoneCall className="w-10 h-10 text-muted-foreground/15" />
                    <p className="text-sm text-muted-foreground/40">
                      {callStatus === "idle"
                        ? "Start the call to see the live transcript"
                        : callStatus === "connecting"
                        ? "Connecting..."
                        : "Waiting for conversation..."}
                    </p>
                  </div>
                ) : (
                  transcript.map(line => (
                    <motion.div
                      key={line.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn("flex gap-2.5", line.speaker === "user" ? "justify-end" : "justify-start")}
                    >
                      {line.speaker === "agent" && (
                        <div className="w-6 h-6 rounded-full bg-teal-400/15 border border-teal-400/25 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-[9px] font-bold text-teal-400">M</span>
                        </div>
                      )}
                      <div className={cn(
                        "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                        line.speaker === "agent"
                          ? "bg-white/6 border border-white/8 text-white/85 rounded-tl-sm"
                          : "bg-blue-500/15 border border-blue-500/20 text-blue-100 rounded-tr-sm"
                      )}>
                        {line.text}
                        {line.partial && (
                          <span className="inline-block ml-1 opacity-50">
                            <span className="animate-pulse">▊</span>
                          </span>
                        )}
                      </div>
                      {line.speaker === "user" && (
                        <div className="w-6 h-6 rounded-full bg-blue-500/15 border border-blue-500/25 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-[9px] font-bold text-blue-400">You</span>
                        </div>
                      )}
                    </motion.div>
                  ))
                )}
                <div ref={transcriptEndRef} />
              </div>

              {callStatus === "ended" && transcript.length > 0 && (
                <div className="px-4 py-3 border-t border-white/8 bg-background/20 shrink-0">
                  <p className="text-xs text-muted-foreground/60 text-center">Call ended · {transcript.length} exchanges recorded</p>
                </div>
              )}
            </div>

            {/* Call tips */}
            {callStatus === "idle" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mt-4 space-y-2"
              >
                <p className="text-[11px] text-muted-foreground/50 uppercase tracking-wider font-semibold px-1">Maya will cover</p>
                {[
                  "Permission opener & reason for the call",
                  "One pain point discovery question",
                  "One proof point from the Vanguard corpus",
                  "Narrow meeting agenda (20 min, one topic)",
                  "Calendar close with two available times",
                ].map((tip, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground/60 px-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-teal-400/30 mt-1.5 shrink-0" />
                    {tip}
                  </div>
                ))}
              </motion.div>
            )}
          </div>

        </div>
      </div>
    </Layout>
  );
}
