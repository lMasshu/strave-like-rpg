import type { ActivityType } from '../entities/activity.js';
import type { PublicPlayer } from '../entities/player.js';

/** Point de départ d'une sortie (seules les sorties avec tracé GPS en ont un). */
export interface ActivityStart {
  longitude: number;
  latitude: number;
  startedAt: Date;
}

/** Joueur ayant commencé au moins une sortie dans une zone donnée. */
export interface NearbyPlayer {
  player: PublicPlayer;
  /** Nombre de ses sorties commencées dans la zone. */
  activityCount: number;
}

/** Distance cumulée d'un joueur sur une période. */
export interface PlayerDistance {
  player: PublicPlayer;
  distanceMeters: number;
  activityCount: number;
}

/** Sortie d'un ami, sans tracé GPS (donnée personnelle réservée à son propriétaire). */
export interface FriendActivity {
  id: string;
  player: PublicPlayer;
  activityType: ActivityType;
  startedAt: Date;
  durationSeconds: number;
  distanceMeters: number;
  elevationGainMeters: number;
}

export interface ISocialRepository {
  /** Suit un joueur ; sans effet s'il est déjà suivi. */
  follow(followerId: string, followedId: string): Promise<void>;
  /** Ne suit plus un joueur ; sans effet s'il n'était pas suivi. */
  unfollow(followerId: string, followedId: string): Promise<void>;
  /** Joueurs suivis, par pseudo. */
  listFollowing(playerId: string): Promise<PublicPlayer[]>;
  /** Joueurs inscrits dont le pseudo contient `query` (casse ignorée), par pseudo ; tous si `query` est vide. */
  searchPlayers(query: string, excludeId: string, limit: number): Promise<PublicPlayer[]>;
  /**
   * Distance des sorties commencées dans [from, to[ pour le joueur et ceux qu'il suit
   * (0 pour qui n'a pas couru). Ordre quelconque.
   */
  friendsDistanceBetween(playerId: string, from: Date, to: Date): Promise<PlayerDistance[]>;
  /** Sorties des joueurs suivis, la plus récente (date de départ) en premier. */
  friendsActivities(playerId: string, limit: number): Promise<FriendActivity[]>;
  /** Points de départ des sorties GPS du joueur, la plus récente en premier. */
  activityStarts(playerId: string, limit: number): Promise<ActivityStart[]>;
  /**
   * Joueurs ayant commencé une sortie à moins de `radiusMeters` du centre,
   * les plus actifs dans la zone en premier.
   */
  playersActiveNear(
    center: { longitude: number; latitude: number },
    radiusMeters: number,
    excludeIds: string[],
    limit: number,
  ): Promise<NearbyPlayer[]>;
}
