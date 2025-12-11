import type { Metadata } from "next";
import "./globals.css";
import SolanaWalletProviders from "./providers/solana-wallet";

export const metadata: Metadata = {
  title: "Faction Wars MVP",
  description: "NYC map, three factions, weekly zone deployments",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-950 text-neutral-100">
        <SolanaWalletProviders>
          <div className="mx-auto max-w-6xl p-6">{children}</div>
        </SolanaWalletProviders>
      </body>
    </html>
  );
}
