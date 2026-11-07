import type { Player } from '../entities/player.js';

export interface IPlayerRepository {
  findById(id: string): Promise<Player | null>;
  findByUsername(username: string): Promise<Player | null>;
  create(player: Player): Promise<Player>;
  updateExperienceAndLevel(id: string, experience: number, level: number): Promise<Player>;
}
