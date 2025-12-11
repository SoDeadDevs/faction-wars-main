"use client";

import { useEffect, useState } from "react";

type FactionInfo = {
  slug: string;
  name: string;
  color: string;
};

type LeaderboardEntry = {
  wallet: string;
  username: string | null;
  avatar_url: string | null;
  badges_count: number;
  faction?: FactionInfo | null;
};

export default function StandingsPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [status, setStatus] = useState<string>("Loading leaderboard…");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/leaderboard", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load leaderboard.");
        setEntries((json.entries ?? []).map((e: LeaderboardEntry) => ({ ...e, badges_count: e.badges_count ?? 0 })));
        setStatus("");
      } catch (error: any) {
        setStatus(error?.message || "Unable to load leaderboard.");
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Badge Leaderboard</h1>
        <p className="text-neutral-400">
          Ranked by total badges on each player profile. Keep deploying and earning achievements to climb!
        </p>
      </div>

      {status && <p className="text-sm text-neutral-400">{status}</p>}

      {!status && (
        <div className="rounded-2xl border border-neutral-800 p-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-neutral-400">
                <th className="px-3 py-2 font-medium">Rank</th>
                <th className="px-3 py-2 font-medium">Player</th>
                <th className="px-3 py-2 font-medium">Faction</th>
                <th className="px-3 py-2 font-medium text-right">Badges</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => (
                <tr key={entry.wallet} className="border-t border-neutral-800">
                  <td className="px-3 py-3 text-neutral-200 font-semibold">{index + 1}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 overflow-hidden rounded-full border border-neutral-700 bg-neutral-900">
                        {entry.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={entry.avatar_url} alt={entry.username || entry.wallet} className="h-full w-full object-cover" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-[10px] text-neutral-500">NA</span>
                        )}
                      </div>
                      <div>
                        <div className="text-neutral-100">
                          {entry.username || `${entry.wallet.slice(0, 4)}…${entry.wallet.slice(-4)}`}
                        </div>
                        <div className="text-xs text-neutral-500">
                          {entry.wallet.slice(0, 4)}…{entry.wallet.slice(-4)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    {entry.faction ? (
                      <span
                        className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide"
                        style={{
                          background: `${entry.faction.color}22`,
                          color: entry.faction.color,
                          border: `1px solid ${entry.faction.color}`,
                        }}
                      >
                        {entry.faction.name}
                      </span>
                    ) : (
                      <span className="text-neutral-500 text-xs uppercase">Unaffiliated</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right text-lg font-semibold text-neutral-100">{entry.badges_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {entries.length === 0 && (
            <p className="text-center text-neutral-500 text-sm py-6">No profiles have earned badges yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
