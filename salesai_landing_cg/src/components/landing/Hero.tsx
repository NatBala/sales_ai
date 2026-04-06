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
              href="https://calm-grass-06c54321e.6.azurestaticapps.net"
              target="_blank"
              rel="noreferrer"
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
