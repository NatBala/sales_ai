import { Layout } from "@/components/layout";
import { useLead } from "@/hooks/use-leads";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Calendar, ArrowLeft, MapPin, Target, Zap, TrendingUp, TrendingDown, Building2, Star, Shield } from "lucide-react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, Radar, Cell
} from "recharts";

interface AdvisorData {
  aumM: number;
  salesAmt: number;
  redemption: number;
  fiOpportunities: number;
  etfOpportunities: number;
  alpha: number;
  competitors: string[];
  buyingUnit: string;
  territory: string;
  segment: string;
  ratings: number | null;
  advisorProfile?: string;
  salesEngagement?: string;
  salesNotes?: string;
}

function parseAdvisorData(assets: string): AdvisorData | null {
  try {
    const obj = JSON.parse(assets) as { __advisorData?: AdvisorData };
    return obj.__advisorData ?? null;
  } catch { return null; }
}

function fmt(n: number): string {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

const SEGMENT_CONFIG: Record<string, { label: string; desc: string; color: string; bg: string; border: string; glow: string }> = {
  A: { label: "Top Tier",   desc: "Highest value advisor",       color: "#10b981", bg: "bg-emerald-500/10", border: "border-emerald-500/30", glow: "#10b981" },
  B: { label: "High Value", desc: "Strong engagement potential", color: "#3b82f6", bg: "bg-blue-500/10",    border: "border-blue-500/30",    glow: "#3b82f6" },
  C: { label: "Mid-Market", desc: "Growth opportunity",          color: "#0ea5e9", bg: "bg-sky-500/10",     border: "border-sky-500/30",     glow: "#0ea5e9" },
  D: { label: "Developing", desc: "Emerging relationship",       color: "#f59e0b", bg: "bg-amber-500/10",   border: "border-amber-500/30",   glow: "#f59e0b" },
  E: { label: "Emerging",   desc: "Early-stage prospect",        color: "#a78bfa", bg: "bg-violet-500/10",  border: "border-violet-500/30",  glow: "#a78bfa" },
};

function AumDonut({ aumM }: { aumM: number }) {
  const pct = Math.min((aumM / 100) * 100, 100);
  const r = 60; const circ = 2 * Math.PI * r;
  const dash = circ * (pct / 100);
  return (
    <svg width={148} height={148} viewBox="0 0 148 148">
      <circle cx="74" cy="74" r={r} fill="none" stroke="rgba(59,130,246,0.10)" strokeWidth="12" />
      <circle cx="74" cy="74" r={r} fill="none" stroke="#3b82f6" strokeWidth="12"
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
        transform="rotate(-90 74 74)" style={{ filter: "drop-shadow(0 0 8px #3b82f688)" }} />
      <text x="74" y="68" textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="22" fontWeight="700" fontFamily="system-ui">
        ${aumM.toFixed(0)}M
      </text>
      <text x="74" y="86" textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.4)" fontSize="11" fontFamily="system-ui">AUM</text>
    </svg>
  );
}

function FlowTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-white/10 rounded-xl p-3 shadow-xl text-xs">
      <p className="text-white font-semibold mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: p.fill }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="text-white font-medium">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 85 ? "#10b981" : score >= 70 ? "#3b82f6" : score >= 55 ? "#f59e0b" : "#6b7280";
  const label = score >= 85 ? "Excellent" : score >= 70 ? "Strong" : score >= 55 ? "Good" : "Fair";
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={100} height={100} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="none" stroke={`${color}22`} strokeWidth="10" />
        <circle cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={`${2 * Math.PI * 40 * score / 100} ${2 * Math.PI * 40}`}
          strokeLinecap="round" transform="rotate(-90 50 50)"
          style={{ filter: `drop-shadow(0 0 6px ${color}88)` }} />
        <text x="50" y="47" textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="18" fontWeight="700" fontFamily="system-ui">{score}</text>
        <text x="50" y="62" textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.4)" fontSize="9" fontFamily="system-ui">/ 100</text>
      </svg>
      <span className="text-xs font-semibold" style={{ color }}>{label} Fit</span>
    </div>
  );
}

