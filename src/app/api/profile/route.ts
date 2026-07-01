import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getWorkspaceOwnerId, getWorkspaceRole, canManageWorkspace } from "@/lib/team";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getWorkspaceOwnerId(supabase, user.id);
  const role = await getWorkspaceRole(supabase, user.id);

  const { data } = await supabase.from("profiles").select("*").eq("id", ownerId).single();
  return NextResponse.json({ profile: data, role });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getWorkspaceOwnerId(supabase, user.id);
  const role = await getWorkspaceRole(supabase, user.id);
  if (!canManageWorkspace(role)) {
    return NextResponse.json({ error: "Your role doesn't allow changing workspace settings." }, { status: 403 });
  }

  const body = await request.json();

  // Allowlist only — never let the client write plan/billing/usage/id fields directly.
  const allowed = {
    full_name: body.full_name, business_name: body.business_name, business_address: body.business_address,
    email: body.email, phone: body.phone, gstin: body.gstin,
    upi_id: body.upi_id, bank_account_name: body.bank_account_name, bank_account_number: body.bank_account_number,
    bank_ifsc: body.bank_ifsc, bank_name: body.bank_name,
    smtp_email: body.smtp_email, smtp_password: body.smtp_password,
    logo_url: body.logo_url, signature_url: body.signature_url, signature_name: body.signature_name,
    inv_prefix: body.inv_prefix, inv_suffix: body.inv_suffix, inv_separator: body.inv_separator,
    inv_include_year: body.inv_include_year, inv_include_month: body.inv_include_month, inv_include_date: body.inv_include_date,
    inv_seq_digits: body.inv_seq_digits, inv_next_seq: body.inv_next_seq,
    reminder_cadence_days: body.reminder_cadence_days,
  };
  const updates: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(allowed)) {
    if (v !== undefined) updates[k] = v;
  }

  // The profile row always exists (auto-created on signup) — a plain update
  // keeps this within the "Admin members update workspace owner profile" RLS
  // policy, which only covers UPDATE, not the INSERT half of an upsert.
  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", ownerId)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile: data });
}
