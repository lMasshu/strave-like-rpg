import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthorizationStatus } from "@capgo/capacitor-health";
import type { HealthClient } from "../services/watchLink";

type StateListener = (state: { isActive: boolean }) => void;
const appListeners: StateListener[] = [];
const removeListener = vi.fn();

vi.mock("@capacitor/app", () => ({
  App: {
    addListener: vi.fn((_event: string, listener: StateListener) => {
      appListeners.push(listener);
      return Promise.resolve({ remove: removeListener });
    }),
  },
}));

vi.mock("@capgo/capacitor-health", () => ({ Health: {} }));

import { useWatchLink } from "./useWatchLink";

function authorization(
  readAuthorized: AuthorizationStatus["readAuthorized"],
): AuthorizationStatus {
  return {
    readAuthorized,
    readDenied: [],
    writeAuthorized: [],
    writeDenied: [],
  };
}

function makeClient(overrides: Partial<HealthClient> = {}): HealthClient {
  return {
    isAvailable: vi
      .fn()
      .mockResolvedValue({ available: true, platform: "android" }),
    requestAuthorization: vi
      .fn()
      .mockResolvedValue(authorization(["workouts"])),
    checkAuthorization: vi.fn().mockResolvedValue(authorization([])),
    queryWorkouts: vi.fn().mockResolvedValue({
      workouts: [
        {
          workoutType: "running",
          duration: 600,
          startDate: "2026-11-16T07:00:00Z",
          endDate: "2026-11-16T07:10:00Z",
          platformId: "hc-1",
        },
      ],
    }),
    readSamples: vi.fn().mockResolvedValue({ samples: [] }),
    openHealthConnectSettings: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("useWatchLink", () => {
  beforeEach(() => {
    appListeners.length = 0;
    removeListener.mockClear();
  });

  it("lit l'état au montage sans lire les séances si non liée", async () => {
    const client = makeClient();
    const { result } = renderHook(() => useWatchLink(client));

    await waitFor(() =>
      expect(result.current.status?.state).toBe("not-linked"),
    );
    expect(result.current.workouts).toEqual([]);
    expect(client.queryWorkouts).not.toHaveBeenCalled();
  });

  it("charge les séances après la liaison", async () => {
    const client = makeClient();
    const { result } = renderHook(() => useWatchLink(client));
    await waitFor(() => expect(result.current.status).not.toBeNull());

    await act(() => result.current.link());

    expect(result.current.status?.state).toBe("linked");
    expect(result.current.workouts.map((w) => w.externalId)).toEqual(["hc-1"]);
    expect(result.current.isBusy).toBe(false);
  });

  it("revérifie l'autorisation au retour au premier plan", async () => {
    const checkAuthorization = vi
      .fn()
      .mockResolvedValueOnce(authorization([]))
      .mockResolvedValue(authorization(["workouts"]));
    const client = makeClient({ checkAuthorization });
    const { result } = renderHook(() => useWatchLink(client));
    await waitFor(() =>
      expect(result.current.status?.state).toBe("not-linked"),
    );

    await act(async () => {
      appListeners.forEach((listener) => listener({ isActive: false }));
      appListeners.forEach((listener) => listener({ isActive: true }));
    });

    await waitFor(() => expect(result.current.status?.state).toBe("linked"));
    expect(checkAuthorization).toHaveBeenCalledTimes(2);
  });

  it("expose une erreur lisible si Health Connect échoue", async () => {
    const client = makeClient({
      checkAuthorization: vi.fn().mockRejectedValue(new Error("boom")),
    });
    const { result } = renderHook(() => useWatchLink(client));

    await waitFor(() => expect(result.current.error).toMatch(/Health Connect/));
    expect(result.current.isBusy).toBe(false);
  });

  it("retire l'écouteur au démontage", async () => {
    const { result, unmount } = renderHook(() => useWatchLink(makeClient()));
    await waitFor(() => expect(result.current.status).not.toBeNull());

    unmount();

    await waitFor(() => expect(removeListener).toHaveBeenCalled());
  });
});
