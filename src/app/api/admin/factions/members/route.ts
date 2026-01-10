import { NextResponse } from "next/server";
import { assertSupabaseAdmin } from "@/lib/supabase-admin";
import { requireAdminWallet } from "@/lib/admin-auth";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const adminWallet = (searchParams.get("wallet") || "").trim().toLowerCase();
    requireAdminWallet(adminWallet);

    const supabase = assertSupabaseAdmin();
    const { data: walletRows, error: walletErr } = await supabase
      .from("wallets")
      .select(
        `
          address,
          faction:factions!wallets_joined_faction_id_fkey(slug, name, color)
        `
      );

    if (walletErr) {
      return NextResponse.json({ error: walletErr.message }, { status: 500 });
    }

    const addresses = (walletRows ?? []).map((w) => w.address?.toLowerCase()).filter(Boolean);
    const usernameMap = new Map<string, string | null>();

    if (addresses.length) {
      const { data: profiles, error: profileErr } = await supabase
        .from("profiles")
        .select("wallet, username")
        .in("wallet", addresses);

      if (profileErr) {
        return NextResponse.json({ error: profileErr.message }, { status: 500 });
      }

      (profiles ?? []).forEach((p: any) => {
        const key = (p.wallet || "").toLowerCase();
        if (key) usernameMap.set(key, p.username ?? null);
      });
    }

    const members: Record<
      string,
      { faction: { slug: string; name: string; color: string | null }; users: { label: string; address: string }[] }
    > = {};

    (walletRows ?? []).forEach((row: any) => {
      const f = row.faction;
      if (!f?.slug || !f.name) return;
      if (!members[f.slug]) {
        members[f.slug] = { faction: { slug: f.slug, name: f.name, color: f.color }, users: [] };
      }
      const address = row.address;
      const label = usernameMap.get(address?.toLowerCase()) || address;
      members[f.slug].users.push({ label, address });
    });

    return NextResponse.json({ members });
  } catch (err: any) {
    const status = err?.status ?? 500;
    const message = err?.message ?? "Unexpected error";
    return NextResponse.json({ error: message }, { status });
  }
}
