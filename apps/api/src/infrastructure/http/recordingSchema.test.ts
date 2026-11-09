import { describe, expect, it } from 'vitest';
import { recordingSchema } from './recordingSchema.js';
import { recordedActivity } from '../../test/recordingFixture.js';

describe('recording schema limits', () => {
  it.each([
    ['samples', 100000],
    ['events', 10000],
    ['segments', 10000],
  ] as const)(
    'allows the %s limit and rejects one extra entry',
    (key, limit) => {
      const recording = recordedActivity().recording!;
      const item = recording[key][0];
      const atLimit = { ...recording, [key]: Array(limit).fill(item) };
      expect(recordingSchema.safeParse(atLimit).success).toBe(true);
      expect(
        recordingSchema.safeParse({
          ...atLimit,
          [key]: Array(limit + 1).fill(item),
        }).success,
      ).toBe(false);
    },
  );

  it('bounds each index collection and rejects unknown fields', () => {
    const r = recordedActivity().recording!;
    expect(
      recordingSchema.safeParse({
        ...r,
        segments: [{ reason: 'start', sampleIndices: Array(100001).fill(0) }],
      }).success,
    ).toBe(false);
    expect(
      recordingSchema.safeParse({ ...r, secret: 'ignored?' }).success,
    ).toBe(false);
  });
});
