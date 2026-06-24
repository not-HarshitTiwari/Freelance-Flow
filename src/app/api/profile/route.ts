import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return NextResponse.json({ profile: data });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  console.log("PROFILE PATCH body:", JSON.stringify(body));

  // Try update first; if no rows affected, upsert
  const { data, error } = await supabase
    .from("profiles")
    .upsert({ id: user.id, ...body }, { onConflict: "id" })
    .select()
    .single();

  console.log("PROFILE PATCH result:", JSON.stringify(data), "error:", error?.message);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile: data });
}
