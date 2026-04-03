import { useMemo } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Activity, CheckCircle2, RotateCcw, TriangleAlert } from "lucide-react";
import type { CoachScenario } from "@/components/coach-practice";

interface StageFeedback {
  stage: "Agenda" | "Discovery" | "Insights" | "Practice Management" | "Summarize & Prioritize" | "Close";
  score: number;
  assessment: string;
  evidence: string;
  improvementExample: string;
}

interface StrengthItem {
  title: string;
  whyItWorked: string;
  evidence: string;
}

interface MissItem {
  title: string;
  whyItMattered: string;
  evidence: string;
  fix: string;
}

interface RewriteItem {
  moment: string;
  issue: string;
  betterExample: string;
}

export interface ScorecardData {
  overallAssessment: string;
  finalScore: number;
  coachVerdict: string;
  coachModeSummary: string;
  topPriorityFix: string;
  cgWayScores: {
    agenda: number;
    discovery: number;
    insights: number;
    practiceManagement: number;
    summarizePrioritize: number;
    close: number;
  };
  stageFeedback: StageFeedback[];
  strengths: StrengthItem[];
  misses: MissItem[];
  rewriteExamples: RewriteItem[];
  missedDiscoveryQuestions: string[];
  nextRepPlan: string[];
}

interface Props {
  scorecard: ScorecardData;
  scenario: CoachScenario;
  meeting: { leadName: string; leadCompany: string; purpose: string };
  onRetry: () => void;
}

function scoreColor(score: number) {
  if (score >= 80) return "text-emerald-300";
  if (score >= 65) return "text-sky-300";
  if (score >= 50) return "text-amber-300";
  return "text-rose-300";
}

function scoreRingColor(score: number) {
  if (score >= 80) return "#34d399";
  if (score >= 65) return "#38bdf8";
  if (score >= 50) return "#fbbf24";
  return "#fb7185";
}

function compactStageScores(scores: ScorecardData["cgWayScores"]) {
  return [
    { key: "Agenda", score: scores.agenda },
    { key: "Discovery", score: scores.discovery },
    { key: "Insights", score: scores.insights },
    { key: "Practice Mgmt", score: scores.practiceManagement },
    { key: "Summ/Prioritize", score: scores.summarizePrioritize },
    { key: "Close", score: scores.close },
  ];
}

function ScoreRing({ score }: { score: number }) {
  const r = 48;
  const circ = 2 * Math.PI * r;
  const fill = circ * (score / 100);
  const color = scoreRingColor(score);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg width="130" height="130" viewBox="0 0 110 110">
        <circle cx="55" cy="55" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="10" />
        <motion.circle
          cx="55"
          cy="55"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
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
    </div>
  );
}

