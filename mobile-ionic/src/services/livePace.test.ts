import { describe, expect, it } from "vitest";
import type { TrackedPosition } from "../hooks/useGeolocationTracker";
import { getLivePace } from "./livePace";

const now = 10_000;
const fix: TrackedPosition = {
  coords: [2.3522, 48.8566],
  longitude: 2.3522,
  latitude: 48.8566,
  altitude: 35,
  speed: 3,
  accuracy: 5,
  timestamp: now,
};

describe("getLivePace", () => {
  it.each([
    [3, "moving", "5:33"],
    [0, "stopped", "--:--"],
    [0.4, "moving", "41:40"],
    [1000 / 359.6, "moving", "6:00"],
  ])(
    "formats speed %s without substituting an average",
    (speed, state, pace) => {
      expect(getLivePace({ ...fix, speed }, now, "recording")).toEqual({
        state,
        paceMinPerKm: pace,
      });
    },
  );

  it.each([
    null,
    { ...fix, speed: null },
    { ...fix, speed: NaN },
    { ...fix, speed: Infinity },
    { ...fix, speed: -1 },
    { ...fix, accuracy: 26 },
    { ...fix, accuracy: -1 },
    { ...fix, accuracy: NaN },
    { ...fix, timestamp: now + 1 },
    { ...fix, timestamp: 0 },
    { ...fix, timestamp: NaN },
    { ...fix, timestamp: now - 3000 },
    { ...fix, speed: 0, timestamp: now - 3000 },
  ])(
    "does not interpret an unreliable fix as movement or a stop: %j",
    (position) => {
      expect(getLivePace(position, now, "recording")).toEqual({
        state: "unavailable",
        paceMinPerKm: "--:--",
      });
    },
  );

  it("accepts a fix younger than three seconds at the accuracy boundary", () => {
    expect(
      getLivePace(
        { ...fix, timestamp: now - 2999, accuracy: 25 },
        now,
        "recording",
      ),
    ).toEqual({ state: "moving", paceMinPerKm: "5:33" });
  });

  it.each([
    ["paused", "paused"],
    ["idle", "inactive"],
    ["finished", "inactive"],
  ] as const)("does not show live pace when %s", (status, state) => {
    expect(getLivePace(fix, now, status)).toEqual({
      state,
      paceMinPerKm: "--:--",
    });
  });
});
