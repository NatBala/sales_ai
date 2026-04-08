import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { useMaya } from "@/contexts/maya-context";
import { useMeetings } from "@/hooks/use-meetings";
import { useLeads } from "@/hooks/use-leads";
import { Mic, Loader2, X, Users, ChevronRight, Sparkles, Bot } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const r = reader.result as string;
      resolve(r.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

type Phase = "idle" | "listening" | "thinking" | "done" | "error";

interface IntentResult {
  action: "find_leads" | "schedule" | "prep" | "coach" | "engage" | "follow" | "general";
  query?: string;
  targetAdvisor?: string;
  message: string;
}

const PAGE_LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/lead-me": "Lead Me",
  "/schedule-me": "Schedule Me",
  "/prep-me": "Prep Me",
  "/coach-me": "Coach Me",
  "/engage-me": "Engage Me",
  "/follow-me": "Follow Me",
};

function getPageLabel(path: string): string {
  for (const [k, v] of Object.entries(PAGE_LABELS)) {
    if (path === k || path.startsWith(k + "/")) return v;
  }
  return "Home";
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
    else {
      for (const t of tokens) {
        if (t.length > 1 && haystack.includes(t)) score += 40;
      }
    }
    if (score > 0 && (!best || score > best.score)) best = { id: m.id, score };
  }
  return best ? best.id : null;
}

