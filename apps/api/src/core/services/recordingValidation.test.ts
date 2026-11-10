import { describe, expect, it } from 'vitest';
import { recordedActivity } from '../../test/recordingFixture.js';
import { validateRecording } from './recordingValidation.js';
import type { CreateActivityInput } from '../entities/activity.js';

const corruptions: [string, (input: CreateActivityInput) => void][] = [
  [
    'latitude',
    (i) => {
      i.recording!.samples[0].latitude = 91;
    },
  ],
  [
    'longitude',
    (i) => {
      i.recording!.samples[0].longitude = 181;
    },
  ],
  [
    'negative accuracy',
    (i) => {
      i.recording!.samples[0].horizontalAccuracyMeters = -1;
    },
  ],
  [
    'negative speed',
    (i) => {
      i.recording!.samples[0].speedMetersPerSecond = -1;
    },
  ],
  [
    'unknown speed source',
    (i) => {
      i.recording!.samples[0].speedMetersPerSecond = null;
    },
  ],
  [
    'unordered points',
    (i) => {
      i.recording!.samples[1].timestampMs = 101000;
    },
  ],
  [
    'point before start',
    (i) => {
      i.recording!.samples[0].timestampMs = 99000;
    },
  ],
  [
    'point after end',
    (i) => {
      i.recording!.samples[3].timestampMs = 111000;
    },
  ],
  [
    'point in pause',
    (i) => {
      i.recording!.samples[2].timestampMs = 105000;
    },
  ],
  [
    'illegal events',
    (i) => {
      i.recording!.events[1].type = 'resume';
    },
  ],
  [
    'unordered events',
    (i) => {
      i.recording!.events[2].timestampMs = 103000;
    },
  ],
  [
    'wrong active duration',
    (i) => {
      i.recording!.activeDurationMs = 10000;
    },
  ],
  [
    'wrong elapsed duration',
    (i) => {
      i.recording!.elapsedDurationMs = 8000;
    },
  ],
  [
    'envelope duration',
    (i) => {
      i.durationSeconds = 9;
    },
  ],
  [
    'envelope date',
    (i) => {
      i.endedAt = new Date(110001);
    },
  ],
  [
    'envelope coordinates',
    (i) => {
      i.coordinates[0][1] = 47;
    },
  ],
  [
    'index bounds',
    (i) => {
      i.recording!.segments[1].sampleIndices = [4];
    },
  ],
  [
    'duplicate index',
    (i) => {
      i.recording!.segments[1].sampleIndices = [1, 2];
    },
  ],
  [
    'unordered indices',
    (i) => {
      i.recording!.segments[0].sampleIndices = [1, 0];
    },
  ],
  [
    'poor accuracy in track',
    (i) => {
      i.recording!.segments[1].sampleIndices.push(3);
      i.coordinates.push([2, 49]);
    },
  ],
  [
    'pause bridge',
    (i) => {
      i.recording!.segments = [{ reason: 'start', sampleIndices: [0, 1, 2] }];
    },
  ],
];

describe('recording validation', () => {
  it('accepts a complete journal and legacy activities without one', () => {
    expect(validateRecording(recordedActivity()).isValid).toBe(true);
    const legacy = recordedActivity();
    delete legacy.recording;
    expect(validateRecording(legacy).isValid).toBe(true);
  });
  it.each(corruptions)('rejects %s', (_name, corrupt) => {
    const input = recordedActivity();
    corrupt(input);
    expect(validateRecording(input).isValid).toBe(false);
  });
});
