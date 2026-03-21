import { useState, useMemo } from "react";
import { Layout } from "@/components/layout";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, Target, Award, Sparkles, ChevronDown, Plane, Users, Coffee, BarChart2, Phone, FileText, Mail, CalendarCheck
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts";
import { useMeetings } from "@/hooks/use-meetings";

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
      <text x="60" y="55" textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="20" fontWeight="700" fontFamily="system-ui">
        {pct}%
      </text>
      <text x="60" y="75" textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.45)" fontSize="10" fontFamily="system-ui">
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

const HOUR_H = 56;
const START_H = 8;
const END_H = 21;
const HOURS = Array.from({ length: END_H - START_H }, (_, i) => START_H + i);

const DAYS = [
  { label: "Mon", date: "Mar 23", short: "23" },
  { label: "Tue", date: "Mar 24", short: "24" },
  { label: "Wed", date: "Mar 25", short: "25", highlight: true },
  { label: "Thu", date: "Mar 26", short: "26" },
  { label: "Fri", date: "Mar 27", short: "27" },
];

type EventColor = "sky" | "blue" | "violet" | "cyan" | "muted" | "amber" | "emerald";

const EVENT_COLORS: Record<EventColor, { bg: string; border: string; text: string; bar: string }> = {
  sky:     { bg: "bg-sky-500/10",     border: "border-sky-500/20",     text: "text-sky-300",     bar: "bg-sky-400" },
  blue:    { bg: "bg-blue-500/10",    border: "border-blue-500/20",    text: "text-blue-300",    bar: "bg-blue-400" },
  violet:  { bg: "bg-violet-500/10",  border: "border-violet-500/20",  text: "text-violet-300",  bar: "bg-violet-400" },
  cyan:    { bg: "bg-cyan-500/10",    border: "border-cyan-500/20",    text: "text-cyan-300",    bar: "bg-cyan-400" },
  muted:   { bg: "bg-white/[0.04]",   border: "border-white/8",        text: "text-white/50",    bar: "bg-white/25" },
  amber:   { bg: "bg-amber-500/10",   border: "border-amber-500/25",   text: "text-amber-300",   bar: "bg-amber-400" },
  emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/25", text: "text-emerald-300", bar: "bg-emerald-400" },
};

interface CalEvent { day: number; title: string; detail: string; start: number; end: number; color: EventColor; Icon?: React.ElementType; }

const EVENTS: CalEvent[] = [
  { day: 0, title: "Team Standup",           detail: "All-hands sync",         start: 9,    end: 9.5,  color: "sky",    Icon: Users },
  { day: 0, title: "Pacific Wealth",         detail: "Client call",            start: 10.5, end: 11.5, color: "blue",   Icon: Phone },
  { day: 0, title: "Cornerstone Pitch Prep", detail: "Strategy & deck review", start: 13,   end: 14,   color: "violet", Icon: FileText },
  { day: 0, title: "CRM & Pipeline",         detail: "Admin review",           start: 15,   end: 16,   color: "muted",  Icon: BarChart2 },
  { day: 0, title: "Prospecting Block",      detail: "Outbound calls",         start: 16.5, end: 17.5, color: "cyan",   Icon: Phone },

  { day: 1, title: "Morning Standup",        detail: "Team sync",              start: 9,    end: 9.5,  color: "sky",    Icon: Users },
  { day: 1, title: "Summit Capital",         detail: "Client call",            start: 10.5, end: 11.5, color: "blue",   Icon: Phone },
  { day: 1, title: "Q1 Report Prep",         detail: "Internal review",        start: 13,   end: 14.5, color: "violet", Icon: FileText },
  { day: 1, title: "Strategy Session",       detail: "Regional managers",      start: 15.5, end: 16.5, color: "muted",  Icon: Users },
  { day: 1, title: "Flight to Chicago",      detail: "United 2847 · ORD",      start: 18,   end: 20.5, color: "amber",  Icon: Plane },

  { day: 2, title: "EJ Financial Advisor",   detail: "Edward Jones · 8:00 AM", start: 8,    end: 8.5,  color: "emerald", Icon: Coffee },
  { day: 2, title: "Prospect Call Block",    detail: "Follow-ups",             start: 10.5, end: 11.5, color: "cyan",   Icon: Phone },
  { day: 2, title: "Lakefront Capital",      detail: "Client lunch · Chicago", start: 13,   end: 14,   color: "blue",   Icon: Users },
  { day: 2, title: "Afternoon Calls",        detail: "Outbound",               start: 15,   end: 16,   color: "sky",    Icon: Phone },
  { day: 2, title: "Follow-up Emails",       detail: "Close-out items",        start: 16.5, end: 17,   color: "muted",  Icon: Mail },

  { day: 3, title: "Internal Alignment",     detail: "Cross-team sync",        start: 9,    end: 10,   color: "sky",    Icon: Users },
  { day: 3, title: "Product Demo",           detail: "Client walkthrough",     start: 11,   end: 12,   color: "blue",   Icon: BarChart2 },
  { day: 3, title: "Lunch & Learn",          detail: "Team session",           start: 13,   end: 14,   color: "sky",    Icon: Coffee },
  { day: 3, title: "Client Presentation",    detail: "Quarterly review deck",  start: 15,   end: 16.5, color: "violet", Icon: FileText },
  { day: 3, title: "Day Wrap-up",            detail: "Notes & follow-ups",     start: 17,   end: 17.5, color: "muted",  Icon: Mail },

  { day: 4, title: "Pipeline Review",        detail: "Week metrics",           start: 9,    end: 10,   color: "sky",    Icon: BarChart2 },
  { day: 4, title: "Prospect Calls",         detail: "Outbound block",         start: 10.5, end: 11.5, color: "cyan",   Icon: Phone },
  { day: 4, title: "Weekly Wrap-up",         detail: "Task close-out",         start: 13,   end: 14,   color: "blue",   Icon: Users },
  { day: 4, title: "Admin & CRM",            detail: "End-of-week update",     start: 14.5, end: 15.5, color: "muted",  Icon: BarChart2 },
];

