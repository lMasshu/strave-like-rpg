import { toPublicPlayer, type PublicPlayer } from '../../../core/entities/player.js';
import type {
  ActivityStart,
  FriendActivity,
  ISocialRepository,
  NearbyPlayer,
  PlayerDistance,
} from '../../../core/ports/socialRepository.js';
import { distanceMeters } from '../../../core/services/homeZone.js';
import type { InMemoryActivityRepository } from './inMemoryActivityRepo.js';
import type { InMemoryPlayerRepository } from './inMemoryPlayerRepo.js';

const byUsername = (a: PublicPlayer, b: PublicPlayer) =>
  a.username.toLowerCase().localeCompare(b.username.toLowerCase());

/** Dépôt social en mémoire (tests et développement sans PostgreSQL). */
export class InMemorySocialRepository implements ISocialRepository {
  /** follower → joueurs suivis */
  private readonly follows = new Map<string, Set<string>>();

  constructor(
    private readonly players: InMemoryPlayerRepository,
    private readonly activities: InMemoryActivityRepository,
  ) {}

  async follow(followerId: string, followedId: string): Promise<void> {
    if (followerId === followedId) return;
    const followed = this.follows.get(followerId) ?? new Set<string>();
    followed.add(followedId);
    this.follows.set(followerId, followed);
  }

  async unfollow(followerId: string, followedId: string): Promise<void> {
    this.follows.get(followerId)?.delete(followedId);
  }

  async listFollowing(playerId: string): Promise<PublicPlayer[]> {
    const followed = this.follows.get(playerId) ?? new Set<string>();
    return this.players
      .all()
      .filter((p) => followed.has(p.id))
      .map(toPublicPlayer)
      .sort(byUsername);
  }

  async searchPlayers(query: string, excludeId: string, limit: number): Promise<PublicPlayer[]> {
    const wanted = query.toLowerCase();
    return this.players
      .all()
      .filter((p) => p.id !== excludeId && p.username.toLowerCase().includes(wanted))
      .map(toPublicPlayer)
      .sort(byUsername)
      .slice(0, limit);
  }

  async friendsDistanceBetween(playerId: string, from: Date, to: Date): Promise<PlayerDistance[]> {
    const members = new Set([playerId, ...(this.follows.get(playerId) ?? [])]);
    const totals = new Map<string, { distanceMeters: number; activityCount: number }>();
    for (const a of this.activities.all()) {
      const t = a.startedAt.getTime();
      if (!members.has(a.playerId) || t < from.getTime() || t >= to.getTime()) continue;
      const total = totals.get(a.playerId) ?? { distanceMeters: 0, activityCount: 0 };
      total.distanceMeters += a.distanceMeters;
      total.activityCount += 1;
      totals.set(a.playerId, total);
    }
    return this.players
      .all()
      .filter((p) => members.has(p.id))
      .map((p) => ({
        player: toPublicPlayer(p),
        ...(totals.get(p.id) ?? { distanceMeters: 0, activityCount: 0 }),
      }));
  }

  async friendsActivities(playerId: string, limit: number): Promise<FriendActivity[]> {
    const followed = this.follows.get(playerId) ?? new Set<string>();
    const players = new Map(
      this.players
        .all()
        .filter((p) => followed.has(p.id))
        .map((p) => [p.id, toPublicPlayer(p)]),
    );
    return this.activities
      .all()
      .filter((a) => players.has(a.playerId))
      .sort(
        (a, b) =>
          b.startedAt.getTime() - a.startedAt.getTime() ||
          b.createdAt.getTime() - a.createdAt.getTime(),
      )
      .slice(0, limit)
      .map((a) => ({
        id: a.id,
        player: players.get(a.playerId)!,
        activityType: a.activityType,
        startedAt: a.startedAt,
        durationSeconds: a.durationSeconds,
        distanceMeters: a.distanceMeters,
        elevationGainMeters: a.elevationGainMeters,
      }));
  }

  async activityStarts(playerId: string, limit: number): Promise<ActivityStart[]> {
    return this.activities
      .all()
      .filter((a) => a.playerId === playerId && a.coordinates.length >= 2)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(0, limit)
      .map((a) => ({
        longitude: a.coordinates[0][0],
        latitude: a.coordinates[0][1],
        startedAt: a.startedAt,
      }));
  }

  async playersActiveNear(
    center: { longitude: number; latitude: number },
    radiusMeters: number,
    excludeIds: string[],
    limit: number,
  ): Promise<NearbyPlayer[]> {
    const excluded = new Set(excludeIds);
    const counts = new Map<string, number>();
    for (const a of this.activities.all()) {
      if (excluded.has(a.playerId) || a.coordinates.length < 2) continue;
      const [longitude, latitude] = a.coordinates[0];
      if (distanceMeters(center, { longitude, latitude }) > radiusMeters) continue;
      counts.set(a.playerId, (counts.get(a.playerId) ?? 0) + 1);
    }
    return this.players
      .all()
      .filter((p) => counts.has(p.id))
      .map((p) => ({ player: toPublicPlayer(p), activityCount: counts.get(p.id)! }))
      .sort((a, b) => b.activityCount - a.activityCount || byUsername(a.player, b.player))
      .slice(0, limit);
  }
}
