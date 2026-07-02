"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Copy, Key, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { usePlan, planAtLeast } from "@/lib/plan-context";

type ApiKey = {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
  scopes: string[];
};

const SCOPE_OPTIONS = ["read", "write", "invoices", "expenses", "quotes", "clients"];

export default function ApiKeysPage() {
  const planCtx = usePlan();
  const canUse = planAtLeast(planCtx, "pro");

  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["read"]);
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    fetch("/api/api-keys")
      .then(r => r.json())
      .then(d => { setKeys(d.keys || []); setLoading(false); });
  }, []);

  async function createKey() {
    if (!name.trim()) return;
    setCreating(true);
    const res = await fetch("/api/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, scopes }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) { toast.error(data.error); return; }
    setNewKey(data.key);
    setShowKey(true);
    setName("");
    setScopes(["read"]);
    // reload list
    fetch("/api/api-keys").then(r => r.json()).then(d => setKeys(d.keys || []));
  }

  async function revokeKey(id: string) {
    if (!confirm("Revoke this API key? Any integrations using it will stop working.")) return;
    const res = await fetch("/api/api-keys", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setKeys(ks => ks.filter(k => k.id !== id));
      toast.success("Key revoked");
    } else {
      const d = await res.json();
      toast.error(d.error);
    }
  }

  function toggleScope(s: string) {
    setScopes(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">API Keys</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Generate keys for external integrations. Keys are shown once — store them securely.
        </p>
      </div>

      {!canUse ? (
        <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20 p-6 text-center">
          <Key size={32} className="mx-auto mb-3 text-violet-400" />
          <p className="font-semibold text-violet-700 dark:text-violet-300">Pro or Advanced plan required</p>
          <p className="text-sm text-violet-600 dark:text-violet-400 mt-1">Upgrade to create API keys for integrations.</p>
        </div>
      ) : (
        <>
          {/* New key revealed */}
          {newKey && (
            <div className="rounded-xl border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 p-4 mb-6">
              <p className="text-sm font-semibold text-green-700 dark:text-green-400 mb-2">
                Your new API key — copy it now. It won&apos;t be shown again.
              </p>
              <div className="flex gap-2 items-center">
                <code className="flex-1 text-xs bg-white dark:bg-gray-800 border dark:border-gray-700 rounded px-3 py-2 font-mono truncate">
                  {showKey ? newKey : "•".repeat(newKey.length)}
                </code>
                <button onClick={() => setShowKey(v => !v)} className="p-2 text-gray-400 hover:text-gray-600">
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <button onClick={() => { navigator.clipboard.writeText(newKey); toast.success("Copied!"); }} className="p-2 text-gray-400 hover:text-gray-600">
                  <Copy size={16} />
                </button>
              </div>
              <button onClick={() => setNewKey(null)} className="text-xs text-gray-400 mt-2 underline">Dismiss</button>
            </div>
          )}

          {/* Create form */}
          <div className="rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-900 p-5 mb-6 space-y-4">
            <h2 className="font-semibold text-gray-900 dark:text-white text-sm">Create new key</h2>
            <div className="space-y-1">
              <Label>Name</Label>
              <Input placeholder="e.g. Zapier integration" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Scopes</Label>
              <div className="flex flex-wrap gap-2">
                {SCOPE_OPTIONS.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleScope(s)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${scopes.includes(s) ? "bg-violet-600 text-white border-violet-600" : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-violet-400"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={createKey} disabled={creating || !name.trim()} className="bg-violet-600 hover:bg-violet-700 text-white gap-2">
              <Plus size={14} /> {creating ? "Creating..." : "Create Key"}
            </Button>
          </div>

          {/* Key list */}
          {loading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />)}</div>
          ) : keys.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-600 text-center py-10">No API keys yet.</p>
          ) : (
            <div className="space-y-3">
              {keys.map(k => (
                <div key={k.id} className="rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-900 p-4 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Key size={13} className="text-violet-500 shrink-0" />
                      <span className="font-medium text-sm text-gray-900 dark:text-white truncate">{k.name}</span>
                    </div>
                    <code className="text-xs text-gray-400 font-mono">{k.prefix}••••••••••••••••••••••••</code>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {k.scopes?.map(s => (
                        <Badge key={s} className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">{s}</Badge>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Created {new Date(k.created_at).toLocaleDateString("en-IN")}
                      {k.last_used_at && ` · Last used ${new Date(k.last_used_at).toLocaleDateString("en-IN")}`}
                    </p>
                  </div>
                  <button onClick={() => revokeKey(k.id)} className="text-red-400 hover:text-red-600 p-1 shrink-0">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
