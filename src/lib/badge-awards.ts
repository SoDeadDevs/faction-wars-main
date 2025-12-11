import { assertSupabaseAdmin } from "@/lib/supabase-admin";

export function normalizeWallet(value: string | null | undefined) {
  if (!value) return null;
  return value.trim().toLowerCase();
}

export function factionBadgeSlugFromSlug(slug: string | null | undefined): string | undefined {
  if (!slug) return undefined;
  const normalized = slug.trim().toLowerCase();
  if (normalized.includes("bat")) return "bat-faction";
  if (normalized.includes("lycan")) return "lycan-faction";
  if (normalized.includes("gangrel")) return "gangrel-faction";
  return undefined;
}

export function factionVictoryBadgeSlugFromSlug(slug: string | null | undefined): string | undefined {
  if (!slug) return undefined;
  const normalized = slug.trim().toLowerCase();
  if (normalized.includes("bat")) return "bat-victory";
  if (normalized.includes("lycan")) return "lycan-victory";
  if (normalized.includes("gangrel")) return "gangrel-victory";
  return undefined;
}

export function zoneBadgeSlugFromSlug(zoneSlug: string | null | undefined): string | undefined {
  if (!zoneSlug) return undefined;
  const normalized = zoneSlug.trim().toLowerCase();
  // Badge slugs are prefixed with zone- to avoid collisions
  return `zone-${normalized}`;
}

type AwardBadgeOptions = {
  context?: Record<string, any> | null;
};

export async function awardBadgeToWallet(wallet: string, badgeSlug: string, options?: AwardBadgeOptions) {
  const normalizedWallet = normalizeWallet(wallet);
  if (!normalizedWallet) {
    throw new Error("Cannot award badge without a wallet address.");
  }

  const supabaseAdmin = assertSupabaseAdmin();

  // Make sure the profile row exists so the trigger can update its cache.
  const { error: profileErr } = await supabaseAdmin
    .from("profiles")
    .upsert({ wallet: normalizedWallet }, { onConflict: "wallet" });

  if (profileErr) {
    console.error("badge award profile upsert failed", {
      wallet: normalizedWallet,
      badgeSlug,
      code: profileErr.code,
      message: profileErr.message,
    });
    throw new Error(profileErr.message);
  }

  const payload = {
    wallet: normalizedWallet,
    badge_slug: badgeSlug,
    context: options?.context ?? null,
  };

  const { error } = await supabaseAdmin.from("profile_badges").insert(payload);

  if (error) {
    if (error.code === "23505") {
      return { awarded: false, reason: "already-earned" as const };
    }
    console.error("badge award insert failed", {
      wallet: normalizedWallet,
      badgeSlug,
      code: error.code,
      message: error.message,
    });
    throw new Error(error.message);
  }

  console.log("badge award insert succeeded", { wallet: normalizedWallet, badgeSlug });
  return { awarded: true as const };
}
