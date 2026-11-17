/** Code SQLSTATE d'une violation de contrainte UNIQUE. */
const UNIQUE_VIOLATION = '23505';

interface PgError {
  code?: string;
  constraint?: string;
}

/** Renvoie le nom de la contrainte UNIQUE violée, ou `null` pour toute autre erreur. */
export function uniqueViolation(err: unknown): string | null {
  if (typeof err !== 'object' || err === null) return null;
  const { code, constraint } = err as PgError;
  return code === UNIQUE_VIOLATION ? (constraint ?? '') : null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Évite une erreur SQL (22P02) quand un identifiant venant d'une URL n'est pas un UUID. */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
