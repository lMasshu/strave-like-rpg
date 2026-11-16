import { expect, it } from "vitest";
import { createWorkoutTrackFeature } from "./workoutTrack";

it("renders independent segments without inventing a line across a pause or GPS gap", () => {
  const segments: [number, number][][] = [
    [
      [2, 48],
      [2, 48.00003],
    ],
    [[2, 49]],
    [
      [3, 50],
      [3, 50.00003],
    ],
  ];
  expect(createWorkoutTrackFeature(segments).geometry).toEqual({
    type: "MultiLineString",
    coordinates: [
      [
        [2, 48],
        [2, 48.00003],
      ],
      [
        [3, 50],
        [3, 50.00003],
      ],
    ],
  });
  expect(segments[1]).toEqual([[2, 49]]);
  expect(createWorkoutTrackFeature([]).geometry.coordinates).toEqual([]);
});