function fmtHour(h: number) {
  if (h === 12) return "12p";
  if (h > 12) return `${h - 12}p`;
  return `${h}a`;
}

interface AvailSlot { day: number; start: number; label: string; }
const AVAILABLE_SLOTS_CAL: AvailSlot[] = [
  { day: 0, start: 8,    label: "8:00 AM" },
  { day: 0, start: 14,   label: "2:00 PM" },
  { day: 1, start: 9.5,  label: "9:30 AM" },
  { day: 1, start: 15,   label: "3:00 PM" },
  { day: 2, start: 9,    label: "9:00 AM" },
  { day: 2, start: 12,   label: "12:00 PM" },
  { day: 3, start: 10,   label: "10:00 AM" },
  { day: 3, start: 16.5, label: "4:30 PM" },
  { day: 4, start: 12,   label: "12:00 PM" },
  { day: 4, start: 15.5, label: "3:30 PM" },
];

const WEEK_START = new Date(2026, 2, 23); // Mon Mar 23

function meetingsToEvents(meetings: { scheduledAt: string; leadName: string; leadCompany: string }[]): CalEvent[] {
  return meetings.flatMap(m => {
    const d = new Date(m.scheduledAt);
    const dayIdx = Math.round((d.getTime() - WEEK_START.getTime()) / 86400000);
    if (dayIdx < 0 || dayIdx > 4) return [];
    const hour = d.getHours() + d.getMinutes() / 60;
    return [{
      day: dayIdx,
      title: m.leadName,
      detail: m.leadCompany,
      start: hour,
      end: hour + 1,
      color: "emerald" as EventColor,
      Icon: CalendarCheck,
    }];
  });
}

