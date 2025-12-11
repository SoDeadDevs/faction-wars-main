import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { awardBadgeToWallet, factionBadgeSlugFromSlug } from "@/lib/badge-awards";

type Body = { address: string; faction_slug: string };

export async function POST(req: Request) {
  try {
    const body: Body = await req.json();
    const address = body?.address?.trim();
    const faction_slug = body?.faction_slug?.trim();

    if (!address || !faction_slug) {
      return NextResponse.json({ error: "Missing address or faction_slug" }, { status: 400 });
    }

    // Look up faction ID
    const { data: faction, error: fErr } = await supabase
      .from("factions")
      .select("id, slug, name")
      .eq("slug", faction_slug)
      .single();

    if (fErr || !faction) {
      return NextResponse.json({ error: "Faction not found" }, { status: 404 });
    }

    // Check if wallet has already joined recently
    const { data: walletRow } = await supabase
      .from("wallets")
      .select("address, joined_faction_id, joined_at")
      .eq("address", address)
      .maybeSingle();

    if (walletRow?.joined_at) {
      const last = new Date(walletRow.joined_at).getTime();
      const now = Date.now();
      const daysSince = (now - last) / (1000 * 60 * 60 * 24);
      if (daysSince < 30) {
        const remaining = Math.ceil(30 - daysSince);
        return NextResponse.json(
          { error: `Faction change locked. Try again in ~${remaining} day(s).` },
          { status: 403 }
        );
      }
    }

    // Record the join
    const { error: upErr } = await supabase.from("wallets").upsert({
      address,
      joined_faction_id: faction.id,
      joined_at: new Date().toISOString(),
    });

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    const badgeSlug = factionBadgeSlugFromSlug(faction.slug);
    let awardResult: any = null;
    if (badgeSlug) {
      try {
        awardResult = await awardBadgeToWallet(address, badgeSlug, {
          context: { faction: faction.slug },
        });
        console.log("award faction badge result", { wallet: address, badgeSlug, awardResult });
      } catch (badgeError) {
        console.error("Failed to award faction badge", {
          wallet: address,
          badgeSlug,
          error: badgeError instanceof Error ? badgeError.message : badgeError,
        });
        awardResult = { error: badgeError instanceof Error ? badgeError.message : String(badgeError) };
      }
    } else {
      console.warn("No badge mapping found for faction slug", { slug: faction.slug });
    }

    return NextResponse.json({
      ok: true,
      address,
      faction: { id: faction.id, slug: faction.slug, name: faction.name },
      joined_at: new Date().toISOString(),
      badge_award: awardResult,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
