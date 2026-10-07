import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateLoopWaypoints,
  getDifficultyFromDistance,
  computeQuestXp,
  generateRandomQuest,
} from "./questGenerator";

describe("questGenerator service", () => {
  const PARIS_COORDS: [number, number] = [2.3522, 48.8566];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("generateLoopWaypoints", () => {
    it("should generate a loop starting and ending at the exact same location", () => {
      const waypoints = generateLoopWaypoints(PARIS_COORDS, 4);

      expect(waypoints.length).toBeGreaterThanOrEqual(4);
      expect(waypoints[0]).toEqual(PARIS_COORDS);
      expect(waypoints[waypoints.length - 1]).toEqual(PARIS_COORDS);
    });

    it("should generate distinct intermediate waypoints with valid coordinates", () => {
      const waypoints = generateLoopWaypoints(PARIS_COORDS, 5);

      for (let i = 1; i < waypoints.length - 1; i++) {
        expect(waypoints[i][0]).toBeTypeOf("number");
        expect(waypoints[i][1]).toBeTypeOf("number");
        expect(Number.isFinite(waypoints[i][0])).toBe(true);
        expect(Number.isFinite(waypoints[i][1])).toBe(true);
      }
    });
  });

  describe("getDifficultyFromDistance", () => {
    it("should classify difficulty based on distance correctly", () => {
      expect(getDifficultyFromDistance(1.8)).toBe("easy");
      expect(getDifficultyFromDistance(4.2)).toBe("medium");
      expect(getDifficultyFromDistance(7.5)).toBe("hard");
      expect(getDifficultyFromDistance(12)).toBe("epic");
    });
  });

  describe("computeQuestXp", () => {
    it("should reward more XP for loops, higher distance, and elevation gain", () => {
      const xpEasy = computeQuestXp(2, 10, "linear");
      const xpLoopWithElev = computeQuestXp(5, 80, "loop");

      expect(xpLoopWithElev).toBeGreaterThan(xpEasy);
      expect(xpEasy).toBeGreaterThanOrEqual(80);
    });
  });

  describe("generateRandomQuest", () => {
    it("should generate a valid quest object even in offline fallback mode", async () => {
      // Mock fetch to simulate offline fallback
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("Offline"));

      const quest = await generateRandomQuest({
        userLocation: PARIS_COORDS,
        preferredType: "loop",
        targetDistanceKm: 3,
      });

      expect(quest.id).toBeDefined();
      expect(quest.title).toBeTruthy();
      expect(quest.description).toBeTruthy();
      expect(quest.type).toBe("loop");
      expect(quest.origin).toEqual(PARIS_COORDS);
      expect(quest.waypoints.length).toBeGreaterThan(2);
      expect(quest.route).toBeDefined();
      expect(quest.xpReward).toBeGreaterThan(50);
    });

    it("should generate a POI quest with diverse natural or rural features", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("Offline"));

      const quest = await generateRandomQuest({
        userLocation: PARIS_COORDS,
        preferredType: "poi",
        targetDistanceKm: 2,
      });

      expect(quest.type).toBe("poi");
      expect(quest.targetPoiName).toBeDefined();
      expect(quest.title).toContain("Cap sur :");
      expect(quest.description).toBeTruthy();
    });

    it("should extract rural POIs (bois, mairie, église) directly from mapbox features", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("Offline"));

      const mockMap = {
        queryRenderedFeatures: vi.fn().mockReturnValue([
          {
            properties: { name: "Bois du Quesnoy", class: "wood" },
            geometry: { type: "Point", coordinates: [2.36, 48.86] },
            layer: { id: "natural-point-label" },
          },
          {
            properties: { name: "Mairie de Cuignières" },
            geometry: { type: "Point", coordinates: [2.355, 48.858] },
            layer: { id: "poi-label" },
          },
          {
            properties: { name: "Église Saint-Martin" },
            geometry: { type: "Point", coordinates: [2.358, 48.857] },
            layer: { id: "poi-label" },
          },
        ]),
      } as any;

      const quest = await generateRandomQuest({
        userLocation: PARIS_COORDS,
        preferredType: "poi",
        targetDistanceKm: 2,
        mapInstance: mockMap,
      });

      expect(quest.type).toBe("poi");
      expect(
        ["Bois du Quesnoy", "Mairie de Cuignières", "Église Saint-Martin"].includes(
          quest.targetPoiName || "",
        ),
      ).toBe(true);
      expect(quest.title).toMatch(/Cap sur : (Bois du Quesnoy|Mairie de Cuignières|Église Saint-Martin)/);
    });
  });
});

