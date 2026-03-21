import { useState } from "react";
import { Layout } from "@/components/layout";
import { useAgentLeadMe } from "@/hooks/use-agents";
import { useCreateLead } from "@/hooks/use-leads";
import type { GeneratedLead } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Target, Building2, Briefcase, TrendingUp, Save, Check, ArrowRight, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";

export default function LeadMe() {
  const [query, setQuery] = useState("");
  const { mutate: generateLeads, isPending: isGenerating, data } = useAgentLeadMe();
  const { mutate: saveLead, isPending: isSaving } = useCreateLead();
  const { toast } = useToast();
  const [savedIndices, setSavedIndices] = useState<number[]>([]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSavedIndices([]);
    generateLeads({ data: { query } });
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
            <form onSubmit={handleSearch} className="flex relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                <Target className="w-6 h-6" />
              </div>
              <Input 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. Find me VP of Sales at Series B tech startups in New York with recent funding..."
                className="w-full pl-14 pr-32 h-16 text-lg bg-transparent border-0 focus-visible:ring-0 text-white placeholder:text-muted-foreground/60"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <Button 
                  type="submit" 
                  disabled={isGenerating || !query.trim()}
                  className="h-12 px-6 rounded-xl font-semibold shadow-lg shadow-primary/25"
                >
                  {isGenerating ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Search className="w-5 h-5 mr-2" />}
                  Generate
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

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
                                <h4 className="text-xl font-bold text-white flex items-center gap-2">
                                  {lead.name}
                                </h4>
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
                                className={`w-full md:w-32 h-12 ${isSaved ? 'opacity-100 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 hover:text-emerald-400' : ''}`}
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
