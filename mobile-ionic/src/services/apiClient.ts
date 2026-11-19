import type { ActivityRecording } from "../data/activityRecording";

/** Séance importée depuis le magasin santé du téléphone (sert au dédoublonnage côté API). */
export interface ExternalActivityRef {
  source: "health-connect" | "apple-health";
  id: string;
  /** Montre d'origine si connue (ex. « Garmin Forerunner 255 »). */
  deviceName?: string;
}

/** Erreur HTTP renvoyée par l'API (le statut permet de distinguer rejet et panne). */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** L'activité a déjà été importée : l'API l'a refusée sans recréditer d'XP (HTTP 409). */
export class ActivityAlreadyImportedError extends ApiError {
  constructor(readonly activityId: string | undefined) {
    super("Activity already imported", 409);
    this.name = "ActivityAlreadyImportedError";
  }
}

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
  /** Renseigné pour une séance importée depuis une montre. */
  external?: ExternalActivityRef;
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

export type CoachGoal =
  "casual" | "active" | "5k" | "10k" | "half-marathon" | "marathon";

export interface CoachSettingsDto {
  coachEnabled: boolean;
  coachGoal: CoachGoal;
}

export interface CoachWeeklySummaryDto {
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  activityCount: number;
  elevationGainMeters: number;
}

export interface CoachWeeklyReportDto {
  id: string;
  playerId: string;
  year: number;
  weekNumber: number;
  summary: CoachWeeklySummaryDto;
  reportText: string;
  createdAt: string;
}

export interface CoachMessageDto {
  id: string;
  playerId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

/**
 * Profil du joueur connecté (renvoyé uniquement à son propriétaire).
 */
export interface PlayerProfileDto {
  id: string;
  username: string;
  email: string;
  level: number;
  experience: number;
  coachEnabled?: boolean;
  coachGoal?: CoachGoal;
  createdAt: string;
  /** Le compte a un mot de passe (sinon : créé via Google). */
  hasPassword: boolean;
  /** Un compte Google est rattaché. */
  googleLinked: boolean;
}

/** Session ouverte par l'inscription ou la connexion. */
export interface AuthSession {
  /** Jeton de session signé par l'API, à envoyer en `Authorization: Bearer`. */
  token: string;
  player: PlayerProfileDto;
}

export interface RegisterDto {
  email: string;
  password: string;
  username: string;
}

/**
 * Données d'une activité retournée par l'API REST.
 */
export interface ActivityDto {
  id: string;
  playerId: string;
  activityType: "walk" | "run" | "bike" | "hike";
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  distanceMeters: number;
  elevationGainMeters: number;
  coordinates: [longitude: number, latitude: number][];
  recording?: ActivityRecording;
  external?: ExternalActivityRef;
  createdAt: string;
}

/** Activité sans tracé ni enregistrement brut, pour les statistiques par période. */
export type ActivitySummaryDto = Omit<ActivityDto, "coordinates" | "recording">;

/** Profil public d'un autre joueur (jamais d'e-mail). */
export interface PublicPlayerDto {
  id: string;
  username: string;
  level: number;
  experience: number;
  createdAt: string;
}

/** Joueur trouvé par la recherche : on sait si on le suit déjà. */
export interface SearchedPlayerDto extends PublicPlayerDto {
  following: boolean;
}

/** Joueur suggéré : actif dans ma zone principale ou dans celle de ma dernière sortie. */
export interface SuggestedPlayerDto extends PublicPlayerDto {
  reason: "main-zone" | "last-zone";
  /** Nombre de ses sorties commencées dans la zone. */
  activityCount: number;
}

/** Sortie d'un ami (sans tracé GPS). */
export interface FriendActivityDto {
  id: string;
  player: PublicPlayerDto;
  activityType: "walk" | "run" | "bike" | "hike";
  startedAt: string;
  durationSeconds: number;
  distanceMeters: number;
  elevationGainMeters: number;
}

/** Ligne du classement de la guilde (moi + les joueurs que je suis). */
export interface LeaderboardEntryDto extends PublicPlayerDto {
  distanceMeters: number;
  activityCount: number;
  /** 1 = premier ; à distance égale, même rang. */
  rank: number;
  isMe: boolean;
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
 * Le jeton de session est fourni par `AuthProvider` via `setAuthToken`.
 */
export class ApiClient {
  private readonly baseUrl: string;
  private authToken?: string;
  private unauthorizedHandler?: () => void;

  constructor(baseUrl?: string) {
    this.baseUrl =
      baseUrl ||
      (typeof import.meta !== "undefined" &&
        import.meta.env?.VITE_API_BASE_URL) ||
      "http://localhost:3000";
  }

  /** Définit (ou efface) le jeton envoyé avec chaque requête authentifiée. */
  setAuthToken(token?: string): void {
    this.authToken = token;
  }

