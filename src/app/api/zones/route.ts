import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
// test: import { supabase } from "../../../lib/supabase";

export async function GET() {
  const { data, error } = await supabase
    .from("zones")
    .select("id, slug, name, display_order")
    .order("display_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ zones: data ?? [] });
}
