import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Sidebar from "@/components/dashboard/Sidebar";
import { Toaster } from "@/components/ui/sonner";
import { PlanProvider } from "@/components/dashboard/PlanProvider";
import { DashboardAdBanner } from "@/components/ads/DashboardAdBanner";
import type { Plan } from "@/lib/plan-context";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();

  const plan = (profile?.plan as Plan) || "free";

  return (
    <PlanProvider plan={plan}>
      <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
        <Sidebar user={user} plan={plan} />
        <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-950">
          {plan === "free" && <DashboardAdBanner />}
          <div className="p-6">{children}</div>
          {plan === "free" && <DashboardAdBanner className="px-6 pb-6" />}
        </main>
        <Toaster />
      </div>
    </PlanProvider>
  );
}
