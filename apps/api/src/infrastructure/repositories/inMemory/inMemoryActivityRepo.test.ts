import { expect, it } from 'vitest';
import { recordedActivity } from '../../../test/recordingFixture.js';
import { InMemoryActivityRepository } from './inMemoryActivityRepo.js';

it('isolates saved data, returned data and subsequent readers', async () => {
  const repo = new InMemoryActivityRepository();
  const input = {
    ...recordedActivity(),
    id: 'recorded',
    createdAt: new Date(110000),
    elevationGainMeters: 1,
  };
  const saved = await repo.create(input);
  input.recording!.samples[0].latitude = 0;
  saved.recording!.segments[0].sampleIndices.push(99);
  saved.startedAt.setTime(0);
  const detail = (await repo.findById(input.id))!;
  expect(detail.recording!.samples[0].latitude).toBe(48);
  expect(detail.recording!.segments[0].sampleIndices).toEqual([0, 1]);
  expect(detail.startedAt.getTime()).toBe(100000);
  detail.recording!.events[0].timestampMs = 1;
  const list = await repo.findByPlayerId(input.playerId);
  expect(list[0].recording!.events[0].timestampMs).toBe(100000);
  list[0].recording!.samples.length = 0;
  expect((await repo.findById(input.id))!.recording!.samples).toHaveLength(4);
});
