import type { SaveActivityDto } from "./apiClient";
import type { RecordingSnapshot } from "./workoutRecording";

/** Serialize the finished measurement journal without re-creating event times. */
export function createActivityPayload(
  snapshot: RecordingSnapshot,
  activityType: SaveActivityDto["activityType"],
): SaveActivityDto {
  if (snapshot.endedAtMs === null)
    throw new Error("La course doit être terminée avant sa sauvegarde.");
  return {
    activityType,
    startedAt: new Date(snapshot.startedAtMs).toISOString(),
    endedAt: new Date(snapshot.endedAtMs).toISOString(),
    durationSeconds: snapshot.recording.activeDurationMs / 1000,
    distanceMeters: snapshot.distanceMeters,
    elevationGainMeters: snapshot.elevationGainMeters,
    coordinates: snapshot.recording.segments.flatMap((segment) =>
      segment.sampleIndices.map((index): [number, number] => {
        const point = snapshot.recording.samples[index];
        return [point.longitude, point.latitude];
      }),
    ),
    recording: structuredClone(snapshot.recording),
  };
}
