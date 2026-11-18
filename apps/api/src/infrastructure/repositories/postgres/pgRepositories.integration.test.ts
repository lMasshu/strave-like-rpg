import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DuplicateActivityError } from '../../../core/ports/activityRepository.js';
import { PlayerConflictError } from '../../../core/ports/playerRepository.js';
import { PgActivityRepository } from './pgActivityRepo.js';
import { PgPlayerRepository } from './pgPlayerRepo.js';
import { PgSocialRepository } from './pgSocialRepo.js';

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
  let social: PgSocialRepository;
  const tag = randomUUID().slice(0, 8);
  const email = (name: string) => `${name}.${tag}@integration.test`;

  beforeAll(() => {
    pool = new pg.Pool({ connectionString: url });
    players = new PgPlayerRepository(pool);
    activities = new PgActivityRepository(pool);
    social = new PgSocialRepository(pool);
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

    const summaries = await activities.findSummariesBetween(
      player.id,
      new Date('2026-11-17T00:00:00Z'),
      new Date('2026-11-18T00:00:00Z'),
      100,
    );
    expect(summaries.map((a) => a.id)).toEqual([imported.id]);
    expect(summaries[0]).not.toHaveProperty('coordinates');
    expect(summaries[0].external?.deviceName).toBe('Garmin Forerunner 255');
  });

  it('suit et ne suit plus un joueur, sans doublon ni auto-suivi', async () => {
    const [moi, ami] = await Promise.all([
      players.create({ email: email('moi'), username: `moi_${tag}`, passwordHash: 'x', auth0Sub: null }),
      players.create({ email: email('ami'), username: `ami_${tag}`, passwordHash: 'x', auth0Sub: null }),
    ]);
    await social.follow(moi.id, ami.id);
    await social.follow(moi.id, ami.id);
    expect((await social.listFollowing(moi.id)).map((p) => p.id)).toEqual([ami.id]);
    expect(await social.listFollowing(ami.id)).toEqual([]);
    await expect(social.follow(moi.id, moi.id)).rejects.toThrow();

    const found = await social.searchPlayers(`AMI_${tag}`, moi.id, 50);
    expect(found.map((p) => p.username)).toEqual([`ami_${tag}`]);
    expect(found[0]).not.toHaveProperty('email');
    expect(await social.searchPlayers(`moi_${tag}`, moi.id, 50)).toEqual([]);
    // Les jokers de LIKE sont cherchés littéralement.
    expect(await social.searchPlayers('%', moi.id, 50)).toEqual([]);

    await social.unfollow(moi.id, ami.id);
    expect(await social.listFollowing(moi.id)).toEqual([]);
  });

  it('additionne la distance de la semaine pour moi et les joueurs que je suis', async () => {
    const [moi, ami, autre] = await Promise.all(
      ['lb_moi', 'lb_ami', 'lb_autre'].map((name) =>
        players.create({ email: email(name), username: `${name}_${tag}`, passwordHash: 'x', auth0Sub: null }),
      ),
    );
    await social.follow(moi.id, ami.id);
    const sortie = (playerId: string, day: number, km: number) =>
      activities.create({
        id: randomUUID(),
        playerId,
        activityType: 'run',
        startedAt: new Date(Date.UTC(2026, 10, day, 8)),
        endedAt: new Date(Date.UTC(2026, 10, day, 9)),
        durationSeconds: 3600,
        distanceMeters: km * 1000,
        elevationGainMeters: 0,
        coordinates: [],
        createdAt: new Date(),
      });
    await sortie(ami.id, 16, 5);
    await sortie(ami.id, 18, 7);
    await sortie(ami.id, 9, 50); // semaine précédente
    await sortie(autre.id, 17, 30); // pas suivi

    const rows = await social.friendsDistanceBetween(
      moi.id,
      new Date(Date.UTC(2026, 10, 16)),
      new Date(Date.UTC(2026, 10, 23)),
    );
    const byId = new Map(rows.map((r) => [r.player.id, r]));
    expect(rows).toHaveLength(2);
    expect(byId.get(ami.id)).toMatchObject({ distanceMeters: 12_000, activityCount: 2 });
    expect(byId.get(moi.id)).toMatchObject({ distanceMeters: 0, activityCount: 0 });
    expect(byId.has(autre.id)).toBe(false);
  });

  it('renvoie les sorties des joueurs suivis, la plus récente en premier', async () => {
    const [moi, ami, autre] = await Promise.all(
      ['feed_moi', 'feed_ami', 'feed_autre'].map((name) =>
        players.create({ email: email(name), username: `${name}_${tag}`, passwordHash: 'x', auth0Sub: null }),
      ),
    );
    await social.follow(moi.id, ami.id);
    const sortie = (playerId: string, day: number) =>
      activities.create({
        id: randomUUID(),
        playerId,
        activityType: 'bike',
        startedAt: new Date(Date.UTC(2026, 10, day, 8)),
        endedAt: new Date(Date.UTC(2026, 10, day, 9)),
        durationSeconds: 3600,
        distanceMeters: 30_000,
        elevationGainMeters: 120,
        coordinates: [
          [2.35, 48.85],
          [2.36, 48.86],
        ],
        createdAt: new Date(),
      });
    await sortie(ami.id, 12);
    await sortie(ami.id, 15);
    await sortie(autre.id, 16);
    await sortie(moi.id, 17);

    const feed = await social.friendsActivities(moi.id, 10);
    expect(feed.map((a) => a.startedAt.getUTCDate())).toEqual([15, 12]);
    expect(feed[0]).toMatchObject({
      activityType: 'bike',
      distanceMeters: 30_000,
      elevationGainMeters: 120,
      player: { id: ami.id, username: `feed_ami_${tag}` },
    });
    expect(feed[0]).not.toHaveProperty('coordinates');
    expect(await social.friendsActivities(moi.id, 1)).toHaveLength(1);
  });

  it('trouve les joueurs ayant commencé une sortie dans un rayon donné (PostGIS)', async () => {
    // Coin isolé du Pacifique : aucune donnée existante ne s'y trouve.
    const ICI: [number, number] = [-150, -40];
    const [moi, voisin, lointain] = await Promise.all(
      ['geo_moi', 'geo_voisin', 'geo_loin'].map((name) =>
        players.create({ email: email(name), username: `${name}_${tag}`, passwordHash: 'x', auth0Sub: null }),
      ),
    );
    const sortie = (playerId: string, from: [number, number], day: number) =>
      activities.create({
        id: randomUUID(),
        playerId,
        activityType: 'run',
        startedAt: new Date(Date.UTC(2026, 10, day, 8)),
        endedAt: new Date(Date.UTC(2026, 10, day, 9)),
        durationSeconds: 3600,
        distanceMeters: 5000,
        elevationGainMeters: 0,
        coordinates: [from, [from[0] + 0.01, from[1]]],
        createdAt: new Date(),
      });
    await sortie(moi.id, ICI, 1);
    await sortie(voisin.id, [ICI[0] + 0.05, ICI[1]], 2); // ~4 km
    await sortie(voisin.id, ICI, 3);
    await sortie(lointain.id, [ICI[0] + 1, ICI[1]], 4); // ~85 km

    const starts = await social.activityStarts(moi.id, 10);
    expect(starts).toEqual([
      { longitude: ICI[0], latitude: ICI[1], startedAt: new Date(Date.UTC(2026, 10, 1, 8)) },
    ]);

    const near = await social.playersActiveNear(
      { longitude: ICI[0], latitude: ICI[1] },
      10_000,
      [moi.id],
      10,
    );
    expect(near.map((n) => [n.player.id, n.activityCount])).toEqual([[voisin.id, 2]]);
  });
});
