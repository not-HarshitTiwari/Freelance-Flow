import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// POST — invited member accepts the invite via token
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { token } = await request.json();
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  const { data: invite, error: fetchErr } = await supabase
    .from("team_members")
    .select("id, member_email, owner_id, status")
    .eq("invite_token", token)
    .maybeSingle();

  if (fetchErr || !invite) return NextResponse.json({ error: "Invalid or expired invite link" }, { status: 404 });
  if (invite.status !== "pending") {
    return NextResponse.json({ error: "This invite has already been used or was removed" }, { status: 409 });
  }

  // Ensure the logged-in user's email matches the invite
  const userEmail = user.email?.toLowerCase();
  if (userEmail !== invite.member_email.toLowerCase()) {
    return NextResponse.json(
      { error: `This invite was sent to ${invite.member_email}. Please sign in with that email address.` },
      { status: 403 }
    );
  }

  const { error: updateErr } = await supabase
    .from("team_members")
    .update({ status: "accepted", member_id: user.id, accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, ownerId: invite.owner_id });
}