export function CoachScorecard({ scorecard, scenario, meeting, onRetry }: Props) {
  const initials = useMemo(
    () => scenario.visiblePersona.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase(),
    [scenario.visiblePersona.name],
  );
  const stageScores = compactStageScores(scorecard.cgWayScores);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-6 pb-12"
    >
      <div className="overflow-hidden rounded-3xl border border-white/8 p-6 md:p-8" style={{ background: "linear-gradient(135deg, hsl(207,60%,14%), hsl(216,62%,9%))" }}>
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-blue-300/60">Digital Sales Coach Report</p>
            <h1 className="text-2xl font-bold text-white">{meeting.purpose}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/70">{scorecard.overallAssessment}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={onRetry}
                className="flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/14"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Practice Again
              </button>
              <Button asChild size="sm" className="rounded-full bg-violet-600 text-white hover:bg-violet-500">
                <Link href="/engage-me">
                  <Activity className="mr-1.5 h-3.5 w-3.5" /> Enter Meeting
                </Link>
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <ScoreRing score={scorecard.finalScore} />
            <div className="w-52 rounded-2xl border border-white/10 bg-white/7 p-4">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-500/40 to-blue-500/40 text-base font-bold text-white">
                {initials}
              </div>
              <p className="text-center text-sm font-bold text-white">{scenario.visiblePersona.name}</p>
              <p className="mt-0.5 text-center text-xs text-white/55">{scenario.visiblePersona.personaType}</p>
              <p className="text-center text-xs text-white/45">{scenario.visiblePersona.firm}</p>
              <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-center text-xs font-semibold text-amber-100">
                {scorecard.coachVerdict}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-blue-300/70">Coach Summary</p>
            <p className="text-sm leading-relaxed text-white/80">{scorecard.coachModeSummary}</p>
          </div>
          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-amber-300/80">Top Priority Fix</p>
            <p className="text-sm leading-relaxed text-amber-50">{scorecard.topPriorityFix}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/8 bg-card/40 p-5">
            <p className="mb-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">VG Way Scores</p>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {stageScores.map((stage) => (
                <div key={stage.key} className="rounded-xl border border-white/6 bg-background/40 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{stage.key}</p>
                  <p className="mt-1 text-2xl font-bold text-white">
                    {stage.score}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">/5</span>
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/8 bg-card/40 p-5">
            <p className="mb-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Stage Breakdown</p>
            <div className="space-y-3">
              {scorecard.stageFeedback.map((stage) => (
                <div key={stage.stage} className="rounded-xl border border-white/6 bg-background/35 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">{stage.stage}</p>
                    <span className="rounded-full border border-white/8 bg-white/5 px-2.5 py-1 text-xs font-semibold text-white/80">
                      {stage.score}/5
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-white/75">{stage.assessment}</p>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <div className="rounded-lg border border-white/6 bg-black/15 p-3">
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Evidence</p>
                      <p className="text-xs leading-relaxed text-white/65">{stage.evidence}</p>
                    </div>
                    <div className="rounded-lg border border-sky-400/15 bg-sky-400/5 p-3">
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-sky-300/70">Better Example</p>
                      <p className="text-xs leading-relaxed text-sky-50">{stage.improvementExample}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/5 p-5">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-emerald-300/80">Strengths</p>
            <div className="space-y-3">
              {scorecard.strengths.map((item) => (
                <div key={item.title} className="rounded-xl border border-emerald-400/10 bg-black/10 p-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                    <div>
                      <p className="text-sm font-semibold text-white">{item.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-white/70">{item.whyItWorked}</p>
                      <p className="mt-2 text-xs leading-relaxed text-emerald-100/85">{item.evidence}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-rose-500/15 bg-rose-500/5 p-5">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-rose-300/80">Misses</p>
            <div className="space-y-3">
              {scorecard.misses.map((item) => (
                <div key={item.title} className="rounded-xl border border-rose-400/10 bg-black/10 p-3">
                  <div className="flex items-start gap-2">
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
                    <div>
                      <p className="text-sm font-semibold text-white">{item.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-white/70">{item.whyItMattered}</p>
                      <p className="mt-2 text-xs leading-relaxed text-white/60">{item.evidence}</p>
                      <p className="mt-2 text-xs leading-relaxed text-rose-100">{item.fix}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/8 bg-card/40 p-5">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Rewrites</p>
            <div className="space-y-3">
              {scorecard.rewriteExamples.map((item) => (
                <div key={item.moment} className="rounded-xl border border-white/6 bg-background/35 p-3">
                  <p className="text-sm font-semibold text-white">{item.moment}</p>
                  <p className="mt-1 text-xs leading-relaxed text-white/65">{item.issue}</p>
                  <p className="mt-2 text-xs leading-relaxed text-sky-100">{item.betterExample}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/8 bg-card/40 p-5">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Next Rep Plan</p>
            <div className="space-y-2">
              {scorecard.nextRepPlan.map((item, index) => (
                <div key={index} className="text-sm leading-relaxed text-white/80">{item}</div>
              ))}
            </div>
            <div className="mt-4 border-t border-white/6 pt-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Missed Discovery Questions</p>
              <div className="space-y-2">
                {scorecard.missedDiscoveryQuestions.map((item, index) => (
                  <div key={index} className="text-sm leading-relaxed text-white/70">{item}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
