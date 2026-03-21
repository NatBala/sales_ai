import { useState, useEffect, useRef } from "react";
import { useVoiceRecorder } from "@workspace/integrations-openai-ai-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2, ArrowLeft, Square } from "lucide-react";

export interface AdvisorPersona {
  name: string;
  role: string;
  company: string;
  firmType: string;
  aumRange: string;
  personality: string;
  concerns: string[];
  style: string;
  openingLine: string;
}

export interface ConversationTurn {
  role: "user" | "advisor";
  content: string;
}

interface Props {
  persona: AdvisorPersona;
  meeting: { leadName: string; leadCompany: string; purpose: string };
  onScorecard: (transcript: ConversationTurn[]) => void;
  onBack: () => void;
}

const STYLE_COLORS: Record<string, string> = {
  Analytical: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  Skeptical: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  Collaborative: "text-green-400 bg-green-400/10 border-green-400/20",
  Assertive: "text-red-400 bg-red-400/10 border-red-400/20",
  Inquisitive: "text-violet-400 bg-violet-400/10 border-violet-400/20",
};

export function CoachPractice({ persona, meeting, onScorecard, onBack }: Props) {
  const [transcript, setTranscript] = useState<ConversationTurn[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const { state: voiceState, startRecording, stopRecording } = useVoiceRecorder();
  const isRecording = voiceState === "recording";
  const bottomRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript, isBusy]);

  useEffect(() => {
    fetchAdvisorTurn([], null);
  }, []);

  const playAudio = (base64: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(`data:audio/mp3;base64,${base64}`);
    audioRef.current = audio;
    audio.play().catch(() => {});
  };

  const fetchAdvisorTurn = async (history: ConversationTurn[], audioBase64: string | null, mimeType?: string) => {
    setIsBusy(true);
    try {
      const res = await fetch("/api/agents/coach-me/persona-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona, history, audioBase64, mimeType: mimeType ?? null }),
      });
      if (!res.ok) throw new Error("Request failed");
      const data: { userTranscript: string; advisorResponse: string; audioBase64: string } = await res.json();

      setTranscript(prev => {
        const newTurns: ConversationTurn[] = [];
        if (data.userTranscript) newTurns.push({ role: "user", content: data.userTranscript });
        if (data.advisorResponse) newTurns.push({ role: "advisor", content: data.advisorResponse });
        return [...prev, ...newTurns];
      });

      if (data.audioBase64) playAudio(data.audioBase64);
    } catch {
    } finally {
      setIsBusy(false);
    }
  };

  const handleMicClick = async () => {
    if (isRecording) {
      const blob = await stopRecording();
      if (!blob || blob.size === 0) return;

      const arrayBuffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      const chunk = 8192;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      const base64 = btoa(binary);
      await fetchAdvisorTurn(transcript, base64, blob.type);
    } else {
      await startRecording();
    }
  };

  const initials = persona.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  const styleClass = STYLE_COLORS[persona.style] ?? "text-violet-400 bg-violet-400/10 border-violet-400/20";

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3.5 border-b border-white/5 bg-card/30 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>
          <div>
            <h2 className="text-base md:text-lg font-bold text-white leading-tight">Practice Session</h2>
            <p className="text-xs text-muted-foreground hidden md:block">{meeting.purpose}</p>
          </div>
        </div>
        <Button
          onClick={() => onScorecard(transcript)}
          disabled={transcript.length < 2}
          size="sm"
          className="bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-500/20 gap-2"
        >
          <Square className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">End &amp; Get Scorecard</span>
          <span className="sm:hidden">Scorecard</span>
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Persona Sidebar */}
        <aside className="hidden lg:flex w-64 xl:w-72 shrink-0 flex-col border-r border-white/5 bg-card/20 p-5 overflow-y-auto">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/30 to-blue-500/30 border border-violet-500/20 flex items-center justify-center text-xl font-bold text-white mb-4 mx-auto">
            {initials}
          </div>
          <div className="text-center mb-5">
            <h3 className="text-white font-bold">{persona.name}</h3>
            <p className="text-violet-400 text-xs mt-0.5">{persona.role}</p>
            <p className="text-muted-foreground text-xs">{persona.company}</p>
          </div>
          <div className="space-y-3">
            <div className="bg-background/40 rounded-xl p-3 border border-white/5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Firm Type</p>
              <p className="text-white text-xs">{persona.firmType}</p>
            </div>
            <div className="bg-background/40 rounded-xl p-3 border border-white/5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">AUM Range</p>
              <p className="text-white text-sm font-bold">{persona.aumRange}</p>
            </div>
            <div className="bg-background/40 rounded-xl p-3 border border-white/5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Communication Style</p>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${styleClass}`}>{persona.style}</span>
            </div>
            <div className="bg-background/40 rounded-xl p-3 border border-white/5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Likely Concerns</p>
              <ul className="space-y-1.5">
                {persona.concerns.map((c, i) => (
                  <li key={i} className="text-xs text-white/65 flex gap-1.5">
                    <span className="text-violet-400 shrink-0">•</span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </aside>

        {/* Conversation */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto px-4 md:px-6 py-5 space-y-4">
            <AnimatePresence initial={false}>
              {transcript.map((turn, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex gap-2.5 ${turn.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center text-xs font-bold ${
                      turn.role === "advisor"
                        ? "bg-violet-500/20 text-violet-300 border border-violet-500/20"
                        : "bg-primary/20 text-primary border border-primary/20"
                    }`}
                  >
                    {turn.role === "advisor" ? initials : "ME"}
                  </div>
                  <div
                    className={`max-w-[78%] md:max-w-[70%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      turn.role === "advisor"
                        ? "bg-card/60 border border-white/5 text-white/85 rounded-tl-sm"
                        : "bg-primary/10 border border-primary/15 text-white/90 rounded-tr-sm"
                    }`}
                  >
                    <div className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${turn.role === "advisor" ? "text-violet-400" : "text-primary"}`}>
                      {turn.role === "advisor" ? persona.name.split(" ")[0] : "You"}
                    </div>
                    {turn.content}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {isBusy && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-violet-500/20 border border-violet-500/20 flex items-center justify-center text-xs font-bold text-violet-300">{initials}</div>
                <div className="bg-card/60 border border-white/5 rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1 items-center h-5">
                    {[0, 1, 2].map(j => (
                      <motion.div
                        key={j}
                        className="w-1.5 h-1.5 rounded-full bg-violet-400"
                        animate={{ y: [0, -4, 0] }}
                        transition={{ repeat: Infinity, duration: 0.8, delay: j * 0.18 }}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Controls */}
          <div className="border-t border-white/5 bg-card/20 px-6 py-5 flex flex-col items-center gap-2 shrink-0">
            <AnimatePresence>
              {isRecording && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  className="flex items-center gap-2 text-sm text-red-400"
                >
                  <motion.div
                    className="w-2 h-2 bg-red-400 rounded-full"
                    animate={{ opacity: [1, 0.2] }}
                    transition={{ repeat: Infinity, duration: 0.7 }}
                  />
                  Recording... tap to send
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={handleMicClick}
              disabled={isBusy}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg focus:outline-none ${
                isRecording
                  ? "bg-red-500 shadow-red-500/40 scale-110"
                  : isBusy
                  ? "bg-white/5 opacity-50 cursor-not-allowed"
                  : "bg-violet-600 hover:bg-violet-500 shadow-violet-500/30 hover:scale-105 active:scale-95"
              }`}
            >
              {isBusy ? (
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              ) : isRecording ? (
                <MicOff className="w-6 h-6 text-white" />
              ) : (
                <Mic className="w-6 h-6 text-white" />
              )}
            </button>
            <p className="text-xs text-muted-foreground">
              {isRecording ? "Tap to stop & send" : isBusy ? "Processing..." : "Tap to speak"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
