import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './passwordHasher.js';

describe('passwordHasher', () => {
  it('ne stocke jamais le mot de passe en clair et sale chaque hash', async () => {
    const first = await hashPassword('correct horse battery');
    const second = await hashPassword('correct horse battery');

    expect(first).toMatch(/^scrypt\$32768\$8\$1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
    expect(first).not.toContain('correct horse battery');
    expect(first).not.toBe(second);
  });

  it('vérifie le bon mot de passe et rejette les autres', async () => {
    const hash = await hashPassword('correct horse battery');

    await expect(verifyPassword('correct horse battery', hash)).resolves.toBe(true);
    await expect(verifyPassword('Correct horse battery', hash)).resolves.toBe(false);
    await expect(verifyPassword('', hash)).resolves.toBe(false);
  });

  it('normalise l’Unicode (même mot de passe saisi sur deux claviers)', async () => {
    const hash = await hashPassword('café-sentier');
    await expect(verifyPassword('café-sentier', hash)).resolves.toBe(true);
  });

  it.each(['', 'bcrypt$x', 'scrypt$a$b$c$d$e', 'scrypt$32768$8$1$c2Vs$Y291cnQ='])(
    'rejette sans lever un hash mal formé (%s)',
    async (stored) => {
      await expect(verifyPassword('peu importe', stored)).resolves.toBe(false);
    },
  );
});
