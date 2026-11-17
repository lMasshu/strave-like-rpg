import { describe, expect, it, vi } from "vitest";
import type {
  AuthorizationStatus,
  HealthSample,
  QueryOptions,
  Workout,
} from "@capgo/capacitor-health";
import {
  fetchRecentWatchWorkouts,
  getWatchLinkStatus,
  HealthClient,
  linkWatch,
  mapWorkoutType,
  sumSamplesFromSource,
  toWatchWorkout,
  WATCH_READ_PERMISSIONS,
  withSourceTotals,
} from "./watchLink";

const GARMIN = "com.garmin.android.apps.connectmobile";
const SAMSUNG = "com.sec.android.app.shealth";

function sample(
  sourceId: string,
  value: number,
  startDate: string,
  endDate: string,
  dataType: HealthSample["dataType"] = "distance",
): HealthSample {
  return {
    dataType,
    value,
    unit: dataType === "distance" ? "meter" : "kilocalorie",
    startDate,
    endDate,
    sourceId,
  };
}

describe("sumSamplesFromSource", () => {
  const start = Date.parse("2026-11-16T07:00:00Z");
  const end = Date.parse("2026-11-16T08:00:00Z");

  it("ne somme que les échantillons de l'appli de la séance", () => {
    const samples = [
      sample(GARMIN, 5000, "2026-11-16T07:00:00Z", "2026-11-16T07:30:00Z"),
      sample(GARMIN, 5350, "2026-11-16T07:30:00Z", "2026-11-16T08:00:00Z"),
      sample(SAMSUNG, 6310, "2026-11-16T07:00:00Z", "2026-11-16T08:00:00Z"),
    ];
    expect(sumSamplesFromSource(samples, GARMIN, start, end)).toBe(10350);
  });

  it("compte au prorata un échantillon à cheval sur le début", () => {
    const samples = [
      sample(GARMIN, 1000, "2026-11-16T06:50:00Z", "2026-11-16T07:10:00Z"),
    ];
    expect(sumSamplesFromSource(samples, GARMIN, start, end)).toBe(500);
  });

  it("garde les échantillons ponctuels dans la séance et ignore les autres", () => {
    const samples = [
      sample(GARMIN, 42, "2026-11-16T07:20:00Z", "2026-11-16T07:20:00Z"),
      sample(GARMIN, 99, "2026-11-16T09:00:00Z", "2026-11-16T09:00:00Z"),
      sample(GARMIN, 77, "2026-11-16T08:00:00Z", "2026-11-16T08:30:00Z"),
    ];
    expect(sumSamplesFromSource(samples, GARMIN, start, end)).toBe(42);
  });

  it("renvoie null si l'appli n'a rien écrit", () => {
    const samples = [
      sample(SAMSUNG, 6310, "2026-11-16T07:00:00Z", "2026-11-16T08:00:00Z"),
      { ...sample(GARMIN, 1, "x", "y") },
    ];
    expect(sumSamplesFromSource(samples, GARMIN, start, end)).toBeNull();
    expect(sumSamplesFromSource([], GARMIN, start, end)).toBeNull();
  });
});

