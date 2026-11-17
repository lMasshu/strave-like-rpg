import type { FastifyInstance } from 'fastify';
import { buildApp, type AppDependencies } from '../infrastructure/http/app.js';

export const TEST_JWT_SECRET = 'test-secret-with-at-least-32-characters!!';

export function buildTestApp(
  deps: Partial<AppDependencies> = {},
): Promise<FastifyInstance> {
  return buildApp({
    jwtSecret: TEST_JWT_SECRET,
    authRateLimitPerMinute: 1000,
    ...deps,
  });
}

let counter = 0;

export interface TestSession {
  token: string;
  playerId: string;
  headers: { authorization: string };
}

/** Inscrit un nouveau joueur et renvoie l'en-tête d'authentification prêt à l'emploi. */
export async function registerPlayer(
  app: FastifyInstance,
  overrides: Partial<{ email: string; password: string; username: string }> = {},
): Promise<TestSession> {
  counter += 1;
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      email: `runner${counter}@example.com`,
      password: 'motdepasse-solide',
      username: `runner_${counter}`,
      ...overrides,
    },
  });
  if (response.statusCode !== 201) {
    throw new Error(`Inscription impossible (${response.statusCode}) : ${response.body}`);
  }
  const { token, player } = response.json();
  return { token, playerId: player.id, headers: { authorization: `Bearer ${token}` } };
}

/** Application + joueur connecté, pour les tests qui n'ont besoin que d'un compte. */
export async function appWithPlayer(): Promise<{ app: FastifyInstance } & TestSession> {
  const app = await buildTestApp();
  return { app, ...(await registerPlayer(app)) };
}
