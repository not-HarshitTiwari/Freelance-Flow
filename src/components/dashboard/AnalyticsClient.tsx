"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IndianRupee, TrendingUp, Receipt, BarChart3, ChevronDown } from "lucide-react";
import { AdBanner } from "@/components/ads/AdBanner";

type InvItem = { description: string; quantity: number; rate: number; product_id?: string | null };
type InvRow = {
  total: number;
  status: string;
  invoice_date: string;
  created_at: string;
  customer_name: string | null;
  customer_company: string | null;
  amount_paid: number | null;
  items: InvItem[] | null;
  invoice_type?: string | null;
};
type ExpRow = { amount: number; date: string; category: string };
type ProductRow = { id: string; name: string; margin_pct: number | null };

const RANGES = [
  { label: "3M", months: 3 },
  { label: "6M", months: 6 },
  { label: "12M", months: 12 },
  { label: "24M", months: 24 },
];

const STATUS_COLORS: Record<string, string> = {
  paid: "#16a34a",
  partial: "#d97706",
  unpaid: "#7c3aed",
  overdue: "#dc2626",
};

const CHART_OPTIONS = [
  { value: "rev_exp", label: "Revenue vs Expenses" },
  { value: "cash_flow", label: "Monthly Cash Flow" },
  { value: "by_client", label: "Revenue by Client" },
  { value: "by_product", label: "Revenue by Product" },
  { value: "by_category", label: "Expenses by Category" },
  { value: "inv_status", label: "Invoice Status" },
];

function earnedFor(i: InvRow) {
  return i.status === "paid" ? i.total : i.status === "partial" ? (i.amount_paid ?? 0) : 0;
}

function itemAmount(item: InvItem) {
  return (item.quantity || 0) * (item.rate || 0);
}

function fmt(n: number) {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

function useElementSize<T extends HTMLElement>(fallback: { width: number; height: number }) {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState(fallback);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, size };
}

function GroupedBarChart({
  data,
  width = 500,
  height = 180,
}: {
  data: { month: string; revenue: number; expenses: number }[];
  width?: number;
  height?: number;
}) {
  const maxVal = Math.max(...data.flatMap(d => [d.revenue, d.expenses]), 1);
  const H = height, W = width, PAD_L = 46, PAD_B = 28, PAD_T = 20, PAD_R = 8;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_B - PAD_T;
  const groupW = chartW / (data.length || 1);
  const barW = Math.min(groupW * 0.35, 20);
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const fs = Math.max(7, Math.min(12, H * 0.032));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
      {ticks.map(t => {
        const v = maxVal * t;
        const y = PAD_T + chartH - t * chartH;
        return (
          <g key={t}>
            <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="currentColor" strokeOpacity={0.12} strokeWidth="0.5" />
            <text x={PAD_L - 3} y={y + 3} textAnchor="end" fontSize={fs} fill="currentColor" fillOpacity={0.45}>
              {v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0)}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const cx = PAD_L + i * groupW + groupW / 2;
        const revH = Math.max((d.revenue / maxVal) * chartH, d.revenue > 0 ? 1 : 0);
        const expH = Math.max((d.expenses / maxVal) * chartH, d.expenses > 0 ? 1 : 0);
        return (
          <g key={d.month}>
            <rect x={cx - barW - 1} y={PAD_T + chartH - revH} width={barW} height={revH} fill="#7c3aed" rx={2} />
            <rect x={cx + 1} y={PAD_T + chartH - expH} width={barW} height={expH} fill="#f87171" rx={2} />
            <text x={cx} y={H - 6} textAnchor="middle" fontSize={fs} fill="currentColor" fillOpacity={0.45}>{d.month}</text>
          </g>
        );
      })}
      <rect x={PAD_L} y={5} width={fs * 1.1} height={fs * 1.1} fill="#7c3aed" rx={1.5} />
      <text x={PAD_L + fs * 1.4} y={fs + 3} fontSize={fs} fill="currentColor" fillOpacity={0.6}>Revenue</text>
      <rect x={PAD_L + fs * 9.5} y={5} width={fs * 1.1} height={fs * 1.1} fill="#f87171" rx={1.5} />
      <text x={PAD_L + fs * 10.9} y={fs + 3} fontSize={fs} fill="currentColor" fillOpacity={0.6}>Expenses</text>
    </svg>
  );
}

