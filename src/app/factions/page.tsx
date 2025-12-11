"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

type Faction = { id: string; slug: string; name: string; color: string; emblem_url?: string };
type Membership = {
  faction: Faction | null;
  joined_at: string | null;
  unlock_at: string | null;
};

export default function FactionsPage() {
  const { publicKey, connected } = useWallet();
  const address = useMemo(() => publicKey?.toBase58() ?? "", [publicKey]);

  const [factions, setFactions] = useState<Faction[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [membership, setMembership] = useState<Membership | null>(null);
  const [loadingMembership, setLoadingMembership] = useState(false);

  useEffect(() => {
    (async () => {
      setStatus("Loading factions…");
      try {
        const res = await fetch("/api/factions", { cache: "no-store" });
        const json = await res.json();
        setFactions(json.factions ?? []);
        setStatus("");
      } catch {
        setStatus("Failed to load factions.");
      }
    })();
  }, []);

  const refreshMembership = useCallback(async () => {
    if (!address) {
      setMembership(null);
      return;
    }
    setLoadingMembership(true);
    try {
      const res = await fetch(`/api/factions/membership?address=${address}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load membership.");
      setMembership(json.membership ?? null);
      if (json.membership?.faction?.slug) {
        setSelected((prev) => prev || json.membership.faction.slug);
      }
    } catch (error: any) {
      setStatus(error?.message || "Unable to load membership details.");
    } finally {
      setLoadingMembership(false);
    }
  }, [address]);

  useEffect(() => {
    void refreshMembership();
  }, [refreshMembership]);

  const unlockDate = membership?.unlock_at ? new Date(membership.unlock_at) : null;
  const isLocked = Boolean(unlockDate && unlockDate.getTime() > Date.now());

  function formatDate(value: Date | null): string | null {
    if (!value || Number.isNaN(value.getTime())) return null;
    return value.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  async function joinFaction() {
    if (!connected || !address) {
      setStatus("Please connect your wallet first.");
      return;
    }
    if (isLocked) {
      setStatus(
        `Faction change locked until ${formatDate(unlockDate) || "your unlock time"}`
      );
      return;
    }
    if (!selected) {
      setStatus("Pick a faction to join.");
      return;
    }
    setStatus("Joining…");
    try {
      const res = await fetch("/api/factions/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, faction_slug: selected }), // gangrel | bat | lycan
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(json.error || "Failed to join.");
      } else {
        setStatus(`Joined ${json.faction?.name ?? selected}. Locked for 30 days.`);
        await refreshMembership();
      }
    } catch {
      setStatus("Network error while joining.");
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Choose Your Faction</h1>

      {!connected ? (
        <p className="text-neutral-400">Connect your wallet to continue.</p>
      ) : (
        <div className="space-y-1">
          <p className="text-neutral-400">
            Wallet: {address.slice(0, 4)}…{address.slice(-4)}
          </p>
          {loadingMembership ? (
            <p className="text-sm text-neutral-500">Checking faction membership…</p>
          ) : membership?.faction ? (
            <p className="text-sm text-neutral-300">
              Current faction:{" "}
              <span style={{ color: membership.faction.color }}>{membership.faction.name}</span>
            </p>
          ) : (
            <p className="text-sm text-neutral-500">You haven’t joined a faction yet.</p>
          )}
        </div>
      )}

      {status && <p className="text-sm text-neutral-400">{status}</p>}

      <div className="grid gap-4 sm:grid-cols-3">
        {factions.map((f) => (
          <button
            key={f.slug}
            onClick={() => setSelected(f.slug)}
            className={`rounded-2xl border p-4 text-left hover:bg-neutral-900 ${
              selected === f.slug ? "ring-2 ring-offset-1 ring-offset-neutral-950" : ""
            }`}
            style={{ borderColor: f.color }}
          >
            <div className="text-lg font-medium" style={{ color: f.color }}>
              {f.name}
            </div>
            <div className="text-sm text-neutral-400">Monthly lock after joining.</div>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={joinFaction}
          className="rounded-xl bg-neutral-100 px-4 py-2 font-medium text-neutral-900 transition-colors hover:bg-[#7f1d1d] hover:text-white disabled:opacity-50 disabled:hover:bg-neutral-100 disabled:hover:text-neutral-900"
          disabled={!connected || isLocked || !selected}
        >
          Join Selected
        </button>
        {isLocked && (
          <span className="text-xs text-neutral-400">
            Unlocks {formatDate(unlockDate)}.
          </span>
        )}
      </div>
    </div>
  );
}
