import { Layout } from "@/components/layout";
import { useLead } from "@/hooks/use-leads";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Calendar, FileText, ArrowLeft, Building2, Briefcase, Mail, Phone, MapPin, Target, DollarSign, BarChart3, BrainCircuit } from "lucide-react";

export default function LeadProfile() {
  const { id } = useParams();
  const { data: lead, isLoading } = useLead(id!);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!lead) return <Layout><div className="text-center py-12 text-white">Lead not found.</div></Layout>;

  return (
    <Layout>
      <div className="space-y-6 max-w-5xl mx-auto pb-12">
        
        {/* Top Navigation */}
        <Link href="/leads" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-white mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Pipeline
        </Link>

        {/* Header Profile Card */}
        <Card className="glass-panel overflow-hidden border-t-4 border-t-primary">
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row gap-8 justify-between">
              
              <div className="space-y-4 flex-1">
                <div>
                  <h1 className="text-4xl font-display font-bold text-white mb-2">{lead.name}</h1>
                  <div className="flex flex-wrap gap-4 text-base text-muted-foreground font-medium">
                    <span className="flex items-center gap-1.5"><Briefcase className="w-5 h-5 text-primary/70"/> {lead.title}</span>
                    <span className="flex items-center gap-1.5"><Building2 className="w-5 h-5 text-primary/70"/> {lead.company}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-x-6 gap-y-3 pt-4 border-t border-white/5">
                  {lead.email && <span className="flex items-center gap-2 text-sm text-white/80"><Mail className="w-4 h-4 text-muted-foreground"/> {lead.email}</span>}
                  {lead.phone && <span className="flex items-center gap-2 text-sm text-white/80"><Phone className="w-4 h-4 text-muted-foreground"/> {lead.phone}</span>}
                  {lead.location && <span className="flex items-center gap-2 text-sm text-white/80"><MapPin className="w-4 h-4 text-muted-foreground"/> {lead.location}</span>}
                </div>
              </div>

              <div className="flex flex-col gap-3 min-w-[200px] shrink-0 bg-background/50 p-6 rounded-2xl border border-white/5">
                <div className="text-center mb-2">
                  <span className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">AI Fit Score</span>
                  <div className="text-5xl font-display font-bold text-primary mt-1">{lead.score}</div>
                </div>
                <Button asChild className="w-full bg-teal-500 hover:bg-teal-600 text-white shadow-lg shadow-teal-500/25">
                  <Link href={`/schedule-me/${lead.id}`}>
                    <Calendar className="w-4 h-4 mr-2" /> Schedule Call
                  </Link>
                </Button>
              </div>

            </div>
          </CardContent>
        </Card>

        {/* Deep Dive Tabs */}
        <Tabs defaultValue="reasoning" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-card/50 border border-white/5 h-14 p-1">
            <TabsTrigger value="reasoning" className="text-base data-[state=active]:bg-primary/20 data-[state=active]:text-primary rounded-lg">
              <BrainCircuit className="w-4 h-4 mr-2" /> AI Reasoning
            </TabsTrigger>
            <TabsTrigger value="assets" className="text-base data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400 rounded-lg">
              <DollarSign className="w-4 h-4 mr-2" /> Financial Profile
            </TabsTrigger>
            <TabsTrigger value="sales" className="text-base data-[state=active]:bg-indigo-500/20 data-[state=active]:text-indigo-400 rounded-lg">
              <BarChart3 className="w-4 h-4 mr-2" /> Sales History
            </TabsTrigger>
          </TabsList>
          
          <div className="mt-6">
            <TabsContent value="reasoning" className="m-0">
              <Card className="bg-card/40 border-white/5">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2 text-white">
                    <Target className="w-5 h-5 text-primary" /> Why this is a match
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-invert max-w-none text-white/80 leading-relaxed">
                    <p className="text-lg mb-6">{lead.reason}</p>
                    <div className="bg-background/50 p-6 rounded-xl border border-white/5">
                      <h4 className="text-sm font-semibold text-primary uppercase tracking-wider mb-2">Deep Analysis</h4>
                      <p>{lead.reasoning}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="assets" className="m-0">
              <Card className="bg-card/40 border-white/5">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2 text-white">
                    <DollarSign className="w-5 h-5 text-blue-400" /> Assets & Financials
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-background/50 p-6 rounded-xl border border-white/5 text-white/80 leading-relaxed whitespace-pre-wrap">
                    {lead.assets || "No specific asset data available."}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sales" className="m-0">
              <Card className="bg-card/40 border-white/5">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2 text-white">
                    <BarChart3 className="w-5 h-5 text-indigo-400" /> Sales Intelligence
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-background/50 p-6 rounded-xl border border-white/5 text-white/80 leading-relaxed whitespace-pre-wrap">
                    {lead.sales || "No prior sales history logged."}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>

      </div>
    </Layout>
  );
}
