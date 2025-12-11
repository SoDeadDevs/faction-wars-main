export type SimpleNft = {
  mint: string;
  name: string;
  image?: string;
  collection?: string;
};

function csv(name: string): string[] {
  const v = (process.env[name] || "").trim();
  return v ? v.split(",").map(s => s.trim()).filter(Boolean) : [];
}

const ALLOWED_COLLECTIONS = new Set(csv("NEXT_PUBLIC_ALLOWED_COLLECTIONS"));
const ALLOWED_CREATORS    = new Set(csv("NEXT_PUBLIC_ALLOWED_CREATORS"));

function heliusBaseUrl(): string {
  const net = (process.env.NEXT_PUBLIC_HELIUS_NETWORK || "mainnet").toLowerCase();
  return net === "devnet"
    ? `https://devnet.helius-rpc.com/?api-key=${process.env.NEXT_PUBLIC_HELIUS_API_KEY}`
    : `https://mainnet.helius-rpc.com/?api-key=${process.env.NEXT_PUBLIC_HELIUS_API_KEY}`;
}

function getCollection(it: any): string | undefined {
  // Helius DAS: grouping -> [{ group_key: "collection", group_value: "<verified_collection_mint>" }]
  return it?.grouping?.find((g: any) => g.group_key === "collection")?.group_value || undefined;
}

function getCreators(it: any): string[] {
  const set = new Set<string>();
  (it?.content?.metadata?.creators ?? []).forEach((c: any) => c?.address && set.add(c.address));
  (it?.creators ?? []).forEach((c: any) => c?.address && set.add(c.address));
  (it?.authorities ?? []).forEach((a: any) => a?.address && set.add(a.address)); // belt-and-suspenders
  return [...set];
}

function isLikelyNft(it: any): boolean {
  // Filter out fungible tokens, mints with large supply, etc.
  const iface = (it?.interface || "").toLowerCase();
  // Accept typical NFT interfaces (v1/v2/compressed)
  return iface.includes("nft") || iface.includes("compressed");
}

function passesAllowlist(it: any): boolean {
  const hasWhitelist = ALLOWED_COLLECTIONS.size > 0 || ALLOWED_CREATORS.size > 0;
  if (!hasWhitelist) return isLikelyNft(it); // no allowlist -> allow NFTs of any collection

  const col = getCollection(it);
  if (col && ALLOWED_COLLECTIONS.has(col)) return true;

  if (ALLOWED_CREATORS.size > 0) {
    const creators = getCreators(it);
    if (creators.some(addr => ALLOWED_CREATORS.has(addr))) return true;
  }

  return false;
}

async function fetchPage(owner: string, page: number, limit: number) {
  const url = heliusBaseUrl();
  const body = {
    jsonrpc: "2.0",
    id: "getAssetsByOwner",
    method: "getAssetsByOwner",
    params: {
      ownerAddress: owner,
      page,
      limit,
      options: {
        // be generous so we don't miss things
        showUnverifiedCollections: true,
        showCollectionMetadata: true,
      },
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Helius ${res.status}`);
  const json = await res.json();
  return (json?.result?.items ?? []) as any[];
}

export async function fetchNftsByOwner(owner: string): Promise<SimpleNft[]> {
  if (!process.env.NEXT_PUBLIC_HELIUS_API_KEY) return [];

  const limit = 200; // paginate to cover big wallets
  let page = 1;
  const all: any[] = [];

  while (true) {
    const items = await fetchPage(owner, page, limit);
    all.push(...items);
    if (items.length < limit) break; // last page
    page += 1;
    if (page > 20) break; // safety cap (20*200 = 4k assets)
  }

  const filtered = all.filter(it => isLikelyNft(it) && passesAllowlist(it));

  return filtered.map((it) => ({
    mint: it.id,
    name:
      it?.content?.metadata?.name ??
      it?.content?.files?.[0]?.fileName ??
      it.id.slice(0, 8),
    image: it?.content?.links?.image,
    collection: getCollection(it),
  }));
}
