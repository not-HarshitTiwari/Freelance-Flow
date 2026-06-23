import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  FileText,
  IndianRupee,
  Users,
  Mail,
  Sparkles,
  CheckCircle,
  ArrowRight,
  Zap,
} from "lucide-react";

const features = [
  {
    icon: Sparkles,
    title: "AI Proposal Generator",
    description:
      "Generate professional proposals in 60 seconds using Gemini AI. Just describe the project and get a ready-to-send proposal.",
  },
  {
    icon: FileText,
    title: "Invoice Creator",
    description:
      "Create and send branded invoices instantly. Track what's paid, unpaid, and overdue at a glance.",
  },
  {
    icon: Users,
    title: "Client Manager",
    description:
      "Keep all your client details, project history, and communication in one place.",
  },
  {
    icon: Mail,
    title: "Auto Payment Reminders",
    description:
      "Never chase payments manually again. Automated email reminders go out before and after due dates.",
  },
];

const pricingFeatures = [
  "AI proposal generation (unlimited)",
  "Invoice creation & tracking",
  "Client management",
  "Automated payment reminders",
  "UPI & card payments via Razorpay",
  "Email support",
];

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="border-b px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-2 font-bold text-xl">
          <Zap className="text-violet-600" size={22} />
          FreelanceFlow
        </div>
        <div className="flex items-center gap-3">
          <Link href="/auth/login">
            <Button variant="ghost">Login</Button>
          </Link>
          <Link href="/auth/signup">
            <Button className="bg-violet-600 hover:bg-violet-700">
              Get Started Free
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 py-24 text-center">
        <Badge className="mb-4 bg-violet-100 text-violet-700 hover:bg-violet-100">
          Built for Indian Freelancers
        </Badge>
        <h1 className="text-5xl font-bold tracking-tight text-gray-900 mb-6">
          Stop wasting time on{" "}
          <span className="text-violet-600">admin work.</span>
          <br />
          Start earning more.
        </h1>
        <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto">
          FreelanceFlow handles your proposals, invoices, and payment reminders
          — so you can focus on doing the work you love.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/auth/signup">
            <Button
              size="lg"
              className="bg-violet-600 hover:bg-violet-700 gap-2"
            >
              Start Free <ArrowRight size={16} />
            </Button>
          </Link>
          <Link href="#pricing">
            <Button size="lg" variant="outline">
              See Pricing
            </Button>
          </Link>
        </div>
        <p className="text-sm text-gray-400 mt-4">
          No credit card required • Free forever plan available
        </p>
      </section>

      {/* Features */}
      <section className="bg-gray-50 py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-3">
            Everything a freelancer needs
          </h2>
          <p className="text-center text-gray-500 mb-12">
            One tool. All your admin. Done.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            {features.map((f) => (
              <Card key={f.title} className="border-0 shadow-sm">
                <CardContent className="p-6 flex gap-4">
                  <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                    <f.icon className="text-violet-600" size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {f.title}
                    </h3>
                    <p className="text-gray-500 text-sm">{f.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-6">
        <div className="max-w-md mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">
            Simple pricing
          </h2>
          <p className="text-gray-500 mb-10">One plan. Everything included.</p>
          <Card className="border-2 border-violet-600 shadow-lg">
            <CardContent className="p-8">
              <div className="flex items-center justify-center gap-1 mb-1">
                <IndianRupee size={28} className="text-gray-900" />
                <span className="text-5xl font-bold text-gray-900">999</span>
              </div>
              <p className="text-gray-500 mb-6">per month</p>
              <ul className="text-left space-y-3 mb-8">
                {pricingFeatures.map((feat) => (
                  <li
                    key={feat}
                    className="flex items-center gap-2 text-sm text-gray-700"
                  >
                    <CheckCircle
                      size={16}
                      className="text-violet-600 shrink-0"
                    />
                    {feat}
                  </li>
                ))}
              </ul>
              <Link href="/auth/signup">
                <Button
                  className="w-full bg-violet-600 hover:bg-violet-700"
                  size="lg"
                >
                  Get Started — ₹999/mo
                </Button>
              </Link>
              <p className="text-xs text-gray-400 mt-3">
                Pay via UPI, card, or netbanking
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 text-center text-sm text-gray-400">
        <div className="flex items-center justify-center gap-2 font-semibold text-gray-700 mb-2">
          <Zap className="text-violet-600" size={16} />
          FreelanceFlow
        </div>
        <p>© 2026 FreelanceFlow. Built for Indian freelancers.</p>
      </footer>
    </div>
  );
}
