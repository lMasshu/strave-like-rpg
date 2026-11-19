import fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { z } from 'zod';
import { recordingSchema } from './recordingSchema.js';
import { AntiCheatService } from '../../core/services/antiCheatService.js';
import {
  ActivityService,
  DuplicateActivityError,
} from '../../core/services/activityService.js';
import {
  AuthService,
  EmailAlreadyUsedError,
  type IGoogleIdentityVerifier,
  InvalidCredentialsError,
  UnverifiedGoogleEmailError,
  UsernameTakenError,
} from '../../core/services/authService.js';
import {
  type Player,
  toPlayerProfile,
  toPublicPlayer,
} from '../../core/entities/player.js';
import { InMemoryActivityRepository } from '../repositories/inMemory/inMemoryActivityRepo.js';
import { InMemoryPlayerRepository } from '../repositories/inMemory/inMemoryPlayerRepo.js';
import { InMemorySocialRepository } from '../repositories/inMemory/inMemorySocialRepo.js';
import { InMemoryEventPublisher } from '../events/inMemoryEventPublisher.js';
import { InMemoryCoachRepository } from '../repositories/inMemory/inMemoryCoachRepo.js';
import { CoachService } from '../../core/services/coachService.js';
import {
  OllamaClient,
  OllamaUnavailableError,
  type IOllamaClient,
} from '../../core/services/ollamaClient.js';
import {
  CannotFollowSelfError,
  FEED_DEFAULT_LIMIT,
  FEED_MAX_LIMIT,
  PlayerNotFoundError,
  SEARCH_DEFAULT_LIMIT,
  SEARCH_MAX_LIMIT,
  SocialService,
} from '../../core/services/socialService.js';
import type { ISocialRepository } from '../../core/ports/socialRepository.js';
import type { IActivityRepository } from '../../core/ports/activityRepository.js';
import type { IPlayerRepository } from '../../core/ports/playerRepository.js';
import type { IEventPublisher } from '../../core/ports/eventPublisher.js';
import type { ICoachRepository } from '../../core/ports/coachRepository.js';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string };
    user: { sub: string };
  }
}

export interface AppDependencies {
  /** Secret de signature des jetons de session (au moins 32 caractères). */
  jwtSecret: string;
  activityRepo?: IActivityRepository;
  playerRepo?: IPlayerRepository;
  coachRepo?: ICoachRepository;
  llmClient?: IOllamaClient;
  eventPublisher?: IEventPublisher;
  /** Amis et suggestions ; obligatoire avec des dépôts autres qu'en mémoire. */
  socialRepo?: ISocialRepository;
  /** Vérificateur Auth0 pour « Continuer avec Google » ; absent = connexion Google désactivée. */
  googleVerifier?: IGoogleIdentityVerifier | null;
  /** Tentatives d'authentification autorisées par minute et par adresse IP. */
  authRateLimitPerMinute?: number;
}

/** Durée de validité d'une session. */
export const SESSION_TTL = '7d';

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
  external: z
    .object({
      source: z.enum(['health-connect', 'apple-health']),
      id: z.string().trim().min(1).max(200),
      deviceName: z.string().trim().min(1).max(100).optional(),
    })
    .optional(),
});

export const MIN_PASSWORD_LENGTH = 12;

const emailSchema = z
  .string({ required_error: "L'e-mail est obligatoire" })
  .trim()
  .max(254, 'E-mail trop long')
  .email('E-mail invalide');

const registerSchema = z.object({
  email: emailSchema,
  password: z
    .string({ required_error: 'Le mot de passe est obligatoire' })
    .min(MIN_PASSWORD_LENGTH, `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères`)
    .max(128, 'Le mot de passe est trop long (128 caractères maximum)')
    .regex(/[A-Z]/, 'Le mot de passe doit contenir au moins une lettre majuscule')
    .regex(/[a-z]/, 'Le mot de passe doit contenir au moins une lettre minuscule')
    .regex(/[0-9]/, 'Le mot de passe doit contenir au moins un chiffre')
    .regex(/[^A-Za-z0-9]/, 'Le mot de passe doit contenir au moins un caractère spécial')
    .refine((value) => value.trim().length > 0, 'Le mot de passe ne peut pas être vide'),
  username: z
    .string({ required_error: 'Le pseudo est obligatoire' })
    .trim()
    .min(3, 'Le pseudo doit contenir au moins 3 caractères')
    .max(40, 'Le pseudo doit contenir au plus 40 caractères')
    .regex(/^[A-Za-z0-9_.-]+$/, 'Le pseudo ne peut contenir que lettres, chiffres, _ . -'),
});

const loginSchema = z.object({
  email: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(128),
});

const googleSchema = z.object({
  idToken: z.string().min(20).max(8192),
});

