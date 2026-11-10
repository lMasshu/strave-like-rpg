import { z } from 'zod';

const timestamp = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const finite = z.number().finite();
export const recordingSchema = z
  .object({
    version: z.literal(1),
    requestedIntervalMs: z.literal(1000),
    elapsedDurationMs: z.number().int().nonnegative(),
    activeDurationMs: z.number().int().nonnegative(),
    samples: z
      .array(
        z
          .object({
            latitude: finite.min(-90).max(90),
            longitude: finite.min(-180).max(180),
            timestampMs: timestamp,
            altitudeMeters: finite.nullable(),
            horizontalAccuracyMeters: finite.nonnegative().nullable(),
            speedMetersPerSecond: finite.nonnegative().nullable(),
            speedSource: z.enum(['native', 'derived']).nullable(),
            source: z.enum(['gps', 'simulation']),
          })
          .strict(),
      )
      .max(100000),
    events: z
      .array(
        z
          .object({
            type: z.enum(['start', 'pause', 'resume', 'finish']),
            timestampMs: timestamp,
          })
          .strict(),
      )
      .min(2)
      .max(10000),
    segments: z
      .array(
        z
          .object({
            reason: z.enum(['start', 'resume', 'gps-gap', 'source-change']),
            sampleIndices: z
              .array(z.number().int().nonnegative())
              .min(1)
              .max(100000),
          })
          .strict(),
      )
      .max(10000),
  })
  .strict();
