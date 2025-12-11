// GET my deployments for a round

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = (searchParams.get("address") || "").trim();
  const round_id = (searchParams.get("round_id") || "").trim();
  if (!address || !round_id) return NextResponse.json({ error: "Missing address or round_id" }, { status: 400 });

  // Join zones so we can prefill the UI and lock selects
  const { data, error } = await supabase
    .from("deployments")
    .select("nft_mint, zone:zones!inner(slug, name)")
    .eq("wallet_address", address)
    .eq("round_id", round_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const deployments = (data ?? []).map((d: any) => ({
    nft_mint: d.nft_mint,
    zone_slug: d.zone?.slug,
    zone_name: d.zone?.name,
  }));

  return NextResponse.json({ deployments });
}
