import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

/**
 * Hachage des mots de passe avec scrypt (intégré à Node, résistant au calcul sur GPU).
 * Format stocké : `scrypt$N$r$p$selBase64$hashBase64`, pour pouvoir durcir les
 * paramètres plus tard sans invalider les comptes existants.
 */
const DEFAULT_PARAMS = { N: 2 ** 15, r: 8, p: 1 };
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

function derive(
  password: string,
  salt: Buffer,
  params: { N: number; r: number; p: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize('NFKC'),
      salt,
      KEY_LENGTH,
      // 128 * N * r octets nécessaires ; on laisse une marge.
      { ...params, maxmem: 256 * params.N * params.r },
      (err, key) => (err ? reject(err) : resolve(key)),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(password, salt, DEFAULT_PARAMS);
  const { N, r, p } = DEFAULT_PARAMS;
  return ['scrypt', N, r, p, salt.toString('base64'), key.toString('base64')].join('$');
}

/** Comparaison en temps constant ; renvoie `false` (sans lever) pour un hash mal formé. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [N, r, p] = parts.slice(1, 4).map(Number);
  if (![N, r, p].every((n) => Number.isSafeInteger(n) && n > 0)) return false;

  const salt = Buffer.from(parts[4], 'base64');
  const expected = Buffer.from(parts[5], 'base64');
  if (expected.length !== KEY_LENGTH) return false;

  const actual = await derive(password, salt, { N, r, p });
  return timingSafeEqual(actual, expected);
}

/**
 * Hash factice vérifié quand l'e-mail est inconnu : la réponse prend le même temps
 * qu'un vrai mot de passe faux, ce qui empêche de deviner quels e-mails ont un compte.
 */
let dummyHash: Promise<string> | null = null;
export function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(16).toString('hex'));
  return dummyHash;
}
