import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';

describe('Fastify REST API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  }, 15000);

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns status ok', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'ok', service: 'stride-quest-api' });
  });

  it('GET /api/players/me returns the authenticated/default player', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/players/me',
      headers: {
        'x-player-id': 'player-default-001',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: 'player-default-001',
      username: 'Lucas_Run',
      level: 1,
    });
  });

  it('POST /api/activities accepts valid activity, records XP and returns summary', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/activities',
      headers: {
        'x-player-id': 'player-default-001',
      },
      payload: {
        activityType: 'run',
        startedAt: '2026-11-07T10:00:00.000Z',
        endedAt: '2026-11-07T10:30:00.000Z',
        durationSeconds: 1800,
        distanceMeters: 5000,
        elevationGainMeters: 40,
        coordinates: [
          [2.3522, 48.8566],
          [2.3530, 48.8575],
        ],
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body).toHaveProperty('activityId');
    expect(body.xpEarned).toBe(580); // 500 XP distance + 80 XP elevation
    expect(body.totalExperience).toBe(1400); // 820 + 580 = 1400
    expect(body.newLevel).toBe(2);
    expect(body.levelUp).toBe(true);

    // Verify GET /api/activities/me lists this newly created activity
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/activities/me',
      headers: {
        'x-player-id': 'player-default-001',
      },
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().activities).toHaveLength(1);
    expect(listRes.json().activities[0].distanceMeters).toBe(5000);
  });

  it('POST /api/activities rejects invalid velocity payloads', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/activities',
      headers: {
        'x-player-id': 'player-default-001',
      },
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

  it('POST /api/activities extracts user.sub from Authorization Bearer token', async () => {
    // Simule un token JWT Auth0 contenant un sub Google OAuth2
    const fakePayload = Buffer.from(
      JSON.stringify({ sub: 'google-oauth2|987654321', name: 'Adventurer Test' }),
    ).toString('base64');
    const fakeJwt = `eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.${fakePayload}.fakesig`;

    const response = await app.inject({
      method: 'POST',
      url: '/api/activities',
      headers: {
        authorization: `Bearer ${fakeJwt}`,
      },
      payload: {
        activityType: 'walk',
        startedAt: '2026-11-07T14:00:00.000Z',
        endedAt: '2026-11-07T14:20:00.000Z',
        durationSeconds: 1200,
        distanceMeters: 1500,
        elevationGainMeters: 5,
        coordinates: [],
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body).toHaveProperty('activityId');
    expect(body.xpEarned).toBe(160); // 150 + 10 = 160 XP

    // Vérifie que le profil joueur me retourne bien le sub extrait
    const profileRes = await app.inject({
      method: 'GET',
      url: '/api/players/me',
      headers: {
        authorization: `Bearer ${fakeJwt}`,
      },
    });
    expect(profileRes.statusCode).toBe(200);
    expect(profileRes.json().id).toBe('google-oauth2|987654321');
  });
});
