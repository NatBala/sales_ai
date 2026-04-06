import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";
import { GraduationCap, Heart, Baby, Briefcase, TrendingUp, CheckCircle2, Circle, XCircle } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Education { school: string; degree: string; year: string; }
interface Child { name: string; age: number; }
interface Personal {
  yearsInBusiness: number;
  certifications: string[];
  education: Education[];
  interests: string[];
  family: {
    spouse?: { name: string; profession: string } | null;
    children?: Child[];
  };
}

interface AllocationSlice { category: string; pct: number; }
interface InvestmentStrategy {
  aum: string;
  style: string;
  clientProfile: string;
  avgAccountSize: string;
  allocation: AllocationSlice[];
  primaryConcerns: string[];
}

interface MeetingEntry {
  date: string;
  title: string;
  summary: string;
  outcome: string;
  sentiment: "positive" | "neutral" | "negative";
}

export interface AdvisorProfile {
  personal: Personal;
  investmentStrategy: InvestmentStrategy;
  meetingHistory: MeetingEntry[];
}

// ─── Palette for pie segments ─────────────────────────────────────────────────
const SLICE_COLORS = ["#6366f1", "#0ea5e9", "#22c55e", "#f59e0b", "#64748b"];

// ─── Family & Background Card ─────────────────────────────────────────────────
export function FamilyCard({ personal, leadName }: { personal: Personal; leadName: string }) {
  const initials = leadName.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase();
  const { spouse, children = [] } = personal.family ?? {};

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      className="bg-card/40 border border-white/5 rounded-2xl overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-white/5 bg-background/20 flex items-center gap-2">
        <Heart className="w-4 h-4 text-rose-400" />
        <h3 className="text-sm font-semibold text-white">Personal & Family</h3>
      </div>

      <div className="p-5 space-y-5">
        {/* Rep avatar + certs */}
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/30 to-blue-500/30 border border-indigo-500/20 flex items-center justify-center text-lg font-bold text-white shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-white text-base leading-tight">{leadName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{personal.yearsInBusiness} years in business</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {personal.certifications.map(cert => (
                <span key={cert} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/20">
                  {cert}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Education */}
        {personal.education.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5" /> Education
            </p>
            {personal.education.map((edu, i) => (
              <div key={i} className="bg-background/40 rounded-xl px-3 py-2 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">{edu.school}</p>
                  <p className="text-xs text-muted-foreground">{edu.degree}</p>
                </div>
                <span className="text-xs text-indigo-400 font-semibold">{edu.year}</span>
              </div>
            ))}
          </div>
        )}

        {/* Family */}
        {(spouse || children.length > 0) && (
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5" /> Family
            </p>
            <div className="bg-background/40 rounded-xl p-3 space-y-2.5">
              {spouse && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-rose-500/20 border border-rose-500/20 flex items-center justify-center text-xs font-bold text-rose-300 shrink-0">
                    {spouse.name[0]}
                  </div>
                  <div>
                    <p className="text-sm text-white font-medium">{spouse.name}</p>
                    <p className="text-xs text-muted-foreground">{spouse.profession}</p>
                  </div>
                  <span className="ml-auto text-xs text-rose-400/70">Spouse</span>
                </div>
              )}
              {children.map((child, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-500/15 border border-amber-500/20 flex items-center justify-center shrink-0">
                    <Baby className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm text-white font-medium">{child.name}</p>
                    <p className="text-xs text-muted-foreground">Age {child.age}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Interests */}
        {personal.interests.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5" /> Interests
            </p>
            <div className="flex flex-wrap gap-1.5">
              {personal.interests.map(interest => (
                <span key={interest} className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/70">
                  {interest}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Investment Strategy Pie Card ─────────────────────────────────────────────
const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border border-white/10 rounded-xl px-3 py-2 shadow-xl text-xs">
      <p className="font-semibold text-white">{payload[0].name}</p>
      <p className="text-indigo-400 font-bold">{payload[0].value}%</p>
    </div>
  );
};

export function InvestmentStrategyCard({ strategy }: { strategy: InvestmentStrategy }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="bg-card/40 border border-white/5 rounded-2xl overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-white/5 bg-background/20 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-emerald-400" />
        <h3 className="text-sm font-semibold text-white">Investment Strategy</h3>
      </div>

      <div className="p-5 space-y-4">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "AUM", value: strategy.aum },
            { label: "Avg Account", value: strategy.avgAccountSize },
            { label: "Style", value: strategy.style },
          ].map(stat => (
            <div key={stat.label} className="bg-background/40 rounded-xl p-2.5 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
              <p className="text-sm font-bold text-white mt-0.5 leading-tight">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Donut chart + legend */}
        <div className="flex items-center gap-4">
          <div className="relative w-36 h-36 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={strategy.allocation}
                  cx="50%"
                  cy="50%"
                  innerRadius={38}
                  outerRadius={58}
                  paddingAngle={2}
                  dataKey="pct"
                  nameKey="category"
                  strokeWidth={0}
                >
                  {strategy.allocation.map((_, i) => (
                    <Cell key={i} fill={SLICE_COLORS[i % SLICE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Center label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-[10px] text-muted-foreground">Portfolio</p>
              <p className="text-sm font-bold text-white">Mix</p>
            </div>
          </div>

          <div className="flex-1 space-y-1.5 min-w-0">
            {strategy.allocation.map((slice, i) => (
              <div key={slice.category} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: SLICE_COLORS[i % SLICE_COLORS.length] }} />
                <span className="text-xs text-white/75 flex-1 truncate">{slice.category}</span>
                <span className="text-xs font-bold text-white shrink-0">{slice.pct}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Client profile */}
        <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl px-3 py-2.5">
          <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1">Client Profile</p>
          <p className="text-xs text-white/75 leading-relaxed">{strategy.clientProfile}</p>
        </div>

        {/* Primary concerns */}
        {strategy.primaryConcerns?.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Key Priorities</p>
            <div className="space-y-1.5">
              {strategy.primaryConcerns.map((concern, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-white/70">
                  <span className="text-emerald-400 shrink-0 mt-0.5">→</span>{concern}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Meeting Timeline Card ────────────────────────────────────────────────────
function sentimentIcon(s: MeetingEntry["sentiment"]) {
  if (s === "positive") return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
  if (s === "negative") return <XCircle className="w-4 h-4 text-rose-400" />;
  return <Circle className="w-4 h-4 text-amber-400" />;
}
function sentimentDot(s: MeetingEntry["sentiment"]) {
  const map = { positive: "bg-emerald-400", negative: "bg-rose-400", neutral: "bg-amber-400" };
  return map[s];
}
function sentimentBadge(s: MeetingEntry["sentiment"]) {
  const map = {
    positive: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    negative: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    neutral: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  };
  return map[s];
}

function groupByQuarter(entries: MeetingEntry[]) {
  const groups: Record<string, MeetingEntry[]> = {};
  for (const e of entries) {
    const d = parseISO(e.date);
    if (!isValid(d)) continue;
    const q = `Q${Math.ceil((d.getMonth() + 1) / 3)} ${d.getFullYear()}`;
    if (!groups[q]) groups[q] = [];
    groups[q].push(e);
  }
  return Object.entries(groups);
}

export function MeetingTimelineCard({ history }: { history: MeetingEntry[] }) {
  const grouped = groupByQuarter(history);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="bg-card/40 border border-white/5 rounded-2xl overflow-hidden md:col-span-2"
    >
      <div className="px-5 py-4 border-b border-white/5 bg-background/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-violet-400" />
          <h3 className="text-sm font-semibold text-white">Meeting History</h3>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />Positive</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />Neutral</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400 inline-block" />Negative</span>
        </div>
      </div>

      <div className="p-5">
        {grouped.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-6">No meeting history available.</p>
        ) : (
          <div className="space-y-6">
            {grouped.map(([quarter, entries]) => (
              <div key={quarter}>
                {/* Quarter divider */}
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-[10px] font-bold text-violet-400 uppercase tracking-wider whitespace-nowrap">{quarter}</span>
                  <div className="flex-1 h-px bg-white/5" />
                </div>

                {/* Entries */}
                <div className="relative pl-5 space-y-4">
                  {/* Vertical line */}
                  <div className="absolute left-[7px] top-2 bottom-2 w-px bg-white/8" />

                  {entries.map((entry, i) => {
                    const d = parseISO(entry.date);
                    return (
                      <div key={i} className="relative flex gap-4">
                        {/* Dot */}
                        <div className={`absolute left-[-13px] top-2 w-3.5 h-3.5 rounded-full border-2 border-background ${sentimentDot(entry.sentiment)} shrink-0`} />

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="text-sm font-semibold text-white leading-tight">{entry.title}</p>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize ${sentimentBadge(entry.sentiment)}`}>
                                {entry.sentiment}
                              </span>
                              {sentimentIcon(entry.sentiment)}
                            </div>
                          </div>
                          <p className="text-[10px] text-muted-foreground mb-1.5 font-medium">
                            {isValid(d) ? format(d, "MMMM d, yyyy") : entry.date}
                          </p>
                          <p className="text-xs text-white/65 leading-relaxed mb-2">{entry.summary}</p>
                          <div className="bg-background/40 rounded-lg px-3 py-1.5 inline-block">
                            <p className="text-[10px] text-muted-foreground">Outcome</p>
                            <p className="text-xs text-white/80">{entry.outcome}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────
export function AdvisorIntelSkeleton() {
  return (
    <div className="grid md:grid-cols-2 gap-5 animate-pulse">
      {[1, 2].map(i => (
        <div key={i} className="bg-card/40 border border-white/5 rounded-2xl h-64" />
      ))}
      <div className="bg-card/40 border border-white/5 rounded-2xl h-72 md:col-span-2" />
    </div>
  );
}
