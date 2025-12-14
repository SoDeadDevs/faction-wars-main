import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const LOCK_DAYS = 30;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = (searchParams.get("address") || "").trim();
  if (!address) {
    return NextResponse.json({ error: "Missing address" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("wallets")
    .select(
      `
        address,
        joined_at,
        faction:factions!wallets_joined_faction_id_fkey(
          slug,
          name,
          color
        )
      `
    )
    .ilike("address", address)
    .maybeSingle<{
      address: string;
      joined_at: string | null;
      faction:
        | {
            slug: string | null;
            name: string | null;
            color: string | null;
          }
        | null
        | { slug: string | null; name: string | null; color: string | null }[];
    }>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ membership: null });
  }

  const joinedAt = data.joined_at ? new Date(data.joined_at) : null;
  let unlockAt: string | null = null;
  if (joinedAt) {
    const lockEnd = new Date(joinedAt);
    lockEnd.setDate(lockEnd.getDate() + LOCK_DAYS);
    unlockAt = lockEnd.toISOString();
  }

  return NextResponse.json({
    membership: {
      faction: data.faction
        ? Array.isArray(data.faction)
          ? data.faction[0]
            ? {
                slug: data.faction[0]?.slug ?? null,
                name: data.faction[0]?.name ?? null,
                color: data.faction[0]?.color ?? null,
              }
            : null
          : {
              slug: data.faction.slug,
              name: data.faction.name,
              color: data.faction.color,
            }
        : null,
      joined_at: data.joined_at,
      unlock_at: unlockAt,
    },
  });
}
