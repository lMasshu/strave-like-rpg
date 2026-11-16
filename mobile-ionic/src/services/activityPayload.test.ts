import { describe, expect, it } from "vitest";
import { createActivityPayload } from "./activityPayload";
import type { RecordingSnapshot } from "./workoutRecording";
import { readFileSync } from "node:fs";
import type { SaveActivityDto } from "./apiClient";

const snapshot: RecordingSnapshot = {
  startedAtMs: 100000,
  endedAtMs: 112500,
  distanceMeters: 12.345,
  elevationGainMeters: 2,
  recording: {
    version: 1,
    requestedIntervalMs: 1000,
    samples: [],
    segments: [],
    events: [
      { type: "start", timestampMs: 100000 },
      { type: "finish", timestampMs: 112500 },
    ],
    activeDurationMs: 12500,
    elapsedDurationMs: 12500,
  },
};
describe("createActivityPayload", () => {
  it("matches the documented wire fixture consumed by API round-trip tests", () => {
    const fixture = JSON.parse(
      readFileSync("../docs/api/recording.example.json", "utf8"),
    ) as SaveActivityDto;
    const result = createActivityPayload(
      {
        startedAtMs: Date.parse(fixture.startedAt),
        endedAtMs: Date.parse(fixture.endedAt),
        distanceMeters: fixture.distanceMeters,
        elevationGainMeters: fixture.elevationGainMeters!,
        recording: fixture.recording!,
      },
      "run",
    );
    expect(result).toEqual(fixture);
  });
  it("uses actual frozen times, active duration and unrounded metres", () => {
    expect(createActivityPayload(snapshot, "run")).toEqual({
      activityType: "run",
      startedAt: "1970-01-01T00:01:40.000Z",
      endedAt: "1970-01-01T00:01:52.500Z",
      durationSeconds: 12.5,
      distanceMeters: 12.345,
      elevationGainMeters: 2,
      coordinates: [],
      recording: snapshot.recording,
    });
  });
  it("refuses an unfinished session instead of inventing a finish", () => {
    expect(() =>
      createActivityPayload({ ...snapshot, endedAtMs: null }, "run"),
    ).toThrow();
  });
});
