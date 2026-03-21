import { useState } from "react";
import { Layout } from "@/components/layout";
import { useAgentLeadMe } from "@/hooks/use-agents";
import { useCreateLead } from "@/hooks/use-leads";
import type { GeneratedLead } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Search, Building2, Briefcase, TrendingUp,
  Save, Check, ArrowRight, Calendar, Mic, MicOff
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { useVoiceRecorder } from "@workspace/integrations-openai-ai-react";

async function blobToBase64(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export default function LeadMe() {
  const [query, setQuery] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const { mutate: generateLeads, isPending: isGenerating, data } = useAgentLeadMe();
  const { mutate: saveLead, isPending: isSaving } = useCreateLead();
  const { toast } = useToast();
  const [savedIndices, setSavedIndices] = useState<number[]>([]);
  const { state: voiceState, startRecording, stopRecording } = useVoiceRecorder();
  const isRecording = voiceState === "recording";

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSavedIndices([]);
    generateLeads({ data: { query } });
  };

  const handleMicClick = async () => {
    if (isRecording) {
      const blob = await stopRecording();
      if (!blob.size) return;

      setIsTranscribing(true);
      setQuery("");

      try {
        const base64 = await blobToBase64(blob);

        const resp = await fetch("/api/agents/lead-me/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audioBase64: base64, mimeType: blob.type }),
        });

        if (!resp.ok) {
          throw new Error("Transcription request failed");
        }

        const data = await resp.json() as { text?: string; error?: string };
        if (data.text) {
          setQuery(data.text);
        }
      } catch (err) {
        toast({ title: "Transcription failed", description: "Please try again or type your query.", variant: "destructive" });
      } finally {
        setIsTranscribing(false);
      }
    } else {
      setQuery("");
      setSavedIndices([]);
      await startRecording();
    }
  };

  const handleSave = (lead: GeneratedLead, index: number) => {
    saveLead(
      { data: lead },
      {
        onSuccess: () => {
          setSavedIndices(prev => [...prev, index]);
          toast({
            title: "Lead Saved",
            description: `${lead.name} has been added to your pipeline.`,
          });
        }
      }
    );
  };

  const isBusy = isRecording || isTranscribing;

  return (
    <Layout>
      <div className="space-y-8 max-w-5xl mx-auto pb-12">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-blue-400/10 border border-blue-400/20 flex items-center justify-center">
            <Search className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-white">Lead Me</h1>
            <p className="text-muted-foreground">Natural language targeted lead generation.</p>
          </div>
        </div>

        {/* Search Input */}
        <Card className="glass-card overflow-hidden border-primary/20">
          <CardContent className="p-2">
            <form onSubmit={handleSearch} className="flex relative items-center">

              {/* Mic button — left side */}
              <button
                type="button"
                onClick={handleMicClick}
                disabled={isTranscribing}
                className={`absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 focus:outline-none ${
                  isRecording
                    ? "bg-red-500/20 border border-red-500/40 text-red-400"
                    : isTranscribing
                    ? "bg-blue-500/20 border border-blue-500/30 text-blue-400 cursor-wait"
                    : "bg-white/5 border border-white/10 text-muted-foreground hover:text-white hover:bg-white/10 hover:border-white/20"
                }`}
              >
                <AnimatePresence mode="wait">
                  {isRecording ? (
                    <motion.div
                      key="recording"
                      initial={{ scale: 0.7 }}
                      animate={{ scale: [1, 1.15, 1] }}
                      transition={{ repeat: Infinity, duration: 1, ease: "easeInOut" }}
                    >
                      <MicOff className="w-4 h-4" />
                    </motion.div>
                  ) : isTranscribing ? (
                    <motion.div key="transcribing" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </motion.div>
                  ) : (
                    <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <Mic className="w-4 h-4" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>

              <Input
                value={query}
                onChange={(e) => !isBusy && setQuery(e.target.value)}
                placeholder={
                  isRecording
                    ? "Listening… speak your lead query"
                    : isTranscribing
                    ? ""
                    : "Tap the mic or type — e.g. VP of Sales at Series B fintech startups in NYC…"
                }
                readOnly={isBusy}
                className="w-full pl-16 pr-36 h-16 text-lg bg-transparent border-0 focus-visible:ring-0 text-white placeholder:text-muted-foreground/60"
              />

              {/* Streaming cursor while transcribing */}
              {isTranscribing && (
                <span className="absolute left-16 top-1/2 -translate-y-1/2 pointer-events-none text-lg text-white">
                  {query}
                  <motion.span
                    className="inline-block w-0.5 h-5 bg-primary ml-0.5 align-middle"
                    animate={{ opacity: [1, 0] }}
                    transition={{ repeat: Infinity, duration: 0.6, ease: "steps(1)" }}
                  />
                </span>
              )}

              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <Button
                  type="submit"
                  disabled={isGenerating || !query.trim() || isBusy}
                  className="h-12 px-6 rounded-xl font-semibold shadow-lg shadow-primary/25"
                >
                  {isGenerating ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Search className="w-5 h-5 mr-2" />}
                  Generate
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Recording / Transcribing status bar */}
        <AnimatePresence>
          {(isRecording || isTranscribing) && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border bg-card/40"
              style={isRecording
                ? { borderColor: "rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.05)" }
                : { borderColor: "rgba(59,130,246,0.3)", background: "rgba(59,130,246,0.05)" }
              }
            >
              <div className="flex gap-1 items-center">
                {[0, 1, 2, 3].map(i => (
                  <motion.div
                    key={i}
                    className={`w-1 rounded-full ${isRecording ? "bg-red-400" : "bg-blue-400"}`}
                    animate={{ height: isRecording ? ["8px", "20px", "8px"] : ["8px", "14px", "8px"] }}
                    transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15, ease: "easeInOut" }}
                  />
                ))}
              </div>
              <span className={`text-sm font-medium ${isRecording ? "text-red-400" : "text-blue-400"}`}>
                {isRecording
                  ? "Recording — tap the mic again to stop"
                  : "Transcribing with GPT-4o — streaming result…"}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        <AnimatePresence mode="wait">
          {data?.leads && data.leads.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between pl-2">
                <h3 className="text-xl font-display font-semibold text-white">Generated Matches ({data.leads.length})</h3>
              </div>

              <div className="grid gap-4">
                {data.leads.map((lead, i) => {
                  const isSaved = savedIndices.includes(i);
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                    >
                      <Card className="bg-card/40 border-white/5 hover:border-white/15 transition-all">
                        <CardContent className="p-6">
                          <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                            <div className="flex-1 space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="text-xl font-bold text-white">{lead.name}</h4>
                                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 px-3 py-1">
                                  Fit Score: {lead.score}/100
                                </Badge>
                              </div>

                              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1.5 bg-secondary/50 px-2.5 py-1 rounded-md">
                                  <Building2 className="w-4 h-4" /> {lead.company}
                                </span>
                                <span className="flex items-center gap-1.5 bg-secondary/50 px-2.5 py-1 rounded-md">
                                  <Briefcase className="w-4 h-4" /> {lead.title}
                                </span>
                                {lead.aum && (
                                  <span className="flex items-center gap-1.5 bg-secondary/50 px-2.5 py-1 rounded-md text-emerald-400/80">
                                    <TrendingUp className="w-4 h-4" /> {lead.aum} AUM
                                  </span>
                                )}
                              </div>

                              <div className="bg-background/50 p-4 rounded-xl border border-white/5 mt-4">
                                <p className="text-sm text-white/80 leading-relaxed">
                                  <span className="font-semibold text-primary mr-2">AI Reasoning:</span>
                                  {lead.reason}
                                </p>
                              </div>
                            </div>

                            <div className="w-full md:w-auto shrink-0 border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0 md:pl-6 flex flex-col gap-3">
                              <Button
                                onClick={() => handleSave(lead, i)}
                                disabled={isSaved || isSaving}
                                variant={isSaved ? "secondary" : "default"}
                                className={`w-full md:w-32 h-12 ${isSaved ? "opacity-100 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 hover:text-emerald-400" : ""}`}
                              >
                                {isSaved ? (
                                  <><Check className="w-4 h-4 mr-2" /> Saved</>
                                ) : (
                                  <><Save className="w-4 h-4 mr-2" /> Save Lead</>
                                )}
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sequential CTA */}
        <AnimatePresence>
          {savedIndices.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-4"
            >
              <div className="flex items-center justify-between gap-4 bg-card/90 backdrop-blur-xl border border-cyan-400/30 rounded-2xl p-4 shadow-2xl shadow-cyan-500/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center shrink-0">
                    <Calendar className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Next Step</p>
                    <p className="text-sm font-semibold text-white">Schedule Me — Book a meeting with your lead</p>
                  </div>
                </div>
                <Button asChild className="shrink-0 bg-cyan-500 hover:bg-cyan-400 text-white shadow-lg shadow-cyan-500/25">
                  <Link href="/leads">
                    Proceed <ArrowRight className="w-4 h-4 ml-1.5" />
                  </Link>
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </Layout>
  );
}
