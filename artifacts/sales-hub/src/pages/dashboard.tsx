import { useState } from "react";
import { Layout } from "@/components/layout";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Calendar, FileText, BrainCircuit, Activity,
  CheckSquare, ArrowRight, TrendingUp, Target, Award, Sparkles, ChevronDown
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from "recharts";

const agents = [
  {
    id: "lead-me",
    title: "Lead Me",
    desc: "Generate hyper-targeted leads using natural language queries and financial data.",
    icon: Search,
    color: "text-blue-400",
    bg: "bg-blue-400/10",
    border: "border-blue-400/25",
    path: "/lead-me"
  },
  {
    id: "schedule-me",
    title: "Schedule Me",
    desc: "Craft highly personalized outreach emails and seamlessly book meetings.",
    icon: Calendar,
    color: "text-cyan-400",
    bg: "bg-cyan-400/10",
    border: "border-cyan-400/25",
    path: "/leads"
  },
  {
    id: "prep-me",
    title: "Prep Me",
    desc: "Synthesize client background, agendas, and talking points before the call.",
    icon: FileText,
    color: "text-sky-400",
    bg: "bg-sky-400/10",
    border: "border-sky-400/25",
    path: "/prep-me"
  },
  {
    id: "coach-me",
    title: "Coach Me",
    desc: "Practice objection handling and hone your pitch with an AI coaching session.",
    icon: BrainCircuit,
    color: "text-violet-400",
    bg: "bg-violet-400/10",
    border: "border-violet-400/25",
    path: "/coach-me"
  },
  {
    id: "engage-me",
    title: "Engage Me",
    desc: "Real-time conversation intelligence, objection handling, and quick facts.",
    icon: Activity,
    color: "text-blue-300",
    bg: "bg-blue-300/10",
    border: "border-blue-300/25",
    path: "/engage-me"
  },
  {
    id: "follow-me",
    title: "Follow Me",
    desc: "Automate post-meeting summaries and generate actionable task lists.",
    icon: CheckSquare,
    color: "text-teal-400",
    bg: "bg-teal-400/10",
    border: "border-teal-400/25",
    path: "/follow-me"
  }
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } }
};

const itemAnim = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
};

const metrics = [
  {
    label: "Total AUM",
    target: 2400,
    achieved: 1784,
    unit: "M",
    displayTarget: "$2.4B",
    displayAchieved: "$1.78B",
    color: "#3b82f6",
    trackColor: "rgba(59,130,246,0.12)",
    pct: 74,
    trend: "+9.2%",
    trendPositive: true,
    icon: Target,
    iconColor: "text-blue-400",
    iconBg: "bg-blue-400/10",
    iconBorder: "border-blue-400/20",
    canGenerateLeads: false,
    leadQuery: "",
  },
  {
    label: "Fixed Income",
    target: 1100,
    achieved: 892,
    unit: "M",
    displayTarget: "$1.1B",
    displayAchieved: "$892M",
    color: "#2dd4bf",
    trackColor: "rgba(45,212,191,0.12)",
    pct: 81,
    trend: "+14.6%",
    trendPositive: true,
    icon: TrendingUp,
    iconColor: "text-teal-400",
    iconBg: "bg-teal-400/10",
    iconBorder: "border-teal-400/20",
    canGenerateLeads: true,
    leadQuery: "Fixed income fund managers and institutional allocators seeking yield opportunities",
  },
  {
    label: "Active ETFs",
    target: 650,
    achieved: 421,
    unit: "M",
    displayTarget: "$650M",
    displayAchieved: "$421M",
    color: "#a78bfa",
    trackColor: "rgba(167,139,250,0.12)",
    pct: 65,
    trend: "+5.1%",
    trendPositive: true,
    icon: Award,
    iconColor: "text-violet-400",
    iconBg: "bg-violet-400/10",
    iconBorder: "border-violet-400/20",
    canGenerateLeads: true,
    leadQuery: "ETF strategists and portfolio managers looking to expand active ETF exposure",
  }
];

const monthlyData = [
  { month: "Jan", aum: 682, fi: 198, etfs: 72 },
  { month: "Feb", aum: 445, fi: 421, etfs: 89 },
  { month: "Mar", aum: 657, fi: 273, etfs: 260 },
];

