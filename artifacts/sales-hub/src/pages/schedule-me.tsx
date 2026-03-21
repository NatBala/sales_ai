import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useParams, useLocation } from "wouter";
import { useLead } from "@/hooks/use-leads";
import { useAgentScheduleMe } from "@/hooks/use-agents";
import { useCreateMeeting } from "@/hooks/use-meetings";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Calendar, Mail, Send, User, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function ScheduleMe() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { data: lead, isLoading: leadLoading } = useLead(id!);
  const { mutate: generateEmail, isPending: isGenerating, data: generated } = useAgentScheduleMe();
  const { mutate: createMeeting, isPending: isCreating } = useCreateMeeting();
  const { toast } = useToast();

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [context, setContext] = useState("");
  const [hasGenerated, setHasGenerated] = useState(false);

  useEffect(() => {
    if (generated && !hasGenerated) {
      setSubject(generated.subject);
      setBody(generated.body);
      if (generated.scheduledTime) {
        try {
          const d = new Date(generated.scheduledTime);
          setDate(format(d, "yyyy-MM-dd"));
          setTime(format(d, "HH:mm"));
        } catch(e) {}
      }
      setHasGenerated(true);
    }
  }, [generated, hasGenerated]);

  const handleGenerate = () => {
    if (!lead) return;
    setHasGenerated(false);
    generateEmail({
      data: {
        leadId: lead.id,
        leadName: lead.name,
        leadCompany: lead.company,
        leadTitle: lead.title,
        context: context || undefined
      }
    });
  };

  const handleSchedule = () => {
    if (!lead || !date || !time) {
      toast({ title: "Error", description: "Please select a date and time.", variant: "destructive" });
      return;
    }
    
    const scheduledAt = new Date(`${date}T${time}`).toISOString();
    
    createMeeting({
      data: {
        leadId: lead.id,
        leadName: lead.name,
        leadCompany: lead.company,
        scheduledAt,
        purpose: "Initial Outreach Call",
        emailSubject: subject,
        emailBody: body
      }
    }, {
      onSuccess: () => {
        toast({ title: "Meeting Scheduled!", description: "The outreach email has been queued." });
        setLocation("/prep-me");
      }
    });
  };

  if (leadLoading) {
    return <Layout><div className="flex justify-center p-24"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></Layout>;
  }

  if (!lead) {
    return <Layout><div className="text-center p-24 text-white">Lead not found. Please select a lead first.</div></Layout>;
  }

  return (
    <Layout>
      <div className="space-y-8 max-w-5xl mx-auto pb-12">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-teal-400/10 border border-teal-400/20 flex items-center justify-center">
            <Calendar className="w-6 h-6 text-teal-400" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-white">Schedule Me</h1>
            <p className="text-muted-foreground">Draft outreach and schedule a meeting with {lead.name}.</p>
          </div>
        </div>

        <div className="grid md:grid-cols-[1fr_350px] gap-8">
          {/* Main Email Area */}
          <div className="space-y-6">
            <Card className="bg-card/40 border-white/5">
              <CardHeader className="border-b border-white/5 pb-4">
                <CardTitle className="text-lg flex items-center gap-2 text-white">
                  <Sparkles className="w-5 h-5 text-primary" /> AI Draft Generation
                </CardTitle>
                <CardDescription>Add specific context to guide the AI's email generation.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="flex gap-4">
                  <Input 
                    placeholder="e.g. Mention their recent Series B, suggest next Tuesday..." 
                    value={context}
                    onChange={e => setContext(e.target.value)}
                    className="bg-background border-white/10 text-white"
                  />
                  <Button 
                    onClick={handleGenerate} 
                    disabled={isGenerating}
                    className="shrink-0"
                  >
                    {isGenerating ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Sparkles className="w-4 h-4 mr-2"/>}
                    Generate Draft
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-panel border-white/10 shadow-2xl">
              <CardHeader className="bg-background/50 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-muted-foreground">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">To: {lead.name} &lt;{lead.email || 'unknown@email.com'}&gt;</div>
                    <div className="text-xs text-muted-foreground">{lead.title} at {lead.company}</div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Subject</label>
                  <Input 
                    value={subject} 
                    onChange={e => setSubject(e.target.value)}
                    placeholder="Email subject..."
                    className="text-lg font-medium border-0 border-b border-white/10 rounded-none px-0 focus-visible:ring-0 bg-transparent text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Message Body</label>
                  <Textarea 
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    placeholder="Email body will appear here..."
                    className="min-h-[300px] resize-none bg-transparent border-0 px-0 focus-visible:ring-0 text-white/90 text-base leading-relaxed"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar Scheduling */}
          <div className="space-y-6">
            <Card className="bg-card/40 border-white/5 sticky top-24">
              <CardHeader>
                <CardTitle className="text-lg text-white">Meeting Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">Date</label>
                    <Input 
                      type="date" 
                      value={date} 
                      onChange={e => setDate(e.target.value)}
                      className="bg-background/50 border-white/10 text-white [color-scheme:dark]" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">Time</label>
                    <Input 
                      type="time" 
                      value={time} 
                      onChange={e => setTime(e.target.value)}
                      className="bg-background/50 border-white/10 text-white [color-scheme:dark]" 
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5">
                  <Button 
                    onClick={handleSchedule}
                    disabled={isCreating || !subject || !body}
                    className="w-full h-12 text-base font-semibold shadow-lg shadow-primary/20"
                  >
                    {isCreating ? <Loader2 className="w-5 h-5 animate-spin mr-2"/> : <Send className="w-5 h-5 mr-2"/>}
                    Send & Schedule
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

        </div>
      </div>
    </Layout>
  );
}
