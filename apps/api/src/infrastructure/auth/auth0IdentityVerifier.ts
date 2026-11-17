import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type {
  GoogleIdentity,
  IGoogleIdentityVerifier,
} from '../../core/services/authService.js';

export interface Auth0Config {
  /** Ex. « mon-tenant.eu.auth0.com » (sans https://). */
  domain: string;
  /** Client ID de l'application Auth0 : audience attendue de l'ID token. */
  clientId: string;
}

/**
 * Vérifie l'ID token Auth0 obtenu après « Continuer avec Google » :
 * signature (clés publiques JWKS du tenant), émetteur, audience et expiration.
 * Ne fait jamais confiance au contenu d'un jeton non vérifié.
 */
export class Auth0IdentityVerifier implements IGoogleIdentityVerifier {
  private readonly issuer: string;
  private readonly keys: JWTVerifyGetKey;

  constructor(
    private readonly config: Auth0Config,
    keys?: JWTVerifyGetKey,
  ) {
    const domain = config.domain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    this.issuer = `https://${domain}/`;
    this.keys = keys ?? createRemoteJWKSet(new URL(`${this.issuer}.well-known/jwks.json`));
  }

  async verify(idToken: string): Promise<GoogleIdentity> {
    const { payload } = await jwtVerify(idToken, this.keys, {
      issuer: this.issuer,
      audience: this.config.clientId,
      algorithms: ['RS256'],
    });

    if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') {
      throw new Error('ID token sans identifiant ni e-mail');
    }
    return {
      sub: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified === true,
      name: typeof payload.name === 'string' ? payload.name : undefined,
    };
  }
}
