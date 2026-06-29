"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Play, Square, Clock, FileText, Pencil, Download } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type Entry = {
  id: string;
  description: string;
  client_name: string | null;
  hours: number;
  rate: number;
  date: string;
  billed: boolean;
};

const emptyForm = { description: "", client_name: "", hours: "", rate: "", date: new Date().toISOString().slice(0, 10) };

export default function TimeTrackingPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [converting, setConverting] = useState(false);

  // Live timer
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [timerDesc, setTimerDesc] = useState("");
  const [timerClient, setTimerClient] = useState("");
  const [timerRate, setTimerRate] = useState("");
  const startRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();

  const fetchEntries = useCallback(async () => {
    const res = await fetch("/api/time-entries");
    const data = await res.json();
    setEntries(data.entries ?? []);
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  // Restore timer from localStorage on mount (survives page refresh)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ff_timer");
      if (saved) {
        const { startTime, desc, client, rate } = JSON.parse(saved);
        const restoredElapsed = Math.floor((Date.now() - startTime) / 1000);
        startRef.current = startTime;
        setElapsed(restoredElapsed);
        setTimerDesc(desc || "");
        setTimerClient(client || "");
        setTimerRate(rate || "");
        setRunning(true);
      }
    } catch { /* ignore corrupt localStorage */ }
  }, []);

  useEffect(() => {
    if (running) {
      // Only update startRef if not already set from localStorage restore
      if (startRef.current === 0) startRef.current = Date.now() - elapsed * 1000;
      intervalRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 500);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      startRef.current = 0;
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  function fmtElapsed(s: number) {
    const h = Math.floor(s / 3600).toString().padStart(2, "0");
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
    const ss = (s % 60).toString().padStart(2, "0");
    return `${h}:${m}:${ss}`;
  }

  async function stopTimer() {
    setRunning(false);
    localStorage.removeItem("ff_timer");
    if (elapsed < 60) { toast.error("Timer ran for less than a minute — not saved."); setElapsed(0); return; }
    const hours = parseFloat((elapsed / 3600).toFixed(2));
    setSaving(true);
    try {
      const res = await fetch("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: timerDesc || "Timed session", client_name: timerClient || null, hours, rate: parseFloat(timerRate) || 0, date: new Date().toISOString().slice(0, 10) }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success(`Saved ${hours}h`);
      setElapsed(0); setTimerDesc(""); setTimerClient(""); setTimerRate("");
      fetchEntries();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally { setSaving(false); }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const method = editing ? "PATCH" : "POST";
      const body = editing
        ? { id: editing.id, ...form, hours: parseFloat(form.hours), rate: parseFloat(form.rate) || 0 }
        : { ...form, hours: parseFloat(form.hours), rate: parseFloat(form.rate) || 0 };
      const res = await fetch("/api/time-entries", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success(editing ? "Updated!" : "Entry saved!");
      setOpen(false); setEditing(null); setForm(emptyForm);
      fetchEntries();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally { setSaving(false); }
  }

  async function deleteEntry(id: string) {
    await fetch("/api/time-entries", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    toast.success("Deleted");
    fetchEntries();
  }

  async function convertToInvoice() {
    const ids = [...selected];
    const toConvert = entries.filter(e => ids.includes(e.id) && !e.billed);
    if (!toConvert.length) { toast.error("All selected entries are already billed"); return; }
    setConverting(true);
    try {
      const items = toConvert.map(e => ({ description: `${e.description}${e.client_name ? ` (${e.client_name})` : ""} — ${e.hours}h @ ₹${e.rate}/h`, quantity: 1, rate: e.hours * e.rate }));
      const params = encodeURIComponent(JSON.stringify(items));
      await Promise.all(toConvert.map(e => fetch("/api/time-entries", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: e.id, billed: true }) })));
      fetchEntries();
      setSelected(new Set());
      router.push(`/dashboard/invoices?prefill=${params}`);
    } catch { toast.error("Failed to convert"); }
    finally { setConverting(false); }
  }

  function exportCSV() {
    const rows = [["Date", "Description", "Client", "Hours", "Rate (₹/h)", "Value (₹)", "Billed"]];
    for (const e of entries) {
      rows.push([e.date, e.description, e.client_name || "", String(e.hours), String(e.rate), String((e.hours * e.rate).toFixed(2)), e.billed ? "Yes" : "No"]);
    }
    const csv = rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "time-entries.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  function toggleSelect(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const totalHours = entries.reduce((s, e) => s + e.hours, 0);
  const totalValue = entries.reduce((s, e) => s + e.hours * e.rate, 0);
  const unbilledEntries = entries.filter(e => !e.billed);
  const unbilledHours = unbilledEntries.reduce((s, e) => s + e.hours, 0);
  const unbilledValue = unbilledEntries.reduce((s, e) => s + e.hours * e.rate, 0);
  const selectedEntries = entries.filter(e => selected.has(e.id));
  const selectedValue = selectedEntries.reduce((s, e) => s + e.hours * e.rate, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Time Tracking</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Track billable hours and convert to invoices</p>
        </div>
        <div className="flex gap-2">
          {entries.length > 0 && (
            <Button onClick={exportCSV} variant="outline" className="gap-2 h-8 text-sm px-3 dark:border-gray-600 dark:text-gray-300">
              <Download size={15} /> Export CSV
            </Button>
          )}
          <Button onClick={() => { setEditing(null); setForm(emptyForm); setOpen(true); }} className="bg-violet-600 hover:bg-violet-700 text-white gap-2 h-8 text-sm px-3">
            <Plus size={15} /> Log Hours
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Hours", value: `${totalHours.toFixed(1)}h`, color: "text-gray-900 dark:text-white" },
          { label: "Total Value", value: `₹${totalValue.toLocaleString("en-IN")}`, color: "text-gray-900 dark:text-white" },
          { label: "Unbilled Hours", value: `${unbilledHours.toFixed(1)}h`, color: "text-orange-500" },
          { label: "Unbilled Value", value: `₹${unbilledValue.toLocaleString("en-IN")}`, color: "text-orange-500" },
        ].map(s => (
          <Card key={s.label}><CardContent className="p-4"><p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p><p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p></CardContent></Card>
        ))}
      </div>

      {/* Live Timer */}
      <Card className="mb-6 border-violet-200 dark:border-violet-800">
        <CardContent className="p-5">
          <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase mb-3 flex items-center gap-1.5"><Clock size={13} /> Live Timer</p>
          <div className="flex items-end gap-3 flex-wrap">
            <Input placeholder="What are you working on?" value={timerDesc} onChange={e => setTimerDesc(e.target.value)} className="flex-1 min-w-40" disabled={running} />
            <Input placeholder="Client (optional)" value={timerClient} onChange={e => setTimerClient(e.target.value)} className="w-36" disabled={running} />
            <Input type="number" placeholder="Rate ₹/h" value={timerRate} onChange={e => setTimerRate(e.target.value)} className="w-28" disabled={running} />
            <div className="flex items-center gap-3">
              <span className="font-mono text-2xl font-bold text-gray-900 dark:text-white w-28 tabular-nums">{fmtElapsed(elapsed)}</span>
              {!running ? (
                <Button onClick={() => {
                  const startTime = Date.now();
                  startRef.current = startTime;
                  localStorage.setItem("ff_timer", JSON.stringify({ startTime, desc: timerDesc, client: timerClient, rate: timerRate }));
                  setRunning(true);
                }} className="bg-green-600 hover:bg-green-700 text-white gap-1.5" disabled={!timerDesc}>
                  <Play size={14} /> Start
                </Button>
              ) : (
                <Button onClick={stopTimer} className="bg-red-500 hover:bg-red-600 text-white gap-1.5" disabled={saving}>
                  <Square size={14} /> Stop & Save
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between bg-violet-50 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-700 rounded-lg px-4 py-2.5 mb-4">
          <span className="text-sm text-violet-700 dark:text-violet-300 font-medium">{selected.size} selected · ₹{selectedValue.toLocaleString("en-IN")} billable</span>
          <Button onClick={convertToInvoice} disabled={converting} className="bg-violet-600 hover:bg-violet-700 text-white gap-1.5 h-7 text-xs px-3">
            <FileText size={13} /> {converting ? "Converting..." : "Convert to Invoice"}
          </Button>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="text-center py-20 text-gray-400 dark:text-gray-600">
          <Clock size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium dark:text-gray-400">No time entries yet</p>
          <p className="text-sm">Start the timer or log hours manually</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map(e => (
            <Card key={e.id} className={`transition-colors ${selected.has(e.id) ? "border-violet-400 dark:border-violet-600 bg-violet-50/50 dark:bg-violet-900/10" : ""}`}>
              <CardContent className="p-4 flex items-center gap-3">
                <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggleSelect(e.id)} className="w-4 h-4 accent-violet-600" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">{e.description}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {e.client_name && `${e.client_name} · `}
                    {e.hours}h · ₹{e.rate}/h · {new Date(e.date).toLocaleDateString("en-IN")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gray-900 dark:text-white">₹{(e.hours * e.rate).toLocaleString("en-IN")}</span>
                  <Badge className={e.billed ? "bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-300" : "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-300"}>
                    {e.billed ? "Billed" : "Unbilled"}
                  </Badge>
                  <button onClick={() => { setEditing(e); setForm({ description: e.description, client_name: e.client_name || "", hours: String(e.hours), rate: String(e.rate), date: e.date }); setOpen(true); }} className="text-gray-400 hover:text-violet-600 dark:hover:text-violet-400"><Pencil size={14} /></button>
                  <button onClick={() => deleteEntry(e.id)} className="text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) { setEditing(null); setForm(emptyForm); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editing ? "Edit Entry" : "Log Hours"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-3">
            <div className="space-y-1.5"><Label>Description *</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="UI design, API integration…" required /></div>
            <div className="space-y-1.5"><Label>Client</Label><Input value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })} placeholder="Acme Corp" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Hours *</Label><Input type="number" step="0.25" min="0.25" value={form.hours} onChange={e => setForm({ ...form, hours: e.target.value })} placeholder="2.5" required /></div>
              <div className="space-y-1.5"><Label>Rate (₹/h)</Label><Input type="number" min="0" value={form.rate} onChange={e => setForm({ ...form, rate: e.target.value })} placeholder="2000" /></div>
            </div>
            <div className="space-y-1.5"><Label>Date *</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required /></div>
            <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-700 text-white" disabled={saving}>{saving ? "Saving…" : editing ? "Save Changes" : "Log Entry"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
