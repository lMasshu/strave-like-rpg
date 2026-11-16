import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { z } from 'zod';
import { recordingSchema } from './recordingSchema.js';
import { AntiCheatService } from '../../core/services/antiCheatService.js';
import { ActivityService } from '../../core/services/activityService.js';
import { InMemoryActivityRepository } from '../repositories/inMemory/inMemoryActivityRepo.js';
import { InMemoryPlayerRepository } from '../repositories/inMemory/inMemoryPlayerRepo.js';
import { InMemoryEventPublisher } from '../events/inMemoryEventPublisher.js';
import type { IActivityRepository } from '../../core/ports/activityRepository.js';
import type { IPlayerRepository } from '../../core/ports/playerRepository.js';
import type { IEventPublisher } from '../../core/ports/eventPublisher.js';

export interface AppDependencies {
  activityRepo?: IActivityRepository;
  playerRepo?: IPlayerRepository;
  eventPublisher?: IEventPublisher;
}

const createActivitySchema = z.object({
  activityType: z.enum(['walk', 'run', 'bike', 'hike']),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationSeconds: z.number().nonnegative(),
  distanceMeters: z.number().nonnegative(),
  elevationGainMeters: z.number().optional().default(0),
  coordinates: z
    .array(z.tuple([z.number(), z.number()]))
    .optional()
    .default([]),
  recording: recordingSchema.optional(),
});

export async function buildApp(
  deps?: AppDependencies,
): Promise<FastifyInstance> {
  const app = fastify({ logger: false });

  await app.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  const activityRepo = deps?.activityRepo ?? new InMemoryActivityRepository();
  const playerRepo = deps?.playerRepo ?? new InMemoryPlayerRepository();
  const eventPublisher = deps?.eventPublisher ?? new InMemoryEventPublisher();
  const antiCheat = new AntiCheatService();
  const activityService = new ActivityService(
    activityRepo,
    playerRepo,
    eventPublisher,
    antiCheat,
  );

  // 0. Root info route
  app.get('/', async () => {
    return {
      service: 'stride-quest-api',
      status: 'online',
      message: "Bienvenue sur l'API REST de Stride Quest. Pour l'application mobile, ouvrez http://localhost:5173",
      frontendUrl: 'http://localhost:5173',
      healthcheck: '/health',
    };
  });

  // 1. Healthcheck route
  app.get('/health', async () => {
    return {
      status: 'ok',
      service: 'stride-quest-api',
      timestamp: new Date().toISOString(),
    };
  });

  // Helper to extract authenticated/current player ID from Authorization Bearer or x-player-id
  const extractSubFromBearer = (authHeader: unknown): string | null => {
    if (typeof authHeader !== 'string') return null;
    const parts = authHeader.trim().split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') return null;
    const token = parts[1];
    try {
      const jwtSegments = token.split('.');
      if (jwtSegments.length >= 2) {
        const payloadBase64 = jwtSegments[1].replace(/-/g, '+').replace(/_/g, '/');
        const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf-8');
        const payload = JSON.parse(payloadJson);
        if (typeof payload?.sub === 'string' && payload.sub.trim()) {
          return payload.sub.trim();
        }
      }
    } catch {
      // Ignorer si ce n'est pas un JWT décodable
    }
    return null;
  };

  const getPlayerId = (req: { headers: Record<string, unknown> }): string => {
    const bearerSub = extractSubFromBearer(req.headers['authorization']);
    if (bearerSub) {
      return bearerSub;
    }
    const headerId = req.headers['x-player-id'];
    if (typeof headerId === 'string' && headerId.trim()) {
      return headerId.trim();
    }
    return 'player-default-001';
  };

  // 2. Player routes
  app.get('/api/players/me', async (req, reply) => {
    const playerId = getPlayerId(req);
    let player = await playerRepo.findById(playerId);
    if (!player && (playerId.includes('|') || req.headers['authorization'])) {
      // Provisionne automatiquement le joueur Auth0
      player = await playerRepo.create({
        id: playerId,
        username: `adventurer_${playerId.slice(-6)}`,
        level: 1,
        experience: 0,
        createdAt: new Date(),
      });
    }
    if (!player) {
      return reply.status(404).send({ error: 'Player not found' });
    }
    return player;
  });

  app.get('/api/players/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const player = await playerRepo.findById(id);
    if (!player) {
      return reply.status(404).send({ error: 'Player not found' });
    }
    return player;
  });

  // 3. Activity routes
  app.post(
    '/api/activities',
    { bodyLimit: 32 * 1024 * 1024 },
    async (req, reply) => {
      const parseResult = createActivitySchema.safeParse(req.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Invalid payload schema',
          details: parseResult.error.format(),
        });
      }

      const playerId = getPlayerId(req);
      // Auto-provisionne le joueur Auth0 s'il n'existe pas encore
      const existingPlayer = await playerRepo.findById(playerId);
      if (!existingPlayer && (playerId.includes('|') || req.headers['authorization'])) {
        await playerRepo.create({
          id: playerId,
          username: `adventurer_${playerId.slice(-6)}`,
          level: 1,
          experience: 0,
          createdAt: new Date(),
        });
      }
      const body = parseResult.data;

      try {
        const result = await activityService.recordActivity({
          playerId,
          activityType: body.activityType,
          startedAt: new Date(body.startedAt),
          endedAt: new Date(body.endedAt),
          durationSeconds: body.durationSeconds,
          distanceMeters: body.distanceMeters,
          elevationGainMeters: body.elevationGainMeters,
          coordinates: body.coordinates,
          recording: body.recording,
        });

        return reply.status(201).send({
          activityId: result.activity.id,
          xpEarned: result.xpEarned,
          newLevel: result.newLevel,
          previousLevel: result.previousLevel,
          levelUp: result.levelUp,
          totalExperience: result.totalExperience,
          distanceMeters: result.activity.distanceMeters,
          durationSeconds: result.activity.durationSeconds,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return reply.status(400).send({ error: message });
      }
    },
  );

  app.get('/api/activities/me', async (req) => {
    const playerId = getPlayerId(req);
    const activities = await activityService.getPlayerActivities(playerId);
    return { activities };
  });

  app.get('/api/activities/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const activity = await activityService.getActivityById(id);
    if (!activity) {
      return reply.status(404).send({ error: 'Activity not found' });
    }
    return activity;
  });

  return app;
}
