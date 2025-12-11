import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdmin = url && serviceKey ? createClient(url, serviceKey) : null;

export function assertSupabaseAdmin() {
  if (!supabaseAdmin) {
    throw Object.assign(
      new Error("Admin Supabase client not configured. Set SUPABASE_SERVICE_ROLE_KEY."),
      { status: 500 }
    );
  }
  return supabaseAdmin;
}
