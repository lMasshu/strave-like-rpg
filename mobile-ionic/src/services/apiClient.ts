import type { ActivityRecording } from "../data/activityRecording";

/**
 * Données d'une course à soumettre pour enregistrement.
 */
export interface SaveActivityDto {
  /** Type d'activité physique */
  activityType: "walk" | "run" | "bike" | "hike";
  /** Horodatage ISO de début */
  startedAt: string;
  /** Horodatage ISO de fin */
  endedAt: string;
  /** Durée active de l'entraînement en secondes */
  durationSeconds: number;
  /** Distance cumulée en mètres */
  distanceMeters: number;
  /** Dénivelé positif cumulé en mètres */
  elevationGainMeters?: number;
  /** Liste ordonnée des coordonnées géographiques GPS du tracé */
  coordinates?: [longitude: number, latitude: number][];
  recording?: ActivityRecording;
}

/**
 * Résultat retourné par l'API lors de l'enregistrement réussi d'une sortie.
 */
export interface ActivitySaveResult {
  /** Identifiant unique de l'activité enregistrée */
  activityId: string;
  /** Points d'XP attribués pour cette sortie */
  xpEarned: number;
  /** Nouveau niveau du joueur */
  newLevel: number;
  /** Niveau précédent du joueur */
  previousLevel: number;
  /** Vrai si la course a déclenché une montée de niveau */
  levelUp: boolean;
  /** Expérience totale cumulée */
  totalExperience: number;
  /** Distance enregistrée */
  distanceMeters: number;
  /** Durée enregistrée */
  durationSeconds: number;
}

/**
 * Profil public ou authentifié du joueur.
 */
export interface PlayerProfileDto {
  id: string;
  username: string;
  level: number;
  experience: number;
  createdAt: string;
}

/**
 * Diagnostic de l'API REST.
 */
export interface HealthCheckResponse {
  status: string;
  service: string;
  timestamp: string;
}

/**
 * Client HTTP pour communiquer avec l'API REST Fastify de Stride Quest.
 */
export class ApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl =
      baseUrl ||
      (typeof import.meta !== "undefined" &&
        import.meta.env?.VITE_API_BASE_URL) ||
      "http://localhost:3000";
  }

  /**
   * Vérifie la connectivité et la santé du serveur backend.
   */
  async checkHealth(): Promise<HealthCheckResponse> {
    const res = await fetch(`${this.baseUrl}/health`, {
      method: "GET",
    });
    if (!res.ok) {
      throw new Error(`API health check failed with status ${res.status}`);
    }
    return res.json();
  }

  /**
   * Récupère le profil du joueur actuellement identifié.
   */
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

  /**
   * Enregistre une activité terminée auprès du serveur backend.
   */
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

  /**
   * Récupère la liste des activités récentes du joueur.
   */
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
