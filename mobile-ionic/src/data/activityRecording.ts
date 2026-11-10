/** GPS measurements use WGS84 degrees, SI units and Unix UTC milliseconds. */
export interface RecordedSample {
  latitude: number;
  longitude: number;
  timestampMs: number;
  altitudeMeters: number | null;
  horizontalAccuracyMeters: number | null;
  speedMetersPerSecond: number | null;
  speedSource: "native" | "derived" | null;
  source: "gps" | "simulation";
}

export interface RecordingEvent {
  type: "start" | "pause" | "resume" | "finish";
  timestampMs: number;
}

export interface TrackSegment {
  sampleIndices: number[];
  reason: "start" | "resume" | "gps-gap" | "source-change";
}

export interface ActivityRecording {
  version: 1;
  requestedIntervalMs: 1000;
  samples: RecordedSample[];
  events: RecordingEvent[];
  segments: TrackSegment[];
  elapsedDurationMs: number;
  activeDurationMs: number;
}
