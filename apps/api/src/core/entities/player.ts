export type CoachGoal =
  | 'casual'
  | 'active'
  | '5k'
  | '10k'
  | 'half-marathon'
  | 'marathon';

/** Joueur = compte utilisateur. Contient des données sensibles : ne jamais le renvoyer tel quel. */
export interface Player {
  id: string;
  username: string;
  /** Identifiant de connexion, stocké en minuscules. */
  email: string;
  /** Hash scrypt du mot de passe ; `null` pour un compte créé uniquement via Google. */
  passwordHash: string | null;
  /** Identifiant Auth0 (connexion Google) ; `null` si jamais lié. */
  auth0Sub: string | null;
  level: number;
  experience: number;
  coachEnabled: boolean;
  coachGoal: CoachGoal;
  createdAt: Date;
}

/** Données nécessaires à la création d'un compte (l'identifiant est généré par le dépôt). */
export type NewPlayer = Omit<
  Player,
  'id' | 'level' | 'experience' | 'createdAt' | 'coachEnabled' | 'coachGoal'
> & {
  coachEnabled?: boolean;
  coachGoal?: CoachGoal;
};

/** Vue renvoyée au propriétaire du compte. */
export interface PlayerProfile {
  id: string;
  username: string;
  email: string;
  level: number;
  experience: number;
  coachEnabled: boolean;
  coachGoal: CoachGoal;
  createdAt: Date;
  /** Moyens de connexion disponibles, pour l'écran Paramètres. */
  hasPassword: boolean;
  googleLinked: boolean;
}

/** Vue publique (consultée par d'autres joueurs) : sans e-mail ni secrets. */
export interface PublicPlayer {
  id: string;
  username: string;
  level: number;
  experience: number;
  createdAt: Date;
}

export function toPlayerProfile(player: Player): PlayerProfile {
  return {
    id: player.id,
    username: player.username,
    email: player.email,
    level: player.level,
    experience: player.experience,
    coachEnabled: player.coachEnabled ?? false,
    coachGoal: player.coachGoal ?? 'casual',
    createdAt: player.createdAt,
    hasPassword: player.passwordHash !== null,
    googleLinked: player.auth0Sub !== null,
  };
}

export function toPublicPlayer(player: Player): PublicPlayer {
  return {
    id: player.id,
    username: player.username,
    level: player.level,
    experience: player.experience,
    createdAt: player.createdAt,
  };
}

export function calculateLevel(totalExperience: number): { level: number; nextLevelExperience: number } {
  // 1000 XP per level
  const level = Math.floor(totalExperience / 1000) + 1;
  const nextLevelExperience = level * 1000;
  return { level, nextLevelExperience };
}
