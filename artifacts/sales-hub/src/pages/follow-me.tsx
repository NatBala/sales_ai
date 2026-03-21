import { useState } from "react";
import React from "react";
import { Layout } from "@/components/layout";
import { useMeetings } from "@/hooks/use-meetings";
import { useAgentFollowMe } from "@/hooks/use-agents";
import { useMeetingTasks, useCreateTask, useCompleteTask } from "@/hooks/use-tasks";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckSquare, ListTodo, Plus, CheckCircle2, Circle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

export default function FollowMe() {
  const { data: meetingsData } = useMeetings();
  const { mutate: generateFollowUp, isPending: isGenerating, data: aiData } = useAgentFollowMe();
  const { toast } = useToast();
  
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const meetings = meetingsData?.meetings || [];
  const selectedMeeting = meetings.find(m => m.id === selectedMeetingId);

  // Queries/Mutations for tasks
  const { data: tasksData, isLoading: tasksLoading } = useMeetingTasks(selectedMeetingId || "");
  const { mutate: createTask, isPending: isCreatingTask } = useCreateTask(selectedMeetingId || "");
  const { mutate: completeTask } = useCompleteTask(selectedMeetingId || "");

  const handleGenerate = () => {
    if (!selectedMeeting || !notes.trim()) return;
    generateFollowUp({
      data: {
        meetingId: selectedMeeting.id,
        leadName: selectedMeeting.leadName,
        leadCompany: selectedMeeting.leadCompany,
        meetingNotes: notes
      }
    });
  };

  const handleSaveAITasks = () => {
    if (!aiData?.tasks || !selectedMeetingId) return;
    
    // In a real app we might batch this, but for now we'll do sequentially or just alert
    // to simulate saving all the generated tasks to the DB.
    aiData.tasks.forEach(desc => {
      createTask({ id: selectedMeetingId, data: { description: desc } });
    });
    
    toast({ title: "Tasks Synced", description: "AI tasks added to tracker." });
  };

  const handleToggleTask = (taskId: string, isCompleted: boolean) => {
    if (isCompleted) return; // Only allowing mark as complete in this demo
    completeTask({ id: taskId });
  };

  return (
    <Layout>
      <div className="space-y-8 max-w-6xl mx-auto pb-12">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center">
            <CheckSquare className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-white">Follow Me</h1>
            <p className="text-muted-foreground">Turn raw notes into structured action items.</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-[300px_1fr] gap-8 items-start">
          
          {/* Meeting Selection */}
          <Card className="bg-card/40 border-white/5 sticky top-24">
            <CardHeader className="pb-3 border-b border-white/5">
              <CardTitle className="text-lg text-white">Recent Meetings</CardTitle>
            </CardHeader>
            <div className="p-2 space-y-1 max-h-[600px] overflow-y-auto">
              {meetings.map(m => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMeetingId(m.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    selectedMeetingId === m.id 
                      ? 'bg-amber-500/10 border-amber-500/30' 
                      : 'bg-transparent border-transparent hover:bg-white/5'
                  }`}
                >
                  <div className={`font-medium ${selectedMeetingId === m.id ? 'text-amber-400' : 'text-white'}`}>{m.leadName}</div>
                  <div className="text-xs text-muted-foreground truncate">{m.purpose}</div>
                </button>
              ))}
            </div>
          </Card>

          {/* Main Area */}
          {!selectedMeeting ? (
            <div className="h-[400px] flex flex-col items-center justify-center text-center p-12 bg-card/20 rounded-3xl border border-white/5 border-dashed">
              <ListTodo className="w-16 h-16 text-muted-foreground/20 mb-4" />
              <p className="text-muted-foreground text-lg">Select a meeting to process notes and manage tasks.</p>
            </div>
          ) : (
            <div className="space-y-6 min-w-0">
              
              {/* Notes Input Area */}
              <Card className="bg-card/40 border-white/5">
                <CardHeader>
                  <CardTitle className="text-lg text-white">Raw Meeting Notes</CardTitle>
                  <CardDescription>Paste your scratchpad notes here. AI will extract action items and summarize.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea 
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="E.g., Client loved the dashboard but needs custom SSO. John will check with eng. Send pricing by Friday..."
                    className="min-h-[150px] bg-background/50 border-white/10 text-white resize-y"
                  />
                  <Button 
                    onClick={handleGenerate}
                    disabled={isGenerating || !notes.trim()}
                    className="bg-amber-500 hover:bg-amber-600 text-white font-semibold shadow-lg shadow-amber-500/20"
                  >
                    {isGenerating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <SparklesIcon className="w-4 h-4 mr-2" />}
                    Extract Action Items
                  </Button>
                </CardContent>
              </Card>

              {/* AI Output Area */}
              <AnimatePresence>
                {aiData && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-6">
                    <Card className="bg-amber-500/5 border-amber-500/20">
                      <CardHeader className="pb-3 border-b border-amber-500/10">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg text-amber-400 flex items-center gap-2">
                            <SparklesIcon className="w-5 h-5" /> Extracted Actions
                          </CardTitle>
                          <Button size="sm" onClick={handleSaveAITasks} variant="outline" className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
                            Sync to Tracker
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-4">
                        <ul className="space-y-3">
                          {aiData.tasks.map((task, i) => (
                            <li key={i} className="flex gap-3 text-white/90">
                              <Plus className="w-5 h-5 text-amber-500/50 shrink-0" />
                              <span>{task}</span>
                            </li>
                          ))}
                        </ul>
                        <div className="mt-6 pt-4 border-t border-amber-500/10">
                          <h4 className="text-sm font-semibold text-amber-500 uppercase tracking-wider mb-2">Executive Summary</h4>
                          <p className="text-sm text-white/70 leading-relaxed">{aiData.summary}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Official Task Tracker */}
              <Card className="glass-panel border-white/10">
                <CardHeader className="border-b border-white/5 bg-background/30">
                  <CardTitle className="text-lg text-white">Official Task Tracker</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 p-0">
                  {tasksLoading ? (
                    <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary"/></div>
                  ) : !tasksData?.tasks || tasksData.tasks.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-sm">No tracking tasks yet. Sync AI tasks or create manually.</div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {tasksData.tasks.map(task => (
                        <div key={task.id} className="flex items-start gap-4 p-4 hover:bg-white/[0.02] transition-colors">
                          <button 
                            onClick={() => handleToggleTask(task.id, task.completed)}
                            className="mt-0.5 shrink-0 transition-colors"
                          >
                            {task.completed ? (
                              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                            ) : (
                              <Circle className="w-6 h-6 text-muted-foreground hover:text-white" />
                            )}
                          </button>
                          <div className={`flex-1 text-[15px] ${task.completed ? 'text-muted-foreground line-through' : 'text-white'}`}>
                            {task.description}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

function SparklesIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
      <path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>
    </svg>
  );
}
