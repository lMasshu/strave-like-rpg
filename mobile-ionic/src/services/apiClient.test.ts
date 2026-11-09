import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClient } from "./apiClient";

describe("ApiClient", () => {
  let client: ApiClient;
  const originalFetch = global.fetch;

  beforeEach(() => {
    client = new ApiClient("http://test-api:3000");
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("checks server health", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "ok", service: "stride-quest-api" }),
    });

    const health = await client.checkHealth();
    expect(health.status).toBe("ok");
    expect(global.fetch).toHaveBeenCalledWith(
      "http://test-api:3000/health",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("posts a completed activity to /api/activities and returns XP results", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        activityId: "act-123",
        xpEarned: 500,
        newLevel: 2,
        levelUp: true,
        totalExperience: 1320,
      }),
    });

    const result = await client.saveActivity({
      activityType: "run",
      startedAt: "2026-11-07T10:00:00Z",
      endedAt: "2026-11-07T10:30:00Z",
      durationSeconds: 1800,
      distanceMeters: 5000,
      elevationGainMeters: 25,
      coordinates: [[2.35, 48.85]],
    });

    expect(result.activityId).toBe("act-123");
    expect(result.xpEarned).toBe(500);
    expect(result.levelUp).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      "http://test-api:3000/api/activities",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("throws a descriptive error when server returns an anti-cheat rejection", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: "Excessive speed: 85 km/h exceeds maximum limit",
      }),
    });

    await expect(
      client.saveActivity({
        activityType: "run",
        startedAt: "2026-11-07T10:00:00Z",
        endedAt: "2026-11-07T10:01:00Z",
        durationSeconds: 60,
        distanceMeters: 10000,
        coordinates: [],
      }),
    ).rejects.toThrow(/Excessive speed/);
  });
});
