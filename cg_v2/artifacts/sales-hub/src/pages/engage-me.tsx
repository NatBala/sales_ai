import { useState, useRef, useCallback, useEffect } from "react";
import { Layout } from "@/components/layout";
import { resolveApiUrl } from "@/lib/api-url";
import { useMeetings } from "@/hooks/use-meetings";
import { Button } from "@/components/ui/button";
import {
  Loader2, Activity, Mic, Radio, ArrowRightCircle,
  ArrowRight, CheckSquare, BarChart3, PieChart, ListOrdered,
  TrendingUp, Info, LayoutGrid,
} from "lucide-react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  buildRealtimeConnectError,
  DEFAULT_REALTIME_CONNECT_TIMEOUT_MS,
  waitForUsableIceCandidate,
} from "@/lib/realtime";

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

function parseRequestError(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { error?: string; details?: string };
    if (typeof parsed.details === "string" && parsed.details.trim()) return parsed.details;
    if (typeof parsed.error === "string" && parsed.error.trim()) return parsed.error;
  } catch {
    const bodyMatch = raw.match(/<pre>([\s\S]*?)<\/pre>/i);
    if (bodyMatch?.[1]) return bodyMatch[1].trim();
  }
  return raw.trim();
}

// ─── ETF Data Corpus ─────────────────────────────────────────────────────────

interface Holding { name: string; pct: number; }
interface PerfPeriod { quarter: number; ytd: number; "1y": number; "3y": number; "5y": number; "10y": number; since: number; }
interface BarItem { label: string; value: number; }

interface ETFData {
  name: string; category: string; ticker: string;
  price: number; nav: number; expenseRatio: number; secYield: number | null;
  aum: number; fundAum: number; benchmark: string;
  dividendSchedule: string; inception: string;
  color: string; colorClass: string; bgClass: string; borderClass: string;
  performance: { nav: PerfPeriod; benchmark: PerfPeriod };
  holdings: Holding[] | null; topTenPct?: number;
  composition: Record<string, BarItem[]>;
  compLabel: string;
  stats: Record<string, number | string>;
  description: string;
}

