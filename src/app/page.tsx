"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import ProfileCard from "@/components/ProfileCard";
import AchievementsCard from "@/components/AchievementsCard";

const NycMap = dynamic(() => import("@/components/NycMap"), { ssr: false });
const WalletMultiButton = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

export default function Home() {
  const { connected, publicKey } = useWallet();
  const [showProfile, setShowProfile] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [roundInfo, setRoundInfo] = useState<{
    id: string;
    week_start: string;
    week_end: string;
    status: string;
  } | null>(null);
  const [roundStatus, setRoundStatus] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/rounds/current", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load round");
        setRoundInfo(json.round ?? null);
        setRoundStatus(json.round ? "" : "No active round.");
      } catch (err: any) {
        setRoundStatus(err?.message || "Unable to load round info.");
      }
    })();
  }, []);

  return (
    <main className="space-y-6 p-4 md:p-8">
      <div className="flex flex-col items-center text-center">
        <h1 className="text-4xl md:text-5xl font-[900] tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-[#7f1d1d] via-[#d97706] to-[#facc15] drop-shadow-[0_0_10px_rgba(127,29,29,0.6)]" style={{ fontFamily: '"Cinzel Decorative", serif' }}>
          Faction Wars
        </h1>
        <p className="text-neutral-400">
          Battle for control of New York. Deploy your NFTs, conquer zones, and earn rewards.
        </p>
      </div>

      <div className="flex justify-center">
        <WalletMultiButton className="!bg-neutral-100 !text-neutral-900 hover:!bg-neutral-300" />
      </div>

      <div className="flex flex-wrap gap-3 justify-center">
        <Link
          href="/factions"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl border border-neutral-800 px-4 py-2 transition-colors hover:bg-[#7f1d1d] hover:text-white"
        >
          Join a Faction
        </Link>
        <Link
          href="/deploy"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl border border-neutral-800 px-4 py-2 transition-colors hover:bg-[#7f1d1d] hover:text-white"
        >
          Deploy NFTs
        </Link>
        <Link
          href="/standings"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl border border-neutral-800 px-4 py-2 transition-colors hover:bg-[#7f1d1d] hover:text-white"
        >
          Standings
        </Link>
        <button
          onClick={() => setShowProfile(true)}
          className="rounded-xl border border-neutral-800 px-4 py-2 transition-colors hover:bg-[#7f1d1d] hover:text-white"
        >
          Profile
        </button>
        <button
          onClick={() => setShowAchievements(true)}
          className="rounded-xl border border-neutral-800 px-4 py-2 transition-colors hover:bg-[#7f1d1d] hover:text-white"
        >
          Achievements
        </button>
      </div>

      <div className="text-center text-sm text-neutral-300">
        {roundInfo ? (
          <div className="inline-flex flex-col items-center gap-1 rounded-2xl border border-neutral-800 bg-neutral-900/60 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-neutral-500">Current Round</div>
            <div className="font-semibold text-neutral-100">
              {roundInfo.week_start} → {roundInfo.week_end}
            </div>
          </div>
        ) : (
          <div className="text-neutral-500">{roundStatus || "No active round."}</div>
        )}
      </div>

      <div className="pt-2 flex justify-center">
        <div className="w-full max-w-6xl">
          <NycMap />
        </div>
      </div>

      {showProfile && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4"
          onClick={() => setShowProfile(false)}
        >
          <div
            className="w-full max-w-3xl max-h-[80vh] overflow-y-auto rounded-2xl border border-neutral-800 bg-neutral-950 p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-end">
              <button
                onClick={() => setShowProfile(false)}
                className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-neutral-700 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
                aria-label="Close profile"
              >
                ×
              </button>
            </div>
            <ProfileCard />
          </div>
        </div>
      )}

      {showAchievements && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4"
          onClick={() => setShowAchievements(false)}
        >
          <div
            className="w-full max-w-4xl max-h-[80vh] overflow-y-auto rounded-2xl border border-neutral-800 bg-neutral-950 p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <AchievementsCard />
          </div>
        </div>
      )}
    </main>
  );
}
