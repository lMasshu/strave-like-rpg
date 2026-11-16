/** Keep discontinuities in the Mapbox projection; isolated fixes stay in the journal. */
export function createWorkoutTrackFeature(
  segments: [number, number][][],
): GeoJSON.Feature<GeoJSON.MultiLineString> {
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "MultiLineString",
      coordinates: segments.filter((segment) => segment.length > 1),
    },
  };
}