describe("withSourceTotals", () => {
  const hourRun = {
    externalId: "hc-1",
    activityType: "run" as const,
    startedAt: "2026-11-16T07:00:00.000Z",
    endedAt: "2026-11-16T08:01:00.000Z",
    durationSeconds: 3660,
    distanceMeters: 6310,
    caloriesKcal: 300,
    sourceName: "Garmin",
  };

  it("remplace l'agrégat Health Connect par les données de la montre", async () => {
    const readSamples = vi.fn((options: QueryOptions) =>
      Promise.resolve({
        samples:
          options.dataType === "distance"
            ? [
                sample(GARMIN, 10350, hourRun.startedAt, hourRun.endedAt),
                sample(SAMSUNG, 6310, hourRun.startedAt, hourRun.endedAt),
              ]
            : [
                sample(
                  GARMIN,
                  780,
                  hourRun.startedAt,
                  hourRun.endedAt,
                  "calories",
                ),
              ],
      }),
    );
    const client = makeClient({ readSamples });

    const result = await withSourceTotals(client, hourRun, GARMIN);

    expect(result.distanceMeters).toBe(10350);
    expect(result.caloriesKcal).toBe(780);
    expect(readSamples).toHaveBeenCalledWith(
      expect.objectContaining({
        dataType: "distance",
        startDate: hourRun.startedAt,
        endDate: hourRun.endedAt,
      }),
    );
  });

  it("garde l'agrégat si la montre n'a écrit aucun échantillon ou si la lecture échoue", async () => {
    const empty = makeClient();
    await expect(withSourceTotals(empty, hourRun, GARMIN)).resolves.toEqual(
      hourRun,
    );

    const failing = makeClient({
      readSamples: vi.fn().mockRejectedValue(new Error("denied")),
    });
    await expect(withSourceTotals(failing, hourRun, GARMIN)).resolves.toEqual(
      hourRun,
    );
  });

  it("ne lit rien sans appli source connue", async () => {
    const client = makeClient();
    await expect(withSourceTotals(client, hourRun, undefined)).resolves.toBe(
      hourRun,
    );
    expect(client.readSamples).not.toHaveBeenCalled();
  });
});

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
      .mockResolvedValue(authorization(["workouts", "heartRate"])),
    checkAuthorization: vi.fn().mockResolvedValue(authorization([])),
    queryWorkouts: vi.fn().mockResolvedValue({ workouts: [] }),
    readSamples: vi.fn().mockResolvedValue({ samples: [] }),
    openHealthConnectSettings: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const garminRun: Workout = {
  workoutType: "running",
  duration: 1800,
  totalDistance: 5012.4,
  totalEnergyBurned: 410,
  startDate: "2026-11-16T07:00:00Z",
  endDate: "2026-11-16T07:30:00Z",
  sourceName: "Garmin Connect",
  platformId: "hc-run-1",
};

describe("mapWorkoutType", () => {
  it("convertit les sports d'endurance vers les types Stride Quest", () => {
    expect(mapWorkoutType("running")).toBe("run");
    expect(mapWorkoutType("walking")).toBe("walk");
    expect(mapWorkoutType("hiking")).toBe("hike");
    expect(mapWorkoutType("cycling")).toBe("bike");
  });

  it("ignore les sports non gérés", () => {
    expect(mapWorkoutType("yoga")).toBeNull();
    expect(mapWorkoutType("swimming")).toBeNull();
  });
});

describe("getWatchLinkStatus", () => {
  it("signale l'indisponibilité sans demander d'autorisation", async () => {
    const client = makeClient({
      isAvailable: vi.fn().mockResolvedValue({
        available: false,
        platform: "web",
        reason: "Not native",
      }),
    });

    await expect(getWatchLinkStatus(client)).resolves.toEqual({
      state: "unavailable",
      platform: "web",
      heartRateAuthorized: false,
      reason: "Not native",
    });
    expect(client.checkAuthorization).not.toHaveBeenCalled();
  });

  it("est non liée tant que les séances ne sont pas autorisées", async () => {
    const client = makeClient({
      checkAuthorization: vi
        .fn()
        .mockResolvedValue(authorization(["heartRate"])),
    });

    const status = await getWatchLinkStatus(client);
    expect(status.state).toBe("not-linked");
    expect(status.heartRateAuthorized).toBe(true);
    expect(client.requestAuthorization).not.toHaveBeenCalled();
  });

  it("est liée quand la lecture des séances est accordée", async () => {
    const client = makeClient({
      checkAuthorization: vi
        .fn()
        .mockResolvedValue(authorization(["workouts"])),
    });

    const status = await getWatchLinkStatus(client);
    expect(status).toMatchObject({ state: "linked", platform: "android" });
    expect(status.heartRateAuthorized).toBe(false);
  });
});

