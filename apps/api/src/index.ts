import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { buildApp, type AppDependencies } from './infrastructure/http/app.js';
import { Auth0IdentityVerifier } from './infrastructure/auth/auth0IdentityVerifier.js';
import { PgActivityRepository } from './infrastructure/repositories/postgres/pgActivityRepo.js';
import { PgPlayerRepository } from './infrastructure/repositories/postgres/pgPlayerRepo.js';
import { PgCoachRepository } from './infrastructure/repositories/postgres/pgCoachRepo.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const HOST = process.env.HOST || '0.0.0.0';

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET (32 caractères minimum) est obligatoire en production');
  }
  console.warn(
    '⚠️  JWT_SECRET absent : secret temporaire généré, les sessions seront perdues au redémarrage.',
  );
  return randomBytes(48).toString('base64url');
}

async function storage(): Promise<
  Pick<AppDependencies, 'playerRepo' | 'activityRepo' | 'coachRepo'> & {
    close?: () => Promise<void>;
  }
> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn(
      '⚠️  DATABASE_URL absent : comptes et activités stockés en mémoire (perdus au redémarrage).',
    );
    return {};
  }
  const pool = new pg.Pool({ connectionString: url });
  await pool.query('SELECT 1'); // Échoue tôt si la base est injoignable.
  console.log('🗄️  PostgreSQL connecté');
  return {
    playerRepo: new PgPlayerRepository(pool),
    activityRepo: new PgActivityRepository(pool),
    coachRepo: new PgCoachRepository(pool),
    close: () => pool.end(),
  };
}

function googleVerifier(): Auth0IdentityVerifier | null {
  const domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_CLIENT_ID;
  if (!domain || !clientId) {
    console.warn('ℹ️  AUTH0_DOMAIN / AUTH0_CLIENT_ID absents : connexion Google désactivée.');
    return null;
  }
  return new Auth0IdentityVerifier({ domain, clientId });
}

async function main() {
  const { close, ...repos } = await storage();
  const app = await buildApp({
    jwtSecret: jwtSecret(),
    googleVerifier: googleVerifier(),
    ...repos,
  });
  if (close) app.addHook('onClose', close);

  try {
    const address = await app.listen({ port: PORT, host: HOST });
    console.log(`🚀 Stride Quest API REST running on ${address}`);
    console.log(`📋 Healthcheck: ${address}/health`);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
