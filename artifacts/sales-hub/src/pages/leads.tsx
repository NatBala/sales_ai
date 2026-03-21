import { Layout } from "@/components/layout";
import { useLeads } from "@/hooks/use-leads";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Users, Building2, ExternalLink } from "lucide-react";
import { Link } from "wouter";

export default function LeadsList() {
  const { data, isLoading } = useLeads();

  return (
    <Layout>
      <div className="space-y-8 max-w-6xl mx-auto pb-12">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold text-white">My Pipeline</h1>
              <p className="text-muted-foreground">Saved leads ready for outreach.</p>
            </div>
          </div>
          <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <Link href="/lead-me">Find More Leads</Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : !data?.leads || data.leads.length === 0 ? (
          <Card className="bg-card/40 border-white/5 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-24 text-center">
              <Users className="w-16 h-16 text-muted-foreground/30 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Your pipeline is empty</h3>
              <p className="text-muted-foreground max-w-md mb-6">Use the Lead Me agent to discover highly targeted prospects and add them to your pipeline.</p>
              <Button asChild>
                <Link href="/lead-me">Launch Lead Me</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.leads.map((lead) => (
              <Card key={lead.id} className="bg-card/60 backdrop-blur-sm border-white/5 hover:border-primary/30 transition-all hover:-translate-y-1 group">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-lg text-white group-hover:text-primary transition-colors">{lead.name}</h3>
                      <p className="text-sm text-muted-foreground">{lead.title}</p>
                    </div>
                    <div className="bg-primary/10 text-primary px-2.5 py-1 rounded text-xs font-bold border border-primary/20">
                      {lead.score}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
                    <Building2 className="w-4 h-4" />
                    <span>{lead.company}</span>
                  </div>
                  <Button asChild variant="secondary" className="w-full bg-secondary/50 hover:bg-secondary">
                    <Link href={`/leads/${lead.id}`}>
                      View Profile <ExternalLink className="w-4 h-4 ml-2 opacity-50" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
