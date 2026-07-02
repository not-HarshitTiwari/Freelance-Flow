import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Zap, FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center px-4 text-center">
      <Zap size={32} className="text-violet-600 mb-6" />
      <FileQuestion size={56} className="text-gray-300 dark:text-gray-700 mb-4" />
      <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">404</h1>
      <p className="text-lg text-gray-500 dark:text-gray-400 mb-8">This page doesn&apos;t exist.</p>
      <Link href="/dashboard">
        <Button className="bg-violet-600 hover:bg-violet-700 text-white">Go to Dashboard</Button>
      </Link>
    </div>
  );
}
