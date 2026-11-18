import { randomUUID } from 'node:crypto';
import { calculateLevel, type CoachGoal, type NewPlayer, type Player } from '../../../core/entities/player.js';
import {
  type IPlayerRepository,
  PlayerConflictError,
} from '../../../core/ports/playerRepository.js';

/** Dépôt en mémoire : tests automatisés et développement sans PostgreSQL (données perdues au redémarrage). */
export class InMemoryPlayerRepository implements IPlayerRepository {
  private readonly players = new Map<string, Player>();

  async findById(id: string): Promise<Player | null> {
    return this.copy(this.players.get(id));
  }

  async findByEmail(email: string): Promise<Player | null> {
    const wanted = email.toLowerCase();
    return this.copy(this.find((p) => p.email.toLowerCase() === wanted));
  }

  async findByUsername(username: string): Promise<Player | null> {
    return this.copy(this.find((p) => p.username === username));
  }

  async findByAuth0Sub(auth0Sub: string): Promise<Player | null> {
    return this.copy(this.find((p) => p.auth0Sub === auth0Sub));
  }

  async create(input: NewPlayer): Promise<Player> {
    if (await this.findByEmail(input.email)) throw new PlayerConflictError('email');
    if (await this.findByUsername(input.username)) throw new PlayerConflictError('username');
    if (input.auth0Sub && (await this.findByAuth0Sub(input.auth0Sub))) {
      throw new PlayerConflictError('auth0Sub');
    }
    const player: Player = {
      ...input,
      id: randomUUID(),
      level: 1,
      experience: 0,
      coachEnabled: input.coachEnabled ?? false,
      coachGoal: input.coachGoal ?? 'casual',
      createdAt: new Date(),
    };
    this.players.set(player.id, player);
    return { ...player };
  }

  async linkAuth0Sub(id: string, auth0Sub: string): Promise<Player> {
    return this.update(id, (p) => ({ ...p, auth0Sub }));
  }

  async addExperience(id: string, xpDelta: number): Promise<Player> {
    return this.update(id, (p) => {
      const experience = p.experience + xpDelta;
      return { ...p, experience, level: calculateLevel(experience).level };
    });
  }

  async updateCoachSettings(
    id: string,
    settings: { coachEnabled?: boolean; coachGoal?: CoachGoal },
  ): Promise<Player> {
    return this.update(id, (p) => ({
      ...p,
      coachEnabled:
        settings.coachEnabled !== undefined ? settings.coachEnabled : p.coachEnabled,
      coachGoal: settings.coachGoal !== undefined ? settings.coachGoal : p.coachGoal,
    }));
  }

  private find(predicate: (player: Player) => boolean): Player | undefined {
    return Array.from(this.players.values()).find(predicate);
  }

  private update(id: string, change: (player: Player) => Player): Player {
    const player = this.players.get(id);
    if (!player) throw new Error(`Player ${id} not found`);
    const updated = change(player);
    this.players.set(id, updated);
    return { ...updated };
  }

  private copy(player: Player | undefined): Player | null {
    return player ? { ...player } : null;
  }
}
