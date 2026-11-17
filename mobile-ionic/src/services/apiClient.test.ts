import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActivityAlreadyImportedError, ApiClient, ApiError } from "./apiClient";

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

const PLAYER = {
  id: "11111111-1111-4111-8111-111111111111",
  username: "Lucas_Run",
  email: "lucas@example.com",
  level: 3,
  experience: 2500,
  createdAt: "2026-11-01T08:00:00Z",
  hasPassword: true,
  googleLinked: false,
};

const RUN = {
  activityType: "run" as const,
  startedAt: "2026-11-07T10:00:00Z",
  endedAt: "2026-11-07T10:30:00Z",
  durationSeconds: 1800,
  distanceMeters: 5000,
  coordinates: [] as [number, number][],
};

describe("ApiClient", () => {
  let client: ApiClient;
  const originalFetch = global.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new ApiClient("http://test-api:3000");
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("checks server health", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { status: "ok", service: "stride-quest-api" }),
    );

    const health = await client.checkHealth();
    expect(health.status).toBe("ok");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://test-api:3000/health",
      expect.objectContaining({ method: "GET" }),
    );
  });

  describe("authentification", () => {
    it("inscrit un joueur et renvoie la session", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(201, { token: "jwt", player: PLAYER }),
      );

      const session = await client.register({
        email: "lucas@example.com",
        password: "mot-de-passe",
        username: "Lucas_Run",
      });

      expect(session).toEqual({ token: "jwt", player: PLAYER });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("http://test-api:3000/api/auth/register");
      expect(JSON.parse(init.body)).toEqual({
        email: "lucas@example.com",
        password: "mot-de-passe",
        username: "Lucas_Run",
      });
    });

    it("connecte par e-mail et par Google", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(200, { token: "jwt", player: PLAYER }),
      );

      await client.login("lucas@example.com", "mot-de-passe");
      await client.loginWithGoogle("id-token-auth0");

      expect(fetchMock.mock.calls[0][0]).toBe(
        "http://test-api:3000/api/auth/login",
      );
      expect(fetchMock.mock.calls[1][0]).toBe(
        "http://test-api:3000/api/auth/google",
      );
      expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
        idToken: "id-token-auth0",
      });
    });

    it("transmet le message d'erreur de l'API (identifiants, doublon)", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(401, { error: "E-mail ou mot de passe incorrect" }),
      );
      await expect(client.login("a@b.c", "x")).rejects.toEqual(
        new ApiError("E-mail ou mot de passe incorrect", 401),
      );

      fetchMock.mockResolvedValue(
        jsonResponse(409, { error: "Un compte existe déjà avec cet e-mail" }),
      );
      await expect(
        client.register({ email: "a@b.c", password: "x", username: "abc" }),
      ).rejects.toMatchObject({
        status: 409,
        message: "Un compte existe déjà avec cet e-mail",
      });
    });

    it("n'appelle pas le gestionnaire de session expirée pour un login refusé", async () => {
      const onUnauthorized = vi.fn();
      client.onUnauthorized(onUnauthorized);
      fetchMock.mockResolvedValue(jsonResponse(401, { error: "non" }));

      await expect(client.login("a@b.c", "x")).rejects.toBeInstanceOf(ApiError);
      expect(onUnauthorized).not.toHaveBeenCalled();
    });
  });

  describe("requêtes authentifiées", () => {
    it("joint le jeton de session à chaque requête", async () => {
      client.setAuthToken("session-token");
      fetchMock.mockResolvedValue(jsonResponse(200, PLAYER));

      await client.getCurrentPlayer();

      expect(fetchMock).toHaveBeenCalledWith(
        "http://test-api:3000/api/players/me",
        expect.objectContaining({
          method: "GET",
          headers: { Authorization: "Bearer session-token" },
        }),
      );
    });

    it("n'envoie plus de jeton après la déconnexion", async () => {
      client.setAuthToken("session-token");
      client.setAuthToken(undefined);
      fetchMock.mockResolvedValue(jsonResponse(200, { activities: [] }));

      await client.getPlayerActivities();

      expect(fetchMock.mock.calls[0][1].headers).toEqual({});
    });

    it("signale une session expirée (401) puis lève l'erreur", async () => {
      const onUnauthorized = vi.fn();
      client.onUnauthorized(onUnauthorized);
      fetchMock.mockResolvedValue(
        jsonResponse(401, { error: "Authentification requise" }),
      );

      await expect(client.getPlayerActivities()).rejects.toMatchObject({
        status: 401,
      });
      expect(onUnauthorized).toHaveBeenCalledOnce();
    });
  });

  it("posts a completed activity to /api/activities and returns XP results", async () => {
    client.setAuthToken("session-token");
    fetchMock.mockResolvedValue(
      jsonResponse(201, {
        activityId: "act-123",
        xpEarned: 500,
        newLevel: 2,
        levelUp: true,
        totalExperience: 1320,
      }),
    );

    const result = await client.saveActivity({
      ...RUN,
      elevationGainMeters: 25,
    });

    expect(result.activityId).toBe("act-123");
    expect(result.xpEarned).toBe(500);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://test-api:3000/api/activities",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer session-token",
        },
      }),
    );
  });

  it("throws a descriptive error when server returns an anti-cheat rejection", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, {
        error: "Excessive speed: 85 km/h exceeds maximum limit",
      }),
    );

    await expect(client.saveActivity(RUN)).rejects.toThrow(/Excessive speed/);
  });

  it("distingue une séance de montre déjà importée (409)", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(409, {
        error: "Activity already imported",
        activityId: "act-1",
      }),
    );

    await expect(client.saveActivity(RUN)).rejects.toEqual(
      new ActivityAlreadyImportedError("act-1"),
    );
  });

  it("fetches player activities from /api/activities/me", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        activities: [{ id: "act-1", distanceMeters: 5200 }],
      }),
    );

    const activities = await client.getPlayerActivities();

    expect(activities).toHaveLength(1);
    expect(activities[0].distanceMeters).toBe(5200);
  });
});
