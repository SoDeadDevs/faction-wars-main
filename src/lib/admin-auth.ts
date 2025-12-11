const ADMIN_WALLET_ENV = process.env.ADMIN_WALLETS || process.env.NEXT_PUBLIC_ADMIN_WALLETS || "";

function parseCsv(value: string): string[] {
  return value
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

const ADMIN_WALLETS = new Set<string>(parseCsv(ADMIN_WALLET_ENV));

export function isAdminWallet(address: string | null | undefined): boolean {
  if (!address) return false;
  return ADMIN_WALLETS.has(address.trim().toLowerCase());
}

export function requireAdminWallet(address: string | null | undefined) {
  if (!isAdminWallet(address)) {
    throw Object.assign(new Error("Unauthorized wallet"), { status: 403 });
  }
}
