import { NextResponse } from "next/server";
import { requireAdminWallet } from "@/lib/admin-auth";
import { assertSupabaseAdmin } from "@/lib/supabase-admin";

type ZoneWinner = {
  zone_slug: string;
  zone_name: string;
  totals: Record<string, number>;
  winner?: {
    slug: string;
    name: string | null;
    color?: string | null;
  };
};

type RoundResponse = {
  id: string;
  week_start: string;
  week_end: string;
  status: string;
  zones: ZoneWinner[];
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const wallet = (url.searchParams.get("wallet") || "").trim().toLowerCase();
    requireAdminWallet(wallet);

    const limitParam = parseInt(url.searchParams.get("limit") || "5", 10);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 20) : 5;

    const supabase = assertSupabaseAdmin();

    const { data: rounds, error: roundsErr } = await supabase
      .from("rounds")
      .select("id, week_start, week_end, status, updated_at")
      .in("status", ["locked", "tallied"])
      .order("week_end", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (roundsErr) {
      return NextResponse.json({ error: roundsErr.message }, { status: 500 });
    }

    if (!rounds || rounds.length === 0) {
      return NextResponse.json({ rounds: [] });
    }

    const roundIds = rounds.map((r) => r.id);

    const { data: deployments, error: depErr } = await supabase
      .from("deployments")
      .select(
        `
          round_id,
          zone_id,
          faction_slug,
          faction_name,
          faction_color,
          zones:zones!inner(id, slug, name),
          wallets:wallets!inner(
            faction:factions!wallets_joined_faction_id_fkey(
              slug,
              name,
              color
            )
          )
        `
      )
      .in("round_id", roundIds);

    if (depErr) {
      return NextResponse.json({ error: depErr.message }, { status: 500 });
    }

    const grouped = new Map<string, Map<string, ZoneWinner>>();

    (deployments ?? []).forEach((row) => {
      const roundId = row.round_id;
      const zoneId = row.zone_id || row.zones?.id;
      if (!roundId || !zoneId) return;

      if (!grouped.has(roundId)) {
        grouped.set(roundId, new Map());
      }
      const zoneMap = grouped.get(roundId)!;

      if (!zoneMap.has(zoneId)) {
        zoneMap.set(zoneId, {
          zone_slug: row.zones?.slug ?? "unknown",
          zone_name: row.zones?.name ?? "Unknown Zone",
          totals: {},
        });
      }

      const entry = zoneMap.get(zoneId)!;
      const factionSlug = row.wallets?.faction?.slug ?? "unaffiliated";
      entry.totals[factionSlug] = (entry.totals[factionSlug] ?? 0) + 1;
    });

    const response: RoundResponse[] = rounds.map((round) => {
      const zoneMap = grouped.get(round.id) ?? new Map();
      const zones: ZoneWinner[] = [];

      zoneMap.forEach((zone) => {
        const totals = zone.totals;
        const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
        if (entries.length === 1 || (entries[0] && entries[1] && entries[0][1] > entries[1][1])) {
          zone.winner = {
            slug: entries[0][0],
            name: rowFactionName(deployments ?? [], round.id, zone.zone_slug, entries[0][0]),
            color: rowFactionColor(deployments ?? [], round.id, zone.zone_slug, entries[0][0]),
          };
        }
        zones.push(zone);
      });

      return { ...round, zones };
    });

    return NextResponse.json({ rounds: response });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Unexpected error" }, { status: 500 });
  }
}

function rowFactionName(
  rows: any[],
  roundId: string,
  zoneSlug: string,
  factionSlug: string
): string | null {
  const match = rows.find(
    (row) =>
      row.round_id === roundId &&
      (row.zones?.slug ?? "unknown") === zoneSlug &&
      ((row.faction_slug ?? row.wallets?.faction?.slug ?? "unaffiliated") === factionSlug)
  );
  return match?.faction_name ?? match?.wallets?.faction?.name ?? null;
}

function rowFactionColor(
  rows: any[],
  roundId: string,
  zoneSlug: string,
  factionSlug: string
): string | null {
  const match = rows.find(
    (row) =>
      row.round_id === roundId &&
      (row.zones?.slug ?? "unknown") === zoneSlug &&
      ((row.faction_slug ?? row.wallets?.faction?.slug ?? "unaffiliated") === factionSlug)
  );
  return match?.faction_color ?? match?.wallets?.faction?.color ?? null;
}
