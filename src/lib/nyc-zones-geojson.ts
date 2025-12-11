import type { FeatureCollection, Polygon } from "geojson";

export type ZoneFeatureProps = { slug: string; name: string };

export const NYC_ZONES_GEOJSON: FeatureCollection<Polygon, ZoneFeatureProps> = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { slug: "upper-west", name: "Upper West" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-74.015, 40.790], [-73.987, 40.790],
          [-73.987, 40.817], [-74.015, 40.817],
          [-74.015, 40.790]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { slug: "upper-east", name: "Upper East" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-73.970, 40.760], [-73.945, 40.760],
          [-73.945, 40.800], [-73.970, 40.800],
          [-73.970, 40.760]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { slug: "midtown", name: "Midtown" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-74.005, 40.744], [-73.970, 40.744],
          [-73.970, 40.760], [-74.005, 40.760],
          [-74.005, 40.744]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { slug: "soho", name: "SoHo" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-74.020, 40.707], [-73.990, 40.707],
          [-73.990, 40.732], [-74.020, 40.732],
          [-74.020, 40.707]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { slug: "les", name: "Lower East\nSide" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-73.990, 40.708], [-73.972, 40.708],
          [-73.972, 40.725], [-73.990, 40.725],
          [-73.990, 40.708]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { slug: "williamsburg", name: "Williamsburg" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-73.970, 40.711], [-73.940, 40.711],
          [-73.940, 40.734], [-73.970, 40.734],
          [-73.970, 40.711]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { slug: "bushwick", name: "Bushwick" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-73.930, 40.683], [-73.895, 40.683],
          [-73.895, 40.713], [-73.930, 40.713],
          [-73.930, 40.683]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { slug: "lic", name: "Long Island\nCity" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-73.960, 40.738], [-73.930, 40.738],
          [-73.930, 40.752], [-73.960, 40.752],
          [-73.960, 40.738]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { slug: "astoria", name: "Astoria" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-73.940, 40.758], [-73.905, 40.758],
          [-73.905, 40.790], [-73.940, 40.790],
          [-73.940, 40.758]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { slug: "harlem", name: "Harlem" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-73.970, 40.810], [-73.930, 40.810],
          [-73.930, 40.845], [-73.970, 40.845],
          [-73.970, 40.810]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { slug: "brooklyn-heights", name: "Brooklyn\nHeights" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-74.005, 40.690], [-73.985, 40.690],
          [-73.985, 40.705], [-74.005, 40.705],
          [-74.005, 40.690]
        ]]
      }
    }
  ]
};
