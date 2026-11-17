import { describe, expect, it, vi } from 'vitest';
import { ActivityService, DuplicateActivityError } from './activityService.js';
import { AntiCheatService } from './antiCheatService.js';
import type { IActivityRepository } from '../ports/activityRepository.js';
import type { IPlayerRepository } from '../ports/playerRepository.js';
import type { IEventPublisher } from '../ports/eventPublisher.js';
import type { Activity, CreateActivityInput } from '../entities/activity.js';
import { calculateLevel, type Player } from '../entities/player.js';

describe('ActivityService', () => {
  const mockPlayer: Player = {
    id: 'player-1',
    username: 'runner_hero',
    email: 'runner@example.com',
    passwordHash: 'scrypt$hash',
    auth0Sub: null,
    level: 1,
    experience: 800,
    createdAt: new Date('2026-01-01'),
  };

  const createService = () => {
    const activities: Activity[] = [];
    let player = { ...mockPlayer };
    const publishedEvents: Array<{ routingKey: string; payload: unknown }> = [];

    const activityRepo: IActivityRepository = {
      create: vi.fn(async (act) => {
        activities.push(act);
        return act;
      }),
      findById: vi.fn(async (id) => activities.find((a) => a.id === id) || null),
      findByPlayerId: vi.fn(async (pId) => activities.filter((a) => a.playerId === pId)),
      findByExternalRef: vi.fn(
        async (pId, ref) =>
          activities.find(
            (a) =>
              a.playerId === pId &&
              a.external?.source === ref.source &&
              a.external?.id === ref.id,
          ) ?? null,
      ),
    };

    const playerRepo: IPlayerRepository = {
      findById: vi.fn(async (id) => (id === player.id ? player : null)),
      findByEmail: vi.fn(async () => null),
      findByUsername: vi.fn(async (u) => (u === player.username ? player : null)),
      findByAuth0Sub: vi.fn(async () => null),
      create: vi.fn(),
      linkAuth0Sub: vi.fn(),
      addExperience: vi.fn(async (_id, xpDelta) => {
        const experience = player.experience + xpDelta;
        player = { ...player, experience, level: calculateLevel(experience).level };
        return player;
      }),
    };

    const eventPublisher: IEventPublisher = {
      publish: vi.fn(async (routingKey, payload) => {
        publishedEvents.push({ routingKey, payload });
      }),
    };

    const antiCheat = new AntiCheatService();
    const service = new ActivityService(activityRepo, playerRepo, eventPublisher, antiCheat);

    return { service, activityRepo, playerRepo, eventPublisher, publishedEvents };
  };

  it('rejects an activity failing anti-cheat checks', async () => {
    const { service } = createService();
    const cheatInput: CreateActivityInput = {
      playerId: 'player-1',
      activityType: 'run',
      startedAt: new Date('2026-11-07T10:00:00Z'),
      endedAt: new Date('2026-11-07T10:01:00Z'),
      durationSeconds: 60,
      distanceMeters: 5000, // 300 km/h
      coordinates: [],
    };

    await expect(service.recordActivity(cheatInput)).rejects.toThrow(/speed|vitesse/i);
  });

  it('calculates XP, triggers level-up, persists activity and publishes RabbitMQ event', async () => {
    const { service, activityRepo, playerRepo, eventPublisher, publishedEvents } = createService();

    const validInput: CreateActivityInput = {
      playerId: 'player-1',
      activityType: 'run',
      startedAt: new Date('2026-11-07T10:00:00Z'),
      endedAt: new Date('2026-11-07T10:30:00Z'),
      durationSeconds: 1800,
      distanceMeters: 3000, // 3000m -> 300 XP
      elevationGainMeters: 50, // 50m D+ -> 100 XP (total 400 XP)
      coordinates: [
        [2.3522, 48.8566],
        [2.3530, 48.8575],
      ],
    };

    const result = await service.recordActivity(validInput);

    // Initial exp: 800 + 400 = 1200 XP -> Level 2 reached!
    expect(result.xpEarned).toBe(400);
    expect(result.previousLevel).toBe(1);
    expect(result.newLevel).toBe(2);
    expect(result.levelUp).toBe(true);
    expect(result.totalExperience).toBe(1200);

    // Verify activity persisted
    expect(activityRepo.create).toHaveBeenCalledOnce();
    expect(result.activity.id).toBeDefined();

    // Verify player updated
    expect(playerRepo.addExperience).toHaveBeenCalledWith('player-1', 400);

    // Verify event published for RabbitMQ
    expect(eventPublisher.publish).toHaveBeenCalledOnce();
    expect(publishedEvents[0].routingKey).toBe('activity.completed');
    expect(publishedEvents[0].payload).toMatchObject({
      playerId: 'player-1',
      distanceMeters: 3000,
      xpEarned: 400,
    });
  });

  it('refuse une séance de montre déjà importée sans toucher à l’XP ni publier d’événement', async () => {
    const { service, playerRepo, eventPublisher } = createService();
    const watchInput: CreateActivityInput = {
      playerId: 'player-1',
      activityType: 'run',
      startedAt: new Date('2026-11-16T07:00:00Z'),
      endedAt: new Date('2026-11-16T08:01:00Z'),
      durationSeconds: 3660,
      distanceMeters: 10350,
      coordinates: [],
      external: { source: 'health-connect', id: 'hc-1' },
    };

    const first = await service.recordActivity(watchInput);
    expect(first.activity.external).toEqual(watchInput.external);

    const duplicate = service.recordActivity(watchInput);
    await expect(duplicate).rejects.toBeInstanceOf(DuplicateActivityError);
    await expect(duplicate).rejects.toMatchObject({
      existingActivityId: first.activity.id,
    });
    expect(playerRepo.addExperience).toHaveBeenCalledOnce();
    expect(eventPublisher.publish).toHaveBeenCalledOnce();
  });
});
