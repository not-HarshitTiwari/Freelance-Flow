"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CheckCircle, XCircle, Loader2 } from "lucide-react";

type State = "loading" | "ready" | "accepting" | "success" | "error" | "auth";

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [state, setState] = useState<State>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        setState("auth");
      } else {
        setState("ready");
      }
    });
  }, []);

  async function accept() {
    setState("accepting");
    try {
      const res = await fetch("/api/team/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to accept invite");
      setState("success");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "An error occurred");
      setState("error");
    }
  }

  function goToLogin() {
    const redirectUrl = encodeURIComponent(`/invite/${token}`);
    router.push(`/auth/login?redirect=${redirectUrl}`);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center mb-3">
            <Users className="h-6 w-6 text-violet-600 dark:text-violet-400" />
          </div>
          <CardTitle className="text-xl dark:text-white">Workspace Invitation</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {state === "loading" && (
            <div className="flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
            </div>
          )}

          {state === "auth" && (
            <>
              <p className="text-gray-600 dark:text-gray-300 text-sm">
                You&apos;ve been invited to join a FreelanceFlow workspace. Sign in (or create an account) with the email address this invite was sent to.
              </p>
              <Button onClick={goToLogin} className="w-full bg-violet-600 hover:bg-violet-700 text-white">
                Sign in to Accept
              </Button>
            </>
          )}

          {state === "ready" && (
            <>
              <p className="text-gray-600 dark:text-gray-300 text-sm">
                You&apos;ve been invited to collaborate in a FreelanceFlow workspace. Accepting will let you access the workspace owner&apos;s clients, invoices, and more.
              </p>
              <Button onClick={accept} className="w-full bg-violet-600 hover:bg-violet-700 text-white">
                Accept Invitation
              </Button>
            </>
          )}

          {state === "accepting" && (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
              <p className="text-sm text-gray-500">Accepting invitation…</p>
            </div>
          )}

          {state === "success" && (
            <>
              <CheckCircle className="h-10 w-10 text-green-500 mx-auto" />
              <p className="text-gray-700 dark:text-gray-300 text-sm font-medium">
                You&apos;ve joined the workspace! You can now sign in to access the shared dashboard.
              </p>
              <Button onClick={() => router.push("/dashboard")} className="w-full bg-violet-600 hover:bg-violet-700 text-white">
                Go to Dashboard
              </Button>
            </>
          )}

          {state === "error" && (
            <>
              <XCircle className="h-10 w-10 text-red-500 mx-auto" />
              <p className="text-red-600 dark:text-red-400 text-sm">{message}</p>
              <Button variant="outline" onClick={() => router.push("/dashboard")} className="w-full">
                Go to Dashboard
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
