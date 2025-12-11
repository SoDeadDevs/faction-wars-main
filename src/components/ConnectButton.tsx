"use client";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export function ConnectButton() {
  return (
    <div className="flex items-center gap-3">
      <WalletMultiButton />
    </div>
  );
}
