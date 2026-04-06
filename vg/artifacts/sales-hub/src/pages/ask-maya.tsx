import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useMaya } from "@/contexts/maya-context";
import { useMeetings } from "@/hooks/use-meetings";
import { Mic, Loader2, Sparkles, StopCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Phase = "idle" | "listening" | "thinking" | "done" | "error";

interface Turn {
  role: "user" | "maya";
  text: string;
}

interface IntentResult {
  action: "find_leads" | "schedule" | "prep" | "coach" | "engage" | "follow" | "general";
  query?: string;
  targetAdvisor?: string;
  message: string;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function matchAdvisor(meetings: { id: string; leadName: string }[], name: string): string | null {
  if (!name?.trim()) return null;
  const needle = name.trim().toLowerCase();
  const tokens = needle.split(/\s+/);
  let best: { id: string; score: number } | null = null;
  for (const m of meetings) {
    const haystack = m.leadName.toLowerCase();
    let score = 0;
    if (haystack === needle) score = 100;
    else if (haystack.includes(needle)) score = 80;
    else for (const t of tokens) if (t.length > 1 && haystack.includes(t)) score += 40;
    if (score > 0 && (!best || score > best.score)) best = { id: m.id, score };
  }
  return best ? best.id : null;
}

const SUGGESTIONS = [
  "Find me ESG-focused advisors in New York",
  "Prep me for my next meeting",
  "Coach me on overcoming fee objections",
  "Show me my follow-up tasks",
];

export default function AskMaya() {
  const { setAutoQuery, setMayaMeetingId, selectedLeads } = useMaya();
  const { data: meetingsData } = useMeetings();
  const [, navigate] = useLocation();

  const [phase, setPhase] = useState<Phase>("idle");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  const stopMic = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const addTurn = (role: "user" | "maya", text: string) => {
    setTurns(prev => [...prev, { role, text }]);
  };

  const handleAction = useCallback(async (result: IntentResult) => {
    addTurn("maya", result.message);
    const meetings = meetingsData?.meetings ?? [];
    const advisorName = result.targetAdvisor;
    await new Promise(r => setTimeout(r, 1400));

    if (result.action === "find_leads" && result.query) {
      setAutoQuery(result.query);
      navigate("/lead-me");
    } else if (result.action === "schedule") {
      if (advisorName) {
        const matchedLead = selectedLeads.find(l => {
          const hay = l.generatedLead.name.toLowerCase();
          return advisorName.toLowerCase().split(/\s+/).some(t => t.length > 1 && hay.includes(t));
        });
        if (matchedLead) navigate(`/schedule-me/${matchedLead.savedLeadId}`);
        else { setAutoQuery(advisorName); navigate("/lead-me"); }
      } else if (selectedLeads.length > 0) {
        navigate(`/schedule-me/${selectedLeads[0].savedLeadId}`);
      } else {
        navigate("/lead-me");
      }
    } else if (result.action === "prep") {
      if (advisorName) { const id = matchAdvisor(meetings, advisorName); if (id) setMayaMeetingId(id); }
      navigate("/prep-me");
    } else if (result.action === "coach") {
      if (advisorName) { const id = matchAdvisor(meetings, advisorName); if (id) setMayaMeetingId(id); }
      navigate("/coach-me");
    } else if (result.action === "engage") {
      if (advisorName) { const id = matchAdvisor(meetings, advisorName); if (id) setMayaMeetingId(id); }
      navigate("/engage-me");
    } else if (result.action === "follow") {
      if (advisorName) { const id = matchAdvisor(meetings, advisorName); if (id) setMayaMeetingId(id); }
      navigate("/follow-me");
    } else {
      setPhase("idle");
    }
  }, [selectedLeads, meetingsData, navigate, setAutoQuery, setMayaMeetingId]);

  const processAudio = useCallback(async (blob: Blob) => {
    setPhase("thinking");
    setErrorMsg(null);

    if (blob.size < 500) {
      setErrorMsg("Too short — try again and speak clearly.");
      setPhase("error");
      setTimeout(() => { setPhase("idle"); setErrorMsg(null); }, 3000);
      return;
    }

    try {
      const base64 = await blobToBase64(blob);
      const tsRes = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/voice/transcribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: base64 }),
      });
      if (!tsRes.ok) throw new Error(`Transcription failed (${tsRes.status})`);
      const { transcript } = await tsRes.json() as { transcript: string };

      if (!transcript?.trim()) {
        setErrorMsg("Didn't catch that — try again.");
        setPhase("error");
        setTimeout(() => { setPhase("idle"); setErrorMsg(null); }, 3000);
        return;
      }

      addTurn("user", transcript);

      const intentRes = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/agents/maya/intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript,
          firm: "VG",
          context: {
            currentPage: "Ask Maya",
            selectedLeadCount: selectedLeads.length,
            selectedLeadNames: selectedLeads.map(l => l.generatedLead.name),
          },
        }),
      });
      if (!intentRes.ok) throw new Error(`Intent failed (${intentRes.status})`);
      const result = await intentRes.json() as IntentResult;

      setPhase("done");
      await handleAction(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      setErrorMsg(msg);
      setPhase("error");
      setTimeout(() => { setPhase("idle"); setErrorMsg(null); }, 4000);
    }
  }, [selectedLeads, handleAction]);

  const startListening = useCallback(async () => {
    setErrorMsg(null);
    chunksRef.current = [];
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch {
      setErrorMsg("Mic access denied");
      setPhase("error");
      setTimeout(() => { setPhase("idle"); setErrorMsg(null); }, 3000);
      return;
    }
    streamRef.current = stream;

    const mimeType =
      MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" :
      MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
    const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    mrRef.current = mr;
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.start(200);
    setPhase("listening");
    setElapsedSecs(0);
    timerRef.current = setInterval(() => setElapsedSecs(s => s + 1), 1000);
    setTimeout(() => { if (mrRef.current?.state === "recording") stopListening(); }, 20000);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stopListening = useCallback(() => {
    const mr = mrRef.current;
    if (!mr || mr.state !== "recording") return;
    mr.onstop = () => {
      stopMic();
      const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
      chunksRef.current = [];
      void processAudio(blob);
    };
    mr.stop();
  }, [stopMic, processAudio]);

  useEffect(() => () => stopMic(), [stopMic]);

  const handleMicClick = () => {
    if (phase === "listening") stopListening();
    else if (phase === "idle" || phase === "done") void startListening();
  };

  const isListening = phase === "listening";
  const isThinking = phase === "thinking";
  const isEmpty = turns.length === 0;

  return (
    <Layout>
      <div className="flex flex-col h-full max-w-2xl mx-auto relative">

        {/* Empty state — centered hero */}
        <AnimatePresence>
          {isEmpty && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex-1 flex flex-col items-center justify-center gap-6 pb-12"
            >
              {/* Orb */}
              <div className={`relative w-24 h-24 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                isListening
                  ? "bg-red-500/15 border-red-500/50 shadow-[0_0_40px_rgba(239,68,68,0.3)]"
                  : isThinking
                  ? "bg-purple-500/15 border-purple-500/50 shadow-[0_0_40px_rgba(168,85,247,0.3)]"
                  : "bg-purple-500/10 border-purple-500/30 shadow-[0_0_40px_rgba(168,85,247,0.1)]"
              }`}>
                {isThinking ? (
                  <Loader2 className="w-9 h-9 text-purple-400 animate-spin" />
                ) : isListening ? (
                  <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 0.8 }}>
                    <Mic className="w-9 h-9 text-red-400" />
                  </motion.div>
                ) : (
                  <Sparkles className="w-9 h-9 text-purple-400" />
                )}
                {isListening && (
                  <motion.span
                    className="absolute inset-0 rounded-full border border-red-400/40"
                    animate={{ scale: [1, 1.6], opacity: [0.5, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "easeOut" }}
                  />
                )}
              </div>

              <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold text-white tracking-tight">Ask Maya</h1>
                <p className="text-muted-foreground text-sm max-w-xs">
                  {isListening
                    ? `Listening… ${elapsedSecs}s`
                    : isThinking
                    ? "Processing your request…"
                    : "Voice-control your entire sales pipeline"}
                </p>
              </div>

              {errorMsg && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="px-4 py-2.5 rounded-2xl bg-red-950/80 border border-red-500/30 text-red-300 text-sm"
                >
                  {errorMsg}
                </motion.div>
              )}

              {/* Suggestions */}
              {!isListening && !isThinking && (
                <div className="grid grid-cols-2 gap-2 mt-2 w-full max-w-sm">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-muted-foreground hover:bg-white/10 hover:text-white hover:border-purple-500/30 transition-all text-left leading-snug"
                      onClick={() => void startListening()}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Conversation turns */}
        {!isEmpty && (
          <div className="flex-1 overflow-y-auto pt-6 pb-4 space-y-5">
            <AnimatePresence initial={false}>
              {turns.map((turn, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className={`flex items-start gap-3 ${turn.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  {turn.role === "maya" && (
                    <div className="w-8 h-8 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center shrink-0 mt-0.5">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                    </div>
                  )}
                  <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    turn.role === "user"
                      ? "bg-white/10 border border-white/10 text-white rounded-tr-sm"
                      : "bg-purple-500/10 border border-purple-500/20 text-white/90 rounded-tl-sm"
                  }`}>
                    {turn.role === "maya" && (
                      <p className="text-[10px] text-purple-400 font-semibold uppercase tracking-wider mb-1">Maya</p>
                    )}
                    {turn.text}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Thinking indicator */}
            {isThinking && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-3"
              >
                <div className="w-8 h-8 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                </div>
                <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-purple-500/10 border border-purple-500/20">
                  <div className="flex gap-1.5 items-center h-4">
                    {[0, 0.2, 0.4].map((d) => (
                      <motion.span
                        key={d}
                        className="w-1.5 h-1.5 rounded-full bg-purple-400"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ repeat: Infinity, duration: 1.2, delay: d }}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
            <div ref={bottomRef} />
          </div>
        )}

        {/* Bottom mic bar — always visible */}
        <div className={`${isEmpty ? "mt-0" : "pt-4 border-t border-white/5"} pb-2 flex flex-col items-center gap-2`}>
          {!isEmpty && (
            <p className="text-xs text-muted-foreground">
              {isListening ? `${elapsedSecs}s — tap to stop` : isThinking ? "Processing…" : "Tap to speak again"}
            </p>
          )}
          <button
            onClick={handleMicClick}
            disabled={isThinking}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 focus:outline-none ${
              isListening
                ? "bg-red-500/20 border-2 border-red-500/50 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.2)] hover:bg-red-500/30"
                : isThinking
                ? "bg-purple-500/15 border-2 border-purple-500/30 text-purple-400 cursor-wait opacity-60"
                : "bg-purple-600/20 border-2 border-purple-500/30 text-purple-300 hover:bg-purple-600/30 hover:border-purple-400/50 hover:shadow-[0_0_20px_rgba(168,85,247,0.2)]"
            }`}
          >
            {isThinking ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isListening ? (
              <StopCircle className="w-5 h-5" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </Layout>
  );
}