describe("linkWatch", () => {
  it("demande uniquement des permissions de lecture", async () => {
    const client = makeClient();

    const status = await linkWatch(client);

    expect(client.requestAuthorization).toHaveBeenCalledWith(
      WATCH_READ_PERMISSIONS,
    );
    expect(WATCH_READ_PERMISSIONS.write).toBeUndefined();
    expect(status).toMatchObject({
      state: "linked",
      heartRateAuthorized: true,
    });
  });

  it("reste non liée si l'utilisateur refuse", async () => {
    const client = makeClient({
      requestAuthorization: vi.fn().mockResolvedValue(authorization([])),
    });

    await expect(linkWatch(client)).resolves.toMatchObject({
      state: "not-linked",
    });
  });

  it("ne déclenche pas la demande si Health Connect est absent", async () => {
    const client = makeClient({
      isAvailable: vi
        .fn()
        .mockResolvedValue({ available: false, platform: "android" }),
    });

    await expect(linkWatch(client)).resolves.toMatchObject({
      state: "unavailable",
    });
    expect(client.requestAuthorization).not.toHaveBeenCalled();
  });
});

describe("toWatchWorkout", () => {
  it("convertit une séance Garmin", () => {
    expect(toWatchWorkout(garminRun)).toEqual({
      externalId: "hc-run-1",
      activityType: "run",
      startedAt: "2026-11-16T07:00:00.000Z",
      endedAt: "2026-11-16T07:30:00.000Z",
      durationSeconds: 1800,
      distanceMeters: 5012.4,
      caloriesKcal: 410,
      sourceName: "Garmin Connect",
    });
  });

  it("garde la séance sans distance ni calories", () => {
    const converted = toWatchWorkout({
      ...garminRun,
      totalDistance: undefined,
      totalEnergyBurned: Number.NaN,
    });
    expect(converted?.distanceMeters).toBeNull();
    expect(converted?.caloriesKcal).toBeNull();
  });

  it("recalcule la durée depuis les dates si elle est invalide", () => {
    const converted = toWatchWorkout({ ...garminRun, duration: -1 });
    expect(converted?.durationSeconds).toBe(1800);
  });

  it("rejette les sports non gérés, sans identifiant ou aux dates incohérentes", () => {
    expect(toWatchWorkout({ ...garminRun, workoutType: "yoga" })).toBeNull();
    expect(toWatchWorkout({ ...garminRun, platformId: undefined })).toBeNull();
    expect(
      toWatchWorkout({ ...garminRun, startDate: "pas une date" }),
    ).toBeNull();
    expect(
      toWatchWorkout({
        ...garminRun,
        startDate: "2026-11-16T08:00:00Z",
        endDate: "2026-11-16T07:00:00Z",
      }),
    ).toBeNull();
  });
});

describe("fetchRecentWatchWorkouts", () => {
  it("interroge les 7 derniers jours et filtre, dédoublonne et trie", async () => {
    const olderWalk: Workout = {
      ...garminRun,
      workoutType: "walking",
      platformId: "hc-walk-1",
      startDate: "2026-11-14T10:00:00Z",
      endDate: "2026-11-14T11:00:00Z",
    };
    const queryWorkouts = vi.fn().mockResolvedValue({
      workouts: [
        olderWalk,
        garminRun,
        { ...garminRun },
        { ...garminRun, workoutType: "yoga", platformId: "hc-yoga" },
      ],
    });
    const client = makeClient({ queryWorkouts });
    const now = new Date("2026-11-17T12:00:00Z");

    const result = await fetchRecentWatchWorkouts(client, now);

    expect(queryWorkouts).toHaveBeenCalledWith({
      startDate: "2026-11-10T12:00:00.000Z",
      endDate: "2026-11-17T12:00:00.000Z",
      limit: 50,
      ascending: false,
    });
    expect(result.map((w) => w.externalId)).toEqual(["hc-run-1", "hc-walk-1"]);
  });

  it("renvoie une liste vide sans séance", async () => {
    await expect(fetchRecentWatchWorkouts(makeClient())).resolves.toEqual([]);
  });
});
