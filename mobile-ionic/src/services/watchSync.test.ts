import { describe, expect, it, vi } from "vitest";
import type { AuthorizationStatus, Workout } from "@capgo/capacitor-health";
import type { WatchWorkout } from "../data/watchLink";
import {
  ActivityAlreadyImportedError,
  ApiError,
  SaveActivityDto,
} from "./apiClient";
import type { HealthClient } from "./watchLink";
import {
  createLocalImportedStore,
  importedStoreKey,
  ImportedWorkoutStore,
  syncWatchWorkouts,
  toSaveActivityDto,
} from "./watchSync";

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

function workout(id: string, startDate: string): Workout {
  const start = Date.parse(startDate);
  return {
    workoutType: "running",
    duration: 3660,
    totalDistance: 10350.4,
    startDate,
    endDate: new Date(start + 3660 * 1000).toISOString(),
    sourceId: "com.garmin.android.apps.connectmobile",
    platformId: id,
  };
}

function makeHealth(
  workouts: Workout[],
  overrides: Partial<HealthClient> = {},
): HealthClient {
  return {
    isAvailable: vi
      .fn()
      .mockResolvedValue({ available: true, platform: "android" }),
    requestAuthorization: vi.fn(),
    checkAuthorization: vi
      .fn()
      .mockResolvedValue(authorization(["workouts", "distance"])),
    queryWorkouts: vi.fn().mockResolvedValue({ workouts }),
    readSamples: vi.fn().mockResolvedValue({ samples: [] }),
    openHealthConnectSettings: vi.fn(),
    ...overrides,
  };
}

function memoryStore(initial: string[] = []): ImportedWorkoutStore & {
  ids: Set<string>;
} {
  const ids = new Set(initial);
  return {
    ids,
    has: (id) => ids.has(id),
    add: (id) => {
      ids.add(id);
    },
  };
}

const NOW = new Date("2026-11-17T12:00:00Z");

describe("toSaveActivityDto", () => {
  const watchWorkout: WatchWorkout = {
    externalId: "hc-1",
    activityType: "hike",
    startedAt: "2026-11-16T07:00:00.000Z",
    endedAt: "2026-11-16T08:01:00.000Z",
    durationSeconds: 3660,
    distanceMeters: 10350.4,
    caloriesKcal: 700,
    sourceName: "Garmin Forerunner 255",
  };

  it("garde le type, arrondit la distance et référence la séance et la montre d'origine", () => {
    expect(toSaveActivityDto(watchWorkout, "health-connect")).toEqual({
      activityType: "hike",
      startedAt: "2026-11-16T07:00:00.000Z",
      endedAt: "2026-11-16T08:01:00.000Z",
      durationSeconds: 3660,
      distanceMeters: 10350,
      elevationGainMeters: 0,
      coordinates: [],
      external: {
        source: "health-connect",
        id: "hc-1",
        deviceName: "Garmin Forerunner 255",
      },
    });
  });

  it("déduit la marque d'un identifiant d'appli, et omet une montre inconnue", () => {
    expect(
      toSaveActivityDto(
        {
          ...watchWorkout,
          sourceName: "com.garmin.android.apps.connectmobile",
        },
        "health-connect",
      ).external,
    ).toEqual({ source: "health-connect", id: "hc-1", deviceName: "Garmin" });
    expect(
      toSaveActivityDto({ ...watchWorkout, sourceName: null }, "health-connect")
        .external,
    ).toEqual({ source: "health-connect", id: "hc-1" });
  });

  it("envoie 0 m quand la montre n'a pas fourni de distance", () => {
    expect(
      toSaveActivityDto(
        { ...watchWorkout, distanceMeters: null },
        "apple-health",
      ).distanceMeters,
    ).toBe(0);
  });
});

