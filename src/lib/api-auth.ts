import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export type ApiKeyAuth = { userId: string; scopes: string[] } | null;

export async function validateApiKey(req: Request): Promise<ApiKeyAuth> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ff_")) return null;

  const raw = authHeader.slice(7); // strip "Bearer "
  if (!raw.startsWith("ff_")) return null;

  const hashed = createHash("sha256").update(raw).digest("hex");
  const supabase = createAdminClient();

  const { data: key } = await supabase
    .from("api_keys")
    .select("id, user_id, scopes")
    .eq("key_hash", hashed)
    .single();

  if (!key) return null;

  // update last_used_at non-blocking
  supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", key.id).then(() => {});

  return { userId: key.user_id, scopes: key.scopes ?? [] };
}
