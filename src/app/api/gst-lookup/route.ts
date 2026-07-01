import { NextResponse } from "next/server";

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const gstin = searchParams.get("gstin")?.trim().toUpperCase();

  if (!gstin || !GSTIN_RE.test(gstin)) {
    return NextResponse.json({ error: "Invalid GSTIN format" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://services.gst.gov.in/services/api/search/taxpayerDetails?gstin=${gstin}`,
      {
        headers: {
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0",
        },
        signal: AbortSignal.timeout(6000),
      }
    );

    if (!res.ok) {
      return NextResponse.json({ error: "GST lookup failed" }, { status: 502 });
    }

    const data = await res.json();

    if (!data || data.errorCode) {
      return NextResponse.json({ error: "GSTIN not found or inactive" }, { status: 404 });
    }

    // Build a clean address from the registered address fields
    const addr = data.pradr?.adr;
    const addressParts = addr
      ? [addr.bno, addr.flno, addr.bnm, addr.st, addr.loc, addr.dst, addr.stcd, addr.pncd].filter(Boolean)
      : [];

    return NextResponse.json({
      legalName: data.lgnm || null,
      tradeName: data.tradeNam || data.lgnm || null,
      address: addressParts.join(", ") || null,
      state: addr?.stcd || null,
      pincode: addr?.pncd || null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lookup failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