/** Un peu plus d'un an : couvre « l'année en cours » quel que soit le fuseau. */
const MAX_SUMMARY_SPAN_MS = 370 * 24 * 60 * 60 * 1000;

const summaryQuerySchema = z
  .object({
    from: z
      .string({ required_error: 'Paramètre from obligatoire (date ISO)' })
      .datetime({ offset: true, message: 'Paramètre from invalide (date ISO)' }),
    to: z
      .string({ required_error: 'Paramètre to obligatoire (date ISO)' })
      .datetime({ offset: true, message: 'Paramètre to invalide (date ISO)' }),
  })
  .refine((q) => Date.parse(q.to) > Date.parse(q.from), {
    message: 'to doit être postérieur à from',
  })
  .refine((q) => Date.parse(q.to) - Date.parse(q.from) <= MAX_SUMMARY_SPAN_MS, {
    message: 'Période trop longue (un an maximum)',
  });

const coachSettingsSchema = z.object({
  coachEnabled: z.boolean().optional(),
  coachGoal: z
    .enum(['casual', 'active', '5k', '10k', 'half-marathon', 'marathon'])
    .optional(),
});

const coachMessageSchema = z.object({
  message: z
    .string({ required_error: 'Le message est obligatoire' })
    .trim()
    .min(1, 'Le message ne peut pas être vide')
    .max(2000, 'Message trop long (2000 caractères maximum)'),
});

const playerSearchSchema = z.object({
  q: z.string().max(40, 'Recherche trop longue (40 caractères maximum)').optional().default(''),
  limit: z.coerce
    .number()
    .int('limit doit être un entier')
    .min(1, 'limit doit être au moins 1')
    .max(SEARCH_MAX_LIMIT, `limit vaut au plus ${SEARCH_MAX_LIMIT}`)
    .optional()
    .default(SEARCH_DEFAULT_LIMIT),
});

const feedQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int('limit doit être un entier')
    .min(1, 'limit doit être au moins 1')
    .max(FEED_MAX_LIMIT, `limit vaut au plus ${FEED_MAX_LIMIT}`)
    .optional()
    .default(FEED_DEFAULT_LIMIT),
});

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Données invalides';
}

