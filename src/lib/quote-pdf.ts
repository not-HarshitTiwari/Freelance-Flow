type RGB = [number, number, number];

export type QuotePdfItem = { description: string; quantity: number; rate: number };

export type QuotePdfData = {
  quote_number: string;
  items: QuotePdfItem[];
  subtotal: number;
  cgst: number | null;
  sgst: number | null;
  igst: number | null;
  gst_type?: string | null;
  gst_rate?: number | null;
  total: number;
  status: string;
  valid_until?: string | null;
  notes?: string | null;
  terms?: string | null;
  seller_name?: string | null;
  seller_address?: string | null;
  seller_email?: string | null;
  seller_phone?: string | null;
  seller_gstin?: string | null;
  customer_name?: string | null;
  customer_company?: string | null;
  customer_address?: string | null;
  customer_gstin?: string | null;
  created_at?: string | null;
};

const ACCENT: RGB = [124, 58, 237];
const GRAY: RGB = [100, 100, 100];
const BLACK: RGB = [30, 30, 30];
const WHITE: RGB = [255, 255, 255];

export async function buildQuotePdf(q: QuotePdfData) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF();

  doc.setFillColor(...ACCENT); doc.rect(0, 0, 210, 28, "F"); doc.setTextColor(...WHITE);
  doc.setFontSize(20); doc.setFont("helvetica", "bold"); doc.text("QUOTATION", 14, 18);
  doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.text(`#${q.quote_number}`, 14, 24);
  doc.setFontSize(9);
  if (q.created_at) doc.text(`Date: ${new Date(q.created_at).toLocaleDateString("en-IN")}`, 140, 14);
  if (q.valid_until) doc.text(`Valid until: ${new Date(q.valid_until).toLocaleDateString("en-IN")}`, 140, 20);
  doc.text(`Status: ${q.status.toUpperCase()}`, 140, 26);

  const bodyStart = 40;
  doc.setTextColor(...BLACK); doc.setFontSize(10); doc.setFont("helvetica", "bold");
  doc.text("FROM", 14, bodyStart);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...GRAY);
  const seller = [q.seller_name, q.seller_address, q.seller_email, q.seller_phone, q.seller_gstin ? `GSTIN: ${q.seller_gstin}` : null].filter(Boolean) as string[];
  seller.forEach((line, i) => doc.text(line, 14, bodyStart + 7 + i * 5));

  doc.setTextColor(...BLACK); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text("TO", 110, bodyStart);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...GRAY);
  const customer = [q.customer_name, q.customer_company, q.customer_address, q.customer_gstin ? `GSTIN: ${q.customer_gstin}` : null].filter(Boolean) as string[];
  customer.forEach((line, i) => doc.text(line, 110, bodyStart + 7 + i * 5));

  const tableStartY = bodyStart + Math.max(seller.length, customer.length) * 5 + 14;
  autoTable(doc, {
    startY: tableStartY,
    head: [["#", "Description", "Qty", "Rate (₹)", "Amount (₹)"]],
    body: q.items.map((item, i) => [
      i + 1,
      item.description,
      item.quantity,
      item.rate.toLocaleString("en-IN"),
      (item.quantity * item.rate).toLocaleString("en-IN"),
    ]),
    headStyles: { fillColor: ACCENT, textColor: WHITE, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 8 }, 2: { cellWidth: 16 }, 3: { cellWidth: 32 }, 4: { cellWidth: 32 } },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = (doc as any).lastAutoTable.finalY + 8;
  const summaryX = 120;
  const rows: [string, string][] = [["Subtotal", `₹${q.subtotal.toLocaleString("en-IN")}`]];
  if (q.gst_type === "igst" && q.igst) {
    rows.push([`IGST${q.gst_rate ? ` (${q.gst_rate}%)` : ""}`, `₹${q.igst.toLocaleString("en-IN")}`]);
  } else if (q.cgst || q.sgst) {
    rows.push([`CGST${q.gst_rate ? ` (${q.gst_rate / 2}%)` : ""}`, `₹${(q.cgst || 0).toLocaleString("en-IN")}`]);
    rows.push([`SGST${q.gst_rate ? ` (${q.gst_rate / 2}%)` : ""}`, `₹${(q.sgst || 0).toLocaleString("en-IN")}`]);
  }
  rows.forEach(([label, value], i) => {
    doc.setFontSize(9); doc.setTextColor(...GRAY); doc.setFont("helvetica", "normal");
    doc.text(label, summaryX, finalY + i * 6);
    doc.text(value, 195, finalY + i * 6, { align: "right" });
  });

  const totalY = finalY + rows.length * 6 + 2;
  doc.setFillColor(...ACCENT); doc.rect(summaryX - 2, totalY - 4, 80, 10, "F"); doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text("TOTAL", summaryX, totalY + 3);
  doc.text(`₹${q.total.toLocaleString("en-IN")}`, 195, totalY + 3, { align: "right" });

  let infoY = totalY + 16;
  if (q.notes) {
    doc.setTextColor(...BLACK); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text("Notes", 14, infoY); doc.setFont("helvetica", "normal"); doc.setTextColor(...GRAY);
    const noteLines = doc.splitTextToSize(q.notes, 180);
    doc.text(noteLines, 14, infoY + 5); infoY += 5 + noteLines.length * 5 + 2;
  }
  if (q.terms) {
    doc.setTextColor(...BLACK); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text("Terms & Conditions", 14, infoY); doc.setFont("helvetica", "normal"); doc.setTextColor(...GRAY);
    const termLines = doc.splitTextToSize(q.terms, 180);
    doc.text(termLines, 14, infoY + 5);
  }

  doc.setFontSize(7); doc.setTextColor(...GRAY); doc.setFont("helvetica", "normal");
  doc.text("Created with FreelanceFlow", 196, doc.internal.pageSize.getHeight() - 6, { align: "right" });

  return doc;
}

export async function downloadQuotePdf(q: QuotePdfData) {
  const doc = await buildQuotePdf(q);
  doc.save(`${q.quote_number}.pdf`);
}
