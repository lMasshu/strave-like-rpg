import type { CreateActivityInput } from '../entities/activity.js';

const invalid = (reason: string): { isValid: false; reason: string } => ({
  isValid: false,
  reason: `Invalid recording: ${reason}`,
});
const nullableFinite = (value: number | null): boolean =>
  value === null || Number.isFinite(value);

/** Contract consistency only; this is not proof of physical effort or GPS authenticity. */
export function validateRecording(input: CreateActivityInput): {
  isValid: boolean;
  reason?: string;
} {
  const r = input.recording;
  if (!r) return { isValid: true };
  if (
    r.version !== 1 ||
    r.requestedIntervalMs !== 1000 ||
    r.samples.length > 100000 ||
    r.events.length > 10000 ||
    r.segments.length > 10000
  )
    return invalid('version or collection limit');
  const events = r.events;
  if (
    events.length < 2 ||
    events[0].type !== 'start' ||
    events.at(-1)!.type !== 'finish'
  )
    return invalid('start and finish required');
  let status: 'idle' | 'recording' | 'paused' | 'finished' = 'idle';
  let previousTime = 0;
  let activeDurationMs = 0;
  for (const event of events) {
    if (
      !Number.isSafeInteger(event.timestampMs) ||
      event.timestampMs <= 0 ||
      event.timestampMs < previousTime
    )
      return invalid('event timestamp');
    if (status === 'recording')
      activeDurationMs += event.timestampMs - previousTime;
    if (event.type === 'start' && status === 'idle') status = 'recording';
    else if (event.type === 'resume' && status === 'paused')
      status = 'recording';
    else if (event.type === 'pause' && status === 'recording')
      status = 'paused';
    else if (
      event.type === 'finish' &&
      (status === 'recording' || status === 'paused')
    )
      status = 'finished';
    else return invalid('illegal event transition');
    previousTime = event.timestampMs;
  }
  const start = events[0].timestampMs;
  const end = events.at(-1)!.timestampMs;
  if (
    input.startedAt.getTime() !== start ||
    input.endedAt.getTime() !== end ||
    !Number.isSafeInteger(r.elapsedDurationMs) ||
    !Number.isSafeInteger(r.activeDurationMs) ||
    r.elapsedDurationMs !== end - start ||
    r.activeDurationMs !== activeDurationMs ||
    !Number.isFinite(input.durationSeconds) ||
    Math.abs(input.durationSeconds * 1000 - activeDurationMs) > 1
  )
    return invalid('duration or envelope time');

  const blocks: number[] = [];
  let eventIndex = 0;
  let block = 0;
  let lastActiveWindow = -1;
  let lastAccurateTime: number | null = null;
  for (let index = 0; index < r.samples.length; index++) {
    const point = r.samples[index];
    if (
      !Number.isFinite(point.latitude) ||
      Math.abs(point.latitude) > 90 ||
      !Number.isFinite(point.longitude) ||
      Math.abs(point.longitude) > 180 ||
      !Number.isSafeInteger(point.timestampMs) ||
      point.timestampMs <= start ||
      point.timestampMs > end ||
      (index > 0 && point.timestampMs <= r.samples[index - 1].timestampMs) ||
      !nullableFinite(point.altitudeMeters) ||
      !nullableFinite(point.horizontalAccuracyMeters) ||
      !nullableFinite(point.speedMetersPerSecond) ||
      (point.horizontalAccuracyMeters !== null &&
        point.horizontalAccuracyMeters < 0) ||
      (point.speedMetersPerSecond !== null && point.speedMetersPerSecond < 0) ||
      (point.speedMetersPerSecond === null && point.speedSource !== null) ||
      !['gps', 'simulation'].includes(point.source) ||
      (point.speedSource !== null &&
        !['native', 'derived'].includes(point.speedSource))
    )
      return invalid('sample values or order');
    // A fix received at the same millisecond as pause/finish may precede that action.
    while (
      eventIndex + 1 < events.length &&
      events[eventIndex + 1].timestampMs < point.timestampMs
    )
      eventIndex++;
    const event = events[eventIndex];
    if (
      !['start', 'resume'].includes(event.type) ||
      point.timestampMs <= event.timestampMs
    )
      return invalid('sample outside an active interval');
    const good =
      point.horizontalAccuracyMeters !== null &&
      point.horizontalAccuracyMeters <= 25;
    if (
      eventIndex !== lastActiveWindow ||
      (index > 0 && point.source !== r.samples[index - 1].source)
    ) {
      block++;
      lastAccurateTime = null;
    } else if (
      good &&
      lastAccurateTime !== null &&
      point.timestampMs - lastAccurateTime > 5000
    )
      block++;
    blocks.push(block);
    lastActiveWindow = eventIndex;
    if (good) lastAccurateTime = point.timestampMs;
  }

  let previousIndex = -1;
  let count = 0;
  for (const segment of r.segments) {
    if (
      !['start', 'resume', 'gps-gap', 'source-change'].includes(
        segment.reason,
      ) ||
      segment.sampleIndices.length === 0
    )
      return invalid('segment');
    const first = segment.sampleIndices[0];
    for (const index of segment.sampleIndices) {
      if (
        ++count > 100000 ||
        !Number.isSafeInteger(index) ||
        index <= previousIndex ||
        index >= r.samples.length ||
        index < 0
      )
        return invalid('segment index');
      const point = r.samples[index];
      if (
        point.horizontalAccuracyMeters === null ||
        point.horizontalAccuracyMeters > 25 ||
        blocks[index] !== blocks[first]
      )
        return invalid('segment quality or interruption bridge');
      const coordinate = input.coordinates[count - 1];
      if (
        !coordinate ||
        coordinate[0] !== point.longitude ||
        coordinate[1] !== point.latitude
      )
        return invalid('coordinate projection');
      previousIndex = index;
    }
  }
  if (input.coordinates.length !== count) return invalid('coordinate count');
  return { isValid: true };
}
