import type { ActivityRecording } from './activityRecording.js';
export type ActivityType = 'walk' | 'run' | 'bike' | 'hike';

export interface GeoPoint {
  longitude: number;
  latitude: number;
}

export type CoordinatePair = [longitude: number, latitude: number];

export interface Activity {
  id: string;
  playerId: string;
  activityType: ActivityType;
  startedAt: Date;
  endedAt: Date;
  durationSeconds: number;
  distanceMeters: number;
  elevationGainMeters: number;
  coordinates: CoordinatePair[];
  recording?: ActivityRecording;
  createdAt: Date;
}

export interface CreateActivityInput {
  playerId: string;
  activityType: ActivityType;
  startedAt: Date;
  endedAt: Date;
  durationSeconds: number;
  distanceMeters: number;
  elevationGainMeters?: number;
  coordinates: CoordinatePair[];
  recording?: ActivityRecording;
}
