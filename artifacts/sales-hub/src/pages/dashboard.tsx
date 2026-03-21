import { Layout } from "@/components/layout";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Search, Calendar, FileText, Activity, CheckSquare, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const agents = [
  {
    id: "lead-me",
    title: "Lead Me",
    desc: "Generate hyper-targeted leads using natural language queries and financial data.",
    icon: Search,
    color: "text-blue-400",
    bg: "bg-blue-400/10",
    border: "border-blue-400/20",
    path: "/lead-me"
  },
  {
    id: "schedule-me",
    title: "Schedule Me",
    desc: "Craft highly personalized outreach emails and seamlessly book meetings.",
    icon: Calendar,
    color: "text-teal-400",
    bg: "bg-teal-400/10",
    border: "border-teal-400/20",
    path: "/leads" // Goes to leads to select one to schedule
  },
  {
    id: "prep-me",
    title: "Prep Me",
    desc: "Synthesize client background, agendas, and talking points before the call.",
    icon: FileText,
    color: "text-indigo-400",
    bg: "bg-indigo-400/10",
    border: "border-indigo-400/20",
    path: "/prep-me"
  },
  {
    id: "engage-me",
    title: "Engage Me",
    desc: "Real-time conversation intelligence, objection handling, and quick facts.",
    icon: Activity,
    color: "text-rose-400",
    bg: "bg-rose-400/10",
    border: "border-rose-400/20",
    path: "/engage-me"
  },
  {
    id: "follow-me",
    title: "Follow Me",
    desc: "Automate post-meeting summaries and generate actionable task lists.",
    icon: CheckSquare,
    color: "text-amber-400",
    bg: "bg-amber-400/10",
    border: "border-amber-400/20",
    path: "/follow-me"
  }
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
};

export default function Dashboard() {
  return (
    <Layout>
      <div className="space-y-8">
        
        {/* Hero Section */}
        <div className="relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-accent/10 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
          
          <div className="relative z-10 p-8 md:p-12 lg:p-16">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-4">
                Welcome to <span className="text-gradient-primary">Command Center</span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl">
                Your five specialized AI agents are standing by. Where would you like to start your workflow today?
              </p>
            </motion.div>
          </div>
        </div>

        {/* Agents Grid */}
        <div>
          <h2 className="text-2xl font-display font-semibold text-white mb-6 pl-2">Agent Pipeline</h2>
          
          <motion.div 
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {agents.map((agent) => (
              <motion.div key={agent.id} variants={item}>
                <Card className={`h-full bg-card/50 backdrop-blur-sm border-white/5 hover:border-white/15 transition-all duration-300 group hover:-translate-y-1 hover:shadow-xl`}>
                  <CardHeader>
                    <div className={`w-14 h-14 rounded-2xl ${agent.bg} ${agent.border} border flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                      <agent.icon className={`w-7 h-7 ${agent.color}`} />
                    </div>
                    <CardTitle className="text-xl text-white">{agent.title}</CardTitle>
                    <CardDescription className="text-sm mt-2 leading-relaxed">
                      {agent.desc}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4 mt-auto">
                    <Button asChild variant="secondary" className="w-full bg-secondary/50 hover:bg-secondary text-white group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                      <Link href={agent.path}>
                        Launch Agent <ArrowRight className="w-4 h-4 ml-2" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>

      </div>
    </Layout>
  );
}
