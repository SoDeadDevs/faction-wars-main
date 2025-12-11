import { NextResponse } from "next/server";
import { assertSupabaseAdmin } from "@/lib/supabase-admin";
import { requireAdminWallet } from "@/lib/admin-auth";

type Body = {
  wallet: string;
  round_id?: string;
};

export async function POST(req: Request) {
  try {
    const body: Body = await req.json();
    requireAdminWallet(body.wallet);
    const supabase = assertSupabaseAdmin();

    let roundId = body.round_id?.trim() || null;

    if (!roundId) {
      const { data: current, error: currentErr } = await supabase
        .from("rounds")
        .select("id, status")
        .eq("status", "open")
        .maybeSingle();

      if (currentErr) {
        return NextResponse.json({ error: currentErr.message }, { status: 500 });
      }

      if (!current) {
        return NextResponse.json({ error: "No open round found" }, { status: 404 });
      }

      roundId = current.id;
    }

    const { data: deleted, error: deleteErr } = await supabase
      .from("deployments")
      .delete()
      .eq("round_id", roundId)
      .select("nft_mint");

    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      round_id: roundId,
      removed: deleted?.length ?? 0,
    });
  } catch (error: any) {
    const status = error?.status ?? 500;
    const message = error?.message ?? "Unexpected error";
    return NextResponse.json({ error: message }, { status });
  }
}
