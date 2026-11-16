import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  Geolocation,
  type WatchPositionCallback,
  type Position,
} from "@capacitor/geolocation";
import { useActiveWorkout } from "./useActiveWorkout";

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => false },
}));
vi.mock("@capacitor/geolocation", () => ({
  Geolocation: {
    checkPermissions: vi.fn().mockResolvedValue({ location: "granted" }),
    getCurrentPosition: vi.fn().mockResolvedValue(null),
    watchPosition: vi.fn(),
    clearWatch: vi.fn().mockResolvedValue(undefined),
  },
}));
afterEach(() => vi.restoreAllMocks());

function nativeFix(timestamp: number, latitude: number): Position {
  return {
    timestamp,
    coords: {
      latitude,
      longitude: 2,
      accuracy: 5,
      speed: null,
      altitude: 30,
      altitudeAccuracy: null,
      heading: null,
    },
  } as Position;
}

it.each([false, true])(
  "restarts derived speed at resume, including a late initial fix: %s",
  async (lateInitial) => {
    vi.spyOn(Date, "now").mockReturnValue(100000);
    let resolveInitial!: (position: Position) => void;
    if (lateInitial)
      vi.mocked(Geolocation.getCurrentPosition).mockImplementationOnce(
        () =>
          new Promise<Position>((resolve) => {
            resolveInitial = resolve;
          }),
      );
    let callback: WatchPositionCallback | undefined;
    vi.mocked(Geolocation.watchPosition).mockImplementation(
      async (_options, listener) => {
        callback = listener;
        return "watch";
      },
    );
    const { result } = renderHook(() => useActiveWorkout());
    await waitFor(() => expect(callback).toBeDefined());
    act(() => result.current.startWorkout());
    vi.mocked(Date.now).mockReturnValue(101000);
    act(() => callback?.(nativeFix(101000, 48)));
    vi.mocked(Date.now).mockReturnValue(101100);
    act(() => result.current.pauseWorkout());
    vi.mocked(Date.now).mockReturnValue(101500);
    act(() => result.current.resumeWorkout());
    vi.mocked(Date.now).mockReturnValue(102000);
    if (lateInitial)
      await act(async () => resolveInitial(nativeFix(101300, 48.00005)));
    act(() => callback?.(nativeFix(102000, 48.0001)));
    expect(result.current.metrics.paceMinPerKm).toBe("--:--");
    vi.mocked(Date.now).mockReturnValue(103000);
    act(() => callback?.(nativeFix(103000, 48.00013)));
    const speed =
      result.current.metrics.recordingSnapshot!.recording.samples.at(
        -1,
      )!.speedMetersPerSecond!;
    expect(speed).toBeGreaterThan(3.3);
    expect(speed).toBeLessThan(3.4);
    expect(result.current.metrics.paceMinPerKm).toBe("5:00");
  },
);

it.each(["watch-first", "initial-first"])(
  "keeps both valid initial and watch results in %s order",
  async (order) => {
    vi.spyOn(Date, "now").mockReturnValue(100000);
    let callback: WatchPositionCallback | undefined;
    let resolveInitial!: (position: Position) => void;
    vi.mocked(Geolocation.getCurrentPosition).mockImplementationOnce(
      () =>
        new Promise<Position>((resolve) => {
          resolveInitial = resolve;
        }),
    );
    vi.mocked(Geolocation.watchPosition).mockImplementation(
      async (_options, listener) => {
        callback = listener;
        return "watch";
      },
    );
    const { result } = renderHook(() => useActiveWorkout());
    await waitFor(() => expect(callback).toBeDefined());
    act(() => result.current.startWorkout());
    vi.mocked(Date.now).mockReturnValue(103000);
    if (order === "watch-first") {
      act(() => callback?.(nativeFix(101000, 48)));
      await act(async () => resolveInitial(nativeFix(102000, 48.00003)));
    } else {
      await act(async () => resolveInitial(nativeFix(101000, 48)));
      act(() => callback?.(nativeFix(102000, 48.00003)));
    }
    expect(
      result.current.metrics.recordingSnapshot!.recording.samples.map(
        (point) => point.timestampMs,
      ),
    ).toEqual([101000, 102000]);
  },
);

it("keeps every fix and signal interruption even when React batches native callbacks", async () => {
  vi.spyOn(Date, "now").mockReturnValue(100000);
  let callback: WatchPositionCallback | undefined;
  vi.mocked(Geolocation.watchPosition).mockImplementation(
    async (_options, listener) => {
      callback = listener;
      return "watch";
    },
  );
  const { result } = renderHook(() => useActiveWorkout());
  await waitFor(() => expect(callback).toBeDefined());
  act(() => result.current.startWorkout());
  const position = (timestamp: number, latitude: number): Position =>
    ({
      timestamp,
      coords: {
        latitude,
        longitude: 2,
        accuracy: 5,
        speed: 3,
        altitude: 30,
        altitudeAccuracy: null,
        heading: null,
      },
    }) as Position;
  vi.mocked(Date.now).mockReturnValue(103000);
  act(() => {
    callback?.(position(101000, 48));
    callback?.(position(102000, 48.00003));
    callback?.(null, new Error("lost"));
    callback?.(position(103000, 49));
  });
  expect(
    result.current.metrics.recordingSnapshot?.recording.samples,
  ).toHaveLength(3);
  expect(
    result.current.metrics.trackSegments.map((segment) => segment.length),
  ).toEqual([2, 1]);
  expect(result.current.metrics.distanceMeters).toBe(3);
});
