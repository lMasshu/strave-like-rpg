import type { Pool } from 'pg';
import type { PublicPlayer } from '../../../core/entities/player.js';
import type {
  ActivityStart,
  FriendActivity,
  ISocialRepository,
  NearbyPlayer,
  PlayerDistance,
} from '../../../core/ports/socialRepository.js';
import { isUuid } from './pgErrors.js';

interface PublicPlayerRow {
  id: string;
  username: string;
  level: number;
  experience: number;
  created_at: Date;
}

const PUBLIC_COLUMNS = 'p.id, p.username, p.level, p.experience, p.created_at';

function toPublicPlayer(row: PublicPlayerRow): PublicPlayer {
  return {
    id: row.id,
    username: row.username,
    level: row.level,
    experience: row.experience,
    createdAt: row.created_at,
  };
}

/** Échappe les jokers de LIKE : « 50% » cherche littéralement « 50% ». */
function likePattern(query: string): string {
  return `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** Un degré de latitude ≈ 111 km : marge du pré-filtre par boîte englobante (index GiST). */
const METERS_PER_DEGREE = 111_000;

export class PgSocialRepository implements ISocialRepository {
  constructor(private readonly pool: Pool) {}

  async follow(followerId: string, followedId: string): Promise<void> {
    if (!isUuid(followerId) || !isUuid(followedId)) return;
    await this.pool.query(
      `INSERT INTO follows (follower_id, followed_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [followerId, followedId],
    );
  }

  async unfollow(followerId: string, followedId: string): Promise<void> {
    if (!isUuid(followerId) || !isUuid(followedId)) return;
    await this.pool.query(`DELETE FROM follows WHERE follower_id = $1 AND followed_id = $2`, [
      followerId,
      followedId,
    ]);
  }

  async listFollowing(playerId: string): Promise<PublicPlayer[]> {
    if (!isUuid(playerId)) return [];
    const { rows } = await this.pool.query<PublicPlayerRow>(
      `SELECT ${PUBLIC_COLUMNS}
         FROM follows f JOIN players p ON p.id = f.followed_id
        WHERE f.follower_id = $1
        ORDER BY lower(p.username)`,
      [playerId],
    );
    return rows.map(toPublicPlayer);
  }

  async searchPlayers(query: string, excludeId: string, limit: number): Promise<PublicPlayer[]> {
    const { rows } = await this.pool.query<PublicPlayerRow>(
      `SELECT ${PUBLIC_COLUMNS}
         FROM players p
        WHERE p.id::text <> $1
          AND ($2 = '' OR p.username ILIKE $3)
        ORDER BY lower(p.username)
        LIMIT $4`,
      [excludeId, query, likePattern(query), limit],
    );
    return rows.map(toPublicPlayer);
  }

  async friendsDistanceBetween(playerId: string, from: Date, to: Date): Promise<PlayerDistance[]> {
    if (!isUuid(playerId)) return [];
    const { rows } = await this.pool.query<
      PublicPlayerRow & { distance_meters: string; activity_count: string }
    >(
      `WITH members AS (
         SELECT $1::uuid AS id
         UNION
         SELECT followed_id FROM follows WHERE follower_id = $1
       )
       SELECT ${PUBLIC_COLUMNS},
              COALESCE(SUM(a.distance_meters), 0) AS distance_meters,
              COUNT(a.id) AS activity_count
         FROM members m
         JOIN players p ON p.id = m.id
         LEFT JOIN activities a
                ON a.player_id = p.id AND a.started_at >= $2 AND a.started_at < $3
        GROUP BY p.id`,
      [playerId, from, to],
    );
    return rows.map((row) => ({
      player: toPublicPlayer(row),
      distanceMeters: Number(row.distance_meters),
      activityCount: Number(row.activity_count),
    }));
  }

  async friendsActivities(playerId: string, limit: number): Promise<FriendActivity[]> {
    if (!isUuid(playerId)) return [];
    const { rows } = await this.pool.query<
      PublicPlayerRow & {
        activity_id: string;
        activity_type: FriendActivity['activityType'];
        started_at: Date;
        duration_seconds: number;
        distance_meters: number;
        elevation_gain_meters: number;
      }
    >(
      `SELECT a.id AS activity_id, a.activity_type, a.started_at, a.duration_seconds,
              a.distance_meters, a.elevation_gain_meters, ${PUBLIC_COLUMNS}
         FROM follows f
         JOIN activities a ON a.player_id = f.followed_id
         JOIN players p ON p.id = a.player_id
        WHERE f.follower_id = $1
        ORDER BY a.started_at DESC, a.created_at DESC
        LIMIT $2`,
      [playerId, limit],
    );
    return rows.map((row) => ({
      id: row.activity_id,
      player: toPublicPlayer(row),
      activityType: row.activity_type,
      startedAt: row.started_at,
      durationSeconds: row.duration_seconds,
      distanceMeters: row.distance_meters,
      elevationGainMeters: row.elevation_gain_meters,
    }));
  }

  async activityStarts(playerId: string, limit: number): Promise<ActivityStart[]> {
    if (!isUuid(playerId)) return [];
    const { rows } = await this.pool.query<{ lng: number; lat: number; started_at: Date }>(
      `SELECT ST_X(ST_StartPoint(track)) AS lng, ST_Y(ST_StartPoint(track)) AS lat, started_at
         FROM activities
        WHERE player_id = $1 AND track IS NOT NULL
        ORDER BY started_at DESC
        LIMIT $2`,
      [playerId, limit],
    );
    return rows.map((row) => ({
      longitude: Number(row.lng),
      latitude: Number(row.lat),
      startedAt: row.started_at,
    }));
  }

  async playersActiveNear(
    center: { longitude: number; latitude: number },
    radiusMeters: number,
    excludeIds: string[],
    limit: number,
  ): Promise<NearbyPlayer[]> {
    // Marge en degrés : la longitude se resserre avec la latitude.
    const cosLat = Math.max(0.01, Math.cos((center.latitude * Math.PI) / 180));
    const margin = radiusMeters / (METERS_PER_DEGREE * cosLat);
    const { rows } = await this.pool.query<PublicPlayerRow & { activity_count: string }>(
      `WITH center AS (SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326) AS geom)
       SELECT ${PUBLIC_COLUMNS}, COUNT(*) AS activity_count
         FROM activities a
         JOIN players p ON p.id = a.player_id
         CROSS JOIN center c
        WHERE a.track IS NOT NULL
          AND a.track && ST_Expand(c.geom, $4)
          AND ST_DWithin(ST_StartPoint(a.track)::geography, c.geom::geography, $3)
          AND NOT (a.player_id = ANY($5::uuid[]))
        GROUP BY p.id
        ORDER BY COUNT(*) DESC, lower(p.username)
        LIMIT $6`,
      [
        center.longitude,
        center.latitude,
        radiusMeters,
        margin,
        excludeIds.filter(isUuid),
        limit,
      ],
    );
    return rows.map((row) => ({
      player: toPublicPlayer(row),
      activityCount: Number(row.activity_count),
    }));
  }
}
