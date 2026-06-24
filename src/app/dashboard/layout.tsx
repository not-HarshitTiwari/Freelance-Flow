import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Sidebar from "@/components/dashboard/Sidebar";
import { Toaster } from "@/components/ui/sonner";

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

  const plan = profile?.plan || "free";

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar user={user} plan={plan} />
      <main className="flex-1 overflow-auto p-6 bg-gray-50 dark:bg-gray-950">{children}</main>
      <Toaster />
    </div>
  );
}
