// WhatsApp sending via the Meta Cloud API, with a client-side wa.me
// click-to-chat fallback when WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID
// aren't configured yet.

export function isWhatsAppCloudConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

export function buildWaMeLink(phone: string | null | undefined, message: string): string {
  const digits = phone?.replace(/[^\d]/g, "");
  const base = digits ? `https://wa.me/${digits}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(message)}`;
}

export async function sendWhatsAppText(
  toPhone: string,
  message: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) return { ok: false, error: "not_configured" };

  const to = toPhone.replace(/[^\d]/g, "");
  if (!to) return { ok: false, error: "Missing recipient phone number" };

  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: message },
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      return { ok: false, error: data?.error?.message || `WhatsApp API error (${res.status})` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "WhatsApp send failed" };
  }
}