export function MayaBar() {
  const {
    selectedLeads, clearLeads,
    setAutoQuery,
    setMayaMeetingId,
    mayaMessage, setMayaMessage,
    mayaPhase, setMayaPhase,
    mayaFocused, setMayaFocused,
  } = useMaya();
  const { data: meetingsData } = useMeetings();
  const { data: leadsData } = useLeads();

  const [, navigate] = useLocation();
  const [location] = useLocation();

  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentPage = getPageLabel(location);

  const clearBubbleTimer = () => {
    if (bubbleTimerRef.current) { clearTimeout(bubbleTimerRef.current); bubbleTimerRef.current = null; }
  };

  const showMessage = useCallback((msg: string) => {
    setMayaMessage(msg);
    clearBubbleTimer();
    bubbleTimerRef.current = setTimeout(() => setMayaMessage(null), 8000);
  }, [setMayaMessage]);

  const stopMic = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const handleAction = useCallback(async (result: IntentResult) => {
    setMayaPhase("responding");
    showMessage(result.message);

    const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
    await delay(400);

    const meetings = meetingsData?.meetings ?? [];
    const advisorName = result.targetAdvisor;

    if (result.action === "find_leads" && result.query) {
      setAutoQuery(result.query);
      navigate("/lead-me");
    } else if (result.action === "schedule") {
      if (advisorName) {
        // 1. Check saved meetings first (have leadId for direct navigation)
        const needle = advisorName.trim().toLowerCase();
        const tokens = needle.split(/\s+/);
        const matchedMeeting = meetings.find(m => {
          const hay = m.leadName.toLowerCase();
          if (hay === needle || hay.includes(needle)) return true;
          return tokens.some(t => t.length > 1 && hay.includes(t));
        });
        if (matchedMeeting && (matchedMeeting as { leadId?: string }).leadId) {
          navigate(`/schedule-me/${(matchedMeeting as { leadId: string }).leadId}`);
        } else {
          // 2. Check Maya-queued leads
          const matchedLead = selectedLeads.find(l => {
            const hay = l.generatedLead.name.toLowerCase();
            return tokens.some(t => t.length > 1 && hay.includes(t));
          });
          if (matchedLead) {
            navigate(`/schedule-me/${matchedLead.savedLeadId}`);
          } else {
            // 3. Check all saved leads in DB
            const savedLeads = (leadsData as { leads?: { id: string; name: string }[] })?.leads ?? [];
            const matchedSaved = savedLeads.find(l => {
              const hay = l.name.toLowerCase();
              if (hay === needle || hay.includes(needle)) return true;
              return tokens.some(t => t.length > 1 && hay.includes(t));
            });
            if (matchedSaved) {
              navigate(`/schedule-me/${matchedSaved.id}`);
            } else {
              // 4. Search for advisor in lead-me
              setAutoQuery(advisorName);
              navigate("/lead-me");
            }
          }
        }
      } else {
        // No name given — open first meeting in My Schedule
        const firstMeetingLeadId = (meetings[0] as { leadId?: string } | undefined)?.leadId;
        if (firstMeetingLeadId) {
          navigate(`/schedule-me/${firstMeetingLeadId}`);
        } else if (selectedLeads.length > 0) {
          navigate(`/schedule-me/${selectedLeads[0].savedLeadId}`);
        } else {
          navigate("/lead-me");
        }
      }
    } else if (result.action === "prep") {
      if (advisorName) {
        const meetingId = matchAdvisor(meetings, advisorName);
        if (meetingId) setMayaMeetingId(meetingId);
      }
      navigate("/prep-me");
    } else if (result.action === "coach") {
      if (advisorName) {
        const meetingId = matchAdvisor(meetings, advisorName);
        if (meetingId) setMayaMeetingId(meetingId);
      }
      navigate("/coach-me");
    } else if (result.action === "engage") {
      if (advisorName) {
        const meetingId = matchAdvisor(meetings, advisorName);
        if (meetingId) setMayaMeetingId(meetingId);
      }
      navigate("/engage-me");
    } else if (result.action === "follow") {
      if (advisorName) {
        const meetingId = matchAdvisor(meetings, advisorName);
        if (meetingId) setMayaMeetingId(meetingId);
      }
      navigate("/follow-me");
    }

    setTimeout(() => {
      setMayaPhase("idle");
      setMayaFocused(false);
    }, 1500);
  }, [selectedLeads, meetingsData, navigate, setAutoQuery, setMayaMeetingId, showMessage, setMayaPhase, setMayaFocused]);

  const processAudio = useCallback(async (blob: Blob) => {
    setPhase("thinking");

    if (blob.size < 500) {
      setPhase("error");
      setErrorMsg("Too short — try again and speak clearly.");
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
        setPhase("error");
        setErrorMsg("Didn't catch that — try again.");
        setTimeout(() => { setPhase("idle"); setErrorMsg(null); }, 3000);
        return;
      }

      const intentRes = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/agents/maya/intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript,
          firm: "CG",
          context: {
            currentPage,
            selectedLeadCount: selectedLeads.length,
            selectedLeadNames: selectedLeads.map(l => l.generatedLead.name),
          },
        }),
      });
      if (!intentRes.ok) throw new Error(`Intent failed (${intentRes.status})`);
      const result = await intentRes.json() as IntentResult;

      setPhase("done");
      await handleAction(result);
      setTimeout(() => setPhase("idle"), 600);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error";
      setPhase("error");
      setErrorMsg(msg);
      setTimeout(() => { setPhase("idle"); setErrorMsg(null); }, 4000);
    }
  }, [currentPage, selectedLeads, handleAction]);

  const startListening = useCallback(async () => {
    setErrorMsg(null);
    chunksRef.current = [];

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (e) {
      setPhase("error");
      setErrorMsg("Mic access denied");
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

    // Auto-stop after 20 seconds
    setTimeout(() => {
      if (mrRef.current?.state === "recording") stopListening();
    }, 20000);
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

  const handleButtonClick = useCallback(() => {
    if (phase === "listening") {
      stopListening();
    } else if (phase === "idle" || phase === "done") {
      void startListening();
    }
  }, [phase, startListening, stopListening]);

  useEffect(() => () => {
    stopMic();
    clearBubbleTimer();
  }, [stopMic]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-start listening when modal opens
  useEffect(() => {
    if (mayaFocused && (phase === "idle" || phase === "done")) {
      void startListening();
    }
    if (!mayaFocused && phase === "listening") {
      stopListening();
    }
  }, [mayaFocused]); // eslint-disable-line react-hooks/exhaustive-deps

  const isListening = phase === "listening";
  const isThinking = phase === "thinking";

  return (
    <>
    {/* Centered Maya Modal */}
    <AnimatePresence>
      {mayaFocused && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md"
          onClick={(e) => { if (e.target === e.currentTarget) { stopListening(); setMayaFocused(false); } }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 16 }}
            transition={{ type: "spring", damping: 22, stiffness: 280 }}
            className="relative flex flex-col items-center gap-6 px-10 py-10 rounded-3xl bg-[#0a0f1e]/95 border border-purple-500/20 shadow-2xl shadow-purple-500/10 min-w-[320px] max-w-sm w-full mx-4"
          >
            {/* Close */}
            <button
              onClick={() => { stopListening(); setMayaFocused(false); }}
              className="absolute top-4 right-4 text-muted-foreground hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Avatar */}
            <div className="relative">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                isListening
                  ? "bg-red-500/15 border-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.25)]"
                  : isThinking
                  ? "bg-purple-500/15 border-purple-500/50 shadow-[0_0_30px_rgba(168,85,247,0.25)]"
                  : phase === "done"
                  ? "bg-green-500/15 border-green-500/40"
                  : "bg-purple-500/10 border-purple-500/30"
              }`}>
                {isThinking ? (
                  <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                ) : isListening ? (
                  <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 0.8 }}>
                    <Mic className="w-8 h-8 text-red-400" />
                  </motion.div>
                ) : (
                  <Sparkles className="w-8 h-8 text-purple-400" />
                )}
              </div>
              {isListening && (
                <motion.span
                  className="absolute inset-0 rounded-full border border-red-500/40"
                  animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
                  transition={{ repeat: Infinity, duration: 1.4, ease: "easeOut" }}
                />
              )}
            </div>

            {/* Label */}
            <div className="text-center space-y-1">
              <p className="text-lg font-semibold text-white tracking-tight">
                {isListening ? "Listening…" : isThinking ? "Thinking…" : phase === "done" ? "Got it!" : "Ask Maya"}
              </p>
              <p className="text-xs text-muted-foreground">
                {isListening
                  ? `${elapsedSecs}s — speak your command, then tap stop`
                  : isThinking
                  ? "Processing your request…"
                  : phase === "done"
                  ? "Navigating you now"
                  : "Voice-control your entire pipeline"}
              </p>
            </div>

            {/* Maya message */}
            <AnimatePresence>
              {(mayaMessage || errorMsg) && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  className={`w-full px-4 py-3 rounded-2xl text-sm border text-center ${
                    errorMsg
                      ? "bg-red-950/80 border-red-500/30 text-red-300"
                      : "bg-purple-500/10 border-purple-500/20 text-white/90"
                  }`}
                >
                  {!errorMsg && <span className="text-purple-300 font-semibold">Maya · </span>}
                  {errorMsg || mayaMessage}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Mic button */}
            {!isThinking && phase !== "done" && (
              <button
                onClick={handleButtonClick}
                className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 ${
                  isListening
                    ? "bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30"
                    : "bg-purple-600/20 border border-purple-500/30 text-purple-200 hover:bg-purple-600/30 hover:border-purple-400/50"
                }`}
              >
                {isListening ? "Stop" : "Tap to speak"}
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    <div className="flex items-center gap-3 ml-auto mr-2">

      {/* Selected leads badge */}
      <AnimatePresence>
        {selectedLeads.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, x: 8 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.85, x: 8 }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-sm"
          >
            <Users className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-blue-300 font-medium">{selectedLeads.length} selected</span>
            <button
              onClick={clearLeads}
              className="text-blue-400/60 hover:text-blue-300 transition-colors ml-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Maya button + bubble */}
      <div className="relative">
        <AnimatePresence>
          {(mayaMessage || errorMsg) && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.95 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              className="absolute bottom-full right-0 mb-3 z-50"
            >
              <div className={`max-w-xs px-4 py-3 rounded-2xl rounded-br-sm text-sm shadow-xl border ${
                errorMsg
                  ? "bg-red-950/95 border-red-500/30 text-red-300"
                  : "bg-[#0f1729]/95 border-purple-500/25 text-white/90"
              }`}>
                {!errorMsg && (
                  <div className="flex items-center gap-1.5 mb-1">
                    <Bot className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-xs font-semibold text-purple-300">Maya</span>
                  </div>
                )}
                {errorMsg || mayaMessage}
              </div>
              {/* Tail */}
              <div className={`absolute right-3 top-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] ${errorMsg ? "border-t-red-950/95" : "border-t-[#0f1729]/95"}`} />
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={handleButtonClick}
          disabled={isThinking}
          className={`relative flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm transition-all duration-200 focus:outline-none ${
            isListening
              ? "bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30"
              : isThinking
              ? "bg-purple-500/20 border border-purple-500/30 text-purple-300 cursor-wait"
              : "bg-gradient-to-r from-purple-600/20 to-indigo-600/20 border border-purple-500/30 text-purple-200 hover:from-purple-600/30 hover:to-indigo-600/30 hover:border-purple-400/50 hover:text-white shadow-lg shadow-purple-500/10"
          }`}
        >
          {/* Pulse ring when listening */}
          {isListening && (
            <motion.span
              className="absolute inset-0 rounded-full border border-red-500/50"
              animate={{ scale: [1, 1.3], opacity: [0.7, 0] }}
              transition={{ repeat: Infinity, duration: 1.2, ease: "easeOut" }}
            />
          )}

          {isThinking ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isListening ? (
            <motion.div
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ repeat: Infinity, duration: 0.8 }}
            >
              <Mic className="w-4 h-4" />
            </motion.div>
          ) : (
            <Sparkles className="w-4 h-4 text-purple-400" />
          )}

          <span>
            {isListening
              ? `Listening… ${elapsedSecs}s`
              : isThinking
              ? "Thinking…"
              : "Ask Maya"
            }
          </span>

          {!isListening && !isThinking && (
            <ChevronRight className="w-3 h-3 opacity-50" />
          )}
        </button>
      </div>
    </div>
    </>
  );
}
