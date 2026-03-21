import { useState, useRef, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useAgentLeadMe } from "@/hooks/use-agents";
import { useCreateLead } from "@/hooks/use-leads";
import type { GeneratedLead } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Search, Building2, TrendingUp,
  Save, Check, ArrowRight, Calendar, Mic, MicOff,
  ChevronDown, ChevronUp, MapPin, Zap, Users, ExternalLink,
  SlidersHorizontal, Database, Brain, Filter, Star, BarChart3, CheckCircle2, Sparkles, Network
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from "recharts";

interface ParsedFilters {
  firms: string[];
  segments: string[];
  counties: string[];
  channels: string[];
  aumMin: number | null;
  aumMax: number | null;
  netFlow: "positive" | "negative" | null;
  fiOppMin: number | null;
  etfOppMin: number | null;
  alphaMin: number | null;
  ratingsMin: number | null;
  competitors: string[];
  totalOppMin: number | null;
}

interface FilterChip {
  label: string;
  value: string;
  color: string;
  bg: string;
  border: string;
}

function buildFilterChips(f: ParsedFilters): FilterChip[] {
  const chips: FilterChip[] = [];
  const add = (label: string, value: string, color: string, bg: string, border: string) =>
    chips.push({ label, value, color, bg, border });

  const fmtM = (n: number) => `$${n}M`;
  const fmtD = (n: number) => n >= 1e6 ? `$${(n / 1e6).toFixed(0)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${n}`;
  const SEGMENT_NAMES: Record<string, string> = { A: "Top Tier", B: "High Value", C: "Mid-Market", D: "Developing", E: "Emerging" };
  const CHANNEL_NAMES: Record<string, string> = { XC: "Exclusive Channel", FC: "Flexible Channel" };

  f.firms.forEach(v => add("Firm", v, "text-blue-300", "bg-blue-500/10", "border-blue-500/25"));
  f.segments.forEach(v => add("Segment", `${v} · ${SEGMENT_NAMES[v] ?? v}`, "text-emerald-300", "bg-emerald-500/10", "border-emerald-500/25"));
  f.counties.forEach(v => add("Territory", v, "text-sky-300", "bg-sky-500/10", "border-sky-500/25"));
  f.channels.forEach(v => add("Channel", CHANNEL_NAMES[v] ?? v, "text-violet-300", "bg-violet-500/10", "border-violet-500/25"));
  f.competitors.forEach(v => add("Competitor", v, "text-orange-300", "bg-orange-500/10", "border-orange-500/25"));
  if (f.aumMin !== null && f.aumMax !== null) add("AUM", `${fmtM(f.aumMin)} – ${fmtM(f.aumMax)}`, "text-cyan-300", "bg-cyan-500/10", "border-cyan-500/25");
  else if (f.aumMin !== null) add("AUM", `≥ ${fmtM(f.aumMin)}`, "text-cyan-300", "bg-cyan-500/10", "border-cyan-500/25");
  else if (f.aumMax !== null) add("AUM", `≤ ${fmtM(f.aumMax)}`, "text-cyan-300", "bg-cyan-500/10", "border-cyan-500/25");
  if (f.netFlow) add("Net Flow", f.netFlow === "positive" ? "Net Buyer" : "Net Seller", f.netFlow === "positive" ? "text-emerald-300" : "text-red-300", f.netFlow === "positive" ? "bg-emerald-500/10" : "bg-red-500/10", f.netFlow === "positive" ? "border-emerald-500/25" : "border-red-500/25");
  if (f.fiOppMin !== null) add("FI Opportunity", `≥ ${fmtD(f.fiOppMin)}`, "text-teal-300", "bg-teal-500/10", "border-teal-500/25");
  if (f.etfOppMin !== null) add("ETF Opportunity", `≥ ${fmtD(f.etfOppMin)}`, "text-purple-300", "bg-purple-500/10", "border-purple-500/25");
  if (f.totalOppMin !== null) add("Total Opportunity", `≥ ${fmtD(f.totalOppMin)}`, "text-indigo-300", "bg-indigo-500/10", "border-indigo-500/25");
  if (f.alphaMin !== null) add("Alpha", `≥ ${fmtD(f.alphaMin)}`, "text-yellow-300", "bg-yellow-500/10", "border-yellow-500/25");
  if (f.ratingsMin !== null) add("Rating", `≥ ${f.ratingsMin}/10`, "text-amber-300", "bg-amber-500/10", "border-amber-500/25");

  return chips;
}

