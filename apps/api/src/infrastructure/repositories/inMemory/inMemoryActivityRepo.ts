import type {
  Activity,
  ActivitySummary,
  ExternalActivityRef,
} from '../../../core/entities/activity.js';
import {
  DuplicateActivityError,
  type IActivityRepository,
} from '../../../core/ports/activityRepository.js';

export class InMemoryActivityRepository implements IActivityRepository {
  private readonly activities = new Map<string, Activity>();

  async create(activity: Activity): Promise<Activity> {
    if (activity.external) {
      const existing = await this.findByExternalRef(activity.playerId, activity.external);
      if (existing) throw new DuplicateActivityError(existing.id);
    }
    this.activities.set(activity.id, structuredClone(activity));
    return structuredClone(activity);
  }

  async findById(id: string): Promise<Activity | null> {
    const act = this.activities.get(id);
    return act ? structuredClone(act) : null;
  }

  async findByPlayerId(playerId: string, limit = 20): Promise<Activity[]> {
    return this.newestFirst((a) => a.playerId === playerId)
      .slice(0, limit)
      .map((a) => structuredClone(a));
  }

  async findSummariesBetween(
    playerId: string,
    from: Date,
    to: Date,
    limit: number,
  ): Promise<ActivitySummary[]> {
    return this.newestFirst(
      (a) =>
        a.playerId === playerId &&
        a.startedAt.getTime() >= from.getTime() &&
        a.startedAt.getTime() < to.getTime(),
    )
      .slice(0, limit)
      .map(({ coordinates: _coordinates, recording: _recording, ...summary }) =>
        structuredClone(summary),
      );
  }

  /** Plus récente en premier ; à départ identique, la dernière enregistrée d'abord. */
  private newestFirst(predicate: (activity: Activity) => boolean): Activity[] {
    return Array.from(this.activities.values())
      .filter(predicate)
      .sort(
        (a, b) =>
          b.startedAt.getTime() - a.startedAt.getTime() ||
          b.createdAt.getTime() - a.createdAt.getTime(),
      );
  }

  async findByExternalRef(
    playerId: string,
    ref: ExternalActivityRef,
  ): Promise<Activity | null> {
    for (const activity of this.activities.values()) {
      if (
        activity.playerId === playerId &&
        activity.external?.source === ref.source &&
        activity.external.id === ref.id
      ) {
        return structuredClone(activity);
      }
    }
    return null;
  }
}
