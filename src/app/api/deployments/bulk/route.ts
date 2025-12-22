// POST bulk deployments (one zone per NFT per round)

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { assertSupabaseAdmin } from "@/lib/supabase-admin";
import { awardBadgeToWallet } from "@/lib/badge-awards";

type FactionInfo = { slug: string | null; name: string | null; color: string | null };
type WalletWithFaction = { address: string; faction?: FactionInfo | null };

type Item = { mint: string; zone_slug: string };
type Body = { address: string; round_id: string; items: Item[] };

export async function POST(req: Request) {
  try {
    const { address, round_id, items }: Body = await req.json();

    if (!address || !round_id || !Array.isArray(items)) {
      return NextResponse.json(
        { error: "Missing address, round_id, or items" },
        { status: 400 }
      );
    }

    // 1) Ensure wallet exists (FK + also means they joined a faction)
    const { data: wallet, error: wErr } = await supabase
      .from("wallets")
      .select(
        `
          address,
          faction:factions!wallets_joined_faction_id_fkey(
            slug,
            name,
            color
          )
        `
      )
      .eq("address", address)
      .maybeSingle<WalletWithFaction>();
    if (wErr)
      return NextResponse.json({ error: `[wallet lookup] ${wErr.message}` }, { status: 500 });
    if (!wallet) {
      return NextResponse.json(
        { error: "Wallet not registered. Join a faction first on /factions." },
        { status: 403 }
      );
    }

    // 2) Round must be open (fallback to current open round if the provided ID is missing)
    const today = new Date().toISOString().slice(0, 10);
    let roundLookupErr: any = null;

    const { data: roundById, error: rErr } = await supabase
      .from("rounds")
      .select("id, status, week_start, week_end, created_at, updated_at")
      .eq("id", round_id)
      .maybeSingle();
    let round = roundById ?? null;
    roundLookupErr = rErr ?? null;

    if (!round) {
      const { data: openRounds, error: openErr } = await supabase
        .from("rounds")
        .select("id, status, week_start, week_end, created_at, updated_at")
        .eq("status", "open")
        .lte("week_start", today)
        .gte("week_end", today)
        .order("week_start", { ascending: true })
        .limit(1);
      if (openErr) roundLookupErr = roundLookupErr ?? openErr;
      round = openRounds?.[0] ?? null;
    }

    if (!round) {
      return NextResponse.json({ error: roundLookupErr?.message || "Round not found" }, { status: 404 });
    }

    if (today > round.week_end) {
      await supabase.from("rounds").update({ status: "locked" }).eq("id", round.id);
    }

    if (round.status !== "open" || today > round.week_end) {
      return NextResponse.json(
        { error: "Round not open for deployments" },
        { status: 403 }
      );
    }

    // 3) Map zone slugs -> ids
    const slugs = Array.from(new Set(items.map((i) => i.zone_slug))).filter(Boolean);
    const { data: zones, error: zErr } = await supabase
      .from("zones")
      .select("id, slug")
      .in("slug", slugs);
    if (zErr) return NextResponse.json({ error: `[zones] ${zErr.message}` }, { status: 500 });

    const zoneMap = new Map(zones?.map((z) => [z.slug, z.id]));
    const factionInfo = wallet?.faction ?? null;
    const rows = items
      .filter((i) => i.mint && zoneMap.get(i.zone_slug))
      .map((i) => ({
        round_id,
        nft_mint: i.mint,
        wallet_address: address,
        zone_id: zoneMap.get(i.zone_slug)!,
        created_at: new Date().toISOString(),
        faction_slug: factionInfo?.slug ?? null,
        faction_name: factionInfo?.name ?? null,
        faction_color: factionInfo?.color ?? null,
      }));

    if (!rows.length) {
      return NextResponse.json(
        { error: "No valid items after zone mapping." },
        { status: 400 }
      );
    }

    // 4) Ensure NFT rows exist (prevents FK failures on deployments.nft_mint)
    const mints = Array.from(new Set(rows.map((r) => r.nft_mint)));
    if (mints.length) {
      const { data: haveNfts, error: nErr } = await supabase
        .from("nfts")
        .select("mint")
        .in("mint", mints);
      if (nErr)
        return NextResponse.json({ error: `[nfts lookup] ${nErr.message}` }, { status: 500 });

      const haveSet = new Set((haveNfts ?? []).map((n) => n.mint));
      const toInsert = mints
        .filter((m) => !haveSet.has(m))
        .map((mint) => ({ mint, owner_wallet: address }));
      if (toInsert.length) {
        const { error: insNftErr } = await supabase
          .from("nfts")
          .upsert(toInsert, { onConflict: "mint" });
        if (insNftErr)
          return NextResponse.json({ error: `[nfts upsert] ${insNftErr.message}` }, { status: 500 });
      }
    }

    // 5) Lock-after-first-save:
    //    find already-deployed mints for this wallet+round and don’t change them
    const { data: existing, error: exErr } = await supabase
      .from("deployments")
      .select("nft_mint")
      .eq("wallet_address", address)
      .eq("round_id", round_id);
    if (exErr)
      return NextResponse.json(
        { error: `[existing deployments] ${exErr.message}` },
        { status: 500 }
      );

    const lockedSet = new Set((existing ?? []).map((d) => d.nft_mint));
    const newRows = rows.filter((r) => !lockedSet.has(r.nft_mint));
    const skipped = rows
      .filter((r) => lockedSet.has(r.nft_mint))
      .map((r) => r.nft_mint);

    if (!newRows.length) {
      return NextResponse.json({ ok: true, count: 0, skipped, saved: [] }, { status: 200 });
    }

    // 6) Insert-only semantics: upsert + ignoreDuplicates keeps first choice, ignores later ones
    const { error: upErr } = await supabase
     .from("deployments")
     .upsert(newRows, { onConflict: "round_id,nft_mint", ignoreDuplicates: true });

    if (upErr) {
      return NextResponse.json({ error: `[deployments upsert] ${upErr.message}` }, { status: 500 });
    }
    
    const saved = newRows.map(r => r.nft_mint);

    // Badge awards
    try {
      const supabaseAdmin = assertSupabaseAdmin();

      // First-time deployment badge (Grunt)
      const { count: totalAfter, error: totalErr } = await supabaseAdmin
        .from("deployments")
        .select("id", { count: "exact", head: true })
        .eq("wallet_address", address);
      if (totalErr) {
        console.error("[grunt] count query failed", totalErr);
      } else if (typeof totalAfter === "number" && totalAfter > 0 && totalAfter === saved.length) {
        // If total deployments equal the just-saved ones, this was the first deployment batch.
        await awardBadgeToWallet(address, "grunt", { context: { round_id: round.id, saved } });
      }

      // Novice — deploy to 3 distinct rounds (future badges can add thresholds here)
      const { data: roundRows, error: roundCountErr } = await supabaseAdmin
        .from("deployments")
        .select("round_id")
        .eq("wallet_address", address);
      if (roundCountErr) {
        console.error("[novice] round count failed", roundCountErr);
      } else {
        const distinctRounds = new Set((roundRows ?? []).map((r: any) => r.round_id)).size;
        if (distinctRounds >= 3) {
          await awardBadgeToWallet(address, "novice", {
            context: { total_rounds: distinctRounds },
          });
        }
      }

      // Early Bird — deploy within first hour of round start
      const now = Date.now();
      const startSource =
        round?.updated_at ||
        round?.created_at ||
        (round?.week_start ? `${round.week_start}T00:00:00Z` : null);
      const startMs = startSource ? new Date(startSource).getTime() : NaN;
      if (Number.isFinite(startMs) && now >= startMs && now - startMs <= 60 * 60 * 1000) {
        await awardBadgeToWallet(address, "early-bird", {
          context: { round_id, deployed_at: new Date(now).toISOString() },
        });
      }

      // Borough Sweeper — occupy at least 3 zones in the same round
      const { data: zoneRows, error: zoneErr } = await supabaseAdmin
        .from("deployments")
        .select("zone_id")
        .eq("wallet_address", address)
        .eq("round_id", round_id);

      if (zoneErr) {
        console.error("[borough-sweeper] zone query failed", zoneErr);
      } else {
        const zoneIds = (zoneRows ?? []).map((r: any) => r.zone_id);
        const uniqueZoneIds = Array.from(new Set(zoneIds));
        const uniqueZonesCount = uniqueZoneIds.length;

        if (uniqueZonesCount >= 3) {
          await awardBadgeToWallet(address, "borough-sweeper", {
            context: { round_id, unique_zones: uniqueZonesCount },
          });
        }

        // Full Sweep — deployments in every zone this round
        const { count: totalZones, error: countErr } = await supabaseAdmin
          .from("zones")
          .select("id", { count: "exact", head: true });
        if (countErr) {
          console.error("[full-sweep] total zones count failed", countErr);
        } else if (typeof totalZones === "number" && totalZones > 0 && uniqueZoneIds.length === totalZones) {
          await awardBadgeToWallet(address, "full-sweep", {
            context: { round_id, unique_zones: uniqueZoneIds.length },
          });
        }
      }
    } catch (badgeError) {
      console.error("[badge-awards] deployment handler failed", badgeError);
    }

    return NextResponse.json({ ok: true, count: newRows.length, skipped, saved }, { status: 200 });

  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
