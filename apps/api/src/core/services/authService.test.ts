import { describe, expect, it } from 'vitest';
import { InMemoryPlayerRepository } from '../../infrastructure/repositories/inMemory/inMemoryPlayerRepo.js';
import {
  AuthService,
  EmailAlreadyUsedError,
  InvalidCredentialsError,
  UnverifiedGoogleEmailError,
  usernameBase,
  UsernameTakenError,
} from './authService.js';

function setup() {
  const players = new InMemoryPlayerRepository();
  return { players, auth: new AuthService(players) };
}

const google = {
  sub: 'google-oauth2|42',
  email: 'Lea@Gmail.com',
  emailVerified: true,
  name: 'Léa Trail',
};

describe('AuthService', () => {
  it('inscrit avec un e-mail normalisé et un mot de passe haché', async () => {
    const { auth, players } = setup();

    const player = await auth.register({
      email: ' Lea@Example.COM ',
      password: 'mon-mot-de-passe',
      username: ' Lea ',
    });

    expect(player).toMatchObject({ email: 'lea@example.com', username: 'Lea', auth0Sub: null });
    const stored = await players.findById(player.id);
    expect(stored?.passwordHash).toMatch(/^scrypt\$/);
  });

  it('refuse les doublons d’e-mail et de pseudo', async () => {
    const { auth } = setup();
    await auth.register({ email: 'a@example.com', password: 'mot-de-passe', username: 'Alpha' });

    await expect(
      auth.register({ email: 'A@example.com', password: 'mot-de-passe', username: 'Beta' }),
    ).rejects.toBeInstanceOf(EmailAlreadyUsedError);
    await expect(
      auth.register({ email: 'b@example.com', password: 'mot-de-passe', username: 'Alpha' }),
    ).rejects.toBeInstanceOf(UsernameTakenError);
  });

  it('connecte seulement avec le bon mot de passe', async () => {
    const { auth } = setup();
    const created = await auth.register({
      email: 'a@example.com',
      password: 'mot-de-passe',
      username: 'Alpha',
    });

    await expect(auth.login('A@EXAMPLE.com', 'mot-de-passe')).resolves.toMatchObject({
      id: created.id,
    });
    await expect(auth.login('a@example.com', 'mauvais')).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
    await expect(auth.login('inconnu@example.com', 'mot-de-passe')).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
  });

  it('refuse la connexion par mot de passe d’un compte créé via Google', async () => {
    const { auth } = setup();
    await auth.loginWithGoogle(google);
    await expect(auth.login('lea@gmail.com', 'nimportequoi')).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
  });

  it('Google : crée, retrouve, puis rattache sans dupliquer', async () => {
    const { auth } = setup();
    const created = await auth.loginWithGoogle(google);
    expect(created).toMatchObject({ email: 'lea@gmail.com', username: 'Lea_Trail', passwordHash: null });

    const again = await auth.loginWithGoogle({ ...google, email: 'autre@gmail.com' });
    expect(again.id).toBe(created.id);
  });

  it('Google : rattache le compte e-mail existant, mais pas si l’e-mail n’est pas vérifié', async () => {
    const { auth } = setup();
    const existing = await auth.register({
      email: 'lea@gmail.com',
      password: 'mot-de-passe',
      username: 'Lea',
    });

    await expect(
      auth.loginWithGoogle({ ...google, emailVerified: false }),
    ).rejects.toBeInstanceOf(UnverifiedGoogleEmailError);

    const linked = await auth.loginWithGoogle(google);
    expect(linked).toMatchObject({ id: existing.id, auth0Sub: google.sub });
    expect(linked.passwordHash).toMatch(/^scrypt\$/);
  });

  it('Google : invente un pseudo libre si le nom est déjà pris', async () => {
    const { auth } = setup();
    await auth.register({ email: 'x@example.com', password: 'mot-de-passe', username: 'Lea_Trail' });

    const player = await auth.loginWithGoogle(google);

    expect(player.username).toMatch(/^Lea_Trail_\d{4}$/);
  });
});

describe('usernameBase', () => {
  it.each([
    [{ name: 'Léa Trail', email: 'x@y.z' }, 'Lea_Trail'],
    [{ name: undefined, email: 'hugo.bike@gmail.com' }, 'hugo.bike'],
    [{ name: '李', email: 'ab@y.z' }, 'aventurierab'],
  ])('%o → %s', (identity, expected) => {
    expect(usernameBase(identity)).toBe(expected);
  });
});
