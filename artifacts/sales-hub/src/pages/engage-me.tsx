import { useState, useRef, useCallback, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useMeetings } from "@/hooks/use-meetings";
import { Button } from "@/components/ui/button";
import {
  Loader2, Activity, Mic, MicOff, Radio, ArrowRightCircle,
  ArrowRight, CheckSquare, BarChart3, PieChart, ListOrdered,
  TrendingUp, Info, LayoutGrid,
} from "lucide-react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

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
  BND: {
    name: "Total Bond Market ETF", category: "U.S. Investment-Grade Bond", ticker: "BND",
    price: 73.76, nav: 73.75, expenseRatio: 0.03, secYield: 4.21,
    aum: 146392, fundAum: 384844,
    benchmark: "Bloomberg U.S. Agg Float Adjusted",
    dividendSchedule: "Monthly", inception: "Apr 2007",
    color: "#3b82f6", colorClass: "text-blue-400", bgClass: "bg-blue-500/15", borderClass: "border-blue-500/30",
    description: "Broad exposure to U.S. taxable investment-grade bond market. Intermediate-duration with high credit quality.",
    performance: {
      nav:       { quarter: 0.95, ytd: 7.11, "1y": 7.11, "3y": 4.69, "5y": -0.4, "10y": 2.0,  since: 3.13 },
      benchmark: { quarter: 1.07, ytd: 7.21, "1y": 7.21, "3y": 4.68, "5y": -0.37,"10y": 2.05, since: 3.19 },
    },
    holdings: null,
    compLabel: "By Issuer",
    composition: {
      "By Issuer": [
        { label: "Treasury / Agency", value: 49.2 },
        { label: "Govt Mortgage-Backed", value: 19.5 },
        { label: "Industrial", value: 14.5 },
        { label: "Finance", value: 8.2 },
        { label: "Foreign", value: 3.4 },
        { label: "Utilities", value: 2.5 },
      ],
      "Credit Quality": [
        { label: "U.S. Government", value: 69.3 },
        { label: "BBB", value: 12.4 },
        { label: "A", value: 11.9 },
        { label: "AA", value: 3.3 },
        { label: "AAA", value: 3.1 },
      ],
      "Maturity": [
        { label: "1 – 5 Years", value: 46.9 },
        { label: "5 – 10 Years", value: 32.5 },
        { label: "Over 25 Years", value: 6.8 },
        { label: "15 – 20 Years", value: 5.6 },
        { label: "20 – 25 Years", value: 4.2 },
        { label: "10 – 15 Years", value: 3.3 },
      ],
    },
    stats: {
      "# Bonds": 11444, "Avg Duration": "5.7 yrs", "Avg Maturity": "8.0 yrs", "Turnover": "36.4%",
      "Short Reserves": "0.0%", "Inception": "Apr 2007",
    },
  },
  VTI: {
    name: "Total Stock Market ETF", category: "U.S. Total Stock Market", ticker: "VTI",
    price: 320.34, nav: 320.22, expenseRatio: 0.03, secYield: 1.10,
    aum: 570914, fundAum: 2056590,
    benchmark: "CRSP US Total Market Index",
    dividendSchedule: "Quarterly", inception: "May 2001",
    color: "#10b981", colorClass: "text-emerald-400", bgClass: "bg-emerald-500/15", borderClass: "border-emerald-500/30",
    description: "Large-, mid-, and small-cap equity across growth and value styles. Broadest U.S. equity coverage.",
    performance: {
      nav:       { quarter: 2.44, ytd: 17.14, "1y": 17.14, "3y": 22.25, "5y": 13.08, "10y": 14.25, since: 9.21 },
      benchmark: { quarter: 2.45, ytd: 17.15, "1y": 17.15, "3y": 22.24, "5y": 13.08, "10y": 14.25, since: 9.23 },
    },
    holdings: [
      { name: "NVIDIA Corp.",          pct: 6.6 },
      { name: "Apple Inc.",            pct: 6.1 },
      { name: "Microsoft Corp.",       pct: 5.5 },
      { name: "Alphabet Inc.",         pct: 5.0 },
      { name: "Amazon.com Inc.",       pct: 3.4 },
      { name: "Broadcom Inc.",         pct: 2.5 },
      { name: "Meta Platforms Inc.",   pct: 2.2 },
      { name: "Tesla Inc.",            pct: 1.9 },
      { name: "Berkshire Hathaway",    pct: 1.4 },
      { name: "Eli Lilly & Co.",       pct: 1.4 },
    ],
    topTenPct: 36.0,
    compLabel: "Sectors",
    composition: {
      "Sectors": [
        { label: "Technology",              value: 38.5 },
        { label: "Consumer Discretionary",  value: 13.9 },
        { label: "Industrials",             value: 12.1 },
        { label: "Financials",              value: 11.2 },
        { label: "Health Care",             value:  9.8 },
        { label: "Consumer Staples",        value:  3.4 },
        { label: "Energy",                  value:  3.0 },
      ],
    },
    stats: {
      "# Stocks": 3512, "Median Mkt Cap": "$277B", "P/E Ratio": "27.4×",
      "P/B Ratio": "4.6×", "ROE": "24.0%", "Std Dev": "12.56%",
    },
  },
  VOO: {
    name: "S&P 500 ETF", category: "U.S. Large-Cap Equity", ticker: "VOO",
    price: 608.38, nav: 608.44, expenseRatio: 0.03, secYield: 1.09,
    aum: 839088, fundAum: 1480375,
    benchmark: "S&P 500 Index",
    dividendSchedule: "Quarterly", inception: "Sep 2010",
    color: "#8b5cf6", colorClass: "text-violet-400", bgClass: "bg-violet-500/15", borderClass: "border-violet-500/30",
    description: "Full-replication strategy tracking the S&P 500. Pure large-cap U.S. equity exposure.",
    performance: {
      nav:       { quarter: 2.65, ytd: 17.84, "1y": 17.84, "3y": 22.97, "5y": 14.38, "10y": 14.78, since: 14.82 },
      benchmark: { quarter: 2.66, ytd: 17.88, "1y": 17.88, "3y": 23.01, "5y": 14.42, "10y": 14.82, since: 14.86 },
    },
    holdings: [
      { name: "NVIDIA Corp.",          pct: 7.8 },
      { name: "Apple Inc.",            pct: 6.9 },
      { name: "Microsoft Corp.",       pct: 6.1 },
      { name: "Alphabet Inc.",         pct: 5.6 },
      { name: "Amazon.com Inc.",       pct: 3.8 },
      { name: "Broadcom Inc.",         pct: 2.8 },
      { name: "Meta Platforms Inc.",   pct: 2.5 },
      { name: "Tesla Inc.",            pct: 2.2 },
      { name: "Berkshire Hathaway",    pct: 1.6 },
      { name: "Eli Lilly & Co.",       pct: 1.5 },
    ],
    topTenPct: 40.7,
    compLabel: "Sectors",
    composition: {
      "Sectors": [
        { label: "Information Technology", value: 34.4 },
        { label: "Financials",             value: 13.4 },
        { label: "Comm. Services",         value: 10.6 },
        { label: "Consumer Discretionary", value: 10.4 },
        { label: "Health Care",            value:  9.6 },
        { label: "Industrials",            value:  8.2 },
        { label: "Consumer Staples",       value:  4.7 },
      ],
    },
    stats: {
      "# Stocks": 504, "Median Mkt Cap": "$383B", "P/E Ratio": "28.4×",
      "P/B Ratio": "5.2×", "ROE": "27.0%", "Std Dev": "11.96%",
    },
  },
  VXUS: {
    name: "Total International Stock ETF", category: "International Ex-U.S. Equity", ticker: "VXUS",
    price: 77.25, nav: 77.30, expenseRatio: 0.05, secYield: null,
    aum: 120664, fundAum: 573737,
    benchmark: "FTSE Global All Cap ex US Index",
    dividendSchedule: "Quarterly", inception: "Jan 2011",
    color: "#f59e0b", colorClass: "text-amber-400", bgClass: "bg-amber-500/15", borderClass: "border-amber-500/30",
    description: "Broad exposure across developed and emerging non-U.S. equity markets. 8,600+ stocks globally.",
    performance: {
      nav:       { quarter: 4.51, ytd: 32.23, "1y": 32.23, "3y": 17.14, "5y": 7.98, "10y": 8.55, since: 5.97 },
      benchmark: { quarter: 4.85, ytd: 31.95, "1y": 31.95, "3y": 17.26, "5y": 8.04, "10y": 8.56, since: 6.03 },
    },
    holdings: [
      { name: "Taiwan Semiconductor",  pct: 3.0 },
      { name: "Tencent Holdings",      pct: 1.2 },
      { name: "Samsung Electronics",   pct: 1.1 },
      { name: "ASML Holding NV",       pct: 1.1 },
      { name: "Alibaba Group",         pct: 0.8 },
      { name: "Roche Holding AG",      pct: 0.8 },
      { name: "AstraZeneca plc",       pct: 0.7 },
      { name: "HSBC Holdings",         pct: 0.7 },
      { name: "Novartis AG",           pct: 0.7 },
      { name: "Nestle SA",             pct: 0.6 },
    ],
    topTenPct: 10.8,
    compLabel: "Geography",
    composition: {
      "Geography": [
        { label: "Japan",          value: 15.0 },
        { label: "United Kingdom", value:  9.0 },
        { label: "China",          value:  8.6 },
        { label: "Canada",         value:  8.1 },
        { label: "Taiwan",         value:  6.2 },
        { label: "Switzerland",    value:  5.5 },
        { label: "France",         value:  5.3 },
        { label: "Germany",        value:  5.3 },
      ],
      "Sectors": [
        { label: "Financials",             value: 23.4 },
        { label: "Industrials",            value: 15.6 },
        { label: "Technology",             value: 14.6 },
        { label: "Consumer Discretionary", value: 11.1 },
        { label: "Health Care",            value:  7.7 },
        { label: "Basic Materials",        value:  7.0 },
        { label: "Consumer Staples",       value:  5.5 },
      ],
    },
    stats: {
      "# Stocks": 8646, "Median Mkt Cap": "$48B", "P/E Ratio": "17.1×",
      "P/B Ratio": "2.1×", "ROE": "12.3%", "Std Dev": "11.87%",
    },
  },
  VNQ: {
    name: "Real Estate ETF", category: "U.S. Real Estate (REITs)", ticker: "VNQ",
    price: 88.75, nav: 88.76, expenseRatio: 0.13, secYield: null,
    aum: 33878, fundAum: 64036,
    benchmark: "MSCI US IM Real Estate 25/50 Index",
    dividendSchedule: "Quarterly", inception: "Sep 2004",
    color: "#ec4899", colorClass: "text-pink-400", bgClass: "bg-pink-500/15", borderClass: "border-pink-500/30",
    description: "Equity REITs across health care, retail, industrial, data center, and more. High concentration in top 10.",
    performance: {
      nav:       { quarter: -2.41, ytd: 3.18, "1y": 3.18, "3y": 6.56, "5y": 4.62, "10y": 5.13, since: 7.31 },
      benchmark: { quarter: -2.39, ytd: 3.31, "1y": 3.31, "3y": 6.71, "5y": 4.76, "10y": 5.25, since: 7.35 },
    },
    holdings: [
      { name: "VG Real Estate II Index", pct: 14.5 },
      { name: "Welltower Inc.",          pct:  7.1 },
      { name: "Prologis Inc.",           pct:  6.9 },
      { name: "American Tower Corp.",    pct:  4.8 },
      { name: "Equinix Inc.",            pct:  4.4 },
      { name: "Simon Property Group",    pct:  3.5 },
      { name: "Digital Realty Trust",    pct:  3.1 },
      { name: "Realty Income Corp.",     pct:  3.0 },
      { name: "CBRE Group Inc.",         pct:  2.8 },
      { name: "Public Storage",          pct:  2.4 },
    ],
    topTenPct: 52.4,
    compLabel: "Sub-Industry",
    composition: {
      "Sub-Industry": [
        { label: "Health Care REITs",       value: 15.5 },
        { label: "Retail REITs",            value: 13.8 },
        { label: "Industrial REITs",        value: 11.5 },
        { label: "Telecom Tower REITs",     value:  9.6 },
        { label: "Data Center REITs",       value:  8.7 },
        { label: "Real Estate Services",    value:  8.6 },
        { label: "Multi-Family Residential",value:  7.8 },
      ],
    },
    stats: {
      "# REITs": 152, "Median Mkt Cap": "$30B", "P/E Ratio": "33.1×",
      "P/B Ratio": "2.4×", "ROE": "6.2%", "Std Dev": "17.25%",
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
          <p className="text-sm text-muted-foreground/50 mt-1">BND holdings are temporarily unavailable via Vanguard</p>
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

  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const [currentDisplay, setCurrentDisplay] = useState<FundDisplay | null>(null);
  const [displayHistory, setDisplayHistory] = useState<FundDisplay[]>([]);
  const [recentTranscript, setRecentTranscript] = useState("");
  const [userSpeaking, setUserSpeaking] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const selectedMeeting = meetings.find(m => m.id === selectedMeetingId);

  const handleRealtimeEvent = useCallback((event: Record<string, unknown>) => {
    const type = event.type as string;

    if (type === "input_audio_buffer.speech_started") setUserSpeaking(true);
    if (type === "input_audio_buffer.speech_stopped") setUserSpeaking(false);

    if (type === "conversation.item.input_audio_transcription.completed") {
      const text = (event.transcript as string)?.trim();
      if (text) setRecentTranscript(text);
    }

    if (type === "response.function_call_arguments.done") {
      const name = event.name as string;
      if (name === "show_fund_data") {
        try {
          const args = JSON.parse(event.arguments as string) as {
            ticker: string; dataType: DataType; insight: string;
          };
          if (ETF_DATA[args.ticker]) {
            const display: FundDisplay = {
              ticker: args.ticker,
              dataType: args.dataType,
              insight: args.insight,
              triggeredAt: Date.now(),
            };
            setCurrentDisplay(display);
            setDisplayHistory(prev => [display, ...prev].slice(0, 8));
          }
          const callId = event.call_id as string;
          if (dcRef.current?.readyState === "open") {
            dcRef.current.send(JSON.stringify({
              type: "conversation.item.create",
              item: {
                type: "function_call_output",
                call_id: callId,
                output: JSON.stringify({ success: true }),
              },
            }));
            dcRef.current.send(JSON.stringify({ type: "response.create" }));
          }
        } catch { /* ignore */ }
      }
    }
  }, []);

  const startListening = async () => {
    setIsConnecting(true);
    try {
      const res = await fetch("/api/realtime/engage-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Session failed");
      const { ephemeralKey } = await res.json() as { ephemeralKey: string };

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;
      dc.onmessage = (e) => {
        try { handleRealtimeEvent(JSON.parse(e.data as string) as Record<string, unknown>); }
        catch { /* ignore */ }
      };
      dc.onopen = () => { setIsListening(true); setIsConnecting(false); };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpRes = await fetch(
        "https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${ephemeralKey}`, "Content-Type": "application/sdp" },
          body: offer.sdp,
        }
      );
      if (!sdpRes.ok) throw new Error("SDP failed");
      await pc.setRemoteDescription({ type: "answer", sdp: await sdpRes.text() });
    } catch (err) {
      setIsConnecting(false);
      setIsListening(false);
      console.error("Engage listen failed:", err);
    }
  };

  const stopListening = () => {
    dcRef.current?.close();
    pcRef.current?.close();
    pcRef.current = null; dcRef.current = null;
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    setIsListening(false);
    setUserSpeaking(false);
    setSessionCompleted(true);
  };

  const toggleMute = () => {
    if (!localStreamRef.current) return;
    const next = !isMuted;
    localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !next; });
    setIsMuted(next);
  };

  const manualShow = (ticker: string, dataType: DataType) => {
    const display: FundDisplay = {
      ticker, dataType, insight: "", triggeredAt: Date.now(),
    };
    setCurrentDisplay(display);
    setDisplayHistory(prev => [display, ...prev].slice(0, 8));
  };

  const fund = currentDisplay ? ETF_DATA[currentDisplay.ticker] : null;

  // Cleanup on unmount
  useEffect(() => () => { stopListening(); }, []);

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
              <h1 className="text-2xl font-display font-bold text-white">Engage Me</h1>
              <p className="text-sm text-muted-foreground">Live AI listener — surfaces Vanguard ETF data in real time</p>
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
              {isListening && <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full animate-ping" />}
              <Activity className={cn("w-4 h-4 text-rose-500", isListening && "animate-pulse")} />
            </div>
            <div>
              <h1 className="text-xl font-display font-bold text-white leading-tight">Engage Me</h1>
              <p className="text-xs text-muted-foreground">Live with <span className="text-white font-medium">{selectedMeeting.leadName}</span></p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isListening && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/25">
                <div className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                <span className="text-xs font-semibold text-rose-300">
                  {userSpeaking ? "Hearing you..." : "Listening..."}
                </span>
              </div>
            )}

            {isListening ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleMute}
                  className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center border transition-all",
                    isMuted ? "bg-rose-500/20 border-rose-500/40 text-rose-400" : "bg-white/5 border-white/10 text-white/50 hover:text-white"
                  )}
                >
                  {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
                <Button
                  onClick={stopListening}
                  className="bg-rose-600 hover:bg-rose-500 text-white h-9 px-4 text-sm font-semibold"
                >
                  End Session
                </Button>
              </div>
            ) : (
              <Button
                onClick={startListening}
                disabled={isConnecting}
                className="bg-rose-500 hover:bg-rose-400 text-white h-9 px-5 text-sm font-semibold shadow-lg shadow-rose-500/25"
              >
                {isConnecting
                  ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Connecting...</>
                  : <><Radio className="w-4 h-4 mr-2" />Start Listening</>
                }
              </Button>
            )}
          </div>
        </div>

        {/* ── Main content ── */}
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
                      {isListening ? "Listening to your meeting..." : "Start listening to activate"}
                    </p>
                    <p className="text-white/25 text-sm">
                      {isListening
                        ? 'Try asking about "VOO holdings" or "BND performance"'
                        : "Press Start Listening — the AI will surface fund data as you speak"
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
                {recentTranscript ? (
                  <span className="text-white/50 italic max-w-[200px] truncate">"{recentTranscript}"</span>
                ) : (
                  <span>Manual override ↓</span>
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
                  <p className="text-sm font-semibold text-white">Follow Me — Turn this meeting into action items</p>
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
