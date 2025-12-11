"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { BADGES } from "@/lib/badges";

type FactionInfo = {
  slug: string;
  name: string;
  color: string;
};

type Profile = {
  wallet: string;
  username: string | null;
  avatar_url: string | null;
  badges?: string[] | null;
  badges_count?: number | null;
  faction?: FactionInfo | null;
};

type Standing = {
  rank?: number | null;
  badges_count: number;
};

export default function ProfileCard() {
  const { connected, publicKey } = useWallet();
  const wallet = useMemo(() => publicKey?.toBase58() ?? "", [publicKey]);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [standing, setStanding] = useState<Standing | null>(null);
  const [faction, setFaction] = useState<FactionInfo | null>(null);
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const badgeMap = useMemo(() => {
    const map = new Map<string, (typeof BADGES)[number]>();
    BADGES.forEach((b) => map.set(b.slug, b));
    return map;
  }, []);

  useEffect(() => {
    if (!connected || !wallet) {
      setProfile(null);
      setStanding(null);
      return;
    }

    (async () => {
      try {
        const res = await fetch(`/api/profiles?wallet=${wallet}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load profile");
        setProfile(json.profile);
        setStanding(json.standing ?? null);
        setUsername(json.profile?.username ?? "");
        setStatus("");
        setFaction(json.faction ?? null);
      } catch (error: any) {
        setStatus(error?.message || "Unable to load profile.");
      }
    })();
  }, [connected, wallet]);

  async function saveProfile() {
    if (!wallet) return;
    setSaving(true);
    setStatus("Saving profile…");
    try {
      const res = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, username }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save profile");
      setProfile(json.profile);
      setStatus("Profile saved.");
    } catch (error: any) {
      setStatus(error?.message || "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }

  const earnedBadges = (profile?.badges ?? []).filter(Boolean) as string[];
  const earnedBadgeDetails = earnedBadges
    .map((slug) => badgeMap.get(slug) ?? { slug, name: slug, description: "", requirement: "" })
    .filter(Boolean);

  function handleAvatarClick() {
    fileInputRef.current?.click();
  }

  async function onAvatarSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !wallet) return;
    setUploadingAvatar(true);
    setStatus("Uploading avatar…");
    try {
      const formData = new FormData();
      formData.append("wallet", wallet);
      formData.append("file", file);
      const res = await fetch("/api/profiles/avatar", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to upload avatar");
      setProfile(json.profile);
      setStatus("Avatar updated.");
    } catch (error: any) {
      setStatus(error?.message || "Failed to upload avatar.");
    } finally {
      setUploadingAvatar(false);
      event.target.value = "";
    }
  }

  return (
    <section
      className="rounded-2xl border border-neutral-800 p-6 space-y-4 transition"
      style={{
        background: faction?.color ? `${faction.color}22` : undefined,
        borderColor: faction?.color || undefined,
      }}
    >
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold">Your Profile</h2>
          <p className="text-sm text-neutral-400">Customize your avatar and username.</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {faction && (
            <div
              className="rounded-xl px-4 py-1 text-xs font-semibold uppercase tracking-wide shadow-lg"
              style={{
                background: "#1f2937",
                color: "#e5e7eb",
                border: `1px solid ${faction.color}`,
                boxShadow: `0 0 12px ${faction.color}55`,
              }}
            >
              {faction.name}
            </div>
          )}
          {standing?.rank ? (
            <div className="text-sm text-neutral-300">
              Rank #{standing.rank} • {standing.badges_count} badge
              {standing.badges_count === 1 ? "" : "s"}
            </div>
          ) : null}
        </div>
      </div>

      {!connected ? (
        <p className="text-neutral-400 text-sm">Connect your wallet to view your profile.</p>
      ) : (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={handleAvatarClick}
              className="group relative h-20 w-20 overflow-hidden rounded-full border border-neutral-700 bg-neutral-900 text-sm text-neutral-400"
              disabled={uploadingAvatar}
            >
              {profile?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatar_url}
                  alt="Avatar"
                  className="h-full w-full object-cover transition group-hover:scale-105"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center px-4 text-center">
                  Upload
                </span>
              )}
              <div className="absolute inset-0 hidden items-center justify-center bg-black/50 text-xs uppercase tracking-wide text-white group-hover:flex">
                Change
              </div>
            </button>
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              className="hidden"
              onChange={onAvatarSelected}
            />
            <label className="block text-sm text-neutral-300 w-full sm:max-w-xs">
              Username (15 chars max)
              <input
                type="text"
                maxLength={15}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-neutral-100"
              />
            </label>
          </div>

          <button
            onClick={saveProfile}
            className="rounded-lg bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-900 transition hover:bg-[#7f1d1d] hover:text-white disabled:opacity-50"
            disabled={saving}
          >
            {saving ? "Saving…" : "Save Profile"}
          </button>

          {status && <p className="text-sm text-neutral-400">{status}</p>}

          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Badges</h3>
            {!earnedBadgeDetails.length ? (
              <p className="text-sm text-neutral-400">No badges earned yet.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {earnedBadgeDetails.map((badge) => (
                  <div
                    key={badge.slug}
                    className="flex items-start gap-3 rounded-xl border border-[#b91c1c] bg-[#7f1d1d]/30 px-4 py-3"
                  >
                    <div className="flex-shrink-0 overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950">
                      <Image
                        src={badge.image ?? "/globe.svg"}
                        alt={`${badge.name} badge`}
                        width={48}
                        height={48}
                        className="h-12 w-12 object-contain"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="font-medium text-neutral-100">{badge.name}</div>
                      {badge.description ? (
                        <p className="text-sm text-neutral-300">{badge.description}</p>
                      ) : null}
                      {badge.requirement ? (
                        <p className="text-xs uppercase tracking-wide text-rose-200">
                          {badge.requirement}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </>
      )}
    </section>
  );
}