  /** Appelé quand l'API rejette la session (401) : expirée, révoquée ou compte supprimé. */
  onUnauthorized(handler?: () => void): void {
    this.unauthorizedHandler = handler;
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

  /** Crée un compte e-mail + mot de passe et ouvre une session. */
  register(data: RegisterDto): Promise<AuthSession> {
    return this.authRequest("/api/auth/register", data);
  }

  /** Ouvre une session avec e-mail + mot de passe. */
  login(email: string, password: string): Promise<AuthSession> {
    return this.authRequest("/api/auth/login", { email, password });
  }

  /** Échange l'ID token Auth0 (connexion Google) contre une session Stride Quest. */
  loginWithGoogle(idToken: string): Promise<AuthSession> {
    return this.authRequest("/api/auth/google", { idToken });
  }

  /**
   * Récupère le profil du joueur connecté.
   */
  async getCurrentPlayer(): Promise<PlayerProfileDto> {
    const res = await this.authorizedFetch("/api/players/me", {
      method: "GET",
    });
    return res.json();
  }

  /**
   * Enregistre une activité terminée pour le joueur connecté.
   */
  async saveActivity(data: SaveActivityDto): Promise<ActivitySaveResult> {
    const res = await this.authorizedFetch("/api/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json();
  }

  /**
   * Récupère la liste des activités récentes du joueur connecté.
   */
  async getPlayerActivities(): Promise<ActivityDto[]> {
    const res = await this.authorizedFetch("/api/activities/me", {
      method: "GET",
    });
    const data = (await res.json()) as { activities?: ActivityDto[] };
    return data.activities || [];
  }

  /**
   * Résumés des activités du joueur connecté commencées dans [from, to[.
   * Les bornes sont calculées par l'appli, dans le fuseau horaire du téléphone.
   */
  async getActivitySummaries(
    from: Date,
    to: Date,
  ): Promise<ActivitySummaryDto[]> {
    const query = new URLSearchParams({
      from: from.toISOString(),
      to: to.toISOString(),
    });
    const res = await this.authorizedFetch(
      `/api/activities/me/summary?${query.toString()}`,
      { method: "GET" },
    );
    const data = (await res.json()) as { activities?: ActivitySummaryDto[] };
    return data.activities || [];
  }

  /**
   * Récupère les paramètres du Maître de Guilde (activation et objectif).
   */
  async getCoachSettings(): Promise<CoachSettingsDto> {
    const res = await this.authorizedFetch("/api/coach/settings", {
      method: "GET",
    });
    return res.json();
  }

  /**
   * Met à jour les paramètres du Maître de Guilde.
   */
  async updateCoachSettings(
    settings: Partial<CoachSettingsDto>,
  ): Promise<CoachSettingsDto> {
    const res = await this.authorizedFetch("/api/coach/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    return res.json();
  }

  /**
   * Récupère le bilan hebdomadaire actuel généré par le Maître de Guilde.
   */
  async getCoachWeeklyReport(): Promise<{
    report: CoachWeeklyReportDto | null;
    enabled: boolean;
  }> {
    const res = await this.authorizedFetch("/api/coach/weekly-report", {
      method: "GET",
    });
    return res.json();
  }

  /**
   * Récupère l'historique récent des messages échangés avec le Maître de Guilde.
   */
  async getCoachMessages(): Promise<CoachMessageDto[]> {
    const res = await this.authorizedFetch("/api/coach/messages", {
      method: "GET",
    });
    const data = (await res.json()) as { messages?: CoachMessageDto[] };
    return data.messages || [];
  }

  /**
   * Envoie un message au Maître de Guilde et reçoit sa réponse en direct.
   */
  async sendCoachMessage(message: string): Promise<CoachMessageDto> {
    const res = await this.authorizedFetch("/api/coach/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const data = (await res.json()) as { message: CoachMessageDto };
    return data.message;
  }

  /**
   * Envoie un message au Maître de Guilde et reçoit sa réponse en streaming SSE.
   * Déclenche `onChunk` au fur et à mesure que les tokens sont générés.
   */
  async streamCoachMessage(
    message: string,
    onChunk: (delta: string) => void,
  ): Promise<CoachMessageDto> {
    let res: Response;
    try {
      res = await this.authorizedFetch("/api/coach/messages/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
    } catch {
      // Repli transparent sur la route synchrone si le streaming échoue au niveau réseau
      const fallback = await this.sendCoachMessage(message);
      onChunk(fallback.content);
      return fallback;
    }

    if (!res.ok) {
      // Repli transparent si la route stream renvoie une erreur ou n'est pas encore rechargée
      const fallback = await this.sendCoachMessage(message);
      onChunk(fallback.content);
      return fallback;
    }

    if (!res.body) {
      throw new Error("Flux de streaming non supporté par le client.");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalMessage: CoachMessageDto | null = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const evt of events) {
          const trimmed = evt.trim();
          if (!trimmed.startsWith("data:")) continue;
          const jsonStr = trimmed.slice(5).trim();
          if (!jsonStr) continue;

          try {
            const data = JSON.parse(jsonStr) as
              | { type: "chunk"; delta: string }
              | { type: "done"; message: CoachMessageDto }
              | { type: "error"; error: string };

            if (data.type === "chunk" && data.delta) {
              onChunk(data.delta);
            } else if (data.type === "done" && data.message) {
              finalMessage = data.message;
            } else if (data.type === "error") {
              throw new Error(data.error);
            }
          } catch (e) {
            if (e instanceof Error && e.message !== jsonStr) {
              throw e;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    if (!finalMessage) {
      throw new Error("Le Maître de Guilde n'a pas pu terminer sa réponse.");
    }

    return finalMessage;
  }

  /**
   * Joueurs inscrits (sauf moi) dont le pseudo contient `query` ; tous si vide.
   * L'API en renvoie 20 par défaut, 50 au plus.
   */
  async searchPlayers(
    query = "",
    limit?: number,
  ): Promise<SearchedPlayerDto[]> {
    const params = new URLSearchParams({ q: query.trim() });
    if (limit !== undefined) params.set("limit", String(limit));
    const res = await this.authorizedFetch(`/api/players?${params}`, {
      method: "GET",
    });
    const data = (await res.json()) as { players?: SearchedPlayerDto[] };
    return data.players || [];
  }

  /** Joueurs que je suis. */
  async getFriends(): Promise<PublicPlayerDto[]> {
    const res = await this.authorizedFetch("/api/friends", { method: "GET" });
    const data = (await res.json()) as { friends?: PublicPlayerDto[] };
    return data.friends || [];
  }

  /** Jusqu'à 10 joueurs actifs là où je cours. */
  async getFriendSuggestions(): Promise<SuggestedPlayerDto[]> {
    const res = await this.authorizedFetch("/api/friends/suggestions", {
      method: "GET",
    });
    const data = (await res.json()) as { suggestions?: SuggestedPlayerDto[] };
    return data.suggestions || [];
  }

  /** Classement par distance entre moi et mes amis, sorties commencées dans [from, to[. */
  async getFriendsLeaderboard(
    from: Date,
    to: Date,
  ): Promise<LeaderboardEntryDto[]> {
    const params = new URLSearchParams({
      from: from.toISOString(),
      to: to.toISOString(),
    });
    const res = await this.authorizedFetch(
      `/api/friends/leaderboard?${params}`,
      { method: "GET" },
    );
    const data = (await res.json()) as { leaderboard?: LeaderboardEntryDto[] };
    return data.leaderboard || [];
  }

  /** Sorties des joueurs que je suis, la plus récente en premier (20 par défaut, 50 au plus). */
  async getFriendsActivities(limit?: number): Promise<FriendActivityDto[]> {
    const params = new URLSearchParams();
    if (limit !== undefined) params.set("limit", String(limit));
    const query = params.toString();
    const res = await this.authorizedFetch(
      `/api/friends/activities${query ? `?${query}` : ""}`,
      { method: "GET" },
    );
    const data = (await res.json()) as { activities?: FriendActivityDto[] };
    return data.activities || [];
  }

  async followPlayer(playerId: string): Promise<void> {
    await this.authorizedFetch(`/api/friends/${encodeURIComponent(playerId)}`, {
      method: "PUT",
    });
  }

  async unfollowPlayer(playerId: string): Promise<void> {
    await this.authorizedFetch(`/api/friends/${encodeURIComponent(playerId)}`, {
      method: "DELETE",
    });
  }

  private async authRequest(path: string, body: unknown): Promise<AuthSession> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw await this.toError(res);
    return res.json();
  }

  private async authorizedFetch(
    path: string,
    init: RequestInit & { headers?: Record<string, string> },
  ): Promise<Response> {
    const headers: Record<string, string> = { ...init.headers };
    if (this.authToken) headers.Authorization = `Bearer ${this.authToken}`;

    const res = await fetch(`${this.baseUrl}${path}`, { ...init, headers });
    if (res.ok) return res;

    if (res.status === 401) this.unauthorizedHandler?.();
    throw await this.toError(res);
  }

  private async toError(res: Response): Promise<ApiError> {
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      activityId?: string;
    };
    if (res.status === 409 && body.activityId !== undefined) {
      return new ActivityAlreadyImportedError(body.activityId);
    }
    return new ApiError(
      body.error || `Erreur du serveur (${res.status})`,
      res.status,
    );
  }
}

export const apiClient = new ApiClient();
