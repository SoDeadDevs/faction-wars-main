import { NextResponse } from "next/server";
import { assertSupabaseAdmin } from "@/lib/supabase-admin";
import { awardBadgeToWallet, zoneBadgeSlugFromSlug } from "@/lib/badge-awards";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function hasRoundEnded(weekEnd: string | null | undefined): boolean {
  if (!weekEnd) return false;
  const end = new Date(weekEnd);
  if (Number.isNaN(end.getTime())) return false;
  end.setHours(23, 59, 59, 999);
  return Date.now() > end.getTime();
}

type DeploymentRow = {
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

function factionFromRow(
  row: DeploymentRow
): { slug: string | null; name: string | null; color: string | null } | null {
  if (row.faction_slug || row.faction_name || row.faction_color) {
    return { slug: row.faction_slug, name: row.faction_name, color: row.faction_color };
  }
  const wallets = row.wallets;
  if (!wallets) return null;
  const entry = Array.isArray(wallets) ? wallets[0] : wallets;
  return entry?.faction ?? null;
}

export async function GET() {
  const supabaseAdmin = assertSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);

  const { data: openRounds } = await supabaseAdmin
    .from("rounds")
    .select("id, week_start, week_end, status")
    .eq("status", "open");

  const expiredIds =
    openRounds?.filter((r) => hasRoundEnded(r.week_end)).map((r) => r.id) ?? [];
  if (expiredIds.length) {
    await supabaseAdmin.from("rounds").update({ status: "locked" }).in("id", expiredIds);
  }

  const { data: lockedRounds, error: lockedErr } = await supabaseAdmin
    .from("rounds")
    .select("id, week_start, week_end, status, updated_at")
    .in("status", ["locked", "tallied"])
    .order("week_end", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(1);

  if (lockedErr) {
    return NextResponse.json({ error: lockedErr.message }, { status: 500 });
  }

  let targetRound: { id: string; week_start: string; week_end: string; status: string; updated_at: string } | null =
    lockedRounds?.[0] ?? null;

  if (!targetRound) {
    const { data: fallbackOpen } = await supabaseAdmin
      .from("rounds")
      .select("id, week_start, week_end, status, updated_at")
      .eq("status", "open")
      .order("week_start", { ascending: true })
      .order("updated_at", { ascending: false })
      .limit(1);
    targetRound = (fallbackOpen?.[0] as typeof targetRound) ?? targetRound;
  }

  if (!targetRound) {
    return NextResponse.json({ byZone: {}, factionTotals: [], round: null });
  }

  const { data: deployments, error: depErr } = await supabaseAdmin
    .from("deployments")
    .select(
      `
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
    .eq("round_id", targetRound.id)
    .returns<DeploymentRow[]>();

  if (depErr) {
    return NextResponse.json({ error: depErr.message }, { status: 500 });
  }

  const byZone: Record<
    string,
    { zone_slug: string; zone_name: string; totals: Record<string, number>; winner?: string }
  > = {};

  const factionTotals: Record<string, number> = {};
  const factionColors: Record<string, string> = { unaffiliated: "#9ca3af" };

  for (const row of deployments ?? []) {
    const zoneId = row.zone_id || zoneIdFromRow(row);
    const zoneSlug = zoneSlugFromRow(row) ?? "unknown";
    const zoneName = zoneNameFromRow(row) ?? "Unknown Zone";
    if (!zoneId) continue;

    const faction = factionFromRow(row);
    const factionSlug = faction?.slug ?? "unaffiliated";
    const factionColor = faction?.color ?? null;

    if (factionSlug && factionColor && !factionColors[factionSlug]) {
      factionColors[factionSlug] = factionColor;
    }

    if (!byZone[zoneId]) {
      byZone[zoneId] = {
        zone_slug: zoneSlug,
        zone_name: zoneName,
        totals: {},
      };
    }
    byZone[zoneId].totals[factionSlug] = (byZone[zoneId].totals[factionSlug] ?? 0) + 1;
    factionTotals[factionSlug] = (factionTotals[factionSlug] ?? 0) + 1;
  }

  Object.keys(byZone).forEach((zoneId) => {
    const totals = byZone[zoneId].totals;
    const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) return;
    if (entries.length === 1 || entries[0][1] > entries[1][1]) {
      byZone[zoneId].winner = entries[0][0];
    }
  });

  const factionTotalsArr = Object.entries(factionTotals).map(([slug, count]) => ({
    faction_slug: slug,
    nft_count: count,
    color: factionColors[slug] ?? null,
  }));

  // Award zone badges only after a round is locked/tallied
  if (targetRound.status === "locked" || targetRound.status === "tallied") {
    try {
      for (const [zoneId, data] of Object.entries(byZone)) {
        const winner = data.winner;
        const zoneSlug = data.zone_slug;
        if (!winner || !zoneSlug) continue;
        const badgeSlug = zoneBadgeSlugFromSlug(zoneSlug);
        if (!badgeSlug) continue;

        const { data: winningWallets, error: walletsErr } = await supabaseAdmin
          .from("deployments")
          .select("wallet_address")
          .eq("round_id", targetRound.id)
          .eq("zone_id", zoneId)
          .eq("faction_slug", winner)
          .neq("wallet_address", null);

        if (walletsErr) {
          console.error("[zone badge award] wallet lookup failed", { zoneId, zoneSlug, winner, error: walletsErr });
          continue;
        }

        const uniqueWallets = Array.from(
          new Set((winningWallets ?? []).map((w: any) => w.wallet_address).filter(Boolean))
        );

        for (const wallet of uniqueWallets) {
          await awardBadgeToWallet(wallet, badgeSlug, {
            context: { round_id: targetRound.id, zone_slug: zoneSlug, faction: winner },
          });
        }
      }
    } catch (err) {
      console.error("[zone badge award] failed", err);
    }
  }

  return NextResponse.json({
    byZone,
    factionTotals: factionTotalsArr,
    factionColors,
    round: targetRound,
  });
}