function WeekCalendar({ scheduledMeetings }: { scheduledMeetings?: CalEvent[] }) {
  const allEvents = [...EVENTS, ...(scheduledMeetings ?? [])];
  const totalH = HOURS.length * HOUR_H;

  return (
    <div className="overflow-x-auto rounded-xl">
      <div className="min-w-[620px]">
        {/* Day header row */}
        <div className="grid border-b border-white/8" style={{ gridTemplateColumns: "48px repeat(5, 1fr)" }}>
          <div />
          {DAYS.map((d) => (
            <div
              key={d.label}
              className={`text-center py-3 px-1 border-l border-white/8 ${d.highlight ? "bg-emerald-500/5" : ""}`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{d.label}</p>
              <p className={`text-sm font-bold mt-0.5 ${d.highlight ? "text-emerald-300" : "text-white"}`}>{d.date}</p>
              {d.highlight && (
                <span className="inline-block text-[9px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-full mt-1 font-semibold tracking-wide">
                  Chicago
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex" style={{ height: totalH }}>
          {/* Time gutter */}
          <div className="w-12 shrink-0 relative">
            {HOURS.map((h) => (
              <div
                key={h}
                className="absolute w-full flex items-start justify-end pr-2"
                style={{ top: (h - START_H) * HOUR_H, height: HOUR_H }}
              >
                <span className="text-[10px] text-muted-foreground/50 mt-0.5">{fmtHour(h)}</span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {DAYS.map((d, dayIdx) => {
            const dayEvents = allEvents.filter(e => e.day === dayIdx);
            return (
              <div
                key={d.label}
                className={`flex-1 relative border-l border-white/8 ${d.highlight ? "bg-emerald-500/[0.02]" : ""}`}
                style={{ height: totalH }}
              >
                {/* Hour grid lines */}
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="absolute w-full border-b border-white/[0.05]"
                    style={{ top: (h - START_H) * HOUR_H }}
                  />
                ))}

                {/* Available slots */}
                {AVAILABLE_SLOTS_CAL.filter(s => s.day === dayIdx).map((slot, si) => {
                  const isBooked = allEvents.some(
                    e => e.day === dayIdx && e.color === "emerald" && Math.abs(e.start - slot.start) < 0.5
                  );
                  return (
                    <div
                      key={si}
                      className={`absolute left-1 right-1 rounded-md border border-dashed flex flex-col items-center justify-center gap-0.5 z-10 transition-opacity ${
                        isBooked
                          ? "border-emerald-400/15 opacity-30 pointer-events-none"
                          : "border-teal-500/30 hover:border-teal-400/50 cursor-pointer"
                      }`}
                      style={{ top: (slot.start - START_H) * HOUR_H + 2, height: HOUR_H - 4 }}
                    >
                      {!isBooked && <Sparkles className="w-2.5 h-2.5 text-teal-400/50" />}
                      <p className="text-[10px] font-semibold text-teal-400/70">{isBooked ? "Booked" : "Open"}</p>
                      <p className="text-[9px] text-teal-400/45">{slot.label}</p>
                    </div>
                  );
                })}

                {/* Events */}
                {dayEvents.map((evt, i) => {
                  const c = EVENT_COLORS[evt.color];
                  const topPx = (evt.start - START_H) * HOUR_H + 1;
                  const rawH = (evt.end - evt.start) * HOUR_H - 3;
                  const heightPx = Math.max(rawH, 38);
                  const isShort = rawH < 42;
                  const EIcon = evt.Icon;

                  return (
                    <div
                      key={i}
                      className={`absolute left-1 right-1 rounded-md border overflow-hidden ${c.bg} ${c.border}`}
                      style={{ top: topPx, height: heightPx, zIndex: 20 }}
                    >
                      <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-sm ${c.bar}`} />
                      <div className="pl-2.5 pr-1.5 py-1 h-full flex flex-col justify-center">
                        <div className="flex items-center gap-1 min-w-0">
                          {EIcon && <EIcon className={`w-2.5 h-2.5 shrink-0 ${c.text} opacity-70`} />}
                          <p className={`text-[11px] font-semibold leading-tight truncate ${c.text}`}>{evt.title}</p>
                        </div>
                        {!isShort && (
                          <p className="text-[9px] text-white/35 truncate mt-0.5 pl-[14px]">{evt.detail}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const { data: meetingsData } = useMeetings();
  const scheduledEvents = useMemo(() => {
    const list = (meetingsData as any)?.meetings ?? meetingsData ?? [];
    return meetingsToEvents(Array.isArray(list) ? list : []);
  }, [meetingsData]);

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

          <div className="h-1 bg-white/5 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-primary via-accent to-primary/60"
              initial={{ width: 0 }}
              animate={{ width: `${quarterPct}%` }}
              transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
            />
          </div>

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
                    <div className="absolute inset-0 opacity-[0.03]" style={{ background: `radial-gradient(ellipse at top right, ${m.color}, transparent 70%)` }} />
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
                            <motion.div animate={{ rotate: isSelected ? 180 : 0 }} transition={{ duration: 0.2 }}>
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            </motion.div>
                          )}
                        </div>
                      </div>

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

                      <AnimatePresence>
                        {isSelected && m.canGenerateLeads && (
                          <motion.div
                            initial={{ opacity: 0, height: 0, marginTop: 0 }}
                            animate={{ opacity: 1, height: "auto", marginTop: 16 }}
                            exit={{ opacity: 0, height: 0, marginTop: 0 }}
                            transition={{ duration: 0.25, ease: "easeInOut" }}
                            className="overflow-hidden"
                          >
                            <div className="rounded-xl p-4 border" style={{ background: `${m.color}08`, borderColor: `${m.color}25` }}>
                              <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                                You're <span className="text-white font-semibold">{100 - m.pct}%</span> away from your {m.label} target. Generate fresh leads to close the gap.
                              </p>
                              <Button asChild className="w-full font-semibold shadow-md" style={{ background: m.color, color: "#fff" }}>
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
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }} tickFormatter={(v) => `$${v}M`} width={52} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                  <Bar dataKey="aum" name="Total AUM" radius={[4, 4, 0, 0]} fill="#3b82f6" />
                  <Bar dataKey="fi" name="Fixed Income" radius={[4, 4, 0, 0]} fill="#2dd4bf" />
                  <Bar dataKey="etfs" name="Active ETFs" radius={[4, 4, 0, 0]} fill="#a78bfa" />
                </BarChart>
              </ResponsiveContainer>
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

        {/* Weekly Calendar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-xl font-display font-semibold text-white">This Week</h2>
              <p className="text-muted-foreground text-sm mt-0.5">March 23 – 27, 2026</p>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
              {[
                { color: "bg-blue-400",    label: "Client" },
                { color: "bg-violet-400",  label: "Strategy" },
                { color: "bg-cyan-400",    label: "Prospecting" },
                { color: "bg-amber-400",   label: "Travel" },
                { color: "bg-emerald-400", label: scheduledEvents.length > 0 ? `Scheduled (${scheduledEvents.length})` : "Priority" },
                { color: "bg-teal-400",    label: "Open Slots" },
              ].map(l => (
                <div key={l.label} className="hidden sm:flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${l.color}`} />
                  {l.label}
                </div>
              ))}
            </div>
          </div>

          <Card className="bg-card/40 border-white/8 overflow-hidden">
            <CardContent className="p-0">
              <WeekCalendar scheduledMeetings={scheduledEvents} />
            </CardContent>
          </Card>
        </motion.div>

      </div>
    </Layout>
  );
}
