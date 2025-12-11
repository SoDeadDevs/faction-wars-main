"use client";

import Image from "next/image";
import { BADGES } from "@/lib/badges";

const FALLBACK_BADGE_IMAGE = "/globe.svg";

export default function AchievementsCard() {
  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6 space-y-6 max-h-[70vh] overflow-y-auto">
      <header className="space-y-1">
        <h2 className="text-xl font-semibold">Achievements</h2>
        <p className="text-sm text-neutral-400">
          Earn badges by conquering zones, climbing the leaderboard, and proving faction loyalty.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {BADGES.map((badge) => (
          <div
            key={badge.slug}
            className="flex items-start gap-4 rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4"
          >
            <div className="flex-shrink-0 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950">
              <Image
                src={badge.image ?? FALLBACK_BADGE_IMAGE}
                alt={`${badge.name} badge`}
                width={64}
                height={64}
                className="h-16 w-16 object-contain"
                priority
              />
            </div>
            <div className="space-y-1">
              <p className="text-base font-semibold text-neutral-100">{badge.name}</p>
              <p className="text-sm text-neutral-400">{badge.description}</p>
              <p className="text-xs uppercase tracking-wide text-amber-300">
                {badge.requirement}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
