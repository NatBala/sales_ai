import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useMaya } from "@/contexts/maya-context";
import { useMeetings } from "@/hooks/use-meetings";
import { useLeads } from "@/hooks/use-leads";
import { useRealtimeCall } from "@/hooks/use-realtime-call";
import {
  Mic, MicOff, Sparkles, PhoneOff, Loader2, Volume2, AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Turn {
  id: string;
  role: "user" | "maya";
  text: string;
  partial?: boolean;
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
  "Schedule outreach with my first advisor",
  "Coach me on overcoming fee objections",
  "Show me my follow-up tasks",
];

let idCounter = 0;
function nextId() { return `t-${++idCounter}`; }

export default function AskMaya() {
  const { setAutoQuery, setMayaMeetingId, selectedLeads } = useMaya();
  const { data: meetingsData } = useMeetings();
  const { data: leadsData } = useLeads();
  const [, navigate] = useLocation();

  const [turns, setTurns] = useState<Turn[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const partialMayaIdRef = useRef<string | null>(null);
  const partialUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  const addTurn = useCallback((role: "user" | "maya", text: string, id?: string): string => {
    const turnId = id ?? nextId();
    setTurns(prev => [...prev, { id: turnId, role, text }]);
    return turnId;
  }, []);

  const updateTurn = useCallback((id: string, text: string, partial = false) => {
    setTurns(prev => prev.map(t => t.id === id ? { ...t, text, partial } : t));
  }, []);

  // Navigation helpers
  const handleScheduleNavigation = useCallback((advisorName?: string) => {
    const meetings = meetingsData?.meetings ?? [];
    if (advisorName?.trim()) {
      const needle = advisorName.trim().toLowerCase();
      const tokens = needle.split(/\s+/);
      const matchedMeeting = meetings.find(m => {
        const hay = m.leadName.toLowerCase();
        if (hay === needle || hay.includes(needle)) return true;
        return tokens.some(t => t.length > 1 && hay.includes(t));
      });
      if (matchedMeeting && (matchedMeeting as { leadId?: string }).leadId) {
        navigate(`/schedule-me/${(matchedMeeting as { leadId: string }).leadId}`); return;
      }
      const matchedLead = selectedLeads.find(l => {
        const hay = l.generatedLead.name.toLowerCase();
        return tokens.some(t => t.length > 1 && hay.includes(t));
      });
      if (matchedLead) { navigate(`/schedule-me/${matchedLead.savedLeadId}`); return; }
      const savedLeads = (leadsData as { leads?: { id: string; name: string }[] })?.leads ?? [];
      const matchedSaved = savedLeads.find(l => {
        const hay = l.name.toLowerCase();
        if (hay === needle || hay.includes(needle)) return true;
        return tokens.some(t => t.length > 1 && hay.includes(t));
      });
      if (matchedSaved) { navigate(`/schedule-me/${matchedSaved.id}`); return; }
      setAutoQuery(advisorName);
      navigate("/lead-me");
    } else {
      const firstMeetingLeadId = meetings[0]?.leadId;
      if (firstMeetingLeadId) navigate(`/schedule-me/${firstMeetingLeadId}`);
      else if (selectedLeads.length > 0) navigate(`/schedule-me/${selectedLeads[0].savedLeadId}`);
      else navigate("/leads");
    }
  }, [meetingsData, selectedLeads, leadsData, navigate, setAutoQuery]);

  const handlePrepNavigation = useCallback((advisorName?: string) => {
    const meetings = meetingsData?.meetings ?? [];
    if (advisorName?.trim()) {
      const id = matchAdvisor(meetings, advisorName);
      if (id) setMayaMeetingId(id);
    }
    navigate("/prep-me");
  }, [meetingsData, navigate, setMayaMeetingId]);

  const handleCoachNavigation = useCallback((advisorName?: string) => {
    const meetings = meetingsData?.meetings ?? [];
    if (advisorName?.trim()) {
      const id = matchAdvisor(meetings, advisorName);
      if (id) setMayaMeetingId(id);
    }
    navigate("/coach-me");
  }, [meetingsData, navigate, setMayaMeetingId]);

  const { connectionState, agentSpeaking, isMuted, startCall, endCall, toggleMute } =
    useRealtimeCall({
      playbackWorkletPath: `${import.meta.env.BASE_URL}audio-playback-worklet.js`,
      captureWorkletPath: `${import.meta.env.BASE_URL}audio-capture-worklet.js`,

      onUserTranscriptDelta: (_delta, accumulated) => {
        if (partialUserIdRef.current) {
          updateTurn(partialUserIdRef.current, accumulated, true);
        } else {
          const id = nextId();
          partialUserIdRef.current = id;
          setTurns(prev => [...prev, { id, role: "user", text: accumulated, partial: true }]);
        }
      },
      onUserTranscript: (text) => {
        if (partialUserIdRef.current) {
          updateTurn(partialUserIdRef.current, text, false);
          partialUserIdRef.current = null;
        } else {
          addTurn("user", text);
        }
      },

      onAgentTranscriptDelta: (_delta, accumulated) => {
        if (partialMayaIdRef.current) {
          updateTurn(partialMayaIdRef.current, accumulated, true);
        } else {
          const id = nextId();
          partialMayaIdRef.current = id;
          setTurns(prev => [...prev, { id, role: "maya", text: accumulated, partial: true }]);
        }
      },
      onAgentResponseDone: (text) => {
        if (partialMayaIdRef.current) {
          updateTurn(partialMayaIdRef.current, text, false);
          partialMayaIdRef.current = null;
        } else {
          addTurn("maya", text);
        }
      },

      onFunctionCall: (toolCall, { sendRealtimeEvent }) => {
        const { name, callId, argumentsText } = toolCall;
        let args: Record<string, string> = {};
        try { args = JSON.parse(argumentsText); } catch { /* ignore */ }

        sendRealtimeEvent({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: callId ?? "",
            output: JSON.stringify({ success: true }),
          },
        });

        setTimeout(() => {
          if (name === "navigate_to") {
            const routes: Record<string, string> = {
              "dashboard": "/", "lead-me": "/lead-me", "leads": "/leads",
              "prep-me": "/prep-me", "coach-me": "/coach-me",
              "engage-me": "/engage-me", "follow-me": "/follow-me",
            };
            navigate(routes[args.page ?? "dashboard"] ?? "/");
          } else if (name === "find_leads") {
            setAutoQuery(args.query ?? "");
            navigate("/lead-me");
          } else if (name === "schedule_advisor") {
            handleScheduleNavigation(args.advisorName || undefined);
          } else if (name === "prep_advisor") {
            handlePrepNavigation(args.advisorName || undefined);
          } else if (name === "coach_advisor") {
            handleCoachNavigation(args.advisorName || undefined);
          }
        }, 800);
      },

      onError: (err) => {
        setErrorMsg(err.message);
        setTimeout(() => setErrorMsg(null), 6000);
      },
    });

  const isConnected = connectionState === "connected";
  const isConnecting = connectionState === "connecting";
  const isIdle = connectionState === "idle" || connectionState === "disconnected";
  const isEmpty = turns.length === 0;

  const handleStart = useCallback(async () => {
    setErrorMsg(null);
    await startCall(
      { currentPage: "Ask Maya", selectedLeadCount: selectedLeads.length },
      {
        sessionPath: "/api/realtime/maya-session",
        initialResponse: null,
      },
    );
  }, [startCall, selectedLeads.length]);

  useEffect(() => () => { endCall(); }, [endCall]);

  return (
    <Layout>
      <div className="flex flex-col h-full max-w-2xl mx-auto relative">

        {/* Empty state */}
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
                isConnecting
                  ? "bg-purple-500/10 border-purple-500/30"
                  : agentSpeaking
                  ? "bg-violet-500/20 border-violet-500/60 shadow-[0_0_50px_rgba(139,92,246,0.4)]"
                  : isConnected
                  ? "bg-purple-500/15 border-purple-500/50 shadow-[0_0_40px_rgba(168,85,247,0.25)]"
                  : "bg-purple-500/10 border-purple-500/30 shadow-[0_0_40px_rgba(168,85,247,0.1)]"
              }`}>
                {isConnecting ? (
                  <Loader2 className="w-9 h-9 text-purple-400 animate-spin" />
                ) : agentSpeaking ? (
                  <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 0.6 }}>
                    <Volume2 className="w-9 h-9 text-violet-300" />
                  </motion.div>
                ) : (
                  <Sparkles className="w-9 h-9 text-purple-400" />
                )}

                {/* Speaking ripple */}
                {agentSpeaking && (
                  <motion.span
                    className="absolute inset-0 rounded-full border border-violet-400/40"
                    animate={{ scale: [1, 1.7], opacity: [0.6, 0] }}
                    transition={{ repeat: Infinity, duration: 1.2, ease: "easeOut" }}
                  />
                )}
                {/* Listening ripple */}
                {isConnected && !agentSpeaking && !isMuted && (
                  <motion.span
                    className="absolute inset-0 rounded-full border border-purple-500/30"
                    animate={{ scale: [1, 1.5], opacity: [0.4, 0] }}
                    transition={{ repeat: Infinity, duration: 2, ease: "easeOut" }}
                  />
                )}
              </div>

              <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold text-white tracking-tight">Ask Maya</h1>
                <p className="text-muted-foreground text-sm max-w-xs">
                  {isConnecting
                    ? "Connecting to Maya…"
                    : agentSpeaking
                    ? "Maya is speaking…"
                    : isConnected && isMuted
                    ? "You're muted — tap to unmute"
                    : isConnected
                    ? "Listening — speak your command"
                    : "Real-time voice assistant for your sales pipeline"}
                </p>
              </div>

              {/* Error */}
              <AnimatePresence>
                {errorMsg && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-red-950/80 border border-red-500/30 text-red-300 text-sm"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {errorMsg}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Suggestions — only when idle */}
              {isIdle && !isConnecting && (
                <div className="grid grid-cols-2 gap-2 mt-2 w-full max-w-sm">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-muted-foreground hover:bg-white/10 hover:text-white hover:border-purple-500/30 transition-all text-left leading-snug"
                      onClick={handleStart}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Conversation transcript */}
        {!isEmpty && (
          <div className="flex-1 overflow-y-auto pt-6 pb-4 space-y-5">
            <AnimatePresence initial={false}>
              {turns.map((turn) => (
                <motion.div
                  key={turn.id}
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
                  <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed transition-opacity ${
                    turn.partial ? "opacity-60" : "opacity-100"
                  } ${
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

            {/* Live speaking indicator */}
            {agentSpeaking && turns[turns.length - 1]?.role !== "maya" && (
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

        {/* Bottom controls */}
        <div className={`${isEmpty ? "mt-0" : "pt-4 border-t border-white/5"} pb-2 flex flex-col items-center gap-3`}>

          {/* Error (when not empty) */}
          {!isEmpty && errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-950/80 border border-red-500/30 text-red-300 text-xs"
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {errorMsg}
            </motion.div>
          )}

          {!isEmpty && (
            <p className="text-xs text-muted-foreground">
              {isConnecting
                ? "Connecting…"
                : agentSpeaking
                ? "Maya is speaking…"
                : isConnected && isMuted
                ? "You're muted"
                : isConnected
                ? "Listening — speak your command"
                : "Session ended"}
            </p>
          )}

          <div className="flex items-center gap-3">
            {/* Mute toggle — only when connected */}
            {isConnected && (
              <button
                onClick={toggleMute}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 border ${
                  isMuted
                    ? "bg-red-500/20 border-red-500/40 text-red-300 hover:bg-red-500/30"
                    : "bg-white/10 border-white/20 text-white/70 hover:bg-white/20"
                }`}
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
            )}

            {/* Start / End button */}
            {isIdle || connectionState === "error" ? (
              <button
                onClick={handleStart}
                className="flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-sm bg-gradient-to-r from-purple-600/20 to-indigo-600/20 border border-purple-500/30 text-purple-200 hover:from-purple-600/30 hover:to-indigo-600/30 hover:border-purple-400/50 hover:text-white shadow-lg shadow-purple-500/10 transition-all duration-200"
              >
                <Sparkles className="w-4 h-4" />
                Start Maya
              </button>
            ) : isConnecting ? (
              <button
                disabled
                className="flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-sm bg-purple-500/15 border border-purple-500/30 text-purple-300 cursor-wait opacity-70"
              >
                <Loader2 className="w-4 h-4 animate-spin" />
                Connecting…
              </button>
            ) : (
              <button
                onClick={() => endCall()}
                className="flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-sm bg-red-500/15 border border-red-500/30 text-red-300 hover:bg-red-500/25 transition-all duration-200"
              >
                <PhoneOff className="w-4 h-4" />
                End Session
              </button>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
