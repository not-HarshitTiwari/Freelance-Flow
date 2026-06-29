"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Receipt, Trash2, Download, CheckCircle, Send, Pencil, MessageCircle, Bell, IndianRupee, Link2, RefreshCw, FileCode, Search, Copy } from "lucide-react";
import { AdBanner } from "@/components/ads/AdBanner";
import { RewardedAdModal } from "@/components/ads/RewardedAdModal";
import { usePlan, planAtLeast } from "@/lib/plan-context";
import { toast } from "sonner";

type InvoiceItem = { description: string; quantity: number; rate: number; hsn_code?: string };

type Invoice = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  cgst: number;
  sgst: number;
  igst: number;
  gst_type: string;
  gst_rate: number;
  total: number;
  status: string;
  payment_methods: string[] | null;
  payment_method: string | null;
  transaction_id: string | null;
  amount_paid: number | null;
  payment_note: string | null;
  payment_link: string | null;
  is_recurring: boolean | null;
  recurrence_interval: string | null;
  next_invoice_date: string | null;
  reminder_sent_at: string | null;
  upi_id: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  bank_name: string | null;
  notes: string | null;
  terms: string | null;
  seller_name: string | null;
  seller_address: string | null;
  seller_email: string | null;
  seller_phone: string | null;
  seller_gstin: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_company: string | null;
  customer_address: string | null;
  customer_gstin: string | null;
  created_at: string;
};

type Client = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  address: string | null;
};

type Profile = {
  full_name: string;
  business_name: string;
  business_address: string;
  email: string;
  phone: string;
  gstin: string;
  upi_id: string;
  bank_account_name: string;
  bank_account_number: string;
  bank_ifsc: string;
  bank_name: string;
};

const PAYMENT_OPTIONS = ["UPI", "Bank Transfer", "Card", "Cash", "Cheque"];

const statusColors: Record<string, string> = {
  unpaid: "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-300",
  paid: "bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-300",
  partial: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300",
  overdue: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300",
};

type RGB = [number, number, number];
function hexToRgb(hex: string): RGB {
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
}

// Currency helpers
const CURRENCIES: Record<string, { symbol: string; label: string }> = {
  INR: { symbol: "₹", label: "INR — Indian Rupee" },
  USD: { symbol: "$", label: "USD — US Dollar" },
  EUR: { symbol: "€", label: "EUR — Euro" },
  GBP: { symbol: "£", label: "GBP — British Pound" },
  AED: { symbol: "AED", label: "AED — UAE Dirham" },
  SGD: { symbol: "S$", label: "SGD — Singapore Dollar" },
};
function currSym(currency: string) { return CURRENCIES[currency]?.symbol ?? currency; }

// PDF templates
type PdfTemplate = "classic" | "minimal" | "bold";
const PDF_TEMPLATES: { id: PdfTemplate; label: string }[] = [
  { id: "classic", label: "Classic" },
  { id: "minimal", label: "Minimal" },
  { id: "bold",    label: "Bold" },
];

function loadImageAsDataUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width; canvas.height = img.height;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = url;
  });
}

async function buildInvoicePdf(
  inv: Invoice,
  accentHex: string | null,
  template: PdfTemplate = "classic",
  currency = "INR",
  exchangeRate = 1,
  logoUrl?: string | null,
  signatureUrl?: string | null,
) {
  const sym = currSym(currency);
  const rate = currency === "INR" ? 1 : exchangeRate;
  const fmt = (v: number) => (v / rate).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF();
  const accent: RGB | null = (accentHex && accentHex !== "none") ? hexToRgb(accentHex) : null;
  const gray: RGB = [100, 100, 100];
  const black: RGB = [30, 30, 30];
  const white: RGB = [255, 255, 255];

  // ── HEADER by template ──────────────────────────────────────
  if (template === "bold") {
    // Full-width dark sidebar + big number on right
    const col = accent ?? ([30, 30, 30] as RGB);
    doc.setFillColor(...col); doc.rect(0, 0, 210, 42, "F");
    doc.setTextColor(...white); doc.setFont("helvetica", "bold"); doc.setFontSize(26);
    doc.text("INVOICE", 14, 26);
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text(`#${inv.invoice_number}`, 14, 35);
    doc.text(`Date: ${inv.invoice_date || ""}`, 140, 18);
    if (inv.due_date) doc.text(`Due: ${inv.due_date}`, 140, 25);
    doc.text(`Status: ${inv.status.toUpperCase()}`, 140, 32);
    doc.text(`Currency: ${currency}`, 140, 39);
  } else if (template === "minimal") {
    // No color, just text with bottom border
    doc.setTextColor(...black); doc.setFont("helvetica", "bold"); doc.setFontSize(22);
    doc.text("INVOICE", 14, 20);
    doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(...gray);
    doc.text(`#${inv.invoice_number}`, 14, 27);
    doc.text(`${inv.invoice_date || ""}`, 140, 16);
    if (inv.due_date) doc.text(`Due: ${inv.due_date}`, 140, 22);
    doc.text(inv.status.toUpperCase(), 140, 28);
    doc.setDrawColor(220, 220, 220); doc.line(14, 32, 196, 32);
  } else {
    // Classic — accent header band
    if (accent) { doc.setFillColor(...accent); doc.rect(0, 0, 210, 28, "F"); doc.setTextColor(...white); }
    else { doc.setDrawColor(220, 220, 220); doc.rect(0, 0, 210, 28, "S"); doc.setTextColor(...black); }
    doc.setFontSize(20); doc.setFont("helvetica", "bold"); doc.text("INVOICE", 14, 18);
    doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.text(`#${inv.invoice_number}`, 14, 24);
    doc.setFontSize(9);
    doc.text(`Date: ${inv.invoice_date || ""}`, 140, 14);
    if (inv.due_date) doc.text(`Due: ${inv.due_date}`, 140, 20);
    doc.text(`Status: ${inv.status.toUpperCase()}`, 140, 26);
  }

  const bodyStart = template === "bold" ? 52 : template === "minimal" ? 40 : 40;

  // ── FROM / TO ────────────────────────────────────────────────
  doc.setTextColor(...black); doc.setFontSize(10); doc.setFont("helvetica", "bold");
  doc.text("FROM", 14, bodyStart);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...gray);
  const seller = [inv.seller_name, inv.seller_address, inv.seller_email, inv.seller_phone, inv.seller_gstin ? `GSTIN: ${inv.seller_gstin}` : null].filter(Boolean) as string[];
  seller.forEach((line, i) => doc.text(line, 14, bodyStart + 7 + i * 5));

  doc.setTextColor(...black); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text("TO", 110, bodyStart);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...gray);
  const customer = [inv.customer_name, inv.customer_company, inv.customer_address, inv.customer_gstin ? `GSTIN: ${inv.customer_gstin}` : null].filter(Boolean) as string[];
  customer.forEach((line, i) => doc.text(line, 110, bodyStart + 7 + i * 5));

  // ── ITEMS TABLE ──────────────────────────────────────────────
  const tableStartY = bodyStart + Math.max(seller.length, customer.length) * 5 + 14;
  autoTable(doc, {
    startY: tableStartY,
    head: [["#", "Description", "HSN/SAC", "Qty", `Rate (${sym})`, `Amount (${sym})`]],
    body: inv.items.map((item, i) => [i + 1, item.description, item.hsn_code || "—", item.quantity, fmt(item.rate), fmt(item.quantity * item.rate)]),
    headStyles: { fillColor: accent ?? (template === "bold" ? [30,30,30] : [240,240,240]), textColor: (accent || template === "bold") ? white : black, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    alternateRowStyles: template === "minimal" ? { fillColor: [250,250,250] } : {},
    columnStyles: { 0: { cellWidth: 8 }, 2: { cellWidth: 20 }, 3: { cellWidth: 12 }, 4: { cellWidth: 28 }, 5: { cellWidth: 30 } },
  });

  // ── TOTALS ───────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = (doc as any).lastAutoTable.finalY + 8;
  const summaryX = 120;
  const rows = [
    ["Subtotal", `${sym}${fmt(inv.subtotal)}`],
    ...(inv.gst_type === "cgst_sgst"
      ? [[`CGST (${(inv.gst_rate||0)/2}%)`, `${sym}${fmt(inv.cgst||0)}`], [`SGST (${(inv.gst_rate||0)/2}%)`, `${sym}${fmt(inv.sgst||0)}`]]
      : [[`IGST (${inv.gst_rate||0}%)`, `${sym}${fmt(inv.igst||0)}`]]),
  ];
  rows.forEach(([label, value], i) => {
    doc.setFontSize(9); doc.setTextColor(...gray); doc.setFont("helvetica", "normal");
    doc.text(label, summaryX, finalY + i * 6);
    doc.text(value, 195, finalY + i * 6, { align: "right" });
  });

  const totalY = finalY + rows.length * 6 + 2;
  const totalBg = accent ?? (template === "bold" ? ([30,30,30] as RGB) : null);
  if (totalBg) { doc.setFillColor(...totalBg); doc.rect(summaryX - 2, totalY - 4, 80, 10, "F"); doc.setTextColor(...white); }
  else { doc.setDrawColor(200, 200, 200); doc.rect(summaryX - 2, totalY - 4, 80, 10, "S"); doc.setTextColor(...black); }
  doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text("GRAND TOTAL", summaryX, totalY + 3);
  doc.text(`${sym}${fmt(inv.total)}`, 195, totalY + 3, { align: "right" });

  let infoY = totalY + 16;
  const methods = inv.payment_methods?.length ? inv.payment_methods : inv.payment_method ? [inv.payment_method] : [];
  if (methods.length || inv.upi_id || inv.bank_account_number || inv.transaction_id) {
    doc.setTextColor(...black); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text("Payment Information", 14, infoY); infoY += 6;
    doc.setFont("helvetica", "normal"); doc.setTextColor(...gray);
    if (methods.length) { doc.text(`Method: ${methods.join(", ")}`, 14, infoY); infoY += 5; }
    if (methods.includes("UPI") && inv.upi_id) { doc.text(`UPI ID: ${inv.upi_id}`, 14, infoY); infoY += 5; }
    if (methods.includes("Bank Transfer") && inv.bank_account_number) {
      doc.text(`Account Name: ${inv.bank_account_name || ""}`, 14, infoY); infoY += 5;
      doc.text(`Account Number: ${inv.bank_account_number}`, 14, infoY); infoY += 5;
      doc.text(`IFSC: ${inv.bank_ifsc || ""}  |  Bank: ${inv.bank_name || ""}`, 14, infoY); infoY += 5;
    }
    if (inv.transaction_id) { doc.text(`Transaction ID: ${inv.transaction_id}`, 14, infoY); infoY += 5; }
    infoY += 4;
  }

  if (inv.notes) {
    doc.setTextColor(...black); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text("Notes", 14, infoY); doc.setFont("helvetica", "normal"); doc.setTextColor(...gray);
    const noteLines = doc.splitTextToSize(inv.notes, 180);
    doc.text(noteLines, 14, infoY + 5); infoY += 5 + noteLines.length * 5 + 2;
  }
  if (inv.terms) {
    doc.setTextColor(...black); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text("Terms & Conditions", 14, infoY); doc.setFont("helvetica", "normal"); doc.setTextColor(...gray);
    const termLines = doc.splitTextToSize(inv.terms, 180);
    doc.text(termLines, 14, infoY + 5);
    infoY += 5 + termLines.length * 5 + 2;
  }

  // ── DIGITAL SIGNATURE ────────────────────────────────────────
  if (signatureUrl) {
    try {
      const sigImg = await loadImageAsDataUrl(signatureUrl);
      const sigY = Math.max(infoY + 4, 250);
      doc.setFontSize(8); doc.setTextColor(...gray); doc.setFont("helvetica", "normal");
      doc.text("Authorised Signatory", 14, sigY);
      doc.addImage(sigImg, "PNG", 14, sigY + 2, 50, 18);
      doc.setDrawColor(180, 180, 180); doc.line(14, sigY + 22, 64, sigY + 22);
    } catch { /* skip if image fails to load */ }
  }

  // ── LOGO — always on page 1 ──────────────────────────────────
  if (logoUrl) {
    try {
      const logoImg = await loadImageAsDataUrl(logoUrl);
      const lastPage = doc.getNumberOfPages();
      doc.setPage(1);
      doc.addImage(logoImg, "PNG", 160, 4, 36, 18);
      doc.setPage(lastPage);
    } catch { /* skip */ }
  }

  // ── WATERMARK on every page ──────────────────────────────────
  if (inv.status !== "paid") {
    const pageH = doc.internal.pageSize.getHeight();
    const pageW = doc.internal.pageSize.getWidth();
    const totalPages = doc.getNumberOfPages();
    for (let pg = 1; pg <= totalPages; pg++) {
      doc.setPage(pg);
      doc.setGState(doc.GState({ opacity: 0.08 }));
      doc.setFont("helvetica", "bold"); doc.setFontSize(64); doc.setTextColor(180, 0, 0);
      doc.text(inv.status.toUpperCase(), pageW / 2, pageH / 2, { align: "center", angle: 45 });
      doc.setGState(doc.GState({ opacity: 1 }));
      doc.setTextColor(...black);
    }
    doc.setPage(totalPages);
  }

  if (currency !== "INR" && rate !== 1) {
    doc.setFontSize(7); doc.setTextColor(...gray); doc.setFont("helvetica", "normal");
    doc.text(`* Amounts converted from INR at 1 INR = ${(1/rate).toFixed(4)} ${currency}`, 14, doc.internal.pageSize.getHeight() - 6);
  }

  return doc;
}

