import { NextResponse } from "next/server";
import { assertSupabaseAdmin } from "@/lib/supabase-admin";

type ProfileRow = {
  wallet: string;
  username: string | null;
  avatar_url: string | null;
  badges: string[] | null;
  badges_count: number | null;
  created_at?: string;
  updated_at?: string;
};

function normalizeWallet(value: string | null): string | null {
  if (!value) return null;
  return value.trim().toLowerCase();
}

export async function GET(req: Request) {
  try {
    const supabaseAdmin = assertSupabaseAdmin();
    const { searchParams } = new URL(req.url);
    const wallet = normalizeWallet(searchParams.get("wallet"));
    if (!wallet) {
      return NextResponse.json({ error: "Missing wallet" }, { status: 400 });
    }

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("wallet, username, avatar_url, badges, badges_count")
      .eq("wallet", wallet)
      .maybeSingle();

    if (profileErr) {
      return NextResponse.json({ error: profileErr.message }, { status: 500 });
    }

    const { data: walletRow, error: walletErr } = await supabaseAdmin
      .from("wallets")
      .select(
        `
          address,
          joined_faction_id,
          faction:factions!wallets_joined_faction_id_fkey(
            slug,
            name,
            color
          )
        `
      )
      .ilike("address", wallet)
      .maybeSingle<{
        address: string;
        joined_faction_id: string | null;
        faction:
          | {
              slug: string | null;
              name: string | null;
              color: string | null;
            }
          | null
          | { slug: string | null; name: string | null; color: string | null }[];
      }>();

    if (walletErr) {
      return NextResponse.json({ error: walletErr.message }, { status: 500 });
    }

    const faction = walletRow?.faction
      ? Array.isArray(walletRow.faction)
        ? walletRow.faction[0]
          ? {
              slug: walletRow.faction[0]?.slug ?? null,
              name: walletRow.faction[0]?.name ?? null,
              color: walletRow.faction[0]?.color ?? null,
            }
          : null
        : {
            slug: walletRow.faction.slug,
            name: walletRow.faction.name,
            color: walletRow.faction.color,
          }
      : null;

    return NextResponse.json({
      profile: profile ?? null,
      standing: { badges_count: profile?.badges_count ?? 0 },
      faction,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Unexpected error" }, { status: 500 });
  }
}

type UpsertBody = {
  wallet: string;
  username?: string;
  avatar_url?: string;
};

export async function POST(req: Request) {
  try {
    const supabaseAdmin = assertSupabaseAdmin();
    const body: UpsertBody = await req.json();
    const wallet = normalizeWallet(body.wallet);
    if (!wallet) {
      return NextResponse.json({ error: "Missing wallet" }, { status: 400 });
    }

    const updates: Partial<ProfileRow> = {
      wallet,
    };

    if (body.username !== undefined) {
      updates.username = body.username.trim().slice(0, 32) || null;
    }

    if (body.avatar_url !== undefined) {
      updates.avatar_url = body.avatar_url.trim() || null;
    }

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .upsert(updates, { onConflict: "wallet" })
      .select("wallet, username, avatar_url, badges, badges_count")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ profile: data });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Unexpected error" }, { status: 500 });
  }
}
