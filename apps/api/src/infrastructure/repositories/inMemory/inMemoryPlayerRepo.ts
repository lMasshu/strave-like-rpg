import type { Player } from '../../../core/entities/player.js';
import type { IPlayerRepository } from '../../../core/ports/playerRepository.js';

export class InMemoryPlayerRepository implements IPlayerRepository {
  private readonly players = new Map<string, Player>();

  constructor() {
    // Seed default player for immediate testing and mobile pairing
    const defaultPlayer: Player = {
      id: 'player-default-001',
      username: 'Lucas_Run',
      level: 1,
      experience: 820,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    };
    this.players.set(defaultPlayer.id, defaultPlayer);
  }

  async findById(id: string): Promise<Player | null> {
    const player = this.players.get(id);
    return player ? { ...player } : null;
  }

  async findByUsername(username: string): Promise<Player | null> {
    const player = Array.from(this.players.values()).find((p) => p.username === username);
    return player ? { ...player } : null;
  }

  async create(player: Player): Promise<Player> {
    this.players.set(player.id, { ...player });
    return player;
  }

  async updateExperienceAndLevel(id: string, experience: number, level: number): Promise<Player> {
    const player = this.players.get(id);
    if (!player) {
      throw new Error(`Player ${id} not found`);
    }
    const updated: Player = { ...player, experience, level };
    this.players.set(id, updated);
    return updated;
  }
}
