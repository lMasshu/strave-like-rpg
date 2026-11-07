import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';

describe('Fastify REST API', () => {
  it('GET /health returns status ok', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'ok', service: 'stride-quest-api' });
  });

  it('GET /api/players/me returns the authenticated/default player', async () => {
    const app = await buildApp();
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
    const app = await buildApp();
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
    const app = await buildApp();
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
});
