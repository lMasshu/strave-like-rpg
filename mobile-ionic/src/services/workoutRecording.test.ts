import { describe, expect, it } from "vitest";
import type { RecordedSample } from "../data/activityRecording";
import {
  createRecordingState,
  reduceRecording,
  getRecordingSnapshot,
} from "./workoutRecording";

const start = () =>
  reduceRecording(createRecordingState(), {
    type: "start",
    timestampMs: 100000,
  });
function sample(
  timestampMs: number,
  latitude = 48,
  extra: Partial<RecordedSample> = {},
): RecordedSample {
  return {
    latitude,
    longitude: 2,
    timestampMs,
    altitudeMeters: 30,
    horizontalAccuracyMeters: 5,
    speedMetersPerSecond: 3.125,
    speedSource: "native",
    source: "gps",
    ...extra,
  };
}
function add(state: ReturnType<typeof start>, point: RecordedSample) {
  return reduceRecording(state, {
    type: "sample",
    sample: point,
    receivedAtMs: point.timestampMs,
  });
}

describe("workout recording", () => {
  it("keeps the last known altitude baseline inside a segment without filling missing sample data", () => {
    let state = add(start(), sample(101000, 48, { altitudeMeters: 30 }));
    state = add(state, sample(102000, 48.00003, { altitudeMeters: null }));
    state = add(state, sample(103000, 48.00006, { altitudeMeters: 33 }));
    expect(state.elevationGainMeters).toBe(3);
    expect(state.recording.samples[1].altitudeMeters).toBeNull();
  });
  it("freezes actual event times and excludes pauses rather than counting timer callbacks", () => {
    let state = start();
    state = reduceRecording(state, { type: "pause", timestampMs: 105250 });
    state = reduceRecording(state, { type: "resume", timestampMs: 108000 });
    state = reduceRecording(state, { type: "finish", timestampMs: 112500 });
    const snapshot = getRecordingSnapshot(state, 200000)!;
    expect(snapshot.startedAtMs).toBe(100000);
    expect(snapshot.endedAtMs).toBe(112500);
    expect(snapshot.recording.elapsedDurationMs).toBe(12500);
    expect(snapshot.recording.activeDurationMs).toBe(9750);
    expect(snapshot.recording.events.map((event) => event.type)).toEqual([
      "start",
      "pause",
      "resume",
      "finish",
    ]);
  });

  it("finishes while paused and ignores repeated or illegal transitions", () => {
    let state = start();
    expect(reduceRecording(state, { type: "start", timestampMs: 101000 })).toBe(
      state,
    );
    state = reduceRecording(state, { type: "pause", timestampMs: 102000 });
    expect(reduceRecording(state, { type: "pause", timestampMs: 103000 })).toBe(
      state,
    );
    state = reduceRecording(state, { type: "finish", timestampMs: 105000 });
    expect(
      getRecordingSnapshot(state, 200000)?.recording.activeDurationMs,
    ).toBe(2000);
    expect(
      getRecordingSnapshot(state, 200000)?.recording.elapsedDurationMs,
    ).toBe(5000);
    expect(
      reduceRecording(state, { type: "resume", timestampMs: 106000 }),
    ).toBe(state);
    expect(
      getRecordingSnapshot(reduceRecording(state, { type: "reset" }), 200000),
    ).toBeNull();
  });

  it("rejects a backwards clock without altering the session", () => {
    const state = add(start(), sample(102000));
    expect(() =>
      reduceRecording(state, { type: "pause", timestampMs: 101000 }),
    ).toThrow();
    expect(state.recording.events).toHaveLength(1);
  });

  it("keeps stationary fixes and poor-quality fixes independently of the filtered track", () => {
    let state = start();
    for (let n = 1; n <= 10; n++) state = add(state, sample(100000 + n * 1000));
    state = add(
      state,
      sample(111000, 49, {
        horizontalAccuracyMeters: null,
        speedMetersPerSecond: null,
        speedSource: null,
        altitudeMeters: null,
      }),
    );
    expect(state.recording.samples).toHaveLength(11);
    expect(state.recording.segments).toHaveLength(1);
    expect(state.recording.segments[0].sampleIndices).toEqual([0]);
    expect(state.distanceMeters).toBe(0);
    expect(state.recording.samples[10].horizontalAccuracyMeters).toBeNull();
  });

  it("does not create gaps during slow movement under the distance threshold", () => {
    let state = start();
    for (let n = 1; n <= 10; n++)
      state = add(state, sample(100000 + n * 1000, 48 + n * 0.000005));
    expect(state.recording.segments).toHaveLength(1);
    expect(state.distanceMeters).toBeGreaterThan(2);
  });

  it.each(["gap", "error", "resume", "source"])(
    "does not bridge a %s interruption",
    (kind) => {
      let state = add(start(), sample(101000));
      if (kind === "error")
        state = reduceRecording(state, { type: "signalLost" });
      if (kind === "resume") {
        state = reduceRecording(state, { type: "pause", timestampMs: 101100 });
        state = reduceRecording(state, { type: "resume", timestampMs: 101500 });
      }
      state = add(
        state,
        sample(kind === "gap" ? 106001 : 102000, 49, {
          source: kind === "source" ? "simulation" : "gps",
          altitudeMeters: 1000,
          speedSource: "derived",
        }),
      );
      expect(state.recording.segments).toHaveLength(2);
      expect(state.distanceMeters).toBe(0);
      expect(state.elevationGainMeters).toBe(0);
      expect(state.recording.samples[1].speedMetersPerSecond).toBeNull();
    },
  );

  it("accepts a five-second interval without declaring a gap", () => {
    let state = add(start(), sample(101000));
    state = add(state, sample(106000, 48.00005));
    expect(state.recording.segments).toHaveLength(1);
    expect(state.distanceMeters).toBeGreaterThan(5);
  });

  it("ignores duplicate, out-of-order, future, invalid and paused fixes", () => {
    let state = add(start(), sample(101000));
    expect(add(state, sample(101000))).toBe(state);
    expect(add(state, sample(100999))).toBe(state);
    expect(add(state, sample(100000))).toBe(state);
    expect(add(state, sample(102000, 999))).toBe(state);
    expect(
      reduceRecording(state, {
        type: "sample",
        sample: sample(102000),
        receivedAtMs: 101999,
      }),
    ).toBe(state);
    state = reduceRecording(state, { type: "pause", timestampMs: 101500 });
    expect(add(state, sample(102000))).toBe(state);
  });

  it("leaves previous state and returned snapshots independent", () => {
    const first = add(start(), sample(101000));
    const second = add(first, sample(102000, 48.00003));
    expect(first.recording.samples).toHaveLength(1);
    const snapshot = getRecordingSnapshot(second, 103000)!;
    snapshot.recording.samples[0].latitude = 0;
    snapshot.recording.segments[0].sampleIndices.push(99);
    expect(second.recording.samples[0].latitude).toBe(48);
    expect(second.recording.segments[0].sampleIndices).toEqual([0, 1]);
  });
});
