import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DuplicateActivityError } from '../../../core/ports/activityRepository.js';
import { PlayerConflictError } from '../../../core/ports/playerRepository.js';
import { PgActivityRepository } from './pgActivityRepo.js';
import { PgPlayerRepository } from './pgPlayerRepo.js';

/**
 * Tests sur une vraie base PostGIS (schéma database/init.sql).
 * Lancement : TEST_DATABASE_URL=postgres://stride:stride_dev@localhost:5432/stride_quest npx vitest run
 * Sans cette variable (CI), la suite est ignorée.
 */
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('dépôts PostgreSQL', () => {
  let pool: pg.Pool;
  let players: PgPlayerRepository;
  let activities: PgActivityRepository;
  const tag = randomUUID().slice(0, 8);
  const email = (name: string) => `${name}.${tag}@integration.test`;

  beforeAll(() => {
    pool = new pg.Pool({ connectionString: url });
    players = new PgPlayerRepository(pool);
    activities = new PgActivityRepository(pool);
  });

  afterAll(async () => {
    // Les activités partent en cascade avec les joueurs.
    await pool.query(`DELETE FROM players WHERE email LIKE $1`, [`%.${tag}@integration.test`]);
    await pool.end();
  });

  it('crée un joueur, le retrouve par e-mail sans tenir compte de la casse et refuse les doublons', async () => {
    const created = await players.create({
      email: email('lea'),
      username: `lea_${tag}`,
      passwordHash: 'scrypt$1$1$1$c2Vs$aGFzaA==',
      auth0Sub: null,
    });

    expect(created).toMatchObject({ level: 1, experience: 0, auth0Sub: null });
    expect((await players.findByEmail(email('LEA').toUpperCase()))?.id).toBe(created.id);
    await expect(
      players.create({ email: email('lea'), username: `autre_${tag}`, passwordHash: 'x', auth0Sub: null }),
    ).rejects.toMatchObject({ field: 'email' });
    await expect(
      players.create({ email: email('autre'), username: `lea_${tag}`, passwordHash: 'x', auth0Sub: null }),
    ).rejects.toBeInstanceOf(PlayerConflictError);
  });

  it('ajoute l’XP de façon atomique, même en parallèle', async () => {
    const player = await players.create({
      email: email('xp'),
      username: `xp_${tag}`,
      passwordHash: null,
      auth0Sub: `google-oauth2|${tag}`,
    });

    await Promise.all(Array.from({ length: 10 }, () => players.addExperience(player.id, 150)));

    const updated = await players.findById(player.id);
    expect(updated).toMatchObject({ experience: 1500, level: 2 });
    expect((await players.findByAuth0Sub(`google-oauth2|${tag}`))?.id).toBe(player.id);
  });

  it('stocke le tracé en PostGIS et refuse une séance de montre déjà importée', async () => {
    const player = await players.create({
      email: email('run'),
      username: `run_${tag}`,
      passwordHash: 'x',
      auth0Sub: null,
    });
    const base = {
      playerId: player.id,
      activityType: 'run' as const,
      startedAt: new Date('2026-11-16T07:00:00Z'),
      endedAt: new Date('2026-11-16T08:00:00Z'),
      durationSeconds: 3600,
      distanceMeters: 10350.6,
      elevationGainMeters: 12,
      createdAt: new Date(),
    };

    const withTrack = await activities.create({
      ...base,
      id: randomUUID(),
      coordinates: [
        [2.35, 48.85],
        [2.36, 48.86],
      ],
    });
    expect(withTrack.coordinates).toEqual([
      [2.35, 48.85],
      [2.36, 48.86],
    ]);
    expect(withTrack.distanceMeters).toBe(10351);

    const external = {
      source: 'health-connect' as const,
      id: `hc-${tag}`,
      deviceName: 'Garmin Forerunner 255',
    };
    const imported = await activities.create({
      ...base,
      id: randomUUID(),
      coordinates: [],
      external,
      startedAt: new Date('2026-11-17T07:00:00Z'),
      endedAt: new Date('2026-11-17T08:00:00Z'),
    });
    expect(imported.coordinates).toEqual([]);
    expect(imported.external).toEqual(external);
    await expect(
      activities.create({ ...base, id: randomUUID(), coordinates: [], external }),
    ).rejects.toEqual(new DuplicateActivityError(imported.id));

    const history = await activities.findByPlayerId(player.id);
    // Séance montre du 17/11 avant la course téléphone du 16/11.
    expect(history.map((a) => a.id)).toEqual([imported.id, withTrack.id]);
    expect(await activities.findById('pas-un-uuid')).toBeNull();
  });
});
