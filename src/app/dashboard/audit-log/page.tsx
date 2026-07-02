"use client";

import { useState, useEffect, useCallback } from "react";
import { ShieldCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePlan, planAtLeast } from "@/lib/plan-context";

type LogEntry = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  meta: Record<string, unknown>;
  actor_email: string | null;
  created_at: string;
};

const ACTION_COLORS: Record<string, string> = {
  "invoice.create": "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  "invoice.update": "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  "invoice.delete": "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  "quote.create": "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  "quote.update": "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  "quote.delete": "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  "expense.create": "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  "expense.delete": "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  "client.create": "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  "client.delete": "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
};

const PAGE_SIZE = 50;

const ACTION_FILTERS = [
  { label: "All", value: "" },
  { label: "Invoices", value: "invoice" },
  { label: "Quotes", value: "quote" },
  { label: "Expenses", value: "expense" },
  { label: "Clients", value: "client" },
];

export default function AuditLogPage() {
  const planCtx = usePlan();
  const canUse = planAtLeast(planCtx, "advanced");

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [actionFilter, setActionFilter] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
    });
    if (actionFilter) params.set("action", actionFilter);
    fetch(`/api/audit-log?${params}`)
      .then(r => r.json())
      .then(d => { setLogs(d.logs || []); setTotal(d.total || 0); })
      .finally(() => setLoading(false));
  }, [page, actionFilter]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  function metaSummary(entry: LogEntry): string {
    const m = entry.meta;
    if (!m) return "";
    if (m.invoice_number) return `#${m.invoice_number}`;
    if (m.quote_number) return `#${m.quote_number}`;
    if (m.updates && Array.isArray(m.updates)) return `fields: ${(m.updates as string[]).join(", ")}`;
    return entry.entity_id ? entry.entity_id.slice(0, 8) + "…" : "";
  }

  if (!canUse) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <ShieldCheck size={48} className="mx-auto mb-4 text-violet-300" />
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Audit Log</h1>
        <p className="text-gray-500 dark:text-gray-400">Advanced plan required to view the audit log.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Audit Log</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">All workspace actions, newest first</p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {ACTION_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => { setActionFilter(f.value); setPage(0); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize ${actionFilter === f.value ? "bg-violet-600 text-white border-violet-600" : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-violet-400"}`}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-400 dark:text-gray-600 self-center">{total} entries</span>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(10)].map((_, i) => <div key={i} className="h-12 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />)}</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <ShieldCheck size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium dark:text-gray-500">No audit entries yet</p>
          <p className="text-sm">Actions on invoices, quotes, clients will appear here.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border dark:border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-left">
                <th className="px-4 py-3 font-semibold">Time</th>
                <th className="px-4 py-3 font-semibold">Action</th>
                <th className="px-4 py-3 font-semibold">Detail</th>
                <th className="px-4 py-3 font-semibold">Actor</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((entry, i) => (
                <tr key={entry.id} className={`border-t dark:border-gray-700 ${i % 2 === 0 ? "" : "bg-gray-50/40 dark:bg-gray-800/30"}`}>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">
                    {new Date(entry.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={`text-xs font-mono ${ACTION_COLORS[entry.action] || "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}>
                      {entry.action}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300 text-xs font-mono">
                    {metaSummary(entry)}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                    {entry.actor_email || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="gap-1 dark:border-gray-600">
            <ChevronLeft size={14} /> Prev
          </Button>
          <span className="text-sm text-gray-500 dark:text-gray-400">Page {page + 1} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="gap-1 dark:border-gray-600">
            Next <ChevronRight size={14} />
          </Button>
        </div>
      )}
    </div>
  );
}
