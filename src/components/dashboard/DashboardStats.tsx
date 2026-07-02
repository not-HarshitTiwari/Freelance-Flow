"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { IndianRupee, Receipt, TrendingUp } from "lucide-react";

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: "₹", USD: "$", EUR: "€", GBP: "£", AED: "AED ", SGD: "S$",
};

function fmt(n: number, sym: string) {
  return `${sym}${Math.round(n).toLocaleString("en-IN")}`;
}

export function DashboardStats({
  totalEarned, unpaidAmount, totalExpenses, netProfit, overdueCount,
}: {
  totalEarned: number; unpaidAmount: number; totalExpenses: number; netProfit: number; overdueCount?: number;
}) {
  const [sym, setSym] = useState("₹");
  useEffect(() => {
    const cur = localStorage.getItem("inv_currency") || "INR";
    setSym(CURRENCY_SYMBOLS[cur] ?? cur + " ");
  }, []);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
              <IndianRupee size={18} className="text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total Earned</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{fmt(totalEarned, sym)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center">
              <Receipt size={18} className="text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs text-gray-500 dark:text-gray-400">Unpaid</p>
                {(overdueCount ?? 0) > 0 && (
                  <span className="text-xs bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400 font-semibold px-1.5 py-0.5 rounded-full">{overdueCount} overdue</span>
                )}
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{fmt(unpaidAmount, sym)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
              <IndianRupee size={18} className="text-red-500 dark:text-red-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Expenses</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{fmt(totalExpenses, sym)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${netProfit >= 0 ? "bg-violet-100 dark:bg-violet-900/40" : "bg-red-100 dark:bg-red-900/40"}`}>
              <TrendingUp size={18} className={netProfit >= 0 ? "text-violet-600 dark:text-violet-400" : "text-red-500"} />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Net Profit</p>
              <p className={`text-xl font-bold ${netProfit >= 0 ? "text-gray-900 dark:text-white" : "text-red-500"}`}>{fmt(netProfit, sym)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
