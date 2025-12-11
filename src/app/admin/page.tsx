"use client";

import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

type OccupancyRow = {
  zone_id: string;
  zone_slug: string;
  zone_name: string;
  count: number;
};

type ZoneHistory = {
  zone_slug: string;
  zone_name: string;
  totals: Record<string, number>;
  winner?: {
    slug: string;
    name: string | null;
    color?: string | null;
  };
};

type RoundHistory = {
  id: string;
  week_start: string;
  week_end: string;
  status: string;
  zones: ZoneHistory[];
};

function parseAdminWallets(): Set<string> {
  if (typeof window === "undefined") return new Set();
  const csv = process.env.NEXT_PUBLIC_ADMIN_WALLETS || "";
  return new Set(
    csv
      .split(",")
      .map((w) => w.trim().toLowerCase())
      .filter(Boolean)
  );
}

export default function AdminPage() {
  const { connected, publicKey } = useWallet();
  const walletAddress = useMemo(() => publicKey?.toBase58() ?? "", [publicKey]);
  const adminWallets = useMemo(parseAdminWallets, []);
  const isAuthorized = walletAddress && adminWallets.has(walletAddress.toLowerCase());

  const [weekStart, setWeekStart] = useState("");
  const [weekEnd, setWeekEnd] = useState("");
  const [roundId, setRoundId] = useState("");
  const [mintList, setMintList] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const [occupancy, setOccupancy] = useState<OccupancyRow[]>([]);
  const [loadingOccupancy, setLoadingOccupancy] = useState(false);
  const [showKickAllConfirm, setShowKickAllConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<"controls" | "history" | "badges">("controls");
  const [history, setHistory] = useState<RoundHistory[]>([]);
  const [historyStatus, setHistoryStatus] = useState("");
  const [factionWallet, setFactionWallet] = useState("");
  const [clearingFaction, setClearingFaction] = useState(false);
  const [badgeWallet, setBadgeWallet] = useState("");
  const [badgeStatus, setBadgeStatus] = useState("");
  const [badgeResults, setBadgeResults] = useState<
    { slug: string; name: string; earned_at: string; description?: string; requirement?: string; image?: string | null }[]
  >([]);

  useEffect(() => {
    if (!isAuthorized) {
      setOccupancy([]);
      setHistory([]);
      return;
    }

    (async () => {
      setLoadingOccupancy(true);
      try {
        const res = await fetch(`/api/admin/zones/occupancy?wallet=${walletAddress}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || "Failed to fetch occupancy");
        }
        setOccupancy(json.occupancy ?? []);
      } catch (error: any) {
        pushMessage(error?.message || "Failed to load occupancy");
      } finally {
        setLoadingOccupancy(false);
      }
    })();
  }, [isAuthorized, walletAddress]);

  useEffect(() => {
    if (!isAuthorized || activeTab !== "history") return;
    void loadHistory();
  }, [isAuthorized, walletAddress, activeTab]);

  function pushMessage(msg: string) {
    setMessages((prev) => [msg, ...prev].slice(0, 5));
  }

  async function startRound() {
    if (!isAuthorized) return;
    if (!weekStart || !weekEnd) {
      pushMessage("Provide both week start and week end dates.");
      return;
    }

    try {
      const res = await fetch("/api/admin/rounds/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: walletAddress, week_start: weekStart, week_end: weekEnd }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to start round");
      pushMessage(`Started new round: ${weekStart} → ${weekEnd}`);
      await refreshOccupancy();
    } catch (error: any) {
      pushMessage(error?.message || "Failed to start round");
    }
  }

  async function endRound() {
    if (!isAuthorized) return;
    try {
      const res = await fetch("/api/admin/rounds/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: walletAddress, round_id: roundId || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to end round");
      pushMessage(`Ended round ${json.round?.id ?? (roundId || "current")}`);
      await refreshOccupancy();
    } catch (error: any) {
      pushMessage(error?.message || "Failed to end round");
    }
  }

  async function kickNfts() {
    if (!isAuthorized) return;
    const mints = mintList
      .split(/[\n,]+/)
      .map((v) => v.trim())
      .filter(Boolean);

    if (!roundId) {
      pushMessage("Provide a round ID to remove NFTs from.");
      return;
    }

    if (!mints.length) {
      pushMessage("No NFT mints provided.");
      return;
    }

    try {
      const res = await fetch("/api/admin/zones/kick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: walletAddress, round_id: roundId, mints }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to kick NFTs");
      pushMessage(`Removed ${json.removed ?? 0} deployment(s).`);
      setMintList("");
      await refreshOccupancy();
    } catch (error: any) {
      pushMessage(error?.message || "Failed to remove NFTs");
    }
  }

  async function kickAllNfts() {
    if (!isAuthorized) return;
    try {
      const res = await fetch("/api/admin/zones/kick-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: walletAddress, round_id: roundId || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to remove deployments");
      pushMessage(`Removed ${json.removed ?? 0} deployment(s) from round ${json.round_id}.`);
      setShowKickAllConfirm(false);
      await refreshOccupancy();
    } catch (error: any) {
      pushMessage(error?.message || "Failed to remove deployments");
      setShowKickAllConfirm(false);
    }
  }

  async function clearFactionMembership() {
    if (!isAuthorized) return;
    const target = factionWallet.trim();
    if (!target) {
      pushMessage("Provide a wallet address to clear its faction.");
      return;
    }
    setClearingFaction(true);
    try {
      const res = await fetch("/api/admin/factions/kick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: walletAddress, target_wallet: target }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to clear faction.");

      if (json.message) {
        pushMessage(json.message);
      } else if (json.cleared) {
        pushMessage(`Cleared faction for ${json.address ?? target}.`);
      } else {
        pushMessage(
          `Wallet ${json.address ?? target} was not in a faction.`
        );
      }
      setFactionWallet("");
    } catch (error: any) {
      pushMessage(error?.message || "Failed to clear faction membership.");
    } finally {
      setClearingFaction(false);
    }
  }

  async function refreshOccupancy() {
    if (!isAuthorized) return;
    setLoadingOccupancy(true);
    try {
      const res = await fetch(`/api/admin/zones/occupancy?wallet=${walletAddress}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to fetch occupancy");
      setOccupancy(json.occupancy ?? []);
    } catch (error: any) {
      pushMessage(error?.message || "Failed to refresh occupancy");
    } finally {
      setLoadingOccupancy(false);
    }
  }

  async function loadHistory() {
    if (!isAuthorized) return;
    setHistoryStatus("Loading previous rounds…");
    try {
      const res = await fetch(`/api/admin/rounds/history?wallet=${walletAddress}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load history");
      setHistory(json.rounds ?? []);
      setHistoryStatus(json.rounds?.length ? "" : "No completed rounds yet.");
    } catch (error: any) {
      setHistoryStatus(error?.message || "Failed to load history.");
    }
  }

  async function loadBadges() {
    if (!isAuthorized) return;
    const target = badgeWallet.trim();
    if (!target) {
      setBadgeStatus("Enter a wallet to lookup badges.");
      return;
    }
    setBadgeStatus("Loading badges…");
    try {
      const res = await fetch(
        `/api/admin/badges?wallet=${walletAddress}&target_wallet=${encodeURIComponent(target)}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load badges");
      setBadgeResults(json.badges ?? []);
      setBadgeStatus(json.badges?.length ? "" : "No badges for this wallet.");
    } catch (error: any) {
      setBadgeStatus(error?.message || "Failed to load badges.");
      setBadgeResults([]);
    }
  }

  async function deleteBadge(slug: string) {
    if (!isAuthorized) return;
    const target = badgeWallet.trim();
    if (!target || !slug) return;
    setBadgeStatus(`Removing ${slug}…`);
    try {
      const res = await fetch("/api/admin/badges", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: walletAddress, target_wallet: target, badge_slug: slug }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to remove badge");
      setBadgeStatus(`Removed ${json.removed ?? 0} entry for ${slug}.`);
      setBadgeResults((prev) => prev.filter((b) => b.slug !== slug));
    } catch (error: any) {
      setBadgeStatus(error?.message || "Failed to remove badge.");
    }
  }

  function formatRange(round: RoundHistory) {
    return `${round.week_start} → ${round.week_end}`;
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold">Admin Panel</h1>
        <p className="text-neutral-400 text-sm">
          Restricted controls for faction rounds. Wallets must be whitelisted in NEXT_PUBLIC_ADMIN_WALLETS.
        </p>
        {connected ? (
          <p className="text-neutral-400 text-sm mt-2">
            Wallet: {walletAddress.slice(0, 4)}…{walletAddress.slice(-4)} {isAuthorized ? "(authorized)" : "(not authorized)"}
          </p>
        ) : (
          <p className="text-neutral-400 text-sm mt-2">Connect a wallet to continue.</p>
        )}
      </header>

      {!isAuthorized ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-200">
          Access denied. Your wallet is not on the admin allowlist.
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            {[
              { key: "controls", label: "Controls" },
              { key: "history", label: "Round History" },
              { key: "badges", label: "Badges" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as "controls" | "history" | "badges")}
                className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                  activeTab === tab.key
                    ? "bg-neutral-100 text-neutral-900"
                    : "border border-neutral-700 text-neutral-300 hover:bg-neutral-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "controls" ? (
            <>
              <section className="rounded-2xl border border-neutral-800 p-6 space-y-4">
                <h2 className="text-xl font-semibold">Rounds</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <h3 className="font-medium text-neutral-100">Start a new round</h3>
                    <label className="flex flex-col gap-1 text-sm">
                      Week start (YYYY-MM-DD)
                      <input
                        type="date"
                        className="rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-neutral-100"
                        value={weekStart}
                        onChange={(e) => setWeekStart(e.target.value)}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      Week end (YYYY-MM-DD)
                      <input
                        type="date"
                        className="rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-neutral-100"
                        value={weekEnd}
                        onChange={(e) => setWeekEnd(e.target.value)}
                      />
                    </label>
                    <button
                      onClick={startRound}
                      className="rounded-lg bg-emerald-500 px-4 py-2 font-medium text-emerald-950 hover:bg-emerald-400"
                    >
                      Start Round
                    </button>
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-medium text-neutral-100">End current round</h3>
                    <label className="flex flex-col gap-1 text-sm">
                      Round ID (optional)
                      <input
                        type="text"
                        placeholder="Auto-detect if empty"
                        className="rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-neutral-100"
                        value={roundId}
                        onChange={(e) => setRoundId(e.target.value)}
                      />
                    </label>
                    <button
                      onClick={endRound}
                      className="rounded-lg bg-amber-500 px-4 py-2 font-medium text-amber-950 hover:bg-amber-400"
                    >
                      End Round
                    </button>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-neutral-800 p-6 space-y-4">
                <h2 className="text-xl font-semibold">Kick NFTs from Zones</h2>
                <label className="flex flex-col gap-1 text-sm">
                  Round ID
                  <input
                    type="text"
                    className="rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-neutral-100"
                    value={roundId}
                    onChange={(e) => setRoundId(e.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  NFT mints (comma or newline separated)
                  <textarea
                    className="min-h-[120px] rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-neutral-100"
                    value={mintList}
                    onChange={(e) => setMintList(e.target.value)}
                  />
                </label>
                <button
                  onClick={kickNfts}
                  className="rounded-lg bg-rose-500 px-4 py-2 font-medium text-rose-50 hover:bg-rose-400"
                >
                  Remove Deployments
                </button>
                <button
                  onClick={() => setShowKickAllConfirm(true)}
                  className="rounded-lg border border-rose-500 px-4 py-2 font-medium text-rose-200 hover:bg-rose-500/20"
                >
                  Kick All Deployments
                </button>
              </section>

              <section className="rounded-2xl border border-neutral-800 p-6 space-y-4">
                <h2 className="text-xl font-semibold">Faction Membership</h2>
                <p className="text-sm text-neutral-400">
                  Remove a wallet from its faction to allow them to rejoin immediately.
                </p>
                <label className="flex flex-col gap-1 text-sm">
                  Wallet address
                  <input
                    type="text"
                    className="rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-neutral-100"
                    value={factionWallet}
                    onChange={(e) => setFactionWallet(e.target.value)}
                    placeholder="Enter wallet address"
                  />
                </label>
                <button
                  onClick={clearFactionMembership}
                  className="rounded-lg bg-rose-500 px-4 py-2 font-medium text-rose-50 hover:bg-rose-400 disabled:opacity-50"
                  disabled={clearingFaction}
                >
                  {clearingFaction ? "Clearing…" : "Clear Faction Membership"}
                </button>
              </section>

              <section className="rounded-2xl border border-neutral-800 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Zone Occupancy</h2>
                  <button
                    onClick={refreshOccupancy}
                    className="rounded-lg border border-neutral-600 px-3 py-1 text-sm hover:bg-neutral-900"
                  >
                    Refresh
                  </button>
                </div>
                {loadingOccupancy ? (
                  <p className="text-neutral-400 text-sm">Loading occupancy…</p>
                ) : occupancy.length === 0 ? (
                  <p className="text-neutral-500 text-sm">No deployments found for the selected round.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-neutral-400">
                          <th className="px-3 py-2 font-medium">Zone</th>
                          <th className="px-3 py-2 font-medium">Slug</th>
                          <th className="px-3 py-2 font-medium text-right">Deployments</th>
                        </tr>
                      </thead>
                      <tbody>
                        {occupancy.map((row) => (
                          <tr key={row.zone_id} className="border-t border-neutral-800">
                            <td className="px-3 py-2 text-neutral-100">{row.zone_name}</td>
                            <td className="px-3 py-2 text-neutral-400">{row.zone_slug}</td>
                            <td className="px-3 py-2 text-right text-neutral-100">{row.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {messages.length > 0 && (
                <section className="rounded-2xl border border-neutral-800 p-4 space-y-2">
                  <h2 className="text-lg font-semibold">Activity Log</h2>
                  <ul className="space-y-1 text-sm text-neutral-400">
                    {messages.map((msg, idx) => (
                      <li key={`${msg}-${idx}`}>• {msg}</li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          ) : activeTab === "history" ? (
            <section className="rounded-2xl border border-neutral-800 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Completed Rounds</h2>
                <button
                  onClick={loadHistory}
                  className="rounded-full border border-neutral-700 px-3 py-1 text-sm text-neutral-300 hover:bg-neutral-900"
                >
                  Refresh
                </button>
              </div>
              {historyStatus ? (
                <p className="text-sm text-neutral-400">{historyStatus}</p>
              ) : (
                <div className="space-y-4">
                  {history.map((round) => (
                    <div key={round.id} className="rounded-2xl border border-neutral-800 p-4 space-y-3">
                      <div className="flex items-center justify-between text-sm text-neutral-300">
                        <div>
                          <span className="font-semibold text-neutral-100">{formatRange(round)}</span>{" "}
                          <span className="uppercase text-xs text-neutral-500">({round.status})</span>
                        </div>
                        <span className="text-xs text-neutral-500">{round.id}</span>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        {round.zones.length ? (
                          round.zones.map((zone) => (
                            <div
                              key={`${round.id}-${zone.zone_slug}`}
                              className="rounded-xl border border-neutral-800 p-3 space-y-1"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-neutral-100">{zone.zone_name}</span>
                                {zone.winner ? (
                                  <span
                                    className="rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
                                    style={{
                                      background: `${zone.winner.color ?? "#ffffff"}22`,
                                      color: zone.winner.color ?? "#ffffff",
                                      border: `1px solid ${zone.winner.color ?? "#ffffff"}`,
                                    }}
                                  >
                                    {zone.winner.slug}
                                  </span>
                                ) : (
                                  <span className="text-xs text-neutral-500">Tie</span>
                                )}
                              </div>
                              <div className="text-xs text-neutral-400">
                                {Object.entries(zone.totals).map(([slug, count]) => (
                                  <div key={slug} className="flex justify-between">
                                    <span>{slug}</span>
                                    <span>{count}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-neutral-500 col-span-full">No deployments recorded.</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : (
            <section className="rounded-2xl border border-neutral-800 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Badges</h2>
                  <p className="text-sm text-neutral-400">Lookup and remove badges from a wallet.</p>
                </div>
                <button
                  onClick={loadBadges}
                  className="rounded-full border border-neutral-700 px-3 py-1 text-sm text-neutral-300 hover:bg-neutral-900"
                >
                  Refresh
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm">
                  Wallet address
                  <input
                    type="text"
                    className="rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-neutral-100"
                    value={badgeWallet}
                    onChange={(e) => setBadgeWallet(e.target.value)}
                    placeholder="Enter wallet address"
                  />
                </label>
                <div className="flex items-end gap-2">
                  <button
                    onClick={loadBadges}
                    className="rounded-lg bg-neutral-100 px-4 py-2 font-medium text-neutral-900 hover:bg-amber-400 hover:text-amber-950"
                  >
                    Load Badges
                  </button>
                </div>
              </div>

              {badgeStatus && <p className="text-sm text-neutral-400">{badgeStatus}</p>}

              {badgeResults.length > 0 && (
                <div className="grid gap-3 md:grid-cols-2">
                  {badgeResults.map((badge) => (
                    <div
                      key={badge.slug}
                      className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-neutral-100">{badge.name}</p>
                          <p className="text-xs text-neutral-500">{badge.slug}</p>
                        </div>
                        <button
                          onClick={() => deleteBadge(badge.slug)}
                          className="rounded-md border border-rose-500 px-2 py-1 text-xs font-semibold text-rose-100 hover:bg-rose-500/20"
                        >
                          Delete
                        </button>
                      </div>
                      {badge.description ? (
                        <p className="text-sm text-neutral-400">{badge.description}</p>
                      ) : null}
                      <div className="text-xs text-neutral-500">
                        Earned: {badge.earned_at ? new Date(badge.earned_at).toLocaleString() : "Unknown"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}

      {showKickAllConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-neutral-700 bg-neutral-950 p-6 text-neutral-100 shadow-xl">
            <h3 className="text-lg font-semibold">Kick all deployments?</h3>
            <p className="text-sm text-neutral-300">
              This will remove every NFT deployment for {roundId ? `round ${roundId}` : "the current open round"}. Are you sure?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowKickAllConfirm(false)}
                className="rounded-lg border border-neutral-600 px-4 py-2 text-sm hover:bg-neutral-900"
              >
                Cancel
              </button>
              <button
                onClick={kickAllNfts}
                className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-medium text-rose-50 hover:bg-rose-400"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
