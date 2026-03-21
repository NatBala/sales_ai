import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { RotateCcw, Activity, CheckCircle2, AlertCircle } from "lucide-react";
import type { AdvisorPersona } from "@/components/coach-practice";

interface StageScore {
  name: string;
  score: number;
  assessment: string;
  evidence: string;
  betterExample: string;
}

interface FocusArea {
  rank: number;
  title: string;
  issue: string;
  youSaid: string;
  betterExample: string;
}

export interface ScorecardData {
  overallScore: number;
  overallVerdict: string;
  summary: string;
  topPriorityFix: string;
  stages: StageScore[];
  focusAreas: FocusArea[];
  strengths: string[];
}

interface Props {
  scorecard: ScorecardData;
  persona: AdvisorPersona;
  meeting: { leadName: string; leadCompany: string; purpose: string };
  onRetry: () => void;
}

function scoreColor(pct: number) {
  if (pct >= 80) return "#22c55e";
  if (pct >= 60) return "#3b82f6";
  if (pct >= 40) return "#f59e0b";
  return "#ef4444";
}

function ScoreRing({ score }: { score: number }) {
  const r = 48;
  const circ = 2 * Math.PI * r;
  const fill = circ * (score / 100);
  const color = scoreColor(score);
  const label = score >= 75 ? "Excellent" : score >= 55 ? "Good" : score >= 35 ? "Needs Work" : "Below Standard";

  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg width="130" height="130" viewBox="0 0 110 110">
        <circle cx="55" cy="55" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="10" />
        <motion.circle
          cx="55" cy="55" r={r} fill="none"
          stroke={color} strokeWidth="10"
          strokeDasharray={`${fill} ${circ - fill}`}
          strokeLinecap="round"
          transform="rotate(-90 55 55)"
          initial={{ strokeDasharray: `0 ${circ}` }}
          animate={{ strokeDasharray: `${fill} ${circ - fill}` }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          style={{ filter: `drop-shadow(0 0 10px ${color}55)` }}
        />
        <text x="55" y="50" textAnchor="middle" fill="white" fontSize="26" fontWeight="800" fontFamily="system-ui">{score}</text>
        <text x="55" y="64" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="9" fontFamily="system-ui">/ 100</text>
      </svg>
      <span className="text-sm font-bold" style={{ color }}>{label}</span>
    </div>
  );
}

function StageProgressBar({ score, delay }: { score: number; delay: number }) {
  const pct = (score / 5) * 100;
  const color = scoreColor(pct);
  return (
    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mt-2">
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.7, delay, ease: "easeOut" }}
      />
    </div>
  );
}

