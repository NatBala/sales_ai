import { useState, useRef, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useMeetings } from "@/hooks/use-meetings";
import { useAgentEngageMe } from "@/hooks/use-agents";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Activity, Play, Square, Mic, Lightbulb, Zap, ArrowRightCircle, ArrowRight, CheckSquare } from "lucide-react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";

export default function EngageMe() {
  const { data: meetingsData } = useMeetings();
  const { mutate: engage, isPending, data: engageData } = useAgentEngageMe();
  
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const meetings = meetingsData?.meetings?.filter(m => m.status === 'scheduled') || [];
  const selectedMeeting = meetings.find(m => m.id === selectedMeetingId);

  // Auto-scroll to bottom of insights
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [engageData]);

  const handleAsk = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!topic.trim() || !selectedMeeting) return;
    
    engage({
      data: {
        leadName: selectedMeeting.leadName,
        leadCompany: selectedMeeting.leadCompany,
        currentTopic: topic,
      }
    });
    setTopic(""); // Clear input after asking
  };

  return (
    <Layout>
      <div className="space-y-6 max-w-[1400px] mx-auto pb-12 h-[calc(100vh-8rem)] flex flex-col">
        
        {/* Header - Compact for live view */}
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center relative">
              {isActive && <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full animate-ping" />}
              <Activity className={`w-5 h-5 text-rose-500 ${isActive ? 'animate-pulse' : ''}`} />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-white">Engage Me</h1>
            </div>
          </div>

          {selectedMeeting && (
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-muted-foreground">Live with <span className="text-white">{selectedMeeting.leadName}</span></span>
              <Button 
                onClick={() => {
                  if (isActive) setSessionCompleted(true);
                  setIsActive(!isActive);
                }}
                variant={isActive ? "destructive" : "default"}
                className={`w-32 ${!isActive ? 'bg-rose-500 hover:bg-rose-600 text-white' : ''}`}
              >
                {isActive ? <><Square className="w-4 h-4 mr-2 fill-current"/> End Session</> : <><Play className="w-4 h-4 mr-2 fill-current"/> Start Session</>}
              </Button>
            </div>
          )}
        </div>

        {!selectedMeeting ? (
          <Card className="bg-card/40 border-white/5 flex-1 flex items-center justify-center">
            <div className="max-w-md w-full p-8 text-center space-y-6">
              <Activity className="w-16 h-16 text-rose-500/20 mx-auto" />
              <h3 className="text-xl font-semibold text-white">Select a meeting to start</h3>
              <div className="space-y-2">
                {meetings.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMeetingId(m.id)}
                    className="w-full p-4 rounded-xl bg-background/50 border border-white/5 hover:border-rose-500/30 text-left transition-colors flex justify-between items-center"
                  >
                    <div>
                      <div className="font-medium text-white">{m.leadName}</div>
                      <div className="text-sm text-muted-foreground">{m.leadCompany}</div>
                    </div>
                    <ArrowRightCircle className="w-5 h-5 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>
          </Card>
        ) : (
          <div className="flex flex-col flex-1 gap-6 min-h-0">
            {/* Live Insights Dashboard */}
            <div className="flex-1 grid lg:grid-cols-3 gap-6 min-h-0">
              
              {/* Main Prompts / Suggestions */}
              <Card className="lg:col-span-2 bg-card/40 border-white/5 flex flex-col min-h-0 shadow-2xl">
                <div className="p-4 border-b border-white/5 bg-background/40 flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-amber-400" />
                  <span className="font-semibold text-white">Live Prompts & Suggestions</span>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {isPending ? (
                    <div className="flex items-center gap-3 text-muted-foreground bg-background/50 p-4 rounded-xl border border-white/5">
                      <Loader2 className="w-5 h-5 animate-spin text-rose-500" /> Analyzing conversation context...
                    </div>
                  ) : !engageData ? (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground/50">
                      <Mic className="w-12 h-12 mb-4" />
                      <p>Waiting for conversation input...</p>
                    </div>
                  ) : (
                    <AnimatePresence>
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                        {engageData.suggestions.map((s, i) => (
                          <div key={i} className="bg-amber-400/10 border border-amber-400/20 p-5 rounded-2xl text-amber-100 text-lg leading-relaxed shadow-inner">
                            {s}
                          </div>
                        ))}
                        {engageData.nextSteps.length > 0 && (
                          <div className="mt-8 pt-6 border-t border-white/5">
                            <h4 className="text-sm font-semibold text-primary uppercase tracking-wider mb-4">Recommended Next Steps</h4>
                            <div className="space-y-2">
                              {engageData.nextSteps.map((s, i) => (
                                <div key={i} className="flex gap-3 text-white/80 bg-background/50 p-3 rounded-xl border border-white/5">
                                  <ArrowRightCircle className="w-5 h-5 text-primary shrink-0" />
                                  <span>{s}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    </AnimatePresence>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </Card>

              {/* Quick Facts Sidebar */}
              <Card className="bg-card/40 border-white/5 flex flex-col min-h-0 hidden lg:flex">
                <div className="p-4 border-b border-white/5 bg-background/40 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-blue-400" />
                  <span className="font-semibold text-white">Quick Facts</span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {!engageData ? (
                     <div className="text-center text-sm text-muted-foreground mt-8">Facts will appear here</div>
                  ) : (
                    engageData.quickFacts.map((fact, i) => (
                      <motion.div 
                        initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                        key={i} className="bg-background/60 p-4 rounded-xl border border-white/5 text-sm text-blue-100 leading-relaxed"
                      >
                        {fact}
                      </motion.div>
                    ))
                  )}
                </div>
              </Card>

            </div>

            {/* Input Area (Mocking speech-to-text with manual input for this version) */}
            <div className="shrink-0 bg-card/60 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.3)]">
              <form onSubmit={handleAsk} className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center shrink-0">
                  <Mic className="w-5 h-5 text-rose-500" />
                </div>
                <Input 
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="What is the client asking about? (e.g., 'They are concerned about integration time')"
                  className="flex-1 h-14 text-lg bg-background border-white/10 text-white placeholder:text-muted-foreground focus-visible:ring-rose-500"
                  disabled={!isActive}
                />
                <Button 
                  type="submit" 
                  disabled={!isActive || !topic.trim() || isPending}
                  className="h-14 px-8 bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/25"
                >
                  {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Analyze"}
                </Button>
              </form>
            </div>

            {/* Next Step CTA */}
            <AnimatePresence>
              {sessionCompleted && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 16 }}
                  className="shrink-0 flex items-center justify-between gap-4 bg-amber-500/5 border border-amber-500/25 rounded-2xl p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center shrink-0">
                      <CheckSquare className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Next Step</p>
                      <p className="text-sm font-semibold text-white">Follow Me — Turn meeting notes into action items</p>
                    </div>
                  </div>
                  <Button asChild className="shrink-0 bg-amber-500 hover:bg-amber-400 text-white shadow-lg shadow-amber-500/20">
                    <Link href="/follow-me">
                      Proceed <ArrowRight className="w-4 h-4 ml-1.5" />
                    </Link>
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        )}
      </div>
    </Layout>
  );
}
