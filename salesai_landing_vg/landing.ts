​// === FILE: src/App.tsx ===
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/Home";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;


// === FILE: src/main.tsx ===
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);


// === FILE: src/index.css ===
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Outfit:wght@500;600;700;800&display=swap');
@import "tailwindcss";
@import "tw-animate-css";
@plugin "@tailwindcss/typography";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));
  --color-border: hsl(var(--border));
  --color-input: hsl(var(--input));
  --color-ring: hsl(var(--ring));

  --color-card: hsl(var(--card));
  --color-card-foreground: hsl(var(--card-foreground));
  --color-card-border: hsl(var(--card-border));

  --color-popover: hsl(var(--popover));
  --color-popover-foreground: hsl(var(--popover-foreground));
  --color-popover-border: hsl(var(--popover-border));

  --color-primary: hsl(var(--primary));
  --color-primary-foreground: hsl(var(--primary-foreground));
  
  --color-secondary: hsl(var(--secondary));
  --color-secondary-foreground: hsl(var(--secondary-foreground));
  
  --color-muted: hsl(var(--muted));
  --color-muted-foreground: hsl(var(--muted-foreground));
  
  --color-accent: hsl(var(--accent));
  --color-accent-foreground: hsl(var(--accent-foreground));
  
  --color-destructive: hsl(var(--destructive));
  --color-destructive-foreground: hsl(var(--destructive-foreground));

  --font-sans: 'Inter', sans-serif;
  --font-display: 'Outfit', sans-serif;

  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}

/* 
  Forcing Dark Mode as the default premium theme for the landing page.
  Deep navy and midnight blue palette. 
*/
:root {
  --background: 220 30% 7%;
  --foreground: 213 31% 91%;
  
  --card: 220 30% 11%;
  --card-foreground: 213 31% 91%;
  --card-border: 216 34% 16%;
  
  --popover: 220 30% 7%;
  --popover-foreground: 213 31% 91%;
  --popover-border: 216 34% 16%;
  
  /* Capital Group Tech Blue Primary */
  --primary: 217 91% 60%;
  --primary-foreground: 0 0% 100%;
  
  --secondary: 222.2 47.4% 11.2%;
  --secondary-foreground: 210 40% 98%;
  
  --muted: 223 47% 11%;
  --muted-foreground: 215.4 16.3% 56.9%;
  
  --accent: 216 34% 17%;
  --accent-foreground: 210 40% 98%;
  
  --destructive: 0 63% 31%;
  --destructive-foreground: 210 40% 98%;
  
  --border: 216 34% 15%;
  --input: 216 34% 17%;
  --ring: 217 91% 60%;
  
  --radius: 0.75rem;

  --shadow-glow: 0 0 40px -10px hsl(var(--primary) / 0.3);
  --shadow-glow-strong: 0 0 60px -10px hsl(var(--primary) / 0.5);
}

.dark {
  /* Inherits from root since root is already dark */
}

@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply font-sans antialiased bg-background text-foreground;
    overflow-x: hidden;
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: var(--font-display);
    @apply font-bold tracking-tight;
  }
}

@layer utilities {
  .bg-dot-grid {
    background-image: radial-gradient(rgba(255, 255, 255, 0.12) 1px, transparent 1px);
    background-size: 24px 24px;
  }

  .glass-panel {
    @apply bg-card/40 backdrop-blur-xl border border-white/5 shadow-2xl;
  }
  
  .glass-panel-hover {
    @apply hover:bg-card/60 hover:border-white/10 transition-all duration-300;
  }

  .text-gradient {
    @apply bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-100 to-primary/80;
  }
}


// === FILE: src/lib/utils.ts ===
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


// === FILE: src/pages/Home.tsx ===
import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { AgentPipeline } from "@/components/landing/AgentPipeline";
import { Features } from "@/components/landing/Features";
import { EngageSpotlight } from "@/components/landing/EngageSpotlight";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { StatsBar } from "@/components/landing/StatsBar";
import { CTA } from "@/components/landing/CTA";
import { Footer } from "@/components/landing/Footer";

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground selection:bg-primary/30 selection:text-white">
      <Navbar />
      <Hero />
      <AgentPipeline />
      <Features />
      <EngageSpotlight />
      <HowItWorks />
      <StatsBar />
      <CTA />
      <Footer />
    </main>
  );
}


