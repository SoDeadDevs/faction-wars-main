// GET NFTs by owner (proxy to our lib)

import { NextResponse } from "next/server";
import { fetchNftsByOwner } from "@/lib/nfts";
import { supabase } from "@/lib/supabase";

function readCsv(name: string): string[] {
  const v = (process.env[name] || "").trim();
  return v ? v.split(",").map(s => s.trim()).filter(Boolean) : [];
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const owner = (searchParams.get("owner") || "").trim();
  if (!owner) return NextResponse.json({ error: "Missing owner" }, { status: 400 });

  const allowedCollections = readCsv("NEXT_PUBLIC_ALLOWED_COLLECTIONS");
  const allowedCreators    = readCsv("NEXT_PUBLIC_ALLOWED_CREATORS");

  const nfts = await fetchNftsByOwner(owner); // this already filters, but we’ll count pre/post inside the lib now

  // Upsert filtered NFTs so deployments won’t FK-fail
  if (nfts.length) {
    const rows = nfts.map(n => ({
      mint: n.mint,
      owner_wallet: owner,
      collection: n.collection ?? null,
      name: n.name ?? null,
      image: n.image ?? null,
    }));
    const { error } = await supabase.from("nfts").upsert(rows, { onConflict: "mint" });
    if (error) {
      return NextResponse.json({
        nfts,
        debug: { allowedCollections, allowedCreators },
        warn: `[nfts upsert] ${error.message}`,
      });
    }
  }

  return NextResponse.json({
    nfts,
    debug: { allowedCollections, allowedCreators }
  });
}
