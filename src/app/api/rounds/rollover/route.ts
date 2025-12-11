import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  const secret = process.env.ADMIN_SECRET ?? "";
  const header = req.headers.get("x-admin-secret") ?? "";
  if (!secret || header !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // find current round
  const { data: rounds, error: rErr } = await supabase
    .from("rounds")
    .select("id, week_start, week_end, status")
    .order("week_start", { ascending: true });
  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });

  const today = new Date().toISOString().slice(0,10);
  const current = (rounds ?? []).find(r => today >= r.week_start && today <= r.week_end);
  if (!current) return NextResponse.json({ error: "No current round" }, { status: 400 });

  // 1) lock current
  const { error: lockErr } = await supabase
    .from("rounds")
    .update({ status: "locked" })
    .eq("id", current.id);
  if (lockErr) return NextResponse.json({ error: lockErr.message }, { status: 500 });

  // (Optional) you could compute final winners here and write to a 'zone_results' table

  // 2) mark tallied
  const { error: tallyErr } = await supabase
    .from("rounds")
    .update({ status: "tallied" })
    .eq("id", current.id);
  if (tallyErr) return NextResponse.json({ error: tallyErr.message }, { status: 500 });

  // 3) create next week’s round
  const start = new Date(current.week_end);
  start.setDate(start.getDate() + 1); // next day
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  const { error: insErr } = await supabase.from("rounds").insert({
    week_start: start.toISOString().slice(0,10),
    week_end: end.toISOString().slice(0,10),
    status: "open",
  });
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