// === FILE: src/pages/not-found.tsx ===
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900">404 Page Not Found</h1>
          </div>

          <p className="mt-4 text-sm text-gray-600">
            Did you forget to add the page to the router?
          </p>
        </CardContent>
      </Card>
    </div>
  );
}


// === FILE: src/components/landing/AgentPipeline.tsx ===
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


// === FILE: src/components/landing/CTA.tsx ===
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

export function CTA() {
  return (
    <section className="py-32 relative z-10 bg-background overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="glass-panel p-12 md:p-20 rounded-[2.5rem] border border-white/10 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
          
          <h2 className="text-4xl md:text-6xl font-bold text-white mb-6 tracking-tight">
            Ready to transform <br/> your sales process?
          </h2>
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            Step into the future of financial services sales. Access all six Capital Group AI agents today.
          </p>
          
          <a 
            href="/"
            className="inline-flex items-center gap-2 px-10 py-5 bg-white text-background rounded-2xl font-bold text-lg hover:scale-105 active:scale-95 hover:bg-blue-50 transition-all duration-200 shadow-[0_0_40px_rgba(255,255,255,0.2)]"
          >
            Get Started Now
            <ArrowRight className="w-5 h-5" />
          </a>
        </motion.div>
      </div>
    </section>
  );
}


// === FILE: src/components/landing/EngageSpotlight.tsx ===
import { motion } from "framer-motion";
import { Mic, Zap, BarChart2, PieChart, TrendingUp, Activity } from "lucide-react";

const etfs = [
  { ticker: "BND", name: "Total Bond Market ETF", color: "from-blue-500 to-blue-700" },
  { ticker: "VTI", name: "Total Stock Market ETF", color: "from-indigo-500 to-indigo-700" },
  { ticker: "VOO", name: "S&P 500 ETF", color: "from-violet-500 to-violet-700" },
  { ticker: "VXUS", name: "Total International ETF", color: "from-cyan-500 to-cyan-700" },
  { ticker: "VNQ", name: "Real Estate ETF", color: "from-sky-500 to-sky-700" },
];

const dataTypes = [
  { label: "Overview", icon: Activity },
  { label: "Holdings", icon: BarChart2 },
  { label: "Performance", icon: TrendingUp },
  { label: "Composition", icon: PieChart },
];

