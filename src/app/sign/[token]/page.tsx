"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle } from "lucide-react";
import Image from "next/image";
import { use } from "react";

type Contract = { id: string; title: string; client_name: string | null; body: string; status: string; signed_at: string | null };

export default function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [contract, setContract] = useState<Contract | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [signature, setSignature] = useState("");
  const [signing, setSigning] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/contracts/sign?token=${token}`)
      .then(r => r.json())
      .then(d => { if (d.error) setNotFound(true); else setContract(d.contract); });
  }, [token]);

  async function handleSign(e: React.FormEvent) {
    e.preventDefault();
    setSigning(true);
    const res = await fetch("/api/contracts/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, signature }),
    });
    const data = await res.json();
    if (data.success) setDone(true);
    else alert(data.error || "Failed to sign. The link may be expired or already used.");
    setSigning(false);
  }

  if (notFound) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <p className="text-xl font-semibold text-gray-900">Contract not found</p>
        <p className="text-gray-500 mt-2">This link may be invalid or expired.</p>
      </div>
    </div>
  );

  if (!contract) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (done || contract.status === "signed") return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <CheckCircle size={52} className="text-green-500 mx-auto mb-4" />
        <p className="text-2xl font-bold text-gray-900">Contract Signed!</p>
        <p className="text-gray-500 mt-2">Thank you — your signature has been recorded.</p>
        {contract.signed_at && <p className="text-sm text-gray-400 mt-1">Signed on {new Date(contract.signed_at).toLocaleString("en-IN")}</p>}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4 flex items-center gap-3">
        <Image src="/logo.png" alt="FreelanceFlow" width={28} height={28} className="rounded-sm" />
        <span className="font-bold text-gray-900">FreelanceFlow</span>
        <span className="text-gray-300 ml-1">|</span>
        <span className="text-gray-500 text-sm">Contract Signing</span>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{contract.title}</h1>
          {contract.client_name && <p className="text-gray-500 mt-1">Prepared for {contract.client_name}</p>}
        </div>

        <div className="bg-white rounded-xl border p-6">
          <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono leading-relaxed">{contract.body}</pre>
        </div>

        <div className="bg-white rounded-xl border p-6">
          <p className="text-sm font-semibold text-gray-700 mb-1">Ready to sign?</p>
          <p className="text-xs text-gray-500 mb-4">By typing your full name below and clicking "Sign Contract", you agree to the terms above. This constitutes a legally binding electronic signature.</p>
          <form onSubmit={handleSign} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Type your full name to sign *</Label>
              <Input value={signature} onChange={e => setSignature(e.target.value)} placeholder="Your Full Name" required className="text-lg font-semibold" />
            </div>
            <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-700 text-white" disabled={signing || !signature.trim()}>
              {signing ? "Signing…" : "Sign Contract"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