const ETF_DATA: Record<string, ETFData> = {
  CGCP: {
    name: "Core Plus Income ETF", category: "U.S. Multi-Sector Fixed Income", ticker: "CGCP",
    price: 25.35, nav: 25.36, expenseRatio: 0.34, secYield: 5.1,
    aum: 2847, fundAum: 8500,
    benchmark: "Bloomberg U.S. Aggregate Bond Index",
    dividendSchedule: "Monthly", inception: "Feb 2022",
    color: "#3b82f6", colorClass: "text-blue-400", bgClass: "bg-blue-500/15", borderClass: "border-blue-500/30",
    description: "Actively managed multi-sector fixed income fund seeking current income and capital preservation, with flexibility to invest beyond the core bond index.",
    performance: {
      nav:       { quarter: 1.82, ytd: 5.43, "1y": 8.21, "3y": 3.94, "5y": 2.11, "10y": 0, since: 3.82 },
      benchmark: { quarter: 1.07, ytd: 4.92, "1y": 7.21, "3y": 3.68, "5y": -0.37,"10y": 0, since: 2.94 },
    },
    holdings: null,
    compLabel: "By Sector",
    composition: {
      "By Sector": [
        { label: "U.S. Investment Grade", value: 38.5 },
        { label: "U.S. High Yield",       value: 18.2 },
        { label: "Government / Agency",   value: 16.4 },
        { label: "Securitized",           value: 13.6 },
        { label: "Non-U.S. Fixed Income", value: 8.3 },
        { label: "Cash & Equivalents",    value: 5.0 },
      ],
      "Credit Quality": [
        { label: "AAA / Government", value: 32.1 },
        { label: "BBB",              value: 24.3 },
        { label: "A",                value: 18.7 },
        { label: "BB",               value: 12.4 },
        { label: "B & Below",        value: 12.5 },
      ],
      "Maturity": [
        { label: "1 – 5 Years",   value: 38.2 },
        { label: "5 – 10 Years",  value: 34.6 },
        { label: "10 – 20 Years", value: 14.8 },
        { label: "Over 20 Years", value: 8.5 },
        { label: "Under 1 Year",  value: 3.9 },
      ],
    },
    stats: {
      "# Bonds": 842, "Avg Duration": "5.3 yrs", "Avg Maturity": "7.8 yrs",
      "Turnover": "112%", "Active vs Benchmark": "+0.74%", "Inception": "Feb 2022",
    },
  },
  CGUS: {
    name: "Core Equity ETF", category: "U.S. Large-Cap Blend", ticker: "CGUS",
    price: 35.82, nav: 35.81, expenseRatio: 0.33, secYield: 0.82,
    aum: 4240, fundAum: 12800,
    benchmark: "S&P 500 Index",
    dividendSchedule: "Quarterly", inception: "Feb 2022",
    color: "#10b981", colorClass: "text-emerald-400", bgClass: "bg-emerald-500/15", borderClass: "border-emerald-500/30",
    description: "Actively managed U.S. equity fund seeking long-term growth by investing in large-cap companies with durable competitive advantages and strong fundamentals.",
    performance: {
      nav:       { quarter: 3.14, ytd: 18.92, "1y": 18.92, "3y": 24.31, "5y": 0, "10y": 0, since: 14.87 },
      benchmark: { quarter: 2.66, ytd: 17.88, "1y": 17.88, "3y": 23.01, "5y": 0, "10y": 0, since: 13.42 },
    },
    holdings: [
      { name: "Microsoft Corp.",     pct: 7.2 },
      { name: "NVIDIA Corp.",        pct: 6.8 },
      { name: "Apple Inc.",          pct: 5.9 },
      { name: "Alphabet Inc.",       pct: 4.7 },
      { name: "Amazon.com Inc.",     pct: 3.9 },
      { name: "Meta Platforms Inc.", pct: 3.1 },
      { name: "Eli Lilly & Co.",     pct: 2.8 },
      { name: "JPMorgan Chase",      pct: 2.4 },
      { name: "Broadcom Inc.",       pct: 2.2 },
      { name: "UnitedHealth Group",  pct: 1.9 },
    ],
    topTenPct: 40.9,
    compLabel: "Sectors",
    composition: {
      "Sectors": [
        { label: "Information Technology", value: 35.8 },
        { label: "Health Care",            value: 14.2 },
        { label: "Consumer Discretionary", value: 12.4 },
        { label: "Financials",             value: 11.6 },
        { label: "Communication Services", value:  9.8 },
        { label: "Industrials",            value:  7.3 },
        { label: "Consumer Staples",       value:  4.2 },
      ],
    },
    stats: {
      "# Stocks": 64, "Median Mkt Cap": "$418B", "P/E Ratio": "29.1×",
      "P/B Ratio": "5.6×", "Active Share": "28.4%", "Turnover": "22%",
    },
  },
  CGGR: {
    name: "Growth ETF", category: "U.S. Large-Cap Growth", ticker: "CGGR",
    price: 42.64, nav: 42.62, expenseRatio: 0.39, secYield: 0.18,
    aum: 2650, fundAum: 8200,
    benchmark: "Russell 1000 Growth Index",
    dividendSchedule: "Quarterly", inception: "Feb 2022",
    color: "#8b5cf6", colorClass: "text-violet-400", bgClass: "bg-violet-500/15", borderClass: "border-violet-500/30",
    description: "Actively managed growth equity fund targeting companies with accelerating earnings, strong balance sheets, and secular growth tailwinds across technology and innovation.",
    performance: {
      nav:       { quarter: 4.22, ytd: 24.18, "1y": 24.18, "3y": 28.74, "5y": 0, "10y": 0, since: 18.34 },
      benchmark: { quarter: 3.81, ytd: 22.94, "1y": 22.94, "3y": 26.12, "5y": 0, "10y": 0, since: 16.88 },
    },
    holdings: [
      { name: "NVIDIA Corp.",        pct: 10.2 },
      { name: "Microsoft Corp.",     pct: 8.4 },
      { name: "Apple Inc.",          pct: 7.1 },
      { name: "Alphabet Inc.",       pct: 5.8 },
      { name: "Amazon.com Inc.",     pct: 4.9 },
      { name: "Meta Platforms Inc.", pct: 4.3 },
      { name: "Broadcom Inc.",       pct: 3.6 },
      { name: "Tesla Inc.",          pct: 2.9 },
      { name: "Eli Lilly & Co.",     pct: 2.7 },
      { name: "Adobe Inc.",          pct: 2.1 },
    ],
    topTenPct: 52.0,
    compLabel: "Sectors",
    composition: {
      "Sectors": [
        { label: "Information Technology", value: 48.2 },
        { label: "Communication Services", value: 16.4 },
        { label: "Consumer Discretionary", value: 14.8 },
        { label: "Health Care",            value:  9.6 },
        { label: "Industrials",            value:  5.7 },
        { label: "Financials",             value:  3.2 },
        { label: "Other",                  value:  2.1 },
      ],
    },
    stats: {
      "# Stocks": 52, "Median Mkt Cap": "$512B", "P/E Ratio": "36.8×",
      "P/B Ratio": "9.2×", "Active Share": "31.6%", "Turnover": "28%",
    },
  },
  CGXU: {
    name: "International Focus Equity ETF", category: "International Ex-U.S. Equity", ticker: "CGXU",
    price: 28.42, nav: 28.44, expenseRatio: 0.39, secYield: null,
    aum: 3120, fundAum: 9400,
    benchmark: "MSCI All Country World ex USA Index",
    dividendSchedule: "Semiannual", inception: "Feb 2022",
    color: "#f59e0b", colorClass: "text-amber-400", bgClass: "bg-amber-500/15", borderClass: "border-amber-500/30",
    description: "Actively managed international equity fund with a focused, high-conviction portfolio of companies across developed and emerging markets outside the U.S.",
    performance: {
      nav:       { quarter: 5.84, ytd: 36.12, "1y": 36.12, "3y": 19.48, "5y": 0, "10y": 0, since: 8.74 },
      benchmark: { quarter: 4.85, ytd: 31.95, "1y": 31.95, "3y": 17.26, "5y": 0, "10y": 0, since: 6.21 },
    },
    holdings: [
      { name: "Taiwan Semiconductor", pct: 4.8 },
      { name: "ASML Holding NV",      pct: 3.6 },
      { name: "Novo Nordisk A/S",     pct: 3.2 },
      { name: "Samsung Electronics",  pct: 2.9 },
      { name: "Roche Holding AG",     pct: 2.7 },
      { name: "Nestle SA",            pct: 2.4 },
      { name: "AstraZeneca plc",      pct: 2.2 },
      { name: "LVMH Moet Hennessy",   pct: 2.0 },
      { name: "Tencent Holdings",     pct: 1.9 },
      { name: "Shell plc",            pct: 1.7 },
    ],
    topTenPct: 27.4,
    compLabel: "Geography",
    composition: {
      "Geography": [
        { label: "Europe",             value: 42.8 },
        { label: "Emerging Asia",      value: 18.2 },
        { label: "Japan",              value: 16.4 },
        { label: "United Kingdom",     value:  8.6 },
        { label: "Other Asia Pacific", value:  7.3 },
        { label: "Americas ex-U.S.",   value:  4.8 },
        { label: "Other",              value:  1.9 },
      ],
      "Sectors": [
        { label: "Health Care",            value: 22.4 },
        { label: "Financials",             value: 18.6 },
        { label: "Information Technology", value: 16.8 },
        { label: "Consumer Discretionary", value: 12.4 },
        { label: "Industrials",            value: 11.2 },
        { label: "Consumer Staples",       value:  8.9 },
        { label: "Basic Materials",        value:  5.7 },
      ],
    },
    stats: {
      "# Stocks": 71, "Median Mkt Cap": "$84B", "P/E Ratio": "19.4×",
      "P/B Ratio": "3.2×", "Active Share": "74.3%", "Turnover": "38%",
    },
  },
  CGDV: {
    name: "Dividend Value ETF", category: "U.S. Large-Cap Value", ticker: "CGDV",
    price: 31.52, nav: 31.50, expenseRatio: 0.33, secYield: 2.14,
    aum: 3820, fundAum: 10600,
    benchmark: "Russell 1000 Value Index",
    dividendSchedule: "Quarterly", inception: "Feb 2022",
    color: "#ec4899", colorClass: "text-pink-400", bgClass: "bg-pink-500/15", borderClass: "border-pink-500/30",
    description: "Actively managed value-oriented equity fund targeting dividend-paying companies with strong free cash flow, sound balance sheets, and sustainable payout ratios.",
    performance: {
      nav:       { quarter: 1.94, ytd: 12.84, "1y": 12.84, "3y": 16.72, "5y": 0, "10y": 0, since: 10.38 },
      benchmark: { quarter: 1.32, ytd: 11.26, "1y": 11.26, "3y": 15.04, "5y": 0, "10y": 0, since:  9.12 },
    },
    holdings: [
      { name: "JPMorgan Chase & Co.", pct: 5.8 },
      { name: "Berkshire Hathaway",   pct: 5.2 },
      { name: "Chevron Corp.",        pct: 4.7 },
      { name: "Johnson & Johnson",    pct: 4.4 },
      { name: "Procter & Gamble",     pct: 4.1 },
      { name: "Walmart Inc.",         pct: 3.8 },
      { name: "ExxonMobil Corp.",     pct: 3.6 },
      { name: "Home Depot Inc.",      pct: 3.3 },
      { name: "Merck & Co.",          pct: 3.1 },
      { name: "Bank of America",      pct: 2.9 },
    ],
    topTenPct: 40.9,
    compLabel: "Sectors",
    composition: {
      "Sectors": [
        { label: "Financials",             value: 24.8 },
        { label: "Health Care",            value: 16.4 },
        { label: "Consumer Staples",       value: 14.2 },
        { label: "Industrials",            value: 11.8 },
        { label: "Energy",                 value: 10.4 },
        { label: "Consumer Discretionary", value:  9.6 },
        { label: "Information Technology", value:  7.2 },
      ],
    },
    stats: {
      "# Stocks": 58, "Median Mkt Cap": "$196B", "P/E Ratio": "18.4×",
      "P/B Ratio": "2.9×", "Dividend Yield": "2.1%", "Turnover": "18%",
    },
  },
};

