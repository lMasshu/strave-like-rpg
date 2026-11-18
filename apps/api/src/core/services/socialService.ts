import type { PublicPlayer } from '../entities/player.js';
import type { IPlayerRepository } from '../ports/playerRepository.js';
import type {
  FriendActivity,
  ISocialRepository,
  PlayerDistance,
} from '../ports/socialRepository.js';
import {
  homeZones,
  rankSuggestions,
  type RankedSuggestion,
  ZONE_RADIUS_METERS,
} from './homeZone.js';

export class CannotFollowSelfError extends Error {
  constructor() {
    super('Impossible de se suivre soi-même');
    this.name = 'CannotFollowSelfError';
  }
}

export class PlayerNotFoundError extends Error {
  constructor() {
    super('Joueur introuvable');
    this.name = 'PlayerNotFoundError';
  }
}

/** Joueur vu dans la recherche : on sait si on le suit déjà. */
export interface SearchedPlayer extends PublicPlayer {
  following: boolean;
}

/** Résultats renvoyés par défaut et au maximum par la recherche. */
export const SEARCH_DEFAULT_LIMIT = 20;
export const SEARCH_MAX_LIMIT = 50;
export const SUGGESTION_LIMIT = 10;
/** Sorties d'amis renvoyées par défaut et au maximum. */
export const FEED_DEFAULT_LIMIT = 20;
export const FEED_MAX_LIMIT = 50;

/** Ligne du classement de la guilde (moi + mes amis). */
export interface LeaderboardEntry extends PlayerDistance {
  /** 1 = premier ; à distance égale, même rang. */
  rank: number;
  isMe: boolean;
}
/** Sorties GPS prises en compte pour déterminer mes zones. */
const STARTS_LIMIT = 200;

export class SocialService {
  constructor(
    private readonly social: ISocialRepository,
    private readonly players: IPlayerRepository,
  ) {}

  async follow(playerId: string, targetId: string): Promise<void> {
    if (playerId === targetId) throw new CannotFollowSelfError();
    if (!(await this.players.findById(targetId))) throw new PlayerNotFoundError();
    await this.social.follow(playerId, targetId);
  }

  async unfollow(playerId: string, targetId: string): Promise<void> {
    await this.social.unfollow(playerId, targetId);
  }

  async friends(playerId: string): Promise<PublicPlayer[]> {
    return this.social.listFollowing(playerId);
  }

  /** Joueurs inscrits (sauf moi), filtrés par pseudo, `limit` au plus (borné à {@link SEARCH_MAX_LIMIT}). */
  async search(
    playerId: string,
    query: string,
    limit = SEARCH_DEFAULT_LIMIT,
  ): Promise<SearchedPlayer[]> {
    const capped = Math.min(Math.max(1, Math.trunc(limit)), SEARCH_MAX_LIMIT);
    const [found, following] = await Promise.all([
      this.social.searchPlayers(query.trim(), playerId, capped),
      this.social.listFollowing(playerId),
    ]);
    const followed = new Set(following.map((p) => p.id));
    return found.map((player) => ({ ...player, following: followed.has(player.id) }));
  }

  /** Fil des sorties de mes amis, la plus récente en premier. */
  async friendsFeed(playerId: string, limit = FEED_DEFAULT_LIMIT): Promise<FriendActivity[]> {
    const capped = Math.min(Math.max(1, Math.trunc(limit)), FEED_MAX_LIMIT);
    return this.social.friendsActivities(playerId, capped);
  }

  /** Classement par distance sur [from, to[ entre moi et les joueurs que je suis. */
  async leaderboard(playerId: string, from: Date, to: Date): Promise<LeaderboardEntry[]> {
    const rows = await this.social.friendsDistanceBetween(playerId, from, to);
    const sorted = [...rows].sort(
      (a, b) =>
        b.distanceMeters - a.distanceMeters ||
        a.player.username.toLowerCase().localeCompare(b.player.username.toLowerCase()),
    );
    let rank = 0;
    return sorted.map((row, index) => {
      if (index === 0 || row.distanceMeters < sorted[index - 1].distanceMeters) rank = index + 1;
      return { ...row, rank, isMe: row.player.id === playerId };
    });
  }

  /**
   * Jusqu'à 10 joueurs ayant couru là où j'ai fait la majorité de mes sorties,
   * plus quelques-uns de la zone de ma dernière sortie. Ni moi, ni les joueurs déjà suivis.
   */
  async suggestions(playerId: string): Promise<RankedSuggestion[]> {
    const zones = homeZones(await this.social.activityStarts(playerId, STARTS_LIMIT));
    if (!zones) return [];

    const following = await this.social.listFollowing(playerId);
    const excluded = [playerId, ...following.map((p) => p.id)];
    const [main, last] = await Promise.all([
      this.social.playersActiveNear(zones.main, ZONE_RADIUS_METERS, excluded, SUGGESTION_LIMIT),
      zones.last
        ? this.social.playersActiveNear(zones.last, ZONE_RADIUS_METERS, excluded, SUGGESTION_LIMIT)
        : Promise.resolve([]),
    ]);
    return rankSuggestions(main, last, SUGGESTION_LIMIT);
  }
}
