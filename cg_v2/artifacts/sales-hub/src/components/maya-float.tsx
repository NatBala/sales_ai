import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { useMaya } from "@/contexts/maya-context";
import { useMeetings } from "@/hooks/use-meetings";
import { useLeads } from "@/hooks/use-leads";
import { useRealtimeCall } from "@/hooks/use-realtime-call";
import {
  Mic, MicOff, Sparkles, PhoneOff, Loader2, Volume2, AlertCircle, X, GripHorizontal,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Turn {
  id: string;
  role: "user" | "maya";
  text: string;
  partial?: boolean;
}

function matchAdvisor(meetings: { id: string; leadId: string; leadName: string }[], name: string): string | null {
  if (!name?.trim()) return null;
  const needle = name.trim().toLowerCase();
  const tokens = needle.split(/\s+/);
  let best: { leadId: string; score: number } | null = null;
  for (const m of meetings) {
    const haystack = m.leadName.toLowerCase();
    let score = 0;
    if (haystack === needle) score = 100;
    else if (haystack.includes(needle)) score = 80;
    else for (const t of tokens) if (t.length > 1 && haystack.includes(t)) score += 40;
    if (score > 0 && (!best || score > best.score)) best = { leadId: m.leadId, score };
  }
  return best ? best.leadId : null;
}

let idCounter = 0;
function nextId() { return `t-${++idCounter}`; }

export function MayaFloat() {
  const { setAutoQuery, selectedLeads, mayaFocused, setMayaFocused } = useMaya();
  const { data: meetingsData } = useMeetings();
  const { data: leadsData } = useLeads();
  const [, navigate] = useLocation();

  const [turns, setTurns] = useState<Turn[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const partialMayaIdRef = useRef<string | null>(null);
  const partialUserIdRef = useRef<string | null>(null);

  // Drag state
  const [pos, setPos] = useState(() => ({
    x: typeof window !== "undefined" ? Math.max(0, window.innerWidth - 380) : 20,
    y: typeof window !== "undefined" ? Math.max(0, window.innerHeight - 540) : 20,
  }));
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, origX: 0, origY: 0 });

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { dragging: true, startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };

    const handleMove = (ev: MouseEvent) => {
      if (!dragRef.current.dragging) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 350, dragRef.current.origX + dx)),
        y: Math.max(0, Math.min(window.innerHeight - 100, dragRef.current.origY + dy)),
      });
    };
    const handleUp = () => {
      dragRef.current.dragging = false;
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };
    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
  }, [pos.x, pos.y]);

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
      // Pick the most recently created meeting (latest chosen advisor)
      const sorted = [...meetings].sort((a, b) =>
        new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
      );
      const latestLeadId = sorted[0]?.leadId;
      if (latestLeadId) navigate(`/schedule-me/${latestLeadId}`);
      else if (selectedLeads.length > 0) navigate(`/schedule-me/${selectedLeads[0].savedLeadId}`);
      else navigate("/leads");
    }
  }, [meetingsData, selectedLeads, leadsData, navigate, setAutoQuery]);

  const handlePrepNavigation = useCallback((advisorName?: string) => {
    const all = meetingsData?.meetings ?? [];
    const leadId = advisorName?.trim() ? matchAdvisor(all, advisorName) : (all[0]?.leadId ?? null);
    if (leadId) sessionStorage.setItem("maya_prep_lead", leadId);
    navigate("/prep-me");
  }, [meetingsData, navigate]);

  const handleCoachNavigation = useCallback((advisorName?: string) => {
    const all = meetingsData?.meetings ?? [];
    const leadId = advisorName?.trim() ? matchAdvisor(all, advisorName) : (all[0]?.leadId ?? null);
    if (leadId) sessionStorage.setItem("maya_coach_lead", leadId);
    navigate("/coach-me");
  }, [meetingsData, navigate]);

  const handleEngageNavigation = useCallback((advisorName?: string) => {
    const all = meetingsData?.meetings ?? [];
    const leadId = advisorName?.trim() ? matchAdvisor(all, advisorName) : (all[0]?.leadId ?? null);
    if (leadId) sessionStorage.setItem("maya_engage_lead", leadId);
    navigate("/engage-me");
  }, [meetingsData, navigate]);

  const handleFollowNavigation = useCallback((advisorName?: string) => {
    const all = meetingsData?.meetings ?? [];
    const leadId = advisorName?.trim() ? matchAdvisor(all, advisorName) : (all[0]?.leadId ?? null);
    if (leadId) sessionStorage.setItem("maya_follow_lead", leadId);
    navigate("/follow-me");
  }, [meetingsData, navigate]);

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
          item: { type: "function_call_output", call_id: callId ?? "", output: JSON.stringify({ success: true }) },
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
          } else if (name === "engage_advisor") {
            handleEngageNavigation(args.advisorName || undefined);
          } else if (name === "follow_advisor") {
            handleFollowNavigation(args.advisorName || undefined);
          }
        }, 600);
      },

      onError: (err) => {
        setErrorMsg(err.message);
        setTimeout(() => setErrorMsg(null), 8000);
      },
    });

  const isConnected = connectionState === "connected";
  const isConnecting = connectionState === "connecting";
  const isIdle = connectionState === "idle" || connectionState === "disconnected" || connectionState === "error";

  const handleStart = useCallback(async () => {
    setErrorMsg(null);
    setTurns([]);
    partialMayaIdRef.current = null;
    partialUserIdRef.current = null;
    await startCall(
      { currentPage: "App", selectedLeadCount: selectedLeads.length },
      { sessionPath: "/api/realtime/maya-session", initialResponse: null },
    );
  }, [startCall, selectedLeads.length]);

  const handleClose = useCallback(() => {
    endCall();
    setMayaFocused(false);
    setTurns([]);
  }, [endCall, setMayaFocused]);

  useEffect(() => () => { endCall(); }, [endCall]);

  if (!mayaFocused) return null;

  return (
    <div
      className="fixed z-[200] flex flex-col rounded-2xl overflow-hidden shadow-2xl shadow-black/50 border border-purple-500/20 bg-[#0a0f1e]/95 backdrop-blur-xl"
      style={{ left: pos.x, top: pos.y, width: 350, height: 500 }}
    >
      {/* Drag handle / header */}
      <div
        onMouseDown={handleDragStart}
        className="flex items-center gap-2 px-3 py-2.5 border-b border-white/5 cursor-grab active:cursor-grabbing select-none shrink-0 bg-white/[0.02]"
      >
        <GripHorizontal className="w-3.5 h-3.5 text-white/20" />

        {/* Status orb */}
        <div className={`w-2 h-2 rounded-full shrink-0 transition-colors duration-300 ${
          isConnecting ? "bg-yellow-400 animate-pulse" :
          agentSpeaking ? "bg-violet-400 animate-pulse" :
          isConnected ? "bg-green-400" : "bg-white/20"
        }`} />

        <span className="text-xs font-semibold text-white/70 flex-1">
          {isConnecting ? "Connecting…" : agentSpeaking ? "Maya is speaking" : isConnected ? "Maya · Listening" : "Maya"}
        </span>

        {/* Header controls */}
        <div className="flex items-center gap-1">
          {isConnected && (
            <button
              onClick={toggleMute}
              className={`p-1.5 rounded-lg transition-colors ${isMuted ? "text-red-400 bg-red-500/10" : "text-white/50 hover:text-white/80"}`}
            >
              {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            </button>
          )}
          {isConnected && (
            <button
              onClick={() => endCall()}
              className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <PhoneOff className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-white/40 hover:text-white/80 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Conversation area */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {/* Empty state */}
        {turns.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 pb-4">
            <div className={`relative w-16 h-16 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
              isConnecting ? "bg-purple-500/10 border-purple-500/30" :
              agentSpeaking ? "bg-violet-500/20 border-violet-500/60 shadow-[0_0_30px_rgba(139,92,246,0.35)]" :
              isConnected ? "bg-purple-500/15 border-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.2)]" :
              "bg-purple-500/10 border-purple-500/20"
            }`}>
              {isConnecting ? (
                <Loader2 className="w-7 h-7 text-purple-400 animate-spin" />
              ) : agentSpeaking ? (
                <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 0.6 }}>
                  <Volume2 className="w-7 h-7 text-violet-300" />
                </motion.div>
              ) : (
                <Sparkles className="w-7 h-7 text-purple-400" />
              )}
              {agentSpeaking && (
                <motion.span
                  className="absolute inset-0 rounded-full border border-violet-400/40"
                  animate={{ scale: [1, 1.6], opacity: [0.5, 0] }}
                  transition={{ repeat: Infinity, duration: 1.2, ease: "easeOut" }}
                />
              )}
              {isConnected && !agentSpeaking && !isMuted && (
                <motion.span
                  className="absolute inset-0 rounded-full border border-purple-500/25"
                  animate={{ scale: [1, 1.4], opacity: [0.3, 0] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeOut" }}
                />
              )}
            </div>

            <div className="text-center space-y-1 px-4">
              <p className="text-sm font-semibold text-white/80">
                {isConnecting ? "Starting Maya…" :
                 agentSpeaking ? "Maya is speaking…" :
                 isConnected && isMuted ? "You're muted" :
                 isConnected ? "Speak your command" :
                 "Ask Maya anything"}
              </p>
              {isIdle && !isConnecting && (
                <p className="text-xs text-white/30">Navigate, find leads, schedule, and more</p>
              )}
            </div>

            {/* Error */}
            <AnimatePresence>
              {errorMsg && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-950/80 border border-red-500/30 text-red-300 text-xs mx-2"
                >
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Turns */}
        <AnimatePresence initial={false}>
          {turns.map((turn) => (
            <motion.div
              key={turn.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex items-start gap-2 ${turn.role === "user" ? "flex-row-reverse" : ""}`}
            >
              {turn.role === "maya" && (
                <div className="w-6 h-6 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-3 h-3 text-purple-400" />
                </div>
              )}
              <div className={`max-w-[80%] px-3 py-2 rounded-xl text-xs leading-relaxed transition-opacity ${
                turn.partial ? "opacity-50" : "opacity-100"
              } ${
                turn.role === "user"
                  ? "bg-white/10 border border-white/10 text-white rounded-tr-sm"
                  : "bg-purple-500/10 border border-purple-500/20 text-white/90 rounded-tl-sm"
              }`}>
                {turn.role === "maya" && (
                  <p className="text-[9px] text-purple-400 font-bold uppercase tracking-wider mb-0.5">Maya</p>
                )}
                {turn.text}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Speaking dots when Maya is responding but no partial yet */}
        {agentSpeaking && !partialMayaIdRef.current && turns.length > 0 && (
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center shrink-0">
              <Sparkles className="w-3 h-3 text-purple-400" />
            </div>
            <div className="px-3 py-2 rounded-xl rounded-tl-sm bg-purple-500/10 border border-purple-500/20">
              <div className="flex gap-1 items-center h-3">
                {[0, 0.15, 0.3].map((d) => (
                  <motion.span key={d} className="w-1 h-1 rounded-full bg-purple-400"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ repeat: Infinity, duration: 1.2, delay: d }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Error in conversation */}
        {turns.length > 0 && errorMsg && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-950/80 border border-red-500/30 text-red-300 text-xs">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {errorMsg}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Footer controls */}
      <div className="shrink-0 px-3 py-2.5 border-t border-white/5 flex items-center gap-2">
        {isConnected ? (
          <>
            <button
              onClick={toggleMute}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                isMuted
                  ? "bg-red-500/15 border-red-500/30 text-red-300 hover:bg-red-500/25"
                  : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80"
              }`}
            >
              {isMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
              {isMuted ? "Unmute" : "Mute"}
            </button>
            <button
              onClick={() => endCall()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-red-500/10 border border-red-500/25 text-red-400 hover:bg-red-500/20 transition-all ml-auto"
            >
              <PhoneOff className="w-3 h-3" />
              End
            </button>
          </>
        ) : isConnecting ? (
          <button disabled className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-purple-500/10 border border-purple-500/20 text-purple-300 opacity-70 cursor-wait w-full justify-center">
            <Loader2 className="w-3 h-3 animate-spin" />
            Connecting…
          </button>
        ) : (
          <button
            onClick={handleStart}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gradient-to-r from-purple-600/20 to-indigo-600/20 border border-purple-500/30 text-purple-200 hover:from-purple-600/30 hover:border-purple-400/50 hover:text-white transition-all w-full justify-center"
          >
            <Sparkles className="w-3 h-3" />
            Start Maya
          </button>
        )}
      </div>
    </div>
  );
}