describe("syncWatchWorkouts", () => {
  it("ne fait rien si la montre n'est pas liée", async () => {
    const health = makeHealth([], {
      checkAuthorization: vi.fn().mockResolvedValue(authorization([])),
    });
    const save = vi.fn();

    const result = await syncWatchWorkouts({
      health,
      save,
      store: memoryStore(),
      now: NOW,
    });

    expect(result).toEqual({
      state: "skipped",
      imported: 0,
      ignored: 0,
      failed: 0,
    });
    expect(health.queryWorkouts).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it("envoie les nouvelles séances des 30 derniers jours, de la plus ancienne à la plus récente", async () => {
    const health = makeHealth([
      workout("hc-new", "2026-11-16T07:00:00Z"),
      workout("hc-old", "2026-11-10T07:00:00Z"),
      workout("hc-done", "2026-11-05T07:00:00Z"),
    ]);
    const save = vi.fn().mockResolvedValue({});
    const store = memoryStore(["hc-done"]);

    const result = await syncWatchWorkouts({ health, save, store, now: NOW });

    expect(health.queryWorkouts).toHaveBeenCalledWith(
      expect.objectContaining({ startDate: "2026-10-18T12:00:00.000Z" }),
    );
    expect(
      save.mock.calls.map((call) => (call[0] as SaveActivityDto).external?.id),
    ).toEqual(["hc-old", "hc-new"]);
    expect(result).toMatchObject({ state: "synced", imported: 2, failed: 0 });
    expect(store.ids).toEqual(new Set(["hc-done", "hc-old", "hc-new"]));
  });

  it("marque comme traitées les séances déjà présentes ou refusées par l'API", async () => {
    const health = makeHealth([
      workout("hc-dup", "2026-11-16T07:00:00Z"),
      workout("hc-cheat", "2026-11-15T07:00:00Z"),
    ]);
    const save = vi
      .fn()
      .mockRejectedValueOnce(new ApiError("Anti-cheat validation failed", 400))
      .mockRejectedValueOnce(new ActivityAlreadyImportedError("act-1"));
    const store = memoryStore();

    const result = await syncWatchWorkouts({ health, save, store, now: NOW });

    expect(result).toMatchObject({ imported: 0, ignored: 2, failed: 0 });
    expect(store.ids).toEqual(new Set(["hc-dup", "hc-cheat"]));
  });

  it("s'arrête au premier échec réseau et garde les séances restantes pour la prochaine fois", async () => {
    const health = makeHealth([
      workout("hc-3", "2026-11-16T07:00:00Z"),
      workout("hc-2", "2026-11-15T07:00:00Z"),
      workout("hc-1", "2026-11-14T07:00:00Z"),
    ]);
    const save = vi
      .fn()
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const store = memoryStore();

    const result = await syncWatchWorkouts({ health, save, store, now: NOW });

    expect(save).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ imported: 1, ignored: 0, failed: 2 });
    expect(store.ids).toEqual(new Set(["hc-1"]));
  });

  it("retente une erreur serveur (5xx) au lieu de l'ignorer", async () => {
    const health = makeHealth([workout("hc-1", "2026-11-16T07:00:00Z")]);
    const save = vi.fn().mockRejectedValue(new ApiError("boom", 503));
    const store = memoryStore();

    const result = await syncWatchWorkouts({ health, save, store, now: NOW });

    expect(result.failed).toBe(1);
    expect(store.has("hc-1")).toBe(false);
  });

  it("déclare la source Apple Santé sur iOS", async () => {
    const health = makeHealth([workout("hk-1", "2026-11-16T07:00:00Z")], {
      isAvailable: vi
        .fn()
        .mockResolvedValue({ available: true, platform: "ios" }),
    });
    const save = vi.fn().mockResolvedValue({});

    await syncWatchWorkouts({ health, save, store: memoryStore(), now: NOW });

    expect(save.mock.calls[0][0].external).toEqual({
      source: "apple-health",
      id: "hk-1",
      // La séance de test vient de l'appli Garmin Connect.
      deviceName: "Garmin",
    });
  });
});

describe("createLocalImportedStore", () => {
  it("persiste les identifiants entre deux instances, séparément pour chaque compte", () => {
    localStorage.clear();
    createLocalImportedStore("player-a", localStorage).add("hc-1");

    expect(createLocalImportedStore("player-a", localStorage).has("hc-1")).toBe(
      true,
    );
    expect(createLocalImportedStore("player-a", localStorage).has("hc-2")).toBe(
      false,
    );
    expect(createLocalImportedStore("player-b", localStorage).has("hc-1")).toBe(
      false,
    );
  });

  it("ignore un contenu corrompu et un stockage absent", () => {
    localStorage.setItem(importedStoreKey("player-a"), "{pas du json");
    expect(createLocalImportedStore("player-a", localStorage).has("hc-1")).toBe(
      false,
    );

    const noStorage = createLocalImportedStore("player-a", null);
    noStorage.add("hc-1");
    expect(noStorage.has("hc-1")).toBe(true);
  });

  it("survit à un stockage qui refuse l'écriture", () => {
    const failing = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    } as unknown as Storage;
    const store = createLocalImportedStore("player-a", failing);

    expect(() => store.add("hc-1")).not.toThrow();
    expect(store.has("hc-1")).toBe(true);
  });
});