function DonutGauge({ pct, color, trackColor, size = 140 }: {
  pct: number; color: string; trackColor: string; size?: number;
}) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const strokeDash = circ * (pct / 100);
  const strokeGap = circ - strokeDash;

  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      <circle cx="60" cy="60" r={r} fill="none" stroke={trackColor} strokeWidth="10" />
      <circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeDasharray={`${strokeDash} ${strokeGap}`}
        strokeLinecap="round"
        transform="rotate(-90 60 60)"
        style={{ filter: `drop-shadow(0 0 6px ${color}66)` }}
      />
      <text
        x="60"
        y="55"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="white"
        fontSize="20"
        fontWeight="700"
        fontFamily="system-ui"
      >
        {pct}%
      </text>
      <text
        x="60"
        y="75"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="rgba(255,255,255,0.45)"
        fontSize="10"
        fontFamily="system-ui"
      >
        of target
      </text>
    </svg>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-white/10 rounded-xl p-3 shadow-xl text-xs">
      <p className="text-white font-semibold mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: p.fill }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="text-white font-medium">${p.value}M</span>
        </div>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

  const today = new Date();
  const qEnd = new Date(2026, 2, 31);
  const qStart = new Date(2026, 0, 1);
  const totalDays = (qEnd.getTime() - qStart.getTime()) / 86400000;
  const elapsed = (today.getTime() - qStart.getTime()) / 86400000;
  const daysLeft = Math.max(0, Math.ceil((qEnd.getTime() - today.getTime()) / 86400000));
  const quarterPct = Math.round(Math.min((elapsed / totalDays) * 100, 100));

  return (
    <Layout>
      <div className="space-y-8">

        {/* Metrics Hero */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-5"
        >
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-3xl font-display font-bold text-white">Q1 2026 Performance</h1>
              <p className="text-muted-foreground mt-1">January — March 2026 &nbsp;·&nbsp; {daysLeft} days remaining</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold px-3 py-1.5 rounded-full">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                On Track
              </div>
              <div className="text-xs text-muted-foreground bg-white/5 border border-white/8 px-3 py-1.5 rounded-full">
                Quarter {quarterPct}% elapsed
              </div>
            </div>
          </div>

          {/* Quarter Progress Bar */}
          <div className="h-1 bg-white/5 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-primary via-accent to-primary/60"
              initial={{ width: 0 }}
              animate={{ width: `${quarterPct}%` }}
              transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
            />
          </div>

          {/* Three Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {metrics.map((m, i) => {
              const isSelected = selectedMetric === m.label;
              return (
                <motion.div
                  key={m.label}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + i * 0.1, duration: 0.4 }}
                >
                  <Card
                    className={`relative overflow-hidden bg-card/40 transition-all duration-300 ${
                      m.canGenerateLeads
                        ? "cursor-pointer hover:border-white/20 hover:-translate-y-0.5 hover:shadow-lg"
                        : "border-white/8"
                    } ${isSelected ? "shadow-lg" : "border-white/8"}`}
                    style={isSelected ? { borderColor: `${m.color}55`, boxShadow: `0 0 0 1px ${m.color}33, 0 8px 24px ${m.color}15` } : {}}
                    onClick={() => m.canGenerateLeads && setSelectedMetric(isSelected ? null : m.label)}
                  >
                    <div
                      className="absolute inset-0 opacity-[0.03]"
                      style={{ background: `radial-gradient(ellipse at top right, ${m.color}, transparent 70%)` }}
                    />
                    <CardContent className="pt-6 pb-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <div className={`w-9 h-9 rounded-xl ${m.iconBg} border ${m.iconBorder} flex items-center justify-center`}>
                              <m.icon className={`w-4 h-4 ${m.iconColor}`} />
                            </div>
                            {m.canGenerateLeads && (
                              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border"
                                style={{ color: m.color, borderColor: `${m.color}40`, background: `${m.color}10` }}>
                                Click to expand
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-medium text-muted-foreground">{m.label}</p>
                          <p className="text-2xl font-bold text-white mt-0.5">{m.displayAchieved}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">of {m.displayTarget} target</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <DonutGauge pct={m.pct} color={m.color} trackColor={m.trackColor} size={110} />
                          {m.canGenerateLeads && (
                            <motion.div
                              animate={{ rotate: isSelected ? 180 : 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            </motion.div>
                          )}
                        </div>
                      </div>

                      {/* Linear Progress */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Progress</span>
                          <span className="text-emerald-400 font-medium flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" /> {m.trend} vs Q4
                          </span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ background: m.color }}
                            initial={{ width: 0 }}
                            animate={{ width: `${m.pct}%` }}
                            transition={{ delay: 0.4 + i * 0.1, duration: 0.8, ease: "easeOut" }}
                          />
                        </div>
                      </div>

                      {/* Expandable Generate Leads Panel */}
                      <AnimatePresence>
                        {isSelected && m.canGenerateLeads && (
                          <motion.div
                            initial={{ opacity: 0, height: 0, marginTop: 0 }}
                            animate={{ opacity: 1, height: "auto", marginTop: 16 }}
                            exit={{ opacity: 0, height: 0, marginTop: 0 }}
                            transition={{ duration: 0.25, ease: "easeInOut" }}
                            className="overflow-hidden"
                          >
                            <div
                              className="rounded-xl p-4 border"
                              style={{ background: `${m.color}08`, borderColor: `${m.color}25` }}
                            >
                              <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                                You're <span className="text-white font-semibold">{100 - m.pct}%</span> away from your {m.label} target. Generate fresh leads to close the gap.
                              </p>
                              <Button
                                asChild
                                className="w-full font-semibold shadow-md"
                                style={{ background: m.color, color: "#fff" }}
                              >
                                <Link href={`/lead-me?q=${encodeURIComponent(m.leadQuery)}`}>
                                  <Sparkles className="w-4 h-4 mr-2" />
                                  Generate {m.label} Leads
                                </Link>
                              </Button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {/* Monthly Bar Chart */}
          <Card className="bg-card/40 border-white/8">
            <CardHeader className="border-b border-white/5 pb-4">
              <CardTitle className="text-base text-white">Monthly Pipeline Activity</CardTitle>
              <CardDescription>Net new assets by category — Q1 2026 (USD millions)</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={monthlyData} barCategoryGap="35%" barGap={4}>
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
                    tickFormatter={(v) => `$${v}M`}
                    width={52}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                  <Bar dataKey="aum" name="Total AUM" radius={[4, 4, 0, 0]} fill="#3b82f6" />
                  <Bar dataKey="fi" name="Fixed Income" radius={[4, 4, 0, 0]} fill="#2dd4bf" />
                  <Bar dataKey="etfs" name="Active ETFs" radius={[4, 4, 0, 0]} fill="#a78bfa" />
                </BarChart>
              </ResponsiveContainer>

              {/* Legend */}
              <div className="flex items-center gap-5 mt-4 justify-center">
                {[
                  { color: "#3b82f6", label: "Total AUM" },
                  { color: "#2dd4bf", label: "Fixed Income" },
                  { color: "#a78bfa", label: "Active ETFs" },
                ].map(l => (
                  <div key={l.label} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: l.color }} />
                    <span className="text-xs text-muted-foreground">{l.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Agents Grid */}
        <div>
          <h2 className="text-xl font-display font-semibold text-white mb-5 pl-1">Agent Pipeline — 6 Steps</h2>

          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {agents.map((agent) => (
              <motion.div key={agent.id} variants={itemAnim}>
                <Card className="h-full bg-card/50 backdrop-blur-sm border-white/5 hover:border-white/15 transition-all duration-300 group hover:-translate-y-1 hover:shadow-xl">
                  <CardHeader>
                    <div className={`w-12 h-12 rounded-2xl ${agent.bg} ${agent.border} border flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300`}>
                      <agent.icon className={`w-6 h-6 ${agent.color}`} />
                    </div>
                    <CardTitle className="text-lg text-white">{agent.title}</CardTitle>
                    <CardDescription className="text-sm mt-1.5 leading-relaxed">
                      {agent.desc}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-2 mt-auto">
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
