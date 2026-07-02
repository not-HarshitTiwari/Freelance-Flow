"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Zap, ArrowLeft, MailCheck } from "lucide-react";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const origin = window.location.origin;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/auth/reset-password`,
    });
    if (error) {
      toast.error(error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
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
            {sent ? (
              <>
                <div className="flex justify-center mb-2">
                  <MailCheck size={36} className="text-violet-600" />
                </div>
                <CardTitle className="dark:text-white">Check your email</CardTitle>
                <CardDescription className="dark:text-gray-400">
                  We sent a password reset link to <span className="font-medium text-gray-700 dark:text-gray-300">{email}</span>
                </CardDescription>
              </>
            ) : (
              <>
                <CardTitle className="dark:text-white">Forgot password?</CardTitle>
                <CardDescription className="dark:text-gray-400">
                  Enter your email and we&apos;ll send you a reset link
                </CardDescription>
              </>
            )}
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="space-y-4">
                <p className="text-sm text-center text-gray-500 dark:text-gray-400">
                  Didn&apos;t receive it? Check your spam folder or{" "}
                  <button onClick={() => setSent(false)} className="text-violet-600 hover:underline font-medium">
                    try again
                  </button>
                </p>
                <Link href="/auth/login">
                  <Button variant="outline" className="w-full dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 gap-2">
                    <ArrowLeft size={14} /> Back to login
                  </Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="dark:text-gray-300">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:placeholder-gray-500"
                  />
                </div>
                <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-700 text-white" disabled={loading}>
                  {loading ? "Sending..." : "Send Reset Link"}
                </Button>
                <Link href="/auth/login">
                  <Button variant="ghost" type="button" className="w-full dark:text-gray-400 dark:hover:text-gray-200 gap-2">
                    <ArrowLeft size={14} /> Back to login
                  </Button>
                </Link>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