export default function LeadProfile() {
  const { id } = useParams();
  const { data: lead, isLoading } = useLead(id!);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!lead) return <Layout><div className="text-center py-12 text-white">Lead not found.</div></Layout>;

  const advisor = parseAdvisorData(lead.assets ?? "");
  const seg = advisor ? (SEGMENT_CONFIG[advisor.segment] ?? SEGMENT_CONFIG.C) : null;

  const flowData = advisor ? [
    { name: "Sales",      value: advisor.salesAmt,    fill: "#3b82f6" },
    { name: "Redemption", value: advisor.redemption,  fill: "#f59e0b" },
  ] : [];

  const oppData = advisor ? [
    { name: "Fixed Income", value: advisor.fiOpportunities,  fill: "#2dd4bf" },
    { name: "Active ETFs",  value: advisor.etfOpportunities, fill: "#a78bfa" },
  ] : [];

  const radarData = advisor ? [
    { metric: "AUM",           value: Math.round((advisor.aumM / 100) * 100) },
    { metric: "Sales Flow",    value: Math.round((advisor.salesAmt / 2e6) * 100) },
    { metric: "FI Opp",       value: Math.round((advisor.fiOpportunities / 45e6) * 100) },
    { metric: "ETF Opp",      value: Math.round((advisor.etfOpportunities / 45e6) * 100) },
    { metric: "Alpha",        value: Math.round((advisor.alpha / 500e3) * 100) },
  ] : [];

  const netFlow = advisor ? advisor.salesAmt - advisor.redemption : 0;
  const salesNotes = advisor?.salesNotes?.trim() || lead.reasoning || "";

  return (
    <Layout>
      <div className="space-y-6 max-w-6xl mx-auto pb-12">

        <Link href="/leads" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Pipeline
        </Link>

        {/* ── Header Card ────────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <Card className="bg-card/40 border-white/8 overflow-hidden relative"
            style={{ borderTop: seg ? `3px solid ${seg.glow}` : undefined }}>
            <div className="absolute inset-0 opacity-[0.025]"
              style={{ background: seg ? `radial-gradient(ellipse at top left, ${seg.glow}, transparent 60%)` : undefined }} />
            <CardContent className="p-8">
              <div className="flex flex-col lg:flex-row gap-8 items-start">

                {/* Avatar + name */}
                <div className="flex-1 space-y-4">
                  <div className="flex flex-wrap items-start gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                      <span className="text-2xl font-bold text-primary">{lead.name[0]}</span>
                    </div>
                    <div>
                      <h1 className="text-3xl font-display font-bold text-white">{lead.name}</h1>
                      <div className="flex flex-wrap items-center gap-3 mt-2">
                        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Building2 className="w-4 h-4 text-primary/60" /> {lead.company}
                        </span>
                        {lead.location && (
                          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <MapPin className="w-4 h-4 text-primary/60" /> {lead.location}
                          </span>
                        )}
                        {advisor && (
                          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Shield className="w-4 h-4 text-primary/60" /> {advisor.buyingUnit}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Segment + tags */}
                  {seg && advisor && (
                    <div className="flex flex-wrap gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border ${seg.bg} ${seg.border}`}
                        style={{ color: seg.color }}>
                        Segment {advisor.segment} · {seg.label}
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-white/5 border border-white/10 text-white/70">
                        {advisor.territory}
                      </span>
                      {advisor.ratings && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-amber-500/10 border border-amber-500/25 text-amber-300">
                          <Star className="w-3.5 h-3.5" /> {advisor.ratings}/10
                        </span>
                      )}
                    </div>
                  )}

                  <p className="text-base text-white/75 leading-relaxed">{lead.reason}</p>
                </div>

                {/* Score + CTA */}
                <div className="flex flex-col items-center gap-4 min-w-[180px] shrink-0">
                  <ScoreBadge score={lead.score} />
                  <Button asChild className="w-full bg-teal-500 hover:bg-teal-400 text-white shadow-lg shadow-teal-500/25">
                    <Link href={`/schedule-me/${lead.id}`}>
                      <Calendar className="w-4 h-4 mr-2" /> Schedule Outreach
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Advisor data section ────────────────────────────────────────── */}
        {advisor && (
          <>
            {/* Key metrics row */}
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-4"
            >
              {[
                { label: "Total AUM",      value: `$${advisor.aumM.toFixed(1)}M`, icon: TrendingUp,  color: "text-blue-400",    bg: "bg-blue-400/10",   border: "border-blue-400/20" },
                { label: "Net Flow",       value: fmt(netFlow),                   icon: netFlow >= 0 ? TrendingUp : TrendingDown, color: netFlow >= 0 ? "text-emerald-400" : "text-red-400", bg: netFlow >= 0 ? "bg-emerald-400/10" : "bg-red-400/10", border: netFlow >= 0 ? "border-emerald-400/20" : "border-red-400/20" },
                { label: "Alpha Generated",value: fmt(advisor.alpha),             icon: Zap,         color: "text-violet-400",  bg: "bg-violet-400/10", border: "border-violet-400/20" },
                { label: "Total Opp.",     value: fmt(advisor.fiOpportunities + advisor.etfOpportunities), icon: Target, color: "text-teal-400",   bg: "bg-teal-400/10",   border: "border-teal-400/20" },
              ].map((m, i) => (
                <Card key={i} className="bg-card/40 border-white/8">
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl ${m.bg} border ${m.border} flex items-center justify-center shrink-0`}>
                      <m.icon className={`w-5 h-5 ${m.color}`} />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">{m.label}</p>
                      <p className={`text-xl font-bold ${m.color}`}>{m.value}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </motion.div>

            {/* Charts + Radar */}
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.4 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-5"
            >
              {/* AUM Gauge */}
              <Card className="bg-card/40 border-white/8">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-white/80">Assets Under Management</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-4">
                  <AumDonut aumM={advisor.aumM} />
                  <div className="w-full space-y-2 text-xs">
                    <div className="flex justify-between text-muted-foreground">
                      <span>% of $100M benchmark</span>
                      <span className="text-white font-semibold">{Math.round(advisor.aumM)}%</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(advisor.aumM, 100)}%`, boxShadow: "0 0 6px #3b82f688" }} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Sales vs Redemption */}
              <Card className="bg-card/40 border-white/8">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-white/80">Sales & Redemption Flow</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={flowData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} tickFormatter={v => `$${(v/1e6).toFixed(1)}M`} width={45} />
                      <Tooltip content={<FlowTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                      <Bar dataKey="value" name="Amount" radius={[6, 6, 0, 0]}>
                        {flowData.map((d, i) => <Cell key={i} fill={d.fill} style={{ filter: `drop-shadow(0 0 4px ${d.fill}66)` }} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="flex justify-between text-xs text-muted-foreground mt-1 px-1">
                    <span className="text-blue-300">{fmt(advisor.salesAmt)}</span>
                    <span className={netFlow >= 0 ? "text-emerald-400" : "text-red-400"}>
                      {netFlow >= 0 ? "+" : ""}{fmt(netFlow)} net
                    </span>
                    <span className="text-amber-300">{fmt(advisor.redemption)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Performance Radar */}
              <Card className="bg-card/40 border-white/8">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-white/80">Advisor Profile Score</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center">
                  <ResponsiveContainer width="100%" height={180}>
                    <RadarChart data={radarData} margin={{ top: 8, right: 20, bottom: 8, left: 20 }}>
                      <PolarGrid stroke="rgba(255,255,255,0.08)" />
                      <PolarAngleAxis dataKey="metric" tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }} />
                      <Radar name="Score" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} strokeWidth={2} />
                    </RadarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>

            {/* Vanguard Opportunities */}
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.4 }}
            >
              <Card className="bg-card/40 border-white/8">
                <CardHeader className="border-b border-white/5 pb-4">
                  <CardTitle className="text-base text-white flex items-center gap-2">
                    <Target className="w-5 h-5 text-teal-400" /> Vanguard Opportunity Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      {oppData.map((d, i) => (
                        <div key={i}>
                          <div className="flex justify-between text-sm mb-2">
                            <span className="font-medium" style={{ color: d.fill }}>{d.name}</span>
                            <span className="text-white font-bold">{fmt(d.value)}</span>
                          </div>
                          <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                            <motion.div className="h-full rounded-full"
                              style={{ background: d.fill, boxShadow: `0 0 8px ${d.fill}66` }}
                              initial={{ width: 0 }}
                              animate={{ width: `${(d.value / Math.max(advisor.fiOpportunities, advisor.etfOpportunities)) * 100}%` }}
                              transition={{ delay: 0.3 + i * 0.1, duration: 0.8, ease: "easeOut" }} />
                          </div>
                        </div>
                      ))}
                      <div className="pt-2 border-t border-white/5">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Total Vanguard Opportunity</span>
                          <span className="text-white font-bold">{fmt(advisor.fiOpportunities + advisor.etfOpportunities)}</span>
                        </div>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={140}>
                      <BarChart data={oppData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} tickFormatter={v => `$${(v/1e6).toFixed(0)}M`} width={42} />
                        <Tooltip content={<FlowTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                        <Bar dataKey="value" name="Opportunity" radius={[6, 6, 0, 0]}>
                          {oppData.map((d, i) => <Cell key={i} fill={d.fill} style={{ filter: `drop-shadow(0 0 4px ${d.fill}55)` }} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Competitors + AI Analysis */}
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.4 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-5"
            >
              {/* Competitor products */}
              <Card className="bg-card/40 border-white/8">
                <CardHeader className="border-b border-white/5 pb-4">
                  <CardTitle className="text-base text-white">Competitor Products Held</CardTitle>
                </CardHeader>
                <CardContent className="pt-5">
                  {advisor.competitors.length > 0 ? (
                    <div className="space-y-3">
                      {advisor.competitors.map((c, i) => {
                        const [brand, product] = c.split(":");
                        const isCapGroup = brand === "Vanguard";
                        return (
                          <div key={i} className={`flex items-center justify-between p-3 rounded-xl border ${isCapGroup ? "bg-primary/8 border-primary/20" : "bg-red-500/8 border-red-500/20"}`}>
                            <div className="flex items-center gap-3">
                              <div className={`w-2 h-2 rounded-full ${isCapGroup ? "bg-primary" : "bg-red-400"}`} />
                              <div>
                                <p className="text-sm font-semibold text-white">{product}</p>
                                <p className={`text-xs ${isCapGroup ? "text-primary/70" : "text-red-400/70"}`}>{brand}</p>
                              </div>
                            </div>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isCapGroup ? "bg-primary/15 text-primary" : "bg-red-500/15 text-red-300"}`}>
                              {isCapGroup ? "CG Product" : "Competitor"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-6">No competitor products on file.</p>
                  )}

                  <div className="mt-5 border-t border-white/5 pt-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2">AI Matching Summary</p>
                    <p className="text-sm text-white/80 leading-relaxed">{lead.reason}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Sales Notes */}
              <Card className="bg-card/40 border-white/8">
                <CardHeader className="border-b border-white/5 pb-4">
                  <CardTitle className="text-base text-white flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary" /> Sales Notes
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-5 space-y-4">
                  {salesNotes && (
                    <div className="bg-primary/5 border border-primary/15 rounded-xl p-4">
                      <p className="text-xs text-primary uppercase tracking-wider font-semibold mb-2">Sales Notes</p>
                      <p className="text-sm text-white/75 leading-relaxed whitespace-pre-wrap">{salesNotes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}

        {/* Fallback for non-advisor leads */}
        {!advisor && (
          <div className="grid gap-5">
            {[
              { title: "AI Analysis", content: lead.reason, color: "text-primary" },
              { title: "Financial Profile", content: lead.assets, color: "text-blue-400" },
              { title: "Sales Intelligence", content: lead.sales, color: "text-indigo-400" },
            ].map(s => (
              <Card key={s.title} className="bg-card/40 border-white/8">
                <CardHeader>
                  <CardTitle className={`text-base ${s.color}`}>{s.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-white/75 leading-relaxed whitespace-pre-wrap">{s.content || "No data available."}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

      </div>
    </Layout>
  );
}
