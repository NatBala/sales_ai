import { useState } from "react";
import { Layout } from "@/components/layout";
import { useMeetings } from "@/hooks/use-meetings";
import { useAgentCoachMe } from "@/hooks/use-agents";
import type { Meeting } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  BrainCircuit,
  Calendar as CalendarIcon,
  Users,
  Lightbulb,
  MessageCircle,
  Mic2,
  Trophy,
  ArrowRight,
  Activity,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";

export default function CoachMe() {
  const { data: meetingsData, isLoading: meetingsLoading } = useMeetings();
  const { mutate: generateCoach, isPending, data: coachData } = useAgentCoachMe();
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [focusArea, setFocusArea] = useState("");
  const [expandedObjection, setExpandedObjection] = useState<number | null>(null);

  const meetings = meetingsData?.meetings?.filter(m => m.status === "scheduled") || [];
  const selectedMeeting = meetings.find(m => m.id === selectedMeetingId);

  const handleGenerate = (meeting: Meeting) => {
    setSelectedMeetingId(meeting.id);
    setExpandedObjection(null);
    generateCoach({
      data: {
        meetingId: meeting.id,
        leadName: meeting.leadName,
        leadCompany: meeting.leadCompany,
        meetingPurpose: meeting.purpose,
        focusArea: focusArea || undefined,
      },
    });
  };

  return (
    <Layout>
      <div className="space-y-8 max-w-6xl mx-auto pb-12">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-violet-400/10 border border-violet-400/20 flex items-center justify-center">
            <BrainCircuit className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-white">Coach Me</h1>
            <p className="text-muted-foreground">Sharpen your pitch and master objections before the call.</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-[340px_1fr] gap-8 items-start">

          {/* Meeting Selection + Focus */}
          <div className="space-y-4">
            <Card className="bg-card/40 border-white/5 sticky top-24">
              <CardHeader>
                <CardTitle className="text-lg text-white">Upcoming Calls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {meetingsLoading ? (
                  <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                ) : meetings.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-8">No scheduled meetings. Schedule one first.</div>
                ) : (
                  meetings.map(meeting => (
                    <button
                      key={meeting.id}
                      onClick={() => handleGenerate(meeting)}
                      className={`w-full text-left p-4 rounded-xl border transition-all ${
                        selectedMeetingId === meeting.id
                          ? "bg-violet-500/10 border-violet-500/30 shadow-[0_0_15px_rgba(139,92,246,0.15)]"
                          : "bg-background/50 border-white/5 hover:border-white/15 hover:bg-secondary/50"
                      }`}
                    >
                      <div className="font-semibold text-white mb-1">{meeting.leadName}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-1.5 mb-2">
                        <Users className="w-3.5 h-3.5" /> {meeting.leadCompany}
                      </div>
                      <div className="text-xs font-medium text-violet-400 bg-violet-400/10 inline-flex items-center px-2 py-1 rounded-md">
                        <CalendarIcon className="w-3 h-3 mr-1.5" />
                        {format(new Date(meeting.scheduledAt), "MMM d, h:mm a")}
                      </div>
                    </button>
                  ))
                )}

                {meetings.length > 0 && (
                  <div className="pt-2 border-t border-white/5 space-y-2">
                    <label className="text-sm text-muted-foreground">Focus Area (optional)</label>
                    <Input
                      value={focusArea}
                      onChange={e => setFocusArea(e.target.value)}
                      placeholder="e.g. Overcoming fee objections..."
                      className="bg-background/50 border-white/10 text-white text-sm"
                    />
                    <p className="text-xs text-muted-foreground">Select a meeting above to generate your coaching plan.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Coaching Content */}
          <div className="min-h-[500px]">
            {isPending ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-card/20 rounded-3xl border border-white/5 border-dashed">
                <BrainCircuit className="w-12 h-12 text-violet-400 animate-pulse mb-6" />
                <h3 className="text-xl font-semibold text-white mb-2">Building Your Game Plan...</h3>
                <p className="text-muted-foreground max-w-sm">Analyzing the client profile and crafting your personalized coaching playbook.</p>
              </div>
            ) : !coachData ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-card/20 rounded-3xl border border-white/5 border-dashed">
                <BrainCircuit className="w-16 h-16 text-muted-foreground/20 mb-4" />
                <p className="text-muted-foreground text-lg">Select a meeting to generate your coaching plan.</p>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  {/* Header bar */}
                  <div className="flex items-center justify-between bg-card/40 border border-white/5 p-6 rounded-2xl">
                    <div>
                      <h2 className="text-2xl font-bold text-white mb-1">Coaching Plan: {selectedMeeting?.leadName}</h2>
                      <p className="text-muted-foreground">{selectedMeeting?.purpose} — {selectedMeeting?.leadCompany}</p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                      <Trophy className="w-6 h-6 text-violet-400" />
                    </div>
                  </div>

                  {/* Win Themes */}
                  <Card className="bg-card/40 border-white/5">
                    <CardHeader className="border-b border-white/5 bg-background/30 pb-4">
                      <CardTitle className="text-lg flex items-center gap-2 text-white">
                        <Trophy className="w-5 h-5 text-violet-400" /> Win Themes
                        <span className="text-xs font-normal text-muted-foreground ml-1">— Core value propositions to drive home</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-5">
                      <div className="grid sm:grid-cols-2 gap-3">
                        {(coachData.winThemes as string[]).map((theme, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.08 }}
                            className="bg-violet-500/5 border border-violet-500/15 rounded-xl p-4 text-white/85 text-sm leading-relaxed"
                          >
                            <span className="font-bold text-violet-400 mr-2">{i + 1}.</span>
                            {theme}
                          </motion.div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Opening Pitches */}
                  <Card className="bg-card/40 border-white/5">
                    <CardHeader className="border-b border-white/5 bg-background/30 pb-4">
                      <CardTitle className="text-lg flex items-center gap-2 text-white">
                        <Mic2 className="w-5 h-5 text-blue-400" /> Opening Pitches
                        <span className="text-xs font-normal text-muted-foreground ml-1">— 3 variations for the first 60 seconds</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-5 space-y-4">
                      {(coachData.openingPitches as string[]).map((pitch, i) => {
                        const labels = ["Confident", "Consultative", "Value-First"];
                        const colors = ["text-blue-400 bg-blue-400/10 border-blue-400/20", "text-sky-400 bg-sky-400/10 border-sky-400/20", "text-cyan-400 bg-cyan-400/10 border-cyan-400/20"];
                        return (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="bg-background/50 border border-white/5 rounded-xl p-4 space-y-2"
                          >
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${colors[i] || "text-white"}`}>
                              {labels[i] || `Version ${i + 1}`}
                            </span>
                            <p className="text-white/80 text-sm leading-relaxed pt-1">{pitch}</p>
                          </motion.div>
                        );
                      })}
                    </CardContent>
                  </Card>

                  {/* Coaching Tips */}
                  <Card className="bg-card/40 border-white/5">
                    <CardHeader className="border-b border-white/5 bg-background/30 pb-4">
                      <CardTitle className="text-lg flex items-center gap-2 text-white">
                        <Lightbulb className="w-5 h-5 text-amber-400" /> Strategic Coaching Tips
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-5">
                      <ul className="space-y-3">
                        {(coachData.coachingTips as string[]).map((tip, i) => (
                          <motion.li
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.08 }}
                            className="flex gap-3 text-white/80"
                          >
                            <span className="shrink-0 w-6 h-6 rounded-full bg-amber-400/10 text-amber-400 flex items-center justify-center text-xs font-bold mt-0.5">
                              {i + 1}
                            </span>
                            <span className="leading-relaxed">{tip}</span>
                          </motion.li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  {/* Objection Handling */}
                  <Card className="bg-card/40 border-white/5 border-l-4 border-l-violet-500">
                    <CardHeader className="border-b border-white/5 bg-background/30 pb-4">
                      <CardTitle className="text-lg flex items-center gap-2 text-white">
                        <MessageCircle className="w-5 h-5 text-violet-400" /> Objection Handling
                        <span className="text-xs font-normal text-muted-foreground ml-1">— Tap each to reveal the ideal response</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-5 space-y-3">
                      {(coachData.objections as { objection: string; suggestedResponse: string }[]).map((obj, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.08 }}
                          className="rounded-xl border border-white/8 overflow-hidden"
                        >
                          <button
                            onClick={() => setExpandedObjection(expandedObjection === i ? null : i)}
                            className="w-full flex items-center justify-between p-4 bg-background/40 hover:bg-background/60 transition-colors text-left"
                          >
                            <div className="flex items-start gap-3">
                              <span className="shrink-0 text-violet-400 font-bold text-sm mt-0.5">Q{i + 1}</span>
                              <span className="text-white/90 font-medium text-sm leading-relaxed">&ldquo;{obj.objection}&rdquo;</span>
                            </div>
                            {expandedObjection === i ? (
                              <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0 ml-3" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 ml-3" />
                            )}
                          </button>
                          <AnimatePresence>
                            {expandedObjection === i && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className="p-4 pt-3 bg-violet-500/5 border-t border-violet-500/10">
                                  <p className="text-xs font-semibold text-violet-400 uppercase tracking-wider mb-2">Suggested Response</p>
                                  <p className="text-white/80 text-sm leading-relaxed">{obj.suggestedResponse}</p>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Next Step CTA */}
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="flex items-center justify-between gap-4 bg-rose-500/5 border border-rose-500/25 rounded-2xl p-5"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-rose-400/10 border border-rose-400/20 flex items-center justify-center shrink-0">
                        <Activity className="w-5 h-5 text-rose-400" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Next Step</p>
                        <p className="text-sm font-semibold text-white">Engage Me — Real-time meeting intelligence</p>
                      </div>
                    </div>
                    <Button asChild className="shrink-0 bg-rose-500 hover:bg-rose-400 text-white shadow-lg shadow-rose-500/20">
                      <Link href="/engage-me">
                        Enter Meeting <ArrowRight className="w-4 h-4 ml-1.5" />
                      </Link>
                    </Button>
                  </motion.div>

                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