function CashFlowChart({
  data,
  width = 500,
  height = 180,
}: {
  data: { month: string; net: number }[];
  width?: number;
  height?: number;
}) {
  const maxAbs = Math.max(...data.map(d => Math.abs(d.net)), 1);
  const H = height, W = width, PAD_L = 50, PAD_B = 28, PAD_T = 16, PAD_R = 8;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_B - PAD_T;
  const zeroY = PAD_T + chartH / 2;
  const barW = Math.min((chartW / (data.length || 1)) * 0.55, 28);
  const fs = Math.max(7, Math.min(12, H * 0.032));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
      <line x1={PAD_L} y1={zeroY} x2={W - PAD_R} y2={zeroY} stroke="currentColor" strokeOpacity={0.3} strokeWidth="0.8" strokeDasharray="4,3" />
      <text x={PAD_L - 3} y={zeroY + 3} textAnchor="end" fontSize={fs} fill="currentColor" fillOpacity={0.45}>0</text>
      {data.map((d, i) => {
        const cx = PAD_L + (i + 0.5) * (chartW / (data.length || 1));
        const half = chartH / 2;
        const h = Math.max(Math.min(Math.abs(d.net) / maxAbs * half, half), d.net !== 0 ? 1 : 0);
        const y = d.net >= 0 ? zeroY - h : zeroY;
        return (
          <g key={d.month}>
            <rect x={cx - barW / 2} y={y} width={barW} height={h} fill={d.net >= 0 ? "#16a34a" : "#dc2626"} rx={2} />
            <text x={cx} y={H - 6} textAnchor="middle" fontSize={fs} fill="currentColor" fillOpacity={0.45}>{d.month}</text>
            {Math.abs(d.net) >= 100 && (
              <text x={cx} y={d.net >= 0 ? y - 2 : y + h + 8} textAnchor="middle" fontSize={Math.max(6.5, fs * 0.9)} fill={d.net >= 0 ? "#16a34a" : "#dc2626"}>
                {d.net >= 0 ? "+" : ""}{(d.net / 1000).toFixed(0)}k
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function HBarChart({ items }: { items: { label: string; amount: number; color: string }[] }) {
  const max = Math.max(...items.map(i => i.amount), 1);
  return (
    <div className="space-y-3">
      {items.slice(0, 10).map(item => (
        <div key={item.label}>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-700 dark:text-gray-300 font-medium truncate max-w-[62%]">{item.label}</span>
            <span className="text-gray-900 dark:text-white font-semibold shrink-0 ml-2">{fmt(item.amount)}</span>
          </div>
          <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${(item.amount / max) * 100}%`, backgroundColor: item.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function DonutChart({
  slices,
  size = 144,
}: {
  slices: { label: string; value: number; color: string; count: number }[];
  size?: number;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const R = 68, r = 38, CX = 88, CY = 88;
  let angle = -Math.PI / 2;

  const paths = slices.map(s => {
    const sweep = (s.value / total) * Math.PI * 2;
    const clamped = Math.min(sweep, Math.PI * 2 - 0.001);
    const ox1 = CX + R * Math.cos(angle);
    const oy1 = CY + R * Math.sin(angle);
    const ix1 = CX + r * Math.cos(angle);
    const iy1 = CY + r * Math.sin(angle);
    angle += clamped;
    const ox2 = CX + R * Math.cos(angle);
    const oy2 = CY + R * Math.sin(angle);
    const ix2 = CX + r * Math.cos(angle);
    const iy2 = CY + r * Math.sin(angle);
    const la = clamped > Math.PI ? 1 : 0;
    const d = `M${ox1},${oy1} A${R},${R} 0 ${la} 1 ${ox2},${oy2} L${ix2},${iy2} A${r},${r} 0 ${la} 0 ${ix1},${iy1} Z`;
    return { d, ...s };
  });

  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg viewBox="0 0 176 176" style={{ width: size, height: size }} className="shrink-0">
        {slices.length === 1 ? (
          <>
            <circle cx={CX} cy={CY} r={R} fill={slices[0].color} />
            <circle cx={CX} cy={CY} r={r} fill="white" className="dark:fill-gray-900" />
          </>
        ) : (
          paths.map((p, i) => (
            <path key={i} d={p.d} fill={p.color} stroke="white" strokeWidth={1.5} className="dark:stroke-gray-900" />
          ))
        )}
      </svg>
      <div className="space-y-2 min-w-0">
        {slices.map(s => (
          <div key={s.label} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-gray-700 dark:text-gray-300 capitalize font-medium">{s.label}</span>
            <span className="text-gray-400 dark:text-gray-500">({s.count})</span>
            <span className="text-gray-900 dark:text-white font-semibold ml-auto pl-3">{fmt(s.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AnalyticsClient({
  invoices,
  expenses,
  products,
  isFree,
}: {
  invoices: InvRow[];
  expenses: ExpRow[];
  products: ProductRow[];
  isFree: boolean;
}) {
  const marginByProduct = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of products) map[p.id] = p.margin_pct ?? 100;
    return map;
  }, [products]);

  const [rangeMonths, setRangeMonths] = useState(6);
  const [useCustom, setUseCustom] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [chartType, setChartType] = useState("rev_exp");

  const { cutoff, endCutoff } = useMemo(() => {
    if (useCustom && fromDate) {
      return {
        cutoff: new Date(fromDate),
        endCutoff: toDate ? new Date(toDate + "T23:59:59") : new Date(),
      };
    }
    const d = new Date();
    d.setMonth(d.getMonth() - rangeMonths + 1);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return { cutoff: d, endCutoff: new Date() };
  }, [rangeMonths, useCustom, fromDate, toDate]);

  const rangeInvoices = useMemo(
    () => invoices.filter(i => {
      if (i.invoice_type === "proforma") return false;
      const dt = new Date(i.invoice_date || i.created_at);
      return dt >= cutoff && dt <= endCutoff;
    }),
    [invoices, cutoff, endCutoff]
  );

  const rangeExpenses = useMemo(
    () => expenses.filter(e => {
      const dt = new Date(e.date);
      return dt >= cutoff && dt <= endCutoff;
    }),
    [expenses, cutoff, endCutoff]
  );

  const totalRevenue = rangeInvoices.reduce((s, i) => s + earnedFor(i), 0);
  const totalExpenses = rangeExpenses.reduce((s, e) => s + e.amount, 0);

  const totalCogs = useMemo(() => {
    let cogs = 0;
    for (const i of rangeInvoices) {
      if (!i.items?.length) continue;
      const earned = earnedFor(i);
      if (earned === 0) continue;
      const ratio = earned / (i.total || 1);
      for (const item of i.items) {
        const revenue = itemAmount(item) * ratio;
        const marginPct = item.product_id ? marginByProduct[item.product_id] ?? 100 : 100;
        cogs += revenue * (1 - marginPct / 100);
      }
    }
    return cogs;
  }, [rangeInvoices, marginByProduct]);

  const netProfit = totalRevenue - totalExpenses - totalCogs;
  const outstanding = rangeInvoices.reduce(
    (s, i) =>
      s +
      (i.status === "unpaid" || i.status === "overdue"
        ? i.total
        : i.status === "partial"
        ? i.total - (i.amount_paid ?? 0)
        : 0),
    0
  );
  const avgInvoiceValue =
    rangeInvoices.length > 0
      ? rangeInvoices.reduce((s, i) => s + i.total, 0) / rangeInvoices.length
      : 0;

  const monthlyData = useMemo(() => {
    const buildMonth = (y: number, m: number, label: string, fromFilter?: Date, toFilter?: Date) => {
      const mInv = invoices.filter(i => {
        if (i.invoice_type === "proforma") return false;
        const dt = new Date(i.invoice_date || i.created_at);
        if (dt.getFullYear() !== y || dt.getMonth() !== m) return false;
        if (fromFilter && dt < fromFilter) return false;
        if (toFilter && dt > toFilter) return false;
        return true;
      });
      const mExp = expenses.filter(e => {
        const dt = new Date(e.date);
        if (dt.getFullYear() !== y || dt.getMonth() !== m) return false;
        if (fromFilter && dt < fromFilter) return false;
        if (toFilter && dt > toFilter) return false;
        return true;
      });
      const rev = mInv.reduce((s, i) => s + earnedFor(i), 0);
      const exp = mExp.reduce((s, e) => s + e.amount, 0);
      return { month: label, revenue: rev, expenses: exp, net: rev - exp };
    };

    if (useCustom && fromDate && toDate) {
      const from = new Date(fromDate);
      const to = new Date(toDate + "T23:59:59");
      const result = [];
      const cur = new Date(from.getFullYear(), from.getMonth(), 1);
      while (cur <= to) {
        const y = cur.getFullYear(), m = cur.getMonth();
        const label = cur.toLocaleString("en-IN", { month: "short", year: "2-digit" });
        result.push(buildMonth(y, m, label, from, to));
        cur.setMonth(cur.getMonth() + 1);
      }
      return result;
    }

    return Array.from({ length: rangeMonths }, (_, idx) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (rangeMonths - 1 - idx));
      const label = d.toLocaleString("en-IN", {
        month: "short",
        ...(rangeMonths > 12 ? { year: "2-digit" as const } : {}),
      });
      return buildMonth(d.getFullYear(), d.getMonth(), label);
    });
  }, [invoices, expenses, rangeMonths, useCustom, fromDate, toDate]);

  const byClientData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const i of rangeInvoices) {
      const earned = earnedFor(i);
      if (earned > 0) {
        const name = i.customer_name || i.customer_company || "Unknown";
        map[name] = (map[name] || 0) + earned;
      }
    }
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([label, amount]) => ({ label, amount, color: "#7c3aed" }));
  }, [rangeInvoices]);

  const byProductData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const i of rangeInvoices) {
      if (!i.items?.length) continue;
      const earned = earnedFor(i);
      if (earned === 0) continue;
      const ratio = earned / (i.total || 1);
      for (const item of i.items) {
        const name = item.description || "Other";
        map[name] = (map[name] || 0) + itemAmount(item) * ratio;
      }
    }
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([label, amount]) => ({ label, amount, color: "#0ea5e9" }));
  }, [rangeInvoices]);

  const byCategoryData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of rangeExpenses) {
      map[e.category] = (map[e.category] || 0) + e.amount;
    }
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([label, amount]) => ({ label, amount, color: "#f87171" }));
  }, [rangeExpenses]);

  const statusSlices = useMemo(() => {
    const map: Record<string, { amount: number; count: number }> = {};
    for (const i of rangeInvoices) {
      const k = i.status || "unpaid";
      if (!map[k]) map[k] = { amount: 0, count: 0 };
      map[k].amount += i.total;
      map[k].count++;
    }
    return Object.entries(map)
      .sort((a, b) => b[1].amount - a[1].amount)
      .map(([label, v]) => ({ label, value: v.amount, count: v.count, color: STATUS_COLORS[label] || "#6b7280" }));
  }, [rangeInvoices]);

  const selectedChart = CHART_OPTIONS.find(o => o.value === chartType) ?? CHART_OPTIONS[0];

  const { ref: chartBoxRef, size: chartBoxSize } = useElementSize<HTMLDivElement>({ width: 500, height: 220 });

  function renderChart() {
    const empty = (msg: string) => (
      <p className="text-sm text-gray-400 text-center py-10">{msg}</p>
    );
    switch (chartType) {
      case "rev_exp":
        return <GroupedBarChart data={monthlyData} width={chartBoxSize.width} height={chartBoxSize.height} />;
      case "cash_flow":
        return (
          <CashFlowChart
            data={monthlyData.map(d => ({ month: d.month, net: d.net }))}
            width={chartBoxSize.width}
            height={chartBoxSize.height}
          />
        );
      case "by_client":
        return byClientData.length > 0
          ? <HBarChart items={byClientData} />
          : empty("No paid revenue in this range");
      case "by_product":
        return byProductData.length > 0
          ? <HBarChart items={byProductData} />
          : empty("No product data — add line items to your invoices");
      case "by_category":
        return byCategoryData.length > 0
          ? <HBarChart items={byCategoryData} />
          : empty("No expenses in this range");
      case "inv_status": {
        const donutSize = Math.max(
          120,
          Math.min(chartBoxSize.height - 40, chartBoxSize.width * 0.4, 480)
        );
        return statusSlices.length > 0
          ? <DonutChart slices={statusSlices} size={donutSize} />
          : empty("No invoices in this range");
      }
      default:
        return null;
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Revenue, expenses and client trends</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            {RANGES.map(r => (
              <button
                key={r.months}
                onClick={() => { setRangeMonths(r.months); setUseCustom(false); }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  !useCustom && rangeMonths === r.months
                    ? "bg-violet-600 text-white"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                }`}
              >
                {r.label}
              </button>
            ))}
            <button
              onClick={() => setUseCustom(true)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                useCustom
                  ? "bg-violet-600 text-white"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              }`}
            >
              Custom
            </button>
          </div>
        </div>
      </div>

      {useCustom && (
        <div className="flex flex-wrap items-center gap-3 mb-6 p-3 bg-gray-50 dark:bg-gray-800/60 rounded-lg border border-gray-200 dark:border-gray-700">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">From</span>
          <input
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            className="h-8 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm px-2 text-gray-900 dark:text-gray-100 outline-none"
          />
          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">to</span>
          <input
            type="date"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            className="h-8 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm px-2 text-gray-900 dark:text-gray-100 outline-none"
          />
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                <IndianRupee size={18} className="text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Revenue</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{fmt(totalRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
                <Receipt size={18} className="text-red-500 dark:text-red-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Expenses</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{fmt(totalExpenses)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                  netProfit >= 0 ? "bg-violet-100 dark:bg-violet-900/40" : "bg-red-100 dark:bg-red-900/40"
                }`}
              >
                <TrendingUp
                  size={18}
                  className={netProfit >= 0 ? "text-violet-600 dark:text-violet-400" : "text-red-500"}
                />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Net Profit</p>
                <p
                  className={`text-xl font-bold ${
                    netProfit >= 0 ? "text-gray-900 dark:text-white" : "text-red-500"
                  }`}
                >
                  {fmt(netProfit)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center">
                <Receipt size={18} className="text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Outstanding</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{fmt(outstanding)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                <BarChart3 size={18} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Avg Invoice Value</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{fmt(avgInvoiceValue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <Receipt size={18} className="text-gray-600 dark:text-gray-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Invoices in range</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{rangeInvoices.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-8">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2 dark:text-white">
              <BarChart3 size={16} className="text-violet-600" />
              {selectedChart.label}
            </CardTitle>
            <div className="relative">
              <select
                value={chartType}
                onChange={e => setChartType(e.target.value)}
                className="h-8 pl-3 pr-7 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer appearance-none outline-none"
              >
                {CHART_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={13}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div
            ref={chartBoxRef}
            className="resize-y overflow-auto rounded-md border border-dashed border-transparent hover:border-gray-200 dark:hover:border-gray-700"
            style={{ height: 260, minHeight: 160, maxHeight: 640 }}
            title="Drag the bottom-right corner to resize"
          >
            {renderChart()}
          </div>
        </CardContent>
      </Card>

      {isFree && <AdBanner format="horizontal" className="mb-8" />}
      {isFree && <AdBanner format="rectangle" className="max-w-sm mx-auto" />}
    </div>
  );
}
