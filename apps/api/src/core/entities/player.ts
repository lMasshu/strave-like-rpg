export interface Player {
  id: string;
  username: string;
  level: number;
  experience: number;
  createdAt: Date;
}

export function calculateLevel(totalExperience: number): { level: number; nextLevelExperience: number } {
  // 1000 XP per level
  const level = Math.floor(totalExperience / 1000) + 1;
  const nextLevelExperience = level * 1000;
  return { level, nextLevelExperience };
}
