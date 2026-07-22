import { NextResponse } from "next/server";

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const STATE_CODES: Record<string, string> = {
  "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab",
  "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana", "07": "Delhi",
  "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim",
  "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur", "15": "Mizoram",
  "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
  "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh",
  "24": "Gujarat", "25": "Daman and Diu", "26": "Dadra and Nagar Haveli",
  "27": "Maharashtra", "28": "Andhra Pradesh", "29": "Karnataka", "30": "Goa",
  "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry",
  "35": "Andaman and Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh",
  "38": "Ladakh", "97": "Other Territory", "99": "Centre Jurisdiction",
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const gstin = searchParams.get("gstin")?.trim().toUpperCase();

  if (!gstin || !GSTIN_RE.test(gstin)) {
    return NextResponse.json({ error: "Invalid GSTIN format" }, { status: 400 });
  }

  const apiKey = process.env.GST_CHECK_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GST_CHECK_API_KEY is not configured. Get a free key at gstincheck.co.in and add it to .env.local." },
      { status: 503 }
    );
  }

  try {
    const res = await fetch(
      `https://sheet.gstincheck.co.in/check/${apiKey}/${gstin}`,
      { signal: AbortSignal.timeout(8000) }
    );

    const data = await res.json();

    if (!data.flag) {
      return NextResponse.json(
        { error: data.message || "GSTIN not found or inactive" },
        { status: 404 }
      );
    }

    const d = data.data ?? {};
    const pradr = d.pradr;

    // gstincheck returns address either as a flat string (pradr.adr) or
    // as a nested object (pradr.addr). Handle both.
    let address: string | null = null;
    if (typeof pradr?.adr === "string" && pradr.adr) {
      address = pradr.adr;
    } else if (pradr?.addr && typeof pradr.addr === "object") {
      const a = pradr.addr;
      address = [a.bno, a.flno, a.bnm, a.st, a.loc, a.dst, a.stcd, a.pncd]
        .filter(Boolean)
        .join(", ") || null;
    }

    const stateCode = gstin.substring(0, 2);

    return NextResponse.json({
      legalName: d.lgnm || null,
      tradeName: d.tradeNam || d.lgnm || null,
      address,
      state: pradr?.addr?.stcd || STATE_CODES[stateCode] || null,
      pincode: pradr?.addr?.pncd || null,
      status: d.sts || null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lookup failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
