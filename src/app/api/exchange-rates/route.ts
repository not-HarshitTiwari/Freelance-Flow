import { NextResponse } from "next/server";

export const revalidate = 3600; // cache 1 hour

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const base = searchParams.get("base") || "INR";
  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=${base}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to fetch rates" }, { status: 500 });
  }
}
