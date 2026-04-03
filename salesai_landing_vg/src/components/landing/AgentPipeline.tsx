import { motion } from "framer-motion";
import { Search, Calendar, FileText, Mic, Activity, CheckCircle } from "lucide-react";

const agents = [
  { id: "01", name: "Lead Me", desc: "Discover & score high-value advisors", icon: Search },
  { id: "02", name: "Schedule Me", desc: "AI voice & email outreach", icon: Calendar },
  { id: "03", name: "Prep Me", desc: "Comprehensive meeting briefings", icon: FileText },
  { id: "04", name: "Coach Me", desc: "Live roleplay & Capital Way scoring", icon: Mic },
  { id: "05", name: "Engage Me", desc: "Real-time ETF data detection", icon: Activity },
  { id: "06", name: "Follow Me", desc: "Auto-tasks & customized follow-ups", icon: CheckCircle },
];

export function AgentPipeline() {
  return (
    <section id="agents" className="py-24 relative z-10 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-sm font-semibold text-primary tracking-widest uppercase mb-3">The Pipeline</h2>
          <h3 className="text-3xl md:text-5xl font-bold mb-6">Six specialized agents.<br/>One seamless workflow.</h3>
          <p className="text-muted-foreground text-lg">Designed sequentially to guide you through the entire sales cycle, from first contact to closed loop.</p>
        </div>

        <div className="relative">
          {/* Connecting Line (Desktop) */}
          <div className="hidden lg:block absolute top-[4.5rem] left-[5%] right-[5%] h-0.5 bg-gradient-to-r from-primary/0 via-primary/30 to-primary/0" />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
            {agents.map((agent, index) => (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="relative group"
              >
                <div className="glass-panel p-6 rounded-2xl h-full glass-panel-hover flex flex-col items-center text-center relative z-10 overflow-hidden">
                  <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary/0 to-transparent group-hover:via-primary/50 transition-all duration-500" />

                  <div className="w-16 h-16 rounded-full bg-background border border-white/10 flex items-center justify-center mb-6 shadow-lg group-hover:border-primary/50 group-hover:shadow-glow transition-all duration-300">
                    <agent.icon className="w-7 h-7 text-white group-hover:text-primary transition-colors" />
                  </div>

                  <span className="text-xs font-bold text-primary mb-2 tracking-wider">{agent.id}</span>
                  <h4 className="text-xl font-bold mb-2 text-white">{agent.name}</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">{agent.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
