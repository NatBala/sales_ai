import { motion } from "framer-motion";
import { Mic, Zap, BarChart2, PieChart, TrendingUp, Activity } from "lucide-react";

const etfs = [
  { ticker: "CGCP", name: "Core Plus Income ETF", color: "from-blue-500 to-blue-700" },
  { ticker: "CGUS", name: "U.S. Equity ETF", color: "from-indigo-500 to-indigo-700" },
  { ticker: "CGGR", name: "Growth ETF", color: "from-violet-500 to-violet-700" },
  { ticker: "CGXU", name: "International Focus ETF", color: "from-cyan-500 to-cyan-700" },
  { ticker: "CGDV", name: "Dividend Value ETF", color: "from-sky-500 to-sky-700" },
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
                  desc: "Full coverage for CGCP, CGUS, CGGR, CGXU, and CGDV with rich visual data panels for each.",
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