function QueryIntelligencePanel({
  parsedFilters, filteredCount, totalCount, usedFallback
}: {
  parsedFilters: ParsedFilters;
  filteredCount: number;
  totalCount: number;
  usedFallback: boolean;
}) {
  const chips = buildFilterChips(parsedFilters);
  const hasFilters = chips.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border overflow-hidden"
      style={{ borderColor: "rgba(59,130,246,0.2)", background: "rgba(59,130,246,0.04)" }}
    >
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <SlidersHorizontal className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-white">Query Intelligence</span>
          <span className="text-xs text-muted-foreground">— {hasFilters ? `${chips.length} filter${chips.length !== 1 ? "s" : ""} detected` : "no specific filters detected"}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {usedFallback ? (
            <span className="text-amber-400/80">⚠ Too few matches, searching all {totalCount}</span>
          ) : (
            <>
              <span className="font-bold text-primary">{filteredCount}</span>
              <span className="text-muted-foreground">of {totalCount} advisors matched pre-filters</span>
              <div className="w-20 h-1.5 bg-white/5 rounded-full overflow-hidden ml-1">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${(filteredCount / totalCount) * 100}%`, boxShadow: "0 0 4px #3b82f6" }}
                />
              </div>
            </>
          )}
        </div>
      </div>
      <div className="px-5 py-4">
        {hasFilters ? (
          <div className="flex flex-wrap gap-2">
            {chips.map((chip, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${chip.bg} ${chip.border} ${chip.color}`}
              >
                <span className="opacity-50 font-normal">{chip.label}:</span>
                {chip.value}
              </motion.span>
            ))}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">
            <span className="text-white/60">No explicit filters detected.</span> Showing AI-selected top matches across all {totalCount} advisors based on semantic similarity.
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-white/5 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-muted-foreground">
          {[
            { label: "Filterable fields", value: "13", icon: "⚙" },
            { label: "Dataset advisors", value: String(totalCount), icon: "👥" },
            { label: "Pre-filter matches", value: usedFallback ? "All" : String(filteredCount), icon: "🎯" },
            { label: "AI scored top", value: "8", icon: "✨" },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-2 bg-white/3 rounded-lg px-3 py-2">
              <span>{s.icon}</span>
              <div>
                <p className="text-white font-bold">{s.value}</p>
                <p className="text-[10px]">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

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

const SEGMENT_LABELS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  A: { label: "Top Tier",   color: "text-emerald-300", bg: "bg-emerald-500/10", border: "border-emerald-500/25" },
  B: { label: "High Value", color: "text-blue-300",    bg: "bg-blue-500/10",    border: "border-blue-500/25" },
  C: { label: "Mid-Market", color: "text-sky-300",     bg: "bg-sky-500/10",     border: "border-sky-500/25" },
  D: { label: "Developing", color: "text-amber-300",   bg: "bg-amber-500/10",   border: "border-amber-500/25" },
  E: { label: "Emerging",   color: "text-violet-300",  bg: "bg-violet-500/10",  border: "border-violet-500/25" },
};

function AumGauge({ aumM }: { aumM: number }) {
  const pct = Math.min((aumM / 100) * 100, 100);
  const r = 36; const circ = 2 * Math.PI * r;
  const dash = circ * (pct / 100);
  return (
    <div className="flex flex-col items-center">
      <svg width={88} height={88} viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(59,130,246,0.10)" strokeWidth="7"/>
        <circle cx="44" cy="44" r={r} fill="none" stroke="#3b82f6" strokeWidth="7"
          strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
          transform="rotate(-90 44 44)" style={{ filter: "drop-shadow(0 0 5px #3b82f688)" }}/>
        <text x="44" y="41" textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="13" fontWeight="700" fontFamily="system-ui">
          ${aumM.toFixed(0)}M
        </text>
        <text x="44" y="55" textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.4)" fontSize="8" fontFamily="system-ui">AUM</text>
      </svg>
    </div>
  );
}

function MiniBarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-white/10 rounded-lg p-2 text-[11px] shadow-xl">
      <p className="text-white font-semibold mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex gap-2">
          <span className="text-muted-foreground">{p.name}:</span>
          <span style={{ color: p.fill }} className="font-medium">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

