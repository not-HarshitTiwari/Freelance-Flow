"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Zap } from "lucide-react";
import { toast } from "sonner";

function getStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score, label: "Weak", color: "bg-red-500" };
  if (score <= 2) return { score, label: "Fair", color: "bg-orange-400" };
  if (score <= 3) return { score, label: "Good", color: "bg-yellow-400" };
  return { score, label: "Strong", color: "bg-green-500" };
}

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const strength = useMemo(() => getStrength(password), [password]);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Account created! Please check your email to confirm.");
      router.push("/dashboard");
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
            <CardTitle className="dark:text-white">Create your account</CardTitle>
            <CardDescription className="dark:text-gray-400">Start managing your freelance business</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="dark:text-gray-300">Full Name</Label>
                <Input
                  id="name"
                  placeholder="Rahul Sharma"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:placeholder-gray-500"
                />
              </div>
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
                <Label htmlFor="password" className="dark:text-gray-300">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Min 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  required
                  className="dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:placeholder-gray-500"
                />
                {password.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${strength.score >= i ? strength.color : "bg-gray-200 dark:bg-gray-700"}`} />
                      ))}
                    </div>
                    <p className={`text-xs font-medium ${strength.score <= 1 ? "text-red-500" : strength.score <= 2 ? "text-orange-400" : strength.score <= 3 ? "text-yellow-500" : "text-green-500"}`}>
                      {strength.label} password
                    </p>
                  </div>
                )}
              </div>
              <Button
                type="submit"
                className="w-full bg-violet-600 hover:bg-violet-700 text-white"
                disabled={loading}
              >
                {loading ? "Creating account..." : "Create Account — Free"}
              </Button>
            </form>
            <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
              Already have an account?{" "}
              <Link href="/auth/login" className="text-violet-600 hover:underline font-medium">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
