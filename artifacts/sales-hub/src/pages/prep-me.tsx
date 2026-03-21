import { useState } from "react";
import { Layout } from "@/components/layout";
import { useMeetings } from "@/hooks/use-meetings";
import { useAgentPrepMe } from "@/hooks/use-agents";
import type { Meeting } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, Calendar as CalendarIcon, Users, ListChecks, MessageSquare, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

export default function PrepMe() {
  const { data: meetingsData, isLoading: meetingsLoading } = useMeetings();
  const { mutate: generatePrep, isPending, data: prepData } = useAgentPrepMe();
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);

  const meetings = meetingsData?.meetings?.filter(m => m.status === 'scheduled') || [];
  const selectedMeeting = meetings.find(m => m.id === selectedMeetingId);

  const handleGenerate = (meeting: Meeting) => {
    setSelectedMeetingId(meeting.id);
    generatePrep({
      data: {
        meetingId: meeting.id,
        leadName: meeting.leadName,
        leadCompany: meeting.leadCompany,
        meetingDate: meeting.scheduledAt,
        meetingPurpose: meeting.purpose
      }
    });
  };

  return (
    <Layout>
      <div className="space-y-8 max-w-6xl mx-auto pb-12">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-indigo-400/10 border border-indigo-400/20 flex items-center justify-center">
            <FileText className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-white">Prep Me</h1>
            <p className="text-muted-foreground">Generate comprehensive briefs for upcoming meetings.</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-[350px_1fr] gap-8 items-start">
          
          {/* Upcoming Meetings List */}
          <Card className="bg-card/40 border-white/5 sticky top-24">
            <CardHeader>
              <CardTitle className="text-lg text-white">Upcoming Calls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {meetingsLoading ? (
                <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : meetings.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8">No scheduled meetings found.</div>
              ) : (
                meetings.map(meeting => (
                  <button
                    key={meeting.id}
                    onClick={() => handleGenerate(meeting)}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      selectedMeetingId === meeting.id 
                        ? 'bg-indigo-500/10 border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.15)]' 
                        : 'bg-background/50 border-white/5 hover:border-white/15 hover:bg-secondary/50'
                    }`}
                  >
                    <div className="font-semibold text-white mb-1">{meeting.leadName}</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-1.5 mb-2">
                      <Users className="w-3.5 h-3.5" /> {meeting.leadCompany}
                    </div>
                    <div className="text-xs font-medium text-indigo-400 bg-indigo-400/10 inline-flex items-center px-2 py-1 rounded-md">
                      <CalendarIcon className="w-3 h-3 mr-1.5" />
                      {format(new Date(meeting.scheduledAt), "MMM d, h:mm a")}
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          {/* Prep Content Area */}
          <div className="min-h-[500px]">
            {isPending ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-card/20 rounded-3xl border border-white/5 border-dashed">
                <Loader2 className="w-12 h-12 text-indigo-400 animate-spin mb-6" />
                <h3 className="text-xl font-semibold text-white mb-2">Synthesizing Brief...</h3>
                <p className="text-muted-foreground max-w-sm">Analyzing CRM data, recent news, and financial profiles to build your battle plan.</p>
              </div>
            ) : !prepData ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-card/20 rounded-3xl border border-white/5 border-dashed">
                <FileText className="w-16 h-16 text-muted-foreground/20 mb-4" />
                <p className="text-muted-foreground text-lg">Select a meeting from the sidebar to generate a prep brief.</p>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between bg-card/40 border border-white/5 p-6 rounded-2xl">
                    <div>
                      <h2 className="text-2xl font-bold text-white mb-1">Brief: {selectedMeeting?.leadName}</h2>
                      <p className="text-muted-foreground">{selectedMeeting?.purpose}</p>
                    </div>
                    <Button variant="outline" className="border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10">
                      Export PDF
                    </Button>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Background */}
                    <Card className="bg-card/40 border-white/5 md:col-span-2">
                      <CardHeader className="border-b border-white/5 bg-background/30 pb-4">
                        <CardTitle className="text-lg flex items-center gap-2 text-white">
                          <Users className="w-5 h-5 text-indigo-400" /> Client Background
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <p className="text-white/80 leading-relaxed text-[15px]">{prepData.clientBackground}</p>
                      </CardContent>
                    </Card>

                    {/* Agenda */}
                    <Card className="bg-card/40 border-white/5">
                      <CardHeader className="border-b border-white/5 bg-background/30 pb-4">
                        <CardTitle className="text-lg flex items-center gap-2 text-white">
                          <ListChecks className="w-5 h-5 text-teal-400" /> Proposed Agenda
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <ul className="space-y-3">
                          {prepData.agenda.map((item, i) => (
                            <li key={i} className="flex gap-3 text-white/80">
                              <span className="shrink-0 w-6 h-6 rounded-full bg-teal-400/10 text-teal-400 flex items-center justify-center text-xs font-bold">{i+1}</span>
                              <span className="mt-0.5">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>

                    {/* Talking Points */}
                    <Card className="bg-card/40 border-white/5">
                      <CardHeader className="border-b border-white/5 bg-background/30 pb-4">
                        <CardTitle className="text-lg flex items-center gap-2 text-white">
                          <MessageSquare className="w-5 h-5 text-blue-400" /> Key Talking Points
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <ul className="space-y-3 list-disc pl-5">
                          {prepData.talkingPoints.map((item, i) => (
                            <li key={i} className="text-white/80 leading-relaxed pl-1 marker:text-blue-400">{item}</li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>

                    {/* Objections */}
                    <Card className="bg-card/40 border-white/5 md:col-span-2 border-l-4 border-l-rose-500">
                      <CardHeader className="border-b border-white/5 bg-background/30 pb-4">
                        <CardTitle className="text-lg flex items-center gap-2 text-white">
                          <AlertCircle className="w-5 h-5 text-rose-500" /> Anticipated Objections
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <div className="grid md:grid-cols-2 gap-4">
                          {prepData.keyObjections.map((item, i) => (
                            <div key={i} className="bg-rose-500/5 border border-rose-500/10 rounded-xl p-4 text-white/80 text-sm leading-relaxed">
                              {item}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                  </div>
                </motion.div>
              </AnimatePresence>
            )}
          </div>

        </div>
      </div>
    </Layout>
  );
}
