"use client";

import { useState, useEffect, useCallback } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "sonner";

type EnrollState = { factorId: string; qrCode: string; secret: string } | null;

export function TwoFactorSettings() {
  const [enabled, setEnabled] = useState(false);
  const [verifiedFactorId, setVerifiedFactorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [enroll, setEnroll] = useState<EnrollState>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{ title: string; desc: string; action: () => void } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.auth.mfa.listFactors();
    const verified = data?.totp?.find(f => f.status === "verified");
    setEnabled(!!verified);
    setVerifiedFactorId(verified?.id || null);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function startEnroll() {
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    if (error || !data) {
      toast.error(error?.message || "Failed to start 2FA setup");
      setBusy(false);
      return;
    }
    setEnroll({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
    setBusy(false);
  }

  async function confirmEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (!enroll) return;
    setBusy(true);
    const supabase = createClient();
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: enroll.factorId });
    if (challengeError || !challenge) {
      toast.error(challengeError?.message || "Failed to verify code");
      setBusy(false);
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({ factorId: enroll.factorId, challengeId: challenge.id, code });
    if (verifyError) {
      toast.error(verifyError.message);
      setBusy(false);
      return;
    }
    toast.success("Two-factor authentication enabled!");
    setEnroll(null);
    setCode("");
    setBusy(false);
    refresh();
  }

  async function disable2FA() {
    if (!verifiedFactorId) return;
    setPendingConfirm({
      title: "Disable 2FA",
      desc: "Disable two-factor authentication? You'll only need your password to sign in.",
      action: async () => {
        setBusy(true);
        const supabase = createClient();
        const { error } = await supabase.auth.mfa.unenroll({ factorId: verifiedFactorId! });
        if (error) toast.error(error.message);
        else toast.success("Two-factor authentication disabled");
        setBusy(false);
        refresh();
      },
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base dark:text-white flex items-center gap-2">
          {enabled ? <ShieldCheck className="h-4 w-4 text-green-600" /> : <ShieldOff className="h-4 w-4 text-gray-400" />}
          Two-Factor Authentication
        </CardTitle>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Require a code from an authenticator app (Google Authenticator, Authy, etc.) in addition to your password.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : enroll ? (
          <form onSubmit={confirmEnroll} className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">Scan this QR code with your authenticator app, then enter the 6-digit code it shows.</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={enroll.qrCode} alt="2FA QR code" className="w-40 h-40 border border-gray-200 dark:border-gray-700 rounded-lg mx-auto" />
            <p className="text-xs text-gray-400 text-center break-all">Or enter manually: {enroll.secret}</p>
            <div className="space-y-2">
              <Label>Authentication Code</Label>
              <Input
                inputMode="numeric"
                placeholder="123456"
                value={code}
                onChange={e => setCode(e.target.value.replace(/[^0-9]/g, ""))}
                maxLength={6}
                required
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => { setEnroll(null); setCode(""); }}>Cancel</Button>
              <Button type="submit" disabled={busy || code.length !== 6} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white">
                {busy ? "Verifying…" : "Verify & Enable"}
              </Button>
            </div>
          </form>
        ) : enabled ? (
          <Button type="button" variant="outline" onClick={disable2FA} disabled={busy} className="w-full text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-900/20">
            {busy ? "Disabling…" : "Disable Two-Factor Authentication"}
          </Button>
        ) : (
          <Button type="button" onClick={startEnroll} disabled={busy} className="w-full bg-violet-600 hover:bg-violet-700 text-white">
            {busy ? "Starting…" : "Enable Two-Factor Authentication"}
          </Button>
        )}
      </CardContent>
      {pendingConfirm && (
        <ConfirmDialog open title={pendingConfirm.title} description={pendingConfirm.desc} onConfirm={() => { pendingConfirm.action(); setPendingConfirm(null); }} onCancel={() => setPendingConfirm(null)} />
      )}
    </Card>
  );
}
