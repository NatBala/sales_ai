import { useState, useEffect, useRef, useCallback } from "react";
import { Layout } from "@/components/layout";
import { useParams, useLocation, Link } from "wouter";
import { useLead } from "@/hooks/use-leads";
import { useCreateMeeting, useResetSchedule } from "@/hooks/use-meetings";
import { useAgentScheduleMe } from "@/hooks/use-agents";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Loader2, ArrowLeft, Building2, MapPin, TrendingUp, Zap,
  Calendar, ExternalLink, PhoneCall, PhoneOff, Mic, MicOff,
  CheckCircle2, Sparkles, Volume2, Radio, SquareActivity,
  Mail, Copy, Check, Send, Edit3, CalendarCheck, Clock, RotateCcw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useRealtimeCall } from "@/hooks/use-realtime-call";

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

function normalizeScheduleEmailSender(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return trimmed;

  const signaturePattern = /(\n\n(?:best|best regards|regards|thanks|thank you|sincerely),?\s*\n)([^\n]+)/i;
  if (signaturePattern.test(trimmed)) {
    return trimmed.replace(signaturePattern, (_match, prefix) => `${prefix}Nat`);
  }

  return `${trimmed}\n\nBest,\nNat`;
}

const SEGMENT_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  A: { label: "Top Tier",   color: "text-emerald-300", bg: "bg-emerald-500/10", border: "border-emerald-500/25" },
  B: { label: "High Value", color: "text-blue-300",    bg: "bg-blue-500/10",    border: "border-blue-500/25" },
  C: { label: "Mid-Market", color: "text-sky-300",     bg: "bg-sky-500/10",     border: "border-sky-500/25" },
  D: { label: "Developing", color: "text-amber-300",   bg: "bg-amber-500/10",   border: "border-amber-500/25" },
  E: { label: "Emerging",   color: "text-violet-300",  bg: "bg-violet-500/10",  border: "border-violet-500/25" },
};

