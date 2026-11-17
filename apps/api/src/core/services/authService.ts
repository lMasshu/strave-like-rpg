import type { Player } from '../entities/player.js';
import {
  type IPlayerRepository,
  PlayerConflictError,
} from '../ports/playerRepository.js';
import { getDummyHash, hashPassword, verifyPassword } from './passwordHasher.js';

/** Identité Google confirmée par la vérification de signature du jeton Auth0. */
export interface GoogleIdentity {
  /** Identifiant Auth0 stable, ex. « google-oauth2|1234 ». */
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
}

/** Vérifie un jeton d'identité Auth0 (connexion Google) ; lève si invalide. */
export interface IGoogleIdentityVerifier {
  verify(idToken: string): Promise<GoogleIdentity>;
}

export class EmailAlreadyUsedError extends Error {
  constructor() {
    super('Un compte existe déjà avec cet e-mail');
    this.name = 'EmailAlreadyUsedError';
  }
}

export class UsernameTakenError extends Error {
  constructor() {
    super('Ce pseudo est déjà pris');
    this.name = 'UsernameTakenError';
  }
}

/** Message volontairement identique pour un e-mail inconnu ou un mauvais mot de passe. */
export class InvalidCredentialsError extends Error {
  constructor() {
    super('E-mail ou mot de passe incorrect');
    this.name = 'InvalidCredentialsError';
  }
}

/** Google refuse un e-mail non vérifié : on ne peut pas le rattacher à un compte existant. */
export class UnverifiedGoogleEmailError extends Error {
  constructor() {
    super("L'e-mail de ce compte Google n'est pas vérifié");
    this.name = 'UnverifiedGoogleEmailError';
  }
}

export interface RegisterInput {
  email: string;
  password: string;
  username: string;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const USERNAME_MAX = 40;

/** Pseudo dérivé du nom Google ou de l'e-mail, limité aux caractères autorisés. */
export function usernameBase(identity: Pick<GoogleIdentity, 'name' | 'email'>): string {
  const clean = (raw: string) =>
    raw
      .trim()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, '_')
      .replace(/[^A-Za-z0-9_.-]/g, '')
      .slice(0, USERNAME_MAX - 5);

  // Nom sans caractère latin (ex. « 李 ») : on se rabat sur la partie locale de l'e-mail.
  const fromName = clean(identity.name ?? '');
  const cleaned = fromName.length >= 3 ? fromName : clean(identity.email.split('@')[0]);
  return cleaned.length >= 3 ? cleaned : `aventurier${cleaned}`;
}

export class AuthService {
  constructor(private readonly players: IPlayerRepository) {}

  /**
   * Crée un compte e-mail + mot de passe.
   * @throws EmailAlreadyUsedError | UsernameTakenError
   */
  async register(input: RegisterInput): Promise<Player> {
    const email = normalizeEmail(input.email);
    const username = input.username.trim();

    if (await this.players.findByEmail(email)) throw new EmailAlreadyUsedError();
    if (await this.players.findByUsername(username)) throw new UsernameTakenError();

    try {
      return await this.players.create({
        email,
        username,
        passwordHash: await hashPassword(input.password),
        auth0Sub: null,
      });
    } catch (err) {
      // Deux inscriptions simultanées : la contrainte UNIQUE tranche.
      if (err instanceof PlayerConflictError) {
        throw err.field === 'username' ? new UsernameTakenError() : new EmailAlreadyUsedError();
      }
      throw err;
    }
  }

  /** @throws InvalidCredentialsError (e-mail inconnu, compte Google sans mot de passe, ou mot de passe faux) */
  async login(email: string, password: string): Promise<Player> {
    const player = await this.players.findByEmail(normalizeEmail(email));
    const hash = player?.passwordHash ?? (await getDummyHash());
    const valid = await verifyPassword(password, hash);
    if (!player || !player.passwordHash || !valid) throw new InvalidCredentialsError();
    return player;
  }

  /**
   * Connexion Google : retrouve le compte lié, sinon rattache le compte qui a le même
   * e-mail (seulement si Google l'a vérifié), sinon crée un compte sans mot de passe.
   */
  async loginWithGoogle(identity: GoogleIdentity): Promise<Player> {
    const linked = await this.players.findByAuth0Sub(identity.sub);
    if (linked) return linked;

    if (!identity.emailVerified) throw new UnverifiedGoogleEmailError();
    const email = normalizeEmail(identity.email);

    const sameEmail = await this.players.findByEmail(email);
    if (sameEmail) return this.players.linkAuth0Sub(sameEmail.id, identity.sub);

    return this.createGooglePlayer(identity, email);
  }

  private async createGooglePlayer(identity: GoogleIdentity, email: string): Promise<Player> {
    const base = usernameBase(identity);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const username =
        attempt === 0 ? base : `${base}_${Math.floor(1000 + Math.random() * 9000)}`;
      if (await this.players.findByUsername(username)) continue;
      try {
        return await this.players.create({
          email,
          username,
          passwordHash: null,
          auth0Sub: identity.sub,
        });
      } catch (err) {
        if (!(err instanceof PlayerConflictError) || err.field !== 'username') throw err;
      }
    }
    throw new UsernameTakenError();
  }
}
