import { describe, expect, it, vi } from 'vitest';
import { ActivityService } from './activityService.js';
import { AntiCheatService } from './antiCheatService.js';
import type { IActivityRepository } from '../ports/activityRepository.js';
import type { IPlayerRepository } from '../ports/playerRepository.js';
import type { IEventPublisher } from '../ports/eventPublisher.js';
import type { Activity, CreateActivityInput } from '../entities/activity.js';
import type { Player } from '../entities/player.js';

describe('ActivityService', () => {
  const mockPlayer: Player = {
    id: 'player-1',
    username: 'runner_hero',
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
    };

    const playerRepo: IPlayerRepository = {
      findById: vi.fn(async (id) => (id === player.id ? player : null)),
      findByUsername: vi.fn(async (u) => (u === player.username ? player : null)),
      create: vi.fn(async (p) => p),
      updateExperienceAndLevel: vi.fn(async (id, exp, lvl) => {
        player = { ...player, experience: exp, level: lvl };
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
    expect(playerRepo.updateExperienceAndLevel).toHaveBeenCalledWith('player-1', 1200, 2);

    // Verify event published for RabbitMQ
    expect(eventPublisher.publish).toHaveBeenCalledOnce();
    expect(publishedEvents[0].routingKey).toBe('activity.completed');
    expect(publishedEvents[0].payload).toMatchObject({
      playerId: 'player-1',
      distanceMeters: 3000,
      xpEarned: 400,
    });
  });
});
