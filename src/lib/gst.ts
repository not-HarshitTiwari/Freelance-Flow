export type GstType = "cgst_sgst" | "igst" | "none" | "vat" | null | undefined;

export type GstBreakdown = {
  grossSubtotal: number;
  discountTotal: number;
  subtotal: number;
  totalGst: number;
  cgst: number;
  sgst: number;
  igst: number;
  vatAmount: number;
  total: number;
};

export function calculateGst(
  items: { quantity: number; rate: number; discount_pct?: number }[],
  gstType: GstType,
  gstRate: number | null | undefined
): GstBreakdown {
  const grossSubtotal = items.reduce((sum, item) => sum + item.quantity * item.rate, 0);
  const discountTotal = items.reduce(
    (sum, item) => sum + item.quantity * item.rate * ((item.discount_pct || 0) / 100),
    0
  );
  const subtotal = grossSubtotal - discountTotal;

  let totalGst = 0, cgst = 0, sgst = 0, igst = 0, vatAmount = 0;

  if (gstType === "vat") {
    vatAmount = (subtotal * (gstRate || 0)) / 100;
  } else if (gstType && gstType !== "none") {
    totalGst = (subtotal * (gstRate || 0)) / 100;
    cgst = gstType === "cgst_sgst" ? totalGst / 2 : 0;
    sgst = gstType === "cgst_sgst" ? totalGst / 2 : 0;
    igst = gstType === "igst" ? totalGst : 0;
  }

  return { grossSubtotal, discountTotal, subtotal, totalGst, cgst, sgst, igst, vatAmount, total: subtotal + totalGst + vatAmount };
}