type DataType = "overview" | "holdings" | "performance" | "composition" | "stats";

interface FundDisplay {
  ticker: string;
  dataType: DataType;
  insight: string;
  triggeredAt: number;
}

// ─── Visualization Components ────────────────────────────────────────────────

function HBar({ label, value, max, color, rank }: { label: string; value: number; max: number; color: string; rank?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: (rank ?? 0) * 0.04 }}
      className="flex items-center gap-3"
    >
      {rank !== undefined && (
        <span className="text-xs font-bold text-muted-foreground/40 w-4 text-right shrink-0">{rank + 1}</span>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline mb-1.5">
          <span className="text-sm font-medium text-white/80 truncate mr-2">{label}</span>
          <span className="text-base font-bold shrink-0" style={{ color }}>{value.toFixed(1)}%</span>
        </div>
        <div className="h-3 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: color }}
            initial={{ width: 0 }}
            animate={{ width: `${(value / max) * 100}%` }}
            transition={{ duration: 0.6, ease: "easeOut", delay: (rank ?? 0) * 0.04 }}
          />
        </div>
      </div>
    </motion.div>
  );
}

function OverviewPanel({ fund, key }: { fund: ETFData; key?: string }) {
  const aum = fund.aum >= 1000 ? `$${(fund.aum / 1000).toFixed(0)}B` : `$${fund.aum}M`;
  return (
    <div className="h-full flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className={`flex flex-col items-center justify-center w-20 h-20 rounded-2xl ${fund.bgClass} border ${fund.borderClass} shrink-0`}>
          <span className="text-2xl font-black" style={{ color: fund.color }}>{fund.ticker}</span>
          <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider mt-0.5">ETF</span>
        </div>
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">{fund.category}</p>
          <h2 className="text-2xl font-bold text-white">{fund.name}</h2>
          <p className="text-sm text-muted-foreground/70 mt-1 leading-relaxed">{fund.description}</p>
        </div>
      </div>

      {/* Big metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1">
        {[
          { label: "Market Price",    value: `$${fund.price.toFixed(2)}`, sub: `NAV $${fund.nav.toFixed(2)}` },
          { label: "Expense Ratio",   value: `${fund.expenseRatio}%`,     sub: "Per year" },
          { label: "SEC Yield",       value: fund.secYield ? `${fund.secYield}%` : "—",  sub: "30-day" },
          { label: "ETF Assets",      value: aum,                          sub: fund.dividendSchedule + " dividends" },
        ].map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className={`flex flex-col justify-between p-4 rounded-2xl ${fund.bgClass} border ${fund.borderClass}`}
          >
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{m.label}</p>
            <div>
              <p className="text-3xl font-black" style={{ color: fund.color }}>{m.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{m.sub}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Benchmark */}
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl ${fund.bgClass} border ${fund.borderClass}`}>
        <TrendingUp className="w-4 h-4 shrink-0" style={{ color: fund.color }} />
        <div className="text-sm text-white/70">
          <span className="text-muted-foreground">Benchmark: </span>
          <span className="font-semibold text-white">{fund.benchmark}</span>
          <span className="mx-2 text-muted-foreground/40">·</span>
          <span className="text-muted-foreground">Inception: </span>
          <span className="font-semibold text-white">{fund.inception}</span>
        </div>
      </div>
    </div>
  );
}

function HoldingsPanel({ fund }: { fund: ETFData }) {
  if (!fund.holdings) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <ListOrdered className="w-16 h-16 text-muted-foreground/15 mx-auto mb-4" />
          <p className="text-muted-foreground">Top holdings not available for {fund.ticker}</p>
          <p className="text-sm text-muted-foreground/50 mt-1">CGCP holdings are not disclosed for this actively managed bond fund</p>
        </div>
      </div>
    );
  }
  const max = fund.holdings[0]?.pct ?? 10;
  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-white">Top 10 Holdings — {fund.ticker}</h3>
          <p className="text-sm text-muted-foreground">As of Dec 31, 2025</p>
        </div>
        <div className={`px-4 py-2 rounded-xl ${fund.bgClass} border ${fund.borderClass} text-center`}>
          <p className="text-2xl font-black" style={{ color: fund.color }}>{fund.topTenPct}%</p>
          <p className="text-xs text-muted-foreground">Top 10 of AUM</p>
        </div>
      </div>
      <div className="flex-1 space-y-3 overflow-hidden">
        {fund.holdings.map((h, i) => (
          <HBar key={h.name} label={h.name} value={h.pct} max={max * 1.1} color={fund.color} rank={i} />
        ))}
      </div>
    </div>
  );
}

function PerformancePanel({ fund }: { fund: ETFData }) {
  const periods: { key: keyof PerfPeriod; label: string }[] = [
    { key: "ytd", label: "YTD" },
    { key: "1y", label: "1 Yr" },
    { key: "3y", label: "3 Yr" },
    { key: "5y", label: "5 Yr" },
    { key: "10y", label: "10 Yr" },
    { key: "since", label: "Since Inc." },
  ];
  const allVals = periods.flatMap(p => [fund.performance.nav[p.key], fund.performance.benchmark[p.key]]);
  const maxAbs = Math.max(...allVals.map(Math.abs), 1);

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-white">Performance — {fund.ticker}</h3>
          <p className="text-sm text-muted-foreground">Period ended Dec 31, 2025 · Annual returns %</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: fund.color }} />
            <span className="text-white/60">NAV</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-white/20" />
            <span className="text-white/60">Benchmark</span>
          </div>
        </div>
      </div>
      <div className="flex-1 grid grid-cols-6 gap-3 items-end">
        {periods.map((p, pi) => {
          const nav = fund.performance.nav[p.key];
          const bm = fund.performance.benchmark[p.key];
          const navH = (Math.abs(nav) / maxAbs) * 75;
          const bmH = (Math.abs(bm) / maxAbs) * 75;
          const isNeg = nav < 0;
          return (
            <motion.div
              key={p.key}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: pi * 0.07 }}
              className="flex flex-col items-center gap-2"
            >
              {/* Bars */}
              <div className="flex items-end gap-1 h-32">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs font-bold" style={{ color: isNeg ? "#ef4444" : fund.color }}>
                    {nav > 0 ? "+" : ""}{nav.toFixed(1)}%
                  </span>
                  <motion.div
                    className="w-8 rounded-t-md"
                    style={{ backgroundColor: isNeg ? "#ef4444" : fund.color, height: navH + 8 }}
                    initial={{ scaleY: 0, originY: 1 }}
                    animate={{ scaleY: 1 }}
                    transition={{ duration: 0.5, delay: pi * 0.07, ease: "easeOut" }}
                  />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs text-muted-foreground/50">
                    {bm > 0 ? "+" : ""}{bm.toFixed(1)}%
                  </span>
                  <motion.div
                    className="w-6 rounded-t-md bg-white/20"
                    style={{ height: bmH + 8 }}
                    initial={{ scaleY: 0, originY: 1 }}
                    animate={{ scaleY: 1 }}
                    transition={{ duration: 0.5, delay: pi * 0.07 + 0.05, ease: "easeOut" }}
                  />
                </div>
              </div>
              <span className="text-xs font-semibold text-muted-foreground">{p.label}</span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function CompositionPanel({ fund }: { fund: ETFData }) {
  const keys = Object.keys(fund.composition);
  const [activeKey, setActiveKey] = useState(keys[0]);
  const items = (fund.composition[activeKey] ?? []).slice(0, 8);
  const max = items[0]?.value ?? 10;
  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-xl font-bold text-white">Composition — {fund.ticker}</h3>
          <p className="text-sm text-muted-foreground">% of portfolio</p>
        </div>
        {keys.length > 1 && (
          <div className="flex gap-1 bg-white/5 border border-white/10 rounded-lg p-1">
            {keys.map(k => (
              <button
                key={k}
                onClick={() => setActiveKey(k)}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-semibold transition-all",
                  activeKey === k ? "text-white shadow" : "text-muted-foreground hover:text-white"
                )}
                style={activeKey === k ? { backgroundColor: fund.color + "33" } : {}}
              >
                {k}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex-1 space-y-3 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div key={activeKey} className="space-y-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {items.map((item, i) => (
              <HBar key={item.label} label={item.label} value={item.value} max={max * 1.05} color={fund.color} rank={i} />
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function StatsPanel({ fund }: { fund: ETFData }) {
  const entries = Object.entries(fund.stats);
  return (
    <div className="h-full flex flex-col gap-4">
      <div>
        <h3 className="text-xl font-bold text-white">Key Statistics — {fund.ticker}</h3>
        <p className="text-sm text-muted-foreground">As of Dec 31, 2025</p>
      </div>
      <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-3">
        {entries.map(([k, v], i) => (
          <motion.div
            key={k}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.07 }}
            className={`flex flex-col justify-between p-4 rounded-2xl ${fund.bgClass} border ${fund.borderClass}`}
          >
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{k}</p>
            <p className="text-3xl font-black mt-2" style={{ color: fund.color }}>
              {typeof v === "number" ? v.toLocaleString() : v}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

const DATA_TYPE_ICONS: Record<DataType, typeof Info> = {
  overview: Info,
  holdings: ListOrdered,
  performance: BarChart3,
  composition: PieChart,
  stats: LayoutGrid,
};

const DATA_TYPE_LABELS: Record<DataType, string> = {
  overview: "Overview",
  holdings: "Top Holdings",
  performance: "Performance",
  composition: "Composition",
  stats: "Key Stats",
};

type RealtimeEvent = {
  type?: string;
  transcript?: string;
  error?: { message?: string };
  response?: {
    output?: Array<{
      type?: string;
      name?: string;
      call_id?: string;
      arguments?: string;
    }>;
  };
};

const FUND_HINT_REGEX = /\b(bnd|vti|voo|vxus|vnq|bond|fixed income|s&p|international|reit|real estate)\b/i;

function isDataType(value: unknown): value is DataType {
  return value === "overview"
    || value === "holdings"
    || value === "performance"
    || value === "composition"
    || value === "stats";
}

function formatTimestamp(value: number | null) {
  if (!value) return "Waiting for first pull";
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EngageMe() {
  const { data: meetingsData } = useMeetings();

  const allScheduled = meetingsData?.meetings?.filter(m => m.status === "scheduled") || [];
  const byLead = new Map<string, typeof allScheduled[number]>();
  for (const m of allScheduled) {
    const ex = byLead.get(m.leadId);
    if (!ex || new Date(m.scheduledAt) < new Date(ex.scheduledAt)) byLead.set(m.leadId, m);
  }
  const meetings = Array.from(byLead.values());

  const mayaLeadIdRef = useRef(sessionStorage.getItem("maya_engage_lead"));
  if (mayaLeadIdRef.current) sessionStorage.removeItem("maya_engage_lead");
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);

  useEffect(() => {
    const leadId = mayaLeadIdRef.current;
    if (!leadId || !meetingsData?.meetings) return;
    const meeting = meetingsData.meetings.find(m => m.leadId === leadId || m.id === leadId);
    if (meeting) setSelectedMeetingId(meeting.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingsData]);

  const [isConnecting, setIsConnecting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [sessionLabel, setSessionLabel] = useState("OpenAI Realtime idle");
  const [sessionError, setSessionError] = useState("");

  const [currentDisplay, setCurrentDisplay] = useState<FundDisplay | null>(null);
  const [displayHistory, setDisplayHistory] = useState<FundDisplay[]>([]);
  const [recentTranscript, setRecentTranscript] = useState("");
  const [noFundMsg, setNoFundMsg] = useState("");
  const [lastUpdateAt, setLastUpdateAt] = useState<number | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const disconnectTimeoutRef = useRef<number | null>(null);
  const connectTimeoutRef = useRef<number | null>(null);
  const hasConnectedOnceRef = useRef(false);
  const noFundTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingNoFundTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handledToolCallsRef = useRef<Set<string>>(new Set());

  const selectedMeeting = meetings.find(m => m.id === selectedMeetingId);

  const clearNoFundTimers = useCallback(() => {
    if (noFundTimerRef.current) clearTimeout(noFundTimerRef.current);
    if (pendingNoFundTimerRef.current) clearTimeout(pendingNoFundTimerRef.current);
  }, []);

  const showNoFund = useCallback((msg: string) => {
    clearNoFundTimers();
    setNoFundMsg(msg);
    noFundTimerRef.current = setTimeout(() => setNoFundMsg(""), 3200);
  }, [clearNoFundTimers]);

  const pushDisplay = useCallback((display: FundDisplay) => {
    clearNoFundTimers();
    setNoFundMsg("");
    setCurrentDisplay(display);
    setLastUpdateAt(display.triggeredAt);
    setDisplayHistory(prev => [display, ...prev].slice(0, 8));
  }, [clearNoFundTimers]);

  /* const stopCapture = useCallback(async () => {
    if (!isRecording) return;
    setIsRecording(false);
    setIsAnalyzing(true);
    try {
      const blob = await stopRecording();
      if (!blob.size) { setIsAnalyzing(false); return; }
      const audio = await blobToBase64(blob);
      const res = await fetch(resolveApiUrl("/api/realtime/analyze"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio }),
      });
      if (!res.ok) throw new Error("Analyze failed");
      const data = await res.json() as {
        detected: { ticker: string; dataType: string; insight: string } | null;
        transcript: string;
      };
      if (data.transcript) setRecentTranscript(data.transcript);
      if (data.detected?.ticker && ETF_DATA[data.detected.ticker]) {
        const display: FundDisplay = {
          ticker: data.detected.ticker,
          dataType: data.detected.dataType as DataType,
          insight: data.detected.insight,
          triggeredAt: Date.now(),
        };
        setCurrentDisplay(display);
        setDisplayHistory(prev => [display, ...prev].slice(0, 8));
      } else if (data.transcript) {
        showNoFund("No fund detected — try mentioning CGCP, CGUS, CGGR, CGXU, or CGDV");
      }
    } catch (err) {
      console.error("Engage analyze failed:", err);
    } finally {
      setIsAnalyzing(false);
    }
  }, [isRecording, stopRecording, showNoFund]); */

  const sendRealtimeEvent = useCallback((event: Record<string, unknown>) => {
    const channel = dataChannelRef.current;
    if (!channel || channel.readyState !== "open") return;
    channel.send(JSON.stringify(event));
  }, []);

  const acknowledgeToolCall = useCallback((callId: string) => {
    sendRealtimeEvent({
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: callId,
        output: JSON.stringify({ status: "rendered" }),
      },
    });
    sendRealtimeEvent({
      type: "response.create",
      response: {
        modalities: ["text"],
        max_output_tokens: 1,
        instructions: "The UI has rendered the requested ETF data. Reply with the single token ok, then wait silently for the next user turn.",
      },
    });
  }, [sendRealtimeEvent]);

  const handleToolArguments = useCallback((rawArguments?: string, callId?: string) => {
    if (!rawArguments) return;
    try {
      const parsed = JSON.parse(rawArguments) as {
        ticker?: string;
        dataType?: string;
        insight?: string;
      };

      if (!parsed.ticker || !ETF_DATA[parsed.ticker] || !isDataType(parsed.dataType)) {
        showNoFund("No fund match yet. Try CGCP, CGUS, CGGR, CGXU, or CGDV.");
        return;
      }

      pushDisplay({
        ticker: parsed.ticker,
        dataType: parsed.dataType,
        insight: parsed.insight ?? "",
        triggeredAt: Date.now(),
      });
      setSessionLabel(`Pulled ${parsed.ticker} ${DATA_TYPE_LABELS[parsed.dataType].toLowerCase()}`);
      if (callId) acknowledgeToolCall(callId);
    } catch (error) {
      console.error("Failed to parse realtime tool arguments:", error);
    }
  }, [acknowledgeToolCall, pushDisplay, showNoFund]);

  const handleRealtimeEvent = useCallback((event: RealtimeEvent) => {
    switch (event.type) {
      case "input_audio_buffer.speech_started":
        setIsUserSpeaking(true);
        setSessionLabel("Listening to the conversation");
        break;
      case "input_audio_buffer.speech_stopped":
        setIsUserSpeaking(false);
        setSessionLabel("Processing the latest turn");
        break;
      case "conversation.item.input_audio_transcription.completed": {
        const transcript = (event.transcript ?? "").trim();
        if (!transcript) break;
        setRecentTranscript(transcript);
        clearNoFundTimers();
        pendingNoFundTimerRef.current = setTimeout(() => {
          if (FUND_HINT_REGEX.test(transcript)) {
            showNoFund("Heard the fund topic. Waiting for the next live pull.");
          } else {
            showNoFund("No fund topic detected yet. Ask about CGCP, CGUS, CGGR, CGXU, or CGDV.");
          }
        }, 1800);
        break;
      }
      case "response.done": {
        const outputs = event.response?.output ?? [];
        let handledOutput = false;
        for (const item of outputs) {
          if (item.type !== "function_call" || item.name !== "show_fund_data") continue;
          if (item.call_id && handledToolCallsRef.current.has(item.call_id)) continue;
          if (item.call_id) handledToolCallsRef.current.add(item.call_id);
          handleToolArguments(item.arguments, item.call_id);
          handledOutput = true;
        }
        if (!handledOutput) setSessionLabel("Listening live");
        break;
      }
      case "error":
        setSessionError(event.error?.message ?? "OpenAI Realtime session error.");
        setSessionLabel("Realtime session error");
        break;
      default:
        break;
    }
  }, [clearNoFundTimers, handleToolArguments, showNoFund]);

  const stopListening = useCallback((options?: { completed?: boolean }) => {
    clearNoFundTimers();
    handledToolCallsRef.current.clear();
    if (disconnectTimeoutRef.current !== null) {
      window.clearTimeout(disconnectTimeoutRef.current);
      disconnectTimeoutRef.current = null;
    }
    if (connectTimeoutRef.current !== null) {
      window.clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }

    const channel = dataChannelRef.current;
    if (channel) {
      channel.onopen = null;
      channel.onclose = null;
      channel.onerror = null;
      channel.onmessage = null;
      if (channel.readyState !== "closed") channel.close();
      dataChannelRef.current = null;
    }

    const peer = peerConnectionRef.current;
    if (peer) {
      peer.onconnectionstatechange = null;
      peer.oniceconnectionstatechange = null;
      if (peer.signalingState !== "closed") peer.close();
      peerConnectionRef.current = null;
    }

    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    setIsConnecting(false);
    setIsListening(false);
    setIsUserSpeaking(false);
    setSessionLabel(options?.completed ? "Session complete" : "OpenAI Realtime idle");
    hasConnectedOnceRef.current = false;
    if (options?.completed) setSessionCompleted(true);
  }, [clearNoFundTimers]);

  const startListening = useCallback(async () => {
    if (!selectedMeeting || isConnecting || isListening) return;

    setSessionCompleted(false);
    setSessionError("");
    setNoFundMsg("");
    setIsConnecting(true);
    setSessionLabel("Connecting to OpenAI Realtime");
    handledToolCallsRef.current.clear();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      localStreamRef.current = stream;

      const peer = new RTCPeerConnection({
        iceServers: DEFAULT_ICE_SERVERS,
        iceCandidatePoolSize: 4,
      });
      peerConnectionRef.current = peer;

      peer.onconnectionstatechange = () => {
        if (peer.connectionState === "connected") {
          hasConnectedOnceRef.current = true;
          if (connectTimeoutRef.current !== null) {
            window.clearTimeout(connectTimeoutRef.current);
            connectTimeoutRef.current = null;
          }
          if (disconnectTimeoutRef.current !== null) {
            window.clearTimeout(disconnectTimeoutRef.current);
            disconnectTimeoutRef.current = null;
          }
          setIsConnecting(false);
          setIsListening(true);
          setSessionLabel("OpenAI Realtime live");
        } else if (peer.connectionState === "failed") {
          if (!hasConnectedOnceRef.current) {
            setSessionError("Realtime connection failed to initialize. Please try again.");
            stopListening();
            return;
          }
          setSessionLabel("Reconnecting to OpenAI Realtime");
          if (disconnectTimeoutRef.current !== null) {
            window.clearTimeout(disconnectTimeoutRef.current);
          }
          disconnectTimeoutRef.current = window.setTimeout(() => {
            if (peerConnectionRef.current === peer && peer.connectionState === "failed") {
              setSessionError("The Realtime connection dropped. Start a new session to reconnect.");
              stopListening();
            }
          }, 5000);
        } else if (peer.connectionState === "closed") {
          setSessionError("The Realtime connection dropped. Start a new session to reconnect.");
          stopListening();
        } else if (peer.connectionState === "disconnected") {
          setSessionLabel("Reconnecting to OpenAI Realtime");
          if (disconnectTimeoutRef.current !== null) {
            window.clearTimeout(disconnectTimeoutRef.current);
          }
          disconnectTimeoutRef.current = window.setTimeout(() => {
            if (peerConnectionRef.current === peer && peer.connectionState === "disconnected") {
              setSessionError("The Realtime connection dropped. Start a new session to reconnect.");
              stopListening();
            }
          }, 5000);
        }
      };

      peer.oniceconnectionstatechange = () => {
        if (peer.iceConnectionState === "connected" || peer.iceConnectionState === "completed") {
          if (connectTimeoutRef.current !== null) {
            window.clearTimeout(connectTimeoutRef.current);
            connectTimeoutRef.current = null;
          }
          if (disconnectTimeoutRef.current !== null) {
            window.clearTimeout(disconnectTimeoutRef.current);
            disconnectTimeoutRef.current = null;
          }
          setIsConnecting(false);
          setIsListening(true);
          setSessionLabel("OpenAI Realtime live");
        }
      };

      stream.getTracks().forEach(track => peer.addTrack(track, stream));

      const dataChannel = peer.createDataChannel("oai-events");
      dataChannelRef.current = dataChannel;
      dataChannel.onopen = () => {
        if (connectTimeoutRef.current !== null) {
          window.clearTimeout(connectTimeoutRef.current);
          connectTimeoutRef.current = null;
        }
        setIsListening(true);
        setIsConnecting(false);
        setSessionLabel("OpenAI Realtime live");
      };
      dataChannel.onclose = () => {
        setIsListening(false);
      };
      dataChannel.onerror = () => {
        setSessionError("The Realtime data channel closed unexpectedly.");
      };
      dataChannel.onmessage = (message) => {
        try {
          handleRealtimeEvent(JSON.parse(message.data) as RealtimeEvent);
        } catch (error) {
          console.error("Invalid realtime event:", error);
        }
      };

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await waitForUsableIceCandidate(peer);

      connectTimeoutRef.current = window.setTimeout(() => {
        if (!hasConnectedOnceRef.current && peerConnectionRef.current === peer) {
          setSessionError(buildRealtimeConnectError(peer));
          stopListening();
        }
      }, DEFAULT_REALTIME_CONNECT_TIMEOUT_MS);

      const res = await fetch(resolveApiUrl("/api/realtime/engage-session"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerSdp: peer.localDescription?.sdp ?? offer.sdp,
          advisorName: selectedMeeting.leadName,
          advisorCompany: selectedMeeting.leadCompany,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Failed to create Realtime session");
      }

      const data = await res.json() as { answerSdp?: string; ephemeralKey?: string; webrtcUrl?: string };

      if (data.answerSdp) {
        await peer.setRemoteDescription({
          type: "answer",
          sdp: data.answerSdp,
        });
      } else if (data.ephemeralKey && data.webrtcUrl) {
        const answerRes = await fetch(data.webrtcUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${data.ephemeralKey}`,
            "Content-Type": "application/sdp",
          },
          body: peer.localDescription?.sdp ?? offer.sdp ?? "",
        });

        if (!answerRes.ok) {
          const errorText = await answerRes.text();
          throw new Error(parseRequestError(errorText || "Realtime WebRTC connect failed"));
        }

        const answerSdp = await answerRes.text();
        if (!answerSdp) throw new Error("Realtime answer SDP missing");

        await peer.setRemoteDescription({
          type: "answer",
          sdp: answerSdp,
        });
      } else {
        throw new Error("Realtime session metadata missing");
      }
    } catch (error) {
      console.error("Failed to start Engage Me realtime session:", error);
      setSessionError(error instanceof Error ? error.message : "Could not start OpenAI Realtime.");
      stopListening();
    }
  }, [handleRealtimeEvent, isConnecting, isListening, selectedMeeting, stopListening]);

  useEffect(() => () => {
    if (noFundTimerRef.current) clearTimeout(noFundTimerRef.current);
  }, []);

  const manualShow = (ticker: string, dataType: DataType) => {
    pushDisplay({
      ticker,
      dataType,
      insight: "",
      triggeredAt: Date.now(),
    });
  };

  const fund = currentDisplay ? ETF_DATA[currentDisplay.ticker] : null;
  const latestSummary = currentDisplay
    ? `${currentDisplay.ticker} ${DATA_TYPE_LABELS[currentDisplay.dataType]}`
    : "Waiting for the first fund question";
  const isRecording = isUserSpeaking;
  const isAnalyzing = isConnecting;

  // Cleanup on unmount
  useEffect(() => () => { stopListening(); }, [stopListening]);

  // ── Meeting selection gate ──────────────────────────────────────────────────
  if (!selectedMeeting) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto pt-16 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
              <Activity className="w-5 h-5 text-rose-500" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-white">My Engage</h1>
              <p className="text-sm text-muted-foreground">OpenAI Realtime listener that surfaces Capital Group fund data as the meeting unfolds</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-white/70 px-1">Select meeting to start</p>
            {meetings.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground/50">No scheduled meetings found</div>
            ) : meetings.map(m => (
              <button
                key={m.id}
                onClick={() => setSelectedMeetingId(m.id)}
                className="w-full p-4 rounded-xl bg-background/50 border border-white/5 hover:border-rose-500/30 text-left transition-all flex justify-between items-center group"
              >
                <div>
                  <div className="font-semibold text-white">{m.leadName}</div>
                  <div className="text-sm text-muted-foreground">{m.leadCompany}</div>
                </div>
                <ArrowRightCircle className="w-5 h-5 text-muted-foreground group-hover:text-rose-400 transition-colors" />
              </button>
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  // ── Main interface ──────────────────────────────────────────────────────────
  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-5rem)] max-w-[1400px] mx-auto gap-0">

        {/* ── Top bar ── */}
        <div className="flex items-center justify-between px-1 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
              {(isListening || isConnecting) && <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full animate-ping" />}
              <Activity className={cn("w-4 h-4 text-rose-500", (isListening || isConnecting) && "animate-pulse")} />
            </div>
            <div>
              <h1 className="text-xl font-display font-bold text-white leading-tight">My Engage</h1>
              <p className="text-xs text-muted-foreground">Live with <span className="text-white font-medium">{selectedMeeting.leadName}</span></p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {(isListening || isConnecting) && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/25">
                <div className={cn("w-2 h-2 rounded-full bg-rose-400", (isConnecting || isUserSpeaking) && "animate-ping")} />
                <span className="text-xs font-semibold text-rose-300">
                  {isConnecting ? "Connecting..." : isUserSpeaking ? "Listening..." : sessionLabel}
                </span>
              </div>
            )}

            {isListening ? (
              <Button
                onClick={() => stopListening({ completed: true })}
                className="bg-white/8 hover:bg-white/12 text-white/60 hover:text-white h-9 px-4 text-sm border border-white/10"
              >
                End Session
              </Button>
            ) : (
              <Button
                onClick={startListening}
                disabled={isConnecting}
                className="bg-rose-500 hover:bg-rose-400 text-white h-9 px-5 text-sm font-semibold shadow-lg shadow-rose-500/25 disabled:opacity-70"
              >
                {isConnecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Radio className="w-4 h-4 mr-2" />}
                {isConnecting ? "Opening Realtime" : "Start Realtime Session"}
              </Button>
            )}
          </div>
        </div>

        {/* ── Main content ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pb-4 shrink-0">
          {[
            {
              label: "Mode",
              value: "OpenAI Realtime",
              sub: isListening ? "Continuous WebRTC listening" : "Ready to connect",
            },
            {
              label: "Last Heard",
              value: recentTranscript || "Waiting for live audio",
              sub: noFundMsg || sessionError || "Transcript updates after each detected speech turn",
            },
            {
              label: "Latest Pull",
              value: latestSummary,
              sub: `Updated ${formatTimestamp(lastUpdateAt)}`,
            },
          ].map((card) => (
            <div key={card.label} className="rounded-2xl border border-white/8 bg-card/30 px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/55 font-semibold mb-2">{card.label}</p>
              <p className="text-sm font-semibold text-white leading-snug">{card.value}</p>
              <p className="text-xs text-muted-foreground/70 mt-1">{card.sub}</p>
            </div>
          ))}
        </div>

        <div className="flex-1 flex gap-4 min-h-0">

          {/* Visualization area */}
          <div className="flex-1 flex flex-col gap-3 min-h-0">

            <AnimatePresence mode="wait">
              {!currentDisplay ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 flex flex-col items-center justify-center rounded-2xl border border-white/8 bg-card/20 text-center gap-5"
                >
                  <div className="w-20 h-20 rounded-2xl bg-rose-500/5 border border-rose-500/10 flex items-center justify-center">
                    <Radio className="w-10 h-10 text-rose-500/20" />
                  </div>
                  <div>
                    <p className="text-white/40 text-lg font-medium mb-1">
                      {isListening
                        ? isRecording ? "Listening to the live conversation..."
                        : isAnalyzing ? "Opening the OpenAI Realtime session..."
                        : noFundMsg || "Waiting for an ETF question"
                        : "Start a session to activate"}
                    </p>
                    <p className="text-white/25 text-sm">
                      {isListening
                        ? 'Try questions like "What are CGUS top holdings?" or "How has CGCP performed?"'
                        : "Press Start Realtime Session and the agent will listen continuously"
                      }
                    </p>
                  </div>
                  {/* Ticker chips as hints */}
                  <div className="flex gap-2 flex-wrap justify-center">
                    {Object.values(ETF_DATA).map(f => (
                      <span key={f.ticker} className={`px-3 py-1 rounded-full text-xs font-bold ${f.bgClass} border ${f.borderClass}`} style={{ color: f.color }}>
                        {f.ticker}
                      </span>
                    ))}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key={`${currentDisplay.ticker}-${currentDisplay.dataType}-${currentDisplay.triggeredAt}`}
                  initial={{ opacity: 0, scale: 0.98, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.25 }}
                  className="flex-1 min-h-0 flex flex-col rounded-2xl border overflow-hidden"
                  style={{ borderColor: fund!.color + "40", background: `radial-gradient(ellipse at top left, ${fund!.color}08, transparent 60%), #0d1117` }}
                >
                  {/* Panel header */}
                  <div className="flex items-center justify-between px-6 py-4 border-b shrink-0" style={{ borderColor: fund!.color + "20" }}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl ${fund!.bgClass} border ${fund!.borderClass} flex items-center justify-center`}>
                        <span className="text-sm font-black" style={{ color: fund!.color }}>{fund!.ticker}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-white">{fund!.name}</span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${fund!.bgClass} border ${fund!.borderClass}`} style={{ color: fund!.color }}>
                            {DATA_TYPE_LABELS[currentDisplay.dataType]}
                          </span>
                        </div>
                        {currentDisplay.insight && (
                          <p className="text-sm text-muted-foreground/70 mt-0.5">{currentDisplay.insight}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold">Live Briefing</p>
                      <p className="text-xs text-white/65">{formatTimestamp(currentDisplay.triggeredAt)}</p>
                    </div>
                  </div>

                  {/* Panel body */}
                  <div className="flex-1 overflow-auto p-6 min-h-0">
                    {currentDisplay.dataType === "overview"     && <OverviewPanel fund={fund!} />}
                    {currentDisplay.dataType === "holdings"     && <HoldingsPanel fund={fund!} />}
                    {currentDisplay.dataType === "performance"  && <PerformancePanel fund={fund!} />}
                    {currentDisplay.dataType === "composition"  && <CompositionPanel fund={fund!} />}
                    {currentDisplay.dataType === "stats"        && <StatsPanel fund={fund!} />}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Manual selector bar */}
            <div className="shrink-0 bg-card/40 border border-white/8 rounded-2xl px-4 py-3 flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground/50 shrink-0">
                <Mic className="w-3.5 h-3.5" />
                {sessionError ? (
                  <span className="text-rose-300/80 max-w-[280px] truncate">{sessionError}</span>
                ) : noFundMsg ? (
                  <span className="text-amber-400/70 max-w-[240px] truncate">{noFundMsg}</span>
                ) : recentTranscript ? (
                  <span className="text-white/50 italic max-w-[240px] truncate">"{recentTranscript}"</span>
                ) : (
                  <span>Manual override below</span>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {Object.values(ETF_DATA).map(f => (
                  <button
                    key={f.ticker}
                    onClick={() => manualShow(f.ticker, currentDisplay?.ticker === f.ticker ? (currentDisplay.dataType) : "overview")}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-bold border transition-all",
                      currentDisplay?.ticker === f.ticker
                        ? `${f.bgClass} ${f.borderClass}`
                        : "bg-white/4 border-white/10 text-white/50 hover:text-white hover:bg-white/8"
                    )}
                    style={currentDisplay?.ticker === f.ticker ? { color: f.color } : {}}
                  >
                    {f.ticker}
                  </button>
                ))}
              </div>

              <div className="h-4 w-px bg-white/10 shrink-0" />

              <div className="flex items-center gap-1.5 flex-wrap">
                {(Object.keys(DATA_TYPE_LABELS) as DataType[]).map(dt => {
                  const Icon = DATA_TYPE_ICONS[dt];
                  return (
                    <button
                      key={dt}
                      onClick={() => currentDisplay && manualShow(currentDisplay.ticker, dt)}
                      disabled={!currentDisplay}
                      className={cn(
                        "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all",
                        currentDisplay?.dataType === dt
                          ? "bg-white/10 border-white/20 text-white"
                          : "bg-white/3 border-white/8 text-muted-foreground hover:text-white hover:bg-white/6 disabled:opacity-30 disabled:cursor-not-allowed"
                      )}
                    >
                      <Icon className="w-3 h-3" />
                      {DATA_TYPE_LABELS[dt]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Right sidebar: history + fund quick-nav ── */}
          <div className="w-52 shrink-0 flex flex-col gap-3">
            {/* Fund quick buttons */}
            <div className="rounded-xl border border-white/8 bg-card/30 overflow-hidden">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50 font-semibold px-3 pt-3 pb-2">Funds</p>
              {Object.values(ETF_DATA).map(f => (
                <button
                  key={f.ticker}
                  onClick={() => manualShow(f.ticker, "overview")}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-all border-t border-white/5",
                    currentDisplay?.ticker === f.ticker ? `${f.bgClass}` : "hover:bg-white/4"
                  )}
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: f.color + "22" }}>
                    <span className="text-[10px] font-black" style={{ color: f.color }}>{f.ticker}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{f.ticker}</p>
                    <p className="text-[10px] text-muted-foreground/60 truncate">{f.category.split(" ").slice(0, 3).join(" ")}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* History */}
            {displayHistory.length > 0 && (
              <div className="rounded-xl border border-white/8 bg-card/30 overflow-hidden flex-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50 font-semibold px-3 pt-3 pb-2">History</p>
                <div className="overflow-y-auto">
                  {displayHistory.map((d, i) => {
                    const f = ETF_DATA[d.ticker];
                    const Icon = DATA_TYPE_ICONS[d.dataType];
                    return (
                      <button
                        key={i}
                        onClick={() => setCurrentDisplay(d)}
                        className="w-full flex items-center gap-2 px-3 py-2 border-t border-white/5 hover:bg-white/4 transition-all text-left"
                      >
                        <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: f.color + "22" }}>
                          <span className="text-[9px] font-black" style={{ color: f.color }}>{d.ticker}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-semibold text-white/70">{d.ticker}</p>
                          <div className="flex items-center gap-1">
                            <Icon className="w-2.5 h-2.5 text-muted-foreground/40" />
                            <p className="text-[9px] text-muted-foreground/50">{DATA_TYPE_LABELS[d.dataType]}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Next step CTA */}
        <AnimatePresence>
          {sessionCompleted && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="shrink-0 mt-3 flex items-center justify-between gap-4 bg-amber-500/5 border border-amber-500/25 rounded-2xl p-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center shrink-0">
                  <CheckSquare className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Session complete · Next step</p>
                  <p className="text-sm font-semibold text-white">My Follow up — Turn this meeting into action items</p>
                </div>
              </div>
              <Button asChild className="shrink-0 bg-amber-500 hover:bg-amber-400 text-white shadow-lg shadow-amber-500/20 h-9 text-sm">
                <Link href="/follow-me">
                  Proceed <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Link>
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </Layout>
  );
}
