"use client";

import { useState } from "react";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay: any;
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

type Props = {
  invoiceId: string;
  invoiceNumber: string;
  portalToken: string;
  clientName?: string;
  clientEmail?: string;
};

export function PayNowButton({ invoiceId, invoiceNumber, portalToken, clientName, clientEmail }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    setLoading(true);
    setError(null);
    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        setError("Failed to load payment gateway. Check your internet connection.");
        return;
      }

      const orderRes = await fetch("/api/invoices/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId, portalToken }),
      });
      const orderData = await orderRes.json();
      if (orderData.error) {
        setError(orderData.error);
        return;
      }

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: orderData.currency,
        order_id: orderData.order_id,
        name: "Invoice Payment",
        description: `Invoice ${invoiceNumber}`,
        prefill: { name: clientName || "", email: clientEmail || "" },
        theme: { color: "#7c3aed" },
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          const verifyRes = await fetch("/api/invoices/verify-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              invoiceId,
              portalToken,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });
          const verifyData = await verifyRes.json();
          if (verifyData.error) {
            setError(`Payment received but verification failed: ${verifyData.error}. Contact support.`);
            return;
          }
          window.location.reload();
        },
        modal: {
          ondismiss: () => setLoading(false),
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (resp: { error: { description: string } }) => {
        setError(resp.error.description || "Payment failed. Please try again.");
        setLoading(false);
      });
      rzp.open();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handlePay}
        disabled={loading}
        className="flex items-center justify-center gap-2 w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
      >
        {loading ? "Opening payment..." : "Pay Now"}
      </button>
      {error && <p className="text-xs text-red-600 dark:text-red-400 mt-1.5">{error}</p>}
    </div>
  );
}