type CallStatus = "idle" | "connecting" | "active" | "ended";
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
  const { mutate: resetSchedule, isPending: isResetting } = useResetSchedule();
  const { toast } = useToast();

  // Mode: email or voice
  type Mode = "email" | "voice";
  const [mode, setMode] = useState<Mode>("email");

  // Email state
  const { mutate: generateEmail, isPending: emailPending, data: emailData, reset: resetEmail } = useAgentScheduleMe();
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailEditing, setEmailEditing] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);

  useEffect(() => {
    if (!emailBody) return;
    const normalized = normalizeScheduleEmailSender(emailBody);
    if (normalized !== emailBody) {
      setEmailBody(normalized);
    }
  }, [emailBody]);

  interface BookingConfirmed {
    leadName: string;
    leadCompany: string;
    dayLabel: string;
    timeLabel: string;
    agendaTopic: string;
  }
  const [bookingConfirmed, setBookingConfirmed] = useState<BookingConfirmed | null>(null);
  const [redirectCountdown, setRedirectCountdown] = useState(5);

  // Voice state
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [booking, setBooking] = useState<BookingProposal | null>(null);
  const [callStartTime, setCallStartTime] = useState<Date | null>(null);

  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  const {
    agentSpeaking,
    isMuted,
    startCall: rtStartCall,
    endCall: rtEndCall,
    toggleMute,
  } = useRealtimeCall({
    playbackWorkletPath: `${import.meta.env.BASE_URL}audio-playback-worklet.js`,
    captureWorkletPath: `${import.meta.env.BASE_URL}audio-capture-worklet.js`,
    onUserTranscriptDelta: (_delta, accumulated) => {
      setTranscript(prev => {
        const lastLine = prev[prev.length - 1];
        if (lastLine?.speaker === "user" && lastLine.partial) {
          const updated = [...prev];
          updated[updated.length - 1] = { ...lastLine, text: accumulated };
          return updated;
        }
        return [...prev, {
          id: crypto.randomUUID(),
          speaker: "user",
          text: accumulated,
          partial: true,
        }];
      });
    },
    onUserTranscript: (text) => {
      setTranscript(prev => {
        const lastLine = prev[prev.length - 1];
        if (lastLine?.speaker === "user" && lastLine.partial) {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...lastLine,
            text,
            partial: false,
          };
          return updated;
        }
        return [...prev, {
          id: crypto.randomUUID(),
          speaker: "user",
          text,
          partial: false,
        }];
      });
    },
    onAgentTranscriptDelta: (_delta, accumulated) => {
      setTranscript(prev => {
        const lastLine = prev[prev.length - 1];
        if (lastLine?.speaker === "agent" && lastLine.partial) {
          const updated = [...prev];
          updated[updated.length - 1] = { ...lastLine, text: accumulated };
          return updated;
        }
        return [...prev, {
          id: crypto.randomUUID(),
          speaker: "agent",
          text: accumulated,
          partial: true,
        }];
      });
    },
    onAgentResponseDone: (fullText) => {
      setTranscript(prev => {
        const updated = [...prev];
        for (let i = updated.length - 1; i >= 0; i--) {
          if (updated[i].speaker === "agent" && updated[i].partial) {
            updated[i] = { ...updated[i], text: fullText, partial: false };
            break;
          }
        }
        return updated;
      });
    },
    onBookingDetected: (b) => setBooking(b),
    onError: (err) => {
      console.error("Realtime call error:", err);
      toast({ title: "Call error", description: err.message, variant: "destructive" });
    },
    onConnectionStateChange: (state) => {
      if (state === "connecting") setCallStatus("connecting");
      else if (state === "connected") {
        setCallStatus("active");
        setCallStartTime(new Date());
      } else if (state === "disconnected" || state === "error") {
        setCallStatus("ended");
      }
    },
  });

  const advisor = lead ? parseAdvisorData(lead.assets ?? "") : null;
  const seg = advisor ? (SEGMENT_CONFIG[advisor.segment] ?? SEGMENT_CONFIG.C) : null;
  const advisorTranscriptLabel = lead?.name.split(" ")[0] || "Advisor";
  const advisorTranscriptInitial = advisorTranscriptLabel.charAt(0).toUpperCase() || "A";

  // Sync AI email data into editable fields
  useEffect(() => {
    if (emailData) {
      setEmailSubject((emailData as { subject?: string }).subject ?? "");
      setEmailBody((emailData as { body?: string }).body ?? "");
      setEmailEditing(false);
    }
  }, [emailData]);

  const handleGenerateEmail = () => {
    if (!lead) return;
    const ctx = advisor
      ? `Advisor AUM: $${advisor.aumM.toFixed(1)}M. Segment: ${advisor.segment}. ` +
        `Fixed income opportunity: $${(advisor.fiOpportunities / 1000).toFixed(0)}K. ` +
        `ETF opportunity: $${(advisor.etfOpportunities / 1000).toFixed(0)}K. ` +
        `Alpha: $${(advisor.alpha / 1000).toFixed(0)}K. ` +
        `Territory: ${advisor.territory}. ` +
        (advisor.competitors.length ? `Key competitors: ${advisor.competitors.join(", ")}.` : "")
      : "";
    generateEmail({
      data: {
        leadId: lead.id,
        leadName: lead.name,
        leadCompany: lead.company,
        leadTitle: lead.title ?? "Financial Advisor",
        context: ctx,
      },
    });
  };

  const handleCopyEmail = () => {
    void navigator.clipboard.writeText(`Subject: ${emailSubject}\n\n${emailBody}`);
    setEmailCopied(true);
    setTimeout(() => setEmailCopied(false), 2000);
  };

  const handleEmailBookMeeting = () => {
    if (!lead) return;
    const scheduledAt = new Date("2026-03-24T09:30:00").toISOString();
    createMeeting({
      data: {
        leadId: lead.id,
        leadName: lead.name,
        leadCompany: lead.company,
        scheduledAt,
        purpose: emailSubject || "Follow-up meeting",
        emailSubject: emailSubject,
        emailBody: emailBody,
      },
    }, {
      onSuccess: () => {
        setBookingConfirmed({
          leadName: lead.name,
          leadCompany: lead.company,
          dayLabel: "Tuesday Mar 24",
          timeLabel: "9:30 AM PT",
          agendaTopic: emailSubject || "Vanguard working session",
        });
      },
    });
  };

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  useEffect(() => {
    if (!bookingConfirmed) return;
    setRedirectCountdown(5);
    const interval = setInterval(() => {
      setRedirectCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setLocation("/");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [bookingConfirmed, setLocation]);

  const startCall = useCallback(async () => {
    if (!lead) return;
    setTranscript([]);
    setBooking(null);
    await rtStartCall({
      advisorName: lead.name,
      advisorCompany: lead.company,
      advisorSegment: advisor?.segment,
      aumM: advisor?.aumM,
      fiOpportunities: advisor?.fiOpportunities,
      etfOpportunities: advisor?.etfOpportunities,
      alpha: advisor?.alpha,
      competitors: advisor?.competitors,
      territory: advisor?.territory,
    });
  }, [lead, advisor, rtStartCall]);

  const endCall = useCallback(() => {
    rtEndCall();
    setCallStatus("ended");
  }, [rtEndCall]);

  const handleConfirmBooking = () => {
    if (!lead || !booking) return;
    const scheduledAt = new Date(`${booking.date}T${booking.time}`).toISOString();
    const confirmedBooking = booking;
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
        rtEndCall();
        setCallStatus("ended");
        setBookingConfirmed({
          leadName: lead.name,
          leadCompany: lead.company,
          dayLabel: confirmedBooking.dayLabel,
          timeLabel: confirmedBooking.timeLabel,
          agendaTopic: confirmedBooking.agendaTopic,
        });
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
      {/* Booking Success Overlay */}
      <AnimatePresence>
        {bookingConfirmed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-6"
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 24 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 22, stiffness: 300 }}
              className="w-full max-w-md bg-[#0d1f35] border border-emerald-500/30 rounded-3xl shadow-2xl shadow-emerald-500/10 overflow-hidden"
            >
              {/* Green top bar */}
              <div className="h-1.5 bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-400" />

              <div className="p-8 flex flex-col items-center text-center gap-5">
                {/* Animated check */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.1, type: "spring", damping: 14, stiffness: 320 }}
                  className="w-20 h-20 rounded-full bg-emerald-500/15 border-2 border-emerald-400/40 flex items-center justify-center shadow-lg shadow-emerald-500/20"
                >
                  <CalendarCheck className="w-10 h-10 text-emerald-400" />
                </motion.div>

                <div className="space-y-1">
                  <h2 className="text-2xl font-bold text-white">Meeting Confirmed</h2>
                  <p className="text-sm text-muted-foreground">
                    Calendar invite has been created
                  </p>
                </div>

                {/* Meeting detail card */}
                <div className="w-full bg-white/[0.04] border border-white/8 rounded-2xl p-4 space-y-3 text-left">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-sm font-bold text-emerald-400">{bookingConfirmed.leadName[0]}</span>
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">{bookingConfirmed.leadName}</p>
                      <p className="text-xs text-muted-foreground">{bookingConfirmed.leadCompany}</p>
                    </div>
                  </div>
                  <div className="border-t border-white/6 pt-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="text-white font-medium">{bookingConfirmed.dayLabel}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="text-white font-medium">{bookingConfirmed.timeLabel}</span>
                      <span className="text-muted-foreground/60">· 20 min</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <Sparkles className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{bookingConfirmed.agendaTopic}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2.5 w-full">
                  <button
                    onClick={() => setLocation("/")}
                    className="w-full py-3 px-4 rounded-xl font-semibold text-sm text-white
                      bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400
                      shadow-lg shadow-emerald-500/25 transition-all hover:shadow-emerald-400/30"
                  >
                    <CalendarCheck className="w-4 h-4 inline-block mr-2 -mt-0.5" />
                    View on Calendar
                  </button>
                  <button
                    onClick={() => setLocation("/prep-me")}
                    className="w-full py-3 px-4 rounded-xl font-medium text-sm text-white/70 hover:text-white
                      bg-white/[0.04] hover:bg-white/[0.08] border border-white/8 transition-all"
                  >
                    Go to Prep Brief
                  </button>
                </div>

                {/* Countdown */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground/50">
                  <div className="relative w-4 h-4">
                    <svg viewBox="0 0 16 16" className="absolute inset-0 -rotate-90">
                      <circle cx="8" cy="8" r="6" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
                      <circle
                        cx="8" cy="8" r="6" fill="none"
                        stroke="rgba(52,211,153,0.5)" strokeWidth="2"
                        strokeDasharray={`${(redirectCountdown / 5) * 37.7} 37.7`}
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                  Redirecting to calendar in {redirectCountdown}s
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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

        {/* Page header + Mode Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-4 flex-1">
            <div className="w-12 h-12 rounded-2xl bg-teal-400/10 border border-teal-400/20 flex items-center justify-center">
              {mode === "email" ? <Mail className="w-6 h-6 text-teal-400" /> : <Radio className="w-6 h-6 text-teal-400" />}
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold text-white">My Schedule</h1>
              <p className="text-muted-foreground">
                {mode === "email" ? "AI-drafted outreach email — personalized with advisor context." : "AI voice agent — Maya will call this advisor and book the meeting."}
              </p>
            </div>
          </div>
          {/* Reset button */}
          <button
            disabled={isResetting}
            onClick={() => resetSchedule(undefined, {
              onSuccess: () => toast({ title: "Schedule reset", description: "All meetings have been removed." }),
            })}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-red-400 hover:text-red-300
              bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 transition-all disabled:opacity-50 self-start sm:self-auto"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? "animate-spin" : ""}`} />
            Reset
          </button>

          {/* Tab switcher */}
          <div className="flex bg-white/4 border border-white/10 rounded-2xl p-1 gap-1 self-start sm:self-auto">
            <button
              onClick={() => setMode("email")}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all",
                mode === "email"
                  ? "bg-teal-500/20 border border-teal-500/30 text-teal-300 shadow-sm"
                  : "text-muted-foreground hover:text-white"
              )}
            >
              <Mail className="w-4 h-4" /> Email
            </button>
            <button
              onClick={() => setMode("voice")}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all",
                mode === "voice"
                  ? "bg-teal-500/20 border border-teal-500/30 text-teal-300 shadow-sm"
                  : "text-muted-foreground hover:text-white"
              )}
            >
              <PhoneCall className="w-4 h-4" /> Voice Call
            </button>
          </div>
        </div>

        {/* ── Email Panel ─────────────────────────────────────────────── */}
        {mode === "email" && (
          <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
            <div className="space-y-4">
              {!emailData && !emailPending ? (
                /* Generate prompt */
                <div className="rounded-3xl border border-white/8 bg-gradient-to-br from-[#0a1628] via-[#0d1f3c] to-[#071224] p-10 flex flex-col items-center justify-center gap-6 text-center" style={{ minHeight: 380 }}>
                  <div className="w-20 h-20 rounded-2xl bg-teal-400/10 border border-teal-400/20 flex items-center justify-center">
                    <Mail className="w-10 h-10 text-teal-400/60" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">Generate Outreach Email</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">
                      AI will write a 3-paragraph email personalized with {lead.name}'s AUM, alpha opportunity, and Vanguard talking points.
                    </p>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    onClick={handleGenerateEmail}
                    className="flex items-center gap-3 px-8 py-4 rounded-2xl font-semibold text-white text-base shadow-xl bg-gradient-to-br from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 shadow-teal-500/30"
                  >
                    <Sparkles className="w-5 h-5" /> Generate Email Draft
                  </motion.button>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {["3 paragraphs · ~160 words", "Personalized with AUM & alpha", "No buzzwords"].map(t => (
                      <span key={t} className="text-xs px-3 py-1 rounded-full bg-white/5 border border-white/8 text-white/50">{t}</span>
                    ))}
                  </div>
                </div>
              ) : emailPending ? (
                /* Loading */
                <div className="rounded-3xl border border-white/8 bg-gradient-to-br from-[#0a1628] via-[#0d1f3c] to-[#071224] p-10 flex flex-col items-center justify-center gap-6 text-center" style={{ minHeight: 380 }}>
                  <Loader2 className="w-10 h-10 text-teal-400 animate-spin" />
                  <p className="text-sm text-teal-300 animate-pulse">Drafting personalized email...</p>
                </div>
              ) : (
                /* Email editor */
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  {/* Subject */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Subject</label>
                    <div className="relative">
                      <Input
                        value={emailSubject}
                        onChange={e => setEmailSubject(e.target.value)}
                        className="h-12 bg-card/60 border-white/10 text-white pr-10 font-medium"
                        placeholder="Email subject..."
                      />
                    </div>
                  </div>
                  {/* Body */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Body</label>
                      <button
                        onClick={() => setEmailEditing(!emailEditing)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-white transition-colors"
                      >
                        <Edit3 className="w-3 h-3" />
                        {emailEditing ? "Done editing" : "Edit"}
                      </button>
                    </div>
                    {emailEditing ? (
                      <Textarea
                        value={emailBody}
                        onChange={e => setEmailBody(e.target.value)}
                        className="min-h-[280px] bg-card/60 border-white/10 text-white/90 text-sm leading-relaxed resize-none font-mono"
                      />
                    ) : (
                      <div className="bg-card/40 border border-white/8 rounded-xl p-5 text-sm text-white/80 leading-relaxed whitespace-pre-wrap min-h-[280px]">
                        {emailBody}
                      </div>
                    )}
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <Button
                      onClick={handleCopyEmail}
                      variant="outline"
                      className="border-white/15 text-white hover:bg-white/8 gap-2"
                    >
                      {emailCopied ? <><Check className="w-4 h-4 text-emerald-400" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy Email</>}
                    </Button>
                    <Button
                      onClick={() => { resetEmail(); setEmailSubject(""); setEmailBody(""); }}
                      variant="ghost"
                      className="text-muted-foreground hover:text-white gap-2"
                    >
                      <Sparkles className="w-4 h-4" /> Regenerate
                    </Button>
                    <div className="flex-1" />
                    <Button
                      onClick={handleEmailBookMeeting}
                      disabled={isCreating || !emailSubject}
                      className="bg-teal-500 hover:bg-teal-400 text-white shadow-lg shadow-teal-500/25 gap-2"
                    >
                      {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      Mark Sent &amp; Book Meeting
                    </Button>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Right: How it works / advisor context */}
            <div className="space-y-4">
              <Card className="bg-card/40 border-white/8">
                <CardContent className="p-5 space-y-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email Context</p>
                  {advisor ? (
                    <div className="space-y-2">
                      {[
                        { label: "AUM",        value: `$${advisor.aumM.toFixed(1)}M` },
                        { label: "Alpha Opp",  value: `$${(advisor.alpha / 1000).toFixed(0)}K` },
                        { label: "FI Opp",     value: `$${(advisor.fiOpportunities / 1000).toFixed(0)}K` },
                        { label: "ETF Opp",    value: `$${(advisor.etfOpportunities / 1000).toFixed(0)}K` },
                        { label: "Territory",  value: advisor.territory },
                        { label: "Segment",    value: `${advisor.segment} · ${seg?.label ?? ""}` },
                      ].map(m => (
                        <div key={m.label} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0 text-sm">
                          <span className="text-muted-foreground">{m.label}</span>
                          <span className="font-semibold text-white">{m.value}</span>
                        </div>
                      ))}
                      {advisor.competitors.length > 0 && (
                        <div className="pt-1">
                          <p className="text-xs text-muted-foreground mb-1.5">Competitors to differentiate from:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {advisor.competitors.map(c => (
                              <span key={c} className="text-xs px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-300">{c}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No advisor data available.</p>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-card/40 border-white/8">
                <CardContent className="p-5 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email Style</p>
                  {[
                    "3 paragraphs, ~160 words",
                    "Opens with relationship reference",
                    "Data-driven market insight",
                    "Soft calendar close",
                    "No buzzwords or templates",
                  ].map((s, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-white/60">
                      <CheckCircle2 className="w-4 h-4 text-teal-400/60 mt-0.5 shrink-0" />
                      {s}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ── Voice Call Panel ────────────────────────────────────────── */}
        {mode === "voice" && (
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
                  callStatus === "active"
                    ? agentSpeaking ? "bg-teal-500/10 scale-125" : "bg-blue-500/8"
                    : "bg-slate-500/5"
                )} />
              </div>

              <div className="relative flex flex-col items-center justify-center p-10 gap-8">

                {/* Maya Avatar */}
                <div className="relative flex flex-col items-center gap-6">
                  <div className="relative">
                    <PulsingRing active={callStatus === "active" && agentSpeaking} />
                    <motion.div
                      className={cn(
                        "w-28 h-28 rounded-full flex items-center justify-center relative z-10 transition-all duration-500",
                        callStatus === "active"
                          ? "shadow-[0_0_40px_rgba(45,212,191,0.3)] border-2 border-teal-400/50"
                          : callStatus === "connecting"
                          ? "border-2 border-teal-400/30 animate-pulse"
                          : "border-2 border-white/10"
                      )}
                      style={{
                        background: callStatus === "active"
                          ? "radial-gradient(circle at 30% 30%, #1e4a6e, #0a1a2e)"
                          : "radial-gradient(circle at 30% 30%, #1a2540, #0a1020)",
                      }}
                      animate={callStatus === "active" && agentSpeaking ? { scale: [1, 1.04, 1] } : {}}
                      transition={{ duration: 0.8, repeat: Infinity }}
                    >
                      <div className="text-center">
                        <div className="text-3xl font-bold text-teal-300">M</div>
                        <div className="text-[9px] text-teal-400/70 font-semibold tracking-wider uppercase mt-0.5">Maya</div>
                      </div>
                      {callStatus === "active" && (
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
                    {callStatus === "active" ? (
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
                          ) : isMuted ? (
                            <span className="text-rose-300 flex items-center gap-1.5">
                              <MicOff className="w-3.5 h-3.5" /> Muted
                            </span>
                          ) : (
                            <span className="text-emerald-300 flex items-center gap-1.5">
                              <Mic className="w-3.5 h-3.5" /> Listening...
                            </span>
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
                {callStatus === "active" && (
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
                        whileTap={{ scale: 0.95 }}
                        onClick={toggleMute}
                        className={cn(
                          "w-14 h-14 rounded-full flex items-center justify-center border-2 transition-all select-none",
                          isMuted
                            ? "bg-rose-500/20 border-rose-400/40 text-rose-300"
                            : "bg-emerald-500/20 border-emerald-400/40 text-emerald-300"
                        )}
                        title={isMuted ? "Unmute" : "Mute"}
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
                  callStatus === "active" ? "bg-emerald-400 animate-pulse" : "bg-white/15"
                )} />
                <p className="text-sm font-semibold text-white">Live Transcript</p>
                {callStatus === "active" && (
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
                        <p className={cn(
                          "mb-1 text-[10px] font-semibold uppercase tracking-wider",
                          line.speaker === "agent" ? "text-teal-300/80" : "text-blue-300/80",
                        )}>
                          {line.speaker === "agent" ? "Maya" : advisorTranscriptLabel}
                        </p>
                        {line.text}
                        {line.partial && (
                          <span className="inline-block ml-1 opacity-50">
                            <span className="animate-pulse">▊</span>
                          </span>
                        )}
                      </div>
                      {line.speaker === "user" && (
                        <div
                          title={advisorTranscriptLabel}
                          className="w-6 h-6 rounded-full bg-blue-500/15 border border-blue-500/25 flex items-center justify-center shrink-0 mt-0.5"
                        >
                          <span className="text-[9px] font-bold text-blue-400">{advisorTranscriptInitial}</span>
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
        )}

      </div>
    </Layout>
  );
}
