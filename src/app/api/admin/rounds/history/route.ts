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

type DeploymentRow = {
  round_id: string;
  zone_id: string | null;
  faction_slug: string | null;
  faction_name: string | null;
  faction_color: string | null;
  zones: { id: string; slug: string; name: string } | { id: string; slug: string; name: string }[] | null;
  wallets:
    | { faction: { slug: string | null; name: string | null; color: string | null } | null }
    | { faction: { slug: string | null; name: string | null; color: string | null } | null }[]
    | null;
};

function zoneSlugFromRow(row: DeploymentRow): string | null {
  if (!row.zones) return null;
  if (Array.isArray(row.zones)) return row.zones[0]?.slug ?? null;
  return row.zones.slug ?? null;
}

function zoneNameFromRow(row: DeploymentRow): string | null {
  if (!row.zones) return null;
  if (Array.isArray(row.zones)) return row.zones[0]?.name ?? null;
  return row.zones.name ?? null;
}

function zoneIdFromRow(row: DeploymentRow): string | null {
  if (!row.zones) return null;
  if (Array.isArray(row.zones)) return row.zones[0]?.id ?? null;
  return row.zones.id ?? null;
}

function factionFromRow(row: DeploymentRow): { slug: string | null; name: string | null; color: string | null } | null {
  const faction =
    row.faction_slug || row.faction_name || row.faction_color
      ? { slug: row.faction_slug, name: row.faction_name, color: row.faction_color }
      : null;
  if (faction?.slug || faction?.name || faction?.color) return faction;
  const wallets = row.wallets;
  if (!wallets) return null;
  const entry = Array.isArray(wallets) ? wallets[0] : wallets;
  return entry?.faction ?? null;
}

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
      .in("round_id", roundIds)
      .returns<DeploymentRow[]>();

    if (depErr) {
      return NextResponse.json({ error: depErr.message }, { status: 500 });
    }

    const deploymentRows: DeploymentRow[] = deployments ?? [];

    const grouped = new Map<string, Map<string, ZoneWinner>>();

    deploymentRows.forEach((row) => {
      const roundId = row.round_id;
      const zoneId = row.zone_id ?? zoneIdFromRow(row);
      if (!roundId || !zoneId) return;

      if (!grouped.has(roundId)) {
        grouped.set(roundId, new Map());
      }
      const zoneMap = grouped.get(roundId)!;

      if (!zoneMap.has(zoneId)) {
        zoneMap.set(zoneId, {
          zone_slug: zoneSlugFromRow(row) ?? "unknown",
          zone_name: zoneNameFromRow(row) ?? "Unknown Zone",
          totals: {},
        });
      }

      const entry = zoneMap.get(zoneId)!;
      const faction = factionFromRow(row);
      const factionSlug = faction?.slug ?? "unaffiliated";
      entry.totals[factionSlug] = (entry.totals[factionSlug] ?? 0) + 1;
    });

    const response: RoundResponse[] = rounds.map((round) => {
      const zoneMap = grouped.get(round.id) ?? new Map();
      const zones: ZoneWinner[] = [];

      zoneMap.forEach((zone: ZoneWinner) => {
        const totals = zone.totals;
        const entries = (Object.entries(totals) as [string, number][]).sort((a, b) => b[1] - a[1]);
        if (entries.length === 1 || (entries[0] && entries[1] && entries[0][1] > entries[1][1])) {
          zone.winner = {
            slug: entries[0][0],
            name: rowFactionName(deploymentRows, round.id, zone.zone_slug, entries[0][0]),
            color: rowFactionColor(deploymentRows, round.id, zone.zone_slug, entries[0][0]),
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
  rows: DeploymentRow[],
  roundId: string,
  zoneSlug: string,
  factionSlug: string
): string | null {
  const match = rows.find(
    (row) =>
      row.round_id === roundId &&
      (zoneSlugFromRow(row) ?? "unknown") === zoneSlug &&
      ((row.faction_slug ?? factionFromRow(row)?.slug ?? "unaffiliated") === factionSlug)
  );
  const faction = factionFromRow(match as DeploymentRow);
  return match?.faction_name ?? faction?.name ?? null;
}

function rowFactionColor(
  rows: DeploymentRow[],
  roundId: string,
  zoneSlug: string,
  factionSlug: string
): string | null {
  const match = rows.find(
    (row) =>
      row.round_id === roundId &&
      (zoneSlugFromRow(row) ?? "unknown") === zoneSlug &&
      ((row.faction_slug ?? factionFromRow(row)?.slug ?? "unaffiliated") === factionSlug)
  );
  const faction = factionFromRow(match as DeploymentRow);
  return match?.faction_color ?? faction?.color ?? null;
}
