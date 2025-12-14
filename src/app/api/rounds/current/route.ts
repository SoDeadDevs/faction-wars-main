// GET current round (+ zones)

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  // find a round where today is between start and end; pick the first 'open' by preference
  const { data: rounds, error: rErr } = await supabase
    .from("rounds")
    .select("id, week_start, week_end, status, created_at, updated_at")
    .order("week_start", { ascending: true });

  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });

  const today = new Date().toISOString().slice(0, 10);
  const expiredIds =
    rounds
      ?.filter((r) => r.status === "open" && today > r.week_end)
      .map((r) => r.id) ?? [];

  if (expiredIds.length) {
    const { error: lockErr } = await supabase
      .from("rounds")
      .update({ status: "locked" })
      .in("id", expiredIds);

    if (lockErr) {
      return NextResponse.json({ error: lockErr.message }, { status: 500 });
    }
  }

  const current =
    (rounds ?? []).find(
      (r) => r.status === "open" && today >= r.week_start && today <= r.week_end
    ) ?? null;

  const fallbackOpen = current
    ? null
    : (rounds ?? []).find((r) => r.status === "open") ?? null;

  const fallbackLocked = current || fallbackOpen
    ? null
    : (rounds ?? []).find((r) => ["locked", "tallied"].includes(r.status)) ?? null;

  const target = current ?? fallbackOpen ?? fallbackLocked ?? null;

  if (!target) return NextResponse.json({ round: null, zones: [] });

  const { data: zones, error: zErr } = await supabase
    .from("zones")
    .select("id, slug, name, display_order")
    .order("display_order", { ascending: true });

  if (zErr) return NextResponse.json({ error: zErr.message }, { status: 500 });

  return NextResponse.json({ round: target, zones });
}