export function CoachScorecard({ scorecard, persona, meeting, onRetry }: Props) {
  const initials = persona.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6 pb-12"
    >
      {/* ── Hero ── */}
      <div className="relative rounded-3xl overflow-hidden border border-white/8 p-6 md:p-8" style={{ background: "linear-gradient(135deg, hsl(207,60%,14%), hsl(216,62%,9%))" }}>
        <div className="absolute inset-0 bg-gradient-to-tr from-violet-600/10 to-blue-500/10 pointer-events-none" />

        <div className="relative z-10">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-300/60 mb-5">Digital Sales Coach Report</p>

          <div className="flex flex-col lg:flex-row gap-8 items-start">
            {/* Left: title + summary */}
            <div className="flex-1 min-w-0">
              <h1 className="text-xl md:text-2xl font-bold text-white mb-2 leading-snug">{meeting.purpose}</h1>
              <p className="text-white/65 text-sm leading-relaxed max-w-2xl mb-5">{scorecard.summary}</p>
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={onRetry}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/8 border border-white/12 text-white text-sm font-semibold hover:bg-white/14 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Practice Again
                </button>
                <Button asChild size="sm" className="rounded-full bg-violet-600 hover:bg-violet-500 text-white">
                  <Link href="/engage-me">
                    <Activity className="w-3.5 h-3.5 mr-1.5" /> Enter Meeting
                  </Link>
                </Button>
              </div>
            </div>

            {/* Right: score ring + advisor card */}
            <div className="flex gap-5 items-center shrink-0">
              <ScoreRing score={scorecard.overallScore} />
              <div className="bg-white/7 border border-white/10 rounded-2xl p-4 w-48 backdrop-blur-sm">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/40 to-blue-500/40 border border-violet-500/20 flex items-center justify-center text-base font-bold text-white mb-3 mx-auto">
                  {initials}
                </div>
                <p className="text-white font-bold text-sm text-center">{persona.name}</p>
                <p className="text-white/50 text-xs text-center mt-0.5 truncate">{persona.role}</p>
                <p className="text-white/50 text-xs text-center truncate">{persona.company}</p>
                <div className="mt-3 grid grid-cols-2 gap-1.5 text-xs">
                  <div className="bg-white/5 rounded-lg p-1.5">
                    <p className="text-white/35 text-[9px]">Firm</p>
                    <p className="text-white font-medium truncate text-[10px]">{persona.firmType}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-1.5">
                    <p className="text-white/35 text-[9px]">AUM</p>
                    <p className="text-white font-medium text-[10px]">{persona.aumRange}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Top Priority Fix */}
          <div className="mt-6 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400 mb-1">Top Priority Fix</p>
            <p className="text-white/75 text-sm leading-relaxed">{scorecard.topPriorityFix}</p>
          </div>
        </div>
      </div>

      {/* ── Stage Score Mini-Grid ── */}
      <div className="bg-card/40 border border-white/8 rounded-2xl p-5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-4">VG Way Section Scores</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {scorecard.stages.map((stage, i) => {
            const pct = (stage.score / 5) * 100;
            const color = scoreColor(pct);
            return (
              <div key={i} className="bg-background/40 rounded-xl p-3.5 border border-white/5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{stage.name}</p>
                <p className="text-2xl font-bold text-white mt-1.5" style={{ color }}>
                  {stage.score}<span className="text-xs font-normal text-muted-foreground">/5</span>
                </p>
                <StageProgressBar score={stage.score} delay={i * 0.1} />
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Stage Breakdown + Focus Areas: 2-col ── */}
      <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-6">
        {/* Stage Detail Cards */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Stage Breakdown</h3>
          {scorecard.stages.map((stage, i) => {
            const pct = (stage.score / 5) * 100;
            const color = scoreColor(pct);
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.06 }}
                className="bg-card/40 border border-white/8 rounded-2xl p-5"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">VG Way Section</p>
                    <h4 className="text-white font-bold mt-0.5">{stage.name}</h4>
                  </div>
                  <span className="text-base font-bold px-3 py-1 rounded-full bg-white/5 border border-white/8 shrink-0" style={{ color }}>
                    {stage.score}/5
                  </span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mb-4">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.7, delay: 0.2 + i * 0.08, ease: "easeOut" }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-background/40 rounded-xl p-3 border border-white/5">
                    <p className="text-muted-foreground font-semibold uppercase tracking-wide text-[9px] mb-1.5">Assessment</p>
                    <p className="text-white/65 leading-relaxed">{stage.assessment}</p>
                  </div>
                  <div className="bg-background/40 rounded-xl p-3 border border-white/5">
                    <p className="text-muted-foreground font-semibold uppercase tracking-wide text-[9px] mb-1.5">Evidence</p>
                    <p className="text-white/65 leading-relaxed">{stage.evidence}</p>
                  </div>
                  <div className="bg-blue-500/5 rounded-xl p-3 border border-blue-500/15">
                    <p className="text-blue-400 font-semibold uppercase tracking-wide text-[9px] mb-1.5">Better Example</p>
                    <p className="text-white/65 leading-relaxed">{stage.betterExample}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Right: Focus Areas + Strengths */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Top Improvement Priorities</h3>

          {scorecard.focusAreas.map((area, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.08 }}
              className="bg-card/40 border border-white/8 rounded-2xl p-5"
            >
              <div className="flex gap-4 mb-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-blue-500/20 flex items-center justify-center font-bold text-blue-300 text-sm shrink-0">
                  {String(area.rank).padStart(2, "0")}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-white font-bold text-sm">{area.title}</h4>
                  <p className="text-white/55 text-xs mt-1 leading-relaxed">{area.issue}</p>
                </div>
              </div>
              {(area.youSaid || area.betterExample) && (
                <div className="space-y-2 mt-3">
                  {area.youSaid && (
                    <div className="bg-red-500/5 border border-red-500/15 rounded-xl p-3 text-xs">
                      <div className="flex items-center gap-1.5 text-red-400 font-bold uppercase tracking-wide text-[9px] mb-1">
                        <AlertCircle className="w-3 h-3" /> You Said
                      </div>
                      <p className="text-white/60 leading-relaxed italic">"{area.youSaid}"</p>
                    </div>
                  )}
                  {area.betterExample && (
                    <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-3 text-xs">
                      <div className="flex items-center gap-1.5 text-emerald-400 font-bold uppercase tracking-wide text-[9px] mb-1">
                        <CheckCircle2 className="w-3 h-3" /> Better Example
                      </div>
                      <p className="text-white/60 leading-relaxed">"{area.betterExample}"</p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ))}

          {/* Strengths */}
          {scorecard.strengths?.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-emerald-500/5 border border-emerald-500/15 rounded-2xl p-5"
            >
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-3">What Worked</h3>
              <ul className="space-y-2">
                {scorecard.strengths.map((s, i) => (
                  <li key={i} className="flex gap-2 text-xs text-white/65 leading-relaxed">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    {s}
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
