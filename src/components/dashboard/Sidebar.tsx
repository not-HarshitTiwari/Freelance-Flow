"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  LayoutDashboard,
  FileText,
  Receipt,
  Users,
  LogOut,
  Crown,
  Settings,
  Sun,
  Moon,
} from "lucide-react";
import Image from "next/image";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/proposals", label: "Proposals", icon: FileText },
  { href: "/dashboard/invoices", label: "Invoices", icon: Receipt },
  { href: "/dashboard/clients", label: "Clients", icon: Users },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export default function Sidebar({ user, plan }: { user: User; plan: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  const initials =
    (user.user_metadata?.full_name as string)
      ?.split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase() ||
    user.email?.[0].toUpperCase() ||
    "U";

  const isDark = theme === "dark";

  return (
    <aside className="w-60 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col h-screen">
      <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2 font-bold text-lg text-gray-900 dark:text-white">
        <Image src="/logo.png" alt="FreelanceFlow" width={28} height={28} className="rounded-sm" />
        FreelanceFlow
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <div
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                pathname === item.href
                  ? "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100"
              )}
            >
              <item.icon size={18} />
              {item.label}
            </div>
          </Link>
        ))}
      </nav>

      {plan !== "pro" && (
        <div className="mx-3 mb-3 rounded-lg bg-violet-50 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-700 p-3">
          <p className="text-xs font-semibold text-violet-700 dark:text-violet-300 mb-1 flex items-center gap-1">
            <Crown size={12} /> Free Plan
          </p>
          <p className="text-xs text-violet-600 dark:text-violet-400 mb-2">
            Upgrade to Pro to unlock AI proposals & all features.
          </p>
          <Link href="/dashboard/upgrade">
            <Button size="sm" className="w-full bg-violet-600 hover:bg-violet-700 h-7 text-xs text-white">
              Upgrade — ₹999/mo
            </Button>
          </Link>
        </div>
      )}

      {plan === "pro" && (
        <div className="mx-3 mb-3 rounded-lg bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 p-2.5">
          <p className="text-xs font-semibold text-green-700 dark:text-green-400 flex items-center gap-1">
            <Crown size={12} /> Pro Plan Active
          </p>
        </div>
      )}

      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300 text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {(user.user_metadata?.full_name as string) || "Freelancer"}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{user.email}</p>
          </div>
        </div>

        {mounted && (
          <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="flex items-center gap-2 w-full px-3 py-2 mb-1 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
            {isDark ? "Light Mode" : "Dark Mode"}
          </button>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-transparent"
          onClick={handleLogout}
        >
          <LogOut size={16} className="mr-2" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
