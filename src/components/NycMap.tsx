// Map components that colors zones by winners

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { Map } from "maplibre-gl";
import { NYC_ZONES_GEOJSON } from "@/lib/nyc-zones-geojson";

type StandingsByZone = Record<
  string,
  { zone_slug: string; zone_name: string; totals: Record<string, number>; winner?: string }
>;

const DEFAULT_FACTION_COLORS: Record<string, string> = {
  "gangrel-tribe": "#b91c1c",
  "gangrel": "#b91c1c",
  "bat-tribe": "#0047AB",
  "bat": "#0047AB",
  "lycan-tribe": "#228b22",
  "lycan": "#228b22",
  unaffiliated: "#9ca3af",
  default: "#374151",
};

// Derive bounds from zone polygons so we zoom to the active play area
const ZONE_BOUNDS: [[number, number], [number, number]] = (() => {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  (NYC_ZONES_GEOJSON.features || []).forEach((feature) => {
    const coords = feature.geometry?.coordinates ?? [];
    coords.forEach((polygon) => {
      polygon.forEach(([lng, lat]) => {
        if (lng < minLng) minLng = lng;
        if (lat < minLat) minLat = lat;
        if (lng > maxLng) maxLng = lng;
        if (lat > maxLat) maxLat = lat;
      });
    });
  });

  // fallback to midtown if something goes wrong
  if (!isFinite(minLng) || !isFinite(minLat) || !isFinite(maxLng) || !isFinite(maxLat)) {
    return [
      [-74.02, 40.70],
      [-73.92, 40.80],
    ];
  }

  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
})();

export default function NycMap() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [byZone, setByZone] = useState<StandingsByZone>({});
  const [factionColors, setFactionColors] = useState<Record<string, string>>(DEFAULT_FACTION_COLORS);

  const initialView = useMemo(
    () => ({ center: [-73.9857, 40.7484] as [number, number], zoom: 12 }),
    []
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Dark-themed raster tiles for NYC context
    const style = {
      version: 8,
      sources: {
        osm: {
          type: "raster",
          tiles: ["https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"],
          tileSize: 256,
          attribution: "© OpenStreetMap contributors © CARTO",
        },
      },
      layers: [
        {
          id: "background",
          type: "background",
          paint: {
            "background-color": "#020617",
          },
        },
        {
          id: "osm-tiles",
          type: "raster",
          source: "osm",
        },
      ],
      glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    } as any;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style,
      center: initialView.center,
      zoom: initialView.zoom,
      maxBounds: [
        [ZONE_BOUNDS[0][0] - 0.1, ZONE_BOUNDS[0][1] - 0.1],
        [ZONE_BOUNDS[1][0] + 0.1, ZONE_BOUNDS[1][1] + 0.1],
      ],
      minZoom: 10,
      maxZoom: 18,
      pitchWithRotate: false,
      dragRotate: false,
      cooperativeGestures: false,
    });
    mapRef.current = map;

    map.scrollZoom.disable();
    map.boxZoom.disable();
    map.dragPan.disable();
    map.dragRotate.disable();
    map.keyboard.disable();
    map.doubleClickZoom.disable();
    map.touchZoomRotate.disable();

    map.on("load", () => {
      // Add zones source
      if (!map.getSource("zones")) {
        map.addSource("zones", { type: "geojson", data: NYC_ZONES_GEOJSON });
      }

      // Subtle fills with faction colors
      if (!map.getLayer("zones-fill")) {
        map.addLayer({
          id: "zones-fill",
          type: "fill",
          source: "zones",
          paint: {
            "fill-color": DEFAULT_FACTION_COLORS.default,
            "fill-opacity": 0.35,
          },
        });
      }

      // Simple outline
      if (!map.getLayer("zones-line")) {
        map.addLayer({
          id: "zones-line",
          type: "line",
          source: "zones",
          paint: {
            "line-color": "#e2e8f0",
            "line-width": 1.5,
          },
        });
      }

      // Zone labels (from properties.name)
      if (!map.getLayer("zones-label")) {
        map.addLayer({
          id: "zones-label",
          type: "symbol",
          source: "zones",
          layout: {
            "text-field": ["get", "name"],
            "text-size": 12,
            "text-offset": [0, 0],
            "text-anchor": "center",
            "text-justify": "center",
            "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
          },
          paint: {
            "text-color": "#f8fafc",
            "text-halo-color": "#020617",
            "text-halo-width": 1.4,
          },
        });
      }

      ["zones-fill", "zones-line", "zones-label"].forEach((id) => {
        if (map.getLayer(id)) map.moveLayer(id);
      });

      // Fit to the cluster of zones to match gameplay map
      try {
        map.fitBounds(ZONE_BOUNDS, { padding: 60, animate: false });
      } catch {}

      setMapReady(true);
    });

    map.on("error", (e) => {
      // helpful if anything fails to load
      // eslint-disable-next-line no-console
      console.error("Map error:", (e as any)?.error || e);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [initialView]);

  // Recolor fills by weekly winner (outlines stay yellow)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/rounds/current/standings", { cache: "no-store" });
        const json = await res.json();
        const bz = (json?.byZone ?? {}) as StandingsByZone;
        setByZone(bz);
        if (json?.factionColors) {
          setFactionColors((prev) => ({ ...prev, ...json.factionColors }));
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("Standings fetch failed:", e);
      }
    })();
  }, []);

  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const palette = { ...DEFAULT_FACTION_COLORS, ...factionColors };
    const winnerColorBySlug: Record<string, string> = {};
    Object.values(byZone).forEach((row) => {
      const key = row.winner ?? "default";
      const color = palette[key] ?? palette.default;
      winnerColorBySlug[row.zone_slug] = color;
    });

    const pairs: any[] = [];
    (NYC_ZONES_GEOJSON.features || []).forEach((f) => {
      const slug = (f.properties as any)?.slug as string;
      const color = winnerColorBySlug[slug] ?? palette.default;
      pairs.push(slug, color);
    });

    const fillColorExpr: any = ["match", ["get", "slug"], ...pairs, palette.default];
    if (map.getLayer("zones-fill")) {
      map.setPaintProperty("zones-fill", "fill-color", fillColorExpr);
    }
  }, [byZone, factionColors, mapReady]);

  return (
    <div className="w-full min-h-[320px] h-[55vh] md:h-[65vh] max-h-[820px] rounded-2xl overflow-x-hidden overflow-y-auto border border-neutral-800">
      <div ref={containerRef} className="w-full min-h-[900px] h-[900px]" />
    </div>
  );
}
