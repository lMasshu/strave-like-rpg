import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { recordedActivity } from '../../test/recordingFixture.js';
import type { CreateActivityInput } from '../../core/entities/activity.js';
import { readFileSync } from 'node:fs';

const corruptions: [string, (input: CreateActivityInput) => void][] = [
  [
    'latitude',
    (i) => {
      i.recording!.samples[0].latitude = 91;
    },
  ],
  [
    'point in pause',
    (i) => {
      i.recording!.samples[2].timestampMs = 105000;
    },
  ],
  [
    'invalid active duration',
    (i) => {
      i.recording!.activeDurationMs = 10000;
    },
  ],
  [
    'duplicate index',
    (i) => {
      i.recording!.segments[1].sampleIndices = [1, 2];
    },
  ],
];

describe('recording HTTP round-trip', () => {
  it('accepts the documented mobile wire fixture', async () => {
    const app = await buildApp();
    try {
      const payload = JSON.parse(
        readFileSync('../../docs/api/recording.example.json', 'utf8'),
      ) as Record<string, unknown>;
      const response = await app.inject({
        method: 'POST',
        url: '/api/activities',
        payload,
      });
      expect(response.statusCode).toBe(201);
      const detail = await app.inject({
        method: 'GET',
        url: `/api/activities/${response.json().activityId}`,
      });
      expect(detail.json().recording).toEqual(recordedActivity().recording);
    } finally {
      await app.close();
    }
  });

  it('accepts a body above the old 1 MiB limit but rejects above 32 MiB', async () => {
    const app = await buildApp();
    try {
      const input = recordedActivity();
      const response = await app.inject({
        method: 'POST',
        url: '/api/activities',
        payload: {
          ...input,
          startedAt: input.startedAt.toISOString(),
          endedAt: input.endedAt.toISOString(),
          padding: 'x'.repeat(1024 * 1024 + 1),
        },
      });
      expect(response.statusCode).toBe(201);
      const tooLarge = await app.inject({
        method: 'POST',
        url: '/api/activities',
        headers: {
          'content-type': 'application/json',
          'content-length': String(32 * 1024 * 1024 + 1),
        },
        payload: '{}',
      });
      expect(tooLarge.statusCode).toBe(413);
    } finally {
      await app.close();
    }
  });
  it('preserves the complete recording in detail and history', async () => {
    const app = await buildApp();
    try {
      const input = recordedActivity();
      const response = await app.inject({
        method: 'POST',
        url: '/api/activities',
        payload: {
          ...input,
          startedAt: input.startedAt.toISOString(),
          endedAt: input.endedAt.toISOString(),
        },
      });
      expect(response.statusCode).toBe(201);
      const detail = await app.inject({
        method: 'GET',
        url: `/api/activities/${response.json().activityId}`,
      });
      expect(detail.json().recording).toEqual(input.recording);
      const history = await app.inject({
        method: 'GET',
        url: '/api/activities/me',
      });
      expect(history.json().activities[0].recording).toEqual(input.recording);
    } finally {
      await app.close();
    }
  });
  it.each(corruptions)(
    'rejects %s without awarding XP',
    async (_name, corrupt) => {
      const app = await buildApp();
      try {
        const profile = (
          await app.inject({ method: 'GET', url: '/api/players/me' })
        ).json();
        const input = recordedActivity();
        corrupt(input);
        const response = await app.inject({
          method: 'POST',
          url: '/api/activities',
          payload: {
            ...input,
            startedAt: input.startedAt.toISOString(),
            endedAt: input.endedAt.toISOString(),
          },
        });
        expect(response.statusCode).toBe(400);
        expect(
          (await app.inject({ method: 'GET', url: '/api/players/me' })).json(),
        ).toEqual(profile);
      } finally {
        await app.close();
      }
    },
  );
});
