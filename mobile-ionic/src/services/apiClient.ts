export interface SaveActivityDto {
  activityType: "walk" | "run" | "bike" | "hike";
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  distanceMeters: number;
  elevationGainMeters?: number;
  coordinates?: [longitude: number, latitude: number][];
}

export interface ActivitySaveResult {
  activityId: string;
  xpEarned: number;
  newLevel: number;
  previousLevel: number;
  levelUp: boolean;
  totalExperience: number;
  distanceMeters: number;
  durationSeconds: number;
}

export interface PlayerProfileDto {
  id: string;
  username: string;
  level: number;
  experience: number;
  createdAt: string;
}

export interface HealthCheckResponse {
  status: string;
  service: string;
  timestamp: string;
}

export class ApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl =
      baseUrl ||
      (typeof import.meta !== "undefined" &&
        import.meta.env?.VITE_API_BASE_URL) ||
      "http://localhost:3000";
  }

  async checkHealth(): Promise<HealthCheckResponse> {
    const res = await fetch(`${this.baseUrl}/health`, {
      method: "GET",
    });
    if (!res.ok) {
      throw new Error(`API health check failed with status ${res.status}`);
    }
    return res.json();
  }

  async getCurrentPlayer(
    playerId = "player-default-001",
  ): Promise<PlayerProfileDto> {
    const res = await fetch(`${this.baseUrl}/api/players/me`, {
      method: "GET",
      headers: {
        "x-player-id": playerId,
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err.error || `Failed to fetch player profile (${res.status})`,
      );
    }
    return res.json();
  }

  async saveActivity(
    data: SaveActivityDto,
    playerId = "player-default-001",
  ): Promise<ActivitySaveResult> {
    const res = await fetch(`${this.baseUrl}/api/activities`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-player-id": playerId,
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to save activity (${res.status})`);
    }

    return res.json();
  }

  async getPlayerActivities(
    playerId = "player-default-001",
  ): Promise<unknown[]> {
    const res = await fetch(`${this.baseUrl}/api/activities/me`, {
      method: "GET",
      headers: {
        "x-player-id": playerId,
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch activities (${res.status})`);
    }
    const data = await res.json();
    return data.activities || [];
  }
}

export const apiClient = new ApiClient();
