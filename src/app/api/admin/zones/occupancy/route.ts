import { NextResponse } from "next/server";
import { assertSupabaseAdmin } from "@/lib/supabase-admin";
import { requireAdminWallet } from "@/lib/admin-auth";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get("wallet");
    requireAdminWallet(wallet);
    const supabase = assertSupabaseAdmin();

    const roundIdParam = searchParams.get("round_id")?.trim() || null;

    let roundId = roundIdParam;
    if (!roundId) {
      const { data: current, error: currentErr } = await supabase
        .from("rounds")
        .select("id, week_start, week_end, status")
        .eq("status", "open")
        .maybeSingle();

      if (currentErr) {
        return NextResponse.json({ error: currentErr.message }, { status: 500 });
      }

      if (!current) {
        return NextResponse.json({ round: null, occupancy: [] });
      }

      roundId = current.id;
    }

    const { data: deployments, error: depErr } = await supabase
      .from("deployments")
      .select("zone_id, zones!inner(id, name, slug)")
      .eq("round_id", roundId);

    if (depErr) {
      return NextResponse.json({ error: depErr.message }, { status: 500 });
    }

    const counts = new Map<
      string,
      { zone_id: string; zone_slug: string; zone_name: string; count: number }
    >();

    (deployments ?? []).forEach((row: any) => {
      const zone = row.zones;
      if (!zone?.id) return;
      const key = zone.id;
      if (!counts.has(key)) {
        counts.set(key, { zone_id: key, zone_slug: zone.slug, zone_name: zone.name, count: 0 });
      }
      const entry = counts.get(key)!;
      entry.count += 1;
    });

    const { data: zones, error: zoneErr } = await supabase
      .from("zones")
      .select("id, name, slug")
      .order("display_order", { ascending: true });

    if (zoneErr) {
      return NextResponse.json({ error: zoneErr.message }, { status: 500 });
    }

    const occupancy =
      zones?.map((zone: any) => {
        const existing = counts.get(zone.id);
        return {
          zone_id: zone.id,
          zone_slug: zone.slug,
          zone_name: zone.name,
          count: existing?.count ?? 0,
        };
      }) ?? [];

    return NextResponse.json({ round_id: roundId, occupancy });
  } catch (error: any) {
    const status = error?.status ?? 500;
    const message = error?.message ?? "Unexpected error";
    return NextResponse.json({ error: message }, { status });
  }
}