export function EngageSpotlight() {
  return (
    <section className="py-24 relative z-10 bg-background overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/3 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[140px] -translate-y-1/2" />
        <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-sm font-semibold text-primary mb-6">
              <Activity className="w-4 h-4" />
              Agent 05 — New
            </div>

            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
              Engage Me
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
                Your real-time meeting co-pilot.
              </span>
            </h2>

            <p className="text-muted-foreground text-lg leading-relaxed mb-8">
              Hold to capture during any live advisor meeting. Engage Me listens, detects when any of the five core Capital Group ETFs are mentioned, and instantly surfaces the right data panel on screen — holdings, performance, composition, or stats — exactly when you need it.
            </p>

            <div className="space-y-4 mb-10">
              {[
                {
                  icon: Mic,
                  title: "Voice-Activated Detection",
                  desc: "Hold the capture button during the conversation. Release to analyze. No typing, no searching.",
                },
                {
                  icon: Zap,
                  title: "Instant Data Panels",
                  desc: "ETF data appears in under a second — Holdings, Performance, Composition, Stats, or Overview.",
                },
                {
                  icon: BarChart2,
                  title: "5 ETFs, 5 Data Views",
                  desc: "Full coverage for BND, VTI, VOO, VXUS, and VNQ with rich visual data panels for each.",
                },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.1 + 0.3 }}
                  className="flex items-start gap-4"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                    <item.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-white mb-0.5">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            <div className="glass-panel rounded-3xl p-6 border border-white/10 shadow-2xl">
              <div className="flex items-center gap-3 mb-5 pb-4 border-b border-white/10">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <Activity className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Engage Me</p>
                  <p className="text-xs text-muted-foreground">Listening in real-time…</p>
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-xs text-green-400 font-medium">Live</span>
                </div>
              </div>

              <div className="mb-5">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">ETF Coverage</p>
                <div className="grid grid-cols-1 gap-2">
                  {etfs.map((etf, i) => (
                    <motion.div
                      key={etf.ticker}
                      initial={{ opacity: 0, scale: 0.95 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.3, delay: i * 0.07 + 0.4 }}
                      className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 border border-white/5 hover:border-primary/30 transition-colors"
                    >
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${etf.color} flex items-center justify-center shrink-0`}>
                        <span className="text-xs font-bold text-white">{etf.ticker}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{etf.ticker}</p>
                        <p className="text-xs text-muted-foreground">{etf.name}</p>
                      </div>
                      <div className="ml-auto flex gap-1">
                        {dataTypes.map((dt) => (
                          <div
                            key={dt.label}
                            className="w-6 h-6 rounded-md bg-white/5 border border-white/10 flex items-center justify-center"
                            title={dt.label}
                          >
                            <dt.icon className="w-3 h-3 text-muted-foreground" />
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-white/10">
                <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/10 border border-primary/20">
                  <Mic className="w-4 h-4 text-primary shrink-0" />
                  <p className="text-xs text-primary font-medium">
                    "Hold to Capture" — release to analyze and surface fund data
                  </p>
                </div>
              </div>
            </div>

            <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-primary/20 rounded-full blur-[60px] pointer-events-none" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}


// === FILE: src/components/landing/Features.tsx ===
import { motion } from "framer-motion";
import { MessageSquare, Phone, Zap, Target, Award, ListChecks } from "lucide-react";

const features = [
  {
    title: "Natural Language Search",
    description: "Find your ideal prospects instantly. Just type 'RIA firms over $200M with a fixed income gap' and let AI do the rest.",
    icon: SearchIcon,
  },
  {
    title: "AI Voice Calls (Maya)",
    description: "Meet Maya, your digital rep. She runs live outbound phone calls, handles objections, and books meetings directly to your calendar.",
    icon: Phone,
  },
  {
    title: "Real-Time ETF Detection",
    description: "Hold to capture during live meetings. When VTI, BND, or other core ETFs are mentioned, deep data panels appear instantly.",
    icon: Zap,
  },
  {
    title: "Live Roleplay Training",
    description: "Practice your pitch against a dynamically generated AI advisor persona that mimics real-world skepticism and firm types.",
    icon: Target,
  },
  {
    title: "Capital Way Scoring",
    description: "After every roleplay, get rigorously graded against the Capital Group Professional Engagement Framework with exact transcript feedback.",
    icon: Award,
  },
  {
    title: "Automated Follow-Up",
    description: "Dictate your post-meeting notes. The AI extracts actionable tasks, categorizes urgency, and drafts a warm, personalized email.",
    icon: ListChecks,
  },
];

// Helper for the first icon
function SearchIcon(props: any) {
  return <MessageSquare {...props} />;
}

export function Features() {
  return (
    <section id="features" className="py-24 relative z-10 bg-background overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-20">
          <div>
            <h2 className="text-sm font-semibold text-primary tracking-widest uppercase mb-3">Enterprise Capabilities</h2>
            <h3 className="text-3xl md:text-5xl font-bold mb-6">Intelligence at every<br/>touchpoint.</h3>
            <p className="text-muted-foreground text-lg">We didn't just build a CRM. We built a proactive sales partner that listens, analyzes, and helps you execute at the highest level.</p>
          </div>
          <div className="relative">
            {/* Abstract Data Image */}
            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
            <img 
              src={`${import.meta.env.BASE_URL}images/abstract-data.png`} 
              alt="Data Intelligence" 
              className="relative z-10 rounded-2xl border border-white/10 shadow-2xl object-cover h-[300px] w-full"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="glass-panel p-8 rounded-2xl glass-panel-hover"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-6">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h4 className="text-xl font-bold text-white mb-3">{feature.title}</h4>
              <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}


// === FILE: src/components/landing/Footer.tsx ===
import { Activity } from "lucide-react";

export function Footer() {
  return (
    <footer className="py-12 border-t border-white/10 bg-background relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          <span className="font-display font-bold text-lg text-white">Sales AI Hub</span>
        </div>
        
        <div className="text-sm text-muted-foreground text-center md:text-left">
          &copy; 2026 Capital Group. Built exclusively for internal sales teams.
        </div>
        
        <div className="flex gap-6">
          <a href="#" className="text-sm text-muted-foreground hover:text-white transition-colors">Privacy</a>
          <a href="#" className="text-sm text-muted-foreground hover:text-white transition-colors">Terms</a>
          <a href="#" className="text-sm text-muted-foreground hover:text-white transition-colors">Support</a>
        </div>
      </div>
    </footer>
  );
}


// === FILE: src/components/landing/Hero.tsx ===
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, PhoneCall, LineChart } from "lucide-react";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.2 }
  }
};

const item = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center pt-24 overflow-hidden">
      {/* Background & Animated Mesh */}
      <div className="absolute inset-0 z-0 overflow-hidden bg-[#07091a]">
        {/* Radial gradient base */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#111a3a] via-[#07091a] to-[#07091a]" />
        
        {/* Animated Orbs */}
        <motion.div 
          animate={{ 
            x: [0, 40, 0, -40, 0],
            y: [0, 20, -20, 0, 0],
            scale: [1, 1.1, 0.9, 1],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute top-[10%] left-[20%] w-[40rem] h-[40rem] bg-indigo-600/10 rounded-full blur-[120px]" 
        />
        <motion.div 
          animate={{ 
            x: [0, -30, 30, 0],
            y: [0, 40, 0, -20, 0],
            scale: [1, 1.2, 1, 1.1, 1],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[10%] right-[10%] w-[35rem] h-[35rem] bg-blue-500/10 rounded-full blur-[130px]" 
        />
        <motion.div 
          animate={{ 
            x: [0, 20, -20, 0],
            y: [0, -30, 30, 0],
            scale: [1, 0.8, 1.2, 1],
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
          className="absolute top-[40%] left-[60%] w-[25rem] h-[25rem] bg-sky-500/10 rounded-full blur-[100px]" 
        />

        {/* Dot Grid Texture */}
        <div className="absolute inset-0 bg-dot-grid opacity-40 mix-blend-overlay" />
        
        {/* Gradient Overlay for Text Readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/60 to-background" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <motion.div 
          variants={container}
          initial="hidden"
          animate="show"
          className="text-center max-w-4xl mx-auto"
        >
          <motion.div variants={item} className="mb-6 flex justify-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary-foreground text-sm font-medium shadow-[0_0_15px_rgba(59,130,246,0.2)]">
              <Sparkles className="w-4 h-4 text-primary" />
              <span>Built exclusively for Capital Group Sales</span>
            </div>
          </motion.div>

          <motion.h1 variants={item} className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold tracking-tight mb-8 leading-[1.1]">
            Your AI-Powered <br />
            <span className="text-gradient">Sales Pipeline.</span>
          </motion.h1>

          <motion.p variants={item} className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
            Every meeting. Every call. Every deal. Empowering Capital Group advisors with six sequential AI agents that discover, prep, coach, and close.
          </motion.p>

          <motion.div variants={item} className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a 
              href="/"
              className="group relative px-8 py-4 bg-primary text-primary-foreground rounded-2xl font-semibold text-lg overflow-hidden shadow-glow hover:shadow-glow-strong transition-all duration-300 hover:-translate-y-0.5"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
              <span className="relative flex items-center gap-2">
                Launch Platform
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
            </a>
            
            <a 
              href="#how-it-works"
              className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-semibold text-lg border border-white/10 backdrop-blur-md transition-all duration-300"
            >
              See how it works
            </a>
          </motion.div>

          {/* Floating Stats/Badges */}
          <motion.div variants={item} className="mt-16 pt-10 border-t border-white/10 flex flex-wrap justify-center gap-6 md:gap-12">
            {[
              { label: "6 AI Agents", icon: Sparkles },
              { label: "Voice-Enabled", icon: PhoneCall },
              { label: "Real-Time ETF Data", icon: LineChart }
            ].map((stat, i) => (
              <div key={i} className="flex items-center gap-3 text-muted-foreground">
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                  <stat.icon className="w-5 h-5 text-blue-400" />
                </div>
                <span className="font-medium text-white">{stat.label}</span>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}


// === FILE: src/components/landing/HowItWorks.tsx ===
import { motion } from "framer-motion";

const steps = [
  {
    num: "01",
    title: "Discover & Connect",
    desc: "Query the database to find prime opportunities, then let Maya initiate contact via email or realistic AI voice call to secure the meeting."
  },
  {
    num: "02",
    title: "Prepare & Practice",
    desc: "Get a comprehensive brief on the client, then roleplay your pitch against a skeptical AI persona to sharpen your delivery before the real deal."
  },
  {
    num: "03",
    title: "Engage & Close",
    desc: "Run the real-time listener during your meeting for instant ETF insights, then instantly generate follow-up tasks and warm emails."
  }
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 relative z-10 bg-card/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-20">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">How it works</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 relative">
          {/* Connecting Line */}
          <div className="hidden lg:block absolute top-[3rem] left-[15%] right-[15%] h-px bg-white/10" />

          {steps.map((step, index) => (
            <motion.div 
              key={index}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.2 }}
              className="relative text-center"
            >
              <div className="w-24 h-24 mx-auto bg-background border-2 border-primary/30 rounded-full flex items-center justify-center mb-8 relative z-10 shadow-glow">
                <span className="text-3xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-br from-white to-primary">{step.num}</span>
              </div>
              <h4 className="text-2xl font-bold text-white mb-4">{step.title}</h4>
              <p className="text-muted-foreground leading-relaxed px-4">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}


// === FILE: src/components/landing/Navbar.tsx ===
import { motion } from "framer-motion";
import { Activity } from "lucide-react";

export function Navbar() {
  return (
    <motion.nav 
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 lg:px-8 pt-6 pb-4"
    >
      <div className="max-w-7xl mx-auto">
        <div className="glass-panel rounded-2xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-blue-700 flex items-center justify-center shadow-glow">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight text-white">
              Sales AI Hub
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <a href="#agents" className="text-sm font-medium text-muted-foreground hover:text-white transition-colors">Agents</a>
            <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-white transition-colors">How it Works</a>
          </div>

          <a 
            href="/"
            className="px-5 py-2.5 rounded-xl bg-white text-background font-semibold text-sm hover:bg-blue-50 hover:scale-105 active:scale-95 transition-all duration-200 shadow-[0_0_20px_rgba(255,255,255,0.15)]"
          >
            Launch App
          </a>
        </div>
      </div>
    </motion.nav>
  );
}


// === FILE: src/components/landing/StatsBar.tsx ===
import { motion } from "framer-motion";

const stats = [
  { value: "6", label: "Specialized AI Agents" },
  { value: "5", label: "Core ETFs Tracked Live" },
  { value: "100%", label: "Capital Way Framework Aligned" },
  { value: "< 1s", label: "Voice Processing Latency" },
];

export function StatsBar() {
  return (
    <section className="py-16 relative z-10 bg-black/40 border-y border-white/5 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12">
          {stats.map((stat, index) => (
            <motion.div 
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="text-center"
            >
              <div className="text-4xl md:text-5xl font-display font-extrabold text-white mb-2">
                {stat.value}
              </div>
              <div className="text-sm md:text-base font-medium text-primary uppercase tracking-wider">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}


// === FILE: src/hooks/use-mobile.tsx ===
import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}


// === FILE: src/hooks/use-toast.ts ===
import * as React from "react"

import type {
  ToastActionElement,
  ToastProps,
} from "@/components/ui/toast"

const TOAST_LIMIT = 1
const TOAST_REMOVE_DELAY = 1000000

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const

let count = 0

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

type ActionType = typeof actionTypes

type Action =
  | {
      type: ActionType["ADD_TOAST"]
      toast: ToasterToast
    }
  | {
      type: ActionType["UPDATE_TOAST"]
      toast: Partial<ToasterToast>
    }
  | {
      type: ActionType["DISMISS_TOAST"]
      toastId?: ToasterToast["id"]
    }
  | {
      type: ActionType["REMOVE_TOAST"]
      toastId?: ToasterToast["id"]
    }

interface State {
  toasts: ToasterToast[]
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({
      type: "REMOVE_TOAST",
      toastId: toastId,
    })
  }, TOAST_REMOVE_DELAY)

  toastTimeouts.set(toastId, timeout)
}

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      }

    case "DISMISS_TOAST": {
      const { toastId } = action

      // ! Side effects ! - This could be extracted into a dismissToast() action,
      // but I'll keep it here for simplicity
      if (toastId) {
        addToRemoveQueue(toastId)
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id)
        })
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      }
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        }
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
  }
}

const listeners: Array<(state: State) => void> = []

let memoryState: State = { toasts: [] }

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

type Toast = Omit<ToasterToast, "id">

function toast({ ...props }: Toast) {
  const id = genId()

  const update = (props: ToasterToast) =>
    dispatch({
      type: "UPDATE_TOAST",
      toast: { ...props, id },
    })
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id })

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss()
      },
    },
  })

  return {
    id: id,
    dismiss,
    update,
  }
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [state])

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  }
}

export { useToast, toast }


// ==========================================
// CONFIG FILES
// ==========================================

// === FILE: package.json ===
{
  "name": "@workspace/landing-page",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --config vite.config.ts --host 0.0.0.0",
    "build": "vite build --config vite.config.ts",
    "serve": "vite preview --config vite.config.ts --host 0.0.0.0",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "devDependencies": {
    "@hookform/resolvers": "^3.10.0",
    "@radix-ui/react-accordion": "^1.2.4",
    "@radix-ui/react-alert-dialog": "^1.1.7",
    "@radix-ui/react-aspect-ratio": "^1.1.3",
    "@radix-ui/react-avatar": "^1.1.4",
    "@radix-ui/react-checkbox": "^1.1.5",
    "@radix-ui/react-collapsible": "^1.1.4",
    "@radix-ui/react-context-menu": "^2.2.7",
    "@radix-ui/react-dialog": "^1.1.7",
    "@radix-ui/react-dropdown-menu": "^2.1.7",
    "@radix-ui/react-hover-card": "^1.1.7",
    "@radix-ui/react-label": "^2.1.3",
    "@radix-ui/react-menubar": "^1.1.7",
    "@radix-ui/react-navigation-menu": "^1.2.6",
    "@radix-ui/react-popover": "^1.1.7",
    "@radix-ui/react-progress": "^1.1.3",
    "@radix-ui/react-radio-group": "^1.2.4",
    "@radix-ui/react-scroll-area": "^1.2.4",
    "@radix-ui/react-select": "^2.1.7",
    "@radix-ui/react-separator": "^1.1.3",
    "@radix-ui/react-slider": "^1.2.4",
    "@radix-ui/react-slot": "^1.2.0",
    "@radix-ui/react-switch": "^1.1.4",
    "@radix-ui/react-tabs": "^1.1.4",
    "@radix-ui/react-toast": "^1.2.7",
    "@radix-ui/react-toggle": "^1.1.3",
    "@radix-ui/react-toggle-group": "^1.1.3",
    "@radix-ui/react-tooltip": "^1.2.0",
    "@replit/vite-plugin-cartographer": "catalog:",
    "@replit/vite-plugin-dev-banner": "catalog:",
    "@replit/vite-plugin-runtime-error-modal": "catalog:",
    "@tailwindcss/typography": "^0.5.15",
    "@tailwindcss/vite": "catalog:",
    "@tanstack/react-query": "catalog:",
    "@types/node": "catalog:",
    "@types/react": "catalog:",
    "@types/react-dom": "catalog:",
    "@vitejs/plugin-react": "catalog:",
    "@workspace/api-client-react": "workspace:*",
    "class-variance-authority": "catalog:",
    "clsx": "catalog:",
    "cmdk": "^1.1.1",
    "date-fns": "^3.6.0",
    "embla-carousel-react": "^8.6.0",
    "framer-motion": "catalog:",
    "input-otp": "^1.4.2",
    "lucide-react": "catalog:",
    "next-themes": "^0.4.6",
    "react": "catalog:",
    "react-day-picker": "^9.11.1",
    "react-dom": "catalog:",
    "react-hook-form": "^7.55.0",
    "react-icons": "^5.4.0",
    "react-resizable-panels": "^2.1.7",
    "recharts": "^2.15.2",
    "sonner": "^2.0.7",
    "tailwind-merge": "catalog:",
    "tailwindcss": "catalog:",
    "tw-animate-css": "^1.4.0",
    "vaul": "^1.1.2",
    "vite": "catalog:",
    "wouter": "^3.3.5",
    "zod": "catalog:"
  }
}


// === FILE: index.html ===
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1" />
    <title>Sales AI Hub — Landing Page</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>


// === FILE: vite.config.ts ===
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    "BASE_PATH environment variable is required but was not provided.",
  );
}

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});


// === FILE: tsconfig.json ===
{
  "extends": "../../tsconfig.base.json",
  "include": ["src/**/*"],
  "exclude": ["node_modules", "build", "dist", "**/*.test.ts"],
  "compilerOptions": {
    "noEmit": true,
    "jsx": "preserve",
    "lib": ["esnext", "dom", "dom.iterable"],
    "resolveJsonModule": true,
    "allowImportingTsExtensions": true,
    "moduleResolution": "bundler",
    "types": ["node", "vite/client"],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "references": [
    {
      "path": "../../lib/api-client-react"
    }
  ]
}


