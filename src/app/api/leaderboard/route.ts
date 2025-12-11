import { NextResponse } from "next/server";
import { assertSupabaseAdmin } from "@/lib/supabase-admin";

type FactionInfo = {
  slug: string;
  name: string;
  color: string;
};

type LeaderboardEntry = {
  wallet: string;
  username: string | null;
  avatar_url: string | null;
  badges_count: number | null;
  faction?: FactionInfo | null;
};

export async function GET() {
  try {
    const supabaseAdmin = assertSupabaseAdmin();

    const { data: profiles, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("wallet, username, avatar_url, badges_count")
      .order("badges_count", { ascending: false, nullsFirst: false })
      .limit(100);

    if (profileErr) {
      return NextResponse.json({ error: profileErr.message }, { status: 500 });
    }

    const wallets = (profiles ?? []).map((p) => (p.wallet || "").trim()).filter(Boolean);
    const factionsMap = new Map<string, FactionInfo | null>();

    if (wallets.length) {
      const orFilter = wallets.map((addr) => `address.ilike.${addr}`).join(",");

      let walletQuery = supabaseAdmin
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
        );

      if (orFilter) {
        walletQuery = walletQuery.or(orFilter);
      }

      const { data: walletRows, error: walletErr } = await walletQuery;

      if (walletErr) {
        return NextResponse.json({ error: walletErr.message }, { status: 500 });
      }

      (walletRows ?? []).forEach((row: any) => {
        const key = (row.address || "").toLowerCase();
        if (!key) return;
        factionsMap.set(
          key,
          row.faction
            ? {
                slug: row.faction.slug,
                name: row.faction.name,
                color: row.faction.color,
              }
            : null
        );
      });
    }

    const entries: LeaderboardEntry[] = (profiles ?? []).map((profile) => {
      const faction = factionsMap.get((profile.wallet || "").toLowerCase()) ?? null;
      return {
        wallet: profile.wallet,
        username: profile.username,
        avatar_url: profile.avatar_url,
        badges_count: profile.badges_count ?? 0,
        faction,
      };
    });

    return NextResponse.json({ entries });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Unexpected error" }, { status: 500 });
  }
}
