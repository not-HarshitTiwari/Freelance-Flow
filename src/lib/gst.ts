export type GstType = "cgst_sgst" | "igst" | "none" | null | undefined;

export type GstBreakdown = {
  subtotal: number;
  totalGst: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
};

export function calculateGst(
  items: { quantity: number; rate: number }[],
  gstType: GstType,
  gstRate: number | null | undefined
): GstBreakdown {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.rate, 0);
  const totalGst = (subtotal * (gstRate || 0)) / 100;
  const cgst = gstType === "cgst_sgst" ? totalGst / 2 : 0;
  const sgst = gstType === "cgst_sgst" ? totalGst / 2 : 0;
  const igst = gstType === "igst" ? totalGst : 0;
  const total = subtotal + totalGst;
  return { subtotal, totalGst, cgst, sgst, igst, total };
}
