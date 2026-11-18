import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import { InMemoryPlayerRepository } from '../repositories/inMemory/inMemoryPlayerRepo.js';
import type { IGoogleIdentityVerifier } from '../../core/services/authService.js';
import { buildTestApp, registerPlayer } from '../../test/testApp.js';

describe('Fastify REST API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  }, 15000);

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns status ok', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'ok', service: 'stride-quest-api' });
  });

  it('refuse de démarrer sans secret de session suffisamment long', async () => {
    await expect(buildApp({ jwtSecret: 'court' })).rejects.toThrow(/jwtSecret/);
  });

  describe('inscription', () => {
    it('crée le compte, renvoie une session et ne divulgue jamais le hash', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email: '  Lea@Example.com ', password: 'Trail-running-42!', username: 'Lea_Trail' },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.token).toEqual(expect.any(String));
      expect(body.player).toMatchObject({
        email: 'lea@example.com',
        username: 'Lea_Trail',
        level: 1,
        experience: 0,
        hasPassword: true,
        googleLinked: false,
      });
      expect(response.body).not.toMatch(/scrypt|passwordHash|password_hash/);
    });

    it('refuse un e-mail déjà utilisé, quelle que soit la casse', async () => {
      await registerPlayer(app, { email: 'dup@example.com' });
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email: 'DUP@example.com', password: 'Motdepasse-solide1!', username: 'autre_pseudo' },
      });
      expect(response.statusCode).toBe(409);
      expect(response.json().error).toMatch(/e-mail/);
    });

    it('refuse un pseudo déjà pris', async () => {
      await registerPlayer(app, { username: 'Pseudo_Unique' });
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email: 'pseudo2@example.com', password: 'Motdepasse-solide1!', username: 'Pseudo_Unique' },
      });
      expect(response.statusCode).toBe(409);
      expect(response.json().error).toMatch(/pseudo/);
    });

    it.each([
      [{ email: 'pas-un-email', password: 'Motdepasse-solide1!', username: 'valide' }, /E-mail invalide/],
      [{ email: 'court@example.com', password: 'Court1!', username: 'valide' }, /12 caractères/],
      [{ email: 'court@example.com', password: 'sansmajuscule12!', username: 'valide' }, /majuscule/],
      [{ email: 'court@example.com', password: 'SANSMINUSCULE12!', username: 'valide' }, /minuscule/],
      [{ email: 'court@example.com', password: 'SansChiffres!!', username: 'valide' }, /chiffre/],
      [{ email: 'court@example.com', password: 'SansSpecial1234', username: 'valide' }, /spécial/],
      [{ email: 'court@example.com', password: '        ', username: 'valide' }, /vide|caractères/],
      [{ email: 'court@example.com', password: 'Motdepasse-solide1!', username: 'a b' }, /pseudo/i],
    ])('valide les champs (%o)', async (payload, message) => {
      const response = await app.inject({ method: 'POST', url: '/api/auth/register', payload });
      expect(response.statusCode).toBe(400);
      expect(response.json().error).toMatch(message);
    });
  });

  describe('connexion', () => {
    it('connecte avec le bon mot de passe, e-mail insensible à la casse', async () => {
      await registerPlayer(app, { email: 'login@example.com', password: 'Bon-mot-de-passe1!' });

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'LOGIN@example.com', password: 'Bon-mot-de-passe1!' },
      });

      expect(response.statusCode).toBe(200);
      const me = await app.inject({
        method: 'GET',
        url: '/api/players/me',
        headers: { authorization: `Bearer ${response.json().token}` },
      });
      expect(me.json().email).toBe('login@example.com');
    });

    it('renvoie le même message pour un mauvais mot de passe et un e-mail inconnu', async () => {
      await registerPlayer(app, { email: 'secret@example.com', password: 'Bon-mot-de-passe1!' });

      const wrongPassword = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'secret@example.com', password: 'Mauvais-mot-de-passe1!' },
      });
      const unknownEmail = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'inconnu@example.com', password: 'Bon-mot-de-passe1!' },
      });

      expect(wrongPassword.statusCode).toBe(401);
      expect(unknownEmail.statusCode).toBe(401);
      expect(wrongPassword.json()).toEqual(unknownEmail.json());
    });

    it('limite les tentatives de connexion par minute', async () => {
      const limited = await buildTestApp({ authRateLimitPerMinute: 2 });
      try {
        const attempt = () =>
          limited.inject({
            method: 'POST',
            url: '/api/auth/login',
            payload: { email: 'x@example.com', password: 'nimportequoi' },
          });
        expect((await attempt()).statusCode).toBe(401);
        expect((await attempt()).statusCode).toBe(401);
        expect((await attempt()).statusCode).toBe(429);
      } finally {
        await limited.close();
      }
    });
  });

  describe('routes protégées', () => {
    it.each([
      ['GET', '/api/players/me'],
      ['GET', '/api/activities/me'],
      ['POST', '/api/activities'],
    ] as const)('%s %s exige une session', async (method, url) => {
      const response = await app.inject({ method, url, payload: method === 'POST' ? {} : undefined });
      expect(response.statusCode).toBe(401);
    });

    it('refuse un jeton forgé ou signé avec un autre secret', async () => {
      const forgedPayload = Buffer.from(JSON.stringify({ sub: 'someone' })).toString('base64url');
      const other = await buildApp({ jwtSecret: 'un-autre-secret-de-plus-de-32-caracteres' });
      const otherToken = other.jwt.sign({ sub: 'someone' });
      await other.close();

      for (const token of [`eyJhbGciOiJub25lIn0.${forgedPayload}.`, otherToken]) {
        const response = await app.inject({
          method: 'GET',
          url: '/api/players/me',
          headers: { authorization: `Bearer ${token}` },
        });
        expect(response.statusCode).toBe(401);
      }
    });

    it('ne laisse pas un joueur lire l’activité d’un autre', async () => {
      const owner = await registerPlayer(app);
      const intruder = await registerPlayer(app);
      const created = await app.inject({
        method: 'POST',
        url: '/api/activities',
        headers: owner.headers,
        payload: {
          activityType: 'run',
          startedAt: '2026-11-07T10:00:00.000Z',
          endedAt: '2026-11-07T10:30:00.000Z',
          durationSeconds: 1800,
          distanceMeters: 5000,
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/activities/${created.json().activityId}`,
        headers: intruder.headers,
      });
      expect(response.statusCode).toBe(404);
    });

    it('GET /api/players/:id ne renvoie que le profil public', async () => {
      const session = await registerPlayer(app, { email: 'public@example.com' });
      const response = await app.inject({ method: 'GET', url: `/api/players/${session.playerId}` });
      expect(response.statusCode).toBe(200);
      expect(response.json()).not.toHaveProperty('email');
      expect(response.body).not.toMatch(/public@example\.com|scrypt/);
    });
  });

  it('POST /api/activities enregistre la sortie, crédite l’XP et l’ajoute à l’historique', async () => {
    const { headers } = await registerPlayer(app);
    const response = await app.inject({
      method: 'POST',
      url: '/api/activities',
      headers,
      payload: {
        activityType: 'run',
        startedAt: '2026-11-07T10:00:00.000Z',
        endedAt: '2026-11-07T10:30:00.000Z',
        durationSeconds: 1800,
        distanceMeters: 5000,
        elevationGainMeters: 40,
        coordinates: [
          [2.3522, 48.8566],
          [2.353, 48.8575],
        ],
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.xpEarned).toBe(580); // 500 XP distance + 80 XP dénivelé
    expect(body.totalExperience).toBe(580);
    expect(body.previousLevel).toBe(1);
    expect(body.newLevel).toBe(1);

    const listRes = await app.inject({ method: 'GET', url: '/api/activities/me', headers });
    expect(listRes.json().activities).toHaveLength(1);
    expect(listRes.json().activities[0].distanceMeters).toBe(5000);
  });

  it('POST /api/activities rejects invalid velocity payloads', async () => {
    const { headers } = await registerPlayer(app);
    const response = await app.inject({
      method: 'POST',
      url: '/api/activities',
      headers,
      payload: {
        activityType: 'run',
        startedAt: '2026-11-07T10:00:00.000Z',
        endedAt: '2026-11-07T10:01:00.000Z',
        durationSeconds: 60,
        distanceMeters: 10000, // 600 km/h
        coordinates: [],
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toMatch(/speed|vitesse|anti-cheat/i);
  });

  describe('GET /api/activities/me/summary (statistiques par période)', () => {
    const run = (startedAt: string) => ({
      activityType: 'run',
      startedAt,
      endedAt: new Date(Date.parse(startedAt) + 1800_000).toISOString(),
      durationSeconds: 1800,
      distanceMeters: 5000,
      coordinates: [
        [2.35, 48.85],
        [2.36, 48.86],
      ],
    });

    it('renvoie les sorties de la période, sans tracé ni enregistrement, la plus récente en premier', async () => {
      const { headers } = await registerPlayer(app);
      for (const startedAt of [
        '2026-10-31T23:59:00.000Z', // avant la période
        '2026-11-03T07:00:00.000Z',
        '2026-11-16T07:00:00.000Z',
        '2026-12-01T00:00:00.000Z', // borne de fin exclue
      ]) {
        await app.inject({ method: 'POST', url: '/api/activities', headers, payload: run(startedAt) });
      }
      const other = await registerPlayer(app);
      await app.inject({
        method: 'POST',
        url: '/api/activities',
        headers: other.headers,
        payload: run('2026-11-05T07:00:00.000Z'),
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/activities/me/summary?from=2026-11-01T00:00:00.000Z&to=2026-12-01T00:00:00.000Z',
        headers,
      });

      expect(response.statusCode).toBe(200);
      const { activities } = response.json();
      expect(activities.map((a: { startedAt: string }) => a.startedAt)).toEqual([
        '2026-11-16T07:00:00.000Z',
        '2026-11-03T07:00:00.000Z',
      ]);
      expect(activities[0]).not.toHaveProperty('coordinates');
      expect(activities[0]).not.toHaveProperty('recording');
      expect(activities[0]).toMatchObject({ distanceMeters: 5000, durationSeconds: 1800 });
    });

    it('accepte un décalage horaire (minuit heure de Paris)', async () => {
      const { headers } = await registerPlayer(app);
      const response = await app.inject({
        method: 'GET',
        url: `/api/activities/me/summary?from=${encodeURIComponent('2026-11-16T00:00:00+01:00')}&to=${encodeURIComponent('2026-11-23T00:00:00+01:00')}`,
        headers,
      });
      expect(response.statusCode).toBe(200);
    });

    it.each([
      ['', /from/],
      ['?from=hier&to=2026-12-01T00:00:00.000Z', /from invalide/],
      ['?from=2026-12-01T00:00:00.000Z&to=2026-11-01T00:00:00.000Z', /postérieur/],
      ['?from=2024-01-01T00:00:00.000Z&to=2026-01-01T00:00:00.000Z', /trop longue/],
    ])('refuse des bornes invalides (%s)', async (query, message) => {
      const { headers } = await registerPlayer(app);
      const response = await app.inject({
        method: 'GET',
        url: `/api/activities/me/summary${query}`,
        headers,
      });
      expect(response.statusCode).toBe(400);
      expect(response.json().error).toMatch(message);
    });

    it('exige une session', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/activities/me/summary?from=2026-11-01T00:00:00.000Z&to=2026-12-01T00:00:00.000Z',
      });
      expect(response.statusCode).toBe(401);
    });
  });

  describe('import de séances de montre', () => {
    const watchRun = {
      activityType: 'run',
      startedAt: '2026-11-16T07:00:00.000Z',
      endedAt: '2026-11-16T08:01:00.000Z',
      durationSeconds: 3660,
      distanceMeters: 10350,
      external: {
        source: 'health-connect',
        id: 'hc-garmin-run-1',
        deviceName: 'Garmin Forerunner 255',
      },
    };

    it('mélange sorties téléphone et montre dans un seul historique, la plus récente en premier', async () => {
      const { headers } = await registerPlayer(app);
      const phoneRun = (startedAt: string, endedAt: string) => ({
        activityType: 'run',
        startedAt,
        endedAt,
        durationSeconds: 1800,
        distanceMeters: 5000,
      });

      for (const payload of [
        phoneRun('2026-11-10T07:00:00.000Z', '2026-11-10T07:30:00.000Z'),
        watchRun, // 16/11
        phoneRun('2026-11-17T18:00:00.000Z', '2026-11-17T18:30:00.000Z'),
      ]) {
        const res = await app.inject({ method: 'POST', url: '/api/activities', headers, payload });
        expect(res.statusCode).toBe(201);
      }

      const { activities } = (
        await app.inject({ method: 'GET', url: '/api/activities/me', headers })
      ).json();

      expect(activities.map((a: { startedAt: string }) => a.startedAt)).toEqual([
        '2026-11-17T18:00:00.000Z',
        '2026-11-16T07:00:00.000Z',
        '2026-11-10T07:00:00.000Z',
      ]);
      expect(activities[0].external).toBeUndefined();
      expect(activities[1].external.deviceName).toBe('Garmin Forerunner 255');
    });

    it('enregistre la séance sans tracé puis refuse de la réimporter sans recréditer d’XP', async () => {
      const { headers } = await registerPlayer(app);

      const first = await app.inject({ method: 'POST', url: '/api/activities', headers, payload: watchRun });
      expect(first.statusCode).toBe(201);
      expect(first.json().xpEarned).toBe(1035);

      const second = await app.inject({ method: 'POST', url: '/api/activities', headers, payload: watchRun });
      expect(second.statusCode).toBe(409);
      expect(second.json().activityId).toBe(first.json().activityId);

      const player = await app.inject({ method: 'GET', url: '/api/players/me', headers });
      expect(player.json().experience).toBe(1035);

      const list = await app.inject({ method: 'GET', url: '/api/activities/me', headers });
      const activities = list.json().activities;
      expect(activities).toHaveLength(1);
      expect(activities[0].external).toEqual(watchRun.external);
      expect(activities[0].coordinates).toEqual([]);
    });

    it('laisse un autre joueur importer une séance de même identifiant', async () => {
      const { headers } = await registerPlayer(app);
      const response = await app.inject({ method: 'POST', url: '/api/activities', headers, payload: watchRun });
      expect(response.statusCode).toBe(201);
    });

    it('rejette une source inconnue ou un identifiant vide', async () => {
      const { headers } = await registerPlayer(app);
      for (const external of [
        { source: 'strava', id: 'x' },
        { source: 'health-connect', id: '  ' },
        { source: 'health-connect', id: 'ok', deviceName: 'x'.repeat(101) },
      ]) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/activities',
          headers,
          payload: { ...watchRun, external },
        });
        expect(response.statusCode).toBe(400);
      }
    });
  });
});

describe('connexion Google (Auth0)', () => {
  const identity = {
    sub: 'google-oauth2|123',
    email: 'Hugo@Gmail.com',
    emailVerified: true,
    name: 'Hugo Bike',
  };

  async function googleApp(verify: IGoogleIdentityVerifier['verify']) {
    const playerRepo = new InMemoryPlayerRepository();
    const app = await buildTestApp({ playerRepo, googleVerifier: { verify } });
    return { app, playerRepo };
  }

  const loginWithGoogle = (app: FastifyInstance) =>
    app.inject({
      method: 'POST',
      url: '/api/auth/google',
      payload: { idToken: 'header.payload.signature-du-jeton' },
    });

  it('répond 503 quand Google n’est pas configuré', async () => {
    const app = await buildTestApp();
    expect((await loginWithGoogle(app)).statusCode).toBe(503);
    await app.close();
  });

  it('crée un compte sans mot de passe au premier passage, puis le retrouve', async () => {
    const { app, playerRepo } = await googleApp(vi.fn().mockResolvedValue(identity));

    const first = await loginWithGoogle(app);
    expect(first.statusCode).toBe(200);
    expect(first.json().player).toMatchObject({
      email: 'hugo@gmail.com',
      username: 'Hugo_Bike',
      hasPassword: false,
      googleLinked: true,
    });

    const second = await loginWithGoogle(app);
    expect(second.json().player.id).toBe(first.json().player.id);
    expect((await playerRepo.findByAuth0Sub(identity.sub))?.passwordHash).toBeNull();
    await app.close();
  });

  it('rattache Google au compte e-mail existant au lieu d’en créer un second', async () => {
    const { app } = await googleApp(vi.fn().mockResolvedValue(identity));
    const existing = await registerPlayer(app, { email: 'hugo@gmail.com' });

    const response = await loginWithGoogle(app);

    expect(response.json().player).toMatchObject({
      id: existing.playerId,
      hasPassword: true,
      googleLinked: true,
    });
    await app.close();
  });

  it('refuse un e-mail Google non vérifié et un jeton invalide', async () => {
    const unverified = await googleApp(
      vi.fn().mockResolvedValue({ ...identity, emailVerified: false }),
    );
    expect((await loginWithGoogle(unverified.app)).statusCode).toBe(403);
    await unverified.app.close();

    const invalid = await googleApp(vi.fn().mockRejectedValue(new Error('bad signature')));
    expect((await loginWithGoogle(invalid.app)).statusCode).toBe(401);
    await invalid.app.close();
  });

  it('le jeton de session d’un compte Google donne accès au profil', async () => {
    const { app } = await googleApp(vi.fn().mockResolvedValue(identity));
    const { token } = (await loginWithGoogle(app)).json();
    const me = await app.inject({
      method: 'GET',
      url: '/api/players/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(me.json().email).toBe('hugo@gmail.com');
    await app.close();
  });
});

describe('amis', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  }, 15000);

  afterAll(async () => {
    await app.close();
  });

  it('exige une session', async () => {
    for (const [method, url] of [
      ['GET', '/api/players'],
      ['GET', '/api/friends'],
      ['GET', '/api/friends/suggestions'],
      ['GET', '/api/friends/leaderboard'],
      ['GET', '/api/friends/activities'],
      ['PUT', '/api/friends/x'],
      ['DELETE', '/api/friends/x'],
    ] as const) {
      const response = await app.inject({ method, url });
      expect(response.statusCode, `${method} ${url}`).toBe(401);
    }
  });

  it('cherche les inscrits, suit un joueur puis ne le suit plus', async () => {
    const moi = await registerPlayer(app, { username: 'amis_moi' });
    const lea = await registerPlayer(app, { username: 'amis_Lea' });

    const search = await app.inject({
      method: 'GET',
      url: '/api/players?q=AMIS_',
      headers: moi.headers,
    });
    expect(search.statusCode).toBe(200);
    expect(search.json().players).toEqual([
      expect.objectContaining({ id: lea.playerId, username: 'amis_Lea', following: false }),
    ]);
    expect(search.json().players[0]).not.toHaveProperty('email');

    const follow = await app.inject({
      method: 'PUT',
      url: `/api/friends/${lea.playerId}`,
      headers: moi.headers,
    });
    expect(follow.statusCode).toBe(204);

    const friends = await app.inject({ method: 'GET', url: '/api/friends', headers: moi.headers });
    expect(friends.json().friends.map((p: { id: string }) => p.id)).toEqual([lea.playerId]);

    const again = await app.inject({
      method: 'GET',
      url: '/api/players?q=amis_lea',
      headers: moi.headers,
    });
    expect(again.json().players[0].following).toBe(true);

    const unfollow = await app.inject({
      method: 'DELETE',
      url: `/api/friends/${lea.playerId}`,
      headers: moi.headers,
    });
    expect(unfollow.statusCode).toBe(204);
    const after = await app.inject({ method: 'GET', url: '/api/friends', headers: moi.headers });
    expect(after.json().friends).toEqual([]);
  });

  it('refuse de se suivre soi-même ou un joueur inconnu', async () => {
    const moi = await registerPlayer(app);
    const self = await app.inject({
      method: 'PUT',
      url: `/api/friends/${moi.playerId}`,
      headers: moi.headers,
    });
    expect(self.statusCode).toBe(400);
    const unknown = await app.inject({
      method: 'PUT',
      url: '/api/friends/00000000-0000-4000-8000-000000000000',
      headers: moi.headers,
    });
    expect(unknown.statusCode).toBe(404);
  });

  it('borne le nombre de résultats demandé', async () => {
    const moi = await registerPlayer(app);
    for (const limit of ['0', '51', 'abc']) {
      const response = await app.inject({
        method: 'GET',
        url: `/api/players?limit=${limit}`,
        headers: moi.headers,
      });
      expect(response.statusCode, `limit=${limit}`).toBe(400);
    }
    const ok = await app.inject({
      method: 'GET',
      url: '/api/players?limit=1',
      headers: moi.headers,
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().players.length).toBeLessThanOrEqual(1);
  });

  it('refuse une recherche trop longue', async () => {
    const moi = await registerPlayer(app);
    const response = await app.inject({
      method: 'GET',
      url: `/api/players?q=${'a'.repeat(41)}`,
      headers: moi.headers,
    });
    expect(response.statusCode).toBe(400);
  });

  it('classement de la guilde : moi et mes amis, période obligatoire', async () => {
    const moi = await registerPlayer(app, { username: 'guilde_moi' });
    const ami = await registerPlayer(app, { username: 'guilde_ami' });
    await app.inject({ method: 'PUT', url: `/api/friends/${ami.playerId}`, headers: moi.headers });

    const missing = await app.inject({
      method: 'GET',
      url: '/api/friends/leaderboard',
      headers: moi.headers,
    });
    expect(missing.statusCode).toBe(400);

    const response = await app.inject({
      method: 'GET',
      url: '/api/friends/leaderboard?from=2026-11-16T00:00:00.000Z&to=2026-11-23T00:00:00.000Z',
      headers: moi.headers,
    });
    expect(response.statusCode).toBe(200);
    const board = response.json().leaderboard;
    expect(board.map((e: { username: string }) => e.username).sort()).toEqual([
      'guilde_ami',
      'guilde_moi',
    ]);
    expect(board.find((e: { isMe: boolean }) => e.isMe)).toMatchObject({
      id: moi.playerId,
      distanceMeters: 0,
      rank: 1,
    });
    expect(board[0]).not.toHaveProperty('email');
  });

  it("fil d'activités : sorties de mes amis, sans tracé, limite bornée", async () => {
    const moi = await registerPlayer(app);
    const ami = await registerPlayer(app);
    await app.inject({ method: 'PUT', url: `/api/friends/${ami.playerId}`, headers: moi.headers });
    const created = await app.inject({
      method: 'POST',
      url: '/api/activities',
      headers: ami.headers,
      payload: {
        activityType: 'run',
        startedAt: '2026-11-17T07:00:00.000Z',
        endedAt: '2026-11-17T08:00:00.000Z',
        durationSeconds: 3600,
        distanceMeters: 10_000,
      },
    });
    expect(created.statusCode).toBe(201);

    const response = await app.inject({
      method: 'GET',
      url: '/api/friends/activities',
      headers: moi.headers,
    });
    expect(response.statusCode).toBe(200);
    const [activity] = response.json().activities;
    expect(activity).toMatchObject({
      activityType: 'run',
      distanceMeters: 10_000,
      startedAt: '2026-11-17T07:00:00.000Z',
      player: { id: ami.playerId },
    });
    expect(activity).not.toHaveProperty('coordinates');
    expect(activity.player).not.toHaveProperty('email');

    const tooMany = await app.inject({
      method: 'GET',
      url: '/api/friends/activities?limit=51',
      headers: moi.headers,
    });
    expect(tooMany.statusCode).toBe(400);
  });

  it('sans sortie GPS : aucune suggestion', async () => {
    const moi = await registerPlayer(app);
    const response = await app.inject({
      method: 'GET',
      url: '/api/friends/suggestions',
      headers: moi.headers,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ suggestions: [] });
  });
});
