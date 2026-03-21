import { useAuth } from "@workspace/replit-auth-web";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Activity, Search, Calendar, FileText, CheckSquare, ArrowRight } from "lucide-react";

export default function Login() {
  const { isAuthenticated, login, isLoading } = useAuth();

  if (isLoading) return null;
  if (isAuthenticated) return <Redirect to="/" />;

  const agents = [
    { icon: Search, title: "Lead Me", desc: "AI Lead Gen" },
    { icon: Calendar, title: "Schedule Me", desc: "Smart Outreach" },
    { icon: FileText, title: "Prep Me", desc: "Meeting Briefs" },
    { icon: Activity, title: "Engage Me", desc: "Live Intel" },
    { icon: CheckSquare, title: "Follow Me", desc: "Automated Tasks" },
  ];

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-background">
      {/* Dynamic Background */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/60 to-background/20" />

      <div className="relative z-10 w-full max-w-6xl px-6 grid lg:grid-cols-2 gap-16 items-center">
        
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="space-y-8"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium">
            <Activity className="w-4 h-4" />
            <span>Sales Hub OS v2.0</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-display font-bold leading-tight text-white">
            Your entire sales team, <br/>
            <span className="text-gradient-primary">synthesized.</span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground max-w-xl leading-relaxed">
            One platform that manages your entire pipeline. Generate leads, automate outreach, prep for meetings, and extract real-time intelligence with five specialized AI agents.
          </p>

          <Button 
            onClick={login} 
            size="lg"
            className="h-14 px-8 text-base font-semibold rounded-full shadow-[0_0_30px_rgba(13,148,136,0.3)] hover:shadow-[0_0_40px_rgba(13,148,136,0.5)] transition-all group"
          >
            Enter Workspace
            <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Button>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="relative hidden lg:block"
        >
          <div className="glass-panel p-8 rounded-3xl relative">
            <h3 className="text-xl font-display font-semibold mb-8 text-white">Agent Pipeline</h3>
            
            <div className="space-y-4 relative before:absolute before:inset-y-0 before:left-[1.35rem] before:w-[2px] before:bg-white/10 before:-z-10">
              {agents.map((agent, i) => (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + (i * 0.1) }}
                  key={agent.title} 
                  className="flex items-center gap-4 bg-secondary/50 backdrop-blur-sm border border-white/5 p-4 rounded-2xl hover:bg-secondary transition-colors"
                >
                  <div className="w-11 h-11 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                    <agent.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="text-white font-medium">{agent.title}</h4>
                    <p className="text-sm text-muted-foreground">{agent.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
