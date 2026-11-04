import { describe, expect, it } from "vitest";
import type { GeneratedQuest } from "./questGenerator";
import type { LngLat } from "./geo";
import {
  advanceQuestRun,
  createQuestRun,
  getQuestCheckpoints,
  getQuestTimeLimitSeconds,
  type PositionFix,
} from "./questProgress";

// ~111 m par 0,001 degré de latitude
const START: LngLat = [2.3, 49];
const FAR: LngLat = [2.3, 49.002];
const FARTHER: LngLat = [2.3, 49.004];

function fix(coords: LngLat, accuracy = 5): PositionFix {
  return { coords, accuracy };
}

function buildQuest(
  type: GeneratedQuest["type"],
  waypoints: LngLat[],
  coordinates: LngLat[],
  durationMinutes = 2,
): GeneratedQuest {
  return {
    id: "quest-test",
    title: "Quête de test",
    description: "",
    type,
    difficulty: "easy",
    xpReward: 100,
    origin: waypoints[0],
    destination: waypoints[waypoints.length - 1],
    waypoints,
    route: {
      coordinates,
      distanceKm: 0.4,
      durationMinutes,
      elevationGain: 0,
      elevationLoss: 0,
      source: "mapbox",
    },
    createdAt: 0,
  };
}

const linearQuest = buildQuest("linear", [START, FAR], [START, FAR]);

// Boucle : départ -> aller -> retour au départ
const loopQuest = buildQuest(
  "loop",
  [START, FAR, START],
  [START, FARTHER, FAR, START],
);

describe("getQuestTimeLimitSeconds", () => {
  it("applique le facteur de marge au temps estimé", () => {
    expect(
      getQuestTimeLimitSeconds(
        buildQuest("linear", [START, FAR], [START, FAR], 10),
      ),
    ).toBe(900);
  });

  it("garantit un temps minimum de 5 minutes", () => {
    expect(
      getQuestTimeLimitSeconds(
        buildQuest("linear", [START, FAR], [START, FAR], 2),
      ),
    ).toBe(300);
  });
});

describe("getQuestCheckpoints", () => {
  it("n'a qu'un point (l'arrivée) pour un trajet simple", () => {
    expect(getQuestCheckpoints(linearQuest)).toEqual([FAR]);
  });

  it("termine une boucle par la fin du tracé, pas par le départ de la quête", () => {
    const checkpoints = getQuestCheckpoints(loopQuest);

    expect(checkpoints).toHaveLength(2);
    expect(checkpoints[checkpoints.length - 1]).toEqual(START);
  });
});

describe("advanceQuestRun", () => {
  it("valide un trajet simple en arrivant à temps", () => {
    const state = createQuestRun(linearQuest);
    const next = advanceQuestRun(state, linearQuest, fix(FAR), 120);

    expect(next.status).toBe("success");
    expect(next.remainingMeters).toBe(0);
  });

  it("reste en cours tant que le point n'est pas atteint", () => {
    const state = createQuestRun(linearQuest);
    const next = advanceQuestRun(state, linearQuest, fix([2.3, 49.001]), 60);

    expect(next.status).toBe("running");
    expect(next.remainingMeters).toBeGreaterThan(100);
  });

  it("échoue quand le temps est écoulé", () => {
    const state = createQuestRun(linearQuest);
    const next = advanceQuestRun(state, linearQuest, null, 301);

    expect(next.status).toBe("failed");
    expect(next.remainingSeconds).toBe(0);
  });

  it("donne la victoire si l'arrivée est atteinte au dernier moment", () => {
    const state = createQuestRun(linearQuest);
    const next = advanceQuestRun(state, linearQuest, fix(FAR), 301);

    expect(next.status).toBe("success");
  });

  it("ignore les positions trop imprécises", () => {
    const state = createQuestRun(linearQuest);
    const next = advanceQuestRun(state, linearQuest, fix(FAR, 200), 60);

    expect(next.status).toBe("running");
    expect(next.checkpointIndex).toBe(0);
  });

  it("ne valide pas une boucle simplement parce qu'on est au départ", () => {
    const state = createQuestRun(loopQuest);
    const next = advanceQuestRun(state, loopQuest, fix(START), 10);

    expect(next.status).toBe("running");
    expect(next.checkpointIndex).toBe(0);
  });

  it("valide une boucle en passant par les points dans l'ordre", () => {
    let state = createQuestRun(loopQuest);

    state = advanceQuestRun(state, loopQuest, fix(FAR), 60);
    expect(state.status).toBe("running");
    expect(state.checkpointIndex).toBe(1);

    state = advanceQuestRun(state, loopQuest, fix(START), 120);
    expect(state.status).toBe("success");
  });

  it("ne change plus rien une fois la quête terminée", () => {
    const finished = advanceQuestRun(
      createQuestRun(linearQuest),
      linearQuest,
      fix(FAR),
      60,
    );

    expect(advanceQuestRun(finished, linearQuest, null, 999)).toBe(finished);
  });
});
