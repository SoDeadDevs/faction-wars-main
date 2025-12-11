async function getZones() {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const res = await fetch(`${baseUrl}/api/zones`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch zones");
  return res.json();
}

export default async function MapPage() {
  const { zones } = await getZones();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">NYC Zones</h1>
      <p className="text-neutral-300">Loaded live from your Supabase database.</p>

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {zones.map((z: any) => (
          <div key={z.id} className="rounded-2xl border border-neutral-800 p-4">
            <div className="text-lg font-medium">{z.name}</div>
            <div className="text-sm text-neutral-500">Slug: {z.slug}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
