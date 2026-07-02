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

const pricingPlans = [
  {
    key: "basic",
    label: "Basic",
    price: 499,
    highlight: false,
    borderColor: "border-blue-400",
    features: [
      "Unlimited invoices & clients",
      "All 3 PDF templates",
      "Invoice & proposal email sending",
      "Contracts with e-signatures",
      "CSV exports",
      "No ads",
    ],
  },
  {
    key: "pro",
    label: "Pro",
    price: 999,
    highlight: true,
    borderColor: "border-violet-600",
    features: [
      "Everything in Basic",
      "AI proposal generation",
      "Recurring invoices (auto-generate)",
      "Razorpay payment links",
      "Automated payment reminders",
    ],
  },
  {
    key: "advanced",
    label: "Advanced",
    price: 1999,
    highlight: false,
    borderColor: "border-amber-400",
    features: [
      "Everything in Pro",
      "Bulk invoice operations",
      "Multi-currency PDF",
      "White-label client portal",
    ],
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Navbar */}
      <nav className="border-b dark:border-gray-800 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-2 font-bold text-xl text-gray-900 dark:text-white">
          <Zap className="text-violet-600" size={22} />
          FreelanceFlow
        </div>
        <div className="flex items-center gap-3">
          <Link href="/auth/login">
            <Button variant="outline">Login</Button>
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
        <Badge className="mb-4 bg-violet-100 text-violet-700 hover:bg-violet-100 dark:bg-violet-900/40 dark:text-violet-300">
          Built for Indian Freelancers
        </Badge>
        <h1 className="text-5xl font-bold tracking-tight text-gray-900 dark:text-white mb-6">
          Stop wasting time on{" "}
          <span className="text-violet-600">admin work.</span>
          <br />
          Start earning more.
        </h1>
        <p className="text-xl text-gray-500 dark:text-gray-400 mb-10 max-w-2xl mx-auto">
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
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-4">
          No credit card required • Free forever plan available
        </p>
      </section>

      {/* Features */}
      <section className="bg-gray-50 dark:bg-gray-900 py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-3">
            Everything a freelancer needs
          </h2>
          <p className="text-center text-gray-500 dark:text-gray-400 mb-12">
            One tool. All your admin. Done.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            {features.map((f) => (
              <Card key={f.title} className="border-0 shadow-sm dark:bg-gray-800 dark:border-gray-700">
                <CardContent className="p-6 flex gap-4">
                  <div className="w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
                    <f.icon className="text-violet-600 dark:text-violet-400" size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                      {f.title}
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">{f.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-3">
            Simple pricing
          </h2>
          <p className="text-center text-gray-500 dark:text-gray-400 mb-10">Pay monthly. Cancel anytime.</p>
          <div className="grid md:grid-cols-3 gap-6">
            {pricingPlans.map((plan) => (
              <Card key={plan.key} className={`relative border-2 ${plan.borderColor} ${plan.highlight ? "shadow-xl" : ""} dark:bg-gray-900`}>
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-violet-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                    Most Popular
                  </div>
                )}
                <CardContent className="p-6">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{plan.label}</h3>
                  <div className="flex items-end gap-1 mb-5">
                    <IndianRupee size={20} className="text-gray-900 dark:text-white mb-1" />
                    <span className="text-3xl font-bold text-gray-900 dark:text-white">{plan.price}</span>
                    <span className="text-gray-500 dark:text-gray-400 text-sm mb-1">/month</span>
                  </div>
                  <ul className="space-y-2.5 mb-6">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <CheckCircle size={15} className="text-violet-600 shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link href="/auth/signup">
                    <Button
                      className={`w-full text-white ${plan.key === "advanced" ? "bg-amber-500 hover:bg-amber-600" : plan.key === "pro" ? "bg-violet-600 hover:bg-violet-700" : "bg-blue-600 hover:bg-blue-700"}`}
                      size="lg"
                    >
                      Get Started
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-6">
            Pay via UPI, card, or netbanking
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t dark:border-gray-800 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
        <div className="flex items-center justify-center gap-2 font-semibold text-gray-700 dark:text-gray-300 mb-2">
          <Zap className="text-violet-600" size={16} />
          FreelanceFlow
        </div>
        <p>© 2026 FreelanceFlow. Built for Indian freelancers.</p>
      </footer>
    </div>
  );
}
