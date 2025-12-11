import { NextResponse } from "next/server";
import { assertSupabaseAdmin } from "@/lib/supabase-admin";
import { requireAdminWallet } from "@/lib/admin-auth";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const adminWallet = searchParams.get("wallet");
    const targetWallet = searchParams.get("target_wallet");
    requireAdminWallet(adminWallet);

    if (!targetWallet) {
      return NextResponse.json({ error: "Missing target_wallet" }, { status: 400 });
    }

    const supabase = assertSupabaseAdmin();
    const { data, error } = await supabase
      .from("profile_badges")
      .select(
        `
          badge_slug,
          earned_at,
          badge:badge_definitions(
            name,
            description,
            requirement,
            image
          )
        `
      )
      .ilike("wallet", targetWallet.trim());

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const badges = (data ?? []).map((row: any) => ({
      slug: row.badge_slug,
      earned_at: row.earned_at,
      name: row.badge?.name ?? row.badge_slug,
      description: row.badge?.description ?? "",
      requirement: row.badge?.requirement ?? "",
      image: row.badge?.image ?? null,
    }));

    return NextResponse.json({ badges });
  } catch (err: any) {
    const status = err?.status ?? 500;
    const message = err?.message ?? "Unexpected error";
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const adminWallet = body?.wallet;
    const targetWallet = body?.target_wallet;
    const badgeSlug = body?.badge_slug;

    requireAdminWallet(adminWallet);

    if (!targetWallet || !badgeSlug) {
      return NextResponse.json({ error: "Missing target_wallet or badge_slug" }, { status: 400 });
    }

    const supabase = assertSupabaseAdmin();
    const { error, count } = await supabase
      .from("profile_badges")
      .delete({ count: "exact" })
      .eq("badge_slug", badgeSlug.trim())
      .ilike("wallet", targetWallet.trim());

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, removed: count ?? 0 });
  } catch (err: any) {
    const status = err?.status ?? 500;
    const message = err?.message ?? "Unexpected error";
    return NextResponse.json({ error: message }, { status });
  }
}
