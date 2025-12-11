// Deployments UI (pick one zone per NFT)

"use client";

import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

type Zone = { id: string; slug: string; name: string; display_order: number };
type Round = { id: string; week_start: string; week_end: string; status: "open" | "locked" | "tallied" };
type Nft = { mint: string; name: string; image?: string };

export default function DeployPage() {
  const { publicKey, connected } = useWallet();
  const address = useMemo(() => publicKey?.toBase58() ?? "", [publicKey]);

  const [zones, setZones] = useState<Zone[]>([]);
  const [round, setRound] = useState<Round | null>(null);
  const [nfts, setNfts] = useState<Nft[]>([]);
  const [choices, setChoices] = useState<Record<string, string>>({}); // mint -> zone_slug (UI selection + prefill)
  const [locked, setLocked] = useState<Set<string>>(new Set());        // mints already deployed this round
  const [status, setStatus] = useState("");

  // Load current round + zones
  useEffect(() => {
    (async () => {
      const res = await fetch("/api/rounds/current", { cache: "no-store" });
      const json = await res.json();
      setRound(json.round ?? null);
      setZones(json.zones ?? []);
    })();
  }, []);

  // Load wallet NFTs (filtered to your collection)
  useEffect(() => {
    if (!connected || !address) return;
    (async () => {
      setStatus("Loading your NFTs…");
      try {
        const res = await fetch(`/api/nfts?owner=${address}`, { cache: "no-store" });
        const json = await res.json();
        setNfts(json.nfts ?? []);
        setStatus("");
      } catch {
        setStatus("Failed to load NFTs.");
      }
    })();
  }, [connected, address]);

  // Prefill & lock from existing deployments
  useEffect(() => {
    if (!address || !round?.id) return;
    (async () => {
      const res = await fetch(`/api/deployments/me?address=${address}&round_id=${round.id}`, { cache: "no-store" });
      const json = await res.json();
      if (Array.isArray(json.deployments)) {
        const pre: Record<string, string> = {};
        const lock = new Set<string>();
        json.deployments.forEach((d: any) => {
          if (d.nft_mint && d.zone_slug) {
            pre[d.nft_mint] = d.zone_slug;
            lock.add(d.nft_mint);
          }
        });
        setChoices((prev) => ({ ...pre, ...prev })); // keep any unsaved picks too
        setLocked(lock);
      }
    })();
  }, [address, round?.id]);

  function setChoice(mint: string, zone_slug: string) {
    if (locked.has(mint)) return; // ignore changes if locked
    setChoices((prev) => ({ ...prev, [mint]: zone_slug }));
  }

  async function save() {
    if (!connected || !address) return setStatus("Connect your wallet first.");
    if (!round?.id) return setStatus("No open round.");

    // Only send mints that are not already locked and actually have a selected zone
    const items = Object.entries(choices)
      .filter(([mint, zone_slug]) => !locked.has(mint) && !!zone_slug)
      .map(([mint, zone_slug]) => ({ mint, zone_slug }));

    if (!items.length) return setStatus("Nothing to save (already locked or no selection).");

    setStatus("Saving deployments…");
    try {
      const res = await fetch("/api/deployments/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, round_id: round.id, items }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        return setStatus(data.error || "Failed to save.");
      }

      // Lock newly saved mints immediately
      const saved: string[] = Array.isArray(data.saved) ? data.saved : items.map(i => i.mint);
      setLocked((prev) => new Set([...prev, ...saved]));
      setStatus(`Saved ${data.count ?? saved.length} deployment(s).${data.skipped?.length ? ` Skipped ${data.skipped.length} already locked.` : ""}`);
    } catch (e: any) {
      setStatus(e?.message || "Network error while saving.");
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Deploy NFTs to Zones</h1>

      {!connected ? (
        <p className="text-neutral-400">Connect your wallet to continue.</p>
      ) : (
        <p className="text-neutral-400">
          Wallet: {address.slice(0, 4)}…{address.slice(-4)}
        </p>
      )}

      {round ? (
        <p className="text-neutral-400">
          Current round: {round.week_start} → {round.week_end} ({round.status})
        </p>
      ) : (
        <p className="text-neutral-400">No active round found.</p>
      )}

      {status && <p className="text-sm text-neutral-300">{status}</p>}

      <div className="grid grid-cols-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 p-4">
        {nfts.map((n) => {
          const isLocked = locked.has(n.mint);
          return (
            <div
              key={n.mint}
              className={`bg-neutral-900 rounded-xl shadow-lg overflow-hidden ${isLocked ? "opacity-75" : ""}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={n.image || "/placeholder.png"}
                alt={n.name}
                className="w-full h-32 object-cover"
              />
              <div className="p-2 text-sm">
                <div className="font-medium truncate">{n.name}</div>

                <div className="mt-2 flex items-center gap-2">
                  <select
                    className="w-full rounded-md bg-neutral-800 text-xs text-gray-200 p-1 disabled:opacity-60"
                    value={choices[n.mint] || ""}
                    onChange={(e) => setChoice(n.mint, e.target.value)}
                    disabled={isLocked || !round || round.status !== "open"}
                  >
                    <option value="">{isLocked ? "Locked" : "Select zone"}</option>
                    {zones.map((z) => (
                      <option key={z.slug} value={z.slug}>{z.name}</option>
                    ))}
                  </select>

                  {isLocked && (
                    <span className="inline-block rounded-md bg-emerald-600/20 text-emerald-300 text-[10px] px-2 py-1">
                      Locked
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={save}
        className="rounded-xl border border-neutral-800 px-4 py-2 font-medium text-neutral-100 transition-colors hover:bg-[#7f1d1d] hover:text-white disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-neutral-100"
        disabled={!connected || !round || round.status !== "open"}
      >
        Save Deployments
      </button>
    </div>
  );
}
