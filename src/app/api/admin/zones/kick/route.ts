import { NextResponse } from "next/server";
import { assertSupabaseAdmin } from "@/lib/supabase-admin";
import { requireAdminWallet } from "@/lib/admin-auth";

type Body = {
  wallet: string;
  round_id: string;
  mints: string[];
};

export async function POST(req: Request) {
  try {
    const body: Body = await req.json();
    requireAdminWallet(body.wallet);
    const supabase = assertSupabaseAdmin();

    const roundId = body.round_id?.trim();
    const mints = Array.isArray(body.mints) ? body.mints.map((m) => m.trim()).filter(Boolean) : [];

    if (!roundId) {
      return NextResponse.json({ error: "Missing round_id" }, { status: 400 });
    }

    if (!mints.length) {
      return NextResponse.json({ error: "Provide at least one mint to remove" }, { status: 400 });
    }

    const { data: existing, error: lookupErr } = await supabase
      .from("deployments")
      .select("nft_mint")
      .eq("round_id", roundId)
      .in("nft_mint", mints);

    if (lookupErr) {
      return NextResponse.json({ error: lookupErr.message }, { status: 500 });
    }

    if (!existing?.length) {
      return NextResponse.json({ ok: true, removed: 0, found: [] });
    }

    const mintsToRemove = existing.map((row) => row.nft_mint);

    const { error: deleteErr } = await supabase
      .from("deployments")
      .delete()
      .eq("round_id", roundId)
      .in("nft_mint", mintsToRemove);

    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, removed: mintsToRemove.length, mints: mintsToRemove });
  } catch (error: any) {
    const status = error?.status ?? 500;
    const message = error?.message ?? "Unexpected error";
    return NextResponse.json({ error: message }, { status });
  }
}