function AdvisorExpandedView({ lead, advisor }: { lead: GeneratedLead; advisor: AdvisorData }) {
  const seg = SEGMENT_LABELS[advisor.segment] ?? SEGMENT_LABELS.C;
  const flowData = [{ name: "Flow", Sales: advisor.salesAmt, Redemption: advisor.redemption }];
  const oppData = [{ name: "Opportunity", "Fixed Income": advisor.fiOpportunities, "Active ETFs": advisor.etfOpportunities }];

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="overflow-hidden"
    >
      <div className="mt-4 pt-4 border-t border-white/8 space-y-5">
        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-background/40 rounded-xl p-3 border border-white/5 flex flex-col items-center">
            <AumGauge aumM={advisor.aumM} />
          </div>
          <div className="bg-background/40 rounded-xl p-3 border border-white/5 space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Alpha Generated</p>
            <p className="text-xl font-bold text-emerald-300">{fmt(advisor.alpha)}</p>
            <p className="text-[10px] text-muted-foreground">annual</p>
          </div>
          <div className="bg-background/40 rounded-xl p-3 border border-white/5 space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Segment</p>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${seg.bg} ${seg.border} ${seg.color}`}>
              {advisor.segment} · {seg.label}
            </span>
            <p className="text-[10px] text-muted-foreground mt-1">{advisor.buyingUnit}</p>
          </div>
          <div className="bg-background/40 rounded-xl p-3 border border-white/5 space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Territory</p>
            <p className="text-xs font-semibold text-white leading-tight">{advisor.territory}</p>
            {advisor.ratings && (
              <p className="text-[10px] text-amber-400 mt-1">★ {advisor.ratings}/10 rating</p>
            )}
          </div>
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-background/40 rounded-xl p-4 border border-white/5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">Sales vs Redemption</p>
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={flowData} layout="vertical" margin={{ left: 0, right: 8 }}>
                <XAxis type="number" hide tickFormatter={v => fmt(v)} />
                <YAxis type="category" dataKey="name" hide />
                <Tooltip content={<MiniBarTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="Sales" name="Sales" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                  <Cell fill="#3b82f6" />
                </Bar>
                <Bar dataKey="Redemption" name="Redemption" fill="#f59e0b" radius={[0, 4, 4, 0]}>
                  <Cell fill="#f59e0b" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-1">
              {[{ c: "#3b82f6", l: "Sales", v: fmt(advisor.salesAmt) }, { c: "#f59e0b", l: "Redemption", v: fmt(advisor.redemption) }].map(x => (
                <div key={x.l} className="flex items-center gap-1.5 text-[10px]">
                  <span className="w-2 h-2 rounded-sm" style={{ background: x.c }} />
                  <span className="text-muted-foreground">{x.l}:</span>
                  <span className="text-white font-medium">{x.v}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-background/40 rounded-xl p-4 border border-white/5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">Vanguard Opportunities</p>
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={oppData} layout="vertical" margin={{ left: 0, right: 8 }}>
                <XAxis type="number" hide tickFormatter={v => fmt(v)} />
                <YAxis type="category" dataKey="name" hide />
                <Tooltip content={<MiniBarTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="Fixed Income" name="Fixed Income" fill="#2dd4bf" radius={[0, 4, 4, 0]} />
                <Bar dataKey="Active ETFs" name="Active ETFs" fill="#a78bfa" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-1">
              {[{ c: "#2dd4bf", l: "FI", v: fmt(advisor.fiOpportunities) }, { c: "#a78bfa", l: "ETF", v: fmt(advisor.etfOpportunities) }].map(x => (
                <div key={x.l} className="flex items-center gap-1.5 text-[10px]">
                  <span className="w-2 h-2 rounded-sm" style={{ background: x.c }} />
                  <span className="text-muted-foreground">{x.l}:</span>
                  <span className="text-white font-medium">{x.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Competitors */}
        {advisor.competitors.length > 0 && (
          <div className="bg-background/40 rounded-xl p-4 border border-white/5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Competitor Products Held</p>
            <div className="flex flex-wrap gap-2">
              {advisor.competitors.map((c, i) => {
                const [brand, product] = c.split(":");
                return (
                  <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-red-500/8 border border-red-500/20 text-red-300">
                    <span className="opacity-60">{brand}:</span>{product}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Deep reasoning */}
        <div className="bg-primary/5 border border-primary/15 rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-wider text-primary font-semibold mb-2">AI Deep Analysis</p>
          <p className="text-sm text-white/80 leading-relaxed">{lead.reasoning}</p>
        </div>
      </div>
    </motion.div>
  );
}

const PROGRESS_STEPS = [
  { icon: Database,  label: "Connecting to advisor database",          detail: "Loading 200 advisor records from Vanguard CRM…",            ms: 600 },
  { icon: Brain,     label: "Parsing your query with AI",              detail: "Extracting intent, filters, and target criteria…",           ms: 900 },
  { icon: Filter,    label: "Applying segmentation & territory filters", detail: "Narrowing by firm, segment, county, and channel…",          ms: 700 },
  { icon: Network,   label: "Identifying matching advisors",            detail: "Cross-referencing buying units and competitor exposure…",     ms: 800 },
  { icon: BarChart3, label: "Scoring opportunities across 200 advisors", detail: "Calculating FI, ETF, and alpha opportunity for each match…", ms: 700 },
  { icon: Star,      label: "Running AI fit scoring",                   detail: "Ranking advisors by alignment with your search intent…",     ms: 600 },
  { icon: Sparkles,  label: "Finalizing your top matches",              detail: "Preparing advisor cards and AI analysis…",                   ms: 500 },
];

function GeneratingProgress({ step }: { step: number }) {
  const total = PROGRESS_STEPS.length;
  const pct = Math.min(Math.round((step / total) * 100), 98);

  return (
    <motion.div
      key="progress"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35 }}
    >
      <Card className="bg-card/40 border-primary/15 overflow-hidden">
        <CardContent className="p-6 space-y-5">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Generating your leads…</p>
              <p className="text-xs text-muted-foreground">AI is searching your advisor dataset</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-2xl font-bold text-primary">{pct}%</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">complete</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-primary via-blue-400 to-primary/70"
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>

          {/* Steps list */}
          <div className="space-y-2">
            {PROGRESS_STEPS.map((s, i) => {
              const done = i < step;
              const active = i === step;
              const pending = i > step;
              const Icon = s.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: pending ? 0.3 : 1, x: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.3 }}
                  className={`flex items-start gap-3 rounded-xl px-3 py-2.5 transition-all duration-300 ${
                    active  ? "bg-primary/8 border border-primary/20" :
                    done    ? "bg-white/[0.02]" : ""
                  }`}
                >
                  {/* Icon / status indicator */}
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    done   ? "bg-emerald-500/15 border border-emerald-500/25" :
                    active ? "bg-primary/15 border border-primary/30" :
                             "bg-white/4 border border-white/8"
                  }`}>
                    {done ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : active ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
                      >
                        <Loader2 className="w-3.5 h-3.5 text-primary" />
                      </motion.div>
                    ) : (
                      <Icon className="w-3.5 h-3.5 text-muted-foreground/40" />
                    )}
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold leading-tight ${
                      done ? "text-white/60" : active ? "text-white" : "text-muted-foreground/50"
                    }`}>
                      {s.label}
                    </p>
                    {active && (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-xs text-muted-foreground mt-0.5"
                      >
                        {s.detail}
                      </motion.p>
                    )}
                  </div>

                  {/* Done tick / timing */}
                  {done && (
                    <span className="text-[10px] text-emerald-500/60 font-medium shrink-0 mt-1">done</span>
                  )}
                  {active && (
                    <motion.span
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ repeat: Infinity, duration: 1.2 }}
                      className="text-[10px] text-primary/70 font-medium shrink-0 mt-1"
                    >
                      running…
                    </motion.span>
                  )}
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function LeadMe() {
  const [query, setQuery] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef("");
  const { mutate: generateLeads, isPending: isGenerating, data } = useAgentLeadMe();
  const { mutate: saveLead, isPending: isSaving } = useCreateLead();
  const { toast } = useToast();
  const [savedIndices, setSavedIndices] = useState<number[]>([]);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const [progressStep, setProgressStep] = useState(0);
  const progressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isGenerating) {
      setProgressStep(0);
      let step = 0;

      const advance = () => {
        step += 1;
        if (step < PROGRESS_STEPS.length) {
          setProgressStep(step);
          progressTimerRef.current = setTimeout(advance, PROGRESS_STEPS[step].ms);
        }
      };

      progressTimerRef.current = setTimeout(advance, PROGRESS_STEPS[0].ms);
    } else {
      if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
    }

    return () => {
      if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
    };
  }, [isGenerating]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSavedIndices([]);
    setExpandedIdx(null);
    generateLeads({ data: { query } });
  };

  const handleMicClick = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setIsRecording(false);
      return;
    }

    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast({ title: "Live transcription not supported", description: "Please type your query.", variant: "destructive" });
      return;
    }

    const rec = new SR() as SpeechRecognition;
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    finalTranscriptRef.current = "";

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscriptRef.current += t;
        } else {
          interim = t;
        }
      }
      setQuery(finalTranscriptRef.current + interim);
    };

    rec.onend = () => { setIsRecording(false); recognitionRef.current = null; };
    rec.onerror = () => { setIsRecording(false); recognitionRef.current = null; };

    rec.start();
    recognitionRef.current = rec;
    setIsRecording(true);
    setQuery("");
    finalTranscriptRef.current = "";
  };

  const handleSave = (lead: GeneratedLead, index: number) => {
    saveLead(
      { data: lead },
      {
        onSuccess: () => {
          setSavedIndices(prev => [...prev, index]);
          toast({ title: "Lead Saved", description: `${lead.name} has been added to your pipeline.` });
        }
      }
    );
  };

  const toggleExpand = (i: number) => setExpandedIdx(prev => prev === i ? null : i);

  return (
    <Layout>
      <div className="space-y-8 max-w-5xl mx-auto pb-12">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-blue-400/10 border border-blue-400/20 flex items-center justify-center">
            <Search className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-white">Lead Me</h1>
            <p className="text-muted-foreground">AI-powered advisor matching from your real dataset.</p>
          </div>
        </div>

        {/* Search Input */}
        <Card className="glass-card overflow-hidden border-primary/20">
          <CardContent className="p-2">
            <form onSubmit={handleSearch} className="flex relative items-center">
              <button
                type="button"
                onClick={handleMicClick}
                className={`absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 focus:outline-none ${
                  isRecording
                    ? "bg-red-500/20 border border-red-500/40 text-red-400"
                    : "bg-white/5 border border-white/10 text-muted-foreground hover:text-white hover:bg-white/10 hover:border-white/20"
                }`}
              >
                <AnimatePresence mode="wait">
                  {isRecording ? (
                    <motion.div key="rec" initial={{ scale: 0.7 }} animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 1, ease: "easeInOut" }}>
                      <MicOff className="w-4 h-4" />
                    </motion.div>
                  ) : (
                    <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <Mic className="w-4 h-4" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>

              <Input
                value={query}
                onChange={e => !isRecording && setQuery(e.target.value)}
                placeholder={isRecording ? "Listening… speak now — words appear as you talk" : "Tap mic or type — e.g. Edward Jones advisors in Cook County with high FI opportunity…"}
                className="w-full pl-16 pr-36 h-16 text-lg bg-transparent border-0 focus-visible:ring-0 text-white placeholder:text-muted-foreground/60"
              />

              {isRecording && (
                <span className="absolute left-16 top-1/2 -translate-y-1/2 pointer-events-none text-lg text-white">
                  {query}
                  <motion.span className="inline-block w-0.5 h-5 bg-red-400 ml-0.5 align-middle"
                    animate={{ opacity: [1, 0] }} transition={{ repeat: Infinity, duration: 0.5, ease: "steps(1)" }} />
                </span>
              )}

              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <Button type="submit" disabled={isGenerating || !query.trim() || isRecording}
                  className="h-12 px-6 rounded-xl font-semibold shadow-lg shadow-primary/25">
                  {isGenerating ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Search className="w-5 h-5 mr-2" />}
                  Generate
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Recording status */}
        <AnimatePresence>
          {isRecording && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border"
              style={{ borderColor: "rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.05)" }}>
              <div className="flex gap-1 items-center">
                {[0,1,2,3].map(i => (
                  <motion.div key={i} className="w-1 rounded-full bg-red-400"
                    animate={{ height: ["8px","20px","8px"] }}
                    transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15, ease: "easeInOut" }} />
                ))}
              </div>
              <span className="text-sm font-medium text-red-400">Live transcription active — tap the mic again to stop</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results / Progress */}
        <AnimatePresence mode="wait">
          {isGenerating ? (
            <GeneratingProgress key="generating" step={progressStep} />
          ) : null}
          {!isGenerating && data?.leads && data.leads.length > 0 && (
            <motion.div key="results" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

              {/* Query Intelligence Panel */}
              {(data as any).parsedFilters && (
                <QueryIntelligencePanel
                  parsedFilters={(data as any).parsedFilters as ParsedFilters}
                  filteredCount={(data as any).filteredCount as number ?? data.leads.length}
                  totalCount={(data as any).totalCount as number ?? 200}
                  usedFallback={(data as any).usedFallback as boolean ?? false}
                />
              )}

              <div className="flex items-center justify-between pl-1">
                <h3 className="text-xl font-display font-semibold text-white">
                  Matched Advisors <span className="text-muted-foreground font-normal text-base">({data.leads.length})</span>
                </h3>
                <p className="text-xs text-muted-foreground">Click a card to view advisor profile</p>
              </div>

              <div className="grid gap-3">
                {data.leads.map((lead, i) => {
                  const advisor = parseAdvisorData(lead.assets ?? "");
                  const isSaved = savedIndices.includes(i);
                  const isExpanded = expandedIdx === i;
                  const seg = advisor ? (SEGMENT_LABELS[advisor.segment] ?? SEGMENT_LABELS.C) : null;

                  return (
                    <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}>
                      <Card className={`bg-card/40 border-white/5 transition-all duration-200 ${isExpanded ? "border-primary/25 shadow-lg shadow-primary/5" : "hover:border-white/12"}`}>
                        <CardContent className="p-5">
                          {/* Card header — always visible, clickable */}
                          <button
                            type="button"
                            onClick={() => toggleExpand(i)}
                            className="w-full text-left"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2.5 mb-2">
                                  <h4 className="text-lg font-bold text-white">{lead.name}</h4>
                                  {seg && (
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${seg.bg} ${seg.border} ${seg.color}`}>
                                      {advisor!.segment} · {seg.label}
                                    </span>
                                  )}
                                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 px-2.5 py-0.5 text-xs">
                                    {lead.score}/100
                                  </Badge>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                                  <span className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-md">
                                    <Building2 className="w-3.5 h-3.5" /> {lead.company}
                                  </span>
                                  {advisor && (
                                    <span className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-md text-emerald-400/80">
                                      <TrendingUp className="w-3.5 h-3.5" /> ${advisor.aumM.toFixed(1)}M AUM
                                    </span>
                                  )}
                                  {lead.location && (
                                    <span className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-md">
                                      <MapPin className="w-3.5 h-3.5" /> {lead.location}
                                    </span>
                                  )}
                                  {advisor && (
                                    <span className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-md text-cyan-400/80">
                                      <Zap className="w-3.5 h-3.5" /> {fmt(advisor.fiOpportunities + advisor.etfOpportunities)} total opp.
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-white/70 mt-2.5 leading-relaxed line-clamp-2">{lead.reason}</p>
                              </div>
                              <div className="shrink-0 self-center text-muted-foreground">
                                {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                              </div>
                            </div>
                          </button>

                          {/* Expanded advisor profile */}
                          <AnimatePresence>
                            {isExpanded && advisor && (
                              <AdvisorExpandedView lead={lead} advisor={advisor} />
                            )}
                          </AnimatePresence>

                          {/* Actions row */}
                          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-white/5">
                            <Button
                              onClick={() => handleSave(lead, i)}
                              disabled={isSaved || isSaving}
                              variant={isSaved ? "secondary" : "default"}
                              size="sm"
                              className={`h-9 px-4 ${isSaved ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/15 hover:text-emerald-300" : ""}`}
                            >
                              {isSaved ? <><Check className="w-3.5 h-3.5 mr-1.5" />Saved</> : <><Save className="w-3.5 h-3.5 mr-1.5" />Save Lead</>}
                            </Button>
                            {!isExpanded && (
                              <Button variant="ghost" size="sm" onClick={() => toggleExpand(i)}
                                className="h-9 px-4 text-muted-foreground hover:text-white text-xs">
                                <Users className="w-3.5 h-3.5 mr-1.5" /> View Profile
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Next step CTA */}
        <AnimatePresence>
          {savedIndices.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-4"
            >
              <div className="flex items-center justify-between gap-4 bg-card/90 backdrop-blur-xl border border-cyan-400/30 rounded-2xl p-4 shadow-2xl shadow-cyan-500/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center shrink-0">
                    <Calendar className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Next Step</p>
                    <p className="text-sm font-semibold text-white">Schedule outreach with your saved advisors</p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button asChild variant="ghost" size="sm" className="text-white/60 hover:text-white">
                    <Link href="/leads"><ExternalLink className="w-4 h-4 mr-1" />Pipeline</Link>
                  </Button>
                  <Button asChild className="bg-cyan-500 hover:bg-cyan-400 text-white shadow-lg shadow-cyan-500/25">
                    <Link href="/leads">Proceed <ArrowRight className="w-4 h-4 ml-1.5" /></Link>
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </Layout>
  );
}
