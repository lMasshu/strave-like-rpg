import type { CreateActivityInput } from '../core/entities/activity.js';

export function recordedActivity(): CreateActivityInput {
  return {
    playerId: 'player-default-001',
    activityType: 'run',
    startedAt: new Date(100000),
    endedAt: new Date(110000),
    durationSeconds: 8,
    distanceMeters: 3.335,
    elevationGainMeters: 1,
    coordinates: [
      [2, 48],
      [2, 48.00003],
      [2, 49],
    ],
    recording: {
      version: 1,
      requestedIntervalMs: 1000,
      elapsedDurationMs: 10000,
      activeDurationMs: 8000,
      events: [
        { type: 'start', timestampMs: 100000 },
        { type: 'pause', timestampMs: 104000 },
        { type: 'resume', timestampMs: 106000 },
        { type: 'finish', timestampMs: 110000 },
      ],
      samples: [
        {
          latitude: 48,
          longitude: 2,
          timestampMs: 101000,
          altitudeMeters: 30,
          horizontalAccuracyMeters: 5,
          speedMetersPerSecond: 3.125,
          speedSource: 'native',
          source: 'gps',
        },
        {
          latitude: 48.00003,
          longitude: 2,
          timestampMs: 102000,
          altitudeMeters: 31,
          horizontalAccuracyMeters: 5,
          speedMetersPerSecond: 3.125,
          speedSource: 'native',
          source: 'gps',
        },
        {
          latitude: 49,
          longitude: 2,
          timestampMs: 107000,
          altitudeMeters: null,
          horizontalAccuracyMeters: 5,
          speedMetersPerSecond: null,
          speedSource: null,
          source: 'gps',
        },
        {
          latitude: 49,
          longitude: 2,
          timestampMs: 108000,
          altitudeMeters: null,
          horizontalAccuracyMeters: null,
          speedMetersPerSecond: null,
          speedSource: null,
          source: 'gps',
        },
      ],
      segments: [
        { reason: 'start', sampleIndices: [0, 1] },
        { reason: 'resume', sampleIndices: [2] },
      ],
    },
  };
}
