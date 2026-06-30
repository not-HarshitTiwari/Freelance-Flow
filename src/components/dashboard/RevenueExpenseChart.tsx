"use client";

type MonthData = { month: string; revenue: number; expenses: number };

export function RevenueExpenseChart({ data }: { data: MonthData[] }) {
  const max = Math.max(...data.map(d => Math.max(d.revenue, d.expenses)), 1);
  const W = 700, H = 200, PAD = 40, BAR_W = 10, BAR_GAP = 3, GAP = (W - PAD * 2) / data.length;

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H + 40}`} className="w-full min-w-[500px]">
        {[0, 0.25, 0.5, 0.75, 1].map((f, fi) => {
          const y = PAD + (1 - f) * H;
          return (
            <g key={fi}>
              <line x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="currentColor" strokeOpacity={0.08} strokeWidth={1} />
              <text x={PAD - 6} y={y + 4} fontSize={9} textAnchor="end" fill="currentColor" fillOpacity={0.4}>
                ₹{((max * f) / 1000).toFixed(0)}k
              </text>
            </g>
          );
        })}

        {data.map((d, i) => {
          const groupCenter = PAD + i * GAP + GAP / 2;
          const revH = (d.revenue / max) * H;
          const expH = (d.expenses / max) * H;
          return (
            <g key={i}>
              <rect
                x={groupCenter - BAR_W - BAR_GAP / 2} y={PAD + H - revH}
                width={BAR_W} height={revH} fill="#7c3aed" rx={2}
              />
              <rect
                x={groupCenter + BAR_GAP / 2} y={PAD + H - expH}
                width={BAR_W} height={expH} fill="#ef4444" rx={2}
              />
              <text x={groupCenter} y={PAD + H + 16} fontSize={10} textAnchor="middle" fill="currentColor" fillOpacity={0.5}>
                {d.month}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="flex gap-4 mt-1 px-1">
        <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <span className="w-3 h-3 rounded-sm bg-violet-600 inline-block" /> Revenue
        </span>
        <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <span className="w-3 h-3 rounded-sm bg-red-500 inline-block" /> Expenses
        </span>
      </div>
    </div>
  );
}