export async function buildApp(deps: AppDependencies): Promise<FastifyInstance> {
  if (!deps?.jwtSecret || deps.jwtSecret.length < 32) {
    throw new Error('jwtSecret manquant ou trop court (32 caractères minimum)');
  }

  const app = fastify({ logger: false });

  await app.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });
  await app.register(jwt, {
    secret: deps.jwtSecret,
    sign: { algorithm: 'HS256', expiresIn: SESSION_TTL },
    verify: { algorithms: ['HS256'] },
  });
  // Limitation activée route par route (authentification uniquement).
  await app.register(rateLimit, { global: false });

  const activityRepo = deps.activityRepo ?? new InMemoryActivityRepository();
  const playerRepo = deps.playerRepo ?? new InMemoryPlayerRepository();
  const eventPublisher = deps.eventPublisher ?? new InMemoryEventPublisher();
  const googleVerifier = deps.googleVerifier ?? null;
  const antiCheat = new AntiCheatService();
  const activityService = new ActivityService(
    activityRepo,
    playerRepo,
    eventPublisher,
    antiCheat,
  );
  const authService = new AuthService(playerRepo);
  const coachRepo = deps.coachRepo ?? new InMemoryCoachRepository();
  const llmClient = deps.llmClient ?? new OllamaClient();
  const coachService = new CoachService(
    coachRepo,
    playerRepo,
    activityRepo,
    llmClient,
  );
  const socialService = new SocialService(defaultSocialRepo(deps, playerRepo, activityRepo), playerRepo);

  const authRateLimit = {
    rateLimit: { max: deps.authRateLimitPerMinute ?? 10, timeWindow: '1 minute' },
  };

  /** Rejette (401) toute requête sans jeton de session valide et signé par cette API. */
  const authenticate = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.status(401).send({ error: 'Authentification requise' });
    }
  };

  const sessionFor = (player: Player) => ({
    token: app.jwt.sign({ sub: player.id }),
    player: toPlayerProfile(player),
  });

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

  // 2. Authentification
  app.post('/api/auth/register', { config: authRateLimit }, async (req, reply) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: firstIssue(parsed.error) });
    }
    try {
      const player = await authService.register(parsed.data);
      return reply.status(201).send(sessionFor(player));
    } catch (err) {
      if (err instanceof EmailAlreadyUsedError || err instanceof UsernameTakenError) {
        return reply.status(409).send({ error: err.message });
      }
      throw err;
    }
  });

  app.post('/api/auth/login', { config: authRateLimit }, async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "L'e-mail et le mot de passe sont obligatoires" });
    }
    try {
      const player = await authService.login(parsed.data.email, parsed.data.password);
      return sessionFor(player);
    } catch (err) {
      if (err instanceof InvalidCredentialsError) {
        return reply.status(401).send({ error: err.message });
      }
      throw err;
    }
  });

  app.post('/api/auth/google', { config: authRateLimit }, async (req, reply) => {
    if (!googleVerifier) {
      return reply
        .status(503)
        .send({ error: "La connexion Google n'est pas configurée sur ce serveur" });
    }
    const parsed = googleSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Jeton Google manquant' });
    }

    let identity;
    try {
      identity = await googleVerifier.verify(parsed.data.idToken);
    } catch {
      return reply.status(401).send({ error: 'Jeton Google invalide ou expiré' });
    }
    try {
      return sessionFor(await authService.loginWithGoogle(identity));
    } catch (err) {
      if (err instanceof UnverifiedGoogleEmailError) {
        return reply.status(403).send({ error: err.message });
      }
      throw err;
    }
  });

  // 3. Player routes
  app.get('/api/players/me', { preHandler: authenticate }, async (req, reply) => {
    const player = await playerRepo.findById(req.user.sub);
    if (!player) {
      // Compte supprimé alors que la session était encore valide.
      return reply.status(401).send({ error: 'Authentification requise' });
    }
    return toPlayerProfile(player);
  });

  app.get('/api/players/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const player = await playerRepo.findById(id);
    if (!player) {
      return reply.status(404).send({ error: 'Player not found' });
    }
    return toPublicPlayer(player);
  });

  // 3 bis. Amis (le joueur est toujours celui du jeton)
  app.get('/api/players', { preHandler: authenticate }, async (req, reply) => {
    const parsed = playerSearchSchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: firstIssue(parsed.error) });
    }
    const { q, limit } = parsed.data;
    return { players: await socialService.search(req.user.sub, q, limit) };
  });

  app.get('/api/friends', { preHandler: authenticate }, async (req) => {
    return { friends: await socialService.friends(req.user.sub) };
  });

  // Fil des sorties des joueurs que je suis, la plus récente en premier (sans tracé GPS).
  app.get('/api/friends/activities', { preHandler: authenticate }, async (req, reply) => {
    const parsed = feedQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: firstIssue(parsed.error) });
    }
    return { activities: await socialService.friendsFeed(req.user.sub, parsed.data.limit) };
  });

  // Classement de la guilde : moi + les joueurs que je suis, sur la période envoyée par l'appli
  // (« semaine en cours » dépend du fuseau du téléphone).
  app.get('/api/friends/leaderboard', { preHandler: authenticate }, async (req, reply) => {
    const parsed = summaryQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: firstIssue(parsed.error) });
    }
    const entries = await socialService.leaderboard(
      req.user.sub,
      new Date(parsed.data.from),
      new Date(parsed.data.to),
    );
    return {
      leaderboard: entries.map(({ player, distanceMeters, activityCount, rank, isMe }) => ({
        ...player,
        distanceMeters,
        activityCount,
        rank,
        isMe,
      })),
    };
  });

  app.get('/api/friends/suggestions', { preHandler: authenticate }, async (req) => {
    const suggestions = await socialService.suggestions(req.user.sub);
    return {
      suggestions: suggestions.map(({ player, activityCount, reason }) => ({
        ...player,
        activityCount,
        reason,
      })),
    };
  });

  app.put('/api/friends/:id', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      await socialService.follow(req.user.sub, id);
      return reply.status(204).send();
    } catch (err) {
      if (err instanceof CannotFollowSelfError) {
        return reply.status(400).send({ error: err.message });
      }
      if (err instanceof PlayerNotFoundError) {
        return reply.status(404).send({ error: err.message });
      }
      throw err;
    }
  });

  app.delete('/api/friends/:id', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await socialService.unfollow(req.user.sub, id);
    return reply.status(204).send();
  });

  // 4. Activity routes (toujours rattachées au joueur du jeton, jamais à un identifiant envoyé par le client)
  app.post(
    '/api/activities',
    { bodyLimit: 32 * 1024 * 1024, preHandler: authenticate },
    async (req, reply) => {
      const parseResult = createActivitySchema.safeParse(req.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Invalid payload schema',
          details: parseResult.error.format(),
        });
      }

      const body = parseResult.data;

      try {
        const result = await activityService.recordActivity({
          playerId: req.user.sub,
          activityType: body.activityType,
          startedAt: new Date(body.startedAt),
          endedAt: new Date(body.endedAt),
          durationSeconds: body.durationSeconds,
          distanceMeters: body.distanceMeters,
          elevationGainMeters: body.elevationGainMeters,
          coordinates: body.coordinates,
          recording: body.recording,
          external: body.external,
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
        if (err instanceof DuplicateActivityError) {
          return reply.status(409).send({
            error: err.message,
            activityId: err.existingActivityId,
          });
        }
        const message = err instanceof Error ? err.message : 'Unknown error';
        return reply.status(400).send({ error: message });
      }
    },
  );

  app.get('/api/activities/me', { preHandler: authenticate }, async (req) => {
    const activities = await activityService.getPlayerActivities(req.user.sub);
    return { activities };
  });

  // Statistiques par période : les bornes viennent de l'appli, qui connaît le fuseau
  // horaire du joueur (« semaine en cours » = lundi 00:00 heure locale).
  app.get('/api/activities/me/summary', { preHandler: authenticate }, async (req, reply) => {
    const parsed = summaryQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: firstIssue(parsed.error) });
    }
    const activities = await activityService.getPlayerActivitySummaries(
      req.user.sub,
      new Date(parsed.data.from),
      new Date(parsed.data.to),
    );
    return { activities };
  });

  app.get('/api/activities/:id', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const activity = await activityService.getActivityById(id);
    // Le tracé est une donnée personnelle : seul son propriétaire peut le lire.
    if (!activity || activity.playerId !== req.user.sub) {
      return reply.status(404).send({ error: 'Activity not found' });
    }
    return activity;
  });

  // 5. Maître de Guilde (Coach IA)
  app.get('/api/coach/settings', { preHandler: authenticate }, async (req) => {
    return coachService.getSettings(req.user.sub);
  });

  app.put('/api/coach/settings', { preHandler: authenticate }, async (req, reply) => {
    const parsed = coachSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: firstIssue(parsed.error) });
    }
    const settings = await coachService.updateSettings(req.user.sub, parsed.data);
    return settings;
  });

  app.get('/api/coach/weekly-report', { preHandler: authenticate }, async (req, reply) => {
    try {
      return await coachService.getWeeklyReport(req.user.sub);
    } catch (err: unknown) {
      if (err instanceof OllamaUnavailableError) {
        return reply.status(503).send({ error: err.message, serviceUnavailable: true });
      }
      const message =
        err instanceof Error ? err.message : 'Erreur de génération du rapport';
      return reply.status(500).send({ error: message });
    }
  });

  app.get('/api/coach/messages', { preHandler: authenticate }, async (req) => {
    const messages = await coachService.getRecentMessages(req.user.sub);
    return { messages };
  });

  app.post(
    '/api/coach/messages',
    { preHandler: authenticate, config: authRateLimit },
    async (req, reply) => {
      const parsed = coachMessageSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: firstIssue(parsed.error) });
      }

      try {
        const message = await coachService.handleChatMessage(
          req.user.sub,
          parsed.data.message,
        );
        return reply.status(201).send({ message });
      } catch (err: unknown) {
        if (err instanceof OllamaUnavailableError) {
          return reply.status(503).send({ error: err.message, serviceUnavailable: true });
        }
        const text =
          err instanceof Error ? err.message : 'Erreur du serveur de conversation';
        return reply.status(500).send({ error: text });
      }
    },
  );

  app.post(
    '/api/coach/messages/stream',
    { preHandler: authenticate, config: authRateLimit },
    async (req, reply) => {
      const parsed = coachMessageSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: firstIssue(parsed.error) });
      }

      reply.raw.setHeader('Access-Control-Allow-Origin', '*');
      reply.raw.setHeader('Access-Control-Allow-Headers', '*');
      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.flushHeaders?.();

      try {
        const finalMessage = await coachService.handleChatMessageStream(
          req.user.sub,
          parsed.data.message,
          (delta) => {
            reply.raw.write(`data: ${JSON.stringify({ type: 'chunk', delta })}\n\n`);
          },
        );

        reply.raw.write(
          `data: ${JSON.stringify({ type: 'done', message: finalMessage })}\n\n`,
        );
        reply.raw.end();
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Erreur de génération du message';
        reply.raw.write(
          `data: ${JSON.stringify({ type: 'error', error: message })}\n\n`,
        );
        reply.raw.end();
      }
    },
  );

  return app;
}

function defaultSocialRepo(
  deps: AppDependencies,
  playerRepo: IPlayerRepository,
  activityRepo: IActivityRepository,
): ISocialRepository {
  if (deps.socialRepo) return deps.socialRepo;
  if (
    playerRepo instanceof InMemoryPlayerRepository &&
    activityRepo instanceof InMemoryActivityRepository
  ) {
    return new InMemorySocialRepository(playerRepo, activityRepo);
  }
  throw new Error('socialRepo requis quand les joueurs ou activités ne sont pas en mémoire');
}