async function downloadInvoicePdf(
  inv: Invoice,
  accentHex: string | null,
  template: PdfTemplate = "classic",
  currency = "INR",
  exchangeRate = 1,
  logoUrl?: string | null,
  signatureUrl?: string | null,
) {
  const doc = await buildInvoicePdf(inv, accentHex, template, currency, exchangeRate, logoUrl, signatureUrl);
  doc.save(`${inv.invoice_number}.pdf`);
}

const emptyForm = {
  invoice_date: new Date().toISOString().split("T")[0],
  due_date: "",
  gst_type: "cgst_sgst",
  gst_rate: "18",
  payment_methods: [] as string[],
  transaction_id: "",
  upi_id: "",
  bank_account_name: "",
  bank_account_number: "",
  bank_ifsc: "",
  bank_name: "",
  notes: "",
  terms: "Payment due within 15 days of invoice date.",
  seller_name: "", seller_address: "", seller_email: "", seller_phone: "", seller_gstin: "",
  customer_name: "", customer_email: "", customer_company: "", customer_address: "", customer_gstin: "",
  is_recurring: false,
  recurrence_interval: "monthly",
};

const PAGE_SIZE = 20;

function InvoicesPageInner() {
  const searchParams = useSearchParams();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkWorking, setBulkWorking] = useState(false);
  const [previewTab, setPreviewTab] = useState<"details" | "preview">("details");
  const [pdfColor, setPdfColor] = useState<string | null>(null);
  const [pdfTemplate, setPdfTemplate] = useState<PdfTemplate>("classic");
  const [currency, setCurrency] = useState("INR");
  const [items, setItems] = useState<InvoiceItem[]>([{ description: "", quantity: 1, rate: 0 }]);
  const [form, setForm] = useState(emptyForm);
  const [editTarget, setEditTarget] = useState<Invoice | null>(null);
  const [editItems, setEditItems] = useState<InvoiceItem[]>([]);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editSaving, setEditSaving] = useState(false);
  const [sendTarget, setSendTarget] = useState<Invoice | null>(null);
  const [sendEmail, setSendEmail] = useState("");
  const [sendName, setSendName] = useState("");
  const [sendMessage, setSendMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sendRewardedOpen, setSendRewardedOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");
  const [paying, setPaying] = useState(false);
  const [reminding, setReminding] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState<string | null>(null);
  const [exchangeRate, setExchangeRate] = useState(1);
  const [profileLogo, setProfileLogo] = useState<string | null>(null);
  const [profileSignature, setProfileSignature] = useState<string | null>(null);
  const [irnTarget, setIrnTarget] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const planCtx = usePlan();
  const isPro = planCtx !== "free";
  const canSendEmail = planAtLeast(planCtx, "pro");
  const canUseTemplates = planAtLeast(planCtx, "basic");
  const canExportCSV = planAtLeast(planCtx, "basic");
  const canRecurring = planAtLeast(planCtx, "pro");
  const canPaymentLink = planAtLeast(planCtx, "pro");
  const canBulkOps = planAtLeast(planCtx, "advanced");
  const canCurrency = planAtLeast(planCtx, "advanced");

  const fetchInvoices = useCallback(async () => {
    const res = await fetch("/api/invoices");
    const data = await res.json();
    setInvoices(data.invoices || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const savedTemplate = (localStorage.getItem("inv_template") as PdfTemplate) || "classic";
    const savedColor = localStorage.getItem("inv_color") ?? "#7c3aed";
    const savedCurrency = localStorage.getItem("inv_currency") || "INR";
    setPdfTemplate(savedTemplate);
    setPdfColor(savedColor);
    setCurrency(savedCurrency);
    fetch("/api/profile").then(r => r.json()).then(({ profile }) => {
      if (profile) {
        setProfileLogo(profile.logo_url || null);
        setProfileSignature(profile.signature_url || null);
      }
    });
    if (savedCurrency !== "INR") {
      fetch(`/api/exchange-rates?base=INR`).then(r => r.json()).then(data => {
        if (data.rates?.[savedCurrency]) setExchangeRate(data.rates[savedCurrency]);
      });
    }
    fetchInvoices();
    // Pre-fill from time-tracking conversion
    const prefillParam = searchParams.get("prefill");
    if (prefillParam) {
      try {
        const prefillItems: InvoiceItem[] = JSON.parse(decodeURIComponent(prefillParam));
        if (prefillItems.length > 0) {
          setItems(prefillItems);
          setOpen(true);
        }
      } catch { /* ignore invalid param */ }
    }
    fetch("/api/profile").then(r => r.json()).then(({ profile }: { profile: Profile }) => {
      if (profile) setForm(f => ({
        ...f,
        seller_name: profile.business_name || profile.full_name || "",
        seller_address: profile.business_address || "",
        seller_email: profile.email || "",
        seller_phone: profile.phone || "",
        seller_gstin: profile.gstin || "",
        upi_id: profile.upi_id || "",
        bank_account_name: profile.bank_account_name || "",
        bank_account_number: profile.bank_account_number || "",
        bank_ifsc: profile.bank_ifsc || "",
        bank_name: profile.bank_name || "",
      }));
    });
    import("@/lib/supabase/client").then(({ createClient }) => {
      const supabase = createClient();
      supabase.auth.getUser().then(async ({ data: { user } }) => {
        if (!user) return;
        const { data } = await supabase.from("clients").select("*").eq("user_id", user.id).order("name");
        setClients(data || []);
      });
    });
  }, [fetchInvoices]);

  function selectClient(id: string) {
    const c = clients.find(cl => cl.id === id);
    if (!c) return;
    setForm(f => ({ ...f, customer_name: c.name, customer_email: c.email || "", customer_company: c.company || "", customer_address: c.address || "", customer_gstin: "" }));
  }

  function togglePaymentMethod(method: string) {
    setForm(f => ({
      ...f,
      payment_methods: f.payment_methods.includes(method)
        ? f.payment_methods.filter(m => m !== method)
        : [...f.payment_methods, method],
    }));
  }

  function addItem() { setItems([...items, { description: "", quantity: 1, rate: 0 }]); }
  function removeItem(i: number) { setItems(items.filter((_, idx) => idx !== i)); }
  function updateItem(i: number, field: keyof InvoiceItem, value: string | number) {
    const u = [...items]; u[i] = { ...u[i], [field]: value }; setItems(u);
  }

  const subtotal = items.reduce((s, i) => s + i.quantity * i.rate, 0);
  const gstAmt = (subtotal * parseFloat(form.gst_rate || "0")) / 100;
  const total = subtotal + gstAmt;
  const halfGst = gstAmt / 2;

  const hasUPI = form.payment_methods.includes("UPI");
  const hasBank = form.payment_methods.includes("Bank Transfer");

  function toggleBulk(id: string) {
    setBulkSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function bulkMarkPaid() {
    setBulkWorking(true);
    await Promise.all([...bulkSelected].map(id => {
      const inv = invoices.find(i => i.id === id);
      return fetch("/api/invoices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "paid", amount_paid: inv?.total ?? null }),
      });
    }));
    toast.success(`${bulkSelected.size} invoice(s) marked paid`);
    setBulkSelected(new Set());
    fetchInvoices();
    setBulkWorking(false);
  }

  async function bulkDelete() {
    if (!confirm(`Delete ${bulkSelected.size} invoice(s)? This cannot be undone.`)) return;
    setBulkWorking(true);
    await Promise.all([...bulkSelected].map(id =>
      fetch("/api/invoices", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) })
    ));
    toast.success(`${bulkSelected.size} invoice(s) deleted`);
    setBulkSelected(new Set());
    fetchInvoices();
    setBulkWorking(false);
  }

  async function sendReminder(inv: Invoice) {
    setReminding(inv.id);
    try {
      const res = await fetch("/api/invoices/remind", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invoiceId: inv.id }) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success(`Reminder sent to ${inv.customer_email}!`);
      fetchInvoices();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to send reminder"); }
    finally { setReminding(null); }
  }

  async function recordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!payTarget) return;
    setPaying(true);
    try {
      const res = await fetch("/api/invoices/payment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invoiceId: payTarget.id, amount: parseFloat(payAmount), note: payNote }) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success("Payment recorded!");
      setPayTarget(null); setPayAmount(""); setPayNote("");
      fetchInvoices();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to record payment"); }
    finally { setPaying(false); }
  }

  function exportInvoicesCSV() {
    const rows = [["Invoice #", "Date", "Due Date", "Customer", "Company", "Status", "Subtotal (₹)", "Tax (₹)", "Total (₹)", "Paid (₹)"]];
    for (const inv of invoices) {
      rows.push([
        inv.invoice_number,
        inv.invoice_date || "",
        inv.due_date || "",
        inv.customer_name || "",
        inv.customer_company || "",
        inv.status,
        String(inv.subtotal),
        String(inv.tax),
        String(inv.total),
        String(inv.amount_paid ?? 0),
      ]);
    }
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "invoices.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  async function generatePaymentLink(inv: Invoice) {
    setGeneratingLink(inv.id);
    try {
      const res = await fetch("/api/invoices/payment-link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invoiceId: inv.id }) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      await navigator.clipboard.writeText(data.url);
      toast.success("Payment link copied to clipboard!");
      fetchInvoices();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to generate payment link"); }
    finally { setGeneratingLink(null); }
  }

  async function duplicateInvoice(inv: Invoice) {
    setItems(inv.items.map(i => ({ ...i })));
    setForm(f => ({
      ...f,
      invoice_date: new Date().toISOString().split("T")[0],
      due_date: "",
      gst_type: inv.gst_type || "cgst_sgst",
      gst_rate: String(inv.gst_rate ?? "18"),
      payment_methods: inv.payment_methods?.length ? inv.payment_methods : inv.payment_method ? [inv.payment_method] : [],
      notes: inv.notes || "",
      terms: inv.terms || "",
      seller_name: inv.seller_name || "",
      seller_address: inv.seller_address || "",
      seller_email: inv.seller_email || "",
      seller_phone: inv.seller_phone || "",
      seller_gstin: inv.seller_gstin || "",
      customer_name: inv.customer_name || "",
      customer_email: inv.customer_email || "",
      customer_company: inv.customer_company || "",
      customer_address: inv.customer_address || "",
      customer_gstin: inv.customer_gstin || "",
      upi_id: inv.upi_id || "",
      bank_account_name: inv.bank_account_name || "",
      bank_account_number: inv.bank_account_number || "",
      bank_ifsc: inv.bank_ifsc || "",
      bank_name: inv.bank_name || "",
    }));
    setOpen(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (form.due_date && form.due_date < form.invoice_date) {
      toast.error("Due date must be on or after invoice date");
      return;
    }
    setSaving(true);
    try {
      const nextDate = new Date();
      if (form.recurrence_interval === "weekly") nextDate.setDate(nextDate.getDate() + 7);
      else if (form.recurrence_interval === "quarterly") nextDate.setMonth(nextDate.getMonth() + 3);
      else nextDate.setMonth(nextDate.getMonth() + 1);

      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          gst_rate: parseFloat(form.gst_rate),
          items,
          is_recurring: form.is_recurring,
          recurrence_interval: form.is_recurring ? form.recurrence_interval : null,
          next_invoice_date: form.is_recurring ? nextDate.toISOString().split("T")[0] : null,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success(`Invoice ${data.invoice.invoice_number} created!`);
      setOpen(false);
      setItems([{ description: "", quantity: 1, rate: 0 }]);
      fetchInvoices();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create invoice");
    } finally { setSaving(false); }
  }

  async function deleteInvoice(id: string) {
    if (!confirm("Delete this invoice? This cannot be undone.")) return;
    await fetch("/api/invoices", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    toast.success("Invoice deleted");
    fetchInvoices();
  }

  async function markPaid(inv: Invoice) {
    await fetch("/api/invoices", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: inv.id, status: "paid", amount_paid: inv.total }) });
    toast.success("Marked as paid!");
    fetchInvoices();
  }

  function openEdit(inv: Invoice) {
    setEditTarget(inv);
    setEditItems(inv.items.map(i => ({ ...i })));
    setEditForm({
      invoice_date: inv.invoice_date || "",
      due_date: inv.due_date || "",
      gst_type: inv.gst_type || "cgst_sgst",
      gst_rate: String(inv.gst_rate ?? "18"),
      payment_methods: inv.payment_methods?.length ? inv.payment_methods : inv.payment_method ? [inv.payment_method] : [],
      transaction_id: inv.transaction_id || "",
      upi_id: inv.upi_id || "",
      bank_account_name: inv.bank_account_name || "",
      bank_account_number: inv.bank_account_number || "",
      bank_ifsc: inv.bank_ifsc || "",
      bank_name: inv.bank_name || "",
      notes: inv.notes || "",
      terms: inv.terms || "",
      seller_name: inv.seller_name || "",
      seller_address: inv.seller_address || "",
      seller_email: inv.seller_email || "",
      seller_phone: inv.seller_phone || "",
      seller_gstin: inv.seller_gstin || "",
      customer_name: inv.customer_name || "",
      customer_email: inv.customer_email || "",
      customer_company: inv.customer_company || "",
      customer_address: inv.customer_address || "",
      customer_gstin: inv.customer_gstin || "",
      is_recurring: inv.is_recurring ?? false,
      recurrence_interval: inv.recurrence_interval || "monthly",
    });
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setEditSaving(true);
    try {
      const gst_rate = parseFloat(editForm.gst_rate);
      const subtotal = editItems.reduce((s, i) => s + i.quantity * i.rate, 0);
      const totalGst = (subtotal * gst_rate) / 100;
      const cgst = editForm.gst_type === "cgst_sgst" ? totalGst / 2 : 0;
      const sgst = editForm.gst_type === "cgst_sgst" ? totalGst / 2 : 0;
      const igst = editForm.gst_type === "igst" ? totalGst : 0;
      const total = subtotal + totalGst;

      const res = await fetch("/api/invoices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editTarget.id,
          ...editForm,
          gst_rate,
          items: editItems,
          subtotal, tax: totalGst, cgst, sgst, igst, total,
          payment_method: editForm.payment_methods.join(", ") || null,
          due_date: editForm.due_date || null,
          upi_id: editForm.upi_id || null,
          bank_account_name: editForm.bank_account_name || null,
          bank_account_number: editForm.bank_account_number || null,
          bank_ifsc: editForm.bank_ifsc || null,
          bank_name: editForm.bank_name || null,
          transaction_id: editForm.transaction_id || null,
          notes: editForm.notes || null,
          terms: editForm.terms || null,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success("Invoice updated!");
      setEditTarget(null);
      fetchInvoices();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally { setEditSaving(false); }
  }

  async function doSend() {
    if (!sendTarget) return;
    setSending(true);
    try {
      let pdfBase64: string | null = null;
      try {
        const doc = await buildInvoicePdf(sendTarget, pdfColor, pdfTemplate, currency, exchangeRate, profileLogo, profileSignature);
        pdfBase64 = doc.output("datauristring");
      } catch { /* proceed without PDF if generation fails */ }

      const res = await fetch("/api/invoices/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: sendTarget.id, toEmail: sendEmail, toName: sendName, message: sendMessage, pdfBase64 }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success(`Invoice sent to ${sendEmail}!`);
      setSendTarget(null); setSendEmail(""); setSendName(""); setSendMessage("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send");
    } finally { setSending(false); }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!isPro) {
      setSendRewardedOpen(true);
    } else {
      await doSend();
    }
  }

  const selectStyle = "h-9 w-full rounded-lg border border-input bg-white dark:bg-gray-900 dark:text-gray-100 px-2.5 text-sm outline-none";
  const sectionStyle = "border dark:border-gray-700 rounded-lg p-4 space-y-3";
  const sectionTitle = "font-semibold text-sm text-gray-700 dark:text-gray-300";

  const filteredInvoices = invoices.filter(inv => {
    const q = searchQuery.toLowerCase();
    const matchQuery = !q || inv.invoice_number.toLowerCase().includes(q) || (inv.customer_name || "").toLowerCase().includes(q) || (inv.customer_company || "").toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || inv.status === statusFilter;
    return matchQuery && matchStatus;
  });
  const totalPages = Math.ceil(filteredInvoices.length / PAGE_SIZE);
  const pagedInvoices = filteredInvoices.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div>
      <RewardedAdModal
        open={sendRewardedOpen}
        title="Send Invoice"
        description="Watch a short ad to send this invoice via email for free"
        onRewarded={async () => { setSendRewardedOpen(false); await doSend(); }}
        onClose={() => setSendRewardedOpen(false)}
      />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Invoices</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Create GST-compliant invoices</p>
        </div>
        <div className="flex gap-2">
          {invoices.length > 0 && canExportCSV && (
            <button onClick={exportInvoicesCSV} className="inline-flex items-center gap-2 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-medium px-3 h-8 rounded-lg transition-colors">
              <Download size={15} /> Export CSV
            </button>
          )}
        <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) { setForm(f => ({ ...emptyForm, seller_name: f.seller_name, seller_address: f.seller_address, seller_email: f.seller_email, seller_phone: f.seller_phone, seller_gstin: f.seller_gstin })); setItems([{ description: "", quantity: 1, rate: 0 }]); } }}>
          <DialogTrigger className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-3 h-8 rounded-lg transition-colors">
            <Plus size={16} /> New Invoice
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Create Invoice</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-5">

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Invoice Date</Label>
                  <Input type="date" value={form.invoice_date} onChange={e => setForm({ ...form, invoice_date: e.target.value })} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Due Date</Label>
                  <Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
                </div>
              </div>

              {/* Seller */}
              <div className={sectionStyle}>
                <p className={sectionTitle}>Seller Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Business Name</Label><Input placeholder="Markwings" value={form.seller_name} onChange={e => setForm({ ...form, seller_name: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Address</Label><Input placeholder="Mumbai, India" value={form.seller_address} onChange={e => setForm({ ...form, seller_address: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Email</Label><Input type="email" placeholder="hello@markwings.com" value={form.seller_email} onChange={e => setForm({ ...form, seller_email: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Phone</Label><Input placeholder="+91 98765 43210" value={form.seller_phone} onChange={e => setForm({ ...form, seller_phone: e.target.value })} /></div>
                  <div className="space-y-1.5 col-span-2"><Label>GSTIN (optional)</Label><Input placeholder="22AAAAA0000A1Z5" value={form.seller_gstin} onChange={e => setForm({ ...form, seller_gstin: e.target.value })} /></div>
                </div>
              </div>

              {/* Customer */}
              <div className={sectionStyle}>
                <p className={sectionTitle}>Customer Details</p>
                {clients.length > 0 && (
                  <div className="space-y-1.5">
                    <Label>Select from saved clients</Label>
                    <select className={selectStyle} defaultValue="" onChange={e => selectClient(e.target.value)}>
                      <option value="">— Pick a client —</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ""}</option>)}
                    </select>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Customer Name *</Label><Input placeholder="Rahul Sharma" value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} required /></div>
                  <div className="space-y-1.5"><Label>Customer Email</Label><Input type="email" placeholder="rahul@company.com" value={form.customer_email} onChange={e => setForm({ ...form, customer_email: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Company Name</Label><Input placeholder="ABC Pvt Ltd" value={form.customer_company} onChange={e => setForm({ ...form, customer_company: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Customer GSTIN (B2B)</Label><Input placeholder="27AAAAA0000A1Z5" value={form.customer_gstin} onChange={e => setForm({ ...form, customer_gstin: e.target.value })} /></div>
                  <div className="space-y-1.5 col-span-2"><Label>Billing Address</Label><Input placeholder="Delhi, India" value={form.customer_address} onChange={e => setForm({ ...form, customer_address: e.target.value })} /></div>
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-2">
                <p className={sectionTitle}>Line Items</p>
                {items.map((item, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-4"><Input placeholder="Description" value={item.description} onChange={e => updateItem(i, "description", e.target.value)} required /></div>
                    <div className="col-span-2"><Input placeholder="HSN/SAC" value={item.hsn_code || ""} onChange={e => updateItem(i, "hsn_code", e.target.value)} /></div>
                    <div className="col-span-2"><Input type="number" placeholder="Qty" min={1} value={item.quantity} onChange={e => updateItem(i, "quantity", parseInt(e.target.value) || 1)} /></div>
                    <div className="col-span-2"><Input type="number" placeholder="Rate ₹" min={0} value={item.rate} onChange={e => updateItem(i, "rate", parseFloat(e.target.value) || 0)} /></div>
                    <div className="col-span-1 text-right text-xs text-gray-500 dark:text-gray-400">₹{(item.quantity * item.rate).toLocaleString("en-IN")}</div>
                    <div className="col-span-1 flex justify-end"><button type="button" onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button></div>
                  </div>
                ))}
                <button type="button" onClick={addItem} className="flex items-center gap-1 text-violet-600 text-sm hover:underline"><Plus size={14} /> Add Item</button>
              </div>

              {/* Tax */}
              <div className={sectionStyle}>
                <p className={sectionTitle}>Tax Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>GST Type</Label>
                    <select value={form.gst_type} onChange={e => setForm({ ...form, gst_type: e.target.value })} className={selectStyle}>
                      <option value="cgst_sgst">CGST + SGST (Intra-state)</option>
                      <option value="igst">IGST (Inter-state)</option>
                      <option value="none">No GST</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>GST Rate (%)</Label>
                    <select value={form.gst_rate} onChange={e => setForm({ ...form, gst_rate: e.target.value })} className={selectStyle}>
                      <option value="0">0%</option>
                      <option value="5">5%</option>
                      <option value="12">12%</option>
                      <option value="18">18%</option>
                      <option value="28">28%</option>
                    </select>
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm space-y-1.5 mt-2">
                  <div className="flex justify-between text-gray-500 dark:text-gray-400"><span>Subtotal</span><span>₹{subtotal.toLocaleString("en-IN")}</span></div>
                  {form.gst_type === "cgst_sgst" && <>
                    <div className="flex justify-between text-gray-500 dark:text-gray-400"><span>CGST ({parseFloat(form.gst_rate) / 2}%)</span><span>₹{halfGst.toLocaleString("en-IN")}</span></div>
                    <div className="flex justify-between text-gray-500 dark:text-gray-400"><span>SGST ({parseFloat(form.gst_rate) / 2}%)</span><span>₹{halfGst.toLocaleString("en-IN")}</span></div>
                  </>}
                  {form.gst_type === "igst" && <div className="flex justify-between text-gray-500 dark:text-gray-400"><span>IGST ({form.gst_rate}%)</span><span>₹{gstAmt.toLocaleString("en-IN")}</span></div>}
                  <div className="flex justify-between font-bold text-gray-900 dark:text-white border-t dark:border-gray-700 pt-1.5"><span>Grand Total</span><span>₹{total.toLocaleString("en-IN")}</span></div>
                </div>
              </div>

              {/* Payment */}
              <div className={sectionStyle}>
                <p className={sectionTitle}>Payment Information</p>

                {/* Multi-select payment methods */}
                <div className="space-y-1.5">
                  <Label>Payment Method(s)</Label>
                  <div className="flex flex-wrap gap-2">
                    {PAYMENT_OPTIONS.map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => togglePaymentMethod(m)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                          form.payment_methods.includes(m)
                            ? "bg-violet-600 text-white border-violet-600"
                            : "bg-transparent text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-violet-400"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* UPI ID */}
                {hasUPI && (
                  <div className="space-y-1.5">
                    <Label>UPI ID</Label>
                    <Input placeholder="yourname@upi" value={form.upi_id} onChange={e => setForm({ ...form, upi_id: e.target.value })} />
                  </div>
                )}

                {/* Bank Details */}
                {hasBank && (
                  <div className="space-y-3 border-t dark:border-gray-700 pt-3">
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Bank Details</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5"><Label>Account Name</Label><Input placeholder="Rahul Sharma / Markwings" value={form.bank_account_name} onChange={e => setForm({ ...form, bank_account_name: e.target.value })} /></div>
                      <div className="space-y-1.5"><Label>Account Number</Label><Input placeholder="1234567890" value={form.bank_account_number} onChange={e => setForm({ ...form, bank_account_number: e.target.value })} /></div>
                      <div className="space-y-1.5"><Label>IFSC Code</Label><Input placeholder="SBIN0001234" value={form.bank_ifsc} onChange={e => setForm({ ...form, bank_ifsc: e.target.value })} /></div>
                      <div className="space-y-1.5"><Label>Bank Name</Label><Input placeholder="State Bank of India" value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })} /></div>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>Transaction ID (if already paid)</Label>
                  <Input placeholder="TXN123456" value={form.transaction_id} onChange={e => setForm({ ...form, transaction_id: e.target.value })} />
                </div>
              </div>

              {/* Notes & Terms */}
              <div className="space-y-3">
                <div className="space-y-1.5"><Label>Notes / Remarks</Label><Textarea placeholder="Thank you for your business!" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
                <div className="space-y-1.5"><Label>Terms & Conditions</Label><Textarea value={form.terms} onChange={e => setForm({ ...form, terms: e.target.value })} rows={2} /></div>
              </div>

              {/* Recurring */}
              <div className={sectionStyle}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={sectionTitle}>Recurring Invoice {!canRecurring && <span className="text-xs text-orange-500 font-normal ml-1">(Pro+)</span>}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Auto-generate this invoice on a schedule</p>
                  </div>
                  <button type="button" disabled={!canRecurring} onClick={() => canRecurring && setForm(f => ({ ...f, is_recurring: !f.is_recurring }))}
                    className={`relative w-10 h-5 rounded-full transition-colors ${form.is_recurring ? "bg-violet-600" : "bg-gray-300 dark:bg-gray-600"}`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.is_recurring ? "translate-x-5" : ""}`} />
                  </button>
                </div>
                {form.is_recurring && (
                  <div className="space-y-1.5 mt-3">
                    <Label>Frequency</Label>
                    <select value={form.recurrence_interval} onChange={e => setForm(f => ({ ...f, recurrence_interval: e.target.value }))} className={selectStyle}>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                    </select>
                  </div>
                )}
              </div>

              <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-700 text-white" disabled={saving}>
                {saving ? "Creating..." : "Create Invoice"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {!isPro && invoices.length > 0 && <AdBanner format="horizontal" className="mb-6" />}

      {/* Search + Filter */}
      {invoices.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search by name or invoice #"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setPage(0); }}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <div className="flex gap-1.5">
            {["all", "unpaid", "partial", "paid", "overdue"].map(s => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setPage(0); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border capitalize transition-colors ${statusFilter === s ? "bg-violet-600 text-white border-violet-600" : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-violet-400"}`}
              >{s}</button>
            ))}
          </div>
        </div>
      )}

      {/* Bulk action bar */}
      {canBulkOps && bulkSelected.size > 0 && (
        <div className="flex items-center justify-between bg-violet-50 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-700 rounded-lg px-4 py-2.5 mb-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-violet-700 dark:text-violet-300 font-medium">{bulkSelected.size} selected</span>
            <button onClick={() => setBulkSelected(new Set())} className="text-xs text-violet-500 dark:text-violet-400 underline">Clear</button>
          </div>
          <div className="flex gap-2">
            <Button onClick={bulkMarkPaid} disabled={bulkWorking} className="h-7 text-xs px-3 bg-green-600 hover:bg-green-700 text-white">Mark Paid</Button>
            <Button onClick={bulkDelete} disabled={bulkWorking} variant="outline" className="h-7 text-xs px-3 text-red-600 border-red-300 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20">Delete</Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-20 text-gray-400 dark:text-gray-600">
          <Receipt size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium dark:text-gray-400">No invoices yet</p>
          <p className="text-sm">Create your first GST invoice</p>
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-600">
          <Search size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-base font-medium dark:text-gray-400">No invoices match your filter</p>
          <button onClick={() => { setSearchQuery(""); setStatusFilter("all"); }} className="text-sm text-violet-500 underline mt-1">Clear filters</button>
        </div>
      ) : (
        <div className="space-y-3">
          {pagedInvoices.map((inv, i) => (
            <div key={inv.id}>
              {!isPro && i > 0 && i % 4 === 0 && <AdBanner format="rectangle" className="my-3" />}
            <Card className={`hover:shadow-md transition-shadow cursor-pointer ${bulkSelected.has(inv.id) ? "border-violet-400 dark:border-violet-600" : ""}`} onClick={() => { setSelected(inv); setPreviewTab("details"); }}>
              <CardContent className="p-4 flex items-center gap-3">
                {canBulkOps && <input type="checkbox" checked={bulkSelected.has(inv.id)} onChange={e => { e.stopPropagation(); toggleBulk(inv.id); }} onClick={e => e.stopPropagation()} className="w-4 h-4 accent-violet-600 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white">{inv.invoice_number}</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
                    {inv.customer_name || inv.customer_company || "No customer"} •{" "}
                    {new Date(inv.invoice_date || inv.created_at).toLocaleDateString("en-IN")}
                    {inv.due_date && ` • Due ${new Date(inv.due_date).toLocaleDateString("en-IN")}`}
                  </p>
                </div>
                <div className="flex items-center gap-2.5" onClick={e => e.stopPropagation()}>
                  <div className="text-right">
                    <span className="font-semibold text-gray-900 dark:text-white">₹{inv.total.toLocaleString("en-IN")}</span>
                    {(inv.amount_paid ?? 0) > 0 && inv.status !== "paid" && (
                      <p className="text-xs text-blue-500">₹{(inv.amount_paid ?? 0).toLocaleString("en-IN")} paid</p>
                    )}
                  </div>
                  <Badge className={statusColors[inv.status] || ""}>{inv.status}</Badge>
                  {inv.is_recurring && (
                    <span title={inv.next_invoice_date ? `Next: ${new Date(inv.next_invoice_date).toLocaleDateString("en-IN")}` : "Recurring"} className="flex items-center gap-1 text-xs text-violet-400">
                      <RefreshCw size={13} />
                      {inv.next_invoice_date && <span className="hidden sm:inline">{new Date(inv.next_invoice_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>}
                    </span>
                  )}
                  <button onClick={() => openEdit(inv)} className="text-gray-400 hover:text-violet-600 dark:hover:text-violet-400" title="Edit"><Pencil size={15} /></button>
                  {canSendEmail && <button onClick={() => { setSendTarget(inv); setSendEmail(inv.customer_email || ""); setSendName(inv.customer_name || ""); setSendMessage(""); }} className="text-gray-400 hover:text-violet-600 dark:hover:text-violet-400" title="Send by email"><Send size={16} /></button>}
                  <button
                    onClick={() => {
                      const msg = encodeURIComponent(`Hi ${inv.customer_name || "there"}, please find your invoice ${inv.invoice_number} for ₹${inv.total.toLocaleString("en-IN")}${inv.due_date ? `, due on ${new Date(inv.due_date).toLocaleDateString("en-IN")}` : ""}. Please arrange payment. Thank you!`);
                      window.open(`https://wa.me/?text=${msg}`, "_blank");
                    }}
                    className="text-gray-400 hover:text-green-500" title="WhatsApp"
                  ><MessageCircle size={16} /></button>
                  {inv.customer_email && inv.status !== "paid" && (
                    <button onClick={() => sendReminder(inv)} disabled={reminding === inv.id} className="text-gray-400 hover:text-amber-500" title="Send payment reminder">
                      <Bell size={15} className={reminding === inv.id ? "animate-pulse" : ""} />
                    </button>
                  )}
                  {inv.status !== "paid" && (
                    <button onClick={() => { setPayTarget(inv); setPayAmount(String(inv.total - (inv.amount_paid ?? 0))); setPayNote(""); }} className="text-gray-400 hover:text-green-600" title="Record payment">
                      <IndianRupee size={15} />
                    </button>
                  )}
                  {canPaymentLink && <button onClick={() => generatePaymentLink(inv)} disabled={generatingLink === inv.id || inv.status === "paid"} className="text-gray-400 hover:text-blue-600 disabled:opacity-30" title="Generate Razorpay payment link">
                    <Link2 size={15} className={generatingLink === inv.id ? "animate-pulse" : ""} />
                  </button>}
                  {inv.seller_gstin && <button onClick={() => setIrnTarget(inv)} className="text-gray-400 hover:text-violet-600" title="Generate E-Invoice JSON"><FileCode size={15} /></button>}
                  <button onClick={() => duplicateInvoice(inv)} className="text-gray-400 hover:text-violet-600" title="Duplicate invoice"><Copy size={15} /></button>
                  <button onClick={() => downloadInvoicePdf(inv, pdfColor, pdfTemplate, currency, exchangeRate, profileLogo, profileSignature)} className="text-gray-400 hover:text-violet-600" title="Download PDF"><Download size={16} /></button>
                  {inv.status === "unpaid" && <button onClick={() => markPaid(inv)} className="text-gray-400 hover:text-green-600" title="Mark as paid"><CheckCircle size={16} /></button>}
                  <button onClick={() => deleteInvoice(inv.id)} className="text-gray-400 hover:text-red-600" title="Delete"><Trash2 size={16} /></button>
                </div>
              </CardContent>
            </Card>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filteredInvoices.length)} of {filteredInvoices.length}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="dark:border-gray-600 dark:text-gray-300">Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="dark:border-gray-600 dark:text-gray-300">Next</Button>
          </div>
        </div>
      )}

      {/* View Invoice Dialog */}
      {selected && (
        <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
          <DialogContent className="max-w-lg p-0 overflow-hidden">
            <div className="flex flex-col max-h-[85vh]">
            <div className="px-6 pt-6 pb-2 border-b dark:border-gray-700 shrink-0">
              <DialogHeader><DialogTitle>{selected.invoice_number}</DialogTitle></DialogHeader>
            </div>
            {/* Tab switcher */}
            <div className="flex border-b dark:border-gray-700 px-6 shrink-0">
              {(["details", "preview"] as const).map(tab => (
                <button key={tab} onClick={() => setPreviewTab(tab)}
                  className={`px-4 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors ${previewTab === tab ? "border-violet-600 text-violet-600 dark:text-violet-400" : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}>
                  {tab === "preview" ? "PDF Preview" : "Details"}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 text-sm space-y-4">
            {previewTab === "preview" && selected ? (
              <div className="bg-white dark:bg-gray-900 border dark:border-gray-700 rounded-lg p-6 text-xs font-mono text-gray-800 dark:text-gray-200 space-y-4">
                {/* Header */}
                <div className="flex justify-between items-start pb-4 border-b dark:border-gray-700">
                  <div>
                    <p className="text-lg font-bold" style={{ color: pdfColor && pdfColor !== "none" ? pdfColor : undefined }}>INVOICE</p>
                    <p className="text-gray-500">#{selected.invoice_number}</p>
                  </div>
                  <div className="text-right text-gray-500 space-y-0.5">
                    <p>Date: {selected.invoice_date}</p>
                    {selected.due_date && <p>Due: {selected.due_date}</p>}
                    <p className="uppercase font-semibold">{selected.status}</p>
                  </div>
                </div>
                {/* From / To */}
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="font-bold text-gray-500 uppercase text-xs mb-1">From</p>{[selected.seller_name, selected.seller_address, selected.seller_email, selected.seller_phone].filter(Boolean).map((l, i) => <p key={i}>{l}</p>)}</div>
                  <div><p className="font-bold text-gray-500 uppercase text-xs mb-1">To</p>{[selected.customer_name, selected.customer_company, selected.customer_address].filter(Boolean).map((l, i) => <p key={i}>{l}</p>)}</div>
                </div>
                {/* Items */}
                <table className="w-full border-collapse">
                  <thead><tr className="border-b dark:border-gray-700" style={{ color: pdfColor && pdfColor !== "none" ? pdfColor : undefined }}>
                    <th className="text-left py-1">Description</th><th className="text-right py-1">Qty</th><th className="text-right py-1">Rate</th><th className="text-right py-1">Amount</th>
                  </tr></thead>
                  <tbody>{selected.items.map((item, i) => (
                    <tr key={i} className="border-b dark:border-gray-700"><td className="py-1">{item.description}</td><td className="text-right py-1">{item.quantity}</td><td className="text-right py-1">₹{item.rate.toLocaleString("en-IN")}</td><td className="text-right py-1">₹{(item.quantity * item.rate).toLocaleString("en-IN")}</td></tr>
                  ))}</tbody>
                </table>
                {/* Totals */}
                <div className="space-y-1 text-right">
                  <p className="text-gray-500">Subtotal: ₹{selected.subtotal.toLocaleString("en-IN")}</p>
                  {selected.gst_type === "cgst_sgst" && <><p className="text-gray-500">CGST ({selected.gst_rate/2}%): ₹{(selected.cgst||0).toLocaleString("en-IN")}</p><p className="text-gray-500">SGST ({selected.gst_rate/2}%): ₹{(selected.sgst||0).toLocaleString("en-IN")}</p></>}
                  {selected.gst_type === "igst" && <p className="text-gray-500">IGST ({selected.gst_rate}%): ₹{(selected.igst||0).toLocaleString("en-IN")}</p>}
                  <p className="font-bold text-base" style={{ color: pdfColor && pdfColor !== "none" ? pdfColor : undefined }}>Grand Total: ₹{selected.total.toLocaleString("en-IN")}</p>
                  {(selected.amount_paid ?? 0) > 0 && <p className="text-green-600">Paid: ₹{(selected.amount_paid ?? 0).toLocaleString("en-IN")}</p>}
                </div>
                {selected.notes && <div className="border-t dark:border-gray-700 pt-3"><p className="font-bold text-gray-500 uppercase text-xs mb-1">Notes</p><p>{selected.notes}</p></div>}
                {selected.terms && <div><p className="font-bold text-gray-500 uppercase text-xs mb-1">Terms</p><p>{selected.terms}</p></div>}
              </div>
            ) : (
              <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 uppercase font-semibold mb-1">From</p>
                  <p className="font-medium dark:text-white">{selected.seller_name}</p>
                  <p className="text-gray-500 dark:text-gray-400">{selected.seller_address}</p>
                  <p className="text-gray-500 dark:text-gray-400">{selected.seller_email}</p>
                  <p className="text-gray-500 dark:text-gray-400">{selected.seller_phone}</p>
                  {selected.seller_gstin && <p className="text-gray-500 dark:text-gray-400">GSTIN: {selected.seller_gstin}</p>}
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 uppercase font-semibold mb-1">To</p>
                  <p className="font-medium dark:text-white">{selected.customer_name}</p>
                  {selected.customer_company && <p className="text-gray-500 dark:text-gray-400">{selected.customer_company}</p>}
                  <p className="text-gray-500 dark:text-gray-400">{selected.customer_address}</p>
                  {selected.customer_gstin && <p className="text-gray-500 dark:text-gray-400">GSTIN: {selected.customer_gstin}</p>}
                </div>
              </div>

              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                  <th className="text-left p-2">Description</th>
                  <th className="text-right p-2">Qty</th>
                  <th className="text-right p-2">Rate</th>
                  <th className="text-right p-2">Amount</th>
                </tr></thead>
                <tbody>{selected.items.map((item, i) => (
                  <tr key={i} className="border-b dark:border-gray-700 dark:text-gray-300">
                    <td className="p-2">{item.description}</td>
                    <td className="p-2 text-right">{item.quantity}</td>
                    <td className="p-2 text-right">₹{item.rate.toLocaleString("en-IN")}</td>
                    <td className="p-2 text-right">₹{(item.quantity * item.rate).toLocaleString("en-IN")}</td>
                  </tr>
                ))}</tbody>
              </table>

              <div className="space-y-1">
                <div className="flex justify-between text-gray-500 dark:text-gray-400"><span>Subtotal</span><span>₹{selected.subtotal.toLocaleString("en-IN")}</span></div>
                {selected.gst_type === "cgst_sgst" ? <>
                  <div className="flex justify-between text-gray-500 dark:text-gray-400"><span>CGST ({selected.gst_rate/2}%)</span><span>₹{(selected.cgst||0).toLocaleString("en-IN")}</span></div>
                  <div className="flex justify-between text-gray-500 dark:text-gray-400"><span>SGST ({selected.gst_rate/2}%)</span><span>₹{(selected.sgst||0).toLocaleString("en-IN")}</span></div>
                </> : selected.gst_type === "igst" ? (
                  <div className="flex justify-between text-gray-500 dark:text-gray-400"><span>IGST ({selected.gst_rate}%)</span><span>₹{(selected.igst||0).toLocaleString("en-IN")}</span></div>
                ) : null}
                <div className="flex justify-between font-bold text-gray-900 dark:text-white border-t dark:border-gray-700 pt-1"><span>Grand Total</span><span>₹{selected.total.toLocaleString("en-IN")}</span></div>
              </div>

              {/* Payment details */}
              {(() => {
                const methods = selected.payment_methods?.length ? selected.payment_methods : selected.payment_method ? [selected.payment_method] : [];
                const hasUpiView = methods.includes("UPI");
                const hasBankView = methods.includes("Bank Transfer");
                if (!methods.length && !selected.transaction_id) return null;
                return (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded p-3 space-y-1.5">
                    <p className="font-semibold text-xs text-gray-600 dark:text-gray-400 uppercase">Payment Details</p>
                    {methods.length > 0 && <p className="dark:text-gray-300">Method: {methods.join(", ")}</p>}
                    {hasUpiView && selected.upi_id && <p className="dark:text-gray-300">UPI ID: <span className="font-medium">{selected.upi_id}</span></p>}
                    {hasBankView && selected.bank_account_number && (<>
                      <p className="dark:text-gray-300">Account: <span className="font-medium">{selected.bank_account_name}</span></p>
                      <p className="dark:text-gray-300">Account No: <span className="font-medium">{selected.bank_account_number}</span></p>
                      <p className="dark:text-gray-300">IFSC: <span className="font-medium">{selected.bank_ifsc}</span> | Bank: <span className="font-medium">{selected.bank_name}</span></p>
                    </>)}
                    {selected.transaction_id && <p className="dark:text-gray-300">Txn ID: {selected.transaction_id}</p>}
                    <Badge className={statusColors[selected.status] || ""}>{selected.status}</Badge>
                  </div>
                );
              })()}

              {selected.payment_note && (
                <div>
                  <p className="font-semibold text-xs text-gray-600 dark:text-gray-400 uppercase mb-1">Payment History</p>
                  {selected.payment_note.split("\n").map((line, i) => (
                    <p key={i} className="text-xs text-gray-500 dark:text-gray-400 font-mono">{line}</p>
                  ))}
                </div>
              )}
              {selected.notes && <div><p className="font-semibold text-xs text-gray-600 dark:text-gray-400 uppercase mb-1">Notes</p><p className="text-gray-500 dark:text-gray-400">{selected.notes}</p></div>}
              {selected.terms && <div><p className="font-semibold text-xs text-gray-600 dark:text-gray-400 uppercase mb-1">Terms</p><p className="text-gray-500 dark:text-gray-400">{selected.terms}</p></div>}
            </div>
            )}
            </div>

            {/* Sticky footer — always visible */}
            <div className="shrink-0 border-t dark:border-gray-700 px-6 pt-3 pb-4 bg-white dark:bg-gray-950 space-y-3">
              {/* Template + Currency row */}
              <div className="flex items-end gap-4">
                <div>
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-1.5">
                    Template {!canUseTemplates && <span className="text-orange-500 font-normal normal-case">(Basic+)</span>}
                  </p>
                  <div className="flex gap-1.5">
                    {PDF_TEMPLATES.map(t => {
                      const locked = !canUseTemplates && t.id !== "classic";
                      return (
                        <button key={t.id} onClick={() => !locked && setPdfTemplate(t.id)} disabled={locked}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${locked ? "opacity-40 cursor-not-allowed border-gray-200 dark:border-gray-700 text-gray-400" : pdfTemplate === t.id ? "bg-violet-600 text-white border-violet-600" : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-violet-400"}`}>
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-1.5">
                    Currency {!canCurrency && <span className="text-orange-500 font-normal normal-case">(Advanced)</span>}
                  </p>
                  <select disabled={!canCurrency} value={currency} onChange={async e => {
                    const c = e.target.value; setCurrency(c);
                    if (c !== "INR") {
                      const data = await fetch(`/api/exchange-rates?base=INR`).then(r => r.json());
                      if (data.rates?.[c]) setExchangeRate(data.rates[c]);
                    } else { setExchangeRate(1); }
                  }} className="h-8 rounded-lg border border-input bg-white dark:bg-gray-900 dark:text-gray-100 px-2 text-sm outline-none disabled:opacity-40 disabled:cursor-not-allowed">
                    {Object.entries(CURRENCIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>
              {/* Color picker */}
              <div>
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-1.5">Accent Color</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {["#7c3aed","#2563eb","#16a34a","#dc2626","#d97706","#0891b2","#db2777","#000000"].map(c => (
                    <button key={c} onClick={() => setPdfColor(c)} className="w-6 h-6 rounded-full border-2 transition-all" style={{ backgroundColor: c, borderColor: pdfColor === c ? "#000" : "transparent" }} />
                  ))}
                  <label className="relative w-6 h-6 rounded-full border-2 border-gray-300 overflow-hidden cursor-pointer">
                    <input type="color" className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" value={pdfColor ?? "#ffffff"} onChange={e => setPdfColor(e.target.value)} />
                    <span className="flex items-center justify-center w-full h-full text-xs text-gray-400">+</span>
                  </label>
                  <button onClick={() => setPdfColor("none")} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs text-gray-400 transition-all ${pdfColor === "none" ? "border-black" : "border-gray-300"}`} style={{ background: "repeating-linear-gradient(45deg,#ccc,#ccc 2px,#fff 2px,#fff 6px)" }} />
                </div>
              </div>
              {/* Action buttons */}
              <div className="flex gap-2">
                <Button onClick={() => downloadInvoicePdf(selected, pdfColor, pdfTemplate, currency)} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white gap-2">
                  <Download size={16} /> Download PDF
                </Button>
                {canSendEmail && <Button variant="outline" onClick={() => { setSendTarget(selected); setSendEmail(selected.customer_email || ""); setSendName(selected.customer_name || ""); setSelected(null); }} className="flex-1 gap-2 dark:border-gray-600 dark:text-gray-300">
                  <Send size={16} /> Send Email
                </Button>}
              </div>
            </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Invoice Dialog */}
      <Dialog open={!!editTarget} onOpenChange={v => { if (!v) setEditTarget(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Invoice — {editTarget?.invoice_number}</DialogTitle></DialogHeader>
          {editTarget && (() => {
            const ef = editForm;
            const setEf = (patch: Partial<typeof emptyForm>) => setEditForm(f => ({ ...f, ...patch }));
            const editHasUPI = ef.payment_methods.includes("UPI");
            const editHasBank = ef.payment_methods.includes("Bank Transfer");
            const editSubtotal = editItems.reduce((s, i) => s + i.quantity * i.rate, 0);
            const editGstAmt = (editSubtotal * parseFloat(ef.gst_rate || "0")) / 100;
            const editTotal = editSubtotal + editGstAmt;
            const editHalfGst = editGstAmt / 2;
            return (
              <form onSubmit={handleUpdate} className="space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Invoice Date</Label><Input type="date" value={ef.invoice_date} onChange={e => setEf({ invoice_date: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Due Date</Label><Input type="date" value={ef.due_date} onChange={e => setEf({ due_date: e.target.value })} /></div>
                </div>

                <div className={sectionStyle}>
                  <p className={sectionTitle}>Seller Details</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label>Business Name</Label><Input value={ef.seller_name} onChange={e => setEf({ seller_name: e.target.value })} /></div>
                    <div className="space-y-1.5"><Label>Address</Label><Input value={ef.seller_address} onChange={e => setEf({ seller_address: e.target.value })} /></div>
                    <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={ef.seller_email} onChange={e => setEf({ seller_email: e.target.value })} /></div>
                    <div className="space-y-1.5"><Label>Phone</Label><Input value={ef.seller_phone} onChange={e => setEf({ seller_phone: e.target.value })} /></div>
                    <div className="space-y-1.5 col-span-2"><Label>GSTIN</Label><Input value={ef.seller_gstin} onChange={e => setEf({ seller_gstin: e.target.value })} /></div>
                  </div>
                </div>

                <div className={sectionStyle}>
                  <p className={sectionTitle}>Customer Details</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label>Customer Name</Label><Input value={ef.customer_name} onChange={e => setEf({ customer_name: e.target.value })} /></div>
                    <div className="space-y-1.5"><Label>Customer Email</Label><Input type="email" value={ef.customer_email} onChange={e => setEf({ customer_email: e.target.value })} /></div>
                    <div className="space-y-1.5"><Label>Company</Label><Input value={ef.customer_company} onChange={e => setEf({ customer_company: e.target.value })} /></div>
                    <div className="space-y-1.5"><Label>GSTIN</Label><Input value={ef.customer_gstin} onChange={e => setEf({ customer_gstin: e.target.value })} /></div>
                    <div className="space-y-1.5 col-span-2"><Label>Billing Address</Label><Input value={ef.customer_address} onChange={e => setEf({ customer_address: e.target.value })} /></div>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className={sectionTitle}>Line Items</p>
                  {editItems.map((item, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5"><Input value={item.description} onChange={e => { const u=[...editItems]; u[i]={...u[i],description:e.target.value}; setEditItems(u); }} /></div>
                      <div className="col-span-2"><Input type="number" min={1} value={item.quantity} onChange={e => { const u=[...editItems]; u[i]={...u[i],quantity:parseInt(e.target.value)||1}; setEditItems(u); }} /></div>
                      <div className="col-span-3"><Input type="number" min={0} value={item.rate} onChange={e => { const u=[...editItems]; u[i]={...u[i],rate:parseFloat(e.target.value)||0}; setEditItems(u); }} /></div>
                      <div className="col-span-1 text-right text-xs text-gray-500 dark:text-gray-400">₹{(item.quantity*item.rate).toLocaleString("en-IN")}</div>
                      <div className="col-span-1 flex justify-end"><button type="button" onClick={() => setEditItems(editItems.filter((_,idx)=>idx!==i))} className="text-red-400 hover:text-red-600"><Trash2 size={14}/></button></div>
                    </div>
                  ))}
                  <button type="button" onClick={() => setEditItems([...editItems,{description:"",quantity:1,rate:0}])} className="flex items-center gap-1 text-violet-600 text-sm hover:underline"><Plus size={14}/>Add Item</button>
                </div>

                <div className={sectionStyle}>
                  <p className={sectionTitle}>Tax Details</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label>GST Type</Label>
                      <select value={ef.gst_type} onChange={e => setEf({ gst_type: e.target.value })} className={selectStyle}>
                        <option value="cgst_sgst">CGST + SGST</option>
                        <option value="igst">IGST</option>
                        <option value="none">No GST</option>
                      </select>
                    </div>
                    <div className="space-y-1.5"><Label>GST Rate (%)</Label>
                      <select value={ef.gst_rate} onChange={e => setEf({ gst_rate: e.target.value })} className={selectStyle}>
                        <option value="0">0%</option><option value="5">5%</option><option value="12">12%</option><option value="18">18%</option><option value="28">28%</option>
                      </select>
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm space-y-1.5">
                    <div className="flex justify-between text-gray-500 dark:text-gray-400"><span>Subtotal</span><span>₹{editSubtotal.toLocaleString("en-IN")}</span></div>
                    {ef.gst_type === "cgst_sgst" && <><div className="flex justify-between text-gray-500 dark:text-gray-400"><span>CGST ({parseFloat(ef.gst_rate)/2}%)</span><span>₹{editHalfGst.toLocaleString("en-IN")}</span></div><div className="flex justify-between text-gray-500 dark:text-gray-400"><span>SGST ({parseFloat(ef.gst_rate)/2}%)</span><span>₹{editHalfGst.toLocaleString("en-IN")}</span></div></>}
                    {ef.gst_type === "igst" && <div className="flex justify-between text-gray-500 dark:text-gray-400"><span>IGST ({ef.gst_rate}%)</span><span>₹{editGstAmt.toLocaleString("en-IN")}</span></div>}
                    <div className="flex justify-between font-bold text-gray-900 dark:text-white border-t dark:border-gray-700 pt-1.5"><span>Grand Total</span><span>₹{editTotal.toLocaleString("en-IN")}</span></div>
                  </div>
                </div>

                <div className={sectionStyle}>
                  <p className={sectionTitle}>Payment Information</p>
                  <div className="space-y-1.5">
                    <Label>Payment Method(s)</Label>
                    <div className="flex flex-wrap gap-2">
                      {PAYMENT_OPTIONS.map(m => (
                        <button key={m} type="button"
                          onClick={() => setEf({ payment_methods: ef.payment_methods.includes(m) ? ef.payment_methods.filter(x=>x!==m) : [...ef.payment_methods,m] })}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${ef.payment_methods.includes(m) ? "bg-violet-600 text-white border-violet-600" : "bg-transparent text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600"}`}
                        >{m}</button>
                      ))}
                    </div>
                  </div>
                  {editHasUPI && <div className="space-y-1.5"><Label>UPI ID</Label><Input value={ef.upi_id} onChange={e => setEf({ upi_id: e.target.value })} placeholder="yourname@upi" /></div>}
                  {editHasBank && (
                    <div className="space-y-3 border-t dark:border-gray-700 pt-3">
                      <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Bank Details</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5"><Label>Account Name</Label><Input value={ef.bank_account_name} onChange={e => setEf({ bank_account_name: e.target.value })} /></div>
                        <div className="space-y-1.5"><Label>Account Number</Label><Input value={ef.bank_account_number} onChange={e => setEf({ bank_account_number: e.target.value })} /></div>
                        <div className="space-y-1.5"><Label>IFSC Code</Label><Input value={ef.bank_ifsc} onChange={e => setEf({ bank_ifsc: e.target.value })} /></div>
                        <div className="space-y-1.5"><Label>Bank Name</Label><Input value={ef.bank_name} onChange={e => setEf({ bank_name: e.target.value })} /></div>
                      </div>
                    </div>
                  )}
                  <div className="space-y-1.5"><Label>Transaction ID</Label><Input value={ef.transaction_id} onChange={e => setEf({ transaction_id: e.target.value })} placeholder="TXN123456" /></div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5"><Label>Notes</Label><Textarea value={ef.notes} onChange={e => setEf({ notes: e.target.value })} rows={2} /></div>
                  <div className="space-y-1.5"><Label>Terms & Conditions</Label><Textarea value={ef.terms} onChange={e => setEf({ terms: e.target.value })} rows={2} /></div>
                </div>

                <div className={sectionStyle}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={sectionTitle}>Recurring Invoice</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Auto-generate on a schedule</p>
                    </div>
                    <button type="button" onClick={() => setEf({ is_recurring: !ef.is_recurring })}
                      className={`relative w-10 h-5 rounded-full transition-colors ${ef.is_recurring ? "bg-violet-600" : "bg-gray-300 dark:bg-gray-600"}`}>
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${ef.is_recurring ? "translate-x-5" : ""}`} />
                    </button>
                  </div>
                  {ef.is_recurring && (
                    <div className="space-y-1.5 mt-3">
                      <Label>Frequency</Label>
                      <select value={ef.recurrence_interval} onChange={e => setEf({ recurrence_interval: e.target.value })} className={selectStyle}>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button type="submit" className="flex-1 bg-violet-600 hover:bg-violet-700 text-white" disabled={editSaving}>{editSaving ? "Saving..." : "Save Changes"}</Button>
                  <Button type="button" variant="outline" className="dark:border-gray-600 dark:text-gray-300" onClick={() => setEditTarget(null)}>Cancel</Button>
                </div>
              </form>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* E-Invoice / IRN Dialog */}
      {irnTarget && (
        <Dialog open={!!irnTarget} onOpenChange={() => setIrnTarget(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
            <div className="px-6 pt-5 pb-3 border-b dark:border-gray-700 shrink-0">
              <DialogHeader><DialogTitle>E-Invoice JSON — {irnTarget.invoice_number}</DialogTitle></DialogHeader>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Copy this JSON payload and submit it to your GSP (GST Suvidha Provider) to generate the IRN and QR code.</p>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <pre className="text-xs bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap">{JSON.stringify({
                Version: "1.1",
                TranDtls: { TaxSch: "GST", SupTyp: irnTarget.customer_gstin ? "B2B" : "B2C", RegRev: "N" },
                DocDtls: { Typ: "INV", No: irnTarget.invoice_number, Dt: irnTarget.invoice_date?.split("-").reverse().join("/") },
                SellerDtls: { Gstin: irnTarget.seller_gstin || "", LglNm: irnTarget.seller_name || "", Addr1: irnTarget.seller_address || "", Pin: "", Stcd: "" },
                BuyerDtls: { Gstin: irnTarget.customer_gstin || "URP", LglNm: irnTarget.customer_name || "", Pos: "", Addr1: irnTarget.customer_address || "", Pin: "", Stcd: "" },
                ItemList: irnTarget.items.map((item, i) => ({
                  SlNo: String(i + 1),
                  PrdDesc: item.description,
                  HsnCd: item.hsn_code || "",
                  Qty: item.quantity,
                  Unit: "NOS",
                  UnitPrice: item.rate,
                  TotAmt: item.quantity * item.rate,
                  AssAmt: item.quantity * item.rate,
                  GstRt: irnTarget.gst_rate || 0,
                  CgstAmt: irnTarget.gst_type === "cgst_sgst" ? (item.quantity * item.rate * (irnTarget.gst_rate || 0)) / 200 : 0,
                  SgstAmt: irnTarget.gst_type === "cgst_sgst" ? (item.quantity * item.rate * (irnTarget.gst_rate || 0)) / 200 : 0,
                  IgstAmt: irnTarget.gst_type === "igst" ? (item.quantity * item.rate * (irnTarget.gst_rate || 0)) / 100 : 0,
                  TotItemVal: item.quantity * item.rate * (1 + (irnTarget.gst_rate || 0) / 100),
                })),
                ValDtls: {
                  AssVal: irnTarget.subtotal,
                  CgstVal: irnTarget.cgst || 0,
                  SgstVal: irnTarget.sgst || 0,
                  IgstVal: irnTarget.igst || 0,
                  TotInvVal: irnTarget.total,
                },
              }, null, 2)}</pre>
            </div>
            <div className="px-6 pb-4 shrink-0">
              <Button onClick={async () => {
                const json = JSON.stringify({
                  Version: "1.1",
                  TranDtls: { TaxSch: "GST", SupTyp: irnTarget.customer_gstin ? "B2B" : "B2C", RegRev: "N" },
                  DocDtls: { Typ: "INV", No: irnTarget.invoice_number, Dt: irnTarget.invoice_date?.split("-").reverse().join("/") },
                  SellerDtls: { Gstin: irnTarget.seller_gstin || "", LglNm: irnTarget.seller_name || "", Addr1: irnTarget.seller_address || "", Pin: "", Stcd: "" },
                  BuyerDtls: { Gstin: irnTarget.customer_gstin || "URP", LglNm: irnTarget.customer_name || "", Pos: "", Addr1: irnTarget.customer_address || "", Pin: "", Stcd: "" },
                  ItemList: irnTarget.items.map((item, i) => ({
                    SlNo: String(i + 1), PrdDesc: item.description, HsnCd: item.hsn_code || "",
                    Qty: item.quantity, Unit: "NOS", UnitPrice: item.rate,
                    TotAmt: item.quantity * item.rate, AssAmt: item.quantity * item.rate,
                    GstRt: irnTarget.gst_rate || 0,
                    CgstAmt: irnTarget.gst_type === "cgst_sgst" ? (item.quantity * item.rate * (irnTarget.gst_rate || 0)) / 200 : 0,
                    SgstAmt: irnTarget.gst_type === "cgst_sgst" ? (item.quantity * item.rate * (irnTarget.gst_rate || 0)) / 200 : 0,
                    IgstAmt: irnTarget.gst_type === "igst" ? (item.quantity * item.rate * (irnTarget.gst_rate || 0)) / 100 : 0,
                    TotItemVal: item.quantity * item.rate * (1 + (irnTarget.gst_rate || 0) / 100),
                  })),
                  ValDtls: { AssVal: irnTarget.subtotal, CgstVal: irnTarget.cgst || 0, SgstVal: irnTarget.sgst || 0, IgstVal: irnTarget.igst || 0, TotInvVal: irnTarget.total },
                }, null, 2);
                await navigator.clipboard.writeText(json);
                toast.success("JSON copied to clipboard!");
              }} className="w-full bg-violet-600 hover:bg-violet-700 text-white">Copy JSON</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Record Payment Dialog */}
      <Dialog open={!!payTarget} onOpenChange={v => { if (!v) setPayTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          {payTarget && (
            <div className="space-y-1 text-sm text-gray-500 dark:text-gray-400 -mt-2 mb-2">
              <p>{payTarget.invoice_number} — Total ₹{payTarget.total.toLocaleString("en-IN")}</p>
              {(payTarget.amount_paid ?? 0) > 0 && (
                <p>Already paid: ₹{(payTarget.amount_paid ?? 0).toLocaleString("en-IN")} · Balance: ₹{(payTarget.total - (payTarget.amount_paid ?? 0)).toLocaleString("en-IN")}</p>
              )}
            </div>
          )}
          <form onSubmit={recordPayment} className="space-y-4">
            <div className="space-y-2">
              <Label>Amount Received (₹) *</Label>
              <Input type="number" min={0.01} step={0.01} value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="Enter amount" required />
            </div>
            <div className="space-y-2">
              <Label>Note (optional)</Label>
              <Input value={payNote} onChange={e => setPayNote(e.target.value)} placeholder="e.g. UPI transfer, ref #12345" />
            </div>
            <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white" disabled={paying}>
              {paying ? "Saving..." : "Record Payment"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Send Invoice Email Dialog */}
      <Dialog open={!!sendTarget} onOpenChange={v => { if (!v) setSendTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Send Invoice by Email</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-500 dark:text-gray-400 -mt-2">
            Sending <span className="font-medium text-gray-700 dark:text-gray-300">{sendTarget?.invoice_number}</span> via your Gmail SMTP.
          </p>
          <form onSubmit={handleSend} className="space-y-4 mt-1">
            <div className="space-y-2">
              <Label>Recipient Name</Label>
              <Input placeholder="Rahul Sharma" value={sendName} onChange={e => setSendName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Recipient Email *</Label>
              <Input type="email" placeholder="rahul@company.com" value={sendEmail} onChange={e => setSendEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Message (optional)</Label>
              <Textarea placeholder="Please find your invoice attached. Thank you for your business!" value={sendMessage} onChange={e => setSendMessage(e.target.value)} rows={3} />
            </div>
            <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-700 text-white gap-2" disabled={sending}>
              <Send size={14} /> {sending ? "Sending..." : "Send Invoice"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function InvoicesPage() {
  return (
    <Suspense>
      <InvoicesPageInner />
    </Suspense>
  );
}
