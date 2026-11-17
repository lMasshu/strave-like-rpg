import type { Pool } from 'pg';
import type {
  Activity,
  ActivityType,
  CoordinatePair,
  ExternalActivityRef,
  ExternalActivitySource,
} from '../../../core/entities/activity.js';
import type { ActivityRecording } from '../../../core/entities/activityRecording.js';
import {
  DuplicateActivityError,
  type IActivityRepository,
} from '../../../core/ports/activityRepository.js';
import { isUuid, uniqueViolation } from './pgErrors.js';

interface ActivityRow {
  id: string;
  player_id: string;
  activity_type: ActivityType;
  started_at: Date;
  ended_at: Date;
  distance_meters: number;
  duration_seconds: number;
  elevation_gain_meters: number;
  track: string | null;
  recording: ActivityRecording | null;
  external_source: ExternalActivitySource | null;
  external_id: string | null;
  external_device: string | null;
  created_at: Date;
}

const COLUMNS = `id, player_id, activity_type, started_at, ended_at, distance_meters,
  duration_seconds, elevation_gain_meters, ST_AsGeoJSON(track) AS track, recording,
  external_source, external_id, external_device, created_at`;

/** Un LineString PostGIS exige au moins deux points ; sinon pas de tracé. */
export function toLineStringGeoJson(coordinates: CoordinatePair[]): string | null {
  if (coordinates.length < 2) return null;
  return JSON.stringify({ type: 'LineString', coordinates });
}

function parseTrack(geoJson: string | null): CoordinatePair[] {
  if (!geoJson) return [];
  const parsed = JSON.parse(geoJson) as { coordinates?: number[][] };
  return (parsed.coordinates ?? []).map(([lng, lat]) => [lng, lat] as CoordinatePair);
}

function toActivity(row: ActivityRow): Activity {
  return {
    id: row.id,
    playerId: row.player_id,
    activityType: row.activity_type,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    distanceMeters: row.distance_meters,
    durationSeconds: row.duration_seconds,
    elevationGainMeters: row.elevation_gain_meters,
    coordinates: parseTrack(row.track),
    ...(row.recording ? { recording: row.recording } : {}),
    ...(row.external_source && row.external_id
      ? {
          external: {
            source: row.external_source,
            id: row.external_id,
            ...(row.external_device ? { deviceName: row.external_device } : {}),
          },
        }
      : {}),
    createdAt: row.created_at,
  };
}

export class PgActivityRepository implements IActivityRepository {
  constructor(private readonly pool: Pool) {}

  async create(activity: Activity): Promise<Activity> {
    try {
      const { rows } = await this.pool.query<ActivityRow>(
        `INSERT INTO activities (
           id, player_id, activity_type, started_at, ended_at, distance_meters,
           duration_seconds, elevation_gain_meters, track, recording,
           external_source, external_id, external_device, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
           CASE WHEN $9::text IS NULL THEN NULL
                ELSE ST_SetSRID(ST_GeomFromGeoJSON($9::text), 4326) END,
           $10::jsonb, $11, $12, $13, $14)
         RETURNING ${COLUMNS}`,
        [
          activity.id,
          activity.playerId,
          activity.activityType,
          activity.startedAt,
          activity.endedAt,
          // Colonnes INTEGER : on arrondit au mètre / à la seconde.
          Math.round(activity.distanceMeters),
          Math.round(activity.durationSeconds),
          Math.round(activity.elevationGainMeters),
          toLineStringGeoJson(activity.coordinates),
          activity.recording ? JSON.stringify(activity.recording) : null,
          activity.external?.source ?? null,
          activity.external?.id ?? null,
          activity.external?.deviceName ?? null,
          activity.createdAt,
        ],
      );
      return toActivity(rows[0]);
    } catch (err) {
      if (activity.external && uniqueViolation(err) === 'activities_external_ref_uniq') {
        const existing = await this.findByExternalRef(activity.playerId, activity.external);
        throw new DuplicateActivityError(existing?.id ?? '');
      }
      throw err;
    }
  }

  async findById(id: string): Promise<Activity | null> {
    if (!isUuid(id)) return null;
    const { rows } = await this.pool.query<ActivityRow>(
      `SELECT ${COLUMNS} FROM activities WHERE id = $1`,
      [id],
    );
    return rows[0] ? toActivity(rows[0]) : null;
  }

  async findByPlayerId(playerId: string, limit = 20): Promise<Activity[]> {
    if (!isUuid(playerId)) return [];
    const { rows } = await this.pool.query<ActivityRow>(
      `SELECT ${COLUMNS} FROM activities
        WHERE player_id = $1
        ORDER BY started_at DESC, created_at DESC
        LIMIT $2`,
      [playerId, limit],
    );
    return rows.map(toActivity);
  }

  async findByExternalRef(
    playerId: string,
    ref: ExternalActivityRef,
  ): Promise<Activity | null> {
    if (!isUuid(playerId)) return null;
    const { rows } = await this.pool.query<ActivityRow>(
      `SELECT ${COLUMNS} FROM activities
        WHERE player_id = $1 AND external_source = $2 AND external_id = $3`,
      [playerId, ref.source, ref.id],
    );
    return rows[0] ? toActivity(rows[0]) : null;
  }
}
