"use client";

type MonthData = { month: string; earned: number; unpaid: number };

export function RevenueChart({ data }: { data: MonthData[] }) {
  const max = Math.max(...data.map(d => d.earned + d.unpaid), 1);
  const W = 600, H = 200, PAD = 40, BAR_W = 28, GAP = (W - PAD * 2) / data.length;

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H + 40}`} className="w-full min-w-[400px]">
        {/* Grid lines */}
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

        {/* Bars */}
        {data.map((d, i) => { // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const x = PAD + i * GAP + GAP / 2 - BAR_W / 2;
          const earnedH = (d.earned / max) * H;
          const unpaidH = (d.unpaid / max) * H;
          return (
            <g key={i}>
              {/* Unpaid bar (stacked on top) */}
              {d.unpaid > 0 && (
                <rect
                  x={x} y={PAD + H - earnedH - unpaidH}
                  width={BAR_W} height={unpaidH}
                  fill="#f97316" fillOpacity={0.7} rx={2}
                />
              )}
              {/* Earned bar */}
              {d.earned > 0 && (
                <rect
                  x={x} y={PAD + H - earnedH}
                  width={BAR_W} height={earnedH}
                  fill="#7c3aed" rx={2}
                />
              )}
              {/* Month label */}
              <text x={x + BAR_W / 2} y={PAD + H + 16} fontSize={10} textAnchor="middle" fill="currentColor" fillOpacity={0.5}>
                {d.month}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex gap-4 mt-1 px-1">
        <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <span className="w-3 h-3 rounded-sm bg-violet-600 inline-block" /> Earned
        </span>
        <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <span className="w-3 h-3 rounded-sm bg-orange-400 inline-block" /> Unpaid
        </span>
      </div>
    </div>
  );
}
