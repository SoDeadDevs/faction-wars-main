import { NextResponse } from "next/server";
import { assertSupabaseAdmin } from "@/lib/supabase-admin";
import { requireAdminWallet } from "@/lib/admin-auth";

type Body = {
  wallet: string;
  target_wallet?: string;
};

export async function POST(req: Request) {
  try {
    const body: Body = await req.json();
    requireAdminWallet(body.wallet);

    const targetWallet = (body.target_wallet || "").trim();
    if (!targetWallet) {
      return NextResponse.json({ error: "Missing target_wallet" }, { status: 400 });
    }

    const supabase = assertSupabaseAdmin();

    const { data: existing, error: lookupErr } = await supabase
      .from("wallets")
      .select("address, joined_faction_id")
      .ilike("address", targetWallet)
      .maybeSingle();

    if (lookupErr) {
      return NextResponse.json({ error: lookupErr.message }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
    }

    if (!existing.joined_faction_id) {
      return NextResponse.json({
        ok: true,
        address: existing.address,
        cleared: false,
        message: "Wallet is not currently in a faction.",
      });
    }

    const { error: updateErr } = await supabase
      .from("wallets")
      .update({ joined_faction_id: null, joined_at: null })
      .eq("address", existing.address);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, address: existing.address, cleared: true });
  } catch (error: any) {
    const status = error?.status ?? 500;
    const message = error?.message ?? "Unexpected error";
    return NextResponse.json({ error: message }, { status });
  }
}

