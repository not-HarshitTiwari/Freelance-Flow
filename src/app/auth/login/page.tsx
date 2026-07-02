"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Zap, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== aal.nextLevel) {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totpFactor = factors?.totp?.[0];
      if (totpFactor) {
        setFactorId(totpFactor.id);
        setLoading(false);
        return;
      }
    }

    router.push("/dashboard");
    setLoading(false);
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setVerifying(true);
    const supabase = createClient();
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError || !challenge) {
      toast.error(challengeError?.message || "Failed to start verification");
      setVerifying(false);
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: otpCode,
    });
    if (verifyError) {
      toast.error(verifyError.message);
      setVerifying(false);
      return;
    }
    router.push("/dashboard");
  }

  if (factorId) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-center gap-2 mb-8 font-bold text-xl text-gray-900 dark:text-white">
            <Zap className="text-violet-600" size={22} />
            FreelanceFlow
          </div>
          <Card className="dark:bg-gray-900 dark:border-gray-800">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2 dark:text-white">
                <ShieldCheck size={20} className="text-violet-600" /> Two-Factor Verification
              </CardTitle>
              <CardDescription className="dark:text-gray-400">Enter the 6-digit code from your authenticator app</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="otp" className="dark:text-gray-300">Authentication Code</Label>
                  <Input
                    id="otp"
                    inputMode="numeric"
                    autoFocus
                    placeholder="123456"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ""))}
                    maxLength={6}
                    required
                    className="dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:placeholder-gray-500"
                  />
                </div>
                <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-700 text-white" disabled={verifying || otpCode.length !== 6}>
                  {verifying ? "Verifying..." : "Verify & Sign In"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8 font-bold text-xl text-gray-900 dark:text-white">
          <Zap className="text-violet-600" size={22} />
          FreelanceFlow
        </div>
        <Card className="dark:bg-gray-900 dark:border-gray-800">
          <CardHeader className="text-center">
            <CardTitle className="dark:text-white">Welcome back</CardTitle>
            <CardDescription className="dark:text-gray-400">Sign in to your account</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="dark:text-gray-300">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:placeholder-gray-500"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="dark:text-gray-300">Password</Label>
                  <Link href="/auth/forgot-password" className="text-xs text-violet-600 hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:placeholder-gray-500"
                />
              </div>
              <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-700 text-white" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
            <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
              Don&apos;t have an account?{" "}
              <Link href="/auth/signup" className="text-violet-600 hover:underline font-medium">
                Sign up free
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
