/** XP nécessaire pour passer un niveau (même règle que l'API : niveau = XP / 1000 + 1). */
export const XP_PER_LEVEL = 1000;

export interface LevelProgress {
  level: number;
  /** XP gagnée depuis le début du niveau actuel. */
  xpInLevel: number;
  /** XP restante avant le niveau suivant. */
  xpToNextLevel: number;
  /** Avancement dans le niveau actuel, de 0 à 100. */
  percent: number;
}

/** Niveau et progression dans le niveau à partir de l'XP totale du joueur. */
export function levelProgress(totalExperience: number): LevelProgress {
  const xp = Number.isFinite(totalExperience)
    ? Math.max(0, Math.floor(totalExperience))
    : 0;
  const xpInLevel = xp % XP_PER_LEVEL;
  return {
    level: Math.floor(xp / XP_PER_LEVEL) + 1,
    xpInLevel,
    xpToNextLevel: XP_PER_LEVEL - xpInLevel,
    percent: Math.round((xpInLevel / XP_PER_LEVEL) * 100),
  };
}
