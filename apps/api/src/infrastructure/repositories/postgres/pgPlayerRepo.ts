import type { Pool } from 'pg';
import type { CoachGoal, NewPlayer, Player } from '../../../core/entities/player.js';
import {
  type IPlayerRepository,
  PlayerConflictError,
} from '../../../core/ports/playerRepository.js';
import { isUuid, uniqueViolation } from './pgErrors.js';

interface PlayerRow {
  id: string;
  username: string;
  email: string;
  password_hash: string | null;
  auth0_sub: string | null;
  level: number;
  experience: number;
  coach_enabled: boolean;
  coach_goal: string;
  created_at: Date;
}

const COLUMNS =
  'id, username, email, password_hash, auth0_sub, level, experience, coach_enabled, coach_goal, created_at';

function toPlayer(row: PlayerRow): Player {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    passwordHash: row.password_hash,
    auth0Sub: row.auth0_sub,
    level: row.level,
    experience: row.experience,
    coachEnabled: row.coach_enabled,
    coachGoal: row.coach_goal as CoachGoal,
    createdAt: row.created_at,
  };
}

function conflictField(constraint: string): PlayerConflictError['field'] {
  if (constraint.includes('username')) return 'username';
  if (constraint.includes('auth0')) return 'auth0Sub';
  return 'email';
}

export class PgPlayerRepository implements IPlayerRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: string): Promise<Player | null> {
    if (!isUuid(id)) return null;
    return this.one(`SELECT ${COLUMNS} FROM players WHERE id = $1`, [id]);
  }

  async findByEmail(email: string): Promise<Player | null> {
    // Colonne CITEXT : comparaison insensible à la casse.
    return this.one(`SELECT ${COLUMNS} FROM players WHERE email = $1`, [email]);
  }

  async findByUsername(username: string): Promise<Player | null> {
    return this.one(`SELECT ${COLUMNS} FROM players WHERE username = $1`, [username]);
  }

  async findByAuth0Sub(auth0Sub: string): Promise<Player | null> {
    return this.one(`SELECT ${COLUMNS} FROM players WHERE auth0_sub = $1`, [auth0Sub]);
  }

  async create(input: NewPlayer): Promise<Player> {
    try {
      const player = await this.one(
        `INSERT INTO players (username, email, password_hash, auth0_sub, coach_enabled, coach_goal)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING ${COLUMNS}`,
        [
          input.username,
          input.email,
          input.passwordHash,
          input.auth0Sub,
          input.coachEnabled ?? false,
          input.coachGoal ?? 'casual',
        ],
      );
      return player!;
    } catch (err) {
      const constraint = uniqueViolation(err);
      if (constraint !== null) throw new PlayerConflictError(conflictField(constraint));
      throw err;
    }
  }

  async linkAuth0Sub(id: string, auth0Sub: string): Promise<Player> {
    return this.required(
      `UPDATE players SET auth0_sub = $2 WHERE id = $1 RETURNING ${COLUMNS}`,
      [id, auth0Sub],
      id,
    );
  }

  async addExperience(id: string, xpDelta: number): Promise<Player> {
    // Une seule requête : aucune perte d'XP si plusieurs activités arrivent en même temps.
    return this.required(
      `UPDATE players
          SET experience = experience + $2,
              level = ((experience + $2) / 1000) + 1
        WHERE id = $1
        RETURNING ${COLUMNS}`,
      [id, Math.trunc(xpDelta)],
      id,
    );
  }

  async updateCoachSettings(
    id: string,
    settings: { coachEnabled?: boolean; coachGoal?: CoachGoal },
  ): Promise<Player> {
    const current = await this.findById(id);
    if (!current) throw new Error(`Player ${id} not found`);

    const enabled =
      settings.coachEnabled !== undefined ? settings.coachEnabled : current.coachEnabled;
    const goal = settings.coachGoal !== undefined ? settings.coachGoal : current.coachGoal;

    return this.required(
      `UPDATE players SET coach_enabled = $2, coach_goal = $3 WHERE id = $1 RETURNING ${COLUMNS}`,
      [id, enabled, goal],
      id,
    );
  }

  private async one(sql: string, params: unknown[]): Promise<Player | null> {
    const { rows } = await this.pool.query<PlayerRow>(sql, params);
    return rows[0] ? toPlayer(rows[0]) : null;
  }

  private async required(sql: string, params: unknown[], id: string): Promise<Player> {
    const player = isUuid(id) ? await this.one(sql, params) : null;
    if (!player) throw new Error(`Player ${id} not found`);
    return player;
  }
}
