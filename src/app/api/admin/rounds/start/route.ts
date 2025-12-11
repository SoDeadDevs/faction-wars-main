import { NextResponse } from "next/server";
import { assertSupabaseAdmin } from "@/lib/supabase-admin";
import { requireAdminWallet } from "@/lib/admin-auth";

type Body = {
  wallet: string;
  week_start: string;
  week_end: string;
};

export async function POST(req: Request) {
  try {
    const body: Body = await req.json();
    requireAdminWallet(body.wallet);
    const supabase = assertSupabaseAdmin();

    const weekStart = body.week_start?.trim();
    const weekEnd = body.week_end?.trim();

    if (!weekStart || !weekEnd) {
      return NextResponse.json({ error: "Missing week_start or week_end" }, { status: 400 });
    }

    if (weekStart > weekEnd) {
      return NextResponse.json({ error: "week_start must be <= week_end" }, { status: 400 });
    }

    const { data: openRounds, error: existingErr } = await supabase
      .from("rounds")
      .select("id, status")
      .eq("status", "open");

    if (existingErr) {
      return NextResponse.json({ error: existingErr.message }, { status: 500 });
    }

    if ((openRounds ?? []).length > 1) {
      return NextResponse.json(
        { error: "Multiple open rounds detected. Resolve manually before starting a new round." },
        { status: 409 }
      );
    }

    if ((openRounds ?? []).length === 1) {
      return NextResponse.json(
        { error: "A round is already open. End the current round before starting a new one." },
        { status: 409 }
      );
    }

    const { data: inserted, error: insertErr } = await supabase
      .from("rounds")
      .insert({
        week_start: weekStart,
        week_end: weekEnd,
        status: "open",
      })
      .select("id, week_start, week_end, status")
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, round: inserted });
  } catch (error: any) {
    const status = error?.status ?? 500;
    const message = error?.message ?? "Unexpected error";
    return NextResponse.json({ error: message }, { status });
  }
}
