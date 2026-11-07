import { describe, expect, it } from 'vitest';
import { AntiCheatService } from './antiCheatService.js';
import type { CreateActivityInput } from '../entities/activity.js';

describe('AntiCheatService', () => {
  const service = new AntiCheatService();

  it('accepts a valid running workout within realistic physical limits', () => {
    const validRun: CreateActivityInput = {
      playerId: 'player-1',
      activityType: 'run',
      startedAt: new Date('2026-11-07T10:00:00Z'),
      endedAt: new Date('2026-11-07T10:30:00Z'),
      durationSeconds: 1800, // 30 minutes
      distanceMeters: 5000,  // 5 km -> 10 km/h (2.78 m/s)
      coordinates: [
        [2.3522, 48.8566],
        [2.3530, 48.8575],
        [2.3540, 48.8585],
      ],
    };

    const result = service.validateActivity(validRun);
    expect(result.isValid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('rejects an activity where endedAt is before startedAt', () => {
    const invalidTime: CreateActivityInput = {
      playerId: 'player-1',
      activityType: 'run',
      startedAt: new Date('2026-11-07T10:30:00Z'),
      endedAt: new Date('2026-11-07T10:00:00Z'),
      durationSeconds: 1800,
      distanceMeters: 5000,
      coordinates: [],
    };

    const result = service.validateActivity(invalidTime);
    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/chronology|temporal/i);
  });

  it('rejects a run with excessive average speed (> 35 km/h as per AGENTS.md)', () => {
    const superhumanRun: CreateActivityInput = {
      playerId: 'player-1',
      activityType: 'run',
      startedAt: new Date('2026-11-07T10:00:00Z'),
      endedAt: new Date('2026-11-07T10:05:00Z'),
      durationSeconds: 300, // 5 minutes
      distanceMeters: 5000, // 5000m / 300s = 16.67 m/s = 60 km/h
      coordinates: [],
    };

    const result = service.validateActivity(superhumanRun);
    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/speed|vitesse/i);
  });

  it('allows cycling up to 90 km/h but rejects cycling exceeding 90 km/h', () => {
    const fastBike: CreateActivityInput = {
      playerId: 'player-1',
      activityType: 'bike',
      startedAt: new Date('2026-11-07T10:00:00Z'),
      endedAt: new Date('2026-11-07T10:10:00Z'),
      durationSeconds: 600, // 10 minutes
      distanceMeters: 8000, // 8 km in 10 min = 48 km/h -> valid for bike
      coordinates: [],
    };
    expect(service.validateActivity(fastBike).isValid).toBe(true);

    const carSpeedBike: CreateActivityInput = {
      playerId: 'player-1',
      activityType: 'bike',
      startedAt: new Date('2026-11-07T10:00:00Z'),
      endedAt: new Date('2026-11-07T10:05:00Z'),
      durationSeconds: 300, // 5 minutes
      distanceMeters: 10000, // 10 km in 5 min = 120 km/h -> rejected
      coordinates: [],
    };
    const result = service.validateActivity(carSpeedBike);
    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/speed|vitesse/i);
  });

  it('rejects GPS teleportation (massive distance between two points in short time)', () => {
    // Paris to Lyon in 10 seconds
    const teleportation: CreateActivityInput = {
      playerId: 'player-1',
      activityType: 'run',
      startedAt: new Date('2026-11-07T10:00:00Z'),
      endedAt: new Date('2026-11-07T10:00:10Z'),
      durationSeconds: 10,
      distanceMeters: 400000, // 400 km
      coordinates: [
        [2.3522, 48.8566], // Paris
        [4.8357, 45.7640], // Lyon
      ],
    };

    const result = service.validateActivity(teleportation);
    expect(result.isValid).toBe(false);
  });
});
