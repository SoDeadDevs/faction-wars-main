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

    const roundId = body.round_id?.trim() || null;

    let targetId = roundId;
    if (!targetId) {
      const { data: openRounds, error: currentErr } = await supabase
        .from("rounds")
        .select("id, status")
        .eq("status", "open");

      if (currentErr) {
        console.error("[admin rounds/end] open round query error", currentErr);
        return NextResponse.json({ error: currentErr.message }, { status: 500 });
      }

      if ((openRounds ?? []).length > 1) {
        return NextResponse.json(
          { error: "Multiple open rounds detected. Please specify a round_id." },
          { status: 409 }
        );
      }

      const current = openRounds?.[0];
      if (!current) {
        return NextResponse.json({ error: "No open round to end" }, { status: 404 });
      }
      targetId = current.id;
    }

    const { data: updated, error: updateErr } = await supabase
      .from("rounds")
      .update({ status: "locked" })
      .eq("id", targetId)
      .select("id, status")
      .maybeSingle();

    if (updateErr) {
      console.error("[admin rounds/end] update error", updateErr);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    if (!updated) {
      return NextResponse.json({ error: "Round not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, round: updated });
  } catch (error: any) {
    const status = error?.status ?? 500;
    const message = error?.message ?? "Unexpected error";
    return NextResponse.json({ error: message }, { status });
  }
}
